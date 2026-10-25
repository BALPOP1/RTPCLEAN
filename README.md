# POP RTP

Live RTP monitor for slot games (poprtp.com). Express serves a small API plus the static site in `public/`.
RTP values are deterministic: they come from the São Paulo time (3‑minute blocks) and the game id, so every visitor sees the same numbers.

See [KEPT-AND-REMOVED.md](KEPT-AND-REMOVED.md) for what changed compared to the old `NEW/` site.

## Run locally

```bash
npm install
npm start            # builds JS + articles, then serves http://localhost:3000
PORT=3001 npm start  # other port (PowerShell: $env:PORT=3001; npm start)
```

`npm start` runs `npm run build` first (the `prestart` script).

## Folder layout

```
server.js               Express: /api/games, /api/bootstrap, /api/ui-config + static public/
server/lib/
  rtp-engine.js         RTP + multiplier generator (do not change — defines the RTP mechanism)
  popularity.js         game priority (FORTUNE / POPULAR / DESTAQUE)
  build-games.js        scans public/images/<provider>/ and builds the games payload
  ui-config.js          loads data/ui-config.json with defaults
data/
  platforms.json        platform list: id, name, url, status
  providers.json        provider names, labels, folder, order
  provider-images.json  optional image order per provider
  ui-config.json        links, hot hours, sinal games, mobile strip, alert platform, winner count, hosts
src/                    client JS sources (bundled by esbuild into public/dist/)
  app.js                timer, RTP refresh, grid, provider filter, carousels, platform modal, popups
  live.js               online counter, live ticker, mobile platform strip
  retention.js          Horário Quente, Sinal do Dia, Ganhos, RTP alert, winners gallery, host check
articles/
  content/*.md          article sources (front matter + Markdown)
  post-template.html    page template for articles
scripts/
  build-client.js       src/*.js → public/dist/*.min.js
  build-articles.js     articles → public/article/<slug>/, hub grid, sitemap
  export-static.js      writes public/data/*.json for hosting without Node
public/                 everything the browser can load
  index.html, jogo-responsavel.html, article/index.html
  css/styles.css        the only stylesheet
  js/bootstrap.js       loads config from the API, then the bundles
  images/<provider>/    game thumbnails (the folder IS the game list)
  asset/, banner/, sidebanner/, tg/
```

Generated (git-ignored): `public/dist/`, `public/article/<slug>/`, `public/article/articles.json`, `public/data/`.

## Common edits

**Change a platform link or add a platform** — edit `data/platforms.json`:

```json
{ "id": 32, "name": "PopNew", "url": "https://..." }
```

- The modal shows platforms in file order; the first one is featured.
- The logo is `public/asset/<id>.png` (300×100).
- Use `"status": "soon"` (and `"url": "#"`) for "EM BREVE".
- Any element with `data-platform-id="<id>"` in the HTML gets that platform's URL.

**Telegram / WhatsApp / PopSorte links** — `links` in `data/ui-config.json`. Elements with `data-link="telegram"` etc. pick them up.

**Mobile strip** — `mobileStrip` in `data/ui-config.json` (5 entries: platform id, name, square image, long image).

**RTP alert target** — `rtpAlertPlatformId` in `data/ui-config.json`.

**Winners** — put `a (N).webp` files in `public/asset/winner/` and set `winnerCount`.

**Add games** — drop images into `public/images/<provider folder>/`. The file name becomes the game name. To add a provider, also add it to `data/providers.json`.

**New article** — copy one of the files in `articles/content/` (front matter: `slug`, `title`, `description`, `deck`, `category`, `date`, `readMinutes`, `published`), then run `npm run build:articles`.

**3D logo ball (right gutter)** — the scene is `src/orb.gss`, written in [GSS](https://www.npmjs.com/package/gss-lang) (GPU Style Sheets). It is compiled at build time, so the browser only loads the small runtime.
- It shows only on screens at least 1360px wide, and is skipped when the user prefers reduced motion or the device has no GPU.
- The ball cycles through the platform logos. There are nine logo spheres in one spot, and the `swap` keyframes show each for one slot (3.5s).
- To add or remove a logo, change the sphere list and the `animation` duration (logos × 3.5s). Set each `animation-delay` to minus its slot start, and scale the `swap` percentages to one slot (100% ÷ logos).
- GSS always draws an opaque canvas, so the scene renders on black and the `#gssKey` SVG filter in `index.html` turns brightness into transparency. Keep the scene background `#000`.
- Logos are 512×512 tiles in `public/asset/orb/<platform id>.png`: the platform logo, 410px wide and 40px above centre, on a pastel square. A ball's `color` must equal its tile's background so the edge of the logo face doesn't show.

Changes to `data/*.json` need a server restart; changes to `src/` need `npm run build:client`.

## Deploy (Railway)

`railway.toml` runs `npm run build` and starts `node server.js`. Railway sets `PORT`.
Optional env var `CDN_BASE`: serve game images from a CDN (the paths stay the same).

## Static hosting (no Node)

```bash
npm run export:static
```

This writes `public/data/` (games payload for the current block, platforms, providers, ui-config).
To use it, change the script in `public/index.html` to `js/bootstrap-static.js` and upload `public/`.
Note: with static hosting the RTP values only change when you re-export. Use the Node server for live RTP.
