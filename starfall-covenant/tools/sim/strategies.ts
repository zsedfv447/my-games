// 每個流派一種自動轉珠策略：策略決定「這一盤想轉成什麼樣子」。
// 規劃器（planner.ts）會先估算每條路徑的實際傷害與回復，再加上策略的偏好分數，
// 偏好讓 AI 在傷害相同或還沒達成隊長技條件時，往該流派的目標轉。
import type { ArchetypeId, Attribute, OrbType } from '../../src/core/types';
import type { MatchGroup } from '../../src/battle/board';

export interface ShapeContext {
  groups: MatchGroup[];
  combo: number;
  /** 本隊主屬性（隊長屬性） */
  mainAttribute: Attribute;
  /** 隊伍裡出現的屬性 */
  teamAttributes: Attribute[];
  hpPercent: number;
}

export interface Strategy {
  id: ArchetypeId;
  name: string;
  /** 給人看的策略說明 */
  aim: string;
  /** 回復的價值倍率（1 = 照補血量算） */
  healWeight: (hpPercent: number) => number;
  /** 流派偏好分數（約 0–20，和傷害分數 0–100 相加） */
  shape: (ctx: ShapeContext) => number;
}

const ATTRS: Attribute[] = ['fire', 'water', 'wood', 'light', 'dark'];
const countOrbs = (groups: MatchGroup[], orb: OrbType) =>
  groups.filter((g) => g.orb === orb).reduce((a, g) => a + g.cells.length, 0);
const distinctAttrs = (groups: MatchGroup[]) => new Set(groups.map((g) => g.orb).filter((o) => o !== 'heart')).size;
const maxGroup = (groups: MatchGroup[], orb?: OrbType) =>
  Math.max(0, ...groups.filter((g) => !orb || g.orb === orb).map((g) => g.cells.length));
const normalHeal = (hp: number) => (hp < 40 ? 1.5 : hp < 70 ? 0.8 : 0.2);

export const STRATEGIES: Record<ArchetypeId, Strategy> = {
  mono: {
    id: 'mono', name: '單屬爆發', aim: '盡量多消主屬性珠，湊出全體攻擊',
    healWeight: normalHeal,
    shape: (c) => countOrbs(c.groups, c.mainAttribute) * 0.8 + (maxGroup(c.groups, c.mainAttribute) >= 5 ? 4 : 0),
  },
  rainbow: {
    id: 'rainbow', name: '七彩齊攻', aim: '同一回合消出越多種屬性越好',
    healWeight: normalHeal,
    shape: (c) => distinctAttrs(c.groups) * 4,
  },
  combo: {
    id: 'combo', name: '連擊狂潮', aim: '每組只消 3 顆，盡量多 Combo',
    healWeight: normalHeal,
    shape: (c) => c.combo * 3,
  },
  chain: {
    id: 'chain', name: '長串貫穿', aim: '把主屬性珠排成一長串一次消掉',
    healWeight: normalHeal,
    shape: (c) => maxGroup(c.groups, c.mainAttribute) * 2,
  },
  heart: {
    id: 'heart', name: '心之守護', aim: '每回合都消心珠，回復轉成攻擊',
    healWeight: () => 1,
    shape: (c) => c.groups.filter((g) => g.orb === 'heart').length * 5 + c.combo,
  },
  race: {
    id: 'race', name: '種族羈絆', aim: '隊伍有的屬性都要消到，再加 Combo',
    healWeight: normalHeal,
    shape: (c) => c.teamAttributes.filter((a) => c.groups.some((g) => g.orb === a)).length * 2 + c.combo,
  },
  enhance: {
    id: 'enhance', name: '強化珠增幅', aim: '優先消強化珠，其次多 Combo',
    healWeight: normalHeal,
    shape: (c) => c.groups.reduce((a, g) => a + g.enhancedCount, 0) * 3 + c.combo,
  },
  control: {
    id: 'control', name: '時之控場', aim: '穩定輸出、保持血量，慢慢磨',
    healWeight: (hp) => (hp < 70 ? 1.5 : 0.5),
    shape: (c) => c.combo * 2,
  },
  berserk: {
    id: 'berserk', name: '背水一戰', aim: '不補血，維持低血量吃隊長技倍率；快死才補',
    healWeight: (hp) => (hp < 15 ? 2 : -0.5),
    shape: (c) => countOrbs(c.groups, c.mainAttribute) * 0.5 + c.combo,
  },
  dual: {
    id: 'dual', name: '雙屬共鳴', aim: '主屬性和第二屬性同時消',
    healWeight: normalHeal,
    shape: (c) => {
      const second = c.teamAttributes.find((a) => a !== c.mainAttribute);
      const both = c.groups.some((g) => g.orb === c.mainAttribute) && !!second && c.groups.some((g) => g.orb === second);
      return (both ? 10 : 0) + c.combo;
    },
  },
  skillcycle: {
    id: 'skillcycle', name: '技能循環', aim: '技能好了就放，轉珠以 Combo 為主',
    healWeight: normalHeal,
    shape: (c) => c.combo * 2,
  },
  fixed: {
    id: 'fixed', name: '固定傷害', aim: '湊心珠組數觸發固定追打',
    healWeight: () => 0.5,
    shape: (c) => c.groups.filter((g) => g.orb === 'heart').length * 6 + c.combo,
  },
};

export { ATTRS };
