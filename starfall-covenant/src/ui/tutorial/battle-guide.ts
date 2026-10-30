// 教學戰鬥的引導：開場說明 → 照路徑轉出 2 Combo → 說明 Combo、屬性剋制、隊長技 → 施放主動技 → 自由轉珠打倒敵人。
// 只在戰鬥畫面外面疊一層引導，不改盤面拖曳本身；不照路徑轉珠時，由戰鬥畫面在送出前詢問 checkMove 擋下。
import type { Board, Pos } from '../../battle/board';
import type { BattleState } from '../../battle/battle-state';
import { ATTRIBUTE_NAMES } from '../art/palette';
import { confirmDialog } from '../components/overlay';
import { GuideLayer } from './guide-ui';
import { TUTORIAL_COMBO, TUTORIAL_PATH, comboOfPath } from './flow';

/** 戰鬥畫面提供給引導的元素與操作 */
export interface BattleGuideHost {
  root: HTMLElement;
  board: HTMLElement;
  teamRow: HTMLElement;
  enemyZone: HTMLElement;
  setBoardEnabled(on: boolean): void;
  getState(): BattleState;
}

export interface BattleGuide {
  attach(host: BattleGuideHost): void;
  /** 轉珠放手、送出前；回傳文字代表擋下這一步 */
  checkMove(path: Pos[], board: Board): string | null;
  /** 點隊員頭像時；回傳文字代表現在還不能施放 */
  checkSkill(member: number): string | null;
  afterTurn(state: BattleState): void;
  afterSkill(state: BattleState): void;
  /** 打贏、結算畫面出現前：收起對話框 */
  hide(): void;
  /** 結算畫面關閉後 */
  onWin(): void;
  destroy(): void;
}

export type BattleGuidePhase = 'intro' | 'drag' | 'explain' | 'skill' | 'free' | 'won';

export interface BattleGuideTexts {
  leaderName: string;
  leaderSkillName: string;
  leaderSkillText: string;
  skillName: string;
  skillText: string;
  enemyName: string;
  enemyAttribute: string;
}

export function texts(state: BattleState, data: { skills: { id: string; name: string; description: string }[]; leaderSkills: { id: string; name: string; description: string }[] }): BattleGuideTexts {
  const leader = state.team[0].card;
  const ls = data.leaderSkills.find((s) => s.id === leader.leaderSkill);
  const skill = data.skills.find((s) => s.id === leader.activeSkill);
  const enemy = state.enemies[0].def;
  return {
    leaderName: leader.name.split('・').pop() ?? leader.name,
    leaderSkillName: ls?.name ?? '',
    leaderSkillText: ls?.description ?? '',
    skillName: skill?.name ?? '',
    skillText: skill?.description ?? '',
    enemyName: enemy.name,
    enemyAttribute: ATTRIBUTE_NAMES[enemy.attribute],
  };
}

export class TutorialBattleGuide implements BattleGuide {
  phase: BattleGuidePhase = 'intro';
  private layer?: GuideLayer;
  private host?: BattleGuideHost;

  constructor(
    private t: BattleGuideTexts,
    private callbacks: { onFinish: () => void; onSkip: () => void },
  ) {}

  attach(host: BattleGuideHost): void {
    this.host = host;
    this.layer = new GuideLayer(host.root);
    this.intro();
  }

  private skip = async (): Promise<void> => {
    if (await confirmDialog('略過教學', '之後可以在「設定」重看新手教學。確定要略過嗎？', '略過')) this.callbacks.onSkip();
  };

  private say(lines: string[], actions: { label: string; onClick: () => void }[] = [], onLine?: (i: number) => void): void {
    this.layer?.say({ lines, placement: 'top', actions, onSkip: () => void this.skip(), onLine });
  }

  private intro(): void {
    this.phase = 'intro';
    this.host?.setBoardEnabled(false);
    this.say([
      '這裡是轉珠戰鬥。下方的紋珠盤面，就是契印師的武器。',
      '橫排或直排連成 3 顆以上同色的珠就會消除，同屬性的隊員會跟著發動攻擊。',
    ], [{ label: '試試看', onClick: () => this.drag() }]);
  }

  private drag(): void {
    this.phase = 'drag';
    this.host?.setBoardEnabled(true);
    this.say(['按住發光的焰珠，沿著手指往左拖一格再放開。拖曳經過的珠會跟著換位，這樣能一次湊出兩組！']);
    const host = this.host;
    this.layer?.trace(() => host?.board.querySelector('canvas') ?? null, host?.getState().board.cols ?? 6, host?.getState().board.rows ?? 5, TUTORIAL_PATH);
  }

  checkMove(path: Pos[], board: Board): string | null {
    if (this.phase === 'drag') {
      if (comboOfPath(board, path) < TUTORIAL_COMBO) return '照著手指的路線，把焰珠往左拖一格試試';
      this.layer?.clearPointers();
      this.layer?.clear();
      return null;
    }
    if (this.phase === 'skill') return `先點${this.t.leaderName}的頭像施放主動技`;
    if (this.phase === 'free' || this.phase === 'won') return null;
    return '先看完說明再轉珠';
  }

  checkSkill(member: number): string | null {
    if (this.phase === 'free') return null;
    if (this.phase === 'skill') return member === 0 ? null : `這次先用隊長${this.t.leaderName}的主動技`;
    return '等一下會教你主動技';
  }

  afterTurn(state: BattleState): void {
    if (this.phase !== 'drag') return;
    this.phase = 'explain';
    this.host?.setBoardEnabled(false);
    const host = this.host;
    this.say([
      `漂亮！一次消除了 ${state.maxCombo} 組，這就是 Combo。Combo 越多，全隊的傷害越高。`,
      `屬性也很重要：焰剋森、森剋潮、潮剋焰，輝與蝕互剋。剋制時傷害 1.5 倍，被剋只剩一半。${this.t.enemyName}是${this.t.enemyAttribute}屬性，正好被焰屬性剋制。`,
      `隊伍最左邊是隊長。${this.t.leaderName}的隊長技「${this.t.leaderSkillName}」：${this.t.leaderSkillText}整場戰鬥都有效。`,
    ], [{ label: '下一步', onClick: () => this.skillStep() }], (line) => {
      // 第 2 句指敵人（屬性），第 3 句指隊長
      this.layer?.clearPointers();
      if (line === 1) this.layer?.pointAt(() => host?.enemyZone.querySelector('.enemy'));
      if (line === 2) this.layer?.pointAt(() => host?.teamRow.firstElementChild);
    });
  }

  private skillStep(): void {
    this.phase = 'skill';
    this.layer?.clearPointers();
    this.say([`隊員的主動技冷卻完成時，頭像會發光。點${this.t.leaderName}的頭像，施放「${this.t.skillName}」：${this.t.skillText}`]);
    const host = this.host;
    this.layer?.pointAt(() => host?.teamRow.firstElementChild);
  }

  afterSkill(): void {
    if (this.phase !== 'skill') return;
    this.phase = 'free';
    this.layer?.clearPointers();
    this.say(['盤面上多了好多焰珠！現在可以自由轉珠了，把敵人打倒吧。']);
  }

  hide(): void {
    this.phase = 'won';
    this.layer?.clear();
  }

  onWin(): void {
    this.phase = 'won';
    this.layer?.clearPointers();
    this.layer?.say({
      lines: ['做得好！這就是戰鬥的基本。', '接下來去看看你的隊伍是怎麼組成的吧。'],
      placement: 'top',
      actions: [{ label: '前往編隊', onClick: () => this.callbacks.onFinish() }],
    });
  }

  destroy(): void {
    this.layer?.destroy();
  }
}
