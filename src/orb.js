/**
 * 3-second GSS (GPU Style Sheets) loading splash:
 * Pre-mounts on load, then shows and plays the single POPJUN logo ball 2 seconds after first load
 * for 3 seconds before destroying the WebGL scene and removing the DOM elements completely.
 */
import { mount, softwareRendering } from 'gss-lang/runtime';
import orb from './orb.gss';

var SCENES = { orb: orb };
var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
var START_DELAY_MS = 2000;
var INTRO_MS = 3000;
var EXIT_MS = 400;
var MOBILE_MAX = 639;
var SCROLL_DURATION_MS = 2800;

var instances = [];
var finished = false;
var mobileScrollScheduled = false;

function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width: ' + MOBILE_MAX + 'px)').matches;
}

/** Slow ease scroll to the Jogos section (mobile only, once per page load). */
function scrollToGamesOnMobile() {
    if (mobileScrollScheduled || !isMobileViewport()) return;
    mobileScrollScheduled = true;

    var target = document.querySelector('.section.games');
    if (!target) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        target.scrollIntoView({ block: 'start' });
        return;
    }

    var startY = window.scrollY;
    var endY = target.getBoundingClientRect().top + startY - 12;
    var distance = endY - startY;
    if (Math.abs(distance) < 24) return;

    var t0 = null;
    function frame(now) {
        if (t0 == null) t0 = now;
        var t = Math.min(1, (now - t0) / SCROLL_DURATION_MS);
        var ease = t * t * (3 - 2 * t);
        window.scrollTo(0, startY + distance * ease);
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function cleanup() {
    instances.forEach(function (it) {
        try {
            it.scene.destroy();
        } catch (e) {}
    });
    instances = [];
    document.querySelectorAll('.gss-orb, .gss-key').forEach(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
    });
}

function finishIntro() {
    if (finished) return;
    finished = true;
    document.querySelectorAll('.gss-orb').forEach(function (wrap) {
        wrap.classList.add('is-done');
    });
    setTimeout(function () {
        cleanup();
        scrollToGamesOnMobile();
    }, EXIT_MS);
}

function start() {
    if (finished || instances.length) return;
    if (REDUCED.matches || softwareRendering()) {
        cleanup();
        setTimeout(scrollToGamesOnMobile, START_DELAY_MS + INTRO_MS);
        return;
    }

    var wraps = document.querySelectorAll('.gss-orb[data-scene]');
    if (!wraps.length) return;

    wraps.forEach(function (wrap) {
        var scene = SCENES[wrap.getAttribute('data-scene')];
        if (!scene) return;
        try {
            var view = mount(wrap.querySelector('canvas'), scene, { controls: false, adaptDpr: false });
            view.pause();
            instances.push({ wrap: wrap, scene: view });
            setTimeout(function () {
                if (finished) return;
                view.play();
                wrap.classList.add('is-ready');
                setTimeout(finishIntro, INTRO_MS);
            }, START_DELAY_MS);
        } catch (err) {
            console.warn('GSS orb intro unavailable:', err && err.message);
            cleanup();
        }
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
