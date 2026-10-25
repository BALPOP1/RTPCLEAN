'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
    hotHours: [
        { h: 14, m: 0, label: '14:00' },
        { h: 18, m: 0, label: '18:00' },
        { h: 21, m: 0, label: '21:00' },
        { h: 22, m: 30, label: '22:30' },
        { h: 23, m: 30, label: '23:30' },
    ],
    sinalGames: [
        'Fortune Tiger', 'Gates of Olympus', 'Sweet Bonanza', 'Starlight Princess',
        'Fortune Rabbit', 'Fortune Dragon', 'Big Bass Bonanza', 'Fruit Party',
        'Sugar Rush', 'Wild West Gold', 'Fortune Ox', 'Mahjong Ways',
    ],
    sinalMults: ['10X', '13X', '15X', '17X', '20X'],
    links: {},
    rtpAlertPlatformId: null,
    mobileStrip: [],
    winnerCount: 0,
    allowedHosts: ['poprtp.com', 'www.poprtp.com', 'localhost', '127.0.0.1'],
    redirectIfHostNotAllowed: false,
};

function nonEmptyArray(value) {
    return Array.isArray(value) && value.length > 0;
}

/** Merges data/ui-config.json over DEFAULTS; empty arrays fall back to the default. */
function loadUiConfig(rootDir) {
    let file = {};
    try {
        file = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'ui-config.json'), 'utf8'));
    } catch (e) {
        file = {};
    }
    const out = { ...DEFAULTS, ...file };
    for (const key of Object.keys(DEFAULTS)) {
        if (Array.isArray(DEFAULTS[key]) && !nonEmptyArray(file[key])) out[key] = DEFAULTS[key];
    }
    out.links = { ...DEFAULTS.links, ...(file.links || {}) };
    return out;
}

module.exports = { loadUiConfig };
