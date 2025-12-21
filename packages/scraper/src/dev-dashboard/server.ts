#!/usr/bin/env node
/**
 * Sport Sage Dev Dashboard
 *
 * Features:
 * - View database stats and fixture counts
 * - Trigger Lambda functions (sync-fixtures, sync-odds, etc.)
 * - View Lambda execution logs
 * - Browse events, teams, competitions
 * - Run SQL queries
 *
 * Run with AWS credentials:
 *   DATABASE_RESOURCE_ARN="..." DATABASE_SECRET_ARN="..." pnpm dev-dashboard
 */

import http from 'http';
import { URL } from 'url';
import { getDb, events, sports, teams, competitions, teamAliases } from '@sport-sage/database';
import { desc, gte, lte, eq, and, count, sql, ilike } from 'drizzle-orm';
import { LambdaClient, InvokeCommand, ListFunctionsCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { CloudWatchLogsClient, DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const PORT = process.env.PORT || 3333;
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// AWS Clients
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const logsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'eu-west-1' });

// Lambda function names
const LAMBDA_FUNCTIONS = {
  syncFixtures: `sport-sage-${ENVIRONMENT}-sync-fixtures`,
  transitionEvents: `sport-sage-${ENVIRONMENT}-transition-events`,
  syncLiveScores: `sport-sage-${ENVIRONMENT}-sync-live-scores`,
  syncOdds: `sport-sage-${ENVIRONMENT}-sync-odds`,
  settlement: `sport-sage-${ENVIRONMENT}-settlement`,
};

// Check database configuration on startup
function checkDatabaseConfig(): { configured: boolean; message: string } {
  if (process.env.DATABASE_URL) {
    return { configured: true, message: `Local PostgreSQL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}` };
  }
  if (process.env.DATABASE_RESOURCE_ARN && process.env.DATABASE_SECRET_ARN) {
    return { configured: true, message: `AWS Aurora Data API` };
  }
  return {
    configured: false,
    message: `Database not configured. Set DATABASE_RESOURCE_ARN and DATABASE_SECRET_ARN.`
  };
}

// HTML template
function html(title: string, content: string, nav = true): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Sport Sage Dev</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      line-height: 1.6;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    nav {
      background: #1a1a2e;
      padding: 15px 20px;
      border-bottom: 1px solid #333;
      display: flex;
      gap: 20px;
      align-items: center;
      flex-wrap: wrap;
    }
    nav a {
      color: #888;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 6px;
      transition: all 0.2s;
    }
    nav a:hover, nav a.active { color: #fff; background: #333; }
    nav .logo { font-weight: bold; color: #00d4aa; font-size: 1.2em; }
    nav .env {
      margin-left: auto;
      background: #2d2d4d;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.85em;
      color: #00d4aa;
    }
    h1 { color: #fff; margin-bottom: 20px; }
    h2 { color: #00d4aa; margin: 30px 0 15px; font-size: 1.1em; }
    .card {
      background: #1a1a2e;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid #333;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }
    .stat {
      background: #252545;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value { font-size: 2em; font-weight: bold; color: #00d4aa; }
    .stat-label { color: #888; font-size: 0.85em; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #333;
    }
    th { color: #888; font-weight: 500; font-size: 0.85em; text-transform: uppercase; }
    tr:hover { background: #252545; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 500;
    }
    .badge-success { background: #0d4d3a; color: #00d4aa; }
    .badge-warning { background: #4d3d0d; color: #ffaa00; }
    .badge-error { background: #4d0d0d; color: #ff4444; }
    .badge-info { background: #0d2d4d; color: #44aaff; }
    .search-box {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    input[type="text"], select, textarea {
      background: #252545;
      border: 1px solid #444;
      color: #fff;
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 1em;
    }
    input[type="text"]:focus, textarea:focus { outline: none; border-color: #00d4aa; }
    button, .btn {
      background: #00d4aa;
      color: #000;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      text-decoration: none;
      display: inline-block;
    }
    button:hover, .btn:hover { background: #00b894; }
    button.btn-secondary { background: #444; color: #fff; }
    button.btn-secondary:hover { background: #555; }
    button.btn-danger { background: #ff4444; color: #fff; }
    .empty { color: #666; font-style: italic; padding: 40px; text-align: center; }
    a { color: #00d4aa; }
    .time-ago { color: #888; }
    pre { background: #1a1a2e; padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 0.9em; }
    code { color: #00d4aa; }
    .lambda-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .lambda-card {
      background: #252545;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #333;
    }
    .lambda-card h3 { color: #fff; margin-bottom: 10px; font-size: 1em; }
    .lambda-card .status { margin-bottom: 15px; }
    .lambda-card .actions { display: flex; gap: 10px; }
    .lambda-card button { padding: 8px 16px; font-size: 0.9em; }
    .log-output {
      background: #0d0d1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 15px;
      font-family: monospace;
      font-size: 0.85em;
      max-height: 400px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
    .log-line { padding: 2px 0; }
    .log-line.error { color: #ff4444; }
    .log-line.warn { color: #ffaa00; }
    .log-line.info { color: #44aaff; }
    .flash {
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .flash-success { background: #0d4d3a; color: #00d4aa; border: 1px solid #00d4aa; }
    .flash-error { background: #4d0d0d; color: #ff4444; border: 1px solid #ff4444; }
    .loading { opacity: 0.5; pointer-events: none; }
  </style>
</head>
<body>
  ${nav ? `
  <nav>
    <span class="logo">⚽ Sport Sage</span>
    <a href="/">Dashboard</a>
    <a href="/lifecycle">Lifecycle</a>
    <a href="/lambdas">Lambdas</a>
    <a href="/events">Events</a>
    <a href="/teams">Teams</a>
    <a href="/competitions">Competitions</a>
    <a href="/query">Query</a>
    <a href="/stealth-test">Stealth Test</a>
    <span class="env">${ENVIRONMENT.toUpperCase()}</span>
  </nav>
  ` : ''}
  <div class="container">
    ${content}
  </div>
</body>
</html>`;
}

function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Dashboard page
async function handleDashboard(): Promise<string> {
  const db = getDb();
  const now = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalEvents] = await db.select({ count: count() }).from(events);
  // Use sql for enum comparisons (Data API compatibility)
  const [scheduledEvents] = await db.select({ count: count() }).from(events)
    .where(and(sql`${events.status}::text = 'scheduled'`, gte(events.startTime, now)));
  const [liveEvents] = await db.select({ count: count() }).from(events)
    .where(sql`${events.status}::text = 'live'`);
  const [totalTeams] = await db.select({ count: count() }).from(teams);
  const [recentEvents] = await db.select({ count: count() }).from(events)
    .where(gte(events.createdAt, yesterday));

  const sportStats = await db.execute(sql`
    SELECT s.name, s.slug, COUNT(e.id) as count
    FROM sports s
    LEFT JOIN events e ON e.sport_id = s.id
      AND e.status::text = 'scheduled'
      AND e.start_time >= ${now.toISOString()}::timestamptz
      AND e.start_time <= ${nextWeek.toISOString()}::timestamptz
    WHERE s.is_active = true
    GROUP BY s.id, s.name, s.slug
    ORDER BY count DESC
  `);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayEvents = await db
    .select({
      id: events.id,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      competition: events.competitionName,
      startTime: events.startTime,
      status: events.status,
    })
    .from(events)
    .where(and(gte(events.startTime, today), lte(events.startTime, tomorrow)))
    .orderBy(events.startTime)
    .limit(15);

  const sportRows = (sportStats.rows || []).map((row: any) => `
    <tr>
      <td>${row.name}</td>
      <td><span class="badge badge-info">${row.count}</span></td>
    </tr>
  `).join('');

  const todayRows = todayEvents.length > 0
    ? todayEvents.map(e => `
      <tr>
        <td>${e.startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
        <td><a href="/events/${e.id}">${e.homeTeam} vs ${e.awayTeam}</a></td>
        <td>${e.competition}</td>
        <td><span class="badge badge-${e.status === 'live' ? 'warning' : 'info'}">${e.status}</span></td>
      </tr>
    `).join('')
    : '<tr><td colspan="4" class="empty">No events today</td></tr>';

  return html('Dashboard', `
    <h1>Dashboard</h1>

    <div class="stats-grid">
      <div class="stat">
        <div class="stat-value">${scheduledEvents?.count || 0}</div>
        <div class="stat-label">Scheduled Events</div>
      </div>
      <div class="stat">
        <div class="stat-value">${liveEvents?.count || 0}</div>
        <div class="stat-label">Live Now</div>
      </div>
      <div class="stat">
        <div class="stat-value">${recentEvents?.count || 0}</div>
        <div class="stat-label">Created (24h)</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalTeams?.count || 0}</div>
        <div class="stat-label">Teams</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalEvents?.count || 0}</div>
        <div class="stat-label">Total Events</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 20px;">
      <div class="card">
        <h2>📅 Fixtures by Sport (Next 7 Days)</h2>
        <table>
          <thead><tr><th>Sport</th><th>Count</th></tr></thead>
          <tbody>${sportRows || '<tr><td colspan="2" class="empty">No sports found</td></tr>'}</tbody>
        </table>
      </div>

      <div class="card">
        <h2>🕐 Today's Events</h2>
        <table>
          <thead><tr><th>Time</th><th>Match</th><th>Competition</th><th>Status</th></tr></thead>
          <tbody>${todayRows}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>⚡ Quick Actions</h2>
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <a href="/lambdas" class="btn">Manage Lambdas</a>
        <a href="/lambdas/trigger/sync-fixtures" class="btn btn-secondary">Trigger Sync Fixtures</a>
        <a href="/lambdas/trigger/sync-odds" class="btn btn-secondary">Trigger Sync Odds</a>
        <a href="/query" class="btn btn-secondary">SQL Query</a>
      </div>
    </div>
  `);
}

// Lambda management page
async function handleLambdas(flash?: string): Promise<string> {
  let lambdaStatus: { name: string; status: string; lastModified?: string; runtime?: string; memorySize?: number }[] = [];

  try {
    for (const [key, functionName] of Object.entries(LAMBDA_FUNCTIONS)) {
      try {
        const response = await lambdaClient.send(new GetFunctionCommand({ FunctionName: functionName }));
        lambdaStatus.push({
          name: functionName,
          status: response.Configuration?.State || 'Unknown',
          lastModified: response.Configuration?.LastModified,
          runtime: response.Configuration?.Runtime,
          memorySize: response.Configuration?.MemorySize,
        });
      } catch (e: any) {
        lambdaStatus.push({
          name: functionName,
          status: e.name === 'ResourceNotFoundException' ? 'Not Deployed' : 'Error',
        });
      }
    }
  } catch (e) {
    // AWS SDK not configured or error
  }

  const lambdaCards = lambdaStatus.map(fn => {
    const statusClass = fn.status === 'Active' ? 'success' : fn.status === 'Not Deployed' ? 'error' : 'warning';
    const shortName = fn.name.replace(`sport-sage-${ENVIRONMENT}-`, '');
    return `
      <div class="lambda-card">
        <h3>🔧 ${shortName}</h3>
        <div class="status">
          <span class="badge badge-${statusClass}">${fn.status}</span>
          ${fn.memorySize ? `<span style="margin-left: 10px; color: #888;">${fn.memorySize}MB</span>` : ''}
        </div>
        ${fn.lastModified ? `<div style="color: #888; font-size: 0.85em; margin-bottom: 15px;">Last modified: ${new Date(fn.lastModified).toLocaleString()}</div>` : ''}
        <div class="actions">
          ${fn.status === 'Active' ? `
            <form method="POST" action="/lambdas/invoke/${shortName}" style="display: inline;">
              <button type="submit">▶ Invoke</button>
            </form>
            <a href="/lambdas/logs/${shortName}" class="btn btn-secondary">📋 Logs</a>
          ` : '<span style="color: #888;">Not available</span>'}
        </div>
      </div>
    `;
  }).join('');

  return html('Lambda Functions', `
    <h1>Lambda Functions</h1>

    ${flash ? `<div class="flash flash-success">${flash}</div>` : ''}

    <div class="lambda-grid">
      ${lambdaCards || '<div class="empty">No Lambda functions found. Deploy the CDK stacks first.</div>'}
    </div>

    <div class="card" style="margin-top: 30px;">
      <h2>📝 Notes</h2>
      <ul style="margin-left: 20px; color: #888;">
        <li><strong>sync-fixtures</strong> - Scrapes upcoming fixtures from Flashscore (runs every 6 hours)</li>
        <li><strong>transition-events</strong> - Marks scheduled events as live when start_time passes (runs every minute)</li>
        <li><strong>sync-live-scores</strong> - Updates live match scores from Flashscore (runs every minute)</li>
        <li><strong>sync-odds</strong> - Scrapes odds from Oddschecker (runs every 15 minutes)</li>
        <li><strong>settlement</strong> - Processes finished matches and settles predictions (triggered by SQS)</li>
      </ul>
    </div>
  `);
}

// Invoke Lambda
async function invokeLambda(shortName: string): Promise<{ success: boolean; message: string; output?: string }> {
  const functionName = `sport-sage-${ENVIRONMENT}-${shortName}`;

  try {
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event', // Async invocation
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

// Get Lambda logs
async function getLambdaLogs(shortName: string): Promise<string> {
  const functionName = `sport-sage-${ENVIRONMENT}-${shortName}`;
  const logGroupName = `/aws/lambda/${functionName}`;

  try {
    // Get latest log stream
    const streams = await logsClient.send(new DescribeLogStreamsCommand({
      logGroupName,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 1,
    }));

    if (!streams.logStreams?.length) {
      return '<div class="empty">No log streams found</div>';
    }

    const logStream = streams.logStreams[0];

    // Get log events
    const logEvents = await logsClient.send(new GetLogEventsCommand({
      logGroupName,
      logStreamName: logStream.logStreamName!,
      limit: 100,
      startFromHead: false,
    }));

    const logs = (logEvents.events || []).map(event => {
      const msg = event.message || '';
      let lineClass = '';
      if (msg.includes('ERROR') || msg.includes('Error')) lineClass = 'error';
      else if (msg.includes('WARN') || msg.includes('Warning')) lineClass = 'warn';
      else if (msg.includes('INFO')) lineClass = 'info';
      return `<div class="log-line ${lineClass}">${new Date(event.timestamp || 0).toISOString()} ${msg}</div>`;
    }).join('');

    return `
      <div style="margin-bottom: 15px; color: #888;">
        Log stream: ${logStream.logStreamName}<br>
        Last event: ${logStream.lastEventTimestamp ? new Date(logStream.lastEventTimestamp).toLocaleString() : 'N/A'}
      </div>
      <div class="log-output">${logs || '<div class="empty">No log events</div>'}</div>
    `;
  } catch (e: any) {
    if (e.name === 'ResourceNotFoundException') {
      return '<div class="empty">Log group not found. The Lambda may not have been invoked yet.</div>';
    }
    return `<div class="flash flash-error">Error fetching logs: ${e.message}</div>`;
  }
}

// Events page
async function handleEvents(query: URLSearchParams): Promise<string> {
  const db = getDb();
  const search = query.get('search') || '';
  const status = query.get('status') || 'scheduled';
  const page = parseInt(query.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(sql`${events.status}::text = ${status}`);
  if (search) {
    conditions.push(sql`(${events.homeTeamName} ILIKE ${'%' + search + '%'} OR ${events.awayTeamName} ILIKE ${'%' + search + '%'})`);
  }

  const allEvents = await db
    .select({
      id: events.id,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      competition: events.competitionName,
      startTime: events.startTime,
      status: events.status,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(events.startTime))
    .limit(limit)
    .offset(offset);

  const rows = allEvents.map(e => `
    <tr>
      <td>${e.startTime.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td><a href="/events/${e.id}">${e.homeTeam} vs ${e.awayTeam}</a></td>
      <td>${e.competition}</td>
      <td><span class="badge badge-${e.status === 'live' ? 'warning' : e.status === 'finished' ? 'success' : 'info'}">${e.status}</span></td>
      <td class="time-ago">${timeAgo(e.createdAt)}</td>
    </tr>
  `).join('');

  return html('Events', `
    <h1>Events</h1>

    <form class="search-box" method="GET">
      <input type="text" name="search" placeholder="Search teams..." value="${search}" style="flex: 1;">
      <select name="status">
        <option value="">All Status</option>
        <option value="scheduled" ${status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
        <option value="live" ${status === 'live' ? 'selected' : ''}>Live</option>
        <option value="finished" ${status === 'finished' ? 'selected' : ''}>Finished</option>
      </select>
      <button type="submit">Search</button>
    </form>

    <div class="card">
      <table>
        <thead><tr><th>Date</th><th>Match</th><th>Competition</th><th>Status</th><th>Added</th></tr></thead>
        <tbody>${rows.length > 0 ? rows : '<tr><td colspan="5" class="empty">No events found</td></tr>'}</tbody>
      </table>
      ${allEvents.length === limit ? `
        <div style="margin-top: 20px; text-align: center;">
          <a href="/events?page=${page + 1}&search=${encodeURIComponent(search)}&status=${status}">Next Page →</a>
        </div>
      ` : ''}
    </div>
  `);
}

// Teams page
async function handleTeams(query: URLSearchParams): Promise<string> {
  const db = getDb();
  const search = query.get('search') || '';

  const conditions = search ? ilike(teams.name, `%${search}%`) : undefined;

  const allTeams = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(conditions)
    .orderBy(teams.name)
    .limit(100);

  const teamsWithAliases = await Promise.all(
    allTeams.map(async (team) => {
      const [aliasCount] = await db.select({ count: count() }).from(teamAliases)
        .where(eq(teamAliases.teamId, team.id));
      return { ...team, aliasCount: aliasCount?.count || 0 };
    })
  );

  const rows = teamsWithAliases.map(t => `
    <tr>
      <td><a href="/teams/${t.id}">${t.name}</a></td>
      <td>${t.aliasCount} aliases</td>
    </tr>
  `).join('');

  return html('Teams', `
    <h1>Teams</h1>

    <form class="search-box" method="GET">
      <input type="text" name="search" placeholder="Search teams..." value="${search}" style="flex: 1;">
      <button type="submit">Search</button>
    </form>

    <div class="card">
      <table>
        <thead><tr><th>Name</th><th>Aliases</th></tr></thead>
        <tbody>${rows.length > 0 ? rows : '<tr><td colspan="2" class="empty">No teams found</td></tr>'}</tbody>
      </table>
    </div>
  `);
}

// Team detail page
async function handleTeamDetail(id: string): Promise<string> {
  const db = getDb();

  const team = await db.query.teams.findFirst({ where: eq(teams.id, id) });
  if (!team) return html('Team Not Found', '<h1>Team not found</h1>');

  const aliases = await db.select().from(teamAliases).where(eq(teamAliases.teamId, id));
  const recentEvents = await db
    .select({
      id: events.id,
      homeTeam: events.homeTeamName,
      awayTeam: events.awayTeamName,
      startTime: events.startTime,
      status: events.status,
    })
    .from(events)
    .where(sql`${events.homeTeamId} = ${id} OR ${events.awayTeamId} = ${id}`)
    .orderBy(desc(events.startTime))
    .limit(20);

  const aliasRows = aliases.map(a => `<tr><td>${a.alias}</td><td>${a.source}</td></tr>`).join('');
  const eventRows = recentEvents.map(e => `
    <tr>
      <td>${e.startTime.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
      <td>${e.homeTeam} vs ${e.awayTeam}</td>
      <td><span class="badge badge-info">${e.status}</span></td>
    </tr>
  `).join('');

  return html(team.name, `
    <h1>${team.name}</h1>

    <div class="card">
      <h2>Aliases</h2>
      <table>
        <thead><tr><th>Alias</th><th>Source</th></tr></thead>
        <tbody>${aliasRows || '<tr><td colspan="2" class="empty">No aliases</td></tr>'}</tbody>
      </table>
    </div>

    <div class="card">
      <h2>Recent Events</h2>
      <table>
        <thead><tr><th>Date</th><th>Match</th><th>Status</th></tr></thead>
        <tbody>${eventRows || '<tr><td colspan="3" class="empty">No events</td></tr>'}</tbody>
      </table>
    </div>
  `);
}

// Competitions page
async function handleCompetitions(query: URLSearchParams): Promise<string> {
  const db = getDb();
  const search = query.get('search') || '';

  const conditions = search ? ilike(competitions.name, `%${search}%`) : undefined;

  const allComps = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      country: competitions.country,
    })
    .from(competitions)
    .where(conditions)
    .orderBy(competitions.name)
    .limit(100);

  const rows = allComps.map(c => `
    <tr><td>${c.name}</td><td>${c.country || '-'}</td></tr>
  `).join('');

  return html('Competitions', `
    <h1>Competitions</h1>

    <form class="search-box" method="GET">
      <input type="text" name="search" placeholder="Search competitions..." value="${search}" style="flex: 1;">
      <button type="submit">Search</button>
    </form>

    <div class="card">
      <table>
        <thead><tr><th>Name</th><th>Country</th></tr></thead>
        <tbody>${rows.length > 0 ? rows : '<tr><td colspan="2" class="empty">No competitions found</td></tr>'}</tbody>
      </table>
    </div>
  `);
}

// Query page
async function handleQuery(query: URLSearchParams): Promise<string> {
  const db = getDb();
  const rawQuery = query.get('q') || '';
  let result = '';
  let error = '';

  if (rawQuery) {
    try {
      if (!rawQuery.trim().toLowerCase().startsWith('select')) {
        throw new Error('Only SELECT queries are allowed');
      }
      const queryResult = await db.execute(sql.raw(rawQuery));
      result = JSON.stringify(queryResult.rows, null, 2);
    } catch (e: any) {
      error = e.message;
    }
  }

  const exampleQueries = [
    "SELECT slug, COUNT(*) FROM events e JOIN sports s ON e.sport_id = s.id GROUP BY slug",
    "SELECT home_team_name, away_team_name, start_time FROM events WHERE status = 'scheduled' ORDER BY start_time LIMIT 10",
    "SELECT name, COUNT(*) as alias_count FROM teams t LEFT JOIN team_aliases ta ON t.id = ta.team_id GROUP BY t.id ORDER BY alias_count DESC LIMIT 10",
  ];

  return html('Query', `
    <h1>SQL Query</h1>

    <div class="card">
      <form method="GET">
        <textarea name="q" style="width: 100%; height: 120px; font-family: monospace; resize: vertical;">${rawQuery}</textarea>
        <div style="margin-top: 10px;">
          <button type="submit">Run Query</button>
          <span style="color: #888; margin-left: 15px;">Only SELECT queries allowed</span>
        </div>
      </form>
    </div>

    ${error ? `<div class="card" style="border-color: #ff4444;"><pre style="color: #ff4444;">${error}</pre></div>` : ''}
    ${result ? `<div class="card"><h2>Results</h2><pre><code>${result}</code></pre></div>` : ''}

    <div class="card">
      <h2>Example Queries</h2>
      ${exampleQueries.map(q => `
        <div style="margin-bottom: 10px;">
          <a href="/query?q=${encodeURIComponent(q)}" style="font-family: monospace; font-size: 0.9em;">${q}</a>
        </div>
      `).join('')}
    </div>
  `);
}

// Event Lifecycle page
async function handleLifecycle(): Promise<string> {
  const db = getDb();
  const now = new Date();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get counts by status
  const statusCounts = await db.execute(sql`
    SELECT status::text as status, COUNT(*) as count
    FROM events
    GROUP BY status::text
  `);

  const countsByStatus: Record<string, number> = {};
  (statusCounts.rows || []).forEach((row: any) => {
    countsByStatus[row.status] = parseInt(row.count);
  });

  // Events that should be live now (start_time passed but still scheduled)
  const shouldBeLive = await db.execute(sql`
    SELECT id, home_team_name, away_team_name, start_time, competition_name
    FROM events
    WHERE status::text = 'scheduled'
      AND start_time <= ${now.toISOString()}::timestamptz
    ORDER BY start_time DESC
    LIMIT 10
  `);

  // Currently live events
  const liveNow = await db.execute(sql`
    SELECT id, home_team_name, away_team_name, start_time, home_score, away_score, minute, period
    FROM events
    WHERE status::text = 'live'
    ORDER BY start_time
    LIMIT 20
  `);

  // Recently finished (last 24 hours)
  const recentlyFinished = await db.execute(sql`
    SELECT id, home_team_name, away_team_name, home_score, away_score, updated_at
    FROM events
    WHERE status::text = 'finished'
      AND updated_at >= ${oneDayAgo.toISOString()}::timestamptz
    ORDER BY updated_at DESC
    LIMIT 15
  `);

  // Upcoming events (next 2 hours)
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const upcoming = await db.execute(sql`
    SELECT id, home_team_name, away_team_name, start_time, competition_name
    FROM events
    WHERE status::text = 'scheduled'
      AND start_time >= ${now.toISOString()}::timestamptz
      AND start_time <= ${twoHoursFromNow.toISOString()}::timestamptz
    ORDER BY start_time
    LIMIT 10
  `);

  const shouldBeLiveRows = (shouldBeLive.rows || []).map((e: any) => `
    <tr style="background: rgba(255, 68, 68, 0.1);">
      <td>${new Date(e.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${e.home_team_name} vs ${e.away_team_name}</td>
      <td>${e.competition_name || '-'}</td>
      <td><span class="badge badge-error">Should be live!</span></td>
    </tr>
  `).join('');

  const liveNowRows = (liveNow.rows || []).map((e: any) => `
    <tr>
      <td>${e.minute ? `${e.minute}'` : e.period || '-'}</td>
      <td>${e.home_team_name} vs ${e.away_team_name}</td>
      <td><strong>${e.home_score ?? '-'} - ${e.away_score ?? '-'}</strong></td>
    </tr>
  `).join('');

  const finishedRows = (recentlyFinished.rows || []).map((e: any) => `
    <tr>
      <td>${timeAgo(new Date(e.updated_at))}</td>
      <td>${e.home_team_name} vs ${e.away_team_name}</td>
      <td><strong>${e.home_score} - ${e.away_score}</strong></td>
    </tr>
  `).join('');

  const upcomingRows = (upcoming.rows || []).map((e: any) => {
    const mins = Math.round((new Date(e.start_time).getTime() - now.getTime()) / 60000);
    return `
      <tr>
        <td>in ${mins}m</td>
        <td>${e.home_team_name} vs ${e.away_team_name}</td>
        <td>${e.competition_name || '-'}</td>
      </tr>
    `;
  }).join('');

  return html('Event Lifecycle', `
    <h1>Event Lifecycle</h1>

    <div class="card" style="background: #1a2a3a; border-color: #00d4aa;">
      <h2 style="margin-top: 0;">📊 How Events Flow</h2>
      <pre style="background: transparent; font-size: 0.95em; color: #ccc;">
┌─────────────────────┐        ┌──────────────────────┐        ┌─────────────────────┐        ┌────────────────────────┐
│   sync-fixtures     │        │  transition-events   │        │   sync-live-scores  │        │   settle-predictions   │
│   (every 6 hours)   │   →    │   (every 1 minute)   │   →    │   (every 1 minute)  │   →    │   (SQS triggered)      │
└─────────────────────┘        └──────────────────────┘        └─────────────────────┘        └────────────────────────┘
         │                              │                              │                                │
    Creates events              Marks scheduled                Updates scores                    Settles bets
    status=SCHEDULED            → LIVE when                    Detects finished                  Credits winners
                               start_time passes               status=FINISHED                   Updates stats
      </pre>
    </div>

    <div class="stats-grid" style="margin-bottom: 30px;">
      <div class="stat">
        <div class="stat-value">${countsByStatus['scheduled'] || 0}</div>
        <div class="stat-label">📅 Scheduled</div>
      </div>
      <div class="stat" style="background: linear-gradient(135deg, #4d3d0d 0%, #3d2d0d 100%);">
        <div class="stat-value" style="color: #ffaa00;">${countsByStatus['live'] || 0}</div>
        <div class="stat-label">🔴 Live</div>
      </div>
      <div class="stat">
        <div class="stat-value">${countsByStatus['finished'] || 0}</div>
        <div class="stat-label">✅ Finished</div>
      </div>
      <div class="stat">
        <div class="stat-value">${countsByStatus['cancelled'] || 0}</div>
        <div class="stat-label">❌ Cancelled</div>
      </div>
    </div>

    ${(shouldBeLive.rows || []).length > 0 ? `
    <div class="card" style="border-color: #ff4444;">
      <h2 style="color: #ff4444;">⚠️ Events That Should Be Live</h2>
      <p style="color: #888; margin-bottom: 15px;">These events have passed their start time but are still marked as 'scheduled'. The transition-events Lambda may need to run.</p>
      <table>
        <thead><tr><th>Started</th><th>Match</th><th>Competition</th><th>Issue</th></tr></thead>
        <tbody>${shouldBeLiveRows}</tbody>
      </table>
      <div style="margin-top: 15px;">
        <a href="/lambdas/trigger/transition-events" class="btn">▶ Run transition-events now</a>
      </div>
    </div>
    ` : ''}

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px;">
      <div class="card">
        <h2>🔴 Live Now (${(liveNow.rows || []).length})</h2>
        ${liveNowRows ? `
          <table>
            <thead><tr><th>Time</th><th>Match</th><th>Score</th></tr></thead>
            <tbody>${liveNowRows}</tbody>
          </table>
        ` : '<div class="empty">No live events</div>'}
        <div style="margin-top: 15px;">
          <a href="/lambdas/trigger/sync-live-scores" class="btn btn-secondary">🔄 Sync Scores</a>
        </div>
      </div>

      <div class="card">
        <h2>⏰ Starting Soon (Next 2 Hours)</h2>
        ${upcomingRows ? `
          <table>
            <thead><tr><th>Starts</th><th>Match</th><th>Competition</th></tr></thead>
            <tbody>${upcomingRows}</tbody>
          </table>
        ` : '<div class="empty">No events in next 2 hours</div>'}
      </div>

      <div class="card">
        <h2>✅ Recently Finished (24h)</h2>
        ${finishedRows ? `
          <table>
            <thead><tr><th>Ended</th><th>Match</th><th>Result</th></tr></thead>
            <tbody>${finishedRows}</tbody>
          </table>
        ` : '<div class="empty">No finished events in last 24 hours</div>'}
      </div>
    </div>

    <div class="card">
      <h2>🔧 Quick Actions</h2>
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <a href="/lambdas/trigger/sync-fixtures" class="btn">📥 Sync Fixtures</a>
        <a href="/lambdas/trigger/transition-events" class="btn btn-secondary">🔄 Transition Events</a>
        <a href="/lambdas/trigger/sync-live-scores" class="btn btn-secondary">🔴 Sync Live Scores</a>
        <a href="/lambdas/trigger/sync-odds" class="btn btn-secondary">💰 Sync Odds</a>
        <a href="/lambdas" class="btn btn-secondary">View All Lambdas</a>
      </div>
    </div>
  `);
}

// Stealth Test Page - runs browser with stealth mode and checks detection
async function handleStealthTest(action?: string): Promise<string> {
  let testResult = '';
  let testStatus = '';

  if (action === 'run') {
    try {
      // Dynamic import to avoid issues when Playwright isn't available
      const { launchBrowser, createPage, markPageProxySuccess, markPageProxyFailed } = await import('../utils/browser');
      const { getProxyManager } = await import('../utils/proxy-manager');

      testResult += '<div class="log-line info">Starting browser...</div>';

      const browser = await launchBrowser();
      const page = await createPage(browser);

      testResult += '<div class="log-line info">Browser launched with stealth mode</div>';

      // Check proxy status
      const proxyManager = getProxyManager();
      if (proxyManager.isEnabled()) {
        testResult += `<div class="log-line info">Proxy rotation: ENABLED (providers: ${proxyManager.getProviderNames().join(', ')})</div>`;
      } else {
        testResult += '<div class="log-line warn">Proxy rotation: DISABLED (no credentials configured)</div>';
      }

      // Navigate to bot detection test sites
      const testSites = [
        { name: 'Bot.sannysoft.com', url: 'https://bot.sannysoft.com/' },
        { name: 'BrowserLeaks WebGL', url: 'https://browserleaks.com/webgl' },
      ];

      for (const site of testSites) {
        try {
          testResult += `<div class="log-line">Testing: ${site.name}...</div>`;
          await page.goto(site.url, { timeout: 15000, waitUntil: 'domcontentloaded' });

          // Take a screenshot
          const screenshotBuffer = await page.screenshot({ type: 'png' });
          const base64 = screenshotBuffer.toString('base64');

          testResult += `
            <div style="margin: 15px 0;">
              <h4>${site.name}</h4>
              <img src="data:image/png;base64,${base64}" style="max-width: 100%; border: 1px solid #333; border-radius: 8px;" />
            </div>
          `;

          markPageProxySuccess(page);
        } catch (e: any) {
          testResult += `<div class="log-line error">Failed: ${e.message}</div>`;
          markPageProxyFailed(page);
        }
      }

      // Run fingerprint tests in page context
      const fingerprints = await page.evaluate(() => {
        const results: Record<string, any> = {};

        // Check navigator properties
        results.webdriver = (navigator as any).webdriver;
        results.plugins = navigator.plugins.length;
        results.languages = navigator.languages;
        results.hardwareConcurrency = navigator.hardwareConcurrency;
        results.deviceMemory = (navigator as any).deviceMemory;

        // Screen properties
        results.screen = {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth,
        };

        // Chrome object
        results.hasChrome = !!(window as any).chrome;
        results.hasChromeRuntime = !!(window as any).chrome?.runtime;

        return results;
      });

      testResult += `
        <div style="margin-top: 20px;">
          <h4>Fingerprint Values</h4>
          <pre style="background: #0d0d1a; padding: 15px; border-radius: 8px;">
webdriver: ${fingerprints.webdriver} ${fingerprints.webdriver === undefined ? '✅ Hidden' : '❌ Detected'}
plugins: ${fingerprints.plugins} ${fingerprints.plugins > 0 ? '✅ Mocked' : '❌ Empty'}
languages: ${JSON.stringify(fingerprints.languages)}
hardwareConcurrency: ${fingerprints.hardwareConcurrency}
deviceMemory: ${fingerprints.deviceMemory}GB
screen: ${fingerprints.screen.width}x${fingerprints.screen.height} (${fingerprints.screen.colorDepth}bit)
chrome object: ${fingerprints.hasChrome ? '✅ Present' : '❌ Missing'}
chrome.runtime: ${fingerprints.hasChromeRuntime ? '✅ Present' : '❌ Missing'}
          </pre>
        </div>
      `;

      await browser.close();
      testStatus = 'success';
      testResult = '<div class="flash flash-success">Test completed successfully!</div>' + testResult;
    } catch (e: any) {
      testStatus = 'error';
      testResult = `<div class="flash flash-error">Test failed: ${e.message}</div><pre>${e.stack}</pre>`;
    }
  }

  return html('Stealth Test', `
    <h1>🥷 Stealth Test</h1>

    <div class="card">
      <h2>About This Test</h2>
      <p style="color: #888;">This page launches a browser with all stealth features enabled and tests them against bot detection sites.</p>
      <ul style="margin: 15px 0 15px 20px; color: #888;">
        <li>✅ Canvas fingerprint randomization</li>
        <li>✅ WebGL renderer randomization</li>
        <li>✅ Audio fingerprint noise</li>
        <li>✅ Navigator property spoofing (webdriver, plugins, etc.)</li>
        <li>✅ Screen/hardware randomization</li>
        <li>✅ User-Agent rotation</li>
        <li>✅ Proxy rotation (if configured)</li>
      </ul>

      <form method="GET" action="/stealth-test">
        <input type="hidden" name="action" value="run">
        <button type="submit" ${testStatus === 'running' ? 'disabled' : ''}>▶ Run Stealth Test</button>
        <span style="color: #888; margin-left: 15px;">Takes ~30 seconds</span>
      </form>
    </div>

    <div class="card">
      <h2>Proxy Configuration</h2>
      <p style="color: #888;">To enable rotating residential proxies, set one of these environment variable pairs:</p>
      <pre style="background: #0d0d1a; padding: 15px; border-radius: 8px; font-size: 0.85em;">
# Bright Data (Luminati)
BRIGHTDATA_USERNAME=your_username
BRIGHTDATA_PASSWORD=your_password

# Oxylabs
OXYLABS_USERNAME=your_username
OXYLABS_PASSWORD=your_password

# SmartProxy
SMARTPROXY_USERNAME=your_username
SMARTPROXY_PASSWORD=your_password

# Static proxy list (comma-separated: server|username|password)
PROXY_LIST=http://proxy1:8080|user|pass,http://proxy2:8080|user|pass

# Optional: target country (default: gb)
PROXY_COUNTRY=gb
      </pre>
    </div>

    ${testResult ? `
    <div class="card">
      <h2>Test Results</h2>
      <div class="log-output" style="max-height: none;">
        ${testResult}
      </div>
    </div>
    ` : ''}
  `);
}

// Not configured page
function noDatabasePage(): string {
  return html('Database Not Configured', `
    <h1>Database Not Configured</h1>
    <div class="card" style="border-color: #ffaa00;">
      <pre style="color: #ffaa00;">Set DATABASE_RESOURCE_ARN and DATABASE_SECRET_ARN environment variables.

Example:
DATABASE_RESOURCE_ARN="arn:aws:rds:eu-west-1:..." \\
DATABASE_SECRET_ARN="arn:aws:secretsmanager:eu-west-1:..." \\
pnpm --filter @sport-sage/scraper dev-dashboard</pre>
    </div>
  `, false);
}

// Check config at startup
const dbConfig = checkDatabaseConfig();

// Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const query = url.searchParams;
  const method = req.method || 'GET';

  res.setHeader('Content-Type', 'text/html');

  // Handle Lambda invocation (POST)
  if (method === 'POST' && path.startsWith('/lambdas/invoke/')) {
    const shortName = path.split('/').pop()!;
    const result = await invokeLambda(shortName);
    res.writeHead(302, { Location: `/lambdas?flash=${encodeURIComponent(result.message)}` });
    res.end();
    return;
  }

  // Handle Lambda trigger link (GET redirect to POST)
  if (path.startsWith('/lambdas/trigger/')) {
    const shortName = path.split('/').pop()!;
    const result = await invokeLambda(shortName);
    res.writeHead(302, { Location: `/lambdas?flash=${encodeURIComponent(result.message)}` });
    res.end();
    return;
  }

  if (!dbConfig.configured) {
    res.end(noDatabasePage());
    return;
  }

  try {
    let body: string;

    if (path === '/' || path === '/dashboard') {
      body = await handleDashboard();
    } else if (path === '/lifecycle') {
      body = await handleLifecycle();
    } else if (path === '/lambdas') {
      body = await handleLambdas(query.get('flash') || undefined);
    } else if (path.startsWith('/lambdas/logs/')) {
      const shortName = path.split('/').pop()!;
      const logs = await getLambdaLogs(shortName);
      body = html(`Logs: ${shortName}`, `
        <h1>Logs: ${shortName}</h1>
        <div style="margin-bottom: 20px;">
          <a href="/lambdas" class="btn btn-secondary">← Back to Lambdas</a>
          <a href="/lambdas/logs/${shortName}" class="btn btn-secondary" style="margin-left: 10px;">🔄 Refresh</a>
        </div>
        ${logs}
      `);
    } else if (path === '/events') {
      body = await handleEvents(query);
    } else if (path.startsWith('/events/')) {
      body = await handleEvents(new URLSearchParams());
    } else if (path === '/teams') {
      body = await handleTeams(query);
    } else if (path.startsWith('/teams/')) {
      const id = path.split('/')[2];
      body = await handleTeamDetail(id!);
    } else if (path === '/competitions') {
      body = await handleCompetitions(query);
    } else if (path === '/query') {
      body = await handleQuery(query);
    } else if (path === '/stealth-test') {
      body = await handleStealthTest(query.get('action') || undefined);
    } else {
      res.statusCode = 404;
      body = html('Not Found', '<h1>Page not found</h1>');
    }

    res.end(body);
  } catch (error: any) {
    console.error('Server error:', error);
    res.statusCode = 500;
    res.end(html('Error', `<h1>Server Error</h1><pre>${error.message}</pre>`));
  }
});

server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════════╗
  ║                                                        ║
  ║   ⚽ Sport Sage Dev Dashboard                          ║
  ║                                                        ║
  ║   Running at: http://localhost:${PORT}                   ║
  ║   Environment: ${ENVIRONMENT.toUpperCase().padEnd(38)}║
  ║                                                        ║
  ║   Pages:                                               ║
  ║   • /           Dashboard & stats                      ║
  ║   • /lambdas    Trigger & monitor Lambda functions     ║
  ║   • /events     Browse events                          ║
  ║   • /teams      Browse teams & aliases                 ║
  ║   • /competitions  Browse competitions                 ║
  ║   • /query      Run SQL queries                        ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  `);

  if (dbConfig.configured) {
    console.log(`  ✅ Database: ${dbConfig.message}\n`);
  } else {
    console.log('\x1b[33m  ⚠️  Database not configured\x1b[0m\n');
  }
});
