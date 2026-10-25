/**
 * Fetches config + games from the server API while the app bundles download in parallel,
 * then executes them in order: live (online counter, ticker, mobile strip) -> app (RTP grid)
 * -> retention (strips, alert, gallery).
 */
(function () {
    'use strict';

    var SCRIPTS = ['dist/live.min.js', 'dist/app.min.js', 'dist/retention.min.js'];

    function preload(src) {
        var link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'script';
        link.href = src;
        document.head.appendChild(link);
    }

    /** async=false keeps execution in insertion order while downloads overlap. */
    function loadScriptsInOrder(list) {
        list.forEach(function (src) {
            var s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.onerror = function () { console.error('bootstrap: failed to load ' + src); };
            document.body.appendChild(s);
        });
    }

    function fetchJson(url) {
        return fetch(url, { credentials: 'same-origin' }).then(function (r) {
            if (!r.ok) throw new Error(url + ' ' + r.status);
            return r.json();
        });
    }

    SCRIPTS.forEach(preload);

    if (!window.RTP_STATIC_GAMES_URL) {
        window.RTP_GAMES_PROMISE = fetchJson('/api/games');
        window.RTP_GAMES_PROMISE.catch(function () {});
    }

    Promise.all([
        fetchJson('/api/bootstrap'),
        fetchJson('/api/ui-config').catch(function () { return {}; }),
    ])
        .then(function (results) {
            window.PLATFORMS_CONFIG = results[0].platforms;
            window.PROVIDERS = results[0].providers;
            window.GAME_DATA = results[0].gameData || {};
            window.UI_CONFIG = results[1];
            loadScriptsInOrder(SCRIPTS);
        })
        .catch(function (e) { console.error('bootstrap:', e); });
})();
