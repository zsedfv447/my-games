// 戰鬥畫面：上方敵人區、中間隊伍與生命條、下方 6×5 盤面（GDD 2.5 第 4 項）
import { h, svg, clear } from '../dom';
import { gameData } from '../../data/load';
import { bus } from '../../core/events';
import { createRng } from '../../core/rng';
import type { StageDef } from '../../core/types';
import { startBattle, type Battle, type BattleData, type BattleState, type EnemyState, type MemberState, type TurnSummary } from '../../battle/battle-state';
import { BoardView } from '../../battle/view/board-view';
import { completeStage, type StageClearResult } from '../../progression/stages';
import { CONTINUE_COST_GEMS, payContinue } from '../../progression/continue';
import { enemySvg } from '../art/enemy';
import { ATTRIBUTE_NAMES } from '../art/palette';
import { comboBonusText, comboTier, enemyAbilityList, matchup, newlyReadySkills, predictEnemyIntent, strikesByMember, weakTo, type IntentAbility, type MemberStrike } from '../../battle/feedback';
import { resolveArtPath, userAsset } from '../assets';
import { audio } from '../audio';
import { badge, bar, button, emptyState, iconButton, resourceIcon, slider, toggle } from '../components/basic';
import { cardPortraitUrl, cardThumb } from '../components/card-thumb';
import { confirmDialog, openDialog, toast, type DialogHandle } from '../components/overlay';
import { DEMO_DATA, DEMO_HELPER, DEMO_STAGE, DEMO_TEAM } from '../demo';
import { stageContext } from '../stage-nav';
import { buildSortieTeam } from '../sortie';
import { commit, getSave, getSettings, growth, updateSettings } from '../state';
import type { Navigator, ScreenDef } from '../router';
import { starText } from './prepare';
import { enemyChips, teamChips, STATUS_NAMES, type StatusChip } from '../status-labels';
import { storyBox } from '../components/story';
import { markStorySeen } from './story';
import { createTutorialBattle } from '../tutorial/battle-setup';
import { TutorialBattleGuide, texts as guideTexts, type BattleGuide } from '../tutorial/battle-guide';
import { advanceTutorial, skipTutorial } from '../tutorial/flow';

const CELL = 63;

// 出戰確認扣過體力才發「入場券」；重新整理戰鬥頁不會白白再扣一次，也不能免費重打
let ticket: string | null = null;
export function armBattle(stageId: string): void {
  ticket = stageId;
}

function enemyArt(e: EnemyState, boss: boolean): Element {
  const url = userAsset('enemies', e.def.id) ?? resolveArtPath(e.def.art.sprite);
  return url ? h('img', { src: url, alt: e.def.name, draggable: 'false' }) : svg(enemySvg({ ...e.def, boss }));
}

function floatText(host: HTMLElement, text: string, cls: string): void {
  const el = h('div', { class: `float-num ${cls}` }, text);
  host.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 震動回饋（設定可關；不支援的裝置直接略過） */
function buzz(ms: number): void {
  if (getSettings().vibration) navigator.vibrate?.(ms);
}

/** 敵人技能的簡短說明（預告與技能列表共用） */
function abilityText(a: IntentAbility): string {
  const name = STATUS_NAMES[a.status] ?? a.status;
  const turns = a.turns ? ` ${a.turns} 回合` : '';
  return `${name}${turns}`;
}

const TRIGGER_TEXT: Record<IntentAbility['trigger'], (a: IntentAbility) => string> = {
  onStart: () => '登場時',
  onAttack: () => '每次攻擊後',
  hpBelow: (a) => `生命低於 ${Number(a.params?.percent ?? 50)}% 時`,
  everyNTurns: (a) => `每 ${Math.max(1, Number(a.params?.n ?? 3))} 回合`,
};

function chipRow(chips: StatusChip[], cls: string): HTMLElement {
  return h('div', { class: cls }, chips.map((c) => h('button', { type: 'button', class: `chip ${c.tone}`, onClick: (e: Event) => { e.stopPropagation(); toast(c.detail, 2600); } }, c.text)));
}

/** 轉珠結算中發生、要等消除動畫後才播放的戰鬥事件 */
type QueuedEvent =
  | { kind: 'status'; enemy?: number; text: string; resisted: boolean }
  | { kind: 'poison'; damage: number };

interface Setup {
  stage: StageDef;
  data: BattleData;
  practice: boolean;
  battle: Battle;
  /** 新手教學戰鬥的引導層 */
  guide?: BattleGuide;
}

function setup(stageId: string, nav: Navigator): Setup | string {
  if (stageId === 'tutorial') {
    const t = createTutorialBattle(gameData);
    const guide = new TutorialBattleGuide(guideTexts(t.battle.getState(), t.data), {
      onFinish: () => { commit(advanceTutorial(getSave(), 'battle')); nav.replace('team'); },
      onSkip: () => { commit(skipTutorial(getSave())); nav.replace('home'); },
    });
    return { stage: t.stage, data: t.data, practice: true, battle: t.battle, guide };
  }
  if (stageId === 'practice') {
    return { stage: DEMO_STAGE, data: DEMO_DATA, practice: true, battle: startBattle(DEMO_STAGE, DEMO_TEAM, DEMO_HELPER, createRng(), DEMO_DATA) };
  }
  const stage = gameData.stages.find((s) => s.id === stageId);
  if (!stage) return '找不到這一關';
  if (ticket !== stageId) return '戰鬥已中斷，請重新出發';
  ticket = null;
  const team = buildSortieTeam(stage, getSave(), growth.card);
  try {
    return { stage, data: gameData, practice: false, battle: startBattle(stage, team.members, team.helper, createRng(), gameData) };
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export const battleScreen: ScreenDef = {
  name: 'battle',
  title: '戰鬥',
  chrome: 'bare',
  parent: 'adventure',
  render({ route, nav, onLeave }) {
    const s = setup(route.args[0] ?? '', nav);
    if (typeof s === 'string') {
      return h('div', { style: { justifyContent: 'center', padding: '24px' } },
        emptyState('sword', s),
        button('返回', { block: true, sound: 'back', onClick: () => nav.back() }));
    }
    const view = new BattleView(s, nav);
    onLeave(() => view.destroy());
    return view.element;
  },
};

class BattleView {
  readonly element: HTMLElement;
  private enemyZone = h('div', { class: 'enemy-zone' });
  private waveLabel = h('div', { class: 'wave-label' });
  private teamRow = h('div', { class: 'team-row' });
  private hpHost = h('div', { class: 'team-hp' });
  private teamChipsHost = h('div');
  private queue: QueuedEvent[] = [];
  private offs: (() => void)[] = [];
  private comboEl = h('div', { class: 'combo-count', 'aria-live': 'polite' });
  private boardView: BoardView;
  private state: BattleState;
  private enemyEls: HTMLElement[] = [];
  private shownHp: number;
  private dialog?: DialogHandle;
  private speed: number;
  /** 暫停選單開著時，轉珠先停用 */
  private paused = false;
  /** 暫停期間動畫播完、本來要開放轉珠 */
  private enableWhenResumed = false;

  constructor(private s: Setup, private nav: Navigator) {
    this.state = s.battle.getState();
    this.shownHp = this.state.hp;
    this.speed = getSettings().battleSpeed;
    this.boardView = new BoardView({
      cellSize: CELL,
      moveSeconds: () => this.state.moveTimeSeconds,
      showTimer: () => getSettings().showMoveTimer,
      onMove: (path) => void this.resolveTurn(path),
      onStep: () => { audio.play('tap'); buzz(6); },
    });
    this.element = h(
      'div',
      { class: 'battle' },
      h('div', { class: 'battle-top safe-top' },
        this.waveLabel,
        h('div', { class: 'stage-name' }, s.stage.name),
        iconButton('pause', '暫停', () => this.openPause())),
      this.enemyZone,
      this.comboEl,
      h('div', { class: 'battle-bottom safe-bottom' }, this.teamRow, this.teamChipsHost, this.hpHost, this.boardView.element),
    );
    this.applyFxClass();
    this.renderEnemies();
    this.renderTeam();
    this.renderHp(this.state.hp);
    this.boardView.setBoard(this.state.board);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.boardView.setEnabled(true);
    this.updateBgm();
    const ev = s.battle.events;
    this.offs.push(
      ev.on('statusApplied', (e) => this.queue.push({ kind: 'status', enemy: e.side === 'enemy' ? e.enemy : undefined, text: STATUS_NAMES[e.status.id] ?? e.status.id, resisted: e.resisted })),
      ev.on('poisonTick', (e) => this.queue.push({ kind: 'poison', damage: e.damage })),
    );
    if (!s.practice) this.maybeBossStory();
    s.guide?.attach({
      root: this.element,
      board: this.boardView.element,
      teamRow: this.teamRow,
      enemyZone: this.enemyZone,
      setBoardEnabled: (on) => this.boardView.setEnabled(on),
      getState: () => this.state,
    });
  }

  destroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.offs.forEach((off) => off());
    this.boardView.destroy();
    this.dialog?.close();
    this.s.guide?.destroy();
  }

  private updateBgm(): void {
    const boss = this.s.stage.waves[this.state.wave]?.boss;
    audio.playBgm(boss ? 'boss' : 'battle');
  }

  // ---------- 畫面 ----------

  private renderEnemies(): void {
    clear(this.enemyZone);
    const boss = !!this.s.stage.waves[this.state.wave]?.boss;
    this.waveLabel.textContent = `WAVE ${this.state.wave + 1}/${this.state.waveCount}`;
    const bg = userAsset('backgrounds', boss ? 'battle-boss' : 'battle');
    if (bg) this.enemyZone.appendChild(h('img', { class: 'battle-bg', src: bg, alt: '' }));
    const row = h('div', { class: ['enemy-line', boss && 'boss'] });
    this.enemyEls = this.state.enemies.map((e, i) => {
      const el = h(
        'button',
        { type: 'button', class: ['enemy', i === this.state.target && 'targeted', e.hp <= 0 && 'dead'], 'aria-label': `${e.def.name}，設為目標`, onClick: () => this.setTarget(i) },
        h('div', { class: 'enemy-cd' }, `${e.cooldown}`),
        h('div', { class: 'enemy-intent' }),
        h('div', { class: 'enemy-art' }, enemyArt(e, boss)),
        h('div', { class: 'enemy-name' }, badge(ATTRIBUTE_NAMES[e.def.attribute], `attr-${e.def.attribute}`), e.def.name),
        h('div', { class: 'weak-hint' }, `弱：${weakTo(e.def.attribute, this.s.data.config.battle).map((a) => ATTRIBUTE_NAMES[a]).join('、')}`),
        chipRow(enemyChips(e), 'enemy-chips'),
        bar({ value: e.hp, max: e.maxHp, variant: 'hp' }),
      );
      row.appendChild(el);
      return el;
    });
    this.enemyZone.appendChild(row);
    this.renderIntents();
  }

  /** 敵人頭上的下一招預告：下回合會攻擊或觸發技能時才顯示 */
  private renderIntents(): void {
    this.enemyEls.forEach((el, i) => {
      const host = el.querySelector('.enemy-intent');
      const e = this.state.enemies[i];
      if (!host || !e) return;
      const intent = predictEnemyIntent(this.state, i);
      const parts: string[] = [];
      if (intent?.attack) parts.push(`⚔ ${intent.attack.damage.toLocaleString()}${intent.attack.hits > 1 ? ` ×${intent.attack.hits}` : ''}`);
      for (const a of intent?.abilities ?? []) parts.push(abilityText(a));
      if (intent?.locked) parts.unshift('定身中');
      const button = h('button', { type: 'button', class: ['intent-bubble', intent?.attack && 'danger'], 'aria-label': `${e.def.name}的行動`, onClick: (ev: Event) => { ev.stopPropagation(); this.showEnemyInfo(i); } },
        parts.length ? parts.join('・') : 'ⓘ');
      button.classList.toggle('quiet', !parts.length);
      host.replaceChildren(e.hp > 0 ? button : '');
    });
  }

  /** 點預告：列出敵人全部技能與下一次攻擊 */
  private showEnemyInfo(i: number): void {
    const e = this.state.enemies[i];
    if (!e) return;
    const intent = predictEnemyIntent(this.state, i);
    const list = enemyAbilityList(e);
    const weak = weakTo(e.def.attribute, this.s.data.config.battle).map((a) => ATTRIBUTE_NAMES[a]).join('、');
    const dlg = openDialog(e.def.name, h('div', { class: 'list' },
      h('div', { class: 'row between' }, h('span', null, '屬性'), h('strong', null, `${ATTRIBUTE_NAMES[e.def.attribute]}（弱：${weak}）`)),
      h('div', { class: 'row between' }, h('span', null, '下次攻擊'), h('strong', null,
        intent?.locked ? `定身中，${intent.turnsUntilAttack} 回合後` : intent?.attack ? `下回合 ⚔ ${intent.attack.damage.toLocaleString()}` : `${intent?.turnsUntilAttack ?? '-'} 回合後`)),
      h('p', { class: 'small-text dim' }, '預估傷害已計入目前的減傷效果，隊長技減傷另計。'),
      list.length
        ? list.map((a) => h('div', { class: ['row between small-text', a.done && 'dim'] }, h('span', null, TRIGGER_TEXT[a.trigger](a)), h('span', null, `${abilityText(a)}${a.done ? '（已觸發）' : ''}`)))
        : h('p', { class: 'small-text dim' }, '沒有特殊技能'),
    ), [button('關閉', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() })]);
  }

  private updateEnemy(i: number, e: EnemyState, previousHp?: number): void {
    const el = this.enemyEls[i];
    if (!el) return;
    el.querySelector('.enemy-cd')!.textContent = `${e.cooldown}`;
    el.querySelector('.enemy-cd')!.classList.toggle('urgent', e.cooldown <= 1);
    el.querySelector('.bar')!.replaceWith(bar({ value: e.hp, max: e.maxHp, variant: 'hp', previous: previousHp }));
    el.classList.toggle('dead', e.hp <= 0);
    el.classList.toggle('targeted', i === this.state.target);
    el.querySelector('.enemy-chips')!.replaceWith(chipRow(enemyChips(e), 'enemy-chips'));
  }

  private renderTeam(): void {
    clear(this.teamRow);
    for (const m of this.state.team) {
      const ready = m.skillCooldown === 0;
      const thumb = cardThumb(m.card, { size: 56, onClick: () => this.useSkill(m.index) });
      thumb.classList.toggle('skill-ready', ready);
      if (m.skillCooldown !== null && !ready) thumb.appendChild(h('span', { class: 'skill-cd' }, `${m.skillCooldown}`));
      if (m.isHelper) thumb.appendChild(h('span', { class: 'helper-tag' }, '助'));
      this.teamRow.appendChild(thumb);
    }
    this.markMatchups();
  }

  /** 隊員頭像標出對目前目標的剋制（▲）與被剋（▼） */
  private markMatchups(): void {
    const target = this.state.enemies[this.state.target];
    [...this.teamRow.children].forEach((thumb, i) => {
      const m = this.state.team[i];
      thumb.querySelector('.matchup-tag')?.remove();
      if (!m || !target) return;
      const mu = matchup(m.card.attribute, target.def.attribute, this.s.data.config.battle);
      if (mu !== 'neutral') thumb.appendChild(h('span', { class: `matchup-tag ${mu}`, 'aria-label': mu === 'advantage' ? '剋制目標' : '被目標剋制' }, mu === 'advantage' ? '▲' : '▼'));
    });
  }

  private renderHp(previous?: number): void {
    this.teamChipsHost.replaceChildren(chipRow(teamChips(this.state), 'team-chips'));
    clear(this.hpHost);
    this.hpHost.appendChild(bar({ value: this.state.hp, max: this.state.maxHp, variant: 'hp', label: true, previous }));
  }

  private showCombo(combo: number): void {
    const { tier } = comboTier(combo);
    this.comboEl.replaceChildren(h('span', { class: 'combo-num' }, `${combo}`), ' Combo');
    this.comboEl.className = `combo-count tier-${tier}`;
    this.comboEl.style.setProperty('--combo-scale', `${1 + Math.min(combo, 12) * 0.05}`);
    void this.comboEl.offsetWidth;
    this.comboEl.classList.add('pop');
  }

  /** 全部消完：顯示 Combo 加成；高 Combo 加稱號與畫面發光 */
  private async finishCombo(combo: number): Promise<void> {
    if (combo <= 0) return;
    this.comboEl.appendChild(h('div', { class: 'combo-bonus' }, `Combo 加成 ${comboBonusText(combo, this.s.data.config.battle)}`));
    const { title } = comboTier(combo);
    if (!title) return;
    this.banner(title, 'combo-title');
    if (!getSettings().lowFx) this.flash('combo-glow', 700);
    await wait(450 / this.speed);
  }

  private flash(cls: string, ms: number): void {
    this.element.classList.remove(cls);
    void this.element.offsetWidth;
    this.element.classList.add(cls);
    setTimeout(() => this.element.classList.remove(cls), ms);
  }

  private applyFxClass(): void {
    this.element.classList.toggle('low-fx', getSettings().lowFx);
  }

  /** 換上新狀態後重畫隊伍；剛冷卻完的技能閃一下並提示 */
  private refreshTeam(before: BattleState): void {
    this.renderTeam();
    const ready = newlyReadySkills(before.team, this.state.team);
    if (!ready.length) return;
    audio.play('confirm');
    for (const i of ready) {
      const thumb = this.teamRow.children[i] as HTMLElement | undefined;
      if (!thumb) continue;
      thumb.classList.add('just-ready');
      floatText(thumb, '技能 READY', 'ready');
    }
  }

  // ---------- 操作 ----------

  private setTarget(i: number): void {
    if (this.s.battle.setTarget(i).ok) {
      audio.play('tap');
      this.state = this.s.battle.getState();
      this.enemyEls.forEach((el, j) => el.classList.toggle('targeted', j === i));
      this.markMatchups();
    }
  }

  /** 點隊員頭像：顯示主動技說明，確認後施放 */
  private useSkill(i: number): void {
    if (this.state.phase !== 'player') return;
    const m = this.state.team[i];
    const skill = m?.card.activeSkill ? this.s.data.skills.find((x) => x.id === m.card.activeSkill) : undefined;
    if (!m || !skill) return toast(`${m?.card.name ?? ''}沒有主動技`);
    const blocked = this.s.guide?.checkSkill(i);
    if (blocked) return toast(blocked);
    const ready = m.skillCooldown === 0;
    const dlg = openDialog(skill.name, h('div', null,
      h('p', null, skill.description),
      h('p', { class: 'small-text dim' }, ready ? '可以施放' : `冷卻中，還要 ${m.skillCooldown} 回合`),
    ), [
      button('取消', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
      button('施放', { variant: 'primary', disabled: !ready, onClick: () => { dlg.close(); void this.castSkill(i); } }),
    ]);
  }

  private async castSkill(i: number): Promise<void> {
    const before = this.state;
    const r = this.s.battle.useSkill(i);
    if (!r.ok) return toast(r.reason);
    audio.play('skill');
    this.boardView.setEnabled(false);
    const skill = this.s.data.skills.find((x) => x.id === r.skill.skillId);
    if (getSettings().battleFx) await this.skillCutin(before.team[i], skill?.name ?? '');
    await this.animateHits(before, { hits: r.skill.hits });
    const after = this.s.battle.getState();
    const hpBefore = this.shownHp;
    this.state = after;
    this.shownHp = after.hp;
    if (r.skill.heal > 0) floatText(this.hpHost, `+${r.skill.heal.toLocaleString()}`, 'heal');
    if (r.skill.selfDamage > 0) floatText(this.hpHost, `-${r.skill.selfDamage.toLocaleString()}`, 'hurt');
    this.renderHp(hpBefore);
    this.refreshTeam(before);
    if (r.skill.boardChanged) {
      if (getSettings().battleFx) await this.boardView.playTransform(after.board, this.speed);
      else await this.boardView.playRefill(after.board, this.speed);
    }
    if (after.wave !== before.wave) {
      this.renderEnemies();
      this.updateBgm();
    } else {
      after.enemies.forEach((e, j) => this.updateEnemy(j, e));
      this.renderIntents();
    }
    if (after.phase === 'won') return this.onWin();
    this.enableBoard();
    this.s.guide?.afterSkill(after);
  }

  /** 動畫播完開放轉珠；暫停中就等繼續時再開 */
  private enableBoard(): void {
    if (this.paused) this.enableWhenResumed = true;
    else this.boardView.setEnabled(true);
  }

  /** 分頁切到背景時自動暫停（只在等待轉珠時） */
  private onVisibility = (): void => {
    if (document.hidden && !this.paused && !this.dialog && this.state.phase === 'player' && !this.boardView.element.classList.contains('disabled')) this.openPause();
  };

  /** 暫停選單：繼續、戰鬥設定、星章條件、撤退 */
  private openPause(): void {
    if (this.paused || this.state.phase !== 'player') return;
    const wasEnabled = !this.boardView.element.classList.contains('disabled');
    this.paused = true;
    this.boardView.setEnabled(false);
    const s = getSettings();
    const stars = this.s.stage.stars ?? [];
    const resume = () => {
      dlg.close();
      this.paused = false;
      this.speed = getSettings().battleSpeed;
      this.applyFxClass();
      if ((wasEnabled || this.enableWhenResumed) && this.state.phase === 'player') this.boardView.setEnabled(true);
      this.enableWhenResumed = false;
    };
    // 結算動畫播放中撤退會和勝負判定打架，等輪到轉珠時才能撤退
    const retreat = async () => {
      if (await confirmDialog('撤退', this.s.practice ? '要離開練習場嗎？' : '撤退會視為失敗，已消耗的體力不會退還。')) {
        dlg.close();
        this.s.battle.forfeit();
        if (!this.s.practice) bus.emit('stageFailed', { stageId: this.s.stage.id });
        this.nav.back();
      }
    };
    const dlg = openDialog('暫停', h('div', { class: 'list pause-menu' },
      toggle('戰鬥加速 ×2', s.battleSpeed === 2, (v) => updateSettings({ battleSpeed: v ? 2 : 1 })),
      toggle('顯示轉珠倒數', s.showMoveTimer, (v) => updateSettings({ showMoveTimer: v })),
      toggle('技能與攻擊演出', s.battleFx, (v) => updateSettings({ battleFx: v })),
      slider({ label: '背景音樂', value: s.bgm, onInput: (v) => updateSettings({ bgm: v }) }),
      slider({ label: '音效', value: s.sfx, onInput: (v) => updateSettings({ sfx: v }) }),
      !this.s.practice && stars.length > 0 && h('div', { class: 'pause-stars' },
        h('strong', { class: 'small-text' }, '星章條件'),
        stars.map((c) => h('div', { class: 'row small-text' }, h('span', { class: 'stars' }, '★'), starText(c)))),
    ), [
      button('撤退', { variant: 'ghost', sound: 'back', disabled: !wasEnabled, onClick: () => void retreat() }),
      button('繼續', { variant: 'primary', onClick: resume }),
    ], { dismissible: false });
  }

  private async resolveTurn(path: Parameters<Battle['submitMove']>[0]): Promise<void> {
    const before = this.state;
    const veto = this.s.guide?.checkMove(path, before.board);
    if (veto) {
      toast(veto);
      this.boardView.setBoard(before.board);
      this.enableBoard();
      return;
    }
    this.queue = [];
    const res = this.s.battle.submitMove(path);
    if (!res.ok) {
      toast(res.reason);
      this.boardView.setBoard(before.board);
      this.enableBoard();
      return;
    }
    const after = this.s.battle.getState();
    const speed = this.speed;

    // 逐段播放：消除 → 落下 → 天降連鎖；傷害在全部消完後一次結算
    await this.boardView.playSteps(res.summary.steps, (combo) => {
      this.showCombo(combo);
      audio.play('match', combo);
    }, speed);
    await this.finishCombo(res.summary.combo);
    await this.animateHits(before, res.summary);
    // 主動技或敵人技能在結算後改變了盤面時，最後再對齊一次
    this.boardView.setBoard(after.board);

    // 回復與毒
    if (res.summary.heal > 0) floatText(this.hpHost, `+${res.summary.heal.toLocaleString()}`, 'heal');
    if (res.summary.poisonDamage > 0) floatText(this.hpHost, `-${res.summary.poisonDamage.toLocaleString()}`, 'hurt');

    // 敵人攻擊
    for (const atk of res.enemyAttacks) {
      this.enemyEls[atk.enemy]?.classList.add('attacking');
      await wait(220 / speed);
      this.enemyEls[atk.enemy]?.classList.remove('attacking');
      if (!getSettings().lowFx) {
        this.element.classList.remove('shake');
        void this.element.offsetWidth;
        this.element.classList.add('shake');
      }
      buzz(40);
      floatText(this.hpHost, `-${atk.damage.toLocaleString()}${atk.hits > 1 ? ` ×${atk.hits}` : ''}`, 'hurt');
      if (atk.survived) floatText(this.hpHost, '保命！', 'heal');
    }

    // 持續傷害、敵人技能與異常狀態
    if (res.summary.dotHits.length) await this.animateHits(before, { hits: res.summary.dotHits });
    await this.playQueue();

    const hpBefore = this.shownHp;
    this.state = after;
    this.shownHp = after.hp;
    this.renderHp(hpBefore);
    this.refreshTeam(before);
    this.comboEl.className = 'combo-count';
    this.comboEl.textContent = '';

    if (after.wave !== before.wave) {
      await wait(350 / speed);
      this.renderEnemies();
      this.updateBgm();
      this.banner(after.waveCount - 1 === after.wave && this.s.stage.waves[after.wave]?.boss ? 'BOSS' : `WAVE ${after.wave + 1}`);
      if (!this.s.practice && (await this.maybeBossStory())) return;
    } else {
      after.enemies.forEach((e, i) => this.updateEnemy(i, e));
      this.renderIntents();
    }

    if (after.phase === 'won') return this.onWin();
    if (after.phase === 'lost') return this.onLose();
    this.enableBoard();
    this.s.guide?.afterTurn(after);
  }

  private async playQueue(): Promise<void> {
    for (const q of this.queue.splice(0)) {
      if (q.kind === 'poison') {
        floatText(this.hpHost, `-${q.damage.toLocaleString()}`, 'hurt');
      } else {
        const host = q.enemy !== undefined ? this.enemyEls[q.enemy] : this.hpHost;
        if (host) floatText(host, q.resisted ? `抵抗 ${q.text}` : q.text, 'status');
      }
      await wait(260 / this.speed);
    }
  }

  /** 進入 Boss 波時播放 beforeBoss 劇情（看過的不再播）。有播放時回傳 true，播完才開放轉珠 */
  private async maybeBossStory(): Promise<boolean> {
    const id = this.s.stage.story?.beforeBoss;
    const lines = id ? gameData.story[id] : undefined;
    if (!id || !lines || !this.s.stage.waves[this.state.wave]?.boss || getSave().progress.storySeen.includes(id)) return false;
    this.boardView.setEnabled(false);
    await wait(900);
    await new Promise<void>((resolve) => {
      const layer = h('div', { class: 'story-layer' });
      layer.appendChild(storyBox(lines, () => { layer.remove(); resolve(); }));
      this.element.appendChild(layer);
    });
    markStorySeen(id);
    if (this.state.phase === 'player') this.enableBoard();
    return true;
  }

  /**
   * 播放我方攻擊。開啟演出時依出手順序：隊員頭像亮起並顯示該員傷害 → 光點飛向敵人 → 敵人扣血；
   * 關閉演出或低特效時，所有傷害一起跳出。傷害數字用屬性色，剋制時加「弱點！」，被剋時灰色小字。
   */
  private async animateHits(before: BattleState, summary: Pick<TurnSummary, 'hits'>): Promise<void> {
    if (!summary.hits.length) return;
    const strikes = strikesByMember(summary.hits, before.enemies, this.s.data.config.battle);
    const hp = before.enemies.map((e) => e.hp);
    const land = (st: MemberStrike) => {
      if (st.sweep) this.flash('sweep', 420);
      for (const t of st.targets) {
        const e = before.enemies[t.enemy];
        const el = this.enemyEls[t.enemy];
        if (!e || !el) continue;
        const prev = hp[t.enemy];
        hp[t.enemy] = Math.max(0, prev - t.damage);
        this.updateEnemy(t.enemy, { ...e, hp: hp[t.enemy] }, prev);
        el.classList.remove('hit');
        void el.offsetWidth;
        el.classList.add('hit');
        this.damageText(el, t.damage, st.attribute, t.matchup);
      }
    };
    const fx = getSettings().battleFx && !getSettings().lowFx;
    if (!fx) {
      strikes.forEach(land);
      await wait(380 / this.speed);
      return;
    }
    const stagger = 120 / this.speed;
    const flight = 240 / this.speed;
    const flights: Promise<void>[] = [];
    for (const st of strikes) {
      const thumb = st.member >= 0 ? (this.teamRow.children[st.member] as HTMLElement | undefined) : undefined;
      if (!thumb) {
        land(st);
        continue;
      }
      thumb.classList.remove('striking');
      void thumb.offsetWidth;
      thumb.classList.add('striking');
      floatText(thumb, st.total.toLocaleString(), `member-dmg attr-${st.attribute ?? 'none'}`);
      const target = st.sweep ? this.enemyZone.querySelector<HTMLElement>('.enemy-line') : this.enemyEls[st.targets[0]?.enemy ?? -1];
      flights.push(this.fly(thumb, target ?? this.enemyZone, st.attribute, flight).then(() => land(st)));
      await wait(stagger);
    }
    await Promise.all(flights);
    await wait(260 / this.speed);
  }

  private damageText(host: HTMLElement, damage: number, attribute: string | undefined, mu: 'advantage' | 'disadvantage' | 'neutral'): void {
    const text = damage < 0 ? `+${(-damage).toLocaleString()}` : damage.toLocaleString();
    const el = h('div', { class: `float-num dmg attr-${attribute ?? 'none'} ${mu}` },
      mu === 'advantage' && h('span', { class: 'weak-tag' }, '弱點！'),
      text,
      mu === 'disadvantage' && h('span', { class: 'resist-tag' }, '效果不佳'));
    host.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /** 屬性光點從 from 飛到 to（畫面有 CSS 縮放，位移要換回設計座標） */
  private fly(from: HTMLElement, to: HTMLElement, attribute: string | undefined, ms: number): Promise<void> {
    const root = this.element.getBoundingClientRect();
    const scale = root.width / (this.element.offsetWidth || root.width || 1) || 1;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const x0 = (a.left + a.width / 2 - root.left) / scale;
    const y0 = (a.top + a.height / 2 - root.top) / scale;
    const x1 = (b.left + b.width / 2 - root.left) / scale;
    const y1 = (b.top + b.height / 2 - root.top) / scale;
    const orb = h('div', { class: `strike-orb attr-${attribute ?? 'none'}` });
    this.element.appendChild(orb);
    if (!orb.animate) {
      orb.remove();
      return Promise.resolve();
    }
    const anim = orb.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0.4 },
      { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 30}px) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${x1}px, ${y1}px) scale(0.8)`, opacity: 1 },
    ], { duration: ms, easing: 'ease-in' });
    return anim.finished.then(() => orb.remove(), () => orb.remove());
  }

  /** 主動技演出：角色立繪從側邊滑入＋技能名稱橫幅（約 0.6 秒） */
  private async skillCutin(m: MemberState | undefined, skillName: string): Promise<void> {
    if (!m) return;
    const url = cardPortraitUrl(m.card);
    const layer = h('div', { class: `skill-cutin attr-${m.card.attribute}` },
      h('div', { class: 'cutin-art' }, url ? h('img', { src: url, alt: '' }) : cardThumb(m.card, { size: 120 })),
      h('div', { class: 'cutin-name' }, h('small', null, m.card.name), skillName));
    this.element.appendChild(layer);
    await wait(650 / this.speed);
    layer.classList.add('leaving');
    setTimeout(() => layer.remove(), 200);
  }

  private banner(text: string, extra = ''): void {
    const el = h('div', { class: ['wave-banner', extra] }, text);
    this.element.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ---------- 結算 ----------

  private onWin(): void {
    audio.play('win');
    audio.playBgm('victory');
    if (this.s.guide) return this.s.guide.onWin();
    const result = this.s.battle.getResult()!;
    let clear: StageClearResult | null = null;
    if (!this.s.practice) {
      const teamUnits = this.state.team.map((m) => ({ attribute: m.card.attribute, race: m.card.race }));
      const done = completeStage(getSave(), this.s.stage, { ...result, team: teamUnits }, stageContext(gameData.stages), gameData.config, createRng(), Date.now());
      commit(done.save);
      clear = done.result;
      bus.emit('stageCleared', { stageId: this.s.stage.id, turns: result.turns, stars: clear.stars });
      for (const d of clear.drops) bus.emit('cardObtained', { cardId: d.cardId, uid: d.uid, source: 'drop' });
    }
    const rows = [
      h('div', { class: 'row between' }, h('span', null, '回合數'), h('strong', null, `${result.turns}`)),
      h('div', { class: 'row between' }, h('span', null, '最高 Combo'), h('strong', null, `${result.maxCombo}`)),
    ];
    if (clear) {
      rows.push(
        h('div', { class: 'row between' }, h('span', null, '金幣'), h('strong', { class: 'row' }, resourceIcon('coin'), `+${clear.coin.toLocaleString()}`)),
        h('div', { class: 'row between' }, h('span', null, '玩家經驗'), h('strong', null, `+${clear.playerExp}`)),
      );
      if (clear.firstClear?.gems) rows.push(h('div', { class: 'row between' }, h('span', null, '首通獎勵'), h('strong', { class: 'row' }, resourceIcon('gem'), `+${clear.firstClear.gems}`)));
      if (clear.levelUp) rows.push(h('p', { class: 'gold-text' }, `玩家等級提升到 Lv.${clear.levelUp.to}！體力已補滿`));
      (this.s.stage.stars ?? []).forEach((c, i) => rows.push(
        h('div', { class: 'row small-text' }, h('span', { class: 'stars', style: { opacity: clear!.stars[i] ? '1' : '0.3' } }, '★'), starText(c), clear!.newStars[i] && badge('NEW', 'gold')),
      ));
      if (clear.drops.length) {
        rows.push(h('div', { class: 'row wrap' }, clear.drops.map((d) => {
          const def = growth.card(d.cardId);
          return def ? cardThumb(def, { size: 52 }) : null;
        })));
      }
    }
    const leave = () => {
      this.dialog?.close();
      const after = this.s.stage.story?.after;
      // 通關後的劇情只在第一次播放
      if (after && gameData.story[after] && !getSave().progress.storySeen.includes(after)) this.nav.replace('story', [after], { next: 'back' });
      else this.nav.back();
    };
    this.dialog = openDialog('勝利！', h('div', { class: 'list' }, rows), [
      button('再戰一次', { onClick: () => { this.dialog?.close(); this.nav.replace(this.s.practice ? 'battle' : 'prepare', [this.s.stage.id]); } }),
      button('返回', { variant: 'primary', onClick: leave }),
    ], { dismissible: false });
  }

  private onLose(): void {
    audio.play('lose');
    const gems = getSave().player.gems;
    const cost = this.s.practice ? 0 : CONTINUE_COST_GEMS;
    const giveUp = () => {
      this.dialog?.close();
      if (!this.s.practice) bus.emit('stageFailed', { stageId: this.s.stage.id });
      this.nav.back();
    };
    const doContinue = () => {
      if (!this.s.practice) {
        const paid = payContinue(getSave());
        if (!paid.ok) return toast('星晶不足');
        commit(paid.save);
      }
      const r = this.s.battle.continueBattle();
      if (!r.ok) return toast(r.reason);
      this.dialog?.close();
      this.state = this.s.battle.getState();
      this.shownHp = this.state.hp;
      this.renderHp();
      this.renderIntents();
      this.boardView.setEnabled(true);
    };
    this.dialog = openDialog('隊伍倒下了', h('p', null, cost ? `花費 ${cost} 星晶續戰，生命回滿並繼續這一波。（持有 ${gems}）` : '要再試一次嗎？'), [
      button('放棄', { variant: 'ghost', sound: 'back', onClick: giveUp }),
      button('續戰', { variant: 'primary', cost: cost ? { kind: 'gem', amount: cost } : undefined, disabled: gems < cost, onClick: doContinue }),
    ], { dismissible: false });
  }
}
