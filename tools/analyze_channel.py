#!/usr/bin/env python3
"""
analyze_channel.py — pull public stats for a YouTube channel and surface what's
working, what isn't, and when to post.

Uses the YouTube Data API v3 (read-only, public data). It does NOT need access
to your account and cannot change anything on your channel — it only reads the
same public numbers any viewer can see.

Usage:
    export YOUTUBE_API_KEY="..."          # see .env.example
    python tools/analyze_channel.py --channel "@Project3000Official"
    python tools/analyze_channel.py --channel UCxxxxxxxx --csv reports/videos.csv

What you get:
    - Channel summary (subs, total views, video count)
    - Per-video metrics: views, like-rate, comment-rate, an "engagement score",
      and whether each upload is a Short
    - Your top and bottom performers (so you can make more of what works)
    - Best day-of-week / hour to publish, inferred from your own back catalogue
    - Optional CSV export of every video for deeper analysis in a spreadsheet
"""

import argparse
import csv
import os
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    sys.exit("Missing dependency. Run:  pip install -r requirements.txt")

API = "https://www.googleapis.com/youtube/v3"


def _get(endpoint, params, key):
    params = {**params, "key": key}
    r = requests.get(f"{API}/{endpoint}", params=params, timeout=30)
    if r.status_code != 200:
        # Surface the API's own error message — usually a clear cause
        # (bad key, quota exceeded, API not enabled).
        try:
            msg = r.json()["error"]["message"]
        except Exception:
            msg = r.text[:300]
        sys.exit(f"YouTube API error ({r.status_code}): {msg}")
    return r.json()


def resolve_channel_id(channel, key):
    """Accept a raw channel ID (UC...), an @handle, or a plain name."""
    channel = channel.strip()
    if channel.startswith("UC") and len(channel) == 24:
        return channel
    handle = channel.lstrip("@")
    # The forHandle param is the modern, exact way to resolve @handles.
    data = _get("channels", {"part": "id", "forHandle": handle}, key)
    items = data.get("items")
    if items:
        return items[0]["id"]
    # Fall back to search for older/legacy custom URLs or display names.
    data = _get("search", {"part": "snippet", "q": handle, "type": "channel",
                            "maxResults": 1}, key)
    items = data.get("items")
    if not items:
        sys.exit(f"Could not find a channel matching '{channel}'.")
    return items[0]["snippet"]["channelId"]


def parse_duration(iso):
    """ISO-8601 duration (e.g. PT1M5S) -> total seconds."""
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + s


def fetch_channel(channel_id, key):
    data = _get("channels",
                {"part": "snippet,statistics,contentDetails", "id": channel_id},
                key)
    if not data.get("items"):
        sys.exit("Channel found but returned no data.")
    return data["items"][0]


def fetch_all_video_ids(uploads_playlist, key):
    ids, page = [], None
    while True:
        params = {"part": "contentDetails", "playlistId": uploads_playlist,
                  "maxResults": 50}
        if page:
            params["pageToken"] = page
        data = _get("playlistItems", params, key)
        ids += [it["contentDetails"]["videoId"] for it in data.get("items", [])]
        page = data.get("nextPageToken")
        if not page:
            break
    return ids


def fetch_videos(video_ids, key):
    videos = []
    for i in range(0, len(video_ids), 50):  # API caps at 50 ids per call
        chunk = video_ids[i:i + 50]
        data = _get("videos",
                    {"part": "snippet,statistics,contentDetails",
                     "id": ",".join(chunk)}, key)
        for it in data.get("items", []):
            stats = it.get("statistics", {})
            snip = it.get("snippet", {})
            views = int(stats.get("viewCount", 0))
            likes = int(stats.get("likeCount", 0))
            comments = int(stats.get("commentCount", 0))
            dur = parse_duration(it["contentDetails"].get("duration"))
            published = snip.get("publishedAt")
            videos.append({
                "id": it["id"],
                "title": snip.get("title", ""),
                "published": published,
                "duration_s": dur,
                "is_short": dur <= 60,
                "views": views,
                "likes": likes,
                "comments": comments,
                "like_rate": round(likes / views * 100, 2) if views else 0.0,
                "comment_rate": round(comments / views * 100, 3) if views else 0.0,
                # Engagement score weights comments higher than likes — comments
                # are a stronger signal of a video that sparks discussion, which
                # the Shorts algorithm rewards.
                "engagement": round((likes + comments * 3) / views * 100, 2)
                if views else 0.0,
            })
    return videos


def best_times(videos):
    """Average views grouped by publish weekday and hour (UTC)."""
    by_day, by_hour = defaultdict(list), defaultdict(list)
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    for v in videos:
        if not v["published"]:
            continue
        dt = datetime.fromisoformat(v["published"].replace("Z", "+00:00")) \
            .astimezone(timezone.utc)
        by_day[days[dt.weekday()]].append(v["views"])
        by_hour[dt.hour].append(v["views"])

    def avg(d):
        return {k: sum(x) / len(x) for k, x in d.items() if x}

    return avg(by_day), avg(by_hour), days


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--channel",
                    default=os.environ.get("YOUTUBE_CHANNEL", "@Project3000Official"),
                    help="@handle, channel ID (UC...), or name")
    ap.add_argument("--csv", help="Optional path to write per-video CSV")
    ap.add_argument("--top", type=int, default=5, help="How many top/bottom to show")
    args = ap.parse_args()

    key = os.environ.get("YOUTUBE_API_KEY")
    if not key:
        sys.exit("Set YOUTUBE_API_KEY (see .env.example).")

    cid = resolve_channel_id(args.channel, key)
    ch = fetch_channel(cid, key)
    st = ch["statistics"]
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]

    print(f"\n{'=' * 60}")
    print(f"  {ch['snippet']['title']}  ({args.channel})")
    print(f"{'=' * 60}")
    subs = "hidden" if st.get("hiddenSubscriberCount") else st.get("subscriberCount", "?")
    print(f"  Subscribers : {subs}")
    print(f"  Total views : {int(st.get('viewCount', 0)):,}")
    print(f"  Videos      : {st.get('videoCount', '?')}")

    print("\n  Fetching every video (this can take a moment)...")
    ids = fetch_all_video_ids(uploads, key)
    videos = fetch_videos(ids, key)
    if not videos:
        sys.exit("No videos found.")

    shorts = [v for v in videos if v["is_short"]]
    print(f"  Pulled {len(videos)} videos ({len(shorts)} are Shorts).")

    avg_views = sum(v["views"] for v in videos) / len(videos)
    avg_eng = sum(v["engagement"] for v in videos) / len(videos)
    print(f"\n  Average views per video : {avg_views:,.0f}")
    print(f"  Average engagement score: {avg_eng:.2f}%")

    ranked = sorted(videos, key=lambda v: v["views"], reverse=True)
    print(f"\n  TOP {args.top} BY VIEWS  (study these — make more like them)")
    print("  " + "-" * 56)
    for v in ranked[:args.top]:
        tag = "S" if v["is_short"] else " "
        print(f"  [{tag}] {v['views']:>8,}v  {v['engagement']:>5.1f}%eng  {v['title'][:42]}")

    print(f"\n  BOTTOM {args.top} BY VIEWS  (weak hooks/titles/topics?)")
    print("  " + "-" * 56)
    for v in ranked[-args.top:]:
        tag = "S" if v["is_short"] else " "
        print(f"  [{tag}] {v['views']:>8,}v  {v['engagement']:>5.1f}%eng  {v['title'][:42]}")

    day_avg, hour_avg, days = best_times(videos)
    if day_avg:
        best_day = max(day_avg, key=day_avg.get)
        print(f"\n  Best publish DAY  (by avg views): {best_day}")
        order = sorted(day_avg.items(), key=lambda kv: days.index(kv[0]))
        print("    " + "  ".join(f"{d}:{v:,.0f}" for d, v in order))
    if hour_avg:
        best_hour = max(hour_avg, key=hour_avg.get)
        print(f"  Best publish HOUR (UTC, by avg views): {best_hour:02d}:00")

    print("\n  NOTE: views/likes are public; true Shorts performance (swipe-away"
          "\n  rate, avg view duration) lives in YouTube Studio. Use this to spot"
          "\n  patterns, then confirm in Studio > Analytics > Content.\n")

    if args.csv:
        os.makedirs(os.path.dirname(args.csv) or ".", exist_ok=True)
        with open(args.csv, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(videos[0].keys()))
            w.writeheader()
            w.writerows(videos)
        print(f"  Wrote per-video CSV -> {args.csv}\n")


if __name__ == "__main__":
    main()
