/**
 * Decorative GSS (GPU Style Sheets) logo ball:
 * plays a 3-second playful center-screen intro on initial load (both desktop and mobile),
 * then destroys the WebGL scene and removes the DOM node so there is zero ongoing GPU/CPU cost.
 */
import { mount, softwareRendering } from 'gss-lang/runtime';
import orb from './orb.gss';

var SCENES = { orb: orb };
var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
var INTRO_MS = 3000;
var EXIT_MS = 450;

var instances = [];
var finished = false;

function cleanup() {
    instances.forEach(function (it) {
        try {
            it.scene.destroy();
        } catch (e) {}
        if (it.wrap && it.wrap.parentNode) {
            it.wrap.parentNode.removeChild(it.wrap);
        }
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
        wrap.classList.remove('is-intro');
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
