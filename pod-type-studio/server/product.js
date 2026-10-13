// Pure helpers for turning catalog data + an exported PNG into Printify's
// create-product payload. No IDs are hardcoded: everything comes from the
// live catalog responses passed in.

// The default preference is matched by NAME, not ID: Bella+Canvas 3001.
export function findDefaultBlueprint(blueprints) {
  const isBella = (b) => /bella\s*\+?\s*canvas/i.test(`${b.brand} ${b.title}`);
  const is3001 = (b) => /\b3001\b/.test(`${b.model} ${b.title}`);
  const matches = (blueprints || []).filter((b) => isBella(b) && is3001(b));
  if (!matches.length) return null;
  // Prefer the plain unisex jersey tee over 3001 variants (CVC, youth, etc.).
  const score = (b) =>
    (/unisex jersey short sleeve tee/i.test(b.title) ? 4 : 0) +
    (String(b.model).trim() === '3001' ? 2 : 0) +
    (/unisex/i.test(b.title) ? 1 : 0);
  return matches.sort((a, b) => score(b) - score(a))[0];
}

export function searchBlueprints(blueprints, q, limit = 40) {
  const terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const list = (blueprints || []).filter((b) => {
    const hay = `${b.title} ${b.brand} ${b.model}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
  return list.slice(0, limit).map(blueprintSummary);
}

export function blueprintSummary(b) {
  return { id: b.id, title: b.title, brand: b.brand, model: b.model, image: (b.images || [])[0] || null };
}

// Flatten the catalog variants response into what the UI needs. `cost` is only
// passed through if Printify actually sent it — never invented.
export function normalizeVariants(resp) {
  return (resp?.variants || []).map((v) => {
    const out = {
      id: v.id,
      title: v.title,
      color: v.options?.color ?? null,
      size: v.options?.size ?? null,
      placeholders: (v.placeholders || []).map((p) => ({ position: p.position, width: p.width, height: p.height })),
    };
    if (typeof v.cost === 'number') out.cost = v.cost;
    if (typeof v.is_available === 'boolean') out.available = v.is_available;
    return out;
  });
}

// Group variants by the size of their print area for one position. Most tee
// providers use one front size for every variant, but some vary by size.
export function printAreaGroups(variants, position) {
  const groups = new Map();
  for (const v of variants) {
    const p = v.placeholders.find((x) => x.position === position);
    if (!p) continue;
    const key = `${p.width}x${p.height}`;
    if (!groups.has(key)) groups.set(key, { width: p.width, height: p.height, variantIds: [] });
    groups.get(key).variantIds.push(v.id);
  }
  return [...groups.values()].sort((a, b) => b.variantIds.length - a.variantIds.length);
}

// The canvas is sized to the most common print area. For any group whose area
// has a different shape, the image is centered and scaled to fit inside it.
// Printify's `scale` is relative to the print area width (1 = full width).
export function placementFor(group, image) {
  const areaAspect = group.height / group.width;
  const imgAspect = image.height / image.width;
  const scale = imgAspect > areaAspect ? areaAspect / imgAspect : 1;
  return { x: 0.5, y: 0.5, scale: Number(scale.toFixed(6)), angle: 0 };
}

export function buildProductPayload({ title, description, blueprintId, printProviderId, priceCents, variants, selectedIds, position, imageId, image }) {
  const selected = new Set(selectedIds.map(Number));
  const chosen = variants.filter((v) => selected.has(v.id));
  const groups = printAreaGroups(chosen, position);
  return {
    title,
    description,
    blueprint_id: Number(blueprintId),
    print_provider_id: Number(printProviderId),
    variants: chosen.map((v) => ({ id: v.id, price: priceCents, is_enabled: true })),
    print_areas: groups.map((g) => ({
      variant_ids: g.variantIds,
      placeholders: [{ position, images: [{ id: imageId, ...placementFor(g, image) }] }],
    })),
  };
}

// Read width/height straight from the PNG header, so the server can check the
// export really matches the print area before uploading it.
export function pngInfo(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!buf || buf.length < 33 || !sig.every((b, i) => buf[i] === b)) return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

export function productSummary(p, shopId, urlTemplate) {
  const variants = (p.variants || []).filter((v) => v.is_enabled !== false);
  return {
    id: p.id,
    shopId,
    title: p.title,
    visible: Boolean(p.visible),
    isLocked: Boolean(p.is_locked),
    images: (p.images || []).map((i) => ({ src: i.src, position: i.position, isDefault: Boolean(i.is_default), variantIds: i.variant_ids || [] })),
    variants: variants.map((v) => {
      const out = { id: v.id, title: v.title, price: v.price };
      if (typeof v.cost === 'number') out.cost = v.cost;
      return out;
    }),
    printifyUrl: printifyUrl(urlTemplate, shopId, p.id),
  };
}

export function printifyUrl(template, shopId, productId) {
  return template.replace('{shopId}', encodeURIComponent(shopId)).replace('{productId}', encodeURIComponent(productId));
}
