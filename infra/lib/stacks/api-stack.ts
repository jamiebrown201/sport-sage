import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
  vpc: ec2.Vpc;
  databaseCluster: rds.DatabaseCluster;
  databaseSecret: secretsmanager.ISecret;
  databaseSecurityGroup: ec2.SecurityGroup;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  settlementQueue: sqs.Queue;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { config, vpc, databaseCluster, databaseSecret, databaseSecurityGroup, userPool, userPoolClient, settlementQueue } = props;

    // Security group for Lambda functions (allowAllOutbound handles DB connectivity)
    const lambdaSG = new ec2.SecurityGroup(this, 'LambdaSG', {
      vpc,
      description: 'Security group for API Lambda functions',
      allowAllOutbound: true,
    });

    // Common environment variables for all handlers
    const commonEnv = {
      DATABASE_RESOURCE_ARN: databaseCluster.clusterArn,
      DATABASE_SECRET_ARN: databaseSecret.secretArn,
      DATABASE_NAME: 'sportsage',
      SETTLEMENT_QUEUE_URL: settlementQueue.queueUrl,
    };

    // Default Lambda props
    const defaultLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: config.lambdaMemory,
      timeout: cdk.Duration.seconds(config.lambdaTimeout),
      environment: commonEnv,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSG],
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    };

    // Create handler functions
    const handlers: Record<string, NodejsFunction> = {};
    const handlerNames = ['auth', 'events', 'predictions', 'wallet', 'leaderboard', 'social', 'shop', 'challenges', 'achievements', 'monitoring'];

    for (const name of handlerNames) {
      handlers[name] = new NodejsFunction(this, `${name}Handler`, {
        ...defaultLambdaProps,
        functionName: `sport-sage-${config.environment}-${name}`,
        entry: path.join(__dirname, `../../../packages/api/src/handlers/${name}/index.ts`),
        handler: 'handler',
      });

      // Grant permissions
      databaseSecret.grantRead(handlers[name]);
      databaseCluster.grantDataApiAccess(handlers[name]);
    }

    // Grant SQS permissions to predictions handler
    settlementQueue.grantSendMessages(handlers['predictions']);

    // HTTP API
    this.api = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `sport-sage-${config.environment}-api`,
      corsPreflight: {
        allowHeaders: ['Authorization', 'Content-Type', 'X-Amz-Date', 'X-Api-Key'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // Cognito authorizer
    const authorizer = new apigatewayv2Authorizers.HttpUserPoolAuthorizer('CognitoAuthorizer', userPool, {
      userPoolClients: [userPoolClient],
      identitySource: ['$request.header.Authorization'],
    });

    // Add routes for each handler
    for (const name of handlerNames) {
      const integration = new apigatewayv2Integrations.HttpLambdaIntegration(
        `${name}Integration`,
        handlers[name]
      );

      // Auth and monitoring endpoints don't require authorization
      // TODO: Add admin auth for monitoring in production
      const needsAuth = name !== 'auth' && name !== 'monitoring';

      this.api.addRoutes({
        path: `/api/${name}`,
        methods: [apigatewayv2.HttpMethod.ANY],
        integration,
        authorizer: needsAuth ? authorizer : undefined,
      });

      this.api.addRoutes({
        path: `/api/${name}/{proxy+}`,
        methods: [apigatewayv2.HttpMethod.ANY],
        integration,
        authorizer: needsAuth ? authorizer : undefined,
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url || '',
      exportName: `${config.environment}-sport-sage-api-url`,
    });
  }
}
