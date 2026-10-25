'use strict';

/**
 * Static-hosting export: writes public/data/ with the same JSON the API serves,
 * so public/ can be deployed without Node (use js/bootstrap-static.js in index.html).
 * Optional: CDN_BASE=https://cdn.example.com node scripts/export-static.js
 */
const fs = require('fs');
const path = require('path');
const { buildGamesPayload } = require('../server/lib/build-games');
const { loadUiConfig } = require('../server/lib/ui-config');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const outDir = path.join(root, 'public', 'data');
const CDN_BASE = process.env.CDN_BASE ?? '';

fs.mkdirSync(outDir, { recursive: true });

const games = buildGamesPayload(root, CDN_BASE);
fs.writeFileSync(path.join(outDir, 'games-payload.json'), JSON.stringify(games));
fs.copyFileSync(path.join(dataDir, 'platforms.json'), path.join(outDir, 'platforms.json'));
fs.copyFileSync(path.join(dataDir, 'providers.json'), path.join(outDir, 'providers.json'));
fs.writeFileSync(path.join(outDir, 'ui-config.json'), JSON.stringify(loadUiConfig(root)));

console.log('export-static: public/data/ —', games.games.length, 'games, cdnBase=' + JSON.stringify(games.cdnBase));
