// 共用元件：按鈕、面板、標籤、頁籤、進度條、列表項目、空狀態
import { h, svg, type Child } from '../dom';
import { ICONS, RESOURCE_ICONS, type IconName, type ResourceIcon } from '../art/icons';
import { audio } from '../audio';
import { userAsset } from '../assets';

const PACK_ICONS: Partial<Record<IconName, string>> = {
  cards: 'pack-nav-cards', summon: 'pack-nav-summon',
  shop: 'pack-shop-coin', gift: 'pack-login-chest',
};

/** 保留共用 SVG 尺寸介面，內容使用素材包原圖；缺圖時仍可辨識操作。 */
function assetIcon(name: string | undefined, fallback: string): SVGSVGElement {
  const url = name && userAsset('ui', name);
  if (!url) return svg(fallback);
  const el = svg('<svg viewBox="0 0 24 24" aria-hidden="true" class="pack-icon"></svg>');
  const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
  img.setAttribute('href', url);
  img.setAttribute('width', '24');
  img.setAttribute('height', '24');
  img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  img.addEventListener('error', () => el.replaceWith(svg(fallback)), { once: true });
  el.append(img);
  return el;
}

export function icon(name: IconName): SVGSVGElement {
  return assetIcon(PACK_ICONS[name], ICONS[name]);
}

export function resourceIcon(name: ResourceIcon): SVGSVGElement {
  if (name === 'stamina') return svg(RESOURCE_ICONS.stamina);
  return assetIcon(`pack-resource-${name}`, RESOURCE_ICONS[name]);
}

export interface ButtonOptions {
  variant?: 'primary' | 'danger' | 'ghost';
  small?: boolean;
  block?: boolean;
  icon?: IconName;
  disabled?: boolean;
  /** 價格顯示在按鈕右側 */
  cost?: { kind: ResourceIcon; amount: number };
  sound?: 'tap' | 'confirm' | 'back' | false;
  onClick?: (e: MouseEvent) => void;
}

export function button(label: Child, opts: ButtonOptions = {}): HTMLButtonElement {
  const el = h(
    'button',
    {
      type: 'button',
      class: ['btn', opts.variant, opts.small && 'small', opts.block && 'block'],
      disabled: opts.disabled,
    },
    opts.icon && icon(opts.icon),
    label,
    opts.cost && h('span', { class: 'cost' }, resourceIcon(opts.cost.kind), opts.cost.amount.toLocaleString()),
  );
  el.addEventListener('click', (e) => {
    const sound = opts.sound ?? (opts.variant === 'primary' ? 'confirm' : 'tap');
    if (sound) audio.play(sound);
    opts.onClick?.(e);
  });
  return el;
}

export function iconButton(name: IconName, label: string, onClick: () => void): HTMLButtonElement {
  return h('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, onClick: () => { audio.play('tap'); onClick(); } }, icon(name));
}

export function panel(opts: { title?: string; gold?: boolean } | null, ...children: Child[]): HTMLElement {
  return h('section', { class: ['panel', opts?.gold && 'gold'] }, opts?.title && h('h2', null, opts.title), ...children);
}

export function sectionTitle(text: string): HTMLElement {
  return h('div', { class: 'section-title' }, text);
}

export function badge(text: Child, variant?: string): HTMLElement {
  return h('span', { class: ['badge', variant] }, text);
}

export function resource(kind: ResourceIcon, value: Child): HTMLElement {
  return h('span', { class: 'resource' }, resourceIcon(kind), value);
}

export interface BarOptions {
  value: number;
  max: number;
  variant?: 'hp' | 'exp' | 'gold';
  label?: string | boolean;
  /** 受傷時的紅色殘影（上一次的數值） */
  previous?: number;
}

export function clampPct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function bar(opts: BarOptions): HTMLElement {
  const pct = clampPct(opts.value, opts.max);
  const ghost = opts.previous !== undefined ? clampPct(opts.previous, opts.max) : pct;
  const level = opts.variant === 'hp' ? (pct <= 20 ? 'critical' : pct <= 50 ? 'low' : '') : '';
  const label = opts.label === true ? `${Math.round(opts.value).toLocaleString()} / ${opts.max.toLocaleString()}` : opts.label || '';
  return h(
    'div',
    { class: ['bar', opts.variant, level], style: { '--pct': `${pct}%`, '--ghost': `${ghost}%` }, role: 'progressbar', 'aria-valuenow': String(opts.value), 'aria-valuemax': String(opts.max) },
    opts.previous !== undefined && h('div', { class: 'ghost-fill' }),
    h('div', { class: 'fill' }),
    label && h('div', { class: 'label' }, label),
  );
}

/** 更新現有的進度條（不重建 DOM）：戰鬥中每次命中都會呼叫，重建整條在低階手機上很貴 */
export function updateBar(el: Element, opts: BarOptions): void {
  const pct = clampPct(opts.value, opts.max);
  const ghost = opts.previous !== undefined ? clampPct(opts.previous, opts.max) : pct;
  const bar = el as HTMLElement;
  bar.style.setProperty('--pct', `${pct}%`);
  bar.style.setProperty('--ghost', `${ghost}%`);
  bar.setAttribute('aria-valuenow', String(opts.value));
  bar.setAttribute('aria-valuemax', String(opts.max));
  if (opts.variant === 'hp') {
    bar.classList.toggle('critical', pct <= 20);
    bar.classList.toggle('low', pct > 20 && pct <= 50);
  }
  const ghostFill = bar.querySelector('.ghost-fill');
  if (opts.previous !== undefined && !ghostFill) bar.insertBefore(h('div', { class: 'ghost-fill' }), bar.firstChild);
  if (opts.label === true) {
    const label = bar.querySelector('.label');
    if (label) label.textContent = `${Math.round(opts.value).toLocaleString()} / ${opts.max.toLocaleString()}`;
  }
}

export function tabs<T extends string>(items: { id: T; label: string }[], active: T, onChange: (id: T) => void): HTMLElement {
  const el = h('div', { class: 'tabs', role: 'tablist' });
  for (const it of items) {
    const b = h('button', { type: 'button', role: 'tab', class: it.id === active ? 'active' : '', 'aria-selected': String(it.id === active) }, it.label);
    b.addEventListener('click', () => {
      el.querySelectorAll('button').forEach((x) => { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
      b.classList.add('active');
      b.setAttribute('aria-selected', 'true');
      audio.play('tap');
      onChange(it.id);
    });
    el.appendChild(b);
  }
  return el;
}

export interface ListItemOptions {
  leading?: Child;
  title: Child;
  sub?: Child;
  trailing?: Child;
  locked?: boolean;
  onClick?: () => void;
}

export function listItem(opts: ListItemOptions): HTMLElement {
  return h(
    'button',
    { type: 'button', class: ['list-item', opts.locked && 'locked'], onClick: () => { if (opts.locked) return; audio.play('tap'); opts.onClick?.(); } },
    opts.leading,
    h('div', { class: 'grow' }, h('div', { class: 'name' }, opts.title), opts.sub && h('div', { class: 'sub' }, opts.sub)),
    opts.trailing ?? (opts.locked ? h('span', { class: 'chev' }, icon('lock')) : h('span', { class: 'chev' }, icon('chevron'))),
  );
}

export function emptyState(iconName: IconName, title: string, detail?: string): HTMLElement {
  return h('div', { class: 'empty-state' }, icon(iconName), h('strong', null, title), detail && h('div', { class: 'small-text' }, detail));
}

export function stars(rarity: number): HTMLElement {
  return h('span', { class: 'stars', 'aria-label': `${rarity} 星` }, '★'.repeat(rarity));
}

export interface SliderOptions {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  onInput: (v: number) => void;
}

export function slider(opts: SliderOptions): HTMLElement {
  const fmt = opts.format ?? ((v: number) => `${Math.round(v * 100)}`);
  const out = h('output', null, fmt(opts.value));
  const input = h('input', { type: 'range', min: String(opts.min ?? 0), max: String(opts.max ?? 1), step: String(opts.step ?? 0.05), value: String(opts.value), 'aria-label': opts.label });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = fmt(v);
    opts.onInput(v);
  });
  return h('div', { class: 'field' }, h('label', null, opts.label), input, out);
}

export function toggle(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const input = h('input', { type: 'checkbox', checked, 'aria-label': label });
  input.addEventListener('change', () => { audio.play('tap'); onChange(input.checked); });
  return h('div', { class: 'field' }, h('label', null, label), h('span', { class: 'switch' }, input, h('span')));
}
