#!/usr/bin/env node
/**
 * scripts/build-status.mjs
 *
 * Custom Resimay-branded status page generator. Replaces Upptime's stock Svelte
 * site (see .github/workflows/site.yml) — it reads the SAME monitoring data
 * Upptime collects (history/summary.json on the master branch, written by the
 * uptime/response-time/summary workflows) and renders a single self-contained
 * status page in the Resimay design (Paper/Ink/Cobalt, Bricolage/Schibsted/
 * Space Mono). It only READS the data and WRITES to ./site, so historical data
 * is never touched.
 *
 * Output: ./site/index.html + ./site/CNAME (for the custom domain).
 * No npm deps — pure Node fs + JSON.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const SUMMARY = `${ROOT}history/summary.json`;
const OUT_DIR = `${ROOT}site`;
const CNAME = 'status.resimay.ai';

/** @typedef {{name:string,url:string,slug:string,status:string,uptime:string,uptimeDay:string,uptimeWeek:string,uptimeMonth:string,uptimeYear:string,time:number,dailyMinutesDown?:Record<string,number>}} Site */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const host = (u) => { try { return new URL(u).host; } catch { return u; } };

/** Read Upptime's rolled-up summary (array of monitored sites). */
function loadSites() {
  if (!existsSync(SUMMARY)) return [];
  try { return JSON.parse(readFileSync(SUMMARY, 'utf8')); } catch { return []; }
}

/** Overall state = worst of the components. */
function overall(sites) {
  if (!sites.length) return { key: 'unknown', label: 'Status unavailable', color: '#9A9CA6' };
  if (sites.some((s) => s.status === 'down')) return { key: 'down', label: 'Major outage', color: '#E5484D' };
  if (sites.some((s) => s.status === 'degraded')) return { key: 'degraded', label: 'Partial degradation', color: '#FFC83A' };
  return { key: 'up', label: 'All systems operational', color: '#1FB87B' };
}

const PILL = {
  up: { t: 'Operational', c: '#1FB87B', bg: '#E4F6EE' },
  degraded: { t: 'Degraded', c: '#B07A00', bg: '#FBF1D6' },
  down: { t: 'Down', c: '#E5484D', bg: '#FBE7E7' },
};

/** 90-day uptime strip from dailyMinutesDown (faithful to Upptime: a day is
 *  green unless Upptime recorded down-minutes for it). 1440 min = full day. */
function bars(site) {
  const dmd = site.dailyMinutesDown || {};
  const out = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const down = dmd[key] || 0;
    let cls = '', title = 'Operational';
    if (down >= 1440) { cls = ' dn'; title = `Down`; }
    else if (down > 0) { cls = ' dg'; title = `${down} min down`; }
    out.push(`<span class="${cls.trim()}" title="${d.toISOString().slice(0, 10)} &middot; ${title}"></span>`);
  }
  return out.join('');
}

function card(site) {
  const p = PILL[site.status] || PILL.up;
  return `
      <div class="rs-card">
        <div class="rs-chead"><span class="nm">${esc(site.name)}</span><span class="host">${esc(host(site.url))}</span><span class="rs-pill" style="color:${p.c};background:${p.bg}"><span class="pd" style="background:${p.c}"></span>${p.t}</span></div>
        <div class="rs-bars">${bars(site)}</div>
        <div class="rs-blabel"><span>90 days ago</span><span class="mid">${esc(site.uptime)} uptime</span><span>Today</span></div>
        <div class="rs-stats">
          <div><span class="k">24h</span><span class="v">${esc(site.uptimeDay)}</span></div>
          <div><span class="k">7 days</span><span class="v">${esc(site.uptimeWeek)}</span></div>
          <div><span class="k">30 days</span><span class="v">${esc(site.uptimeMonth)}</span></div>
          <div><span class="k">Response</span><span class="v">${Number(site.time) || 0}<small> ms</small></span></div>
        </div>
      </div>`;
}

function html(sites, updatedISO) {
  const ov = overall(sites);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Resimay Status</title>
<meta name="description" content="Live status of Resimay services — website, API, and background jobs.">
<meta name="robots" content="noindex, follow">
<link rel="icon" href="https://resimay.ai/brand/svg/mark.svg">
<meta property="og:title" content="Resimay Status"><meta property="og:description" content="Live status of Resimay services.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Instrument+Serif:ital@1&family=Schibsted+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{--paper:#F4F2EA;--ink:#15161B;--alt:#ECE8DB;--bd:#E7E2D2;--cobalt:#2B45E8;--marig:#FFC83A;--spring:#1FB87B;--springbg:#E4F6EE;--red:#E5484D;--muted:#5B5E67;--card:#fff}
*{box-sizing:border-box;margin:0}
body{background:var(--paper);color:var(--ink);font-family:'Schibsted Grotesk',system-ui,-apple-system,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
.wrap{max-width:820px;margin:0 auto;padding:0 24px}
.head{border-bottom:1px solid var(--bd)}
.head .wrap{display:flex;align-items:center;justify-content:space-between;padding:20px 24px}
.brand{display:flex;align-items:center;gap:11px;font-family:'Bricolage Grotesque';font-weight:800;font-size:21px;letter-spacing:-.02em}
.brand .tag{font-family:'Space Mono';font-weight:700;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);background:var(--alt);padding:3px 9px;border-radius:999px}
.nav{display:flex;gap:24px;font-size:14px;font-weight:600}
.nav a{color:var(--muted);text-decoration:none}.nav a.on{color:var(--cobalt)}
.hero{padding:54px 0 6px}
.eyebrow{display:inline-flex;align-items:center;gap:9px;font-family:'Space Mono';font-weight:700;font-size:12px;letter-spacing:.16em;text-transform:uppercase;margin-bottom:18px}
.eyebrow b{width:10px;height:10px;border-radius:3px;background:${ov.color}}
h1{font-family:'Bricolage Grotesque';font-weight:800;font-size:clamp(32px,5vw,50px);line-height:1;letter-spacing:-.035em}
h1 .it{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;color:${ov.color}}
.banner{display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--bd);border-left:4px solid ${ov.color};border-radius:14px;padding:18px 20px;margin:26px 0 8px}
.banner .d{width:12px;height:12px;border-radius:999px;background:${ov.color};flex:none;box-shadow:0 0 0 4px ${ov.color}22}
.banner .t{font-family:'Bricolage Grotesque';font-weight:700;font-size:18px}
.banner .u{margin-left:auto;font-family:'Space Mono';font-size:12px;color:var(--muted)}
.seclabel{font-family:'Space Mono';font-weight:700;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:42px 0 16px}
.rs-card{background:var(--card);border:1px solid var(--bd);border-radius:18px;padding:22px 24px;margin-bottom:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.rs-chead{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
.rs-chead .nm{font-family:'Bricolage Grotesque';font-weight:700;font-size:17px}
.rs-chead .host{font-family:'Space Mono';font-size:12px;color:var(--muted)}
.rs-pill{margin-left:auto;display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:700;padding:5px 13px;border-radius:999px}
.rs-pill .pd{width:8px;height:8px;border-radius:999px}
.rs-bars{display:flex;gap:2px;height:38px;margin:18px 0 8px}
.rs-bars span{flex:1;border-radius:2px;background:var(--spring);opacity:.92}
.rs-bars span.dg{background:var(--marig)}.rs-bars span.dn{background:var(--red)}
.rs-blabel{display:flex;justify-content:space-between;font-family:'Space Mono';font-size:11px;color:var(--muted);margin-bottom:18px}
.rs-blabel .mid{color:var(--ink);font-weight:700}
.rs-stats{display:flex;border-top:1px solid var(--bd);padding-top:16px}
.rs-stats div{flex:1}
.rs-stats .k{display:block;font-family:'Space Mono';font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.rs-stats .v{font-family:'Bricolage Grotesque';font-weight:700;font-size:18px}
.rs-stats .v small{font-size:12px;color:var(--muted);font-weight:600}
.quiet{background:var(--alt);border:1px dashed var(--bd);border-radius:18px;padding:22px 24px}
.quiet strong{font-family:'Bricolage Grotesque';font-weight:700;font-size:15px;display:block;margin-bottom:6px}
.quiet p{font-size:13.5px;color:var(--muted);max-width:64ch}
.foot{border-top:1px solid var(--bd);margin-top:40px}
.foot .wrap{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;padding:22px 24px;font-family:'Space Mono';font-size:11.5px;color:var(--muted)}
.foot a{color:var(--muted)}
</style>
</head>
<body>
<h2 class="sr-only">Resimay system status: ${esc(ov.label.toLowerCase())}.</h2>
<header class="head"><div class="wrap">
  <div class="brand"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="0" y="3" width="25" height="25" rx="8" fill="#2B45E8"/><text x="12.5" y="21" font-family="Bricolage Grotesque,sans-serif" font-size="16" font-weight="800" fill="#fff" text-anchor="middle">R</text><circle cx="25" cy="6" r="4.5" fill="#FFC83A"/></svg>Resimay <span class="tag">Status</span></div>
  <nav class="nav"><a class="on" href="/">Status</a><a href="https://resimay.ai">Resimay</a><a href="https://resimay.ai/contact">Contact</a></nav>
</div></header>

<main class="wrap">
  <div class="hero">
    <span class="eyebrow"><b></b>System status</span>
    <h1>${ov.key === 'up' ? `All systems <span class="it">operational</span>.` : esc(ov.label) + '.'}</h1>
    <div class="banner"><span class="d"></span><span class="t">${esc(ov.label)}</span><span class="u">updated ${updatedISO.slice(0, 16).replace('T', ' ')} UTC &middot; checks every 5 min</span></div>
  </div>

  <div class="seclabel">// Live services</div>
  ${sites.map(card).join('')}

  <div class="seclabel">// Incident history</div>
  <div class="quiet">
    <strong>No incidents reported.</strong>
    <p>This page checks resimay.ai and the API every 5 minutes from GitHub Actions and reports exactly what those checks return. We do not publish uptime numbers we cannot back with real monitoring data.</p>
  </div>
</main>

<footer class="foot"><div class="wrap">
  <span>&copy; ${updatedISO.slice(0, 4)} Resimay Labs Inc.</span>
  <span>Monitored every 5 min by GitHub Actions &middot; powered by <a href="https://upptime.js.org">Upptime</a></span>
</div></footer>
</body>
</html>`;
}

// ── build ──────────────────────────────────────────────────────────────────
const sites = loadSites();
const updated = process.env.BUILD_TIME || new Date().toISOString();
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/index.html`, html(sites, updated));
writeFileSync(`${OUT_DIR}/CNAME`, CNAME + '\n');
writeFileSync(`${OUT_DIR}/.nojekyll`, '');
console.log(`build-status: wrote site/index.html for ${sites.length} service(s): ${sites.map((s) => s.name).join(', ')}`);
