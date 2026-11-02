# Hibi — day by day

Hibi (日々) is a private, offline-first health tracker designed for quick daily use on a phone. It runs as an installable Progressive Web App and keeps data on the device.

## Features

- Today dashboard for calories, protein, steps, water, movement, and supplements
- Food logging with reusable saved foods and meal grouping
- Photo calorie estimates: snap a meal, Claude identifies each food and estimates grams, calories and protein, and you review and edit every item before it's logged
- Food search and barcode scanning backed by [Open Food Facts](https://world.openfoodfacts.org), with portion sizes in grams or labelled servings
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

Search and barcode lookups call the Open Food Facts API directly from the browser; nothing else leaves the device. Search is rate-limited by Open Food Facts to roughly 10 requests a minute, so Hibi only searches when you submit. Food data is available under the Open Database License.

Barcode scanning uses the browser's built-in `BarcodeDetector` where it supports retail barcodes (Chrome on Android). Elsewhere, including iOS Safari, a ZXing WebAssembly decoder is loaded on demand from the app's own origin. The camera requires HTTPS; a typed barcode number always works as a fallback.

## Run locally

```bash
npm install
npm run dev
```

Open the local address shown by Vite. On a phone, use the browser's **Add to Home Screen** or **Install app** action.

## Server functions

Hibi is still a static, offline-first app; three small Netlify Functions add the online features:

| Function | Route | Purpose |
| --- | --- | --- |
| `analyze-meal` | `POST /api/analyze-meal` | Sends a resized meal photo to Claude (`claude-opus-5-5`, structured output) and returns an editable list of foods. Requires the access code; capped per day. |
| `reminders` | `GET/PUT/DELETE /api/reminders` | Stores a device's push subscription, time zone and reminder schedule in Netlify Blobs. |
| `send-reminders` | scheduled, every 5 minutes | Sends reminders that fell due since the last run, in each device's own time zone. |

Only reminder times and supplement names are stored server-side. Food logs, weights and everything else stay on the device. Photos are not stored.

### Configuration

Run once after linking the repo to a Netlify site (`npx netlify-cli login`, `npx netlify-cli link`):

```bash
npm run setup:netlify
```

It generates push (VAPID) keys and an access code, asks for an Anthropic API key with hidden input, saves them as Netlify environment variables, and starts a fresh deploy.

| Variable | Used for |
| --- | --- |
| `ANTHROPIC_API_KEY` | Photo estimates |
| `HIBI_ACCESS_CODE` | Required by the app to request photo estimates, so the public site can't spend your API credit |
| `HIBI_DAILY_PHOTO_LIMIT` | Optional, default 60 per day |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Signing push notifications |

Push notifications work in Chrome/Edge/Firefox and, on iPhone, once Hibi is added to the Home Screen (iOS 16.4+).

## Tests

```bash
npm test
```

Unit tests cover the health formulas, streaks, date helpers, backup validation, the Open Food Facts client, the reminder scheduler (time zones, DST, lookback cap), and the server functions with in-memory Blobs.

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

Hibi stores entries in browser local storage. Only these leave the device: food search and barcode lookups (Open Food Facts), meal photos you choose to analyze (sent to Claude through the `analyze-meal` function, not stored), and reminder schedules if you turn reminders on. Browser data can be cleared by the operating system or user, so the Settings screen provides backup export/import from the first release.

## Later Android path

Once the daily flow has been field-tested, the web build can be wrapped with Capacitor. Android Health Connect can then supply steps and supported workout data without changing the main Vue interface.
