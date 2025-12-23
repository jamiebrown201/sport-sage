export interface EnvironmentConfig {
  environment: 'dev' | 'staging' | 'prod';
  account: string;
  region: string;

  // Database
  auroraMinCapacity: number;
  auroraMaxCapacity: number;

  // Lambda
  lambdaMemory: number;
  lambdaTimeout: number;

  // Feature flags
  enableAlarms: boolean;

  // External access (VPS scraper)
  vpsIp?: string;
}

export const environments: Record<string, EnvironmentConfig> = {
  dev: {
    environment: 'dev',
    account: process.env.CDK_DEFAULT_ACCOUNT || '',
    region: 'eu-west-1',
    auroraMinCapacity: 0.5,
    auroraMaxCapacity: 2,
    lambdaMemory: 512,
    lambdaTimeout: 30,
    enableAlarms: false,
    vpsIp: '77.42.42.185', // Hetzner VPS for scraper service
  },
  staging: {
    environment: 'staging',
    account: process.env.CDK_DEFAULT_ACCOUNT || '',
    region: 'eu-west-1',
    auroraMinCapacity: 0.5,
    auroraMaxCapacity: 4,
    lambdaMemory: 512,
    lambdaTimeout: 30,
    enableAlarms: true,
  },
  prod: {
    environment: 'prod',
    account: process.env.CDK_DEFAULT_ACCOUNT || '',
    region: 'eu-west-1',
    auroraMinCapacity: 1,
    auroraMaxCapacity: 8,
    lambdaMemory: 1024,
    lambdaTimeout: 30,
    enableAlarms: true,
  },
};

export function getEnvironmentConfig(env: string): EnvironmentConfig {
  return environments[env] || environments.dev;
}
