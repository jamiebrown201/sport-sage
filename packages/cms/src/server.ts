#!/usr/bin/env node
/**
 * Sport Sage CMS
 *
 * Internal admin panel for managing the Sport Sage platform.
 *
 * Features:
 * - Scraper monitoring and health dashboard
 * - Event lifecycle management
 * - Lambda function management
 * - Data browser (events, teams, competitions)
 * - SQL query runner
 */

import http from 'http';
import { URL } from 'url';
import { layout } from './ui/layout.js';
import { handleMonitoring, handleAcknowledgeAlert } from './pages/monitoring.js';
import { handleDashboard } from './pages/dashboard.js';
import { handleLifecycle } from './pages/lifecycle.js';
import { handleLambdas, handleLambdaLogs, invokeLambda } from './pages/lambdas.js';
import { handleEvents } from './pages/events.js';
import { handleTeams, handleTeamDetail } from './pages/teams.js';
import { handleCompetitions } from './pages/competitions.js';
import { handleQuery } from './pages/query.js';
import { checkDatabaseConfig } from './utils/db-config.js';

const PORT = process.env.PORT || 3333;
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

// Check database config at startup
const dbConfig = checkDatabaseConfig();

// Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const query = url.searchParams;
  const method = req.method || 'GET';

  res.setHeader('Content-Type', 'text/html');

  // Handle POST actions
  if (method === 'POST') {
    // Lambda invocation
    if (path.startsWith('/lambdas/invoke/')) {
      const shortName = path.split('/').pop()!;
      const result = await invokeLambda(shortName, ENVIRONMENT);
      res.writeHead(302, { Location: `/lambdas?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Alert acknowledgment
    if (path.startsWith('/monitoring/acknowledge/')) {
      const alertId = path.split('/').pop()!;
      await handleAcknowledgeAlert(alertId);
      res.writeHead(302, { Location: '/monitoring' });
      res.end();
      return;
    }
  }

  // Lambda trigger via GET (convenience)
  if (path.startsWith('/lambdas/trigger/')) {
    const shortName = path.split('/').pop()!;
    const result = await invokeLambda(shortName, ENVIRONMENT);
    res.writeHead(302, { Location: `/lambdas?flash=${encodeURIComponent(result.message)}` });
    res.end();
    return;
  }

  // Database not configured
  if (!dbConfig.configured) {
    res.end(layout('Database Required', `
      <div class="card" style="border-color: var(--warning);">
        <h1>Database Not Configured</h1>
        <p style="color: var(--text-muted);">Set the following environment variables:</p>
        <pre style="background: var(--bg-dark); padding: 15px; border-radius: 8px; margin-top: 15px;">
DATABASE_RESOURCE_ARN="arn:aws:rds:eu-west-1:..."
DATABASE_SECRET_ARN="arn:aws:secretsmanager:eu-west-1:..."

# Then run:
pnpm --filter @sport-sage/cms start</pre>
      </div>
    `, ENVIRONMENT, false));
    return;
  }

  try {
    let body: string;

    // Route handling
    switch (true) {
      case path === '/' || path === '/dashboard':
        body = await handleDashboard(ENVIRONMENT);
        break;

      case path === '/monitoring':
        body = await handleMonitoring(ENVIRONMENT);
        break;

      case path === '/lifecycle':
        body = await handleLifecycle(ENVIRONMENT);
        break;

      case path === '/lambdas':
        body = await handleLambdas(ENVIRONMENT, query.get('flash') || undefined);
        break;

      case path.startsWith('/lambdas/logs/'):
        const lambdaName = path.split('/').pop()!;
        body = await handleLambdaLogs(lambdaName, ENVIRONMENT);
        break;

      case path === '/events':
        body = await handleEvents(query, ENVIRONMENT);
        break;

      case path === '/teams':
        body = await handleTeams(query, ENVIRONMENT);
        break;

      case path.startsWith('/teams/'):
        const teamId = path.split('/')[2]!;
        body = await handleTeamDetail(teamId, ENVIRONMENT);
        break;

      case path === '/competitions':
        body = await handleCompetitions(query, ENVIRONMENT);
        break;

      case path === '/query':
        body = await handleQuery(query, ENVIRONMENT);
        break;

      default:
        res.statusCode = 404;
        body = layout('Not Found', '<h1>Page not found</h1>', ENVIRONMENT);
    }

    res.end(body);
  } catch (error: any) {
    console.error('Server error:', error);
    res.statusCode = 500;
    res.end(layout('Error', `
      <div class="card" style="border-color: var(--error);">
        <h1>Server Error</h1>
        <pre style="color: var(--error);">${error.message}</pre>
        <pre style="color: var(--text-muted); font-size: 0.85em; margin-top: 10px;">${error.stack}</pre>
      </div>
    `, ENVIRONMENT));
  }
});

server.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════════╗
  ║                                                        ║
  ║   ⚽ Sport Sage CMS                                    ║
  ║                                                        ║
  ║   Running at: http://localhost:${String(PORT).padEnd(24)}║
  ║   Environment: ${ENVIRONMENT.toUpperCase().padEnd(38)}║
  ║                                                        ║
  ║   Pages:                                               ║
  ║   • /           Dashboard overview                     ║
  ║   • /monitoring Scraper health & alerts                ║
  ║   • /lifecycle  Event status flow                      ║
  ║   • /lambdas    Lambda function management             ║
  ║   • /events     Browse events                          ║
  ║   • /teams      Browse teams                           ║
  ║   • /query      SQL query runner                       ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  `);

  if (dbConfig.configured) {
    console.log(`  ✅ Database: ${dbConfig.message}\n`);
  } else {
    console.log('\x1b[33m  ⚠️  Database not configured\x1b[0m\n');
  }
});
