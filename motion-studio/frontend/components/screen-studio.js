import { el, tap } from '../utils/dom.js';
import { CATEGORIES } from '../models/categories.js';
import { presetsInCategory, getPreset } from '../models/presets.js';
import { DURATIONS, STRENGTH_STOPS, QUALITY_TIERS, FPS_OPTIONS } from '../config/app.config.js';
import { chipRow, segmented, slider, disclosure, sectionLabel } from './controls.js';
import { Stage } from './stage.js';

/**
 * Screen 2 — the studio.
 *
 * Layout is fixed: the 9:16 stage takes whatever height is left, and the
 * controls sit in a sheet under it with the primary action pinned to the
 * bottom. Nothing important is ever more than one thumb-scroll away.
 */
export function StudioScreen({ state, onCropChange, onChange, onGenerate }) {
  const stage = Stage({ onCropChange });
  let currentCategory = state.categoryId;

  const presetDesc = el('div', { class: 'preset__desc' });

  const presetRow = { node: el('div', { class: 'chiprow' }), select: () => {} };
  const presetHost = el('div', {}, [presetRow.node]);

  function buildPresetRow(categoryId, activeId) {
    const items = presetsInCategory(categoryId).map(p => ({
      id: p.id, label: p.name, emoji: p.emoji,
    }));
    const row = chipRow({
      items,
      value: activeId,
      className: 'chip--preset',
      onChange: (id) => {
        const preset = getPreset(id);
        // Selecting a preset also adopts its recommended strength and length:
        // that is what "authored" means, and the user can still override.
        onChange({
          presetId: id,
          strength: nearestStop(preset.intensity),
          duration: preset.duration,
        });
      },
    });
    presetHost.replaceChildren(row.node);
    presetRow.node = row.node;
    presetRow.select = row.select;
  }

  const categoryRow = chipRow({
    items: CATEGORIES.map(c => ({ id: c.id, label: c.label, emoji: c.emoji })),
    value: state.categoryId,
    onChange: (id) => {
      const first = presetsInCategory(id)[0];
      buildPresetRow(id, first.id);
      onChange({
        categoryId: id,
        presetId: first.id,
        strength: nearestStop(first.intensity),
        duration: first.duration,
      });
    },
  });

  const strength = segmented({
    label: 'Motion strength',
    options: STRENGTH_STOPS.map(s => ({ id: s.id, label: s.label })),
    value: stopIdFor(state.controls.strength),
    onChange: (id) => {
      const stop = STRENGTH_STOPS.find(s => s.id === id);
      onChange({ strength: stop.value });
    },
  });

  const duration = chipRow({
    items: DURATIONS.map(d => ({ id: String(d), label: `${d}s` })),
    value: String(state.duration),
    onChange: (id) => onChange({ duration: Number(id) }),
  });

  const pct = v => `${Math.round(v)}%`;

  const smooth = slider({
    label: 'Smoothness', value: state.controls.smoothness * 100, format: pct,
    onInput: v => onChange({ smoothness: v / 100 }, { quiet: true }),
  });
  const speed = slider({
    label: 'Camera speed', value: state.controls.cameraSpeed * 100, format: pct,
    onInput: v => onChange({ cameraSpeed: v / 100 }, { quiet: true }),
  });
  const effect = slider({
    label: 'Effect intensity', value: state.controls.effectIntensity * 100, format: pct,
    onInput: v => onChange({ effectIntensity: v / 100 }, { quiet: true }),
  });

  const quality = segmented({
    label: 'Quality',
    options: QUALITY_TIERS.map(t => ({ id: t.id, label: t.label })),
    value: state.tierId,
    onChange: id => onChange({ tierId: id }),
  });

  const fps = segmented({
    label: 'Frame rate',
    options: FPS_OPTIONS.map(f => ({ id: String(f), label: `${f} fps` })),
    value: String(state.fps),
    onChange: id => onChange({ fps: Number(id) }),
  });

  const generateBtn = el('button', {
    class: 'btn btn--primary', type: 'button',
    onClick: () => { tap(14); onGenerate(); },
  }, ['CREATE VIDEO']);

  const sheet = el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet__grip', 'aria-hidden': 'true' }),
    el('div', { class: 'sheet__scroll' }, [
      sectionLabel('Motion'),
      categoryRow.node,
      presetHost,
      presetDesc,

      sectionLabel('Motion strength'),
      strength.node,

      sectionLabel('Duration'),
      duration.node,

      disclosure({
        label: '⚙  Fine tuning',
        children: [
          smooth.node, speed.node, effect.node,
          sectionLabel('Quality'), quality.node,
          sectionLabel('Frame rate'), fps.node,
        ],
      }),
    ]),
    el('div', { class: 'sheet__foot' }, [generateBtn]),
  ]);

  buildPresetRow(state.categoryId, state.presetId);

  const node = el('section', { class: 'screen' }, [stage.node, sheet]);

  return {
    node,
    canvas: stage.canvas,
    setCrop: stage.setCrop,

    /** Re-syncs every control to the app state, without firing callbacks. */
    sync(s) {
      const preset = getPreset(s.presetId);
      if (preset.category !== currentCategory) {
        currentCategory = preset.category;
        buildPresetRow(preset.category, preset.id);
      }
      categoryRow.select(preset.category);
      presetRow.select(preset.id);
      presetDesc.textContent = preset.description || '';
      strength.set(stopIdFor(s.controls.strength));
      duration.select(String(s.duration));
      smooth.set(s.controls.smoothness * 100);
      speed.set(s.controls.cameraSpeed * 100);
      effect.set(s.controls.effectIntensity * 100);
      quality.set(s.tierId);
      fps.set(String(s.fps));
      const tier = QUALITY_TIERS.find(t => t.id === s.tierId) || QUALITY_TIERS[0];
      stage.setBadge(`9:16 · ${tier.width}×${tier.height} · ${s.duration}s`);
    },

    setBusy(busy) {
      generateBtn.disabled = busy;
      generateBtn.textContent = busy ? 'WORKING…' : 'CREATE VIDEO';
    },
  };

  function nearestStop(v) {
    let best = STRENGTH_STOPS[0];
    for (const s of STRENGTH_STOPS) {
      if (Math.abs(s.value - v) < Math.abs(best.value - v)) best = s;
    }
    return best.value;
  }
}

function stopIdFor(value) {
  let best = STRENGTH_STOPS[0];
  for (const s of STRENGTH_STOPS) {
    if (Math.abs(s.value - value) < Math.abs(best.value - value)) best = s;
  }
  return best.id;
}
