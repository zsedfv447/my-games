// 戰鬥可讀性：屬性剋制提示（提案 25）、敵人下一招預告（提案 5）、Combo 演出（提案 6）、技能就緒（提案 15）
import type { BattleState, EnemyState } from '../../battle/battle-state';
import type { BattleConfig } from '../../battle/damage';
import { comboBonusText, comboTier, effectiveMatchup, effectiveWeakTo, enemyAbilityList, liveReductions, newlyReadySkills, predictEnemyIntent, reducedWeaknesses, weakTo, type IntentAbility } from '../../battle/feedback';
import { ATTRIBUTE_NAMES } from '../art/palette';
import { audio } from '../audio';
import { button } from '../components/basic';
import { openDialog } from '../components/overlay';
import { h, svg } from '../dom';
import { statusName } from '../status-labels';
import { floatLabel } from './effects';
import { ringSummary } from './ring';
import { isMemberSealed } from '../../battle/skills/status';
import { LABEL } from '../wording';

// ---------- 屬性剋制 ----------

/**
 * 名牌的「弱：X」：剋制而且扣掉敵人目前的護盾／屬性減傷後仍大於 1 倍的屬性。
 * 減傷是持續中的狀態，所以每次更新敵人時重畫，狀態結束就恢復顯示。
 */
export function weakHint(e: EnemyState, config: BattleConfig): HTMLElement {
  const reduced = reducedWeaknesses(e.def.attribute, liveReductions(e), config);
  return h('div', { class: ['weak-hint', reduced.length > 0 && 'reduced'], title: reduced.length ? `${reduced.map((a) => ATTRIBUTE_NAMES[a]).join('、')}被減傷，目前不算弱點` : undefined }, `弱：${weakText(e, config)}`);
}

const weakText = (e: EnemyState, config: BattleConfig) => {
  const weak = effectiveWeakTo(e.def.attribute, liveReductions(e), config);
  if (weak.length) return weak.map((a) => ATTRIBUTE_NAMES[a]).join('、');
  // 本來有弱點，但目前都被減傷擋下
  return weakTo(e.def.attribute, config).length ? '—（減傷中）' : '—';
};

/** 隊員頭像標出對目前目標的剋制（▲）與被剋（▼）；teamRow 的子元素依隊員順序 */
export function markMatchups(teamRow: HTMLElement, state: BattleState, config: BattleConfig): void {
  const target = state.enemies[state.target];
  [...teamRow.children].forEach((thumb, i) => {
    const m = state.team[i];
    thumb.querySelector('.matchup-tag')?.remove();
    if (!m || !target) return;
    // 和名牌的「弱：X」一致：扣掉目標目前的減傷
    const mu = effectiveMatchup(m.card.attribute, target, config);
    if (mu !== 'neutral') thumb.appendChild(h('span', { class: `matchup-tag ${mu}`, 'aria-label': mu === 'advantage' ? '剋制目標' : '被目標剋制' }, mu === 'advantage' ? '▲' : '▼'));
  });
}

/** 被星紋封印的隊員：頭像灰階＋鎖鏈（不攻擊、不能施放主動技） */
export function markSeals(teamRow: HTMLElement, state: BattleState): void {
  [...teamRow.children].forEach((thumb, i) => {
    const sealed = isMemberSealed(state, i);
    thumb.classList.toggle('sealed', sealed);
    thumb.querySelector('.seal-chain')?.remove();
    if (sealed) thumb.appendChild(h('span', { class: 'seal-chain', 'aria-label': '被星紋封印' }, svg(SEAL_CHAIN_SVG)));
  });
}

/** 原創的封印鎖鏈：兩條交叉的鏈環＋中間的星紋鎖 */
const SEAL_CHAIN_SVG = `<svg viewBox="0 0 60 64" aria-hidden="true">
  <g fill="none" stroke="#d9dce8" stroke-width="3.2" stroke-linecap="round">
    ${[0, 1, 2, 3, 4].map((k) => `<ellipse cx="${8 + k * 11}" cy="${8 + k * 12}" rx="6" ry="3.6" transform="rotate(45 ${8 + k * 11} ${8 + k * 12})"/>`).join('')}
    ${[0, 1, 2, 3, 4].map((k) => `<ellipse cx="${52 - k * 11}" cy="${8 + k * 12}" rx="6" ry="3.6" transform="rotate(-45 ${52 - k * 11} ${8 + k * 12})"/>`).join('')}
  </g>
  <rect x="21" y="23" width="18" height="17" rx="3" fill="#3a3f5c" stroke="#d9dce8" stroke-width="2.2"/>
  <path d="M30 26.5l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="#bff2ff"/>
</svg>`;

// ---------- 敵人預告 ----------

function abilityText(a: IntentAbility): string {
  const name = statusName(a.status, a.params);
  return a.turns ? `${name} ${a.turns} 回合` : name;
}

const TRIGGER_TEXT: Record<IntentAbility['trigger'], (a: IntentAbility) => string> = {
  onStart: () => '登場時',
  onAttack: () => '每次攻擊後',
  hpBelow: (a) => `生命低於 ${Number(a.params?.percent ?? 50)}% 時`,
  everyNTurns: (a) => `每 ${Math.max(1, Number(a.params?.n ?? 3))} 回合`,
};

/** 敵人頭上的預告泡泡：下回合會攻擊或觸發技能時顯示內容，其他時候只留 ⓘ；點了看完整技能 */
export function renderIntent(host: Element, state: BattleState, i: number, config: BattleConfig): void {
  const e = state.enemies[i];
  if (!e || e.hp <= 0) return void host.replaceChildren();
  const intent = predictEnemyIntent(state, i);
  const parts: string[] = [];
  if (intent?.locked) parts.push('定身中');
  if (intent?.attack) parts.push(`⚔ ${intent.attack.damage.toLocaleString()}${intent.attack.hits > 1 ? ` ×${intent.attack.hits}` : ''}`);
  for (const a of intent?.abilities ?? []) parts.push(abilityText(a));
  host.replaceChildren(h('button', {
    type: 'button',
    class: ['intent-bubble', intent?.attack && 'danger', !parts.length && 'quiet'],
    'aria-label': `${e.def.name}的行動`,
    onClick: (ev: Event) => { ev.stopPropagation(); showEnemyInfo(state, i, config); },
  }, parts.length ? parts.join('・') : 'ⓘ'));
}

function showEnemyInfo(state: BattleState, i: number, config: BattleConfig): void {
  const e = state.enemies[i];
  const intent = predictEnemyIntent(state, i);
  if (!e || !intent) return;
  const list = enemyAbilityList(e);
  const next = intent.locked ? `定身中，${intent.turnsUntilAttack} 回合後` : intent.attack ? `下回合 ⚔ ${intent.attack.damage.toLocaleString()}` : `${intent.turnsUntilAttack} 回合後`;
  const dlg = openDialog(e.def.name, h('div', { class: 'list' },
    h('div', { class: 'row between' }, h('span', null, '屬性'), h('strong', null, `${ATTRIBUTE_NAMES[e.def.attribute]}（弱：${weakText(e, config)}）`)),
    h('div', { class: 'row between' }, h('span', null, '下次攻擊'), h('strong', null, next)),
    ringSummary(e) && h('div', { class: 'small-text' }, h('strong', null, '七曜環：'), ringSummary(e)),
    h('p', { class: 'small-text dim' }, '預估傷害已計入目前的減傷效果，隊長技減傷另計。'),
    list.length
      ? list.map((a) => h('div', { class: ['row between small-text', a.done && 'dim'] }, h('span', null, TRIGGER_TEXT[a.trigger](a)), h('span', null, `${abilityText(a)}${a.done ? '（已觸發）' : ''}`)))
      : h('p', { class: 'small-text dim' }, '沒有特殊技能'),
  ), [button(LABEL.close, { variant: 'ghost', sound: 'back', onClick: () => dlg.close() })]);
}

// ---------- Combo ----------

/** 每消一組：數字隨 Combo 放大，5／8／10 換色 */
export function renderCombo(el: HTMLElement, combo: number): void {
  el.replaceChildren(h('span', { class: 'combo-num' }, `${combo}`), ' Combo');
  el.className = `combo-count tier-${comboTier(combo).tier}`;
  el.style.setProperty('--combo-scale', `${1 + Math.min(combo, 12) * 0.05}`);
  void el.offsetWidth;
  el.classList.add('pop');
}

/** 全部消完：加上 Combo 加成；回傳高 Combo 的稱號（沒有則 undefined） */
export function finishCombo(el: HTMLElement, combo: number, config: BattleConfig): string | undefined {
  if (combo <= 0) return undefined;
  el.appendChild(h('div', { class: 'combo-bonus' }, `Combo 加成 ${comboBonusText(combo, config)}`));
  return comboTier(combo).title;
}

export function clearCombo(el: HTMLElement): void {
  el.className = 'combo-count';
  el.textContent = '';
}

// ---------- 技能就緒 ----------

/** 剛冷卻完的技能：頭像閃一下＋「技能 READY」＋音效 */
export function flashReadySkills(teamRow: HTMLElement, before: BattleState, after: BattleState): void {
  const ready = newlyReadySkills(before.team, after.team);
  if (!ready.length) return;
  audio.play('confirm');
  for (const i of ready) {
    const thumb = teamRow.children[i] as HTMLElement | undefined;
    if (!thumb) continue;
    thumb.classList.add('just-ready');
    floatLabel(thumb, '技能 READY', 'ready', 1300);
  }
}
