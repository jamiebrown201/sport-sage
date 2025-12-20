#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { QueueStack } from '../lib/stacks/queue-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { ScraperStack } from '../lib/stacks/scraper-stack';
import { getEnvironmentConfig } from '../lib/config/environments';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const environmentName = app.node.tryGetContext('environment') || 'dev';
const config = getEnvironmentConfig(environmentName);

const env = {
  account: config.account || process.env.CDK_DEFAULT_ACCOUNT,
  region: config.region,
};

const prefix = `SportSage-${config.environment.charAt(0).toUpperCase() + config.environment.slice(1)}`;

// Database Stack
const databaseStack = new DatabaseStack(app, `${prefix}-Database`, {
  env,
  config,
  description: `Sport Sage ${config.environment} database infrastructure`,
});

// Auth Stack
const authStack = new AuthStack(app, `${prefix}-Auth`, {
  env,
  config,
  description: `Sport Sage ${config.environment} authentication`,
});

// Queue Stack
const queueStack = new QueueStack(app, `${prefix}-Queues`, {
  env,
  config,
  description: `Sport Sage ${config.environment} message queues`,
});

// API Stack
const apiStack = new ApiStack(app, `${prefix}-Api`, {
  env,
  config,
  vpc: databaseStack.vpc,
  databaseCluster: databaseStack.cluster,
  databaseSecret: databaseStack.secret,
  databaseSecurityGroup: databaseStack.securityGroup,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  settlementQueue: queueStack.settlementQueue,
  description: `Sport Sage ${config.environment} API`,
});

// Scraper Stack
const scraperStack = new ScraperStack(app, `${prefix}-Scraper`, {
  env,
  config,
  vpc: databaseStack.vpc,
  databaseCluster: databaseStack.cluster,
  databaseSecret: databaseStack.secret,
  settlementQueue: queueStack.settlementQueue,
  description: `Sport Sage ${config.environment} scraper jobs`,
});

// Add dependencies
apiStack.addDependency(databaseStack);
apiStack.addDependency(authStack);
apiStack.addDependency(queueStack);
scraperStack.addDependency(databaseStack);
scraperStack.addDependency(queueStack);

// Tags
cdk.Tags.of(app).add('Project', 'SportSage');
cdk.Tags.of(app).add('Environment', config.environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
