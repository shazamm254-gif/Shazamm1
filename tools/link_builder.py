#!/usr/bin/env python3
"""
link_builder.py — build tracked ClickBank HopLinks and Digistore24 promolinks
for every offer x channel combination, so every click you ever get is
attributable to the exact place it came from.

Why this matters: an untracked affiliate link tells you "you made a sale."
A tracked one tells you "Short #7 on TikTok made the sale" — which is the
only information that lets you do more of what works.

Reads:
    tools/affiliate.json  — your ClickBank nickname / Digistore24 ID
    tools/offers.json     — the offers you're promoting

Usage:
    python tools/link_builder.py --list
    python tools/link_builder.py --offer nervewell
    python tools/link_builder.py --offer nervewell --channels yt,tt,em
    python tools/link_builder.py --all --format md
    python tools/link_builder.py --offer nervewell --channel yt --campaign short07
    python tools/link_builder.py --all --format csv > reports/links.csv

Phone workflow: you don't need to run this yourself. Ask Claude
"build my links for <offer>" and paste the result into your link-in-bio tool.
"""

import argparse
import csv
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# ClickBank tracking IDs must be alphanumeric. ClickBank documents a generous
# length limit, but short IDs stay readable in every report and never get
# truncated by third-party tools, so we cap at 24.
TID_MAX = 24
# Digistore24 campaign keys are free text; keep them alphanumeric + dash so the
# URL never needs encoding.
CAMPAIGNKEY_MAX = 30


def load_json(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        sys.exit(f"Missing {path} — copy the example file and fill in your details.")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def slug(text, maxlen, allow_dash=False):
    """Reduce free text to a safe tracking token."""
    keep = r"[^A-Za-z0-9-]" if allow_dash else r"[^A-Za-z0-9]"
    out = re.sub(keep, "", str(text))
    return out[:maxlen]


def build_tid(offer_key, channel, campaign):
    """Compose a readable tracking ID: <channel><offer><campaign>, e.g. ytnerve07."""
    parts = [slug(channel, 4), slug(offer_key, 10), slug(campaign or "", 8)]
    return "".join(p for p in parts if p)[:TID_MAX]


def clickbank_link(cfg, offer, tid):
    nick = cfg["clickbank_nickname"]
    vendor = offer["vendor"]
    if cfg.get("clickbank_link_style", "subdomain") == "query":
        url = f"https://hop.clickbank.net/?affiliate={nick}&vendor={vendor}"
        return f"{url}&tid={tid}" if tid else url
    url = f"https://{nick}.{vendor}.hop.clickbank.net"
    return f"{url}/?tid={tid}" if tid else url + "/"


def digistore24_link(cfg, offer, campaignkey):
    domain = cfg.get("digistore24_domain", "www.checkout-ds24.com")
    pid = offer["product_id"]
    aff = cfg["digistore24_id"]
    base = f"https://{domain}/redir/{pid}/{aff}"
    return f"{base}/{campaignkey}/" if campaignkey else base + "/"


def build_link(cfg, offer_key, offer, channel, campaign):
    network = offer.get("network", "").lower()
    token = build_tid(offer_key, channel, campaign)
    if network in ("clickbank", "cb"):
        raw = clickbank_link(cfg, offer, token)
    elif network in ("digistore24", "ds24", "digistore"):
        raw = digistore24_link(cfg, offer, slug(token, CAMPAIGNKEY_MAX, allow_dash=True))
    else:
        sys.exit(f"Offer '{offer_key}' has unknown network '{offer.get('network')}'. "
                 "Use 'clickbank' or 'digistore24'.")

    bridge = ""
    base = cfg.get("bridge_page_base", "").rstrip("/")
    if base and offer.get("bridge_slug"):
        bridge = f"{base}/{offer['bridge_slug']}/?src={token}"

    return {
        "offer": offer_key,
        "offer_name": offer.get("name", offer_key),
        "network": network,
        "channel": channel,
        "channel_name": cfg.get("channels", {}).get(channel, channel),
        "campaign": campaign or "",
        "tracking_id": token,
        "direct_link": raw,
        "bridge_link": bridge,
    }


def print_table(rows):
    for r in rows:
        print(f"\n  {r['offer_name']}  →  {r['channel_name']}"
              f"{'  [' + r['campaign'] + ']' if r['campaign'] else ''}")
        print(f"    tracking id : {r['tracking_id']}")
        print(f"    direct      : {r['direct_link']}")
        if r["bridge_link"]:
            print(f"    via bridge  : {r['bridge_link']}")


def print_md(rows):
    print("| Offer | Channel | Campaign | Tracking ID | Link to post |")
    print("|---|---|---|---|---|")
    for r in rows:
        link = r["bridge_link"] or r["direct_link"]
        print(f"| {r['offer_name']} | {r['channel_name']} | {r['campaign'] or '—'} "
              f"| `{r['tracking_id']}` | {link} |")


def print_csv(rows):
    w = csv.DictWriter(sys.stdout, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)


def main():
    p = argparse.ArgumentParser(description="Build tracked affiliate links.")
    p.add_argument("--offer", help="offer key from offers.json")
    p.add_argument("--all", action="store_true", help="every active offer")
    p.add_argument("--channels", help="comma-separated channel codes (default: all)")
    p.add_argument("--channel", help="a single channel code")
    p.add_argument("--campaign", default="", help="campaign tag, e.g. short07")
    p.add_argument("--format", choices=["table", "md", "csv", "json"], default="table")
    p.add_argument("--list", action="store_true", help="list offers and channels, then exit")
    p.add_argument("--offers-file", default="offers.json")
    args = p.parse_args()

    cfg = load_json("affiliate.json")
    offers = load_json(args.offers_file)
    catalog = {k: v for k, v in offers.items() if not k.startswith("_")}

    if args.list:
        print("\nOFFERS")
        for k, o in catalog.items():
            status = "active" if o.get("active", True) else "paused"
            print(f"  {k:<14} {o.get('name','')}  ({o.get('network','?')}, {status})")
        print("\nCHANNELS")
        for k, v in cfg.get("channels", {}).items():
            print(f"  {k:<6} {v}")
        return

    if not (args.offer or args.all):
        p.error("pass --offer <key>, --all, or --list")

    if cfg["clickbank_nickname"].startswith("YOUR") or cfg["digistore24_id"].startswith("YOUR"):
        print("!! tools/affiliate.json still has placeholder IDs — these links "
              "will NOT pay you. Fill in your real nicknames first.\n", file=sys.stderr)

    keys = list(catalog) if args.all else [args.offer]
    for k in keys:
        if k not in catalog:
            sys.exit(f"No offer '{k}' in offers.json. Try --list.")

    if args.channel:
        channels = [args.channel]
    elif args.channels:
        channels = [c.strip() for c in args.channels.split(",") if c.strip()]
    else:
        channels = list(cfg.get("channels", {}))

    rows = []
    for k in keys:
        offer = catalog[k]
        if args.all and not offer.get("active", True):
            continue
        for ch in channels:
            rows.append(build_link(cfg, k, offer, ch, args.campaign))

    if not rows:
        sys.exit("Nothing to build — all offers paused?")

    if args.format == "md":
        print_md(rows)
    elif args.format == "csv":
        print_csv(rows)
    elif args.format == "json":
        print(json.dumps(rows, indent=2))
    else:
        print_table(rows)
        print(f"\n  {len(rows)} link(s). Never post an untracked link again.\n")


if __name__ == "__main__":
    main()
