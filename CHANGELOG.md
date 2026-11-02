# Changelog

The version shown in Settings → About comes from `package.json`. To release, run
`npm version minor` (new features) or `npm version patch` (fixes), add a section here, and push
with `git push --follow-tags`.

## v2.1 — 2026-11-02

- "New version of Hibi ready · Update" banner when an update has downloaded, instead of reloading
  on its own in the middle of an entry. Settings → About has a "Check for updates" button.
- The Reminders card explains when the server isn't set up yet, instead of offering a switch that
  can't turn on.
- Release names (v2.1) in Settings instead of build ids.

## v2.0 — 2026-11-02

- Photo calorie estimates: snap a plate, review and edit every detected food (grams rescale
  calories and protein), then log. Uses Google Gemini's free tier, with Claude as an optional
  fallback.
- Access codes for photo estimates, one per person, each with its own daily limit.
- Push reminders for water (time window and interval) and supplements (by schedule), even when
  Hibi is closed. Notification buttons log a glass of water or mark a supplement taken.
- The installed app checks for updates hourly and whenever it comes back to the screen.

## v1.0 — 2026-09-28

- Daily tracking for food, activity, water, supplements and weight, stored only on the device.
- Body metrics: BMI, BMR, daily calorie needs and a weight trend chart.
- Food search with Open Food Facts and barcode scanning.
- Streaks, a monthly heatmap and progress charts.
- Light and dark themes.
- Installable app (PWA) with offline support, shortcuts and backup export/import.
