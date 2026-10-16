'use strict';
/**
 * Source time <-> edit time.
 *
 * Once silence removal takes ranges out of the voice track, every downstream
 * decision has to be expressed in *edit* time, not source time. The transcript,
 * the emphasis marks, the beats and the B-roll slots are all discovered against
 * the original recording, so they all pass through this map on the way onto the
 * timeline. Getting this wrong is what makes captions drift, so it is one small
 * class with one job.
 */

const { round } = require('../utils');

class TimeMap {
  /**
   * @param {Array} keepRanges ordered, non-overlapping [{start,end}] of source
   *                           time that survives into the edit.
   */
  constructor(keepRanges) {
    this.ranges = (keepRanges || [])
      .filter((r) => r.end > r.start)
      .sort((a, b) => a.start - b.start);

    let acc = 0;
    this.offsets = this.ranges.map((r) => {
      const o = { ...r, editStart: acc, editEnd: acc + (r.end - r.start) };
      acc += r.end - r.start;
      return o;
    });
    this.editDuration = round(acc, 3);
  }

  static identity(duration) {
    return new TimeMap([{ start: 0, end: duration }]);
  }

  get isIdentity() {
    return this.ranges.length === 1 && this.ranges[0].start === 0;
  }

  /**
   * Map a source timestamp into edit time.
   * A timestamp inside a removed range snaps to the nearest surviving edge,
   * which keeps a caption that straddled a cut attached to the right words.
   */
  toEdit(t) {
    if (!this.offsets.length) return 0;
    for (const r of this.offsets) {
      if (t >= r.start && t <= r.end) return round(r.editStart + (t - r.start), 3);
    }
    if (t < this.offsets[0].start) return 0;
    for (let i = 0; i < this.offsets.length - 1; i++) {
      const cur = this.offsets[i];
      const next = this.offsets[i + 1];
      if (t > cur.end && t < next.start) {
        // In the gap: snap to whichever side is closer.
        return (t - cur.end) <= (next.start - t) ? round(cur.editEnd, 3) : round(next.editStart, 3);
      }
    }
    return this.editDuration;
  }

  /** Map an edit timestamp back to source time — used when scrubbing. */
  toSource(t) {
    if (!this.offsets.length) return 0;
    for (const r of this.offsets) {
      if (t >= r.editStart && t <= r.editEnd) return round(r.start + (t - r.editStart), 3);
    }
    const last = this.offsets[this.offsets.length - 1];
    return round(t <= 0 ? this.offsets[0].start : last.end, 3);
  }

  /**
   * Map a source range. Returns null when the range was removed entirely, so
   * callers can drop the caption or beat instead of emitting a zero-length one.
   */
  rangeToEdit(start, end) {
    const s = this.toEdit(start);
    const e = this.toEdit(end);
    if (e - s < 0.02) return null;
    return { start: s, end: e };
  }

  /** True when a source timestamp survived the cut. */
  survives(t) {
    return this.ranges.some((r) => t >= r.start && t <= r.end);
  }
}

module.exports = { TimeMap };
