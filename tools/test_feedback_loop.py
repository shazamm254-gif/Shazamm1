"""
Tests for feedback_loop.py. Run: python tools/test_feedback_loop.py

There's no real performance data yet, so the analysis is proven on simulated
channels with planted effects: one rule that really helps, one that really
hurts, one that does nothing. The loop has to find all three, and the
calibration has to move the weights in the right directions — and refuse to
move them on too few videos.
"""

import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import feedback_loop as fl  # noqa: E402
import retention_score as rs  # noqa: E402

PROMISE = "hook_rubric.promise_in_window"
LOOP = "ending_rubric.loops_to_hook"
CARRY = "beat_rubric.carry"


simulated_ledger = fl.simulate


class FeedbackLoopTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.rules = os.path.join(self.tmp, "rules.json")
        shutil.copy(fl.RULES, self.rules)
        self._history = fl.HISTORY
        fl.HISTORY = os.path.join(self.tmp, "history")

    def tearDown(self):
        fl.HISTORY = self._history
        shutil.rmtree(self.tmp)

    def verdict(self, rep, rule):
        return next(r for r in rep["rules"] if r["rule"] == rule)

    def test_empty_ledger_reports_nothing_and_never_guesses(self):
        rep = fl.report(fl.empty_ledger())
        self.assertEqual(rep["registered"], 0)
        self.assertEqual(rep["rules"], [])
        self.assertIn("Needs 20", fl.calibrate(fl.empty_ledger(), rules_path=self.rules)["blocked"])

    def test_register_snapshots_the_prediction_and_records_actuals(self):
        led = fl.empty_ledger()
        v = fl.register(led, "vid1", short=1, published="2026-10-20")
        self.assertEqual(v["version"], "rewrite")
        self.assertEqual(v["prediction"]["overall"], 90)
        self.assertIn(PROMISE, v["prediction"]["features"])
        self.assertTrue(any(k.startswith("packaging.first_frame.") for k in v["prediction"]["features"]))
        fl.record(led, "vid1", "studio", avg_view_pct=71.5, viewed_pct=64.0)
        self.assertEqual(fl.latest(v, "viewed_pct"), 64.0)
        with self.assertRaises(SystemExit):
            fl.register(led, "vid1", short=1)          # no duplicates
        with self.assertRaises(SystemExit):
            fl.record(led, "nope", "studio", avg_view_pct=50)

    def test_ingests_youtube_analytics_shape(self):
        led = fl.empty_ledger()
        fl.register(led, "abc", short=3, published="2026-10-20")
        payload = {"columnHeaders": [{"name": "video"}, {"name": "views"}, {"name": "engagedViews"},
                                     {"name": "averageViewPercentage"}],
                   "rows": [["abc", 1200, 900, 68.2], ["not-ours", 5, 5, 10.0]]}
        self.assertEqual(fl.ingest_vidiq(led, payload), ["abc"])
        self.assertEqual(fl.latest(led["videos"][0], "avg_view_pct"), 68.2)
        self.assertEqual(fl.latest(led["videos"][0], "engaged_views"), 900)

    def test_immature_videos_are_left_out(self):
        led = simulated_ledger(10)
        for v in led["videos"]:
            v["published"] = "2026-09-29"
        self.assertEqual(fl.report(led, on="2026-10-01")["mature"], 0)

    def test_finds_planted_effects(self):
        rep = fl.report(simulated_ledger(24), on="2026-10-01")
        self.assertEqual(self.verdict(rep, PROMISE)["verdict"], "supported")
        self.assertEqual(self.verdict(rep, LOOP)["verdict"], "contradicted")
        self.assertEqual(self.verdict(rep, CARRY)["verdict"], "no clear effect")

    def test_small_samples_get_no_verdict(self):
        rep = fl.report(simulated_ledger(6), on="2026-10-01")
        self.assertTrue(all(r["verdict"] == "not enough data" for r in rep["rules"]))

    def test_calibration_waits_for_enough_videos(self):
        out = fl.calibrate(simulated_ledger(12), apply=True, rules_path=self.rules, on="2026-10-01")
        self.assertIn("Needs 20", out["blocked"])
        self.assertEqual(json.load(open(self.rules))["version"], 1)

    def test_calibration_moves_weights_the_right_way(self):
        before = json.load(open(self.rules))
        led = simulated_ledger(30)
        out = fl.calibrate(led, apply=True, rules_path=self.rules, on="2026-10-01")
        after = json.load(open(self.rules))
        share = lambda r, g, k: r[g][k]["points"] / sum(v["points"] for v in r[g].values() if isinstance(v, dict))
        self.assertGreater(share(after, "hook_rubric", "promise_in_window"),
                           share(before, "hook_rubric", "promise_in_window"))
        self.assertLess(share(after, "ending_rubric", "loops_to_hook"),
                        share(before, "ending_rubric", "loops_to_hook"))
        self.assertEqual(after["version"], before["version"] + 1)
        self.assertEqual(after["calibrated_on_videos"], 30)
        self.assertAlmostEqual(after["pace_words_per_second"], 2.3, places=1)
        self.assertTrue(os.path.exists(os.path.join(fl.HISTORY, "v1.json")))   # old rules kept
        self.assertEqual(len(led["calibrations"]), 1)
        self.assertIsNotNone(out["spearman_after"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
