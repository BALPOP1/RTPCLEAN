/**
 * POP RTP — live widgets: online counter, live RTP ticker, mobile platform strip.
 * Counter and ticker are seeded by the clock, so every device shows the same value at the same time.
 */
(function () {
    'use strict';

    var UI = window.UI_CONFIG || {};
    var PLATFORMS = Array.isArray(window.PLATFORMS_CONFIG) ? window.PLATFORMS_CONFIG : [];

    function $(id) { return document.getElementById(id); }

    /** Deterministic PRNG in [0, 1) from a 32-bit seed. */
    function seededRand(seed) {
        seed = Math.abs(seed | 0);
        var t = seed + 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // ============================================
    // ONLINE COUNTER — São Paulo daily curve + seeded swing per 10 s block + ±1 per second
    // ============================================

    function getSaoPauloHour() {
        var sp = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        return sp.getHours() + sp.getMinutes() / 60;
    }

    function getBaseOnlineCount() {
        var hour = getSaoPauloHour();
        if (hour >= 2 && hour < 6) return 180 + Math.floor((hour - 2) * 40);
        if (hour >= 6 && hour < 9) return 340 + Math.floor((hour - 6) * 320);
        if (hour >= 9 && hour < 12) return 1300 + Math.floor((hour - 9) * 500);
        if (hour >= 12 && hour < 14) return 2800 + Math.floor((hour - 12) * 600);
        if (hour >= 14 && hour < 18) return 4000 + Math.floor((hour - 14) * 350);
        if (hour >= 18 && hour < 21) return 5400 + Math.floor((hour - 18) * 400);
        if (hour >= 21 && hour < 23) return 6600 - Math.floor((hour - 21) * 1200);
        if (hour >= 23) return 4200 - Math.floor((hour - 23) * 1600);
        return 2600 - Math.floor(hour * 1210);
    }

    function getLocalDateSeed(d) {
        return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    }

    function getSecOfDayLocal(d) {
        return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    }

    function randMix(dateSeed, index) {
        return ((dateSeed ^ Math.imul(index, 48271)) >>> 0);
    }

    /** Signed swing for one 10 s window: magnitude 5..65, direction seeded. */
    function onlineSwingForBlock(dateSeed, block) {
        var magnitude = 5 + Math.floor(seededRand(randMix(dateSeed, block)) * 61);
        var sign = seededRand(randMix(dateSeed, block + 9176) ^ 0x9e3779b9) < 0.5 ? -1 : 1;
        return sign * magnitude;
    }

    function getDeterministicOnlineCount() {
        var d = new Date();
        var dateSeed = getLocalDateSeed(d);
        var sec = getSecOfDayLocal(d);
        var blockTarget = Math.max(100, Math.round(getBaseOnlineCount() + onlineSwingForBlock(dateSeed, Math.floor(sec / 10))));
        var microDrift = seededRand(randMix(dateSeed, sec + 0x4c51)) < 0.5 ? -1 : 1;
        return Math.max(100, blockTarget + microDrift);
    }

    function formatNumber(n) {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    /** Rolls the displayed number toward the target over ~400 ms. */
    function setNumberSmooth(el, target) {
        var start = parseInt(el.dataset.displayVal || el.textContent.replace(/\./g, ''), 10) || target;
        el.dataset.displayVal = target;
        if (start === target) {
            el.textContent = formatNumber(target);
            return;
        }
        var startTime = performance.now();
        function frame(now) {
            var p = Math.min(1, (now - startTime) / 400);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = formatNumber(Math.round(start + (target - start) * eased));
            if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    function tickOnlineCounter() {
        var val = getDeterministicOnlineCount();
        ['onlineViewerCount', 'onlineViewerCountHeader'].forEach(function (id) {
            var el = $(id);
            if (el) setNumberSmooth(el, val);
        });
    }

    // ============================================
    // LIVE TICKER — one message per 7 s slot, built from the real card RTP
    // ============================================

    var TICKER_INTERVAL_MS = 7000;
    var RTP_SPIKE_THRESHOLD = 90;
    var RTP_TICKER_SHOW_MIN = 50;

    var TICKER_FALLBACKS = [
        'POP RTP — monitor ao vivo sincronizado',
        'Base de jogos verificada neste ciclo',
        'Análise RTP ativa — dados em tempo real',
        'Conexão POP RTP estável neste ciclo',
    ];

    /** [image file, game name, spike line, normal line]; "%" is replaced by the RTP. */
    var TICKER_GAMES = [
        ['FORTUNE_3.webp', 'Fortune Tiger', 'RTP tá alto — Fortune Tiger %% — corre!', 'Fortune Tiger — RTP %% no monitor ao vivo'],
        ['OLYMPUS.webp', 'Gates of Olympus', 'RTP elevado — Gates of Olympus %% agora', 'Gates of Olympus — RTP %% neste ciclo'],
        ['FORTUNE_1.webp', 'Fortune Rabbit', 'RTP máximo detectado — Fortune Rabbit %% agora', 'Fortune Rabbit — RTP %% ao vivo'],
        ['POPULAR_2.webp', 'Sugar Rush Xmas', 'Sugar Rush Xmas com RTP acima de %% nesse momento', 'Sugar Rush Xmas — RTP %% no radar'],
        ['POPULAR_1.webp', 'Fruit Party', 'Pico de RTP em Fruit Party — %% ao vivo', 'Fruit Party — RTP %% neste ciclo'],
        ['POPULAR_3.webp', 'Big Bass Bonanza', 'Big Bass Bonanza disparou — RTP %% agora', 'Big Bass Bonanza — RTP %% monitorado'],
        ['FORTUNE_2.webp', 'Fortune Snake', 'Fortune Snake com RTP elevado — %% detectado', 'Fortune Snake — RTP %% ao vivo'],
        ['POPULAR_4.webp', 'Gems Bonanza', 'Gems Bonanza pagando alto — RTP %%', 'Gems Bonanza — RTP %% no radar'],
    ];

    function findGameByImage(imageName) {
        var games = window._allGames || [];
        for (var i = 0; i < games.length; i++) {
            if (games[i].imageName === imageName) return games[i];
        }
        return null;
    }

    function tickerTextForSlot(slot) {
        var entry = TICKER_GAMES[slot % TICKER_GAMES.length];
        var game = findGameByImage(entry[0]);
        if (game) {
            var rtp = typeof window.generateRandomRTP === 'function' ? window.generateRandomRTP(game.id) : game.rtp;
            if (rtp >= RTP_TICKER_SHOW_MIN) {
                return (rtp >= RTP_SPIKE_THRESHOLD ? entry[2] : entry[3]).replace('%%', rtp + '%');
            }
        }
        var mix = (slot ^ Math.imul(0xF411, 2654435761)) >>> 0;
        return TICKER_FALLBACKS[Math.floor(seededRand(mix) * TICKER_FALLBACKS.length)];
    }

    function showTickerMessage() {
        var el = $('liveActivityTicker');
        if (!el) return;
        var text = tickerTextForSlot(Math.floor(Date.now() / TICKER_INTERVAL_MS));
        el.classList.remove('is-visible');
        setTimeout(function () {
            el.textContent = text;
            el.classList.add('is-visible');
        }, 300);
    }

    /** Starts on the next 7 s boundary once games are loaded (or after ~20 s regardless). */
    function startTicker() {
        var tries = 0;
        function begin() {
            var delay = TICKER_INTERVAL_MS - (Date.now() % TICKER_INTERVAL_MS);
            setTimeout(function loop() {
                showTickerMessage();
                setTimeout(loop, TICKER_INTERVAL_MS);
            }, delay === TICKER_INTERVAL_MS ? 0 : delay);
        }
        function waitForGames() {
            if ((window._allGames && window._allGames.length) || ++tries >= 100) begin();
            else setTimeout(waitForGames, 200);
        }
        setTimeout(waitForGames, 1200);
    }

    // ============================================
    // MOBILE PLATFORM STRIP — 5 slots; the centre slot shows the LONG image; rotates every 4 s
    // ============================================

    var MB_CENTER_IDX = 2;
    var MB_INTERVAL = 4000;
    var MB_PRE_MS = 200;
    var MB_SLIDE_MS = 400;

    function platformUrl(id) {
        for (var i = 0; i < PLATFORMS.length; i++) {
            if (PLATFORMS[i].id === id) return PLATFORMS[i].url || '#';
        }
        return '#';
    }

    function initMobileBannerCarousel() {
        var row = $('mobileBannerRow');
        var pool = (UI.mobileStrip || []).map(function (p) {
            return { name: p.name, square: p.square, long: p.long, href: platformUrl(p.id) };
        });
        if (!row || !pool.length) return;
        var items = Array.prototype.slice.call(row.querySelectorAll('.mb-item'));
        if (items.length !== 5) return;

        function orderFor(offset) {
            return items.map(function (_, i) { return pool[(offset + i) % pool.length]; });
        }

        function setSlotClasses(item, isCenter) {
            item.classList.toggle('mb-long', isCenter);
            item.classList.toggle('mb-square', !isCenter);
        }

        function paint(order) {
            items.forEach(function (item, i) {
                var isCenter = i === MB_CENTER_IDX;
                var cur = item.querySelector('.mb-img-cur');
                var nxt = item.querySelector('.mb-img-nxt');
                cur.src = isCenter ? order[i].long : order[i].square;
                cur.alt = order[i].name;
                item.href = order[i].href;
                setSlotClasses(item, isCenter);
                nxt.style.transition = 'none';
                nxt.style.transform = 'translateX(100%)';
                nxt.removeAttribute('src');
            });
        }

        var offset = 0;
        var animating = false;
        paint(orderFor(offset));

        /** Phase 1: current images nudge left; phase 2: they exit while the next ones slide in; then settle. */
        function step() {
            if (animating) return;
            animating = true;
            var nextOffset = (offset + 1) % pool.length;
            var next = orderFor(nextOffset);

            items.forEach(function (item, i) {
                var nxt = item.querySelector('.mb-img-nxt');
                nxt.style.transition = 'none';
                nxt.style.transform = 'translateX(100%)';
                nxt.src = i === MB_CENTER_IDX ? next[i].long : next[i].square;
                nxt.alt = next[i].name;
            });

            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    var phase2Started = false;
                    var settled = false;

                    function settle() {
                        if (settled) return;
                        settled = true;
                        items.forEach(function (item, i) {
                            var cur = item.querySelector('.mb-img-cur');
                            var nxt = item.querySelector('.mb-img-nxt');
                            cur.style.transition = 'none';
                            nxt.style.transition = 'none';
                            cur.src = nxt.src;
                            cur.alt = nxt.alt;
                            cur.style.transform = 'translateX(0)';
                            nxt.style.transform = 'translateX(100%)';
                            nxt.removeAttribute('src');
                            item.href = next[i].href;
                            setSlotClasses(item, i === MB_CENTER_IDX);
                        });
                        offset = nextOffset;
                        animating = false;
                    }

                    function startPhase2() {
                        if (phase2Started) return;
                        phase2Started = true;
                        var ease = 'transform ' + MB_SLIDE_MS + 'ms ease-out';
                        items.forEach(function (item) {
                            var cur = item.querySelector('.mb-img-cur');
                            var nxt = item.querySelector('.mb-img-nxt');
                            cur.style.transition = ease;
                            cur.style.transform = 'translateX(-100%)';
                            nxt.style.transition = ease;
                            nxt.style.transform = 'translateX(0)';
                        });
                        setTimeout(settle, MB_SLIDE_MS + 80);
                    }

                    var easeIn = 'transform ' + MB_PRE_MS + 'ms ease-in';
                    items.forEach(function (item) {
                        var cur = item.querySelector('.mb-img-cur');
                        cur.style.transition = easeIn;
                        cur.style.transform = 'translateX(-50%)';
                    });
                    setTimeout(startPhase2, MB_PRE_MS + 60);
                });
            });
        }

        // The strip is display:none from 1024px up; don't swap images nobody can see.
        var desktop = window.matchMedia('(min-width: 1024px)');
        setInterval(function () {
            if (!desktop.matches && !document.hidden) step();
        }, MB_INTERVAL);
    }

    function boot() {
        tickOnlineCounter();
        setInterval(tickOnlineCounter, 1000);
        startTicker();
        initMobileBannerCarousel();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
