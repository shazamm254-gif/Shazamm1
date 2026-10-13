# POD Type Studio

A phone-first web app for designing **typographic** print-on-demand artwork and
pushing it **straight into Printify** as a draft product, then publishing it
with one confirmed tap. No desktop software and no manual PNG upload.

**The flow:** type words → style them → preview on a shirt color → push to
Printify as a **draft** → check the real mockups → **Publish** (behind a confirm).

- Zero npm dependencies. One Node.js server (Node 18+) serves the editor and is
  the only thing that ever talks to Printify.
- Works by touch alone on Android Chrome. Nothing depends on hover or a keyboard
  shortcut.
- Fonts are Google Fonts only, which are all free for commercial use.

---

## 1. Run it on your Android phone (free)

The simplest zero-cost setup runs the server on the phone itself with **Termux**.

1. Install **Termux** from F-Droid (the Play Store version is outdated).
2. In Termux:
   ```sh
   pkg update && pkg install nodejs git
   git clone https://github.com/shazamm254-gif/Shazamm1.git
   cd Shazamm1/pod-type-studio
   termux-wake-lock        # keeps the server alive while the screen is off
   npm start
   ```
3. Open Chrome on the same phone and go to **http://localhost:8080**.
4. Optional: Chrome menu → **Add to Home screen** gives it an app icon.

Next time, just open Termux and run `cd Shazamm1/pod-type-studio && npm start`.

> **Hosting it online instead** (Render, Railway, a VPS, …): set the start command
> to `npm start`, and set these environment variables on the host:
> `APP_PASSCODE` (required, so nobody else can use your Printify connection),
> `PRINTIFY_API_TOKEN`, and `DATA_DIR` pointing at a persistent disk if the host
> has one. Free tiers often wipe their disk on restart. Your designs are safe
> either way because they live on your phone, but the "Pushed" history and
> publish-from-app for older drafts are stored on the server.

## 2. Where the Printify token goes

1. In Printify: **profile → Connections → Personal Access Token → Generate**.
   Give it the scopes `shops.read`, `catalog.read`, `products.read`,
   `products.write`, `uploads.read`, `uploads.write`.
2. In the app: **Settings → Printify connection**. Paste the token and tap
   **Connect Printify**.

What happens to the token:

- The server checks it against Printify first, then saves it **server-side** in
  `pod-type-studio/data/settings.json`. That file has owner-only permissions and
  is git-ignored. Alternatively, set the `PRINTIFY_API_TOKEN` env var, which
  takes priority.
- It is **never** sent back to the browser, shown again (you only see
  "✓ Connected"), logged, or included in any export.
- The browser only ever talks to this app's server, never to Printify.

The first time you open the app, it asks you to choose a **passcode** that locks
the app. On a hosted server, set `APP_PASSCODE` instead. First-time setup is
only allowed from the phone running the server.

## 3. The exact flow

1. **Designs → + New design.** Pick one of the 6 starting layouts (or a blank
   canvas). Templates contain placeholder text only ("YOUR WORDS HERE"), so you
   always write your own words.
2. **Pick the product** (first time only; remembered after that). The app finds
   **Bella+Canvas 3001** in the live Printify catalog by name, or you can search
   the catalog. Then choose a print provider. The **real print area** from
   Printify's API is shown (e.g. 4500×5100 px), and the canvas resizes to it.
3. **Design.** Tap **Text** to add words, then use the tabs under the canvas:
   - **Text:** your words, size, letter spacing, line height, alignment, ALL CAPS
   - **Font:** any Google Font (searchable, each name shown in its own typeface).
     Only weights and italics the font really ships are offered. Nothing is
     faked.
   - **Style:** solid, gradient, or two-color split fill; outline; drop shadow
   - **Arch:** arch up or arch down, with an adjustable curve
   - **Arrange:** rotate, opacity, center, layer order, duplicate, delete

   Drag layers with one finger; they snap to the center lines. The blue dot
   resizes. Drag empty space to pan, pinch or use the **− / + / Fit** buttons to
   zoom. **Shirt** previews the art on garment colors (preview only, since the
   PNG stays transparent). **Shape** adds a line, rectangle, or circle/ring to
   frame your type. Undo and redo are at the top. Orange **warnings** flag art
   outside the safe area or text too small to read in print. They never block
   you.
4. **Publish** (top right):
   1. **Shop:** your real shops; the last one is remembered.
   2. **Colors & sizes:** live from Printify, with your usual colors pre-ticked
      (Black/White/Navy by default; "Save ticked colors as my usual" changes that).
   3. **Title** (required), **description** (editable default), and **price**
      (default $24.99).
   4. **Artwork:** the export is shown at the exact print-area size with a
      transparent background. **Download PNG** is the manual-upload fallback.
   5. **Create DRAFT in Printify:** uploads the PNG, then creates the product as
      a **draft**.
5. **Draft screen:** the real Printify mockups, plus each variant's **cost and
   margin**, shown only when Printify reports cost (it does once the draft
   exists). Nothing is invented.
6. **Publish…** → "Publish this product live?" → **Publish**. The live listing
   link appears once your sales channel confirms. **Open in Printify** is always
   there.
7. **Pushed** (bottom tab) lists everything this app created, as draft or
   published, with links.

Back up a design from its **⋯ menu → Export .json**. Use **Import .json** on the
Designs screen to restore it.

## Safety rails

- Nothing goes live from one tap. Publishing is a separate step behind a confirm
  dialog.
- The app only **creates** products. It never deletes or edits existing
  Printify products, and it will only publish products it created itself.
- Publishing is blocked only when the canvas is empty or the title is missing.
  Everything else is a warning.
- Errors show a plain-language message, with the raw Printify response in a
  collapsible **Technical details** block. Token values are redacted from it.

## Settings reference (env vars)

| Variable | Purpose |
|---|---|
| `PORT` / `HOST` | Listen address. Default `127.0.0.1:8080`; when `PORT` is set, `HOST` defaults to `0.0.0.0` |
| `PRINTIFY_API_TOKEN` | Printify token (overrides the one saved in Settings) |
| `APP_PASSCODE` | App passcode (required on any public host) |
| `DATA_DIR` | Where server-side state lives (default `./data`) |
| `GOOGLE_FONTS_API_KEY` | Optional: load the font list from the official Google Fonts API. Otherwise it comes from fonts.google.com, with a bundled snapshot as an offline fallback |
| `PRINTIFY_PRODUCT_URL_TEMPLATE` | Link format for "Open in Printify" (default `https://printify.com/app/editor/{productId}`; `{shopId}` is also available) |

## How it is built

```
server.js              routes, auth gate, static files, security headers
server/printify.js     Printify REST client (token only in the auth header; errors redacted)
server/product.js      default-product lookup by name, print-area grouping, create-product payload
server/store.js        server-side JSON store (settings, token, history), 0600 files
server/auth.js         passcode (scrypt) + HttpOnly session cookie
server/fonts.js        Google Fonts family list, cached a week
public/js/render.js    THE renderer: used for the screen AND the PNG export
public/js/editor.js    canvas, touch gestures, undo/redo, autosave (IndexedDB)
public/js/templates.js the 6 placeholder-only starting layouts
public/js/publish.js   the Printify flow, draft/mockup screen, history
```

- **No hardcoded Printify IDs.** Blueprint, provider, and variant IDs and the
  print-area pixel sizes all come from the live catalog. The server re-reads
  the catalog when you push, rather than trusting the browser.
- **Payloads follow Printify's API reference:** `POST /v1/uploads/images.json`
  with `{file_name, contents}` (base64), then
  `POST /v1/shops/{id}/products.json` with `blueprint_id`, `print_provider_id`,
  `variants[{id, price, is_enabled}]` (prices in cents), and
  `print_areas[{variant_ids, placeholders[{position, images[{id, x, y, scale, angle}]}]}]`.
  The PNG is the exact print-area size, so it is placed at `x: 0.5, y: 0.5,
  scale: 1`. If some sizes have a differently shaped print area, they get their
  own print-area entry with the art scaled to fit.
- **The screen and the export use one renderer**, `render.js`, with only the
  scale changing. Shadow blur and offset are scaled explicitly, so the printed
  PNG matches the screen.

## Tests

```sh
npm test            # unit + server integration tests against a strict mock Printify API
npm run test:e2e    # full phone flow in headless Chromium (Pixel 7 emulation, touch only)
```

The mock (`test/mock-printify.js`) rejects any upload or product payload that
doesn't match Printify's documented shapes. It also flags any DELETE or PUT
call as a violation.

The e2e test covers the whole flow by touch: passcode, connect, template,
default product found by name, add text, Google Fonts picker, arch, outline,
shadow, black-shirt preview, drag with center snap, PNG export, push draft,
mockups, confirm → publish → live link, history, reload, JSON round-trip, and a
check for the token anywhere client-side. It checks that the PNG is exactly
4500×5100 RGBA with a transparent background. It also compares the export
against the on-screen renderer (mean difference about 0.6/255).

### Not yet verified against the live Printify API

The build environment could not reach `api.printify.com`, so the end-to-end
run used the strict mock, not your real shop. Before relying on it, do one
real run:

1. Connect your token in Settings.
2. Make a quick design and push it as a draft with a title like "TEST".
3. Check that the draft appears in your Printify shop with the mockups.
4. Publish it (or delete it in Printify if it was only a test).

Two things to check on that first run:

- Does **Open in Printify** land on the product? Printify doesn't document
  its web-app URLs. If the link is wrong, set `PRINTIFY_PRODUCT_URL_TEMPLATE`.
- Does the **live link** appear after publishing? It comes from the product's
  `external.handle`, which your sales channel (e.g. Etsy) sets after it accepts
  the listing.
