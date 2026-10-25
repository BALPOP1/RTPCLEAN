'use strict';

const fs = require('fs');
const path = require('path');
const { detectGamePriority, sortGamesByPopularity } = require('./popularity');
const {
    getTimeSeed,
    generateRandomRTP,
    generateRandomMultiplier,
    DEFAULT_RTP_RANGES,
    DEFAULT_MULTIPLIERS,
} = require('./rtp-engine');

const PROVIDERS_SCAN = [
    'HACKSAW',
    'PG SOFT',
    'Pragmatic Play',
    'Playtech',
    "Play N' GO",
    'TADA',
];

function scanLocalImages(rootDir) {
    const imagesDir = path.join(rootDir, 'public', 'images');
    const result = {};
    let total = 0;
    if (!fs.existsSync(imagesDir)) return { providers: result, totalImages: total, source: 'none' };

    for (const provider of PROVIDERS_SCAN) {
        const providerPath = path.join(imagesDir, provider);
        const images = [];
        if (fs.existsSync(providerPath) && fs.statSync(providerPath).isDirectory()) {
            const files = fs.readdirSync(providerPath);
            for (const file of files) {
                if (/\.(jpg|jpeg|png|webp|gif)$/i.test(file)) {
                    images.push(file);
                }
            }
            images.sort();
        }
        result[provider] = images;
        total += images.length;
    }
    return { providers: result, totalImages: total, source: 'scan' };
}

function countImagesInMap(providerMap) {
    if (!providerMap || typeof providerMap !== 'object') return 0;
    return Object.values(providerMap).reduce((n, arr) => {
        return n + (Array.isArray(arr) ? arr.length : 0);
    }, 0);
}

/**
 * Build full game list with RTP + multiplier (same semantics as client script.js).
 *
 * Uses data/provider-images.json when present (same curated list as legacy provider_image_lists.js).
 * Folder scan alone counts every image file — duplicate extensions (.webp + .jpg) or "Copy" files
 * become two games with different ids and different RTP; JSON avoids that.
 */
function loadProviderMap(rootDir) {
    const jsonPath = path.join(rootDir, 'data', 'provider-images.json');
    let jsonMap = null;
    if (fs.existsSync(jsonPath)) {
        try {
            jsonMap = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        } catch (e) {
            jsonMap = null;
        }
    }
    if (countImagesInMap(jsonMap) > 0) {
        return { providerMap: jsonMap, source: 'json', scannedTotal: 0 };
    }

    const scan = scanLocalImages(rootDir);
    if (scan.totalImages > 0) {
        return { providerMap: scan.providers, source: 'scan', scannedTotal: scan.totalImages };
    }
    return { providerMap: {}, source: 'none', scannedTotal: 0 };
}

const providerMapCache = new Map();
const payloadCache = new Map();

/** Payload only changes when the 3-minute time seed rolls over, so it is built once per seed. */
function buildGamesPayload(rootDir, cdnBase) {
    const timeSeed = getTimeSeed();
    const cacheKey = `${rootDir}\0${cdnBase}`;
    const cached = payloadCache.get(cacheKey);
    if (cached && cached.timeSeed === timeSeed) return cached;

    if (!providerMapCache.has(rootDir)) providerMapCache.set(rootDir, loadProviderMap(rootDir));
    const payload = buildPayload(providerMapCache.get(rootDir), cdnBase, timeSeed);
    payloadCache.set(cacheKey, payload);
    return payload;
}

function buildPayload({ providerMap, source, scannedTotal }, cdnBase, timeSeed) {
    const games = [];
    const seenIds = new Set();
    for (const [provider, images] of Object.entries(providerMap)) {
        if (!Array.isArray(images)) continue;
        for (const imageName of images) {
            const gameId = `${provider}/${imageName}`;
            if (seenIds.has(gameId)) continue;
            seenIds.add(gameId);
            const priority = detectGamePriority(imageName, provider);
            games.push({
                id: gameId,
                provider,
                imageName,
                imagePath: `${cdnBase}/images/${provider}/${imageName}`,
                priority,
                rtp: generateRandomRTP(gameId, DEFAULT_RTP_RANGES),
                multiplier: generateRandomMultiplier(gameId, DEFAULT_MULTIPLIERS),
            });
        }
    }

    sortGamesByPopularity(games);

    return {
        cdnBase,
        timeSeed,
        rtpRanges: DEFAULT_RTP_RANGES,
        multipliers: DEFAULT_MULTIPLIERS,
        games,
        meta: {
            totalGames: games.length,
            source,
            scannedTotal,
        },
    };
}

module.exports = { buildGamesPayload, scanLocalImages };
