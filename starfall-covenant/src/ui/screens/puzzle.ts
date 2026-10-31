// 星紋謎題每日一題（提案 51）：不扣體力、沒有敵人，一次轉珠達成條件就過關；每天第一次解開領獎
import '../puzzle.css';
import { AssistantPlannerClient } from '../../battle/assistant/client';
import type { AssistantPlan } from '../../battle/assistant/types';
import type { BattleState } from '../../battle/runtime';
import { computeDrops, dropAndFill, type Pos } from '../../battle/board';
import { BoardView } from '../../battle/view/board-view';
import { createRng } from '../../core/rng';
import { gameData } from '../../data/load';
import {
  claimPuzzle, currentStreak, dailyPuzzle, daySeed, judgePuzzle, puzzleOf, puzzleReward, solvedToday, type Puzzle, type PuzzleGoal,
} from '../../progression/puzzle';
import { dateKey } from '../../progression/time';
import type { SaveData } from '../../core/types';
import { ORB_NAMES } from '../art/palette';
import { audio } from '../audio';
import { button, panel } from '../components/basic';
import { toast } from '../components/overlay';
import { revealReward } from '../components/reward-reveal';
import { h } from '../dom';
import type { ScreenDef } from '../router';
import { commit, getSave, getSettings } from '../state';
import { LAMP_EVERY, LAMP_MAX, nextPuzzleBonus, streakWithLamps } from '../../progression/milestones';

const CELL = 58;

export function goalText(g: PuzzleGoal): string {
  switch (g.kind) {
    case 'combo': return `一次轉珠做出 ${g.combo} Combo`;
    case 'colorCount': return `一次轉珠消除 ${g.count} 顆以上${ORB_NAMES[g.orb]}珠`;
    case 'clearColor': return `一次轉珠消掉盤面上所有${ORB_NAMES[g.orb]}珠`;
    case 'rainbow': return `一次轉珠消除 ${g.colors} 種不同顏色`;
  }
}

/** 目前進度文字：例如「2 / 3 Combo」 */
function progressText(g: PuzzleGoal, value: number): string {
  switch (g.kind) {
    case 'combo': return `${value} / ${g.combo} Combo`;
    case 'colorCount': return `${value} / ${g.count} 顆`;
    case 'clearColor': return value === 0 ? '全部消掉了' : `還剩 ${value} 顆`;
    case 'rainbow': return `${value} / ${g.colors} 種顏色`;
  }
}

/** 冒險頁入口的副標 */
export function puzzleEntrySub(now = Date.now()): string {
  const save = getSave();
  const streak = currentStreak(save, now);
  if (solvedToday(save, now)) return `今天已解開・連續 ${streak} 天`;
  return `每天一題・不耗體力${streak ? `・連續 ${streak} 天` : ''}`;
}

/** 星燈守夜（milestones.ts）：持有幾盞；昨天以前漏掉的天數會在今天解開時消耗 */
function lampText(save: SaveData, now: number): string {
  const r = puzzleOf(save);
  const lamps = r.lamps ?? 0;
  const used = streakWithLamps(r, dateKey(now)).lampsUsed;
  if (used > 0 && !solvedToday(save, now)) return `\n星燈守夜 ${'🏮'.repeat(lamps)}：漏掉 ${used} 天，今天解開會用掉 ${used} 盞保住連續天數`;
  return `\n星燈守夜 ${lamps}/${LAMP_MAX} 盞${lamps ? ' 🏮'.repeat(lamps) : ''}（每連續 ${LAMP_EVERY} 天得 1 盞，漏一天自動保住）`;
}

export const puzzleScreen: ScreenDef = {
  name: 'puzzle',
  title: '星紋謎題',
  chrome: 'sub',
  parent: 'adventure',
  render({ onLeave }) {
    const view = new PuzzleView(dailyPuzzle(dateKey(Date.now()), gameData.config.board));
    onLeave(() => view.destroy());
    return view.element;
  },
};

class PuzzleView {
  readonly element: HTMLElement;
  private board: BoardView;
  private steps = 0;
  private alive = true;
  private assistantPlaying = false;
  private resolving = false;
  private visibilityChanged = () => { if (document.hidden && !this.resolving) this.cancelAssistant(); };
  private generation = 0;
  private planner = new AssistantPlannerClient();
  private plan: AssistantPlan | null = null;
  private playback: AbortController | null = null;
  private assistantStatus = h('p', { class: 'small-text', role: 'status' }, '依今天的題目規劃，只算首消，不使用參考解。');
  private planButton = button('規劃解題路線', { small: true, onClick: () => void this.planPuzzle() });
  private previewButton = button('預覽路線', { small: true, onClick: () => { if (this.plan && this.board.canInteract) this.board.previewPath(this.plan.path); } });
  private executeButton = button('照路線轉珠一次', { small: true, onClick: () => void this.executePlan() });
  private stepEl = h('span', { class: 'puzzle-steps' });
  private statusEl = h('div', { class: 'puzzle-status', 'aria-live': 'polite' });
  private rewardEl = h('div', { class: 'puzzle-reward small-text' });
  private retryBtn: HTMLButtonElement;

  constructor(private puzzle: Puzzle) {
    this.board = new BoardView({
      cellSize: CELL,
      // 謎題不限時，只限步數
      moveSeconds: () => 120,
      showTimer: () => false,
      onMove: (path) => void this.resolve(path),
      onStep: () => this.step(),
    });
    this.retryBtn = button('重新開始', { small: true, variant: 'ghost', icon: 'history', onClick: () => this.reset() });
    this.element = h('div', { class: 'puzzle-screen' },
      panel({ gold: true },
        h('div', { class: 'puzzle-head' }, h('span', { class: 'puzzle-day' }, puzzle.day.replace(/-/g, '/')), this.stepEl),
        h('div', { class: 'puzzle-goal' }, goalText(puzzle.goal)),
        h('div', { class: 'small-text dim' }, `最多走 ${puzzle.maxSteps} 步・只算這一次轉珠的消除，不算天降連鎖`),
        this.rewardEl,
      ),
      h('div', { class: 'puzzle-board' }, this.board.element),
      h('details', null, h('summary', null, '轉珠助手'), this.assistantStatus,
        h('div', { class: 'row' }, this.planButton, this.previewButton, this.executeButton,
          button('取消／清除路線', { small: true, variant: 'ghost', onClick: () => { if (!this.resolving) this.cancelAssistant(); } }))),
      this.statusEl,
      h('div', { class: 'row', style: { justifyContent: 'center' } }, this.retryBtn),
    );
    this.reset();
    document.addEventListener('visibilitychange', this.visibilityChanged);
  }

  destroy(): void {
    this.alive = false;
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.cancelAssistant();
    this.board.destroy();
  }

  private cancelAssistant(): void {
    this.generation++;
    this.planner.cancel();
    const wasPlaying = this.assistantPlaying;
    this.playback?.abort();
    this.playback = null;
    this.assistantPlaying = false;
    if (wasPlaying && this.alive) {
      this.steps = 0;
      this.renderSteps();
      this.board.setEnabled(true);
    }
    this.plan = null;
    this.board.previewPath(null);
    this.planButton.disabled = false;
    this.previewButton.disabled = true;
    this.executeButton.disabled = true;
    this.assistantStatus.textContent = '可依今天的題目重新規劃路線。';
  }

  private async planPuzzle(): Promise<void> {
    if (this.resolving || !this.board.canInteract || this.steps > 0) return;
    this.cancelAssistant();
    const generation = this.generation;
    this.planButton.disabled = true;
    this.assistantStatus.textContent = '正在規劃，可取消或直接自行轉珠。';
    const state: BattleState = {
      stageId: 'puzzle', phase: 'player', wave: 0, waveCount: 1,
      board: this.puzzle.board, team: [], hp: 1, maxHp: 1, enemies: [], target: 0,
      moveTimeSeconds: 120, turns: 0, maxCombo: 0, usedActiveSkill: false,
      continues: 0, buffs: [], teamStatuses: [],
    };
    try {
      const plan = await this.planner.plan({ state, leaders: [], config: gameData.config.battle,
        request: { goal: 'puzzle' }, puzzle: { goal: this.puzzle.goal, maxSteps: this.puzzle.maxSteps } });
      if (!this.alive || generation !== this.generation) return;
      this.planButton.disabled = false;
      if (!plan || !this.board.canInteract || this.steps > 0 || plan.path.length - 1 > this.puzzle.maxSteps) {
        this.assistantStatus.textContent = '這次沒有可用路線，請重新規劃。';
        return;
      }
      this.plan = plan;
      this.previewButton.disabled = false;
      this.executeButton.disabled = false;
      const judgement = judgePuzzle(this.puzzle, plan.path);
      this.assistantStatus.textContent = `${judgement.solved ? '找到達成題目的路線' : '目前找到的路線尚未達成題目'}：${progressText(this.puzzle.goal, judgement.value)}，${plan.path.length - 1} 步。${plan.timedOut ? '已達搜尋時間上限。' : ''}可預覽或執行一次。`;
    } catch {
      if (!this.alive || generation !== this.generation) return;
      this.planButton.disabled = false;
      this.assistantStatus.textContent = '規劃失敗，請再試一次。';
    }
  }

  private async executePlan(): Promise<void> {
    const plan = this.plan;
    if (this.resolving || !plan || !this.board.canInteract || this.steps > 0) return;
    this.cancelAssistant();
    const generation = this.generation;
    const playback = new AbortController();
    this.playback = playback;
    this.assistantPlaying = true;
    this.retryBtn.disabled = true;
    this.planButton.disabled = true;
    this.assistantStatus.textContent = '正在照路線轉珠一次。';
    let completed = false;
    try {
      completed = await this.board.playPath(plan.path, playback.signal);
    } catch {
      if (this.alive && generation === this.generation) {
        this.cancelAssistant();
        this.board.setBoard(this.puzzle.board);
        this.board.setEnabled(true);
        this.retryBtn.disabled = false;
        this.assistantStatus.textContent = '路線播放中斷，已還原盤面，請重新規劃。';
      }
      return;
    }
    if (!this.alive || generation !== this.generation || playback.signal.aborted) {
      if (this.alive && !this.assistantPlaying && !this.resolving) {
        this.board.setEnabled(true);
        this.retryBtn.disabled = false;
      }
      return;
    }
    this.playback = null;
    this.assistantPlaying = false;
    this.steps = plan.path.length - 1;
    this.renderSteps();
    if (completed) await this.resolve(plan.path);
    else { this.cancelAssistant(); this.retryBtn.disabled = false; }
  }

  private renderReward(): void {
    const now = Date.now();
    const save = getSave();
    if (solvedToday(save, now)) {
      this.rewardEl.textContent = `今天的獎勵已領取・連續 ${currentStreak(save, now)} 天。可以繼續練習。${lampText(save, now)}`;
      return;
    }
    const { reward, streak } = puzzleReward(save, now);
    // 下一個加送星晶的天數（里程碑 7、14、30、60 天，其餘每 7 天）：progression/milestones.ts
    const next = nextPuzzleBonus(streak);
    this.rewardEl.textContent = `解開獎勵：金幣 ${reward.coin}${reward.gems ? `＋星晶 ${reward.gems}（連續 ${streak} 天）` : `・再連續 ${next.days - streak} 天加送星晶 ${next.gems}${next.milestone ? '（里程碑）' : ''}`}${lampText(save, now)}`;
  }

  private renderSteps(): void {
    this.stepEl.textContent = `步數 ${this.steps} / ${this.puzzle.maxSteps}`;
    this.stepEl.classList.toggle('over', this.steps > this.puzzle.maxSteps);
  }

  private step(): void {
    if (!this.assistantPlaying) this.cancelAssistant();
    audio.play('tap');
    this.steps++;
    this.renderSteps();
  }

  private reset(): void {
    this.resolving = false;
    this.retryBtn.disabled = false;
    this.cancelAssistant();
    this.steps = 0;
    this.renderSteps();
    this.renderReward();
    this.statusEl.textContent = '拖曳一顆珠子開始轉珠';
    this.statusEl.className = 'puzzle-status';
    this.board.setBoard(this.puzzle.board);
    this.board.setEnabled(true);
  }

  private async resolve(path: Pos[]): Promise<void> {
    this.cancelAssistant();
    const generation = this.generation;
    this.resolving = true;
    this.retryBtn.disabled = true;
    this.planButton.disabled = true;
    this.board.setEnabled(false);
    const result = judgePuzzle(this.puzzle, path);
    // 播放這次消除，空格由固定種子補珠（只是畫面，不影響判定）
    if (result.groups.length) {
      const cleared = result.groups.flatMap((g) => g.cells);
      const after = dropAndFill(result.board, cleared, createRng(daySeed(this.puzzle.day)));
      await this.board.playSteps([{ cascade: 0, before: result.board, groups: result.groups, drops: computeDrops(result.board, cleared), after }], (combo) => audio.play('match', combo), getSettings().battleSpeed);
    }
    if (!this.alive || generation !== this.generation) return;
    this.resolving = false;
    this.retryBtn.disabled = false;
    if (!result.solved) {
      audio.play('lose');
      const why = result.invalid === 'tooManySteps' ? `超過 ${this.puzzle.maxSteps} 步了` : result.invalid === 'blocked' ? '這條路徑走不通' : progressText(this.puzzle.goal, result.value);
      this.statusEl.textContent = `差一點！${why}。按「重新開始」再試一次`;
      this.statusEl.className = 'puzzle-status fail';
      return;
    }
    audio.play('win');
    this.statusEl.textContent = `解開了！${progressText(this.puzzle.goal, result.value)}`;
    this.statusEl.className = 'puzzle-status ok';
    const claimed = claimPuzzle(getSave(), this.puzzle, path, gameData.config, Date.now());
    if (claimed.ok) {
      commit(claimed.save);
      this.renderReward();
      await revealReward('星紋謎題解開', claimed.reward!, `連續 ${claimed.streak} 天`);
    } else if (claimed.reason === 'wrongDay') {
      toast('已經換日了，回到冒險頁重新進入就是今天的新題目');
    }
  }
}
