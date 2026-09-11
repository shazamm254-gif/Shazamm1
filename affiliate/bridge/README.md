# The Bridge Page

A single self-contained HTML file. No build step, no framework, no server, no
cost. Deployable from your phone in about four minutes.

## What it does

1. **Continues the video** — same promise, same voice, so the click feels
   consistent instead of like a bait-and-switch.
2. **Pre-sells** — frames *why* the usual advice fails, so the offer's sales
   page lands on prepared ground.
3. **Captures the not-yet-ready** with an email form.
4. **Keeps your tracking** — reads `?src=` from the URL and passes it to
   ClickBank as the `tid` (or Digistore24 as the campaign key). Without this,
   the bridge page would destroy your attribution and you'd never know which
   video sold.

It loads no external fonts, scripts or trackers — your visitors are on phone
data and will leave before a CDN responds.

---

## Deploy it free (from your phone)

1. github.com → your repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, folder: `/ (root)` → **Save**
4. Wait ~2 minutes. Your page is live at:
   `https://<your-username>.github.io/Shazamm1/affiliate/bridge/`

To test: open it on your phone, tap the button, confirm you land on the
offer's sales page. **Do this before you send any traffic.**

---

## Set it up

Ask me — don't hand-edit HTML on a phone keyboard:

> *"Set up my bridge page for [offer]. My email form URL is [paste]."*

I'll fill in:
- the `OFFER` block at the bottom of the file (network, your affiliate ID,
  vendor nickname or product ID)
- the headline, the four pre-frame bullets, and the CTA text
- your email form action URL

If you'd rather do it yourself, everything editable is between the two
`EDIT ZONE` comment markers, plus the `OFFER` object in the script at the end.

---

## Several offers

Copy the folder per offer, so each gets its own URL and its own tracking:

```
affiliate/bridge/           -> /affiliate/bridge/
affiliate/bridge-sleep/     -> /affiliate/bridge-sleep/
affiliate/bridge-money/     -> /affiliate/bridge-money/
```

Then set `bridge_slug` for each offer in `tools/offers.json` and
`link_builder.py` will generate the right bridge URLs automatically.

---

## A custom domain (optional, ~$10/year)

A real domain converts better than a github.io URL and looks legitimate in
places that are suspicious of free hosting.

Buy one (Namecheap, Porkbun), then in **Settings → Pages → Custom domain**
add it and follow the DNS instructions. Then update `bridge_page_base` in
`tools/affiliate.json`.

Not required to start. Do it once you've made your first few sales.
