'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');

const { buildGamesPayload } = require('./server/lib/build-games');
const { loadUiConfig } = require('./server/lib/ui-config');

const root = __dirname;
const PUBLIC_DIR = path.join(root, 'public');
const DATA_DIR = path.join(root, 'data');
const PORT = process.env.PORT || 3000;
const CDN_BASE = process.env.CDN_BASE ?? '';

const app = express();

function readJson(name) {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

function jsonRoute(route, errorCode, build) {
    app.get(route, (req, res) => {
        try {
            res.json(build());
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: errorCode });
        }
    });
}

/** Config files only change on deploy; read once and keep the first successful result. */
function cached(load) {
    let value;
    return () => (value === undefined ? (value = load()) : value);
}

const getUiConfig = cached(() => loadUiConfig(root));

const getBootstrap = cached(() => {
    const provFile = readJson('providers.json');
    return {
        platforms: readJson('platforms.json'),
        providers: provFile.providers,
        gameData: provFile.gameData || {},
    };
});

jsonRoute('/api/games', 'games_unavailable', () => buildGamesPayload(root, CDN_BASE));

jsonRoute('/api/ui-config', 'ui_config_unavailable', getUiConfig);

jsonRoute('/api/bootstrap', 'bootstrap_unavailable', getBootstrap);

app.use(express.static(PUBLIC_DIR, {
    index: ['index.html'],
    extensions: ['html'],
    maxAge: '7d',
    setHeaders(res, filePath) {
        // HTML/JS/CSS have unversioned URLs: revalidate via ETag so deploys show up immediately.
        if (/\.(html|js|css|json)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
    },
}));

const server = app.listen(PORT, () => {
    console.log(`POP RTP http://localhost:${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the other process or set PORT (e.g. PORT=3001 npm start).`);
        process.exit(1);
    }
    throw err;
});
