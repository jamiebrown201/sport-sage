import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface AuthStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { config } = props;

    // User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `sport-sage-${config.environment}-users`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      customAttributes: {
        username: new cognito.StringAttribute({ minLen: 3, maxLen: 20, mutable: false }),
      },
      removalPolicy: config.environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // App Client for mobile
    this.userPoolClient = this.userPool.addClient('MobileClient', {
      userPoolClientName: `sport-sage-${config.environment}-mobile`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'sportsage://auth/callback',
          'exp://127.0.0.1:8081/--/auth/callback', // Expo dev
        ],
        logoutUrls: [
          'sportsage://auth/logout',
          'exp://127.0.0.1:8081/--/auth/logout',
        ],
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // Domain for hosted UI (optional)
    this.userPool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: `sport-sage-${config.environment}`,
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `${config.environment}-sport-sage-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `${config.environment}-sport-sage-user-pool-client-id`,
    });
  }
}
