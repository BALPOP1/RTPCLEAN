/**
 * Static-hosting loader (GitHub Pages, Netlify, S3) — no Node server.
 *
 * Run `npm run export:static` first; it writes public/data/*.json.
 * Then in index.html replace `js/bootstrap.js` with `js/bootstrap-static.js`.
 * RTP values are frozen at export time (no 3-minute refresh without the server).
 */
(function () {
    'use strict';

    window.RTP_STATIC_GAMES_URL = 'data/games-payload.json';

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('Failed to load ' + src)); };
            document.body.appendChild(s);
        });
    }

    function fetchJson(url) {
        return fetch(url, { credentials: 'same-origin' }).then(function (r) {
            if (!r.ok) throw new Error(url + ' ' + r.status);
            return r.json();
        });
    }

    Promise.all([
        fetchJson('data/platforms.json'),
        fetchJson('data/providers.json'),
        fetchJson('data/ui-config.json').catch(function () { return {}; }),
    ])
        .then(function (results) {
            window.PLATFORMS_CONFIG = results[0];
            window.PROVIDERS = results[1].providers;
            window.GAME_DATA = results[1].gameData || {};
            window.UI_CONFIG = results[2];
            return loadScript('dist/live.min.js');
        })
        .then(function () { return loadScript('dist/app.min.js'); })
        .then(function () { return loadScript('dist/retention.min.js'); })
        .catch(function (e) { console.error('bootstrap-static:', e); });
})();
