#!/usr/bin/env python3
"""
offer_scorer.py — rank affiliate offers before you spend a single hour promoting one.

Choosing the offer is ~70% of the outcome in affiliate marketing. A great
Short pointed at a bad offer makes nothing; a mediocre Short pointed at a
proven offer makes money. This scores each offer in tools/offers.json on the
seven things that actually predict affiliate earnings, and gives you a verdict.

Scoring model (0-100), each component weighted:
    Proof         25  — is it already converting for other affiliates?
    Payout        20  — dollars per sale, incl. lifetime rebills
    Click value   15  — earnings per click, the single most honest number
    Refund risk   15  — refunds claw back commissions you already spent traffic on
    Funnel        10  — upsells and rebills raise payout without more traffic
    Audience fit  10  — can YOU actually reach these buyers?
    Operations     5  — affiliate support, mobile checkout, sales page format

Usage:
    python tools/offer_scorer.py
    python tools/offer_scorer.py --min-score 60
    python tools/offer_scorer.py --explain example_cb_health
    python tools/offer_scorer.py --format md
    python tools/offer_scorer.py --include-paused

Phone workflow: paste marketplace rows to Claude and say "add these to my
offers.json and score them" — you never have to run this yourself.
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

WEIGHTS = {
    "proof": 25,
    "payout": 20,
    "click_value": 15,
    "refund_risk": 15,
    "funnel": 10,
    "audience_fit": 10,
    "operations": 5,
}


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def score_proof(o):
    """Gravity (ClickBank) or marketplace rating (Digistore24), normalized.

    Gravity counts distinct affiliates paid recently. Very low = unproven.
    Very high = proven but crowded, and the big media buyers own the cheap
    traffic — so the sweet spot for a new affiliate is the middle, not the top.
    """
    if o.get("network", "").lower().startswith("d"):
        rating = float(o.get("ds24_rating") or 0)
        return clamp(rating / 85.0)
    g = float(o.get("gravity") or 0)
    if g <= 0:
        return 0.0
    if g < 15:
        return clamp(g / 15.0) * 0.45          # unproven: capped low
    if g <= 120:
        return clamp(0.70 + (g - 15) / 105.0 * 0.30)   # the sweet spot
    return clamp(0.90 - (g - 120) / 400.0)     # saturated: slight discount


def score_payout(o):
    """Commission per sale, including lifetime rebills. $100+ is strong."""
    total = float(o.get("avg_commission_usd") or 0) + float(o.get("avg_rebill_total_usd") or 0)
    return clamp(total / 120.0)


def score_click_value(o):
    """EPC. $1+/click is strong for organic traffic; 0 means 'unknown', not 'bad'."""
    epc = float(o.get("earnings_per_click_usd") or 0)
    if epc <= 0:
        return 0.45      # unknown — neutral-ish, don't punish as hard as a bad EPC
    return clamp(epc / 2.0)


def score_refund_risk(o):
    """Lower refunds = better. 5% is excellent, 25%+ is a commission shredder."""
    r = float(o.get("refund_rate_pct") or 0)
    if r <= 0:
        return 0.5       # unknown
    return clamp(1.0 - (r - 5.0) / 20.0)


def score_funnel(o):
    s = 0.0
    if o.get("has_upsells"):
        s += 0.5
    if o.get("recurring"):
        s += 0.5
    return clamp(s)


def score_audience_fit(o):
    return clamp(float(o.get("audience_fit") or 0) / 10.0)


def score_operations(o):
    s = 0.0
    if o.get("affiliate_page"):
        s += 0.4         # swipe copy, banners, approved angles
    if o.get("mobile_checkout_ok"):
        s += 0.4         # your traffic is 95% phones
    if o.get("vsl_or_text") in ("both", "text"):
        s += 0.2         # text pages convert colder traffic better than a 40-min VSL
    return clamp(s)


SCORERS = {
    "proof": score_proof,
    "payout": score_payout,
    "click_value": score_click_value,
    "refund_risk": score_refund_risk,
    "funnel": score_funnel,
    "audience_fit": score_audience_fit,
    "operations": score_operations,
}


def score_offer(o):
    parts = {k: fn(o) * WEIGHTS[k] for k, fn in SCORERS.items()}
    return round(sum(parts.values()), 1), parts


def hard_flags(o):
    """Deal-breakers that a good total score should never hide."""
    flags = []
    net = o.get("network", "").lower()
    if net.startswith("c") and float(o.get("gravity") or 0) < 8:
        flags.append("Gravity under 8 — almost nobody is making sales with this")
    if float(o.get("refund_rate_pct") or 0) > 20:
        flags.append("Refund rate over 20% — your commissions get clawed back")
    if float(o.get("avg_commission_usd") or 0) < 15 and not o.get("recurring"):
        flags.append("Under $15/sale with no rebills — needs huge volume to matter")
    if not o.get("mobile_checkout_ok"):
        flags.append("Mobile checkout unverified — open the sales page on your phone and buy-test it")
    if not o.get("affiliate_page"):
        flags.append("No affiliate page — you get no swipe copy and no vendor support")
    if float(o.get("audience_fit") or 0) < 5:
        flags.append("Weak audience fit — you can't cheaply reach these buyers")
    return flags


def verdict(total, flags):
    if flags and total < 55:
        return "SKIP", "Low score plus deal-breakers. Don't spend time here."
    if total >= 72 and not flags:
        return "PROMOTE", "Strong on every axis. Make this a core offer."
    if total >= 72:
        return "PROMOTE*", "Strong, but clear the flags below before you scale."
    if total >= 55:
        return "TEST", "Worth 100 tracked clicks. Decide on the data, not the vibe."
    return "SKIP", "Not enough upside to justify the traffic."


def bar(fraction, width=10):
    filled = int(round(fraction * width))
    return "#" * filled + "." * (width - filled)


def explain(key, o):
    total, parts = score_offer(o)
    v, why = verdict(total, hard_flags(o))
    print(f"\n{o.get('name', key)}  [{key}]")
    print(f"{o.get('network','?')} · {o.get('niche','?')} · ${o.get('price_usd',0):.0f} front end")
    print("-" * 58)
    for k in WEIGHTS:
        earned = parts[k]
        frac = earned / WEIGHTS[k] if WEIGHTS[k] else 0
        print(f"  {k.replace('_',' '):<13} {bar(frac)}  {earned:5.1f} / {WEIGHTS[k]}")
    print("-" * 58)
    print(f"  TOTAL         {total} / 100     →  {v}")
    print(f"  {why}")
    flags = hard_flags(o)
    if flags:
        print("\n  Flags:")
        for f in flags:
            print(f"    ! {f}")
    lifetime = float(o.get("avg_commission_usd") or 0) + float(o.get("avg_rebill_total_usd") or 0)
    refund = float(o.get("refund_rate_pct") or 0)
    net_per_sale = lifetime * (1 - refund / 100.0)
    print(f"\n  Net per sale after refunds: ${net_per_sale:.2f}")
    if net_per_sale > 0:
        print(f"  Sales needed for $100/day:  {100 / net_per_sale:.1f}")
    if o.get("notes"):
        print(f"  Notes: {o['notes']}")
    print()


def main():
    p = argparse.ArgumentParser(description="Score and rank affiliate offers.")
    p.add_argument("--offers-file", default="offers.json")
    p.add_argument("--min-score", type=float, default=0.0)
    p.add_argument("--explain", help="offer key — show the full breakdown")
    p.add_argument("--include-paused", action="store_true")
    p.add_argument("--format", choices=["table", "md", "json"], default="table")
    args = p.parse_args()

    path = os.path.join(HERE, args.offers_file)
    if not os.path.exists(path):
        sys.exit(f"Missing {path}")
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    catalog = {k: v for k, v in raw.items() if not k.startswith("_")}
    if not catalog:
        sys.exit("No offers in the catalog yet. Add some from the marketplace.")

    if args.explain:
        if args.explain not in catalog:
            sys.exit(f"No offer '{args.explain}'. Have: {', '.join(catalog)}")
        explain(args.explain, catalog[args.explain])
        return

    rows = []
    for k, o in catalog.items():
        if not args.include_paused and not o.get("active", True):
            continue
        total, parts = score_offer(o)
        if total < args.min_score:
            continue
        flags = hard_flags(o)
        v, why = verdict(total, flags)
        lifetime = float(o.get("avg_commission_usd") or 0) + float(o.get("avg_rebill_total_usd") or 0)
        rows.append({
            "key": k,
            "name": o.get("name", k),
            "network": o.get("network", ""),
            "score": total,
            "verdict": v,
            "reason": why,
            "net_per_sale": round(lifetime * (1 - float(o.get("refund_rate_pct") or 0) / 100.0), 2),
            "flags": flags,
        })
    rows.sort(key=lambda r: r["score"], reverse=True)

    if not rows:
        sys.exit("Nothing cleared the filter.")

    if args.format == "json":
        print(json.dumps(rows, indent=2))
        return

    if args.format == "md":
        print("| # | Offer | Network | Score | Verdict | Net/sale | Flags |")
        print("|---|---|---|---|---|---|---|")
        for i, r in enumerate(rows, 1):
            print(f"| {i} | {r['name']} | {r['network']} | {r['score']} | **{r['verdict']}** "
                  f"| ${r['net_per_sale']:.2f} | {len(r['flags']) or '—'} |")
        return

    print(f"\n  {len(rows)} offer(s), best first\n")
    print(f"  {'#':<3}{'SCORE':<7}{'VERDICT':<10}{'NET/SALE':<10}OFFER")
    print("  " + "-" * 62)
    for i, r in enumerate(rows, 1):
        print(f"  {i:<3}{r['score']:<7}{r['verdict']:<10}${r['net_per_sale']:<9.2f}{r['name']}")
        if r["flags"]:
            for f in r["flags"]:
                print(f"       ! {f}")
    print(f"\n  Full breakdown:  python tools/offer_scorer.py --explain <key>\n")


if __name__ == "__main__":
    main()
