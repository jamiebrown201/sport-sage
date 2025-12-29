import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface AuthStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;

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

    // ===================================================================
    // SOCIAL IDENTITY PROVIDERS
    // Uncomment and configure these when you have credentials from
    // Apple Developer Portal and Google Cloud Console
    // ===================================================================

    // Google Identity Provider
    // Get credentials from: https://console.cloud.google.com/apis/credentials
    // 1. Create OAuth 2.0 Client ID (Web application type)
    // 2. Add authorized redirect URI: https://sport-sage-dev.auth.eu-west-1.amazoncognito.com/oauth2/idpresponse
    /*
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool: this.userPool,
      clientId: 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com', // TODO: Add your Web Client ID
      clientSecretValue: cdk.SecretValue.secretsManager('sport-sage/google-client-secret'), // TODO: Create secret in Secrets Manager
      scopes: ['email', 'profile', 'openid'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
      },
    });
    */

    // Apple Identity Provider
    // Get credentials from: https://developer.apple.com/account/resources/identifiers
    // 1. Create App ID with "Sign in with Apple" capability
    // 2. Create Service ID (this is your client_id)
    // 3. Create private key for Sign in with Apple
    // 4. Add redirect URL: https://sport-sage-dev.auth.eu-west-1.amazoncognito.com/oauth2/idpresponse
    /*
    const appleProvider = new cognito.UserPoolIdentityProviderApple(this, 'AppleProvider', {
      userPool: this.userPool,
      clientId: 'com.sportsage.app.signin', // TODO: Your Service ID from Apple Developer Portal
      teamId: 'YOUR_TEAM_ID', // TODO: Your Apple Team ID
      keyId: 'YOUR_KEY_ID', // TODO: Your Sign in with Apple Key ID
      privateKey: cdk.SecretValue.secretsManager('sport-sage/apple-private-key'), // TODO: Create secret with .p8 file contents
      scopes: ['email', 'name'],
      attributeMapping: {
        email: cognito.ProviderAttribute.APPLE_EMAIL,
        givenName: cognito.ProviderAttribute.APPLE_FIRST_NAME,
        familyName: cognito.ProviderAttribute.APPLE_LAST_NAME,
      },
    });
    */

    // Update the User Pool Client to include the identity providers
    // Uncomment when providers are configured above
    /*
    this.userPoolClient = this.userPool.addClient('MobileClientWithSocial', {
      userPoolClientName: `sport-sage-${config.environment}-mobile`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.APPLE,
      ],
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
          'exp://127.0.0.1:8081/--/auth/callback',
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
    */

    // Identity Pool for federated identities
    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `sport_sage_${config.environment}_identity`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [{
        clientId: this.userPoolClient.userPoolClientId,
        providerName: this.userPool.userPoolProviderName,
      }],
      // Uncomment when Google/Apple providers are configured
      // supportedLoginProviders: {
      //   'appleid.apple.com': 'com.sportsage.app',
      //   'accounts.google.com': 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com',
      // },
    });

    // IAM roles for authenticated users
    const authenticatedRole = new iam.Role(this, 'CognitoAuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Role for authenticated Sport Sage users',
    });

    // Attach Identity Pool roles
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: authenticatedRole.roleArn,
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

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      exportName: `${config.environment}-sport-sage-identity-pool-id`,
    });
  }
}
