'use strict';

/**
 * Builds public/article/{slug}/index.html from articles/content/*.md and articles/post-template.html,
 * fills the card grid in public/article/index.html and the article URLs in public/sitemap.xml.
 * Run: node scripts/build-articles.js
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const root = path.join(__dirname, '..');
const contentDir = path.join(root, 'articles', 'content');
const templatePath = path.join(root, 'articles', 'post-template.html');
const articleRoot = path.join(root, 'public', 'article');
const articlesJsonPath = path.join(articleRoot, 'articles.json');
const sitemapPath = path.join(root, 'public', 'sitemap.xml');

const RESERVED_ARTICLE_DIRS = new Set();

marked.setOptions({
    gfm: true,
    breaks: false,
});

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
    return escapeHtml(str);
}

function parseFrontMatter(raw) {
    if (!raw.startsWith('---')) {
        throw new Error('Missing YAML front matter (file must start with ---)');
    }
    const end = raw.indexOf('\n---', 3);
    if (end === -1) {
        throw new Error('Unclosed front matter block');
    }
    const fmBlock = raw.slice(3, end).trim();
    const body = raw.slice(end + 4).replace(/^\n/, '');

    const meta = {};
    for (const line of fmBlock.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colon = trimmed.indexOf(':');
        if (colon === -1) continue;
        const key = trimmed.slice(0, colon).trim();
        let value = trimmed.slice(colon + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (value === 'true') meta[key] = true;
        else if (value === 'false') meta[key] = false;
        else if (/^\d+$/.test(value)) meta[key] = Number(value);
        else meta[key] = value;
    }
    return { meta, body };
}

function fillTemplate(template, vars) {
    let out = template;
    for (const [key, value] of Object.entries(vars)) {
        out = out.split(`{{${key}}}`).join(value);
    }
    if (/\{\{[A-Z_]+\}\}/.test(out)) {
        throw new Error('Template has unfilled placeholders');
    }
    return out;
}

function loadMarkdownFiles() {
    if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true });
        return [];
    }
    return fs
        .readdirSync(contentDir)
        .filter((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md')
        .map((name) => path.join(contentDir, name));
}

function validateMeta(meta, fileLabel) {
    const slug = meta.slug;
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new Error(`${fileLabel}: front matter "slug" must be a lowercase kebab-case id`);
    }
    for (const req of ['title', 'description', 'deck', 'category', 'date']) {
        if (!meta[req]) {
            throw new Error(`${fileLabel}: missing front matter "${req}"`);
        }
    }
    if (meta.readMinutes == null) meta.readMinutes = 5;
    if (meta.published == null) meta.published = true;
    if (meta.featured == null) meta.featured = false;
    return meta;
}

function updateSitemap(slugs) {
    if (!fs.existsSync(sitemapPath)) return;
    let xml = fs.readFileSync(sitemapPath, 'utf8');
    const startMarker = '    <!-- article:build:start -->';
    const endMarker = '    <!-- article:build:end -->';
    const startIdx = xml.indexOf(startMarker);
    const endIdx = xml.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        console.warn('build-articles: sitemap markers missing — skipped sitemap update');
        return;
    }
    const blocks = slugs.map((slug) => {
        return [
            '    <url>',
            `        <loc>https://poprtp.com/article/${slug}/</loc>`,
            '        <changefreq>monthly</changefreq>',
            '        <priority>0.75</priority>',
            '    </url>',
        ].join('\n');
    });
    const inner = blocks.length ? '\n' + blocks.join('\n') + '\n    ' : '\n    ';
    xml =
        xml.slice(0, startIdx + startMarker.length) +
        inner +
        xml.slice(endIdx);
    fs.writeFileSync(sitemapPath, xml);
}

function renderHubCard(article) {
    return [
        `<a class="article-card" href="${escapeAttr(article.slug)}/">`,
        '                    <div class="article-card-meta">',
        `                        <span class="article-card-category">${escapeHtml(article.category)}</span>`,
        '                    </div>',
        `                    <h2 class="article-card-title">${escapeHtml(article.title)}</h2>`,
        `                    <p class="article-card-excerpt">${escapeHtml(article.excerpt)}</p>`,
        '                </a>',
    ].join('\n');
}

function updateArticleHub(articles) {
    const hubPath = path.join(articleRoot, 'index.html');
    const startMarker = '<!-- article:grid:start -->';
    const endMarker = '<!-- article:grid:end -->';
    let html = fs.readFileSync(hubPath, 'utf8');
    const startIdx = html.indexOf(startMarker);
    const endIdx = html.indexOf(endMarker);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
        throw new Error('build-articles: article/index.html missing article:grid markers');
    }
    const published = articles.filter((a) => a.published !== false);
    const gridInner = published.length
        ? '\n' + published.map(renderHubCard).join('\n') + '\n'
        : '\n';
    html =
        html.slice(0, startIdx + startMarker.length) +
        gridInner +
        html.slice(endIdx);
    html = html.replace(
        /<p class="article-empty" id="articleEmpty"(\s+hidden)?>/,
        published.length
            ? '<p class="article-empty" id="articleEmpty" hidden>'
            : '<p class="article-empty" id="articleEmpty">'
    );
    fs.writeFileSync(hubPath, html);
}

function removeStaleArticleDirs(activeSlugs) {
    if (!fs.existsSync(articleRoot)) return;
    for (const name of fs.readdirSync(articleRoot)) {
        if (RESERVED_ARTICLE_DIRS.has(name)) continue;
        const full = path.join(articleRoot, name);
        if (!fs.statSync(full).isDirectory()) continue;
        if (!activeSlugs.has(name)) {
            fs.rmSync(full, { recursive: true, force: true });
            console.log('build-articles: removed stale', name);
        }
    }
}

function run() {
    const template = fs.readFileSync(templatePath, 'utf8');
    const files = loadMarkdownFiles();
    const articles = [];
    const activeSlugs = new Set();

    for (const filePath of files) {
        const fileLabel = path.relative(root, filePath);
        const raw = fs.readFileSync(filePath, 'utf8');
        const { meta, body } = parseFrontMatter(raw);
        validateMeta(meta, fileLabel);

        const slug = meta.slug;
        activeSlugs.add(slug);

        let bodyHtml = marked.parse(body.trim());
        bodyHtml = bodyHtml
            .split('\n')
            .map((line) => (line.trim() ? '                    ' + line : line))
            .join('\n')
            .trim();

        const html = fillTemplate(template, {
            TITLE_HTML: escapeHtml(meta.title),
            TITLE_ESC: escapeAttr(meta.title),
            DESCRIPTION_ESC: escapeAttr(meta.description),
            SLUG: slug,
            CATEGORY: escapeHtml(meta.category),
            CATEGORY_UPPER: escapeHtml(String(meta.category).toUpperCase()),
            DECK: escapeHtml(meta.deck),
            BODY_HTML: bodyHtml,
        });

        const outDir = path.join(articleRoot, slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), html);

        articles.push({
            slug,
            title: meta.title,
            excerpt: meta.description,
            category: meta.category,
            readMinutes: meta.readMinutes,
            date: meta.date,
            featured: meta.featured === true,
            published: meta.published !== false,
        });
    }

    articles.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    fs.writeFileSync(articlesJsonPath, JSON.stringify(articles, null, 2) + '\n');
    updateArticleHub(articles);

    removeStaleArticleDirs(activeSlugs);
    updateSitemap(
        articles.filter((a) => a.published).map((a) => a.slug)
    );

    console.log(
        'build-articles: wrote',
        articles.length,
        'article(s) → public/article/{slug}/index.html, articles.json, hub grid, sitemap'
    );
}

run();
