/**
 * A minimal ISO Base Media File Format (MP4) writer.
 *
 * WebCodecs hands back raw encoded frames; something has to wrap them in a
 * container. Every off-the-shelf muxer is an npm dependency and a CDN fetch,
 * which this project does not want — so this is ~300 lines of box writing
 * instead.
 *
 * It produces a non-fragmented, faststart MP4: ftyp, then moov, then one
 * mdat holding every sample. moov is built twice — once to learn its size,
 * once with the real chunk offset — which is exact because every box in it
 * is fixed-width given the sample count.
 *
 * Supports avc1 (H.264) and vp09 (VP9) sample entries.
 */

const TIMESCALE = 90_000;

export class Mp4Muxer {
  /**
   * @param {object} o
   * @param {number} o.width
   * @param {number} o.height
   * @param {'avc1'|'vp09'} o.codec
   * @param {Uint8Array|null} o.description  avcC payload for H.264
   * @param {string} o.codecString           e.g. 'vp09.00.10.08'
   */
  constructor({ width, height, codec, description = null, codecString = '' }) {
    this.width = width;
    this.height = height;
    this.codec = codec;
    this.description = description ? new Uint8Array(description) : null;
    this.codecString = codecString;
    this.samples = [];   // { data, timestampUs, durationUs, isSync }
    this.finished = false;
  }

  /** @param {EncodedVideoChunk} chunk */
  addChunk(chunk) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    this.samples.push({
      data,
      timestampUs: chunk.timestamp,
      durationUs: chunk.duration ?? 0,
      isSync: chunk.type === 'key',
    });
  }

  setDescription(desc) {
    if (desc && !this.description) this.description = new Uint8Array(desc);
  }

  /** @returns {Blob} an MP4 */
  finalize({ defaultFrameDurationUs }) {
    if (!this.samples.length) throw new Error('No frames were encoded');
    if (this.codec === 'avc1' && !this.description) {
      throw new Error('Missing avcC description from the encoder');
    }

    // Decode order is what the encoder gave us. Presentation order is by
    // timestamp. They differ only if the encoder emitted B-frames, in which
    // case a ctts box carries the offsets.
    const n = this.samples.length;
    const byPts = this.samples.map((s, i) => ({ s, i }))
                              .sort((a, b) => a.s.timestampUs - b.s.timestampUs);

    // Presentation durations, from the gaps between successive timestamps.
    const ptsDurations = new Array(n);
    for (let k = 0; k < n; k++) {
      const cur = byPts[k].s.timestampUs;
      const next = k + 1 < n ? byPts[k + 1].s.timestampUs : null;
      const d = byPts[k].s.durationUs ||
                (next != null ? next - cur : defaultFrameDurationUs);
      ptsDurations[k] = Math.max(1, Math.round(d));
    }

    // DTS runs in decode order with the same set of durations, starting at 0.
    const dtsDeltas = new Array(n);
    for (let i = 0; i < n; i++) dtsDeltas[i] = ptsDurations[Math.min(i, n - 1)];

    const dts = new Array(n);
    let acc = 0;
    for (let i = 0; i < n; i++) { dts[i] = acc; acc += dtsDeltas[i]; }

    const pts0 = byPts[0].s.timestampUs;
    const ctsOffsets = new Array(n);
    let needsCtts = false;
    let minOffset = 0;
    for (let i = 0; i < n; i++) {
      const off = (this.samples[i].timestampUs - pts0) - dts[i];
      ctsOffsets[i] = off;
      if (off !== 0) needsCtts = true;
      if (off < minOffset) minOffset = off;
    }
    // ctts version 0 holds unsigned offsets. Shifting every sample by the
    // most negative one adds a constant presentation delay and keeps them
    // all non-negative, which every player handles.
    if (minOffset < 0) for (let i = 0; i < n; i++) ctsOffsets[i] -= minOffset;

    const toTs = us => Math.round(us * TIMESCALE / 1_000_000);

    // Derive the track duration by summing the *rounded* per-sample deltas,
    // not by converting the microsecond total. Otherwise mvhd/mdhd and the
    // stts table disagree by a few ticks, and some players trust the wrong one.
    const sttsValues = dtsDeltas.map(toTs);
    const sttsEntries = runLengthEncode(sttsValues);
    const cttsEntries = needsCtts ? runLengthEncode(ctsOffsets.map(toTs)) : null;
    const sizes = this.samples.map(s => s.data.byteLength);
    const syncIndices = [];
    this.samples.forEach((s, i) => { if (s.isSync) syncIndices.push(i + 1); });
    const allSync = syncIndices.length === n;

    const durationTs = sttsValues.reduce((a, b) => a + b, 0);
    const mdatSize = 8 + sizes.reduce((a, b) => a + b, 0);

    const ftyp = this._ftyp();

    const buildMoov = (chunkOffset) => this._moov({
      durationTs, sttsEntries, cttsEntries, sizes,
      syncIndices: allSync ? null : syncIndices, chunkOffset,
    });

    // Pass 1 to learn the size, pass 2 with the true offset. Identical length
    // by construction: stco entries are fixed-width.
    const probe = buildMoov(0);
    const dataOffset = ftyp.byteLength + probe.byteLength + 8;
    const moov = buildMoov(dataOffset);
    if (moov.byteLength !== probe.byteLength) {
      throw new Error('moov size changed between passes');
    }

    const mdatHeader = new Uint8Array(8);
    writeU32(mdatHeader, 0, mdatSize);
    writeType(mdatHeader, 4, 'mdat');

    const parts = [ftyp, moov, mdatHeader, ...this.samples.map(s => s.data)];
    this.finished = true;
    return new Blob(parts, { type: 'video/mp4' });
  }

  /* ----------------------------- boxes ------------------------------- */

  _ftyp() {
    const brands = this.codec === 'avc1'
      ? ['isom', 'iso2', 'avc1', 'mp41']
      : ['isom', 'iso2', 'mp41'];
    const payload = new Uint8Array(8 + brands.length * 4);
    writeType(payload, 0, 'isom');
    writeU32(payload, 4, 0x200);
    brands.forEach((b, i) => writeType(payload, 8 + i * 4, b));
    return box('ftyp', payload);
  }

  _moov({ durationTs, sttsEntries, cttsEntries, sizes, syncIndices, chunkOffset }) {
    return box('moov',
      this._mvhd(durationTs),
      this._trak({ durationTs, sttsEntries, cttsEntries, sizes, syncIndices, chunkOffset }),
    );
  }

  _mvhd(durationTs) {
    const b = new Uint8Array(100);
    writeU32(b, 0, 0);                 // version + flags
    writeU32(b, 4, 0);                 // creation time
    writeU32(b, 8, 0);                 // modification time
    writeU32(b, 12, TIMESCALE);
    writeU32(b, 16, durationTs);
    writeU32(b, 20, 0x00010000);       // rate 1.0
    writeU16(b, 24, 0x0100);           // volume 1.0
    // 10 bytes reserved (26..35)
    writeMatrix(b, 36);
    // 24 bytes pre_defined (72..95)
    writeU32(b, 96, 2);                // next track id
    return box('mvhd', b);
  }

  _trak(args) {
    return box('trak', this._tkhd(args.durationTs), this._mdia(args));
  }

  _tkhd(durationTs) {
    const b = new Uint8Array(84);
    writeU32(b, 0, 0x00000007);        // version 0, flags: enabled | in movie | in preview
    writeU32(b, 4, 0);
    writeU32(b, 8, 0);
    writeU32(b, 12, 1);                // track id
    writeU32(b, 16, 0);                // reserved
    writeU32(b, 20, durationTs);
    // 8 bytes reserved (24..31)
    writeU16(b, 32, 0);                // layer
    writeU16(b, 34, 0);                // alternate group
    writeU16(b, 36, 0);                // volume (video = 0)
    writeU16(b, 38, 0);                // reserved
    writeMatrix(b, 40);
    writeU32(b, 76, this.width << 16); // 16.16 fixed
    writeU32(b, 80, this.height << 16);
    return box('tkhd', b);
  }

  _mdia(args) {
    return box('mdia', this._mdhd(args.durationTs), this._hdlr(), this._minf(args));
  }

  _mdhd(durationTs) {
    const b = new Uint8Array(24);
    writeU32(b, 0, 0);
    writeU32(b, 4, 0);
    writeU32(b, 8, 0);
    writeU32(b, 12, TIMESCALE);
    writeU32(b, 16, durationTs);
    writeU16(b, 20, 0x55C4);           // language 'und'
    writeU16(b, 22, 0);
    return box('mdhd', b);
  }

  _hdlr() {
    const name = 'VideoHandler';
    const b = new Uint8Array(24 + name.length + 1);
    writeU32(b, 0, 0);
    writeU32(b, 4, 0);                 // pre_defined
    writeType(b, 8, 'vide');
    // 12 bytes reserved (12..23)
    for (let i = 0; i < name.length; i++) b[24 + i] = name.charCodeAt(i);
    return box('hdlr', b);
  }

  _minf(args) {
    const vmhd = new Uint8Array(12);
    writeU32(vmhd, 0, 0x00000001);     // version 0, flags 1
    // graphicsmode + opcolor = 0

    const url = box('url ', u8([0, 0, 0, 1]));
    const drefPayload = new Uint8Array(8);
    writeU32(drefPayload, 0, 0);
    writeU32(drefPayload, 4, 1);       // entry count
    const dref = box('dref', drefPayload, url);

    return box('minf', box('vmhd', vmhd), box('dinf', dref), this._stbl(args));
  }

  _stbl({ sttsEntries, cttsEntries, sizes, syncIndices, chunkOffset }) {
    const children = [
      this._stsd(),
      tableBox('stts', sttsEntries, (b, o, e) => { writeU32(b, o, e.count); writeU32(b, o + 4, e.value); }, 8),
    ];

    if (cttsEntries) {
      children.push(tableBox('ctts', cttsEntries,
        (b, o, e) => { writeU32(b, o, e.count); writeI32(b, o + 4, e.value); }, 8));
    }
    if (syncIndices) {
      children.push(tableBox('stss', syncIndices, (b, o, v) => writeU32(b, o, v), 4));
    }

    // Every sample lives in one chunk, so stsc has a single entry and stco a
    // single offset.
    children.push(tableBox('stsc', [{ first: 1, perChunk: sizes.length, descIndex: 1 }],
      (b, o, e) => { writeU32(b, o, e.first); writeU32(b, o + 4, e.perChunk); writeU32(b, o + 8, e.descIndex); }, 12));

    const stsz = new Uint8Array(12 + sizes.length * 4);
    writeU32(stsz, 0, 0);
    writeU32(stsz, 4, 0);              // sample_size 0 = per-sample table
    writeU32(stsz, 8, sizes.length);
    sizes.forEach((s, i) => writeU32(stsz, 12 + i * 4, s));
    children.push(box('stsz', stsz));

    children.push(tableBox('stco', [chunkOffset], (b, o, v) => writeU32(b, o, v), 4));

    return box('stbl', ...children);
  }

  _stsd() {
    const entry = this.codec === 'avc1' ? this._avc1() : this._vp09();
    const b = new Uint8Array(8);
    writeU32(b, 0, 0);
    writeU32(b, 4, 1);                 // entry count
    return box('stsd', b, entry);
  }

  _visualSampleEntryHeader() {
    const b = new Uint8Array(78);
    // 6 reserved, then data_reference_index
    writeU16(b, 6, 1);
    // 2 pre_defined, 2 reserved, 12 pre_defined — all zero
    writeU16(b, 24, this.width);
    writeU16(b, 26, this.height);
    writeU32(b, 28, 0x00480000);       // 72 dpi
    writeU32(b, 32, 0x00480000);
    writeU32(b, 36, 0);                // reserved
    writeU16(b, 40, 1);                // frame count
    // 32-byte compressorname, first byte is the length
    const name = 'Motion Studio';
    b[42] = name.length;
    for (let i = 0; i < name.length; i++) b[43 + i] = name.charCodeAt(i);
    writeU16(b, 74, 0x0018);           // depth = 24
    writeI16(b, 76, -1);               // pre_defined
    return b;
  }

  _avc1() {
    return box('avc1', this._visualSampleEntryHeader(), box('avcC', this.description));
  }

  _vp09() {
    // vp09.PP.LL.DD — profile, level, bit depth
    const m = /^vp09\.(\d+)\.(\d+)\.(\d+)/.exec(this.codecString || '');
    const profile = m ? parseInt(m[1], 10) : 0;
    const level = m ? parseInt(m[2], 10) : 10;
    const bitDepth = m ? parseInt(m[3], 10) : 8;

    const vpcC = new Uint8Array(12);
    writeU32(vpcC, 0, 0x01000000);     // version 1, flags 0
    vpcC[4] = profile;
    vpcC[5] = level;
    // bitDepth(4) | chromaSubsampling(3) | videoFullRangeFlag(1)
    vpcC[6] = ((bitDepth & 0xF) << 4) | (1 << 1) | 0;
    vpcC[7] = 1;                       // colour primaries: BT.709
    vpcC[8] = 1;                       // transfer characteristics: BT.709
    vpcC[9] = 1;                       // matrix coefficients: BT.709
    writeU16(vpcC, 10, 0);             // codec initialization data size

    return box('vp09', this._visualSampleEntryHeader(), box('vpcC', vpcC));
  }
}

/* ---------------------------- byte helpers ---------------------------- */

function box(type, ...payloads) {
  let size = 8;
  for (const p of payloads) size += p.byteLength;
  const out = new Uint8Array(size);
  writeU32(out, 0, size);
  writeType(out, 4, type);
  let o = 8;
  for (const p of payloads) { out.set(p, o); o += p.byteLength; }
  return out;
}

/** A full box holding a count followed by fixed-width entries. */
function tableBox(type, entries, writeEntry, entrySize) {
  const b = new Uint8Array(8 + entries.length * entrySize);
  writeU32(b, 0, 0);                   // version + flags
  writeU32(b, 4, entries.length);
  entries.forEach((e, i) => writeEntry(b, 8 + i * entrySize, e));
  return box(type, b);
}

function runLengthEncode(values) {
  const out = [];
  for (const v of values) {
    const last = out[out.length - 1];
    if (last && last.value === v) last.count++;
    else out.push({ count: 1, value: v });
  }
  return out;
}

function writeU32(b, o, v) {
  b[o] = (v >>> 24) & 0xFF; b[o + 1] = (v >>> 16) & 0xFF;
  b[o + 2] = (v >>> 8) & 0xFF; b[o + 3] = v & 0xFF;
}
function writeI32(b, o, v) { writeU32(b, o, v < 0 ? v + 0x100000000 : v); }
function writeU16(b, o, v) { b[o] = (v >>> 8) & 0xFF; b[o + 1] = v & 0xFF; }
function writeI16(b, o, v) { writeU16(b, o, v < 0 ? v + 0x10000 : v); }
function writeType(b, o, s) { for (let i = 0; i < 4; i++) b[o + i] = s.charCodeAt(i); }
function u8(arr) { return new Uint8Array(arr); }

function writeMatrix(b, o) {
  // unity matrix: 1, 0, 0 / 0, 1, 0 / 0, 0, 1 in 16.16 and 2.30 fixed point
  const m = [0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000];
  m.forEach((v, i) => writeU32(b, o + i * 4, v));
}
