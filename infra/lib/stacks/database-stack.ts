import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface DatabaseStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class DatabaseStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly cluster: rds.DatabaseCluster;
  public readonly secret: secretsmanager.ISecret;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { config } = props;

    // VPC
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: config.environment === 'prod' ? 2 : 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Security group for database
    this.securityGroup = new ec2.SecurityGroup(this, 'DatabaseSG', {
      vpc: this.vpc,
      description: 'Security group for Aurora database',
      allowAllOutbound: false,
    });

    // Allow ingress from VPC CIDR (for Lambda functions in private subnets)
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL from VPC'
    );

    // Aurora Serverless v2 PostgreSQL
    this.cluster = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_6,
      }),
      serverlessV2MinCapacity: config.auroraMinCapacity,
      serverlessV2MaxCapacity: config.auroraMaxCapacity,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.securityGroup],
      defaultDatabaseName: 'sportsage',
      // Note: storageEncrypted intentionally omitted to match existing cluster
      // Adding it (even as false) triggers CloudFormation replacement
      // For new prod clusters, enable encryption from the start
      // Backup configuration
      backup: {
        retention: config.environment === 'prod'
          ? cdk.Duration.days(30)
          : cdk.Duration.days(7),
      },
      deletionProtection: config.environment === 'prod',
      removalPolicy: config.environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      enableDataApi: true, // Enable Data API for serverless access
    });

    this.secret = this.cluster.secret!;

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: `${config.environment}-sport-sage-vpc-id`,
    });

    new cdk.CfnOutput(this, 'DatabaseClusterArn', {
      value: this.cluster.clusterArn,
      exportName: `${config.environment}-sport-sage-db-cluster-arn`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.secret.secretArn,
      exportName: `${config.environment}-sport-sage-db-secret-arn`,
    });
  }
}
