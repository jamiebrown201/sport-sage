/**
 * Lambdas Page - Lambda function management
 */

import { LambdaClient, InvokeCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { layout } from '../ui/layout.js';

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const logsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'eu-west-1' });

const LAMBDA_FUNCTIONS = [
  'sync-fixtures',
  'transition-events',
  'sync-live-scores',
  'sync-odds',
  'settlement',
];

export async function handleLambdas(environment: string, flash?: string): Promise<string> {
  const lambdaStatus: { name: string; status: string; lastModified?: string; memorySize?: number }[] = [];

  for (const fn of LAMBDA_FUNCTIONS) {
    const functionName = `sport-sage-${environment}-${fn}`;
    try {
      const response = await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));
      lambdaStatus.push({
        name: fn,
        status: response.Configuration?.State || 'Unknown',
        lastModified: response.Configuration?.LastModified,
        memorySize: response.Configuration?.MemorySize,
      });
    } catch (e: any) {
      lambdaStatus.push({
        name: fn,
        status: e.name === 'ResourceNotFoundException' ? 'Not Deployed' : 'Error',
      });
    }
  }

  const lambdaCards = lambdaStatus.map(fn => {
    const statusClass = fn.status === 'Active' ? 'success' : fn.status === 'Not Deployed' ? 'error' : 'warning';
    return `
      <div class="card" style="padding: 15px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h3 style="margin: 0; font-size: 1em;">${fn.name}</h3>
          <span class="badge badge-${statusClass}">${fn.status}</span>
        </div>
        ${fn.memorySize ? `<div style="color: var(--text-muted); font-size: 0.85em; margin-bottom: 10px;">${fn.memorySize}MB</div>` : ''}
        ${fn.lastModified ? `<div style="color: #666; font-size: 0.8em; margin-bottom: 15px;">Modified: ${new Date(fn.lastModified).toLocaleString()}</div>` : ''}
        <div style="display: flex; gap: 10px;">
          ${fn.status === 'Active' ? `
            <form method="POST" action="/lambdas/invoke/${fn.name}" style="display: inline;">
              <button type="submit" class="btn btn-sm">Invoke</button>
            </form>
            <a href="/lambdas/logs/${fn.name}" class="btn btn-secondary btn-sm">Logs</a>
          ` : '<span style="color: var(--text-muted); font-size: 0.85em;">Not available</span>'}
        </div>
      </div>
    `;
  }).join('');

  const content = `
    <h1>Lambda Functions</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px;">
      ${lambdaCards}
    </div>

    <div class="card" style="margin-top: 30px;">
      <h2 style="margin-top: 0;">Function Reference</h2>
      <table>
        <thead><tr><th>Function</th><th>Schedule</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>sync-fixtures</code></td><td>Every 6 hours</td><td>Scrapes upcoming fixtures from sources</td></tr>
          <tr><td><code>transition-events</code></td><td>Every 1 minute</td><td>Marks scheduled events as live when start_time passes</td></tr>
          <tr><td><code>sync-live-scores</code></td><td>Every 1 minute</td><td>Updates live match scores</td></tr>
          <tr><td><code>sync-odds</code></td><td>Every 15 minutes</td><td>Scrapes odds from bookmakers</td></tr>
          <tr><td><code>settlement</code></td><td>SQS triggered</td><td>Processes finished matches and settles predictions</td></tr>
        </tbody>
      </table>
    </div>
  `;

  return layout('Lambdas', content, environment);
}

export async function handleLambdaLogs(shortName: string, environment: string): Promise<string> {
  const functionName = `sport-sage-${environment}-${shortName}`;
  const logGroupName = `/aws/lambda/${functionName}`;
  let logsHtml = '';

  try {
    const streams = await logsClient.send(new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 1,
    }));

    if (!streams.logStreams?.length) {
      logsHtml = '<div class="empty">No log streams found</div>';
    } else {
      const logStream = streams.logStreams[0];
      const logEvents = await logsClient.send(new GetLogEventsCommand({
        logGroupName,
        logStreamName: logStream.logStreamName!,
        limit: 100,
        startFromHead: false,
      }));

      const logs = (logEvents.events || []).map(event => {
        const msg = event.message || '';
        let lineClass = '';
        if (msg.includes('ERROR') || msg.includes('Error')) lineClass = 'color: var(--error);';
        else if (msg.includes('WARN') || msg.includes('Warning')) lineClass = 'color: var(--warning);';
        else if (msg.includes('INFO')) lineClass = 'color: var(--info);';
        return `<div style="padding: 2px 0; ${lineClass}">${new Date(event.timestamp || 0).toISOString()} ${msg}</div>`;
      }).join('');

      logsHtml = `
        <div style="color: var(--text-muted); margin-bottom: 15px; font-size: 0.9em;">
          Stream: ${logStream.logStreamName}<br>
          Last event: ${logStream.lastEventTimestamp ? new Date(logStream.lastEventTimestamp).toLocaleString() : 'N/A'}
        </div>
        <div style="background: #0d0d1a; border: 1px solid var(--border); border-radius: 8px; padding: 15px; font-family: monospace; font-size: 0.85em; max-height: 500px; overflow-y: auto; white-space: pre-wrap;">
          ${logs || '<div class="empty">No log events</div>'}
        </div>
      `;
    }
  } catch (e: any) {
    if (e.name === 'ResourceNotFoundException') {
      logsHtml = '<div class="empty">Log group not found. The Lambda may not have been invoked yet.</div>';
    } else {
      logsHtml = `<div class="flash flash-error">Error fetching logs: ${e.message}</div>`;
    }
  }

  const content = `
    <h1>Logs: ${shortName}</h1>
    <div style="margin-bottom: 20px;">
      <a href="/lambdas" class="btn btn-secondary">Back to Lambdas</a>
      <a href="/lambdas/logs/${shortName}" class="btn btn-secondary" style="margin-left: 10px;">Refresh</a>
    </div>
    ${logsHtml}
  `;

  return layout(`Logs: ${shortName}`, content, environment);
}

export async function invokeLambda(shortName: string, environment: string): Promise<{ success: boolean; message: string }> {
  const functionName = `sport-sage-${environment}-${shortName}`;

  try {
    await lambdaClient.send(new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
    }));

    return {
      success: true,
      message: `Lambda ${shortName} invoked successfully (async). Check logs for results.`,
    };
  } catch (e: any) {
    return {
      success: false,
      message: `Failed to invoke ${shortName}: ${e.message}`,
    };
  }
}
