# What was kept and what was removed

This repository is a clean rebuild of the POP RTP site that lived in `NEW/`.
`NEW/` was not modified; everything here was rewritten or copied selectively.

## Size, before and after

| | `NEW/` | `poprtp-clean/` |
|---|---|---|
| Files (excluding `node_modules`) | 1,174 | ~1,090 |
| Size on disk | 73.5 MB | 52.3 MB |
| CSS | 3 files, ~9,700 lines (layer upon layer of overrides) | 1 file, mobile-first |
| Main page HTML | 776 lines | 338 lines |
| Client JS | `script.js` 1,436 + `loading-features.js` 808 + `retention.js` 875 + `animations.js` + `snow.js` + config files | `src/app.js` 588 + `src/live.js` 309 + `src/retention.js` 366 |

## The RTP mechanism — kept unchanged

The RTP numbers are generated exactly as before, so both sites show the same RTP for the same game in the same 3‑minute window.

- `server/lib/rtp-engine.js`: copied byte-for-byte. The seed is São Paulo time rounded to the 3‑minute block plus a hash of the game id. RTP stays in the 30–99 range, with the same multipliers.
- `server/lib/popularity.js`: copied byte-for-byte.
- `server/lib/build-games.js`: copied; the only change is the images folder path (now `public/images`).
- `/api/games` returns the same payload shape. This was verified: 620 games, with identical `id`, `path`, `priority`, `rtp`, `multiplier` and `timeSeed` compared to `NEW/`.
- Client cycle: the same 3‑minute countdown. When the 3‑minute block changes, the client calls `refreshRTPFromServer()` and re-renders.
- `window.generateRandomRTP` and `window._allGames` are still shared between bundles.

## Features kept

| Area | Kept |
|---|---|
| Core | Header with online counter + clock (the separate top status bar was merged into it; next‑update time is on the timer card, game count on the provider filter), 3‑minute timer + progress, main banner carousel (swipe, dots, autoplay), provider filter, games grid + "load more", platform selection modal, footer |
| Mobile | 5‑slot platform strip (centre slot is the long banner, rotating every 4 s) |
| Desktop | Side banner carousel, "Ganhos de Hoje" panel in the timer column |
| Info strips | Live activity ticker, Horário Quente, Sinal do Dia, Ganhos de Hoje |
| Social proof | Winners gallery (auto-scroll, arrows, lightbox) |
| Popups | PopSorte (on entry and once more after 3 min), POPJUN launch, RTP Alert |
| Floating | One action dock — Telegram, WhatsApp, timer (opens platform modal), PopSorte, 18+ — as a centred pill on desktop and a bottom bar on mobile |
| Pages | Jogo Responsável, article hub + 6 articles (Markdown build) |
| Ops | Railway deploy (`railway.toml`), `CNAME`, static export option, Google Analytics tag, JSON‑LD |

## Features removed

| Removed | Why |
|---|---|
| Snow effect (`snow.js`), terminal/matrix background, Orbitron/"hacker" styling | Visual noise; replaced by the Light/Navy theme |
| `animations.js` | Decorative only |
| Toast notifications, Telegram "FOMO" popups, "viewer" badges on cards | Pop-up spam |
| Official warning popup | Duplicated the footer / Jogo Responsável page |
| Lucky number, favourites | Low value, lots of code |
| PopJogos section | Not in the kept list |
| Uptime / SYNC indicators, console log panel, "last refresh" text | Fake telemetry |
| Multi-slide logic in the launch popup | Only one slide was ever used |
| Obfuscated host check inside the online counter | Replaced by a readable, config-driven `enforceHost` (`allowedHosts`, `redirectIfHostNotAllowed` in `data/ui-config.json`) |
| Reference to a missing `protect.js` | File did not exist (404) |
| `platforms-config.js`, `config-example.js`, `game-data.js`, `provider_image_lists.js`, `game_popularity.js` (browser copies) | Data now lives only in `data/*.json` and is served by the API |
| `scripts/build-data.js` (eval of JS config files) | No longer needed — JSON is the source of truth |
| `index-cdn-template.html`, `script-cdn-template.js` | CDN is now one env var (`CDN_BASE`) |
| `get_images.php`, `BOTSCTRIPT.py`, `truncate_styles.py`, `requirements.txt`, `__pycache__/`, `trial/`, `domain/` | Unused tooling / experiments |
| `VARIATIONS-GUIDE.md`, `NEW-PLATFORM-LAUNCH.md` | Replaced by `README.md` |
| Unreferenced images in `asset/`, `banner/`, `sidebanner/` | Only files the site actually uses were copied (≈21 MB saved) |
| Multiple font families | Inter only |

## Bugs fixed along the way

- The provider menu showed a hard-coded "[623]" game count, but the real count is 620. Counts are now computed from the loaded games.
- If `/api/games` failed, the whole UI stopped initialising (no timer, no popups). The UI now starts first and the games load independently.
- The canonical URL `/jogo-responsavel` returned 404 on the Express server. It now resolves via `extensions: ['html']`.

## Structure changes

```
NEW/ (everything in the web root)            poprtp-clean/
├── index.html, script.js, styles.css …   →  public/        only files served to browsers
├── images/, asset/, banner/ …            →  public/…       (only referenced files)
├── platforms-config.js + build-data.js   →  data/*.json    single source of truth
├── server/                               →  server/lib/    RTP engine, unchanged
├── article/content, article/_templates   →  articles/      sources, NOT served
└── script.js, loading-features.js …      →  src/           built by esbuild → public/dist/
```

Source files (`src/`, `articles/`, `data/`, `server/`) are no longer publicly downloadable. Before, the whole repo root was the web root.

## Deviations from the plan

- The client JS sources are in `src/` (not `public/js/`) so the unminified source is not served. `public/js/` contains only the two small loader scripts (`bootstrap.js`, `bootstrap-static.js`).
- Article sources live in the top-level `articles/` folder instead of `public/article/content/`.
