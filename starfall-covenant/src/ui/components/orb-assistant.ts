import { h } from '../dom';
import { openDialog, toast } from './overlay';
import type { BattleState } from '../../battle/runtime';
import type { OrbType, StageDef, StarCondition } from '../../core/types';
import { ASSISTANT_GOALS, type AssistantGoalId } from '../../battle/assistant/goals';
import type { AssistantPlan, AssistantRequest } from '../../battle/assistant/types';
import '../orb-assistant.css';

export interface OrbAssistantOptions {
  state: BattleState;
  stage?: Pick<StageDef, 'stars'>;
  initialRequest?: AssistantRequest;
  onSaveRequest?(request: AssistantRequest): void;
  requestPlan(request: AssistantRequest): Promise<AssistantPlan | null>;
  execute(plan: AssistantPlan): Promise<boolean>;
  preview(plan: AssistantPlan | null): void;
  cancelPlan?(): void;
  onClose(): void;
}
export interface OrbAssistantHandle { close(): void; invalidate(message?: string): void }
const COLORS: [OrbType, string][] = [['fire', '火'], ['water', '水'], ['wood', '木'], ['light', '光'], ['dark', '暗'], ['heart', '心']];
const CATEGORIES: { label: string; goals: AssistantGoalId[] }[] = [
  { label: '智慧判斷', goals: ['auto'] },
  { label: '攻擊與生存', goals: ['damage', 'target', 'survive', 'heal', 'allattack', 'poison', 'stall', 'ring', 'absorb'] },
  { label: '盤面與連擊', goals: ['maxcombo', 'exactcombo', 'color', 'avoidcolor', 'rainbow', 'dual', 'chain', 'enhance', 'heartgroups', 'clearcolor'] },
  { label: '隊伍流派', goals: ['mono', 'rainbow', 'combo', 'chain', 'heart', 'race', 'enhance', 'control', 'berserk', 'dual', 'skillcycle', 'fixed'] },
  { label: '關卡星章', goals: ['star'] },
];
function starLabel(star: StarCondition): string {
  switch (star.type) {
    case 'clearWithinTurns': return `${star.turns} 回合內通關`;
    case 'maxCombo': return `達成 ${star.combo} Combo`;
    case 'noActiveSkill': return '不使用主動技';
    case 'noContinue': return '不接關';
    case 'teamAll': return '全隊符合指定條件（出戰時決定）';
  }
}
const field = (label: string, el: HTMLElement) => h('label', { class: 'orb-assistant-field' }, h('span', null, label), el);
const numberInput = () => h('input', { type: 'number', min: 1, max: 30, step: 1, inputmode: 'numeric', placeholder: '不限' });
const action = (label: string, run: () => void, primary = false) => h('button', { type: 'button', class: `btn ${primary ? 'primary' : 'ghost'}`, onclick: run }, label);

/** 僅在玩家開啟時存在；每次操作最多執行一回合。 */
export function openOrbAssistant(opts: OrbAssistantOptions): OrbAssistantHandle {
  let closed = false;
  let generation = 0;
  let busy = false;
  let plan: AssistantPlan | null = null;
  const category = h('select', { 'aria-label': '目標分類' }, CATEGORIES.map((c, i) => h('option', { value: i }, c.label)));
  const goal = h('select', { 'aria-label': '轉珠目標' });
  const color = h('select', { 'aria-label': '指定珠色' }, COLORS.map(([id, name]) => h('option', { value: id }, name)));
  color.value = opts.state.team[0]?.card.attribute ?? 'fire';
  const enemy = h('select', { 'aria-label': '指定敵人' }, opts.state.enemies.map((e, i) => h('option', { value: i, disabled: e.hp <= 0 }, `${e.def.name}（生命 ${e.hp.toLocaleString()}）`)));
  enemy.value = String(opts.state.target);
  const star = h('select', { 'aria-label': '星章條件' }, (opts.stage?.stars ?? []).map((s, i) => h('option', { value: i }, starLabel(s))));
  const colorField = field('指定珠色', color);
  const enemyField = field('指定敵人', enemy);
  const starField = field('星章條件', star);
  const minCombo = numberInput();
  const exactCombo = numberInput();
  const minGroup = numberInput();
  const minHeartGroups = numberInput();
  const minEnhanced = numberInput();
  const colorCount = numberInput();
  const minRingBreaks = numberInput();
  const avoidAbsorb = h('input', { type: 'checkbox' });
  const clearColors = COLORS.map(([id, name]) => ({ id, name, input: h('input', { type: 'checkbox' }) }));
  const groupColor = h('input', { type: 'checkbox' });
  const conditionColor = h('select', { 'aria-label': '附加條件珠色' }, COLORS.map(([id, name]) => h('option', { value: id }, name)));
  const groupColorSelect = h('select', { 'aria-label': '單組限定珠色' }, COLORS.map(([id, name]) => h('option', { value: id }, name)));
  const enhanced = h('input', { type: 'checkbox' });
  const colors = COLORS.map(([id, name]) => ({ id, need: h('input', { type: 'checkbox', 'aria-label': `需要消除${name}珠` }), avoid: h('input', { type: 'checkbox', 'aria-label': `避免消除${name}珠` }), name }));
  const status = h('p', { class: 'orb-assistant-status', role: 'status', 'aria-live': 'polite' }, '選好目標後，按「規劃路線」。');
  const result = h('div', { class: 'orb-assistant-result' });
  const reset = (message = '條件已更新，請重新規劃路線。') => {
    generation++;
    opts.cancelPlan?.();
    busy = false;
    plan = null;
    opts.preview(null);
    result.replaceChildren();
    status.textContent = message;
    refresh();
  };
  const refresh = () => {
    planButton.disabled = busy;
    cancelButton.hidden = !busy;
    executeButton.hidden = !plan;
    previewButton.hidden = !plan;
    body.setAttribute('aria-busy', String(busy));
  };
  const syncGoal = () => {
    colorField.hidden = !['color', 'avoidcolor', 'mono', 'clearcolor'].includes(goal.value);
    enemyField.hidden = goal.value !== 'target';
    starField.hidden = goal.value !== 'star';

  };
  const fillGoals = () => {
    goal.replaceChildren(...CATEGORIES[Number(category.value)].goals.map(id => h('option', { value: id }, ASSISTANT_GOALS.find(g => g.id === id)!.label)));
    syncGoal();
  };
  fillGoals();
  const parseNumber = (input: HTMLInputElement): number | undefined => input.value === '' ? undefined : Number(input.value);
  const request = (): AssistantRequest => ({
    goal: goal.value as AssistantGoalId,
    color: color.value as OrbType,
    targetEnemy: Number(enemy.value),
    starIndex: star.value === '' ? undefined : Number(star.value),
    constraints: { minCombo: parseNumber(minCombo), exactCombo: parseNumber(exactCombo), minGroup: parseNumber(minGroup), enhanced: enhanced.checked || undefined, minHeartGroups: parseNumber(minHeartGroups), minEnhanced: parseNumber(minEnhanced), minRingBreaks: parseNumber(minRingBreaks), avoidAbsorb: avoidAbsorb.checked || undefined, minColorOrbs: colorCount.value ? { color: conditionColor.value as OrbType, count: Number(colorCount.value) } : undefined, groupColor: groupColor.checked ? groupColorSelect.value as OrbType : undefined, clearColors: clearColors.some(c => c.input.checked) ? clearColors.filter(c => c.input.checked).map(c => c.id) : undefined,
      requiredColors: colors.some(c => c.need.checked) ? colors.filter(c => c.need.checked).map(c => c.id) : undefined, avoidColors: colors.some(c => c.avoid.checked) ? colors.filter(c => c.avoid.checked).map(c => c.id) : undefined },
  });
  const saved = opts.initialRequest;
  if (saved) {
    const index = CATEGORIES.findIndex(c => c.goals.includes(saved.goal));
    if (index >= 0) { category.value = String(index); fillGoals(); goal.value = saved.goal; syncGoal(); }
    if (saved.color) color.value = saved.color;
    if (saved.targetEnemy !== undefined && opts.state.enemies[saved.targetEnemy]?.hp > 0) enemy.value = String(saved.targetEnemy);
    if (saved.starIndex !== undefined) star.value = String(saved.starIndex);
    const c = saved.constraints;
    if (c) {
      for (const [input, value] of [[minCombo, c.minCombo], [exactCombo, c.exactCombo], [minGroup, c.minGroup], [minHeartGroups, c.minHeartGroups], [minEnhanced, c.minEnhanced], [minRingBreaks, c.minRingBreaks]] as const) {
        input.value = value === undefined ? '' : String(value);
      }
      enhanced.checked = !!c.enhanced;
      avoidAbsorb.checked = !!c.avoidAbsorb;
      groupColor.checked = !!c.groupColor;
      if (c.groupColor) groupColorSelect.value = c.groupColor;
      if (c.minColorOrbs) { conditionColor.value = c.minColorOrbs.color; colorCount.value = String(c.minColorOrbs.count); }
      for (const color of colors) { color.need.checked = !!c.requiredColors?.includes(color.id); color.avoid.checked = !!c.avoidColors?.includes(color.id); }
      for (const color of clearColors) color.input.checked = !!c.clearColors?.includes(color.id);
    }
  }
  const planButton = action('規劃路線', () => { void runPlan(); }, true);
  const cancelButton = action('取消規劃', () => reset('已取消規劃。'));
  const executeButton = action('照路線轉珠（本回合）', () => {
    const chosen = plan;
    if (!chosen || busy) return;
    dlg.close();
    void opts.execute(chosen).then(ok => { if (!ok) toast('盤面已變動或目前無法轉珠，請重新開啟助手。'); }).catch(() => toast('這次無法執行路線，請重新規劃。'));
  }, true);
  const previewButton = action('顯示路線並收起', () => {
    const chosen = plan;
    if (!chosen) return;
    dlg.close();
    opts.preview(chosen);
  });
  const body = h('div', { class: 'orb-assistant' },
    h('p', { class: 'small-text' }, `目前生命 ${opts.state.hp.toLocaleString()}／${opts.state.maxHp.toLocaleString()}。每次啟動只處理本回合。`),
    h('p', { class: 'small-text dim' }, '預估只看首消，不保證天降與最終戰果。'),
    h('p', { class: 'small-text dim' }, '設定會在規劃或儲存後記住，下次可從上方按「一鍵轉珠」使用；每次只執行一回合。'),
    h('div', { class: 'orb-assistant-grid' }, field('目標分類', category), field('轉珠目標', goal), colorField, enemyField, starField),
    h('details', { class: 'orb-assistant-conditions' }, h('summary', null, '附加條件'),
      h('div', { class: 'orb-assistant-grid' }, field('至少幾 Combo', minCombo), field('恰好幾 Combo', exactCombo), field('單組至少幾顆', minGroup), field('至少幾組心珠', minHeartGroups), field('至少幾顆強化珠', minEnhanced), field('至少破幾格七曜環', minRingBreaks), field('附加條件珠色', conditionColor), field('此色至少消幾顆', colorCount)),
      h('label', { class: 'orb-assistant-check' }, enhanced, '需要消除強化珠'),
      h('div', null, h('p', { class: 'small-text' }, '需要清空的珠色'), h('div', { class: 'orb-assistant-grid' }, clearColors.map(c => h('label', { class: 'orb-assistant-check' }, c.input, c.name)))),
      h('label', { class: 'orb-assistant-check' }, groupColor, '單組顆數限定珠色'),
      field('單組限定珠色', groupColorSelect),
      h('label', { class: 'orb-assistant-check' }, avoidAbsorb, '避免造成傷害吸收'),
      h('table', null, h('thead', null, h('tr', null, h('th', null, '珠色'), h('th', null, '需要消除'), h('th', null, '避免消除'))), h('tbody', null, colors.map(c => h('tr', null, h('th', { scope: 'row' }, c.name), h('td', null, c.need), h('td', null, c.avoid))))),
    ), status, result,
    h('div', { class: 'orb-assistant-actions' }, planButton, cancelButton, executeButton, previewButton, action('儲存設定並收起', () => { const r = validatedRequest(); if (!r) return; opts.onSaveRequest?.(r); dlg.close(); }), action('收起', () => dlg.close())),
  );
  const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); dlg.close(); } };
  const dlg = openDialog('轉珠助手', body, [], { scope: 'route', onClose: () => {
    closed = true;
    document.removeEventListener('keydown', keydown);
    generation++;
    opts.cancelPlan?.();
    opts.preview(null);
    opts.onClose();
  } });
  document.addEventListener('keydown', keydown);
  body.closest('.dialog')?.classList.add('orb-assistant-dialog');
  category.addEventListener('change', () => { fillGoals(); reset(); });
  goal.addEventListener('change', () => { syncGoal(); if (goal.value === 'exactcombo') body.querySelector('details')!.open = true; reset(); });
  body.addEventListener('change', e => { if (e.target !== category && e.target !== goal) reset(); });
  if (saved?.constraints && Object.keys(saved.constraints).some(key => saved.constraints![key as keyof typeof saved.constraints] !== undefined)) body.querySelector('details')!.open = true;
  refresh();

  function validatedRequest(): AssistantRequest | null {
    const numbers = [minCombo, exactCombo, minGroup, minHeartGroups, minEnhanced, colorCount, minRingBreaks];
    if (numbers.some(input => !input.checkValidity())) { status.textContent = '請輸入 1 到 30 的整數。'; return null; }
    const r = request();
    if (r.goal === 'exactcombo' && r.constraints?.exactCombo === undefined) {
      body.querySelector('details')!.open = true;
      status.textContent = '請在附加條件填入「恰好幾 Combo」。';
      exactCombo.focus();
      return null;
    }
    if (colors.some(c => c.need.checked && c.avoid.checked)) { status.textContent = '同一珠色不能同時需要與避免。'; return null; }
    if (r.constraints?.exactCombo && r.constraints.minCombo && r.constraints.exactCombo < r.constraints.minCombo) { status.textContent = '恰好 Combo 不能小於最低 Combo。'; return null; }
    if (r.goal === 'star' && (!opts.stage?.stars?.length || r.starIndex === undefined)) { status.textContent = '目前關卡沒有星章條件。'; return null; }
    if (!COLORS.some(([id]) => id === r.color) || !COLORS.some(([id]) => id === conditionColor.value) || !COLORS.some(([id]) => id === groupColorSelect.value)) { status.textContent = '請重新選擇珠色。'; return null; }
    if (r.targetEnemy === undefined || !opts.state.enemies[r.targetEnemy] || opts.state.enemies[r.targetEnemy].hp <= 0) { status.textContent = '請選擇尚未倒下的敵人。'; return null; }
    if (groupColor.checked && !r.constraints?.minGroup) { status.textContent = '限定單組珠色時，請填入「單組至少幾顆」。'; return null; }
    return r;
  }

  async function runPlan(): Promise<void> {
    const r = validatedRequest();
    if (!r) return;
    opts.onSaveRequest?.(r);
    const current = ++generation;
    plan = null;
    opts.preview(null);
    result.replaceChildren();
    busy = true;
    status.textContent = '正在規劃路線，可隨時取消。';
    refresh();
    try {
      const next = await opts.requestPlan(r);
      if (closed || current !== generation) return;
      busy = false;
      plan = next;
      if (!next) { status.textContent = '這次沒有可用路線，請調整條件再試。'; refresh(); return; }
      const f = next.forecast;
      status.textContent = '路線已規劃，請確認首消預估再執行。';
      const number = (n: number) => Math.round(n).toLocaleString();
      result.replaceChildren(
        h('h3', null, '首消預估'),
        h('dl', { class: 'orb-assistant-stats' }, h('dt', null, 'Combo'), h('dd', null, number(f.combo)), h('dt', null, '傷害'), h('dd', null, number(f.damage)), h('dt', null, '補血'), h('dd', null, number(f.heal)), h('dt', null, '敵方傷害'), h('dd', null, number(f.incomingDamage)), h('dt', null, '毒傷害'), h('dd', null, number(f.poisonDamage)), h('dt', null, '回合後生命'), h('dd', null, number(f.hpAfter))),
        h('p', null, `目標：${f.goalAchieved ? '預估達成' : '尚未達成'}；附加條件：${f.constraintsMet ? '預估符合' : '尚未符合'}。`),
        h('p', { class: 'small-text' }, f.hpAfter <= 0 ? '風險：預估生命歸零。' : '風險：仍可能受天降與敵方機制影響。'),
        ...f.warnings.map(w => h('p', { class: 'small-text orb-assistant-warning' }, w)),
        next.timedOut ? h('p', { class: 'small-text dim' }, '已達規劃時間上限，顯示目前找到的路線，不代表最佳解。') : h('p', { class: 'small-text dim' }, '這是目前找到的路線，不保證最佳解。'),
        h('p', { class: 'small-text dim' }, '可直接執行一次，或顯示路線後自行轉珠。'),
      );
      refresh();
    } catch {
      if (closed || current !== generation) return;
      busy = false;
      status.textContent = '這次規劃失敗，請重試。';
      refresh();
    }
  }
  return { close: () => dlg.close(), invalidate: (message = '盤面或戰鬥狀態已變動，請重新規劃。') => { if (!closed) reset(message); } };
}
