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

var instances = [];
var finished = false;

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
    setTimeout(cleanup, EXIT_MS);
}

function start() {
    if (finished || instances.length) return;
    if (REDUCED.matches || softwareRendering()) {
        cleanup();
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
