'use strict';

/**
 * src/*.js -> public/dist/*.min.js
 * The page scripts are minified as-is; orb.js is bundled with the GSS runtime
 * and its .gss scene is compiled here, so the browser never loads the GSS compiler.
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const dist = path.join(root, 'public', 'dist');

const ENTRIES = ['live.js', 'app.js', 'retention.js'];
const BUNDLED_ENTRIES = ['orb.js'];

function gssPlugin() {
    return {
        name: 'gss',
        setup(build) {
            build.onLoad({ filter: /\.gss$/ }, async (args) => {
                const { compile } = await import('gss-lang');
                const source = await fs.promises.readFile(args.path, 'utf8');
                const compiled = compile(source);
                return { contents: 'export default ' + JSON.stringify(compiled) + ';', loader: 'js' };
            });
        },
    };
}

async function run() {
    fs.mkdirSync(dist, { recursive: true });
    const common = { minify: true, platform: 'browser', logLevel: 'warning' };

    for (const name of ENTRIES) {
        await esbuild.build({
            ...common,
            entryPoints: [path.join(srcDir, name)],
            outfile: path.join(dist, name.replace(/\.js$/, '.min.js')),
            bundle: false,
            target: ['es2018'],
        });
    }

    for (const name of BUNDLED_ENTRIES) {
        await esbuild.build({
            ...common,
            entryPoints: [path.join(srcDir, name)],
            outfile: path.join(dist, name.replace(/\.js$/, '.min.js')),
            bundle: true,
            format: 'iife',
            target: ['es2020'],
            plugins: [gssPlugin()],
        });
    }

    const built = ENTRIES.concat(BUNDLED_ENTRIES).map((n) => 'public/dist/' + n.replace(/\.js$/, '.min.js'));
    console.log('build-client:', built.join(', '));
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
