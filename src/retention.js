/**
 * POP RTP — info strips and engagement: Horário Quente, Sinal do Dia, Ganhos de Hoje,
 * RTP Alert, last-30-seconds cycle warning, winners gallery.
 */
(function () {
    'use strict';

    var UI = window.UI_CONFIG || {};
    var APP = window.RTPApp || {};

    var HOT_HOURS = UI.hotHours || [];
    var SINAL_GAMES = UI.sinalGames || [];
    var SINAL_MULTS = UI.sinalMults || [];

    function $(id) { return document.getElementById(id); }

    function getSPTime() {
        return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    }

    function getTodaySeed() {
        var t = getSPTime();
        return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
    }

    function seededRand(seed) {
        seed = Math.abs(seed | 0);
        var t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }

    // ============================================
    // HORÁRIO QUENTE — countdown to the next peak hour (São Paulo time)
    // ============================================

    function getNextHotHour() {
        var sp = getSPTime();
        var nowSec = sp.getHours() * 3600 + sp.getMinutes() * 60 + sp.getSeconds();
        for (var i = 0; i < HOT_HOURS.length; i++) {
            var target = HOT_HOURS[i].h * 3600 + HOT_HOURS[i].m * 60;
            if (target > nowSec) return { label: HOT_HOURS[i].label, diffSec: target - nowSec };
        }
        var first = HOT_HOURS[0];
        return { label: first.label, diffSec: 86400 - nowSec + first.h * 3600 + first.m * 60 };
    }

    /** A hot hour stays "active" for 30 minutes after it starts. */
    function isHotHourActive() {
        var sp = getSPTime();
        for (var i = 0; i < HOT_HOURS.length; i++) {
            var diffMin = (sp.getHours() - HOT_HOURS[i].h) * 60 + (sp.getMinutes() - HOT_HOURS[i].m);
            if (diffMin >= 0 && diffMin < 30) return true;
        }
        return false;
    }

    function formatCountdown(d) {
        var hh = Math.floor(d / 3600);
        var mm = Math.floor((d % 3600) / 60);
        var ss = d % 60;
        if (hh > 0) return hh + 'h ' + mm + 'min';
        if (mm > 0) return mm + 'm ' + String(ss).padStart(2, '0') + 's';
        return ss + 's';
    }

    function initHoraQuente() {
        var strip = $('horaQuenteStrip');
        if (!strip || !HOT_HOURS.length) return;
        var labelEl = $('horaQuenteLabel');
        var timeEl = $('horaQuenteTime');
        var countdownEl = $('horaQuenteCountdown');

        function tick() {
            var active = isHotHourActive();
            strip.classList.toggle('is-active', active);
            if (active) {
                labelEl.textContent = 'Horário quente ativo';
                timeEl.textContent = 'AGORA';
                countdownEl.textContent = '';
            } else {
                var next = getNextHotHour();
                labelEl.textContent = 'Próximo horário quente';
                timeEl.textContent = next.label;
                countdownEl.textContent = 'em ' + formatCountdown(Math.floor(next.diffSec));
            }
        }

        tick();
        setInterval(tick, 1000);
    }

    // ============================================
    // SINAL DO DIA — one game + RTP range + multiplier per day
    // ============================================

    function initSinalDoDia() {
        if (!$('sinalDoDiaPanel') || !SINAL_GAMES.length) return;
        var seed = getTodaySeed();
        var game = SINAL_GAMES[Math.floor(seededRand(seed) * SINAL_GAMES.length)];
        var rtpMin = 85 + Math.floor(seededRand(seed + 1) * 10);
        var rtpMax = rtpMin + 2 + Math.floor(seededRand(seed + 2) * 4);
        var mult = SINAL_MULTS[Math.floor(seededRand(seed + 3) * SINAL_MULTS.length)];

        $('sinalGameName').textContent = game;
        $('sinalRTP').textContent = rtpMin + '–' + rtpMax + '%';
        $('sinalMult').textContent = mult ? 'até ' + mult : '';
    }

    // ============================================
    // GANHOS DE HOJE — daily running total; each 10 s block adds a seeded R$ 5–80
    // ============================================

    function getLocalDateSeed(d) {
        return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    }

    function getSecOfDay(d) {
        return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    }

    function gainForBlock(dateSeed, block) {
        return 5 + Math.floor(seededRand((dateSeed ^ Math.imul(block, 48271)) >>> 0) * 76);
    }

    function dayBase(dateSeed) {
        return 1500 + Math.floor(seededRand((dateSeed ^ 0x5bd1e995) >>> 0) * 800);
    }

    function totalThrough(dateSeed, secOfDay) {
        var sum = dayBase(dateSeed);
        var maxBlock = Math.floor(secOfDay / 10);
        for (var i = 0; i <= maxBlock; i++) sum += gainForBlock(dateSeed, i);
        return sum;
    }

    function fmtBRL(n) {
        return 'R$ ' + Math.floor(n).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }

    function startGanhosDoDia() {
        var els = ['ganhosDoDiaValue', 'ganhosDoDiaValueDesktop'].map($).filter(Boolean);
        if (!els.length) return;

        var lastDateSeed = -1;
        var lastSec = -1;
        var total = 0;
        var lastShown = -1;

        function tick() {
            var d = new Date();
            var dateSeed = getLocalDateSeed(d);
            var sec = getSecOfDay(d);

            if (dateSeed !== lastDateSeed || sec < lastSec) {
                lastDateSeed = dateSeed;
                total = totalThrough(dateSeed, sec);
            } else if (sec > lastSec) {
                for (var b = Math.floor(lastSec / 10) + 1; b <= Math.floor(sec / 10); b++) {
                    total += gainForBlock(dateSeed, b);
                }
            }
            lastSec = sec;

            if (total === lastShown) return;
            lastShown = total;
            els.forEach(function (el) {
                el.textContent = fmtBRL(total);
                el.classList.add('is-flash');
                setTimeout(function () { el.classList.remove('is-flash'); }, 400);
            });
        }

        tick();
        setInterval(tick, 1000);
    }

    // ============================================
    // RTP ALERT — shows the highest-RTP game once, 70–120 s after load
    // ============================================

    function getRTPAlertData() {
        var sp = getSPTime();
        var secInCycle = (sp.getMinutes() % 3) * 60 + sp.getSeconds();
        var games = window._allGames || [];
        var best = null;
        for (var i = 0; i < games.length; i++) {
            if (typeof games[i].rtp === 'number' && (!best || games[i].rtp > best.rtp)) best = games[i];
        }
        return {
            imagePath: best ? best.imagePath : '',
            rtp: (best && best.rtp) || 96,
            secsRemaining: 180 - secInCycle,
        };
    }

    function setupRTPAlert() {
        if (!APP.createOverlay) return;
        var alertOverlay = APP.createOverlay('rtpAlertModal');
        if (!alertOverlay) return;

        var btn = $('rtpAlertBtn');
        if (btn && UI.rtpAlertPlatformId != null && APP.platformUrl) {
            var url = APP.platformUrl(UI.rtpAlertPlatformId);
            if (url && url !== '#') btn.href = url;
        }

        function show() {
            var data = getRTPAlertData();
            if (data.imagePath) $('rtpAlertGameImg').src = data.imagePath;
            $('rtpAlertValue').textContent = data.rtp + '%';
            alertOverlay.show();

            var secs = data.secsRemaining;
            var cdEl = $('rtpAlertCountdown');
            (function tick() {
                cdEl.textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
                if (secs > 0 && alertOverlay.isOpen()) {
                    secs--;
                    setTimeout(tick, 1000);
                } else {
                    alertOverlay.hide();
                }
            })();
        }

        setTimeout(function () {
            if (document.hidden || document.querySelector('[aria-hidden="false"].is-open')) return;
            if (APP.sessionOnce && !APP.sessionOnce('poprtp:rtpAlert')) return;
            show();
        }, 70000 + Math.floor(Math.random() * 50000));
    }

    // ============================================
    // CYCLE EXPIRY WARNING — last 30 s of each 3-minute cycle
    // ============================================

    function startCycleExpiryWatcher() {
        var minEl = $('timerMinutes');
        var secEl = $('timerSeconds');
        if (!minEl || !secEl) return;
        var targets = [document.querySelector('.timer-card'), $('floatingTimerBtn')].filter(Boolean);

        setInterval(function () {
            var total = (parseInt(minEl.textContent, 10) || 0) * 60 + (parseInt(secEl.textContent, 10) || 0);
            var warning = total <= 30 && total > 0;
            targets.forEach(function (el) { el.classList.toggle('is-expiring', warning); });
        }, 500);
    }

    // ============================================
    // WINNERS GALLERY — shuffled infinite strip of asset/winner/a (N).webp + lightbox
    // ============================================

    function setupWinnersGallery() {
        var track = $('tm-track');
        var wrap = $('ganhadores-gallery');
        var btnPrev = $('tm-prev');
        var btnNext = $('tm-next');
        var count = UI.winnerCount || 0;
        if (!track || !count) {
            if (wrap) wrap.hidden = true;
            return;
        }

        var urls = [];
        for (var i = 1; i <= count; i++) urls.push('asset/winner/a (' + i + ').webp');
        for (var k = urls.length - 1; k > 0; k--) {
            var j = Math.floor(Math.random() * (k + 1));
            var t = urls[k]; urls[k] = urls[j]; urls[j] = t;
        }

        var html = urls.map(function (url, idx) {
            var loading = idx < 14 ? 'eager' : 'lazy';
            return '<button class="tm-item" type="button" data-src="' + url + '">' +
                '<img src="' + url + '" alt="Ganhador" loading="' + loading + '"></button>';
        }).join('');
        track.innerHTML = html + html;

        function normalizeScroll() {
            var half = track.scrollWidth / 2;
            if (!half) return;
            if (track.scrollLeft >= half - 2) track.scrollLeft -= half;
            else if (track.scrollLeft <= 2) track.scrollLeft += half;
        }

        function stepPx() {
            var item = track.querySelector('.tm-item');
            if (!item) return 0;
            return item.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).gap) || 0);
        }

        track.addEventListener('scroll', normalizeScroll);
        window.addEventListener('resize', normalizeScroll);
        if (btnPrev) btnPrev.addEventListener('click', function () { track.scrollLeft -= stepPx(); normalizeScroll(); });
        if (btnNext) btnNext.addEventListener('click', function () { track.scrollLeft += stepPx(); normalizeScroll(); });

        // Broken screenshots are dropped from the strip.
        track.addEventListener('error', function (e) {
            if (e.target.tagName !== 'IMG') return;
            var btn = e.target.closest('.tm-item');
            if (btn) btn.remove();
        }, true);

        var lightbox = APP.createOverlay ? APP.createOverlay('tm-lightbox', function () {
            $('tm-lightbox-img').removeAttribute('src');
        }) : null;
        track.addEventListener('click', function (e) {
            var btn = e.target.closest('.tm-item');
            if (!btn || !lightbox) return;
            $('tm-lightbox-img').src = btn.getAttribute('data-src');
            lightbox.show();
        });

        // Auto-scroll at 120 px/s after 5 s; pauses on hover and briefly after touch.
        var hoverPause = false;
        var touchPause = false;
        var touchTimer = null;
        var active = false;
        var last = performance.now();

        wrap.addEventListener('mouseenter', function () { hoverPause = true; });
        wrap.addEventListener('mouseleave', function () { hoverPause = false; });
        wrap.addEventListener('touchstart', function () {
            touchPause = true;
            clearTimeout(touchTimer);
        }, { passive: true });
        wrap.addEventListener('touchend', function () {
            clearTimeout(touchTimer);
            touchTimer = setTimeout(function () { touchPause = false; }, 900);
        }, { passive: true });

        // The rAF loop only runs while the strip is on screen.
        var visible = true;
        var rafId = 0;

        function frame(now) {
            var dt = Math.min((now - last) / 1000, 0.05);
            last = now;
            if (active && !hoverPause && !touchPause) {
                track.scrollLeft += 120 * dt;
                normalizeScroll();
            }
            rafId = visible ? requestAnimationFrame(frame) : 0;
        }

        function resume() {
            if (rafId || !visible) return;
            last = performance.now();
            rafId = requestAnimationFrame(frame);
        }

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[entries.length - 1].isIntersecting;
                if (visible) resume();
            }).observe(wrap);
        }

        setTimeout(function () { active = true; last = performance.now(); }, 5000);
        resume();
    }

    // ============================================
    // HOST CHECK — optional redirect to the official domain (data/ui-config.json)
    // ============================================

    function enforceHost() {
        if (!UI.redirectIfHostNotAllowed || !(UI.allowedHosts || []).length) return;
        var h = (location.hostname || '').replace(/^www\./, '');
        if (UI.allowedHosts.indexOf(h) !== -1) return;
        setTimeout(function () { location.assign('https://poprtp.com'); }, 4500 + Math.floor(Math.random() * 3000));
    }

    function boot() {
        initHoraQuente();
        initSinalDoDia();
        startGanhosDoDia();
        setupRTPAlert();
        startCycleExpiryWatcher();
        setupWinnersGallery();
        enforceHost();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
