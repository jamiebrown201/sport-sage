import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as eventsources from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import * as path from 'path';

export interface ScraperStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  databaseCluster: rds.DatabaseCluster;
  databaseSecret: secretsmanager.ISecret;
  settlementQueue: sqs.Queue;
}

export class ScraperStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ScraperStackProps) {
    super(scope, id, props);

    const { config, vpc, databaseCluster, databaseSecret, settlementQueue } = props;

    // Security group for scraper Lambda functions
    // Note: Database security group allows ingress from VPC CIDR, so this works
    const scraperSG = new ec2.SecurityGroup(this, 'ScraperSG', {
      vpc,
      description: 'Security group for scraper Lambda functions',
      allowAllOutbound: true,
    });

    // IPRoyal proxy credentials (stored in Secrets Manager)
    const iproyalSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'IPRoyalSecret',
      'sport-sage/iproyal-proxy'
    );

    // Common environment variables
    const commonEnv = {
      DATABASE_RESOURCE_ARN: databaseCluster.clusterArn,
      DATABASE_SECRET_ARN: databaseSecret.secretArn,
      DATABASE_NAME: 'sportsage',
      SETTLEMENT_QUEUE_URL: settlementQueue.queueUrl,
      // IPRoyal proxy for fallback sources (Flashscore, ESPN, etc.)
      IPROYAL_USERNAME: iproyalSecret.secretValueFromJson('username').unsafeUnwrap(),
      IPROYAL_PASSWORD: iproyalSecret.secretValueFromJson('password').unsafeUnwrap(),
      PROXY_COUNTRY: 'gb',
    };

    // Default Lambda props for scrapers (more memory and timeout)
    const defaultScraperProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.X86_64, // Required for playwright-aws-lambda (only x86_64 Chromium available)
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
      environment: commonEnv,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [scraperSG],
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
        // Include playwright and chromium for Lambda
        nodeModules: ['playwright-core', '@sparticuz/chromium'],
      },
    };

    // Sync Fixtures - every 6 hours
    // Higher memory for Playwright/Chromium - also gives faster CPU
    const syncFixturesHandler = new NodejsFunction(this, 'SyncFixtures', {
      ...defaultScraperProps,
      functionName: `sport-sage-${config.environment}-sync-fixtures`,
      entry: path.join(__dirname, '../../../packages/scraper/src/jobs/sync-fixtures.ts'),
      handler: 'handler',
      memorySize: 2048, // More memory for Chromium and faster CPU
      timeout: cdk.Duration.minutes(10), // Longer timeout for scraping all sports
    });

    databaseSecret.grantRead(syncFixturesHandler);
    databaseCluster.grantDataApiAccess(syncFixturesHandler);

    new events.Rule(this, 'SyncFixturesSchedule', {
      ruleName: `sport-sage-${config.environment}-sync-fixtures`,
      schedule: events.Schedule.rate(cdk.Duration.hours(6)),
      targets: [new targets.LambdaFunction(syncFixturesHandler)],
    });

    // Sync Live Scores - every minute (will exit early if no live events)
    // More memory needed when using multiple proxy sources (each browser context uses ~200MB)
    // Longer timeout to allow launching separate browsers for proxy sources
    const syncLiveScoresHandler = new NodejsFunction(this, 'SyncLiveScores', {
      ...defaultScraperProps,
      functionName: `sport-sage-${config.environment}-sync-live-scores`,
      entry: path.join(__dirname, '../../../packages/scraper/src/jobs/sync-live-scores.ts'),
      handler: 'handler',
      memorySize: 2048, // More memory for multiple proxy browser contexts
      timeout: cdk.Duration.seconds(120), // Longer timeout for proxy browser launches
    });

    databaseSecret.grantRead(syncLiveScoresHandler);
    databaseCluster.grantDataApiAccess(syncLiveScoresHandler);
    settlementQueue.grantSendMessages(syncLiveScoresHandler);

    new events.Rule(this, 'SyncLiveScoresSchedule', {
      ruleName: `sport-sage-${config.environment}-sync-live-scores`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new targets.LambdaFunction(syncLiveScoresHandler)],
    });

    // Transition Events - every minute (marks scheduled events as live when start time passes)
    const transitionEventsHandler = new NodejsFunction(this, 'TransitionEvents', {
      ...defaultScraperProps,
      functionName: `sport-sage-${config.environment}-transition-events`,
      entry: path.join(__dirname, '../../../packages/scraper/src/jobs/transition-events.ts'),
      handler: 'handler',
      memorySize: 256, // Lightweight - no browser needed
      timeout: cdk.Duration.seconds(30),
      // Override bundling to exclude playwright
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    databaseSecret.grantRead(transitionEventsHandler);
    databaseCluster.grantDataApiAccess(transitionEventsHandler);

    new events.Rule(this, 'TransitionEventsSchedule', {
      ruleName: `sport-sage-${config.environment}-transition-events`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      targets: [new targets.LambdaFunction(transitionEventsHandler)],
    });

    // Sync Odds - every 15 minutes
    const syncOddsHandler = new NodejsFunction(this, 'SyncOdds', {
      ...defaultScraperProps,
      functionName: `sport-sage-${config.environment}-sync-odds`,
      entry: path.join(__dirname, '../../../packages/scraper/src/jobs/sync-odds.ts'),
      handler: 'handler',
    });

    databaseSecret.grantRead(syncOddsHandler);
    databaseCluster.grantDataApiAccess(syncOddsHandler);

    new events.Rule(this, 'SyncOddsSchedule', {
      ruleName: `sport-sage-${config.environment}-sync-odds`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      targets: [new targets.LambdaFunction(syncOddsHandler)],
    });

    // Settlement Processor - triggered by SQS
    const settlementHandler = new NodejsFunction(this, 'SettlementProcessor', {
      ...defaultScraperProps,
      functionName: `sport-sage-${config.environment}-settlement`,
      entry: path.join(__dirname, '../../../packages/scraper/src/jobs/settle-predictions.ts'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
    });

    databaseSecret.grantRead(settlementHandler);
    databaseCluster.grantDataApiAccess(settlementHandler);

    settlementHandler.addEventSource(
      new eventsources.SqsEventSource(settlementQueue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'SyncFixturesFunctionArn', {
      value: syncFixturesHandler.functionArn,
      exportName: `${config.environment}-sport-sage-sync-fixtures-arn`,
    });
  }
}
