import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface MigrationStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

/**
 * Migration Stack
 *
 * Runs database migrations on every deployment using Drizzle.
 * This stack imports database values from CloudFormation exports
 * to avoid dependency issues with the Database stack.
 */
export class MigrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MigrationStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Import database values from CloudFormation exports
    const clusterArn = cdk.Fn.importValue(`${config.environment}-sport-sage-db-cluster-arn`);
    const secretArn = cdk.Fn.importValue(`${config.environment}-sport-sage-db-secret-arn`);

    // Migration Lambda - runs Drizzle migrations via RDS Data API
    const migrationFunction = new NodejsFunction(this, 'MigrationFunction', {
      entry: path.join(__dirname, '../../../packages/database/src/migrate.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: [],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string) => [
            // Copy drizzle migrations to the Lambda output
            `cp -r ${inputDir}/packages/database/drizzle ${outputDir}/drizzle 2>/dev/null || mkdir -p ${outputDir}/drizzle`,
          ],
        },
      },
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      },
    });

    // Grant the migration function access to RDS Data API and Secrets
    // Use wildcard for cluster ARN to avoid token resolution issues
    migrationFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement', 'rds-data:BatchExecuteStatement'],
      resources: [`arn:aws:rds:${this.region}:${this.account}:cluster:*`],
    }));

    migrationFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:*`],
    }));

    // Custom Resource Provider
    const migrationProvider = new cr.Provider(this, 'MigrationProvider', {
      onEventHandler: migrationFunction,
    });

    // Custom Resource - triggers migration on every deployment
    new cdk.CustomResource(this, 'MigrationResource', {
      serviceToken: migrationProvider.serviceToken,
      properties: {
        ClusterArn: clusterArn,
        SecretArn: secretArn,
        DatabaseName: 'sportsage',
        // Force update on every deployment
        Timestamp: Date.now().toString(),
      },
    });

    // Output
    new cdk.CfnOutput(this, 'MigrationFunctionArn', {
      value: migrationFunction.functionArn,
      description: 'ARN of the migration Lambda function',
    });
  }
}
