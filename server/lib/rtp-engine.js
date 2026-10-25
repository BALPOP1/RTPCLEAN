'use strict';

/** Mirrors script.js CONFIG defaults (server-side only). */
const DEFAULT_RTP_RANGES = { min: 30, max: 99 };
const DEFAULT_MULTIPLIERS = [
    { value: '3X', type: 'low' },
    { value: '7X', type: 'low' },
    { value: '9X', type: 'medium' },
    { value: '10X', type: 'medium' },
    { value: '11X', type: 'medium' },
    { value: '13X', type: 'high' },
    { value: '15X', type: 'high' },
    { value: '17X', type: 'high' },
    { value: '20X', type: 'high' },
];

/**
 * Wall-clock calendar in America/Sao_Paulo (same fields the original script used).
 * Uses Intl parts instead of parsing toLocaleString — Node and browsers then agree on the seed.
 */
function getSaoPauloCalendar() {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const parts = fmt.formatToParts(new Date());
    const get = (type) => parseInt(parts.find((p) => p.type === type).value, 10);
    return {
        year: get('year'),
        monthIndex: get('month') - 1,
        day: get('day'),
        hour: get('hour'),
        minute: get('minute'),
    };
}

function getTimeSeed() {
    const c = getSaoPauloCalendar();
    const roundedMinute = Math.floor(c.minute / 3) * 3;
    return (
        c.year * 525600 +
        c.monthIndex * 43800 +
        c.day * 1440 +
        c.hour * 60 +
        roundedMinute
    );
}

function seededRandom(seed) {
    seed = Math.abs(seed | 0);
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function getSeededRandomInt(seed, min, max) {
    seed = (seed * 9301 + 49297) % 233280;
    const random = seededRandom(seed);
    return Math.floor(random * (max - min + 1)) + min;
}

function stringToHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function generateRandomRTP(gameId, rtpRanges = DEFAULT_RTP_RANGES) {
    const timeSeed = getTimeSeed();
    const gameNumericId = typeof gameId === 'string' ? stringToHash(gameId) : gameId;
    const combinedSeed = timeSeed * 1000 + gameNumericId;
    return getSeededRandomInt(combinedSeed, rtpRanges.min, rtpRanges.max);
}

function generateRandomMultiplier(gameId, multipliers = DEFAULT_MULTIPLIERS) {
    const timeSeed = getTimeSeed();
    const gameNumericId = typeof gameId === 'string' ? stringToHash(gameId) : gameId;
    const multiplierSeed = (timeSeed * 1000 + gameNumericId) * 7;
    const multiplierIndex = getSeededRandomInt(multiplierSeed, 0, multipliers.length - 1);
    const multiplier = multipliers[multiplierIndex];
    const icons = [];
    for (let i = 0; i < 3; i++) {
        const iconSeed = (timeSeed * 1000 + gameNumericId) * (13 + i * 5);
        const isCheck = getSeededRandomInt(iconSeed, 0, 1) === 1;
        icons.push(isCheck ? '✔' : '✕');
    }
    return {
        value: multiplier.value,
        type: multiplier.type,
        icons,
    };
}

module.exports = {
    getTimeSeed,
    generateRandomRTP,
    generateRandomMultiplier,
    DEFAULT_RTP_RANGES,
    DEFAULT_MULTIPLIERS,
};
