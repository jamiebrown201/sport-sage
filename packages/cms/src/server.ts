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
 * - User management
 * - Data browser (events, teams, competitions)
 * - SQL query runner
 * - Analytics and logs
 */

import http from 'http';
import { URL } from 'url';
import { layout } from './ui/layout.js';
import { handleMonitoring, handleAcknowledgeAlert } from './pages/monitoring.js';
import { handleDashboard } from './pages/dashboard.js';
import { handleLifecycle } from './pages/lifecycle.js';
import { handleLambdas, handleLambdaLogs, invokeLambda } from './pages/lambdas.js';
import { handleScraper, triggerScraperJob } from './pages/scraper.js';
import { handleEvents } from './pages/events.js';
import { handleEventDetail, updateEvent, toggleMarketSuspension, toggleOutcomeWinner } from './pages/event-detail.js';
import { handleLiveScores } from './pages/live-scores.js';
import { handlePredictions, settlePrediction } from './pages/predictions.js';
import { handleTeams, handleTeamDetail, updateTeam, addTeamAlias, deleteTeamAlias } from './pages/teams.js';
import { handleCompetitions, handleCompetitionDetail, updateCompetition } from './pages/competitions.js';
import { handleQuery } from './pages/query.js';
import { handleUsers, handleUserDetail, updateUser, addCoinsToUser, resetUserCoins } from './pages/users.js';
import { handleLogs, handleRunDetail } from './pages/logs.js';
import { handleAnalytics, handleAnalyticsExport } from './pages/analytics.js';
import { handleHealth } from './pages/health.js';
import { handleIssues } from './pages/issues.js';
import { handleSports, handleSportDetail, updateSport, toggleSportActive } from './pages/sports.js';
import { handleBulkSettle, executeBulkSettle } from './pages/bulk-settle.js';
import { handleSourceMapping, importAliases } from './pages/source-mapping.js';
import { checkDatabaseConfig } from './utils/db-config.js';

const PORT = process.env.PORT || 3333;
const ENVIRONMENT = process.env.ENVIRONMENT || 'Dev';

// Check database config at startup
const dbConfig = checkDatabaseConfig();

// Parse form data from POST requests
async function parseFormData(req: http.IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const data: Record<string, string> = {};
      const params = new URLSearchParams(body);
      for (const [key, value] of params) {
        data[key] = value;
      }
      resolve(data);
    });
    req.on('error', reject);
  });
}

// Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const query = url.searchParams;
  const method = req.method || 'GET';

  res.setHeader('Content-Type', 'text/html');

  // Handle POST actions
  if (method === 'POST') {
    const formData = await parseFormData(req);

    // Team updates
    if (path.match(/^\/teams\/[^/]+\/update$/)) {
      const teamId = path.split('/')[2]!;
      const result = await updateTeam(teamId, {
        name: formData.name,
        shortName: formData.shortName,
        logoUrl: formData.logoUrl,
      });
      res.writeHead(302, { Location: `/teams/${teamId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Add team alias
    if (path.match(/^\/teams\/[^/]+\/alias\/add$/)) {
      const teamId = path.split('/')[2]!;
      const result = await addTeamAlias(teamId, formData.alias, formData.source);
      res.writeHead(302, { Location: `/teams/${teamId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Delete team alias
    if (path.match(/^\/teams\/[^/]+\/alias\/[^/]+\/delete$/)) {
      const parts = path.split('/');
      const teamId = parts[2]!;
      const aliasId = parts[4]!;
      const result = await deleteTeamAlias(aliasId);
      res.writeHead(302, { Location: `/teams/${teamId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Competition updates
    if (path.match(/^\/competitions\/[^/]+\/update$/)) {
      const competitionId = path.split('/')[2]!;
      const result = await updateCompetition(competitionId, {
        name: formData.name,
        shortName: formData.shortName,
        country: formData.country,
        sportId: formData.sportId,
        tier: formData.tier,
        logoUrl: formData.logoUrl,
        isActive: formData.isActive === 'on',
      });
      res.writeHead(302, { Location: `/competitions/${competitionId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Event updates
    if (path.match(/^\/events\/[^/]+\/update$/)) {
      const eventId = path.split('/')[2]!;
      const result = await updateEvent(eventId, {
        status: formData.status,
        homeScore: formData.homeScore ? parseInt(formData.homeScore) : undefined,
        awayScore: formData.awayScore ? parseInt(formData.awayScore) : undefined,
        period: formData.period,
        minute: formData.minute ? parseInt(formData.minute) : undefined,
        startTime: formData.startTime,
        isFeatured: formData.isFeatured === 'on',
      });
      res.writeHead(302, { Location: `/events/${eventId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Toggle market suspension
    if (path.match(/^\/events\/[^/]+\/market\/[^/]+\/suspend$/)) {
      const parts = path.split('/');
      const eventId = parts[2]!;
      const marketId = parts[4]!;
      const result = await toggleMarketSuspension(marketId);
      res.writeHead(302, { Location: `/events/${eventId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Toggle outcome winner
    if (path.match(/^\/events\/[^/]+\/outcome\/[^/]+\/winner$/)) {
      const parts = path.split('/');
      const eventId = parts[2]!;
      const outcomeId = parts[4]!;
      const result = await toggleOutcomeWinner(outcomeId);
      res.writeHead(302, { Location: `/events/${eventId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Prediction settlement
    if (path.match(/^\/predictions\/[^/]+\/settle$/)) {
      const predictionId = path.split('/')[2]!;
      const result = await settlePrediction(predictionId, formData.result as 'won' | 'lost' | 'void');
      const redirectTo = formData.eventId ? `/events/${formData.eventId}` : '/predictions';
      res.writeHead(302, { Location: `${redirectTo}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // User updates
    if (path.match(/^\/users\/[^/]+\/update$/)) {
      const userId = path.split('/')[2]!;
      const result = await updateUser(userId, {
        coins: parseInt(formData.coins),
        stars: parseInt(formData.stars),
        gems: parseInt(formData.gems),
        subscriptionTier: formData.subscriptionTier,
      });
      res.writeHead(302, { Location: `/users/${userId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Add coins to user
    if (path.match(/^\/users\/[^/]+\/add-coins$/)) {
      const userId = path.split('/')[2]!;
      const result = await addCoinsToUser(userId, parseInt(formData.amount));
      res.writeHead(302, { Location: `/users/${userId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Reset user coins
    if (path.match(/^\/users\/[^/]+\/reset-coins$/)) {
      const userId = path.split('/')[2]!;
      const result = await resetUserCoins(userId);
      res.writeHead(302, { Location: `/users/${userId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Sport updates
    if (path.match(/^\/sports\/[^/]+\/update$/)) {
      const sportId = path.split('/')[2]!;
      const result = await updateSport(sportId, {
        name: formData.name,
        iconName: formData.iconName,
        sortOrder: parseInt(formData.sortOrder) || 0,
        isActive: formData.isActive === 'on',
      });
      res.writeHead(302, { Location: `/sports/${sportId}?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

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

    // Bulk settle execute
    if (path === '/bulk-settle/execute') {
      const result = await executeBulkSettle();
      res.writeHead(302, { Location: `/bulk-settle?flash=${encodeURIComponent(result.message)}` });
      res.end();
      return;
    }

    // Source mapping import
    if (path === '/source-mapping/import') {
      const result = await importAliases(formData.csvData || '');
      res.writeHead(302, { Location: `/source-mapping?flash=${encodeURIComponent(result.message)}` });
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

  // Scraper job trigger via GET
  if (path.startsWith('/scraper/trigger/')) {
    const jobName = path.split('/').pop()!;
    const result = await triggerScraperJob(jobName);
    res.writeHead(302, { Location: `/scraper?flash=${encodeURIComponent(result.message)}` });
    res.end();
    return;
  }

  // Sport toggle active via GET
  if (path.match(/^\/sports\/[^/]+\/toggle$/)) {
    const sportId = path.split('/')[2]!;
    const result = await toggleSportActive(sportId);
    res.writeHead(302, { Location: `/sports?flash=${encodeURIComponent(result.message)}` });
    res.end();
    return;
  }

  // Analytics export (CSV)
  if (path === '/analytics/export') {
    try {
      const { csv, filename } = await handleAnalyticsExport(query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.end(csv);
      return;
    } catch (error: any) {
      res.statusCode = 500;
      res.end(`Error: ${error.message}`);
      return;
    }
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

      case path === '/health':
        body = await handleHealth(ENVIRONMENT);
        break;

      case path === '/issues':
        body = await handleIssues(ENVIRONMENT);
        break;

      case path === '/monitoring':
        body = await handleMonitoring(ENVIRONMENT);
        break;

      case path === '/lifecycle':
        body = await handleLifecycle(ENVIRONMENT);
        break;

      case path === '/scraper':
        body = await handleScraper(ENVIRONMENT, query.get('flash') || undefined);
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

      case path === '/live-scores':
        body = await handleLiveScores(ENVIRONMENT);
        break;

      case path === '/predictions':
        body = await handlePredictions(query, ENVIRONMENT);
        break;

      case path === '/bulk-settle':
        body = await handleBulkSettle(query, ENVIRONMENT);
        break;

      case path.match(/^\/events\/[^/]+$/) !== null:
        const eventId = path.split('/')[2]!;
        body = await handleEventDetail(eventId, ENVIRONMENT, query.get('flash') || undefined);
        break;

      case path === '/teams':
        body = await handleTeams(query, ENVIRONMENT);
        break;

      case path.match(/^\/teams\/[^/]+$/) !== null:
        const teamId = path.split('/')[2]!;
        body = await handleTeamDetail(teamId, ENVIRONMENT, query.get('flash') || undefined);
        break;

      case path === '/sports':
        body = await handleSports(query, ENVIRONMENT);
        break;

      case path.match(/^\/sports\/[^/]+$/) !== null:
        const sportId = path.split('/')[2]!;
        body = await handleSportDetail(sportId, ENVIRONMENT, query.get('flash') || undefined);
        break;

      case path === '/competitions':
        body = await handleCompetitions(query, ENVIRONMENT);
        break;

      case path.match(/^\/competitions\/[^/]+$/) !== null:
        const competitionId = path.split('/')[2]!;
        body = await handleCompetitionDetail(competitionId, ENVIRONMENT, query.get('flash') || undefined);
        break;

      case path === '/users':
        body = await handleUsers(query, ENVIRONMENT);
        break;

      case path.match(/^\/users\/[^/]+$/) !== null:
        const userId = path.split('/')[2]!;
        body = await handleUserDetail(userId, ENVIRONMENT, query.get('flash') || undefined);
        break;

      case path === '/logs':
        body = await handleLogs(query, ENVIRONMENT);
        break;

      case path.match(/^\/logs\/run\/[^/]+$/) !== null:
        const runId = path.split('/')[3]!;
        body = await handleRunDetail(runId, ENVIRONMENT);
        break;

      case path === '/analytics':
        body = await handleAnalytics(query, ENVIRONMENT);
        break;

      case path === '/query':
        body = await handleQuery(query, ENVIRONMENT);
        break;

      case path === '/source-mapping':
        body = await handleSourceMapping(query, ENVIRONMENT);
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
  ║   Sport Sage CMS                                       ║
  ║                                                        ║
  ║   Running at: http://localhost:${String(PORT).padEnd(24)}║
  ║   Environment: ${ENVIRONMENT.toUpperCase().padEnd(38)}║
  ║                                                        ║
  ║   Pages:                                               ║
  ║   • /            Dashboard overview                    ║
  ║   • /health      System health                         ║
  ║   • /scraper     Scraper service status                ║
  ║   • /live-scores Live scores & source health           ║
  ║   • /events      Browse events                         ║
  ║   • /predictions Predictions & bets                    ║
  ║   • /users       User management                       ║
  ║   • /teams       Team management                       ║
  ║   • /competitions Competition management               ║
  ║   • /logs        Scraper logs                          ║
  ║   • /analytics   Analytics & trends                    ║
  ║   • /lambdas     Lambda management                     ║
  ║   • /query       SQL query runner                      ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  `);

  if (dbConfig.configured) {
    console.log(`  Database: ${dbConfig.message}\n`);
  } else {
    console.log('\x1b[33m  Database not configured\x1b[0m\n');
  }
});
