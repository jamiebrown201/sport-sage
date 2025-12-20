import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface QueueStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class QueueStack extends cdk.Stack {
  public readonly settlementQueue: sqs.Queue;
  public readonly settlementDLQ: sqs.Queue;

  constructor(scope: Construct, id: string, props: QueueStackProps) {
    super(scope, id, props);

    const { config } = props;

    // Dead letter queue for failed settlements
    this.settlementDLQ = new sqs.Queue(this, 'SettlementDLQ', {
      queueName: `sport-sage-${config.environment}-settlement-dlq.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Main settlement queue
    this.settlementQueue = new sqs.Queue(this, 'SettlementQueue', {
      queueName: `sport-sage-${config.environment}-settlement.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.minutes(5),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: this.settlementDLQ,
        maxReceiveCount: 3,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'SettlementQueueUrl', {
      value: this.settlementQueue.queueUrl,
      exportName: `${config.environment}-sport-sage-settlement-queue-url`,
    });

    new cdk.CfnOutput(this, 'SettlementQueueArn', {
      value: this.settlementQueue.queueArn,
      exportName: `${config.environment}-sport-sage-settlement-queue-arn`,
    });
  }
}
