// 新手教學的流程規則（純邏輯，不碰 DOM）：存檔裡的進度、每個畫面要說什麼、教學戰鬥的固定盤面。
// 流程：教學戰鬥（拖曳、Combo、屬性剋制、隊長技、主動技）→ 編隊 → 召喚 → 第一章第一關。
import { TUTORIAL_STEPS, type SaveData, type TutorialStep } from '../../core/types';
import { applyPath, boardFromStrings, findMatches, isAdjacent, type Board, type Pos } from '../../battle/board';
import type { Rng } from '../../core/rng';

export const FIRST_STAGE = 'st-1-1';

/** 目前的教學步驟；存檔被手改成未知的值時視為已完成，不會卡住玩家 */
export function tutorialStep(save: SaveData): TutorialStep {
  if (save.progress.tutorialDone) return 'done';
  const step = save.tutorial?.step;
  return step && TUTORIAL_STEPS.includes(step) ? step : 'done';
}

export function isTutorialActive(save: SaveData): boolean {
  return tutorialStep(save) !== 'done';
}

export function setTutorialStep(save: SaveData, step: TutorialStep): SaveData {
  return {
    ...save,
    progress: { ...save.progress, tutorialDone: step === 'done' },
    tutorial: { giftGiven: save.tutorial?.giftGiven ?? false, step },
  };
}

/** 只有目前正在 from 這一步時才前進，避免重複事件把流程推過頭 */
export function advanceTutorial(save: SaveData, from: TutorialStep): SaveData {
  if (tutorialStep(save) !== from) return save;
  const next = TUTORIAL_STEPS[TUTORIAL_STEPS.indexOf(from) + 1] ?? 'done';
  return setTutorialStep(save, next);
}

export const skipTutorial = (save: SaveData): SaveData => setTutorialStep(save, 'done');

/** 從設定重看：回到教學戰鬥。召喚贈禮只送一次 */
export const restartTutorial = (save: SaveData): SaveData => setTutorialStep(save, 'battle');

/** 召喚這一步送的星晶（剛好夠一次單抽）；同一個存檔只送一次 */
export function grantSummonGift(save: SaveData, gems: number): { save: SaveData; granted: number } {
  if (save.tutorial?.giftGiven || gems <= 0) return { save, granted: 0 };
  return {
    save: {
      ...save,
      player: { ...save.player, gems: save.player.gems + gems },
      tutorial: { step: tutorialStep(save), giftGiven: true },
    },
    granted: gems,
  };
}

// ---------- 各畫面的引導 ----------

export interface GuideAction {
  label: string;
  /** 前往的畫面 */
  go?: [string, string[]];
  /** 完成目前這一步 */
  advance?: boolean;
}

export interface GuideSpec {
  /** 會依序顯示的台詞 */
  lines: string[];
  /** 要指給玩家看的元素（CSS 選擇器，在目前畫面內找） */
  target?: string;
  /** 對話框位置：目標在畫面下半部時放上面，才不會擋住要按的按鈕 */
  placement?: 'top' | 'bottom';
  action?: GuideAction;
  /** 次要按鈕（例如先不召喚） */
  secondary?: GuideAction;
}

/** 這些畫面不顯示引導：全螢幕演出、戰鬥（教學戰鬥自己有引導）、設定（讓玩家能略過或重看） */
const QUIET_ROUTES = new Set(['title', 'story', 'summon-ritual', 'battle', 'settings', 'gallery']);

export function guideFor(step: TutorialStep, route: { name: string; args: string[] }): GuideSpec | null {
  if (step === 'done' || QUIET_ROUTES.has(route.name)) return null;
  switch (step) {
    case 'battle':
      return {
        lines: ['歡迎來到契約之門，新任契印師！我是引路人薇菈。', '在出發冒險前，先陪你練一場轉珠戰鬥吧。'],
        action: { label: '開始轉珠教學', go: ['battle', ['tutorial']] },
      };
    case 'team':
      if (route.name === 'team') {
        return {
          lines: ['這是你的隊伍。最左邊是「隊長」，隊長技會在戰鬥中一直生效。', '點頭像就能換人；隊伍空間有上限，稀有的卡比較佔位置。現在的隊伍已經很好用了！'],
          target: '.team-slot',
          action: { label: '知道了', advance: true },
        };
      }
      return { lines: ['剛剛的隊長技很強吧？來看看你的隊伍是怎麼組成的。'], action: { label: '前往編隊', go: ['team', []] } };
    case 'summon':
      if (route.name === 'summon') {
        return {
          lines: ['在這裡用星晶解開封印，就能和新的夥伴締結契約。', '我送你一次單抽的星晶，按「單次封印」試試看，再把封印往下拉開！'],
          target: '.seal-pull-actions .btn',
          placement: 'top',
          secondary: { label: '先不召喚', advance: true },
        };
      }
      return { lines: ['再來是召喚！我準備了一份見面禮。'], action: { label: '前往召喚', go: ['summon', []] } };
    case 'stage':
      if (route.name === 'prepare' && route.args[0] === FIRST_STAGE) {
        return {
          lines: ['出戰前可以在這裡確認隊伍與星章條件。', '按下「出發」，前往第一章第一關！'],
          target: '[data-tut="sortie"] .btn',
          placement: 'top',
          secondary: { label: '結束教學', advance: true },
        };
      }
      return { lines: ['準備好了！第一章的星骸正等著你。'], action: { label: '前往第一章第一關', go: ['prepare', [FIRST_STAGE]] } };
    default:
      return null;
  }
}

// ---------- 教學戰鬥 ----------

/** 固定開場盤面：把 (2,3) 的焰珠往左拖一格，焰珠橫排＋潮珠直排，一次 2 Combo。森珠留給主動技轉換 */
export const TUTORIAL_BOARD = [
  'ghlwgd',
  'dgwwlh',
  'ffwfgd',
  'ldhgfg',
  'gwlhdf',
];

/** 引導的路徑（第一個是要按住的珠） */
export const TUTORIAL_PATH: Pos[] = [
  { row: 2, col: 3 },
  { row: 2, col: 2 },
];

export const TUTORIAL_COMBO = 2;

/** 照著轉珠後第一輪會消除幾組（不算天降） */
export function comboOfPath(board: Board, path: Pos[]): number {
  if (path.length < 2 || path.some((p, i) => i > 0 && !isAdjacent(path[i - 1], p))) return 0;
  return findMatches(applyPath(board, path).board).length;
}

export function tutorialBoard(): Board {
  return boardFromStrings(TUTORIAL_BOARD);
}

/**
 * 讓 createBoard 產生固定盤面的亂數：每格先抽種類（六種平均分布時，取該種類區間的中點），
 * 再抽一次強化機率（0.999，不強化）。盤面排完後交給 fallback 處理天降與敵人行動。
 * 測試會檢查戰鬥開場盤面確實等於 TUTORIAL_BOARD。
 */
export function scriptedBoardRng(board: Board, orbTypes: readonly string[], fallback: Rng): Rng {
  const script = board.cells.flatMap((o) => [(orbTypes.indexOf(o.type) + 0.5) / orbTypes.length, 0.999]);
  let i = 0;
  const next = () => (i < script.length ? script[i++] : fallback.next());
  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}
