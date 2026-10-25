'use strict';

const PRIORITIES = {
    FORTUNE_NAMED: 1,
    POPULAR_NAMED: 2,
    FORTUNE_PROVIDER: 3,
    OLYMPUS_GAMES: 4,
    POPULAR_PROVIDER: 5,
    REGULAR: 6,
};

function detectGamePriority(imageName, provider) {
    const lowerProvider = provider.toLowerCase();
    if (imageName.startsWith('FORTUNE_')) return PRIORITIES.FORTUNE_NAMED;
    if (imageName.startsWith('POPULAR_')) return PRIORITIES.POPULAR_NAMED;
    if (lowerProvider === 'pg soft' || lowerProvider === 'tada') return PRIORITIES.FORTUNE_PROVIDER;
    if (lowerProvider === 'pragmatic play') return PRIORITIES.OLYMPUS_GAMES;
    if (lowerProvider === 'hacksaw' || lowerProvider === "play n' go") return PRIORITIES.POPULAR_PROVIDER;
    return PRIORITIES.REGULAR;
}

function sortGamesByPopularity(games) {
    return games.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const aIsNumbered = a.imageName.match(/^(FORTUNE|POPULAR)_(\d+)/);
        const bIsNumbered = b.imageName.match(/^(FORTUNE|POPULAR)_(\d+)/);
        if (aIsNumbered && bIsNumbered) {
            return parseInt(aIsNumbered[2], 10) - parseInt(bIsNumbered[2], 10);
        }
        if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
        return a.imageName.localeCompare(b.imageName);
    });
}

module.exports = { detectGamePriority, sortGamesByPopularity };
