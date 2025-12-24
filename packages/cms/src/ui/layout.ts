/**
 * CMS Layout - shared HTML template
 */

export function layout(title: string, content: string, environment: string, showNav = true): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Sport Sage CMS</title>
  <style>
    :root {
      --bg-dark: #0a0a0a;
      --bg-card: #1a1a2e;
      --bg-hover: #252545;
      --bg-input: #252545;
      --border: #333;
      --primary: #00d4aa;
      --primary-hover: #00b894;
      --success: #00d4aa;
      --warning: #ffaa00;
      --error: #ff4444;
      --info: #44aaff;
      --text: #e0e0e0;
      --text-muted: #888;
      --text-heading: #fff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-dark);
      color: var(--text);
      line-height: 1.6;
    }

    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }

    /* Navigation */
    nav {
      background: var(--bg-card);
      padding: 15px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      gap: 5px;
      align-items: center;
      flex-wrap: wrap;
    }
    nav .logo {
      font-weight: bold;
      color: var(--primary);
      font-size: 1.2em;
      margin-right: 15px;
    }
    nav a {
      color: var(--text-muted);
      text-decoration: none;
      padding: 6px 12px;
      border-radius: 6px;
      transition: all 0.2s;
      font-size: 0.9em;
    }
    nav a:hover { color: var(--text-heading); background: var(--bg-hover); }
    nav a.active { color: var(--text-heading); background: var(--bg-hover); }
    nav .divider {
      width: 1px;
      height: 20px;
      background: var(--border);
      margin: 0 8px;
    }
    nav .env {
      margin-left: auto;
      background: #2d2d4d;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.85em;
      color: var(--primary);
      text-transform: uppercase;
    }

    /* Typography */
    h1 { color: var(--text-heading); margin-bottom: 20px; font-size: 1.8em; }
    h2 { color: var(--primary); margin: 30px 0 15px; font-size: 1.1em; font-weight: 600; }
    a { color: var(--primary); }

    /* Cards */
    .card {
      background: var(--bg-card);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid var(--border);
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }
    .stat {
      background: var(--bg-hover);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value { font-size: 2em; font-weight: bold; color: var(--primary); }
    .stat-label { color: var(--text-muted); font-size: 0.85em; margin-top: 5px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border); }
    th { color: var(--text-muted); font-weight: 500; font-size: 0.85em; text-transform: uppercase; }
    tr:hover { background: var(--bg-hover); }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 500;
    }
    .badge-success { background: #0d4d3a; color: var(--success); }
    .badge-warning { background: #4d3d0d; color: var(--warning); }
    .badge-error { background: #4d0d0d; color: var(--error); }
    .badge-info { background: #0d2d4d; color: var(--info); }

    /* Forms */
    input[type="text"], input[type="number"], input[type="datetime-local"], select, textarea {
      background: var(--bg-input);
      border: 1px solid #444;
      color: var(--text);
      padding: 10px 15px;
      border-radius: 6px;
      font-size: 1em;
    }
    input[type="text"]:focus, input[type="number"]:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--primary);
    }
    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--primary);
    }

    /* Buttons */
    button, .btn {
      background: var(--primary);
      color: #000;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      text-decoration: none;
      display: inline-block;
      font-size: 0.95em;
    }
    button:hover, .btn:hover { background: var(--primary-hover); }
    .btn-secondary { background: #444; color: var(--text); }
    .btn-secondary:hover { background: #555; }
    .btn-danger { background: var(--error); color: var(--text); }
    .btn-sm { padding: 6px 12px; font-size: 0.85em; }

    /* Utilities */
    .empty { color: var(--text-muted); font-style: italic; padding: 40px; text-align: center; }
    .time-ago { color: var(--text-muted); }
    pre { background: var(--bg-card); padding: 15px; border-radius: 8px; overflow-x: auto; font-size: 0.9em; }
    code { color: var(--primary); }

    .flash {
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .flash-success { background: #0d4d3a; color: var(--success); border: 1px solid var(--success); }
    .flash-error { background: #4d0d0d; color: var(--error); border: 1px solid var(--error); }

    .search-box {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    /* Animations */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .pulse { animation: pulse 2s infinite; }

    /* Grid layouts */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    @media (max-width: 900px) {
      .grid-2, .grid-3 { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  ${showNav ? `
  <nav>
    <span class="logo">Sport Sage CMS</span>
    <a href="/">Dashboard</a>
    <a href="/issues">Issues</a>
    <a href="/health">Health</a>
    <span class="divider"></span>
    <a href="/scraper">Scraper</a>
    <a href="/live-scores">Live</a>
    <a href="/events">Events</a>
    <a href="/predictions">Predictions</a>
    <span class="divider"></span>
    <a href="/users">Users</a>
    <a href="/sports">Sports</a>
    <a href="/teams">Teams</a>
    <a href="/competitions">Competitions</a>
    <span class="divider"></span>
    <a href="/logs">Logs</a>
    <a href="/analytics">Analytics</a>
    <span class="divider"></span>
    <a href="/bulk-settle">Settle</a>
    <a href="/source-mapping">Mapping</a>
    <a href="/lambdas">Lambdas</a>
    <a href="/query">SQL</a>
    <span class="env">${environment}</span>
  </nav>
  ` : ''}
  <div class="container">
    ${content}
  </div>
</body>
</html>`;
}

export function timeAgo(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
