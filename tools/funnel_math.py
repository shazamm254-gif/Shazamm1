#!/usr/bin/env python3
"""
funnel_math.py — the arithmetic of affiliate income.

Two modes:

  plan   You have a daily income goal. How much traffic does it actually take?
         Run this BEFORE you make content, so you know whether the plan is
         "post 3 Shorts a day" or "this offer can never work at my volume."

  check  You have real numbers from the last 7 days. What's your value per
         1000 views, where is the funnel leaking, and what should you fix next?

The default rates are deliberately conservative — organic short-form traffic
is colder than a search visitor or an email subscriber. Beating these numbers
is normal once you're dialed in; planning with optimistic ones is how people
quit in week three.

Usage:
    python tools/funnel_math.py plan --goal 100 --commission 87
    python tools/funnel_math.py plan --goal 100 --commission 87 --via-list
    python tools/funnel_math.py check --views 42000 --clicks 310 --sales 2 --revenue 174
    python tools/funnel_math.py check --views 42000 --clicks 310 --optins 58 --sales 2 --revenue 174
"""

import argparse

# Conservative organic short-form benchmarks.
D_CTR = 0.008          # views -> link clicks (0.8%); a good bio funnel hits 1-2%
D_OPTIN = 0.25         # bridge/landing page visitors -> email subscribers
D_CLICKS_PER_SUB = 3.0 # offer clicks ONE subscriber gives you over ~90 days
                       # (welcome sequence + broadcasts). This is why a list
                       # beats direct promotion: you buy the visitor once and
                       # monetize them many times.
D_OFFER_CR = 0.015     # offer page visitors -> buyers (1.5%); VSL offers run 1-3%
D_REFUND = 0.10        # refund/chargeback rate


def money(x):
    return f"${x:,.2f}"


def num(x):
    return f"{x:,.0f}"


def plan(a):
    net = a.commission * (1 - a.refund)
    if net <= 0:
        raise SystemExit("Commission after refunds is zero — check your numbers.")

    sales = a.goal / net
    offer_views = sales / a.offer_cr

    print(f"\n  GOAL: {money(a.goal)}/day\n  " + "-" * 54)
    print(f"  Commission per sale        {money(a.commission)}")
    print(f"  Refund rate                {a.refund*100:.0f}%")
    print(f"  Net per sale               {money(net)}")
    print(f"\n  Sales needed per day       {sales:.2f}")
    print(f"  Offer page visits needed   {num(offer_views)}   (at {a.offer_cr*100:.1f}% conversion)")

    if a.via_list:
        # A subscriber is an asset, not a single click. Over their active life
        # they click your offers several times, so ONE acquired visitor is
        # monetized repeatedly. In steady state:
        #   daily revenue = (new subscribers per day) x (lifetime value per subscriber)
        sub_ltv = a.clicks_per_sub * a.offer_cr * net
        if sub_ltv <= 0:
            raise SystemExit("Subscriber value is zero — check your numbers.")
        subs = a.goal / sub_ltv
        page_views = subs / a.optin
        views = page_views / a.ctr
        print(f"\n  Clicks per subscriber      {a.clicks_per_sub:.1f}   (over ~90 days of emails)")
        print(f"  LIFETIME VALUE PER SUB     {money(sub_ltv)}")
        print(f"  New subscribers needed/day {num(subs)}")
        print(f"  Bridge page visits needed  {num(page_views)}   (at {a.optin*100:.0f}% opt-in)")
        print(f"  VIDEO VIEWS NEEDED/DAY     {num(views)}   (at {a.ctr*100:.1f}% click-through)")
        route = "views -> bridge page -> email list -> offer (repeatedly)"
    else:
        views = offer_views / a.ctr
        print(f"  VIDEO VIEWS NEEDED/DAY     {num(views)}   (at {a.ctr*100:.1f}% click-through)")
        route = "views -> offer (direct, one shot)"

    print(f"\n  Route: {route}")
    print(f"  Value per 1,000 views      {money(a.goal / (views / 1000)) if views else 'n/a'}")

    per_short = a.views_per_short
    if per_short > 0:
        shorts = views / per_short
        print(f"\n  At {num(per_short)} views per Short, that's {shorts:.1f} Shorts/day "
              f"({shorts*7:.0f}/week) of sustained performance.")
        if shorts > 6:
            print("  That's not realistic to produce. Fix it by: promoting a higher-paying")
            print("  offer, raising click-through, or building the list (--via-list), which")
            print("  monetizes the same visitor several times instead of once.")

    if not a.via_list:
        sub_ltv = a.clicks_per_sub * a.offer_cr * net
        direct_click_value = a.offer_cr * net
        optin_click_value = a.optin * sub_ltv
        print(f"\n  Compare: a click sent straight to the offer is worth "
              f"{money(direct_click_value)}.")
        print(f"  The same click sent to a bridge page that captures emails is worth "
              f"{money(optin_click_value)}")
        print(f"  ({a.optin*100:.0f}% opt in x {money(sub_ltv)} lifetime value). "
              f"Run again with --via-list.")

    print("\n  Reality check: this is a STEADY-STATE number. A back catalogue of")
    print("  Shorts keeps earning and a list compounds, so you are building")
    print("  toward this over weeks — not hitting it on Tuesday.\n")


def check(a):
    v, c, s, rev = a.views, a.clicks, a.sales, a.revenue
    print(f"\n  LAST {a.days} DAYS\n  " + "-" * 54)
    print(f"  Views                      {num(v)}")

    ctr = c / v if v else 0
    print(f"  Link clicks                {num(c)}   ({ctr*100:.2f}% of views)")

    if a.optins is not None:
        optin = a.optins / c if c else 0
        print(f"  Opt-ins                    {num(a.optins)}   ({optin*100:.1f}% of clicks)")

    cr = s / c if c else 0
    print(f"  Sales                      {num(s)}   ({cr*100:.2f}% of clicks)")
    print(f"  Revenue                    {money(rev)}")

    epc = rev / c if c else 0
    rpm = rev / (v / 1000) if v else 0
    per_day = rev / a.days if a.days else 0
    print(f"\n  EPC (earnings per click)   {money(epc)}")
    print(f"  RPM (per 1,000 views)      {money(rpm)}")
    print(f"  Per day                    {money(per_day)}")
    if s:
        print(f"  Revenue per sale           {money(rev / s)}")

    print("\n  DIAGNOSIS\n  " + "-" * 54)
    issues = []
    if v < 5000:
        issues.append(("TRAFFIC", "Under 5k views — you don't have a conversion problem yet, "
                                  "you have a volume problem. Publish more before changing anything."))
    if v >= 5000 and ctr < 0.004:
        issues.append(("CLICK-THROUGH", f"{ctr*100:.2f}% is low. The video isn't creating enough "
                                        "curiosity gap, or the call to action is vague. Name the "
                                        "destination and give one reason to go now."))
    if a.optins is not None and c >= 100 and (a.optins / c) < 0.15:
        issues.append(("OPT-IN", "Under 15% of clicks subscribe. Your lead magnet isn't worth "
                                 "an email address, or the page asks for too much."))
    if c >= 200 and cr < 0.005:
        issues.append(("OFFER", f"{cr*100:.2f}% of clicks buy. Either the offer doesn't match what "
                                "the video promised, or the traffic is curious rather than "
                                "in-pain. Try a different offer before rewriting the video."))
    if c >= 100 and epc < 0.20:
        issues.append(("ECONOMICS", f"EPC of {money(epc)} means 1,000 clicks = {money(epc*1000)}. "
                                    "That's a weak offer/traffic pair. Swap the offer."))
    if not issues:
        print("  Nothing is broken. The numbers say: do more of exactly this.")
        if epc > 0:
            print(f"  Every 1,000 extra clicks is worth about {money(epc*1000)} to you.")
    else:
        for i, (stage, advice) in enumerate(issues, 1):
            print(f"  {i}. [{stage}] {advice}")
        print("\n  Fix the FIRST one on the list. Stages are ordered — fixing a later")
        print("  stage while an earlier one leaks just wastes the work.")
    print()


def main():
    p = argparse.ArgumentParser(description="Affiliate funnel arithmetic.")
    sub = p.add_subparsers(dest="mode", required=True)

    pl = sub.add_parser("plan", help="goal -> traffic required")
    pl.add_argument("--goal", type=float, default=100.0, help="target $/day")
    pl.add_argument("--commission", type=float, required=True, help="$ per sale")
    pl.add_argument("--refund", type=float, default=D_REFUND)
    pl.add_argument("--ctr", type=float, default=D_CTR, help="views -> clicks")
    pl.add_argument("--offer-cr", type=float, default=D_OFFER_CR, help="offer visits -> sales")
    pl.add_argument("--optin", type=float, default=D_OPTIN)
    pl.add_argument("--clicks-per-sub", type=float, default=D_CLICKS_PER_SUB,
                    help="offer clicks one subscriber gives you over ~90 days")
    pl.add_argument("--via-list", action="store_true", help="route traffic through an email list")
    pl.add_argument("--views-per-short", type=float, default=3000.0)
    pl.set_defaults(func=plan)

    ck = sub.add_parser("check", help="actuals -> diagnosis")
    ck.add_argument("--views", type=float, required=True)
    ck.add_argument("--clicks", type=float, required=True)
    ck.add_argument("--sales", type=float, default=0)
    ck.add_argument("--revenue", type=float, default=0)
    ck.add_argument("--optins", type=float, default=None)
    ck.add_argument("--days", type=float, default=7)
    ck.set_defaults(func=check)

    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
