/**
 * 3-second GSS (GPU Style Sheets) loading splash:
 * Renders a single POPJUN logo ball with a gentle floating animation for 3 seconds,
 * then destroys the WebGL scene and removes the DOM elements completely.
 */
import { mount, softwareRendering } from 'gss-lang/runtime';
import orb from './orb.gss';

var SCENES = { orb: orb };
var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
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
            instances.push({
                wrap: wrap,
                scene: mount(wrap.querySelector('canvas'), scene, { controls: false, adaptDpr: false })
            });
            wrap.classList.add('is-ready');
            setTimeout(finishIntro, INTRO_MS);
        } catch (err) {
            console.warn('GSS orb intro unavailable:', err && err.message);
            cleanup();
        }
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
