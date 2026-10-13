import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { findDefaultBlueprint, printAreaGroups, placementFor, buildProductPayload, pngInfo, normalizeVariants } from '../server/product.js';

const root = path.join(import.meta.dirname, '..');

test('default product: Bella+Canvas 3001 matched by name, preferring the plain unisex tee', () => {
  const bps = [
    { id: 1, title: 'Youth Short Sleeve Tee', brand: 'Bella+Canvas', model: '3001Y' },
    { id: 2, title: 'Unisex CVC Jersey T-shirt', brand: 'Bella+Canvas', model: '3001CVC' },
    { id: 3, title: 'Unisex Jersey Short Sleeve Tee', brand: 'Bella + Canvas', model: '3001' },
    { id: 4, title: 'Unisex Heavy Cotton Tee', brand: 'Gildan', model: '5000' },
  ];
  assert.equal(findDefaultBlueprint(bps).id, 3);
  assert.equal(findDefaultBlueprint(bps.filter((b) => b.id === 4)), null);
});

test('placement: same-shape area fills it; different shape is scaled to fit', () => {
  assert.deepEqual(placementFor({ width: 4500, height: 5100 }, { width: 4500, height: 5100 }), { x: 0.5, y: 0.5, scale: 1, angle: 0 });
  // A wide, short area: the tall image must shrink so its height fits.
  const p = placementFor({ width: 4000, height: 2000 }, { width: 4500, height: 5100 });
  assert.ok(p.scale < 1);
  assert.ok(Math.abs(p.scale * 4000 * (5100 / 4500) - 2000) < 1);
});

test('payload: only selected variants, integer cents, one print area per size group', () => {
  const variants = normalizeVariants({
    variants: [
      { id: 10, title: 'Black / S', options: { color: 'Black', size: 'S' }, placeholders: [{ position: 'front', width: 4500, height: 5100 }] },
      { id: 11, title: 'Black / 2XL', options: { color: 'Black', size: '2XL' }, placeholders: [{ position: 'front', width: 4000, height: 2000 }] },
      { id: 12, title: 'White / S', options: { color: 'White', size: 'S' }, placeholders: [{ position: 'front', width: 4500, height: 5100 }] },
    ],
  });
  assert.ok(variants.every((v) => !('cost' in v)));
  const p = buildProductPayload({
    title: 'T', description: 'D', blueprintId: '5', printProviderId: '6', priceCents: 2499,
    variants, selectedIds: [10, 11], position: 'front', imageId: 'img', image: { width: 4500, height: 5100 },
  });
  assert.equal(p.blueprint_id, 5);
  assert.deepEqual(p.variants, [{ id: 10, price: 2499, is_enabled: true }, { id: 11, price: 2499, is_enabled: true }]);
  assert.equal(p.print_areas.length, 2);
  assert.deepEqual(p.print_areas[0].variant_ids, [10]);
  assert.equal(p.print_areas[0].placeholders[0].images[0].scale, 1);
  assert.ok(p.print_areas[1].placeholders[0].images[0].scale < 1);
  assert.deepEqual(printAreaGroups(variants, 'back'), []);
});

test('pngInfo reads dimensions from the header and rejects non-PNG', () => {
  const buf = Buffer.alloc(40);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf);
  buf.write('IHDR', 12, 'ascii');
  buf.writeUInt32BE(4500, 16);
  buf.writeUInt32BE(5100, 20);
  buf[25] = 6;
  assert.deepEqual(pngInfo(buf), { width: 4500, height: 5100, colorType: 6 });
  assert.equal(pngInfo(Buffer.from('nope')), null);
});

test('templates ship placeholder text only — no pre-written slogans', async () => {
  const src = fs.readFileSync(path.join(root, 'public/js/templates.js'), 'utf8');
  const { PLACEHOLDERS } = await import('../public/js/templates.js');
  const texts = [...src.matchAll(/\btext:\s*'([^']*)'/g)].map((m) => m[1]);
  assert.ok(texts.length >= 6);
  for (const t of texts) assert.ok(PLACEHOLDERS.includes(t), `template text "${t}" is not a placeholder`);
  // Default new-text layer is a placeholder too.
  const model = fs.readFileSync(path.join(root, 'public/js/model.js'), 'utf8');
  const factory = model.slice(model.indexOf('export function textLayer'), model.indexOf('export function shapeLayer'));
  for (const m of factory.matchAll(/\btext:\s*'([^']*)'/g)) assert.ok(PLACEHOLDERS.includes(m[1]));
});

test('no hardcoded Printify IDs in app code', () => {
  for (const f of ['server.js', 'server/printify.js', 'server/product.js', 'public/js/product.js', 'public/js/publish.js', 'public/js/screens.js']) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert.ok(!/blueprint(_id|Id)\s*[:=]\s*\d/.test(src), `${f} hardcodes a blueprint id`);
    assert.ok(!/(print_provider_id|printProviderId)\s*[:=]\s*\d/.test(src), `${f} hardcodes a provider id`);
  }
});
