#!/usr/bin/env python3
"""
campaign_tracker.py — log what you posted and what it earned, then find the winners.

Affiliate marketing is not a creativity contest, it's a search problem: you
run many small tests and pour everything into the few that work. That only
functions if you write the results down. This is the ledger.

Data lives in reports/campaigns.csv (gitignored — it's your business data).

Usage:
    python tools/campaign_tracker.py log --channel yt --offer nervewell \\
        --campaign short07 --views 12400 --clicks 96 --sales 1 --revenue 87

    python tools/campaign_tracker.py report
    python tools/campaign_tracker.py report --by offer
    python tools/campaign_tracker.py report --by campaign --days 14
    python tools/campaign_tracker.py decide

`decide` is the one that matters: it applies kill/scale rules so you stop
running on feelings.

Phone workflow: tell Claude "log yesterday: 12400 views, 96 clicks, 1 sale,
$87 on short07" and it runs this for you.
"""

import argparse
import csv
import datetime as dt
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA_DIR = os.path.join(ROOT, "reports")
DATA = os.path.join(DATA_DIR, "campaigns.csv")

FIELDS = ["date", "channel", "offer", "campaign", "views", "clicks",
          "optins", "sales", "revenue", "refunds", "notes"]

# Decision thresholds. A test needs enough clicks to mean anything — below
# MIN_CLICKS you are reading noise, not signal.
MIN_CLICKS = 75
KILL_EPC = 0.15
SCALE_EPC = 0.75


def ensure_file():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA):
        with open(DATA, "w", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=FIELDS).writeheader()


def read_rows(days=None):
    ensure_file()
    with open(DATA, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if days:
        cutoff = dt.date.today() - dt.timedelta(days=days)
        rows = [r for r in rows if _date(r) and _date(r) >= cutoff]
    return rows


def _date(r):
    try:
        return dt.date.fromisoformat(r["date"])
    except (ValueError, KeyError):
        return None


def f(r, key):
    try:
        return float(r.get(key) or 0)
    except ValueError:
        return 0.0


def cmd_log(a):
    ensure_file()
    row = {
        "date": a.date or dt.date.today().isoformat(),
        "channel": a.channel, "offer": a.offer, "campaign": a.campaign or "",
        "views": a.views, "clicks": a.clicks, "optins": a.optins,
        "sales": a.sales, "revenue": a.revenue, "refunds": a.refunds,
        "notes": a.notes or "",
    }
    with open(DATA, "a", newline="", encoding="utf-8") as fh:
        csv.DictWriter(fh, fieldnames=FIELDS).writerow(row)
    epc = a.revenue / a.clicks if a.clicks else 0
    print(f"\n  Logged {row['date']}: {a.offer} via {a.channel}"
          f"{' [' + a.campaign + ']' if a.campaign else ''}")
    print(f"  {a.clicks:.0f} clicks, {a.sales:.0f} sales, ${a.revenue:.2f}  →  EPC ${epc:.2f}\n")


def aggregate(rows, key):
    buckets = defaultdict(lambda: dict.fromkeys(
        ["views", "clicks", "optins", "sales", "revenue", "refunds"], 0.0))
    for r in rows:
        b = buckets[r.get(key) or "(none)"]
        for m in b:
            b[m] += f(r, m)
    return buckets


def fmt_block(name, b):
    net = b["revenue"] - b["refunds"]
    epc = net / b["clicks"] if b["clicks"] else 0
    ctr = b["clicks"] / b["views"] if b["views"] else 0
    cr = b["sales"] / b["clicks"] if b["clicks"] else 0
    rpm = net / (b["views"] / 1000) if b["views"] else 0
    return (f"  {name:<16}{b['views']:>9,.0f}{b['clicks']:>8,.0f}{ctr*100:>7.2f}%"
            f"{b['sales']:>7,.0f}{cr*100:>7.2f}%{net:>10,.2f}{epc:>8.2f}{rpm:>8.2f}")


def cmd_report(a):
    rows = read_rows(a.days)
    if not rows:
        sys.exit("\n  No data yet. Log your first day:\n"
                 "  python tools/campaign_tracker.py log --channel yt --offer X "
                 "--views 1000 --clicks 10 --sales 0 --revenue 0\n")

    window = f"last {a.days} days" if a.days else "all time"
    print(f"\n  BY {a.by.upper()} — {window}\n")
    print(f"  {'':<16}{'VIEWS':>9}{'CLICKS':>8}{'CTR':>8}{'SALES':>7}{'CR':>8}"
          f"{'NET $':>10}{'EPC':>8}{'RPM':>8}")
    print("  " + "-" * 82)

    buckets = aggregate(rows, a.by)
    ranked = sorted(buckets.items(),
                    key=lambda kv: kv[1]["revenue"] - kv[1]["refunds"], reverse=True)
    for name, b in ranked:
        print(fmt_block(name, b))

    tot = defaultdict(float)
    for b in buckets.values():
        for m, v in b.items():
            tot[m] += v
    print("  " + "-" * 82)
    print(fmt_block("TOTAL", tot))

    days = len({r["date"] for r in rows})
    net = tot["revenue"] - tot["refunds"]
    print(f"\n  {days} day(s) logged · net ${net:,.2f} · "
          f"${net/days if days else 0:,.2f}/day average\n")


def cmd_decide(a):
    rows = read_rows(a.days)
    if not rows:
        sys.exit("\n  No data yet — nothing to decide on.\n")

    print(f"\n  DECISIONS — last {a.days} days\n  " + "-" * 60)
    buckets = aggregate(rows, "campaign")
    scale, kill, wait, watch = [], [], [], []

    for name, b in buckets.items():
        clicks, net = b["clicks"], b["revenue"] - b["refunds"]
        epc = net / clicks if clicks else 0
        if clicks < MIN_CLICKS:
            wait.append((name, clicks, epc))
        elif epc >= SCALE_EPC:
            scale.append((name, clicks, epc))
        elif epc < KILL_EPC:
            kill.append((name, clicks, epc))
        else:
            watch.append((name, clicks, epc))

    def show(title, items, advice):
        if not items:
            return
        print(f"\n  {title}")
        for name, clicks, epc in sorted(items, key=lambda x: -x[2]):
            print(f"    {name:<18} {clicks:>6,.0f} clicks   EPC ${epc:.2f}")
        print(f"    → {advice}")

    show("SCALE", scale,
         "This works. Make 5 more variations of it this week and put every "
         "channel behind it.")
    show("WATCH", watch,
         "Profitable but not proven. Keep running, change one thing at a time.")
    show("KILL", kill,
         f"Under ${KILL_EPC:.2f}/click with real volume. Stop. The traffic is "
         "better spent elsewhere.")
    show("NOT ENOUGH DATA", wait,
         f"Under {MIN_CLICKS} clicks — you're reading noise. Keep going before judging.")

    if not (scale or kill or watch):
        print("\n  Everything is still in the noise zone. The only move is volume.")
    print()


def main():
    p = argparse.ArgumentParser(description="Track and judge affiliate campaigns.")
    sub = p.add_subparsers(dest="cmd", required=True)

    lg = sub.add_parser("log", help="record one day of results")
    lg.add_argument("--channel", required=True)
    lg.add_argument("--offer", required=True)
    lg.add_argument("--campaign", default="")
    lg.add_argument("--date", default="")
    for field, default in [("views", 0), ("clicks", 0), ("optins", 0),
                           ("sales", 0), ("revenue", 0.0), ("refunds", 0.0)]:
        lg.add_argument(f"--{field}", type=float, default=default)
    lg.add_argument("--notes", default="")
    lg.set_defaults(func=cmd_log)

    rp = sub.add_parser("report", help="aggregate results")
    rp.add_argument("--by", choices=["channel", "offer", "campaign", "date"], default="channel")
    rp.add_argument("--days", type=int, default=0)
    rp.set_defaults(func=cmd_report)

    dc = sub.add_parser("decide", help="apply kill/scale rules")
    dc.add_argument("--days", type=int, default=14)
    dc.set_defaults(func=cmd_decide)

    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
