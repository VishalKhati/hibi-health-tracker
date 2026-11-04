# Hibi — day by day

Hibi (日々) is a private, offline-first health tracker designed for quick daily use on a phone. It runs as an installable Progressive Web App and keeps data on the device.

## Features

- Today dashboard for calories, protein, steps, water, movement, and supplements
- Food logging with reusable saved foods and meal grouping
- Photo calorie estimates: snap a meal, an AI model (Google Gemini's free tier by default, or Claude) identifies each food and estimates grams, calories and protein, and you review and edit every item before it's logged
- Food search for Indian and everyday foods: Google Gemini returns cooked-food values based on the Indian Food Composition Tables (IFCT 2017, NIN) and USDA data, with household servings like "1 medium roti"
- Barcode scanning backed by [Open Food Facts](https://world.openfoodfacts.org), with portion sizes in grams or labelled servings
- Walk, run, gym, and custom activity logs, with calories burned estimated from body weight and pace when left blank
- Supplement schedules with taken/skipped states
- Body screen: weight log, weight trend chart with a 7-day moving average, BMI, and daily calorie needs
- Suggested calorie, protein, and water goals from your body profile
- Seven-day totals, averages, and consistency, plus streaks and a monthly goals calendar
- Push reminders for water (at an interval you choose) and for each supplement at its scheduled time, with **+1 glass** and **Taken** buttons on the notification
- Light, dark, and system themes
- JSON backup export and import (older backups are upgraded on import)
- Offline app shell and home-screen installation

Calories eaten and estimated calories burned are intentionally shown separately.

## Health calculations

All formulas live in `src/utils/health.ts` and are covered by unit tests.

| Value | Method |
| --- | --- |
| BMI | kg / m², WHO adult bands (18.5 / 25 / 30) |
| Resting energy (BMR) | Mifflin-St Jeor equation |
| Daily energy (TDEE) | BMR × activity multiplier (1.2–1.9) |
| Protein target | 1.2 g/kg, or 1.6 g/kg when moderately active or more |
| Water target | 35 ml/kg, shown in 250 ml glasses |
| Calories burned | MET × kg × hours, with MET values from the 2011 Compendium of Physical Activities, chosen by pace for walks and runs |
| Weight trend | Average of all weigh-ins in the trailing 7 days |

These are population estimates for adults and are not medical advice.

## Food data and barcodes

Barcode scans check products remembered on the device, then products Hibi users added from labels (`products` function), then the Open Food Facts API (data under the Open Database License). When none has the product, Hibi offers to read the pack's nutrition label from a photo. Text search goes through the `food-search` function, which sends only the search words to Gemini and caches each answer for 30 days, so repeat searches are instant and use no quota. Open Food Facts' own search was dropped: it is rate-limited, often unavailable, and has few Indian home-cooked dishes.

Barcode scanning uses the browser's built-in `BarcodeDetector` where it supports retail barcodes (Chrome on Android). Elsewhere, including iOS Safari, a ZXing WebAssembly decoder is loaded on demand from the app's own origin. The camera requires HTTPS; a typed barcode number always works as a fallback.

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown by Vite. On a phone, use the browser's **Add to Home Screen** or **Install app** action.

## Server functions

Hibi is still a static, offline-first app; six small Netlify Functions add the online features:

| Function | Route | Purpose |
| --- | --- | --- |
| `analyze-meal` | `GET/POST /api/analyze-meal` | Sends a resized meal photo to Gemini (`gemini-3.8-flash`, JSON-schema output) or Claude (`claude-opus-5-5`, structured output) and returns an editable list of foods. Capped per visitor (IP) per day; falls back to `gemini-3.5-flash` when Google reports high demand. `GET` reports which service is configured so the app can tell users where photos go. |
| `food-search` | `GET /api/food-search?q=` | Asks Gemini (`gemini-3.5-flash`, falling back to `gemini-3.5-flash-lite`) for up to 6 matching foods with kcal and protein per 100 g and a typical serving. Answers are cached in Netlify Blobs for 30 days; new searches are capped per visitor per day. |
| `read-label` | `POST /api/read-label` | Reads the per-100 g values off a photo of a pack's nutrition table with Gemini (`gemini-3.5-flash-lite`, falling back to `gemini-3.5-flash`). The person checks every value before it's used. Capped per visitor per day. |
| `products` | `GET/PUT /api/products/:code` | Products people confirmed from their labels, shared by barcode in Netlify Blobs so the next scan finds them. Values are validated; writes are capped per visitor per day. |
| `reminders` | `GET/PUT/DELETE /api/reminders` | Stores a device's push subscription, time zone and reminder schedule in Netlify Blobs. |
| `send-reminders` | scheduled, every 5 minutes | Sends reminders that fell due since the last run, in each device's own time zone. |

Only reminder times and supplement names are stored server-side. Food logs, weights and everything else stay on the device. Photos are not stored.

### Configuration

Run once after linking the repo to a Netlify site (`npx netlify-cli login`, `npx netlify-cli link`):

```bash
npm run setup:netlify
```

It generates push (VAPID) keys (keeping existing ones on re-runs), asks for a Gemini API key and optionally an Anthropic key with hidden input, saves them as Netlify environment variables, and starts a fresh deploy.

Anyone with the link can use search and photo estimates, within a daily allowance per visitor, so one person can't use up the free Gemini quota. Keep the Gemini key on Google's free tier (no billing account), so heavy use can only hit the quota, never a bill. Everyone's food logs stay on their own device.

| Variable | Used for |
| --- | --- |
| `GEMINI_API_KEY` | Food search and photo estimates with Gemini (free tier from Google AI Studio; Google may use free-tier content to improve its products, which the app discloses) |
| `GEMINI_MODEL` | Optional first choice for photos, default `gemini-3.8-flash` |
| `GEMINI_SEARCH_MODEL` | Optional first choice for search, default `gemini-3.5-flash` |
| `ANTHROPIC_API_KEY` | Optional paid alternative for photos; used when no Gemini key is set |
| `HIBI_DAILY_PHOTO_LIMIT` | Optional, default 40 photo estimates per visitor per day |
| `HIBI_DAILY_SEARCH_LIMIT` | Optional, default 150 new (uncached) searches per visitor per day |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Signing push notifications |

Push notifications work in Chrome/Edge/Firefox and, on iPhone, once Hibi is added to the Home Screen (iOS 16.4+).

## Tests

```bash
npm test
```

Unit tests cover the health formulas, streaks, date helpers, backup validation, the food search and Open Food Facts clients, the reminder scheduler (time zones, DST, lookback cap), and the server functions with in-memory Blobs.

## Production build

```bash
npm run build
npm run preview
```

The production build is written to `dist/`. PWA installation requires HTTPS in production (localhost is allowed during development). The dev server does not register the service worker, so test installation and offline mode with `npm run build && npm run preview`.

## Deploying and installing

`dist/` is a static site: upload it to any HTTPS host (Netlify Drop, Vercel, Cloudflare Pages, nginx). To serve it under a sub-path instead of the domain root, build with the base path:

```bash
HIBI_BASE=/hibi/ npm run build
```

The manifest, icons, shortcuts, and service worker all follow that base.

Installing works like any PWA:

- **Android / desktop Chrome and Edge:** the in-app **Install** button (Today banner or Settings), or the browser's **Install app** menu item. Long-press the installed icon for **Log food** and **Log weight** shortcuts.
- **iPhone / iPad:** open the site in Safari, tap **Share**, then **Add to Home Screen**. The app shows these steps itself on iOS.

The manifest ships PNG icons (192/512, plus maskable variants), an Apple touch icon, and screenshots that Chrome uses for its richer install dialog.

## Data and privacy

Hibi stores entries in browser local storage. Only these leave the device: search words (sent to Gemini through the `food-search` function), barcode lookups (Open Food Facts), meal photos you choose to analyze (sent to Gemini or Claude through the `analyze-meal` function, not stored), and reminder schedules if you turn reminders on. Browser data can be cleared by the operating system or user, so the Settings screen provides backup export/import from the first release.

## Later Android path

Once the daily flow has been field-tested, the web build can be wrapped with Capacitor. Android Health Connect can then supply steps and supported workout data without changing the main Vue interface.
