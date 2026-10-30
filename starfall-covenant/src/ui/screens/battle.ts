// 戰鬥畫面：上方敵人區、中間隊伍與生命條、下方 6×5 盤面（GDD 2.5 第 4 項）
import { h, svg, clear } from '../dom';
import { gameData } from '../../data/load';
import { bus } from '../../core/events';
import { createRng } from '../../core/rng';
import type { StageDef } from '../../core/types';
import { startBattle, type Battle, type BattleData, type BattleState, type EnemyState, type TurnSummary } from '../../battle/battle-state';
import { BoardView } from '../../battle/view/board-view';
import { isMemberSealed } from '../../battle/skills/status';
import { completeStage, liveStarStatus, type StageClearResult } from '../../progression/stages';
import { plannedCards, type DropPlan } from '../../progression/drops';
import { chestBadge, DropCounter } from '../battle-fx/drops';
import { CONTINUE_COST_GEMS, payContinue } from '../../progression/continue';
import { enemySvg } from '../art/enemy';
import { enemyArtUrl } from '../art/enemy-art';
import { ATTRIBUTE_NAMES } from '../art/palette';
import { buzz, flashClass, skillCutin } from '../battle-fx/effects';
import { openPauseMenu, type PauseHandle } from '../battle-fx/pause';
import { clearCombo, finishCombo, flashReadySkills, markMatchups, markSeals, renderCombo, renderIntent, weakHint } from '../battle-fx/readability';
import { playStrikes } from '../battle-fx/strikes';
import { userAsset } from '../assets';
import { audio } from '../audio';
import { badge, bar, button, emptyState, iconButton } from '../components/basic';
import { cardThumb } from '../components/card-thumb';
import { confirmDialog, openDialog, toast, type DialogHandle } from '../components/overlay';
import { DEMO_HELPER, DEMO_TEAM, PRACTICE_MODES, isPracticeMode, practiceSetup, type PracticeMode } from '../demo';
import { stageContext, stageListPath } from '../stage-nav';
import { commit, getSave, getSettings } from '../state';
import type { Navigator, ScreenDef } from '../router';
import { starText } from './prepare';
import { enemyChips, teamChips, STATUS_NAMES, type StatusChip } from '../status-labels';
import { storyBox } from '../components/story';
import { stageStoryToPlay } from '../../progression/stage-story';
import { openClearResult, type ResultNote } from '../components/reward-reveal';
import { grantLorePage, loreNotes } from '../../progression/lore';
import { clearItems, levelUpView } from '../reward-plan';
import { resultConstellation, shareClear } from '../clear-extras';
import { showDefeatGuide } from '../components/defeat-guide';
import { trackBattleRecords, type BattleRecordTracker } from '../battle-records';
import { leaderLineOf } from '../victory-line';
import { helperBondOnClear } from '../helper-bond-clear';
import { cardBondOnClear } from '../card-bond-clear';
import { markStorySeen } from './story';
import { createTutorialBattle } from '../tutorial/battle-setup';
import { TutorialBattleGuide, texts as guideTexts, type BattleGuide } from '../tutorial/battle-guide';
import { advanceTutorial } from '../tutorial/flow';
import { skipTutorialNow } from '../tutorial/skip';
import { BattleHud, liveSummary } from '../components/battle-hud';
import { canAct, reenableAfterCancel } from '../battle-guard';
import { grantClearExp, nextStageButton, unlockNotice } from '../stage-clear';
import { endBattle, openStageBattle, saveBattle } from '../battle-session';
import { collectedDrops } from '../../progression/active-battle';
import type { CardExpGain } from '../../growth';

const CELL = 63;

// 出戰確認扣過體力才發「入場券」（寫在存檔，見 battle-session.ts）；重新整理會從中斷處繼續，不會重扣也不能重打。
// 掉落在發券時就骰好並跟著券走（提案 13），重新整理或續戰都沿用同一份。
export { armBattle } from '../battle-session';

function enemyArt(e: EnemyState, boss: boolean): Element {
  const url = enemyArtUrl(e.def);
  return url ? h('img', { src: url, alt: e.def.name, draggable: 'false' }) : svg(enemySvg({ ...e.def, boss }));
}

function floatText(host: HTMLElement, text: string, cls: string): void {
  const el = h('div', { class: `float-num ${cls}` }, text);
  host.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
  /** 出戰的玩家卡 uid（不含助戰），結算發卡片經驗用 */
  memberUids?: string[];
  /** 正式關卡：結算掉落的亂數種子、是否從中斷處還原 */
  dropSeed?: number;
  resumed?: boolean;
  /** 練習場目前的模式 */
  practiceMode?: PracticeMode;
  /** 新手教學戰鬥的引導層 */
  guide?: BattleGuide;
  /** 進場時骰好的掉落；練習與教學沒有 */
  drops?: DropPlan;
}

function setup(stageId: string, nav: Navigator, variant?: string): Setup | string {
  if (stageId === 'tutorial') {
    const t = createTutorialBattle(gameData);
    const guide = new TutorialBattleGuide(guideTexts(t.battle.getState(), t.data), {
      onFinish: () => { commit(advanceTutorial(getSave(), 'battle')); nav.replace('team'); },
      onSkip: () => { nav.replace('home'); void skipTutorialNow(); },
    });
    return { stage: t.stage, data: t.data, practice: true, battle: t.battle, guide };
  }
  if (stageId === 'practice') {
    // 第二個參數是練習模式（暫停選單可切換敵人機制）
    const mode: PracticeMode = isPracticeMode(variant) ? variant : 'normal';
    const { stage, data } = practiceSetup(mode);
    return { stage, data, practice: true, practiceMode: mode, battle: startBattle(stage, DEMO_TEAM, DEMO_HELPER, createRng(), data) };
  }
  const stage = gameData.stages.find((s) => s.id === stageId);
  if (!stage) return '找不到這一關';
  const opened = openStageBattle(stage);
  return typeof opened === 'string' ? opened : { stage, data: gameData, practice: false, ...opened };
}

export const battleScreen: ScreenDef = {
  name: 'battle',
  title: '戰鬥',
  chrome: 'bare',
  parent: 'adventure',
  render({ route, nav, onLeave }) {
    const s = setup(route.args[0] ?? '', nav, route.args[1]);
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
  private hud: BattleHud;
  private teamRow = h('div', { class: 'team-row' });
  private hpHost = h('div', { class: 'team-hp' });
  private teamChipsHost = h('div');
  private queue: QueuedEvent[] = [];
  private offs: (() => void)[] = [];
  private comboEl = h('div', { class: 'combo-count', 'aria-live': 'polite' });
  private boardView: BoardView;
  private state: BattleState;
  private enemyEls: HTMLElement[] = [];
  private dropCounter: DropCounter;
  /** 這回合倒下、還沒播放寶箱的敵人（enemyDefeated 事件在結算當下就發） */
  private fallen: number[] = [];
  private shownHp: number;
  private dialog?: DialogHandle;
  /** 契印師手札的戰績紀錄（練習與教學不記） */
  private records?: BattleRecordTracker;
  private speed: number;
  /** 暫停選單開著；這段期間動畫播完要開放轉珠時，等繼續再開 */
  private paused = false;
  private enableWhenResumed = false;
  /** 轉珠或主動技的結算動畫播放中（state.phase 此時還是 player） */
  private resolving = false;
  /** 開著的暫停選單（結算剛好結束時更新撤退按鈕） */
  private pauseMenu?: PauseHandle;
  private get guard() {
    return { phase: this.state.phase, resolving: this.resolving };
  }

  constructor(private s: Setup, private nav: Navigator) {
    this.state = s.battle.getState();
    this.shownHp = this.state.hp;
    this.speed = getSettings().battleSpeed;
    this.hud = new BattleHud(s.stage);
    this.dropCounter = new DropCounter(s.drops);
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
        h('div', null, this.waveLabel, this.hud.element),
        h('div', { class: 'stage-name' }, s.stage.name),
        iconButton('pause', '暫停', () => this.openPause())),
      this.enemyZone,
      this.comboEl,
      h('div', { class: 'battle-bottom safe-bottom' }, this.teamRow, this.teamChipsHost, this.hpHost, this.boardView.element),
    );
    this.element.classList.toggle('low-fx', getSettings().lowFx);
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
      ev.on('enemyDefeated', (e) => this.fallen.push(e.enemy)),
    );
    if (!s.practice && !s.guide) {
      this.records = trackBattleRecords(s.battle, s.stage.id, s.memberUids ?? []);
      this.offs.push(this.records.dispose);
    }
    if (!s.practice) this.maybeBossStory();
    if (s.resumed) queueMicrotask(() => this.afterResume());
    s.guide?.attach({
      root: this.element,
      board: this.boardView.element,
      teamRow: this.teamRow,
      enemyZone: this.enemyZone,
      setBoardEnabled: (on) => this.boardView.setEnabled(on),
      getState: () => this.state,
    });
  }

  /** 從中斷處還原：已分出勝負的直接進結算或失敗選單 */
  private afterResume(): void {
    toast('已回到中斷的戰鬥');
    // 中斷前已倒下的敵人，寶箱直接算進計數器（不播飛行動畫）
    if (this.s.drops) for (const d of collectedDrops(this.s.drops, this.state)) void this.dropCounter.collect(this.element, d.wave, d.enemy, undefined, this.speed);
    if (this.state.phase === 'won') void this.onWin();
    else if (this.state.phase === 'lost') this.onLose();
  }

  /** 正式關卡每次行動結算後存檔 */
  private persist(): void {
    if (!this.s.practice) saveBattle(this.s.battle);
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
        e.hp > 0 && chestBadge(this.s.drops, this.state.wave, i),
        h('div', { class: 'enemy-art' }, enemyArt(e, boss)),
        h('div', { class: 'enemy-name' }, badge(ATTRIBUTE_NAMES[e.def.attribute], `attr-${e.def.attribute}`), e.def.name),
        weakHint(e, this.s.data.config.battle),
        chipRow(enemyChips(e), 'enemy-chips'),
        bar({ value: e.hp, max: e.maxHp, variant: 'hp' }),
      );
      row.appendChild(el);
      return el;
    });
    this.enemyZone.appendChild(row);
    this.enemyZone.appendChild(this.dropCounter.element);
    this.renderIntents();
  }

  private renderIntents(): void {
    this.enemyEls.forEach((el, i) => renderIntent(el.querySelector('.enemy-intent')!, this.state, i, this.s.data.config.battle));
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
    markMatchups(this.teamRow, this.state, this.s.data.config.battle);
    markSeals(this.teamRow, this.state);
  }

  private renderHp(previous?: number): void {
    this.teamChipsHost.replaceChildren(chipRow(teamChips(this.state), 'team-chips'));
    clear(this.hpHost);
    this.hpHost.appendChild(bar({ value: this.state.hp, max: this.state.maxHp, variant: 'hp', label: true, previous }));
    this.hud.update(this.state);
  }

  private showCombo(combo: number): void {
    renderCombo(this.comboEl, combo);
  }

  /** 動畫播完開放轉珠；暫停中就等繼續時再開 */
  private enableBoard(): void {
    if (this.paused) this.enableWhenResumed = true;
    else this.boardView.setEnabled(true);
  }

  /** 分頁切到背景時，等待轉珠中就自動暫停 */
  private onVisibility = (): void => {
    if (document.hidden && !this.dialog && !this.boardView.element.classList.contains('disabled')) this.openPause();
  };

  private openPause(): void {
    if (this.paused || this.state.phase !== 'player') return;
    const wasEnabled = !this.boardView.element.classList.contains('disabled');
    this.paused = true;
    this.boardView.setEnabled(false);
    const close = () => {
      this.paused = false;
      this.pauseMenu = undefined;
      this.speed = getSettings().battleSpeed;
      this.element.classList.toggle('low-fx', getSettings().lowFx);
    };
    this.pauseMenu = openPauseMenu({
      practice: this.s.practiceMode && !this.s.guide
        ? { modes: PRACTICE_MODES, current: this.s.practiceMode, onSwitch: (mode) => { close(); this.nav.replace('battle', ['practice', mode]); } }
        : undefined,
      stars: this.s.practice ? [] : (this.s.stage.stars ?? []).map((cond) => ({ cond, status: liveStarStatus(cond, liveSummary(this.state), false) })),
      onResume: () => {
        close();
        // 結算動畫中按繼續不開放盤面，動畫播完會自己開
        if ((wasEnabled || this.enableWhenResumed) && canAct(this.guard)) this.boardView.setEnabled(true);
        this.enableWhenResumed = false;
      },
      // 結算動畫播放中撤退按鈕直接停用
      canRetreat: canAct(this.guard),
      onRetreat: () => {
        close();
        // 暫停時盤面已被關掉，取消撤退後要照暫停前的狀態恢復
        const restore = wasEnabled || this.enableWhenResumed;
        this.enableWhenResumed = false;
        void this.askRetreat(restore);
      },
    });
  }

  // ---------- 操作 ----------

  private setTarget(i: number): void {
    if (this.s.battle.setTarget(i).ok) {
      audio.play('tap');
      this.state = this.s.battle.getState();
      this.enemyEls.forEach((el, j) => el.classList.toggle('targeted', j === i));
      markMatchups(this.teamRow, this.state, this.s.data.config.battle);
    }
  }

  /** 點隊員頭像：顯示主動技說明，確認後施放 */
  private useSkill(i: number): void {
    if (!canAct(this.guard)) return;
    const m = this.state.team[i];
    const skill = m?.card.activeSkill ? this.s.data.skills.find((x) => x.id === m.card.activeSkill) : undefined;
    if (!m || !skill) return toast(`${m?.card.name ?? ''}沒有主動技`);
    const blocked = this.s.guide?.checkSkill(i);
    if (blocked) return toast(blocked);
    const sealed = isMemberSealed(this.state, i);
    const ready = m.skillCooldown === 0 && !sealed;
    const dlg = openDialog(skill.name, h('div', null,
      h('p', null, skill.description),
      h('p', { class: 'small-text dim' }, sealed ? '被星紋封印，暫時不能施放' : ready ? '可以施放' : `冷卻中，還要 ${m.skillCooldown} 回合`),
    ), [
      button('取消', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
      button('施放', { variant: 'primary', disabled: !ready, onClick: () => { dlg.close(); void this.castSkill(i); } }),
    ]);
  }

  private async castSkill(i: number): Promise<void> {
    if (!canAct(this.guard)) return;
    const before = this.state;
    const r = this.s.battle.useSkill(i);
    if (!r.ok) return toast(r.reason);
    this.persist();
    this.resolving = true;
    try {
      await this.playSkill(i, before, r);
    } finally {
      this.resolving = false;
      this.pauseMenu?.setCanRetreat(canAct(this.guard));
    }
  }

  private async playSkill(i: number, before: BattleState, r: Extract<ReturnType<Battle['useSkill']>, { ok: true }>): Promise<void> {
    audio.play('skill');
    this.boardView.setEnabled(false);
    const skill = this.s.data.skills.find((x) => x.id === r.skill.skillId);
    if (getSettings().battleFx) await skillCutin(this.element, before.team[i].card, skill?.name ?? '', this.speed);
    await this.animateHits(before, { hits: r.skill.hits });
    const after = this.s.battle.getState();
    const hpBefore = this.shownHp;
    this.state = after;
    this.shownHp = after.hp;
    if (r.skill.heal > 0) floatText(this.hpHost, `+${r.skill.heal.toLocaleString()}`, 'heal');
    if (r.skill.selfDamage > 0) floatText(this.hpHost, `-${r.skill.selfDamage.toLocaleString()}`, 'hurt');
    this.renderHp(hpBefore);
    this.renderTeam();
    flashReadySkills(this.teamRow, before, after);
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

  /** wasEnabled：取消後要不要重新開放盤面（從暫停選單來時由暫停前的狀態決定） */
  private async askRetreat(wasEnabled = !this.boardView.element.classList.contains('disabled')): Promise<void> {
    if (!canAct(this.guard)) return;
    this.boardView.setEnabled(false);
    if (await confirmDialog('撤退', this.s.practice ? '要離開練習場嗎？' : '撤退會視為失敗，已消耗的體力不會退還。')) {
      this.s.battle.forfeit();
      if (!this.s.practice) bus.emit('stageFailed', { stageId: this.s.stage.id });
      this.leaveDefeated();
    } else if (reenableAfterCancel(wasEnabled, this.guard)) {
      this.boardView.setEnabled(true);
    }
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
    this.fallen = [];
    const res = this.s.battle.submitMove(path);
    if (!res.ok) {
      toast(res.reason);
      this.boardView.setBoard(before.board);
      this.enableBoard();
      return;
    }
    this.persist();
    this.resolving = true;
    try {
      await this.playTurn(before, res);
    } finally {
      this.resolving = false;
      this.pauseMenu?.setCanRetreat(canAct(this.guard));
    }
  }

  private async playTurn(before: BattleState, res: Extract<ReturnType<Battle['submitMove']>, { ok: true }>): Promise<void> {
    const after = this.s.battle.getState();
    const speed = this.speed;

    // 逐段播放：消除 → 落下 → 天降連鎖；傷害在全部消完後一次結算
    await this.boardView.playSteps(res.summary.steps, (combo) => {
      this.showCombo(combo);
      audio.play('match', combo);
    }, speed);
    const title = finishCombo(this.comboEl, res.summary.combo, this.s.data.config.battle);
    if (title) {
      this.banner(title, 'combo-title');
      if (!getSettings().lowFx) flashClass(this.element, 'combo-glow', 700);
      await wait(450 / speed);
    }
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
    this.renderTeam();
    flashReadySkills(this.teamRow, before, after);
    clearCombo(this.comboEl);

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
    const save = getSave();
    const id = this.s.practice ? undefined : stageStoryToPlay(this.s.stage, 'beforeBoss', gameData.story, save.progress.storySeen, !save.progress.clearedStages.includes(this.s.stage.id));
    if (!id || !this.s.stage.waves[this.state.wave]?.boss) return false;
    const lines = gameData.story[id];
    this.boardView.setEnabled(false);
    await wait(900);
    await new Promise<void>((resolve) => {
      const layer = h('div', { class: 'story-layer' });
      layer.appendChild(storyBox(lines, () => { layer.remove(); resolve(); }));
      this.element.appendChild(layer);
    });
    markStorySeen(id);
    if (this.state.phase === 'player') this.boardView.setEnabled(true);
    return true;
  }

  private async animateHits(before: BattleState, summary: Pick<TurnSummary, 'hits'>): Promise<void> {
    await playStrikes({
      root: this.element,
      teamRow: this.teamRow,
      enemyZone: this.enemyZone,
      enemyEls: this.enemyEls,
      config: this.s.data.config.battle,
      speed: this.speed,
      updateEnemy: (i, e, previousHp) => this.updateEnemy(i, e, previousHp),
    }, before, summary.hits);
    // 這段攻擊打倒的敵人掉出寶箱（被持續傷害打倒的，等那段動畫播完再掉）
    const shown = this.fallen.filter((i) => this.enemyEls[i]?.classList.contains('dead'));
    this.fallen = this.fallen.filter((i) => !shown.includes(i));
    for (const i of shown) await this.dropCounter.collect(this.element, before.wave, i, this.enemyEls[i], this.speed);
  }

  private banner(text: string, extra = ''): void {
    const el = h('div', { class: ['wave-banner', extra] }, text);
    this.element.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  // ---------- 結算 ----------

  /** 最後一擊：畫面放慢、敵人碎成星屑、「淨化完成」字樣，再進結算 */
  private async playFinisher(): Promise<void> {
    const boss = !!this.s.stage.waves[this.state.wave]?.boss;
    const pace = Math.min(this.speed, 1.5);
    const { lowFx, battleFx } = getSettings();
    audio.play('finisher');
    // 低特效：不放閃光與星屑，只留字樣
    if (lowFx) {
      this.element.appendChild(h('div', { class: 'finisher-text' }, '淨化完成'));
      await wait(500 / pace);
      return;
    }
    // 關閉戰鬥演出時不放慢動作（畫面放大、壓暗）
    if (battleFx) this.element.classList.add('finisher');
    this.element.appendChild(h('div', { class: 'finisher-flash' }));
    this.enemyEls.forEach((el) => {
      el.classList.add('shatter');
      const n = boss ? 22 : 12;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const r = 50 + Math.random() * (boss ? 90 : 55);
        el.appendChild(h('span', { class: 'stardust', style: { '--dx': `${Math.cos(a) * r}px`, '--dy': `${Math.sin(a) * r}px`, animationDelay: `${Math.random() * 120}ms` } }));
      }
    });
    await wait(420 / pace);
    this.element.appendChild(h('div', { class: 'finisher-text' }, '淨化完成'));
    await wait((battleFx ? (boss ? 1000 : 700) : 450) / pace);
  }

  private async onWin(): Promise<void> {
    this.boardView.setEnabled(false);
    await this.playFinisher();
    audio.play('win');
    audio.playBgm('victory');
    if (this.s.guide) return this.tutorialResult(this.s.guide);
    const result = this.s.battle.getResult()!;
    let clear: StageClearResult | null = null;
    const firstClear = !this.s.practice && !getSave().progress.clearedStages.includes(this.s.stage.id);
    let expGains: CardExpGain[] = [];
    let loreGained: ResultNote[] = [];
    if (!this.s.practice) {
      const teamUnits = this.state.team.map((m) => ({ attribute: m.card.attribute, race: m.card.race }));
      const done = completeStage(getSave(), this.s.stage, { ...result, team: teamUnits }, stageContext(gameData.stages, gameData.events), gameData.config, createRng(this.s.dropSeed), Date.now(), this.s.drops && plannedCards(this.s.drops));
      const exp = grantClearExp(done.save, this.s.memberUids ?? [], done.result.cardExp);
      expGains = exp.gains;
      // 星骸殘頁：首次通關有殘頁的關卡（progression/lore.ts）
      const lore = grantLorePage(exp.save, this.s.stage.id, firstClear, gameData.lore!);
      loreGained = loreNotes(lore);
      // 發獎與清掉進行中的戰鬥同一次寫入，重新整理不會重複領或重骰掉落
      commit({ ...lore.save, activeBattle: null });
      clear = done.result;
      bus.emit('stageCleared', { stageId: this.s.stage.id, turns: result.turns, stars: clear.stars });
      for (const d of clear.drops) bus.emit('cardObtained', { cardId: d.cardId, uid: d.uid, source: 'drop' });
    }
    const notes: ResultNote[] = (this.records?.newRecordTexts() ?? []).map((text) => ({ text }));
    if (firstClear) {
      const notice = unlockNotice(this.s.stage);
      if (notice.text) notes.push({ text: notice.text, big: notice.chapter !== undefined });
    }
    notes.push(...loreGained);
    // 借用流浪契印師通關：同行情誼 +1，跨過門檻時加提示，感謝台詞取代隊長台詞
    const bond = this.s.practice ? null : helperBondOnClear(this.s.stage, this.state.team.find((m) => m.isHelper)?.card);
    if (bond) notes.push(...bond.notes);
    // 出戰的玩家角色：羈絆 +1，10、30 場解鎖小劇場
    if (!this.s.practice) notes.push(...cardBondOnClear(this.s.stage, this.s.memberUids ?? []));
    // then：離開後要去的 hash 路徑（下一關）；沒給就回到這關所屬的關卡列表（練習回上一頁）
    const leave = (then?: string) => {
      this.dialog?.close();
      const target = then ?? (this.s.practice ? 'back' : stageListPath(this.s.stage, gameData.events));
      // 通關後的劇情只在首次通關時播放
      const after = stageStoryToPlay(this.s.stage, 'after', gameData.story, getSave().progress.storySeen, firstClear);
      if (after) this.nav.replace('story', [after], { next: target });
      else if (target === 'back') this.nav.back();
      else this.nav.backTo(target);
    };
    const next = this.s.practice ? null : nextStageButton(this.s.stage, getSave(), leave);
    const items = clearItems(result, clear, clear ? (this.s.stage.stars ?? []).map(starText) : [], {
      team: expGains.map((g) => ({ cardId: g.cardId, from: g.levelBefore, to: g.levelAfter })),
    });
    // 契約結算：戰績 → 金幣／經驗滾動 → 首通星晶 → 掉落卡翻面 → 星章點亮 → 升級卡 → 開放提示 → 按鈕
    this.dialog = openClearResult(this.element, {
      stageName: this.s.stage.name,
      items,
      speed: this.speed,
      instantCount: getSettings().lowFx,
      levelUp: clear?.levelUp && levelUpView(clear.levelUp, gameData.config),
      notes,
      constellation: resultConstellation(this.s.stage, clear),
      share: () => shareClear(this.s.stage, this.state.team, this.s.memberUids ?? [], result, clear, firstClear, (this.s.stage.stars ?? []).map(starText)),
      leaderLine: bond?.thanks ?? leaderLineOf(this.state),
      actions: [
        button(next ? '再戰' : '再戰一次', { variant: next ? 'ghost' : undefined, onClick: () => { this.dialog?.close(); this.nav.replace(this.s.practice ? 'battle' : 'prepare', [this.s.stage.id]); } }),
        button('返回', { variant: next ? undefined : 'primary', onClick: () => leave() }),
        next,
      ],
    });
  }

  /** 教學戰鬥的簡化結算：只有戰績與隊長台詞，不發任何獎勵；按繼續後交回教學引導 */
  private tutorialResult(guide: BattleGuide): void {
    guide.hide();
    this.dialog = openClearResult(this.element, {
      stageName: this.s.stage.name,
      items: clearItems(this.s.battle.getResult()!, null),
      speed: this.speed,
      instantCount: getSettings().lowFx,
      notes: [{ text: '正式關卡會在這裡結算金幣、經驗與掉落' }],
      leaderLine: leaderLineOf(this.state),
      actions: [button('繼續', { variant: 'primary', onClick: () => { this.dialog?.close(); guide.onWin(); } })],
    });
  }

  private onLose(): void {
    audio.play('lose');
    const gems = getSave().player.gems;
    const cost = this.s.practice ? 0 : CONTINUE_COST_GEMS;
    const giveUp = () => {
      this.dialog?.close();
      if (!this.s.practice) bus.emit('stageFailed', { stageId: this.s.stage.id });
      this.leaveDefeated();
    };
    const doContinue = () => {
      if (!this.s.practice) {
        const paid = payContinue(getSave());
        if (!paid.ok) return toast('星晶不足');
        commit(paid.save);
      }
      const r = this.s.battle.continueBattle();
      if (!r.ok) return toast(r.reason);
      this.persist();
      this.dialog?.close();
      this.state = this.s.battle.getState();
      this.shownHp = this.state.hp;
      this.renderHp();
      this.boardView.setEnabled(true);
    };
    this.dialog = openDialog('隊伍倒下了', h('p', null, cost ? `花費 ${cost} 星晶續戰，生命回滿並繼續這一波。（持有 ${gems}）` : '要再試一次嗎？'), [
      button('放棄', { variant: 'ghost', sound: 'back', onClick: giveUp }),
      button('續戰', { variant: 'primary', cost: cost ? { kind: 'gem', amount: cost } : undefined, disabled: gems < cost, onClick: doContinue }),
    ], { dismissible: false });
  }

  /** 失敗離場：正式關卡先顯示失敗引導（components/defeat-guide.ts），練習與教學直接返回 */
  private leaveDefeated(): void {
    if (this.s.practice || this.s.guide) return this.nav.back();
    endBattle();
    showDefeatGuide(this.s.stage, { wave: this.state.wave, waveCount: this.state.waveCount, hasHelper: this.state.team.some((m) => m.isHelper) }, this.nav);
  }
}
