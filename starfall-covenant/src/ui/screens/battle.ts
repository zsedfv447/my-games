// 戰鬥畫面：上方敵人區、中間隊伍與生命條、下方 6×5 盤面（GDD 2.5 第 4 項）
import { h, svg, clear } from '../dom';
import { gameData } from '../../data/load';
import { bus } from '../../core/events';
import { createRng } from '../../core/rng';
import type { StageDef } from '../../core/types';
import { startBattle, type Battle, type BattleData, type BattleState, type EnemyState, type TurnSummary } from '../../battle/battle-state';
import { BoardView } from '../../battle/view/board-view';
import { completeStage, isStageUnlocked, liveStarStatus, nextStageAfter, stagesUnlockedBy, type BattleSummary, type LiveStarStatus, type StageClearResult } from '../../progression/stages';
import { grantBattleExp, type CardExpGain } from '../../growth';
import { CONTINUE_COST_GEMS, payContinue } from '../../progression/continue';
import { enemySvg } from '../art/enemy';
import { ATTRIBUTE_NAMES } from '../art/palette';
import { resolveArtPath, userAsset } from '../assets';
import { audio } from '../audio';
import { badge, bar, button, emptyState, iconButton, resourceIcon } from '../components/basic';
import { cardThumb } from '../components/card-thumb';
import { confirmDialog, openDialog, toast, type DialogHandle } from '../components/overlay';
import { DEMO_DATA, DEMO_HELPER, DEMO_STAGE, DEMO_TEAM } from '../demo';
import { markJustUnlocked, stageContext } from '../stage-nav';
import { buildSortieTeam } from '../sortie';
import { commit, getSave, getSettings, growth } from '../state';
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
  /** 出戰的玩家卡 uid（不含助戰；借用隊伍時為空），結算發卡片經驗用 */
  memberUids: string[];
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
    return { stage: t.stage, data: t.data, practice: true, battle: t.battle, memberUids: [], guide };
  }
  if (stageId === 'practice') {
    return { stage: DEMO_STAGE, data: DEMO_DATA, practice: true, battle: startBattle(DEMO_STAGE, DEMO_TEAM, DEMO_HELPER, createRng(), DEMO_DATA), memberUids: [] };
  }
  const stage = gameData.stages.find((s) => s.id === stageId);
  if (!stage) return '找不到這一關';
  if (ticket !== stageId) return '戰鬥已中斷，請重新出發';
  ticket = null;
  const team = buildSortieTeam(stage, getSave(), growth.card);
  try {
    const memberUids = team.borrowed ? [] : team.members.flatMap((m) => (m.uid ? [m.uid] : []));
    return { stage, data: gameData, practice: false, battle: startBattle(stage, team.members, team.helper, createRng(), gameData), memberUids };
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
  private hud = h('div', { class: 'battle-hud' });
  private starShown: LiveStarStatus[] = [];
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

  constructor(private s: Setup, private nav: Navigator) {
    this.state = s.battle.getState();
    this.shownHp = this.state.hp;
    this.speed = getSettings().battleSpeed;
    this.boardView = new BoardView({
      cellSize: CELL,
      moveSeconds: () => this.state.moveTimeSeconds,
      showTimer: () => getSettings().showMoveTimer,
      onMove: (path) => void this.resolveTurn(path),
      onStep: () => audio.play('tap'),
    });
    this.element = h(
      'div',
      { class: 'battle' },
      h('div', { class: 'battle-top safe-top' },
        h('div', null, this.waveLabel, this.hud),
        h('div', { class: 'stage-name' }, s.stage.name),
        iconButton('close', '撤退', () => void this.askRetreat())),
      this.enemyZone,
      this.comboEl,
      h('div', { class: 'battle-bottom safe-bottom' }, this.teamRow, this.teamChipsHost, this.hpHost, this.boardView.element),
    );
    this.renderEnemies();
    this.renderTeam();
    this.renderHp(this.state.hp);
    this.renderHud();
    this.boardView.setBoard(this.state.board);
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
        h('div', { class: 'enemy-art' }, enemyArt(e, boss)),
        h('div', { class: 'enemy-name' }, badge(ATTRIBUTE_NAMES[e.def.attribute], `attr-${e.def.attribute}`), e.def.name),
        chipRow(enemyChips(e), 'enemy-chips'),
        bar({ value: e.hp, max: e.maxHp, variant: 'hp' }),
      );
      row.appendChild(el);
      return el;
    });
    this.enemyZone.appendChild(row);
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
  }

  private renderHp(previous?: number): void {
    this.teamChipsHost.replaceChildren(chipRow(teamChips(this.state), 'team-chips'));
    clear(this.hpHost);
    this.hpHost.appendChild(bar({ value: this.state.hp, max: this.state.maxHp, variant: 'hp', label: true, previous }));
  }

  /** 戰鬥中的星章判定用摘要 */
  private summary(): BattleSummary {
    const st = this.state;
    return {
      turns: st.turns, usedActiveSkill: st.usedActiveSkill, maxCombo: st.maxCombo, continues: st.continues,
      team: st.team.map((m) => ({ attribute: m.card.attribute, race: m.card.race })),
    };
  }

  /** 頂部：目前回合數＋本關星章（失敗變灰、Combo 達成時點亮） */
  private renderHud(): void {
    const won = this.state.phase === 'won';
    const turn = won ? this.state.turns : this.state.turns + 1;
    const conds = this.s.stage.stars ?? [];
    const now = conds.map((c) => liveStarStatus(c, this.summary(), won));
    const lit = now.some((st, i) => st === 'done' && this.starShown[i] === 'pending');
    const stars = conds.map((c, i) => h('button', {
      type: 'button',
      class: ['hud-star', now[i], this.starShown[i] && this.starShown[i] !== now[i] && 'pop'],
      'aria-label': `${starText(c)}：${now[i] === 'done' ? '達成' : now[i] === 'failed' ? '未達成' : '進行中'}`,
      onClick: () => toast(`${starText(c)}（${now[i] === 'done' ? '已達成' : now[i] === 'failed' ? '已失敗' : '進行中'}）`),
    }, '★'));
    this.hud.replaceChildren(h('span', { class: 'turn-count' }, `回合 ${turn}`));
    if (stars.length) this.hud.appendChild(h('span', { class: 'hud-stars' }, stars));
    if (lit) audio.play('confirm');
    this.starShown = now;
  }

  private showCombo(combo: number): void {
    this.comboEl.textContent = `${combo} Combo`;
    this.comboEl.classList.remove('pop');
    void this.comboEl.offsetWidth;
    this.comboEl.classList.add('pop');
  }

  // ---------- 操作 ----------

  private setTarget(i: number): void {
    if (this.s.battle.setTarget(i).ok) {
      audio.play('tap');
      this.state = this.s.battle.getState();
      this.enemyEls.forEach((el, j) => el.classList.toggle('targeted', j === i));
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
    await this.animateHits(before, { hits: r.skill.hits });
    const after = this.s.battle.getState();
    const hpBefore = this.shownHp;
    this.state = after;
    this.shownHp = after.hp;
    if (r.skill.heal > 0) floatText(this.hpHost, `+${r.skill.heal.toLocaleString()}`, 'heal');
    if (r.skill.selfDamage > 0) floatText(this.hpHost, `-${r.skill.selfDamage.toLocaleString()}`, 'hurt');
    this.renderHp(hpBefore);
    this.renderTeam();
    this.renderHud();
    if (r.skill.boardChanged) await this.boardView.playRefill(after.board, this.speed);
    if (after.wave !== before.wave) {
      this.renderEnemies();
      this.updateBgm();
    } else {
      after.enemies.forEach((e, j) => this.updateEnemy(j, e));
    }
    if (after.phase === 'won') return this.onWin();
    this.boardView.setEnabled(true);
    this.s.guide?.afterSkill(after);
  }

  private async askRetreat(): Promise<void> {
    if (this.state.phase !== 'player') return;
    this.boardView.setEnabled(false);
    if (await confirmDialog('撤退', this.s.practice ? '要離開練習場嗎？' : '撤退會視為失敗，已消耗的體力不會退還。')) {
      this.s.battle.forfeit();
      if (!this.s.practice) bus.emit('stageFailed', { stageId: this.s.stage.id });
      this.nav.back();
    } else {
      this.boardView.setEnabled(true);
    }
  }

  private async resolveTurn(path: Parameters<Battle['submitMove']>[0]): Promise<void> {
    const before = this.state;
    const veto = this.s.guide?.checkMove(path, before.board);
    if (veto) {
      toast(veto);
      this.boardView.setBoard(before.board);
      this.boardView.setEnabled(true);
      return;
    }
    this.queue = [];
    const res = this.s.battle.submitMove(path);
    if (!res.ok) {
      toast(res.reason);
      this.boardView.setBoard(before.board);
      this.boardView.setEnabled(true);
      return;
    }
    const after = this.s.battle.getState();
    const speed = this.speed;

    // 逐段播放：消除 → 落下 → 天降連鎖；傷害在全部消完後一次結算
    await this.boardView.playSteps(res.summary.steps, (combo) => {
      this.showCombo(combo);
      audio.play('match', combo);
    }, speed);
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
      this.element.classList.remove('shake');
      void this.element.offsetWidth;
      this.element.classList.add('shake');
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
    this.renderHud();
    this.comboEl.classList.remove('pop');
    this.comboEl.textContent = '';

    if (after.wave !== before.wave) {
      await wait(350 / speed);
      this.renderEnemies();
      this.updateBgm();
      this.banner(after.waveCount - 1 === after.wave && this.s.stage.waves[after.wave]?.boss ? 'BOSS' : `WAVE ${after.wave + 1}`);
      if (!this.s.practice && (await this.maybeBossStory())) return;
    } else {
      after.enemies.forEach((e, i) => this.updateEnemy(i, e));
    }

    if (after.phase === 'won') return this.onWin();
    if (after.phase === 'lost') return this.onLose();
    this.boardView.setEnabled(true);
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
    if (this.state.phase === 'player') this.boardView.setEnabled(true);
    return true;
  }

  private async animateHits(before: BattleState, summary: Pick<TurnSummary, 'hits'>): Promise<void> {
    const dealt = new Map<number, number>();
    for (const hit of summary.hits) dealt.set(hit.enemy, (dealt.get(hit.enemy) ?? 0) + hit.damage);
    before.enemies.forEach((e, i) => {
      const dmg = dealt.get(i);
      if (!dmg) return;
      const hp = Math.max(0, e.hp - dmg);
      this.updateEnemy(i, { ...e, hp }, e.hp);
      const el = this.enemyEls[i];
      el.classList.remove('hit');
      void el.offsetWidth;
      el.classList.add('hit');
      floatText(el, dmg.toLocaleString(), 'dmg');
    });
    if (dealt.size) await wait(380 / this.speed);
  }

  private banner(text: string): void {
    const el = h('div', { class: 'wave-banner' }, text);
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
    let expGains: CardExpGain[] = [];
    let firstClear = false;
    if (!this.s.practice) {
      const teamUnits = this.state.team.map((m) => ({ attribute: m.card.attribute, race: m.card.race }));
      firstClear = !getSave().progress.clearedStages.includes(this.s.stage.id);
      const done = completeStage(getSave(), this.s.stage, { ...result, team: teamUnits }, stageContext(gameData.stages), gameData.config, createRng(), Date.now());
      // 卡片經驗只發給出戰的玩家卡，助戰不拿
      const exp = grantBattleExp(done.save, growth, this.s.memberUids, done.result.cardExp);
      expGains = exp.gains;
      commit(exp.save);
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
      if (clear.cardExp > 0 && expGains.length) {
        const ups = expGains.filter((g) => g.levelAfter > g.levelBefore);
        rows.push(h('div', { class: 'row between' }, h('span', null, '隊員經驗'), h('strong', null, `各 +${clear.cardExp}`)));
        for (const g of ups) rows.push(h('p', { class: 'gold-text small-text' }, `${growth.card(g.cardId)?.name ?? g.cardId} 升到 Lv.${g.levelAfter}！`));
      }
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
    // 第一次通關時提示開放了哪些關卡；跨章時改成「新章節開放」
    const candidate = this.s.practice ? undefined : nextStageAfter(this.s.stage, gameData.stages);
    const next = candidate && isStageUnlocked(getSave(), candidate, stageContext(gameData.stages), Date.now()) ? candidate : undefined;
    if (firstClear && !this.s.practice) {
      const opened = stagesUnlockedBy(this.s.stage.id, gameData.stages);
      markJustUnlocked(opened.map((st) => st.id));
      const newChapter = opened.find((st) => st.kind === 'main' && st.chapter !== undefined && st.chapter !== this.s.stage.chapter);
      const chapter = newChapter && gameData.chapters.find((c) => c.chapter === newChapter.chapter);
      if (chapter) {
        rows.unshift(h('div', { class: 'unlock-note gold-text' }, `第 ${chapter.chapter} 章「${chapter.name}」開放！`));
        this.banner('新章節開放');
      } else if (opened.length) {
        rows.unshift(h('div', { class: 'unlock-note small-text' }, `新關卡開放：${opened.map((st) => st.name).join('、')}`));
      }
    }
    /** 離開戰鬥；通關後的劇情只在第一次播放，播完再去 then（沒給就回上一頁） */
    const leave = (then?: string) => {
      this.dialog?.close();
      const after = this.s.stage.story?.after;
      if (after && gameData.story[after] && !getSave().progress.storySeen.includes(after)) this.nav.replace('story', [after], { next: then ?? 'back' });
      else if (then) this.nav.replace(then.split('/')[0], then.split('/').slice(1));
      else this.nav.back();
    };
    this.dialog = openDialog('勝利！', h('div', { class: 'list' }, rows), [
      button(next ? '再戰' : '再戰一次', { variant: next ? 'ghost' : undefined, onClick: () => { this.dialog?.close(); this.nav.replace(this.s.practice ? 'battle' : 'prepare', [this.s.stage.id]); } }),
      button('返回', { variant: next ? undefined : 'primary', onClick: () => leave() }),
      next && button('下一關', { variant: 'primary', onClick: () => leave(`prepare/${next.id}`) }),
    ].filter((b): b is HTMLButtonElement => !!b), { dismissible: false });
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
      this.renderHud();
      this.boardView.setEnabled(true);
    };
    this.dialog = openDialog('隊伍倒下了', h('p', null, cost ? `花費 ${cost} 星晶續戰，生命回滿並繼續這一波。（持有 ${gems}）` : '要再試一次嗎？'), [
      button('放棄', { variant: 'ghost', sound: 'back', onClick: giveUp }),
      button('續戰', { variant: 'primary', cost: cost ? { kind: 'gem', amount: cost } : undefined, disabled: gems < cost, onClick: doContinue }),
    ], { dismissible: false });
  }
}
