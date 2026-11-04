# Changelog

The version shown in Settings → About comes from `package.json`. To release, run
`npm version minor` (new features) or `npm version patch` (fixes), add a section here, and push
with `git push --follow-tags`.

## v2.3 — 2026-11-03

- Carbs, fat and fibre alongside calories and protein. Search, barcode, photo estimates and
  "New" entries all fill them in (optional for manual entries), and photo items rescale them
  when you change the grams.
- Food screen: a "Today’s breakdown" panel with grams of protein, carbs, fat and fibre, and how
  your calories split between protein, carbs and fat. Each food row lists its carbs and fat.
- Foods logged before this version keep only calories and protein; the breakdown says so when
  they make the day's totals partial.
- Barcodes that aren't found can be added by photographing the pack's nutrition label. Gemini
  reads the per-100 g values that Indian labels must print (FSSAI Labelling and Display
  Regulations, 2020), and you check them before using them. "Read a label" also works for packs
  without a barcode.
- Scanned products are remembered on the device, so a repeat scan is instant and works offline.
  Products added from labels can be shared, so other Hibi users' scans find them too. Scans
  check this device, then shared products, then Open Food Facts.

## v2.2 — 2026-11-03

- Food search now works for Indian food. Searching "roti" or "paneer butter masala" returns cooked-food
  values based on the Indian Food Composition Tables (IFCT 2017, NIN) and USDA data, with household
  servings such as "1 medium roti" and a one-tap "2 ×" portion. Results come from Google Gemini and
  are cached, so repeat searches are instant. Open Food Facts is still used for barcodes.
- Photo estimates no longer ask for an access code. Each visitor gets a daily allowance instead.
- Photo estimates and search switch to another Gemini model when Google reports high demand,
  instead of failing.
- Water: a − button next to "Add glass" removes a glass logged by mistake.
- Settings → Your data → Reset all data starts Hibi fresh, with default goals and quick foods. Theme
  and reminder settings are kept.
- Clearer iPhone install steps for newer Safari, where Share sits inside the ⋯ or ≡ menu.

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
