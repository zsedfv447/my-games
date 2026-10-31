// 星紋謎題每日一題（提案 51）：不扣體力、沒有敵人，一次轉珠達成條件就過關；每天第一次解開領獎
import '../puzzle.css';
import { computeDrops, dropAndFill, type Pos } from '../../battle/board';
import { BoardView } from '../../battle/view/board-view';
import { createRng } from '../../core/rng';
import { gameData } from '../../data/load';
import {
  claimPuzzle, currentStreak, dailyPuzzle, daySeed, judgePuzzle, puzzleReward, solvedToday, type Puzzle, type PuzzleGoal,
} from '../../progression/puzzle';
import { dateKey } from '../../progression/time';
import { ORB_NAMES } from '../art/palette';
import { audio } from '../audio';
import { button, panel } from '../components/basic';
import { toast } from '../components/overlay';
import { revealReward } from '../components/reward-reveal';
import { h } from '../dom';
import type { ScreenDef } from '../router';
import { commit, getSave, getSettings } from '../state';
import { nextPuzzleBonus } from '../../progression/milestones';

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
      this.statusEl,
      h('div', { class: 'row', style: { justifyContent: 'center' } }, this.retryBtn),
    );
    this.reset();
  }

  destroy(): void {
    this.board.destroy();
  }

  private renderReward(): void {
    const now = Date.now();
    const save = getSave();
    if (solvedToday(save, now)) {
      this.rewardEl.textContent = `今天的獎勵已領取・連續 ${currentStreak(save, now)} 天。可以繼續練習。`;
      return;
    }
    const { reward, streak } = puzzleReward(save, now);
    // 下一個加送星晶的天數（里程碑 7、14、30、60 天，其餘每 7 天）：progression/milestones.ts
    const next = nextPuzzleBonus(streak);
    this.rewardEl.textContent = `解開獎勵：金幣 ${reward.coin}${reward.gems ? `＋星晶 ${reward.gems}（連續 ${streak} 天）` : `・再連續 ${next.days - streak} 天加送星晶 ${next.gems}${next.milestone ? '（里程碑）' : ''}`}`;
  }

  private renderSteps(): void {
    this.stepEl.textContent = `步數 ${this.steps} / ${this.puzzle.maxSteps}`;
    this.stepEl.classList.toggle('over', this.steps > this.puzzle.maxSteps);
  }

  private step(): void {
    audio.play('tap');
    this.steps++;
    this.renderSteps();
  }

  private reset(): void {
    this.steps = 0;
    this.renderSteps();
    this.renderReward();
    this.statusEl.textContent = '拖曳一顆珠子開始轉珠';
    this.statusEl.className = 'puzzle-status';
    this.board.setBoard(this.puzzle.board);
    this.board.setEnabled(true);
  }

  private async resolve(path: Pos[]): Promise<void> {
    this.board.setEnabled(false);
    const result = judgePuzzle(this.puzzle, path);
    // 播放這次消除，空格由固定種子補珠（只是畫面，不影響判定）
    if (result.groups.length) {
      const cleared = result.groups.flatMap((g) => g.cells);
      const after = dropAndFill(result.board, cleared, createRng(daySeed(this.puzzle.day)));
      await this.board.playSteps([{ cascade: 0, before: result.board, groups: result.groups, drops: computeDrops(result.board, cleared), after }], (combo) => audio.play('match', combo), getSettings().battleSpeed);
    }
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
