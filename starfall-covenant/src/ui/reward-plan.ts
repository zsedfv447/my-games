// 獎勵演出的純資料：要跳出哪些項目、順序、數字滾動與時間表（不碰 DOM，方便測試）
import type { GameConfig, Reward } from '../core/types';
import type { ResourceIcon } from './art/icons';
import type { SfxName } from './audio';
import { rewardParts, tokenName } from './economy';
import { maxStamina, teamCostLimit, type LevelUpInfo } from '../progression/player';
import type { StageClearResult } from '../progression/stages';

export type RevealItem =
  /** 回合數、最高 Combo 這類戰績，不滾動 */
  | { kind: 'stat'; label: string; value: string }
  /** 金幣、經驗、星晶等數量，從 0 滾到 amount */
  | { kind: 'count'; icon: ResourceIcon | 'exp'; label: string; amount: number; tag?: string; special?: boolean }
  | { kind: 'card'; cardId: string; count: number }
  | { kind: 'star'; text: string; got: boolean; isNew: boolean }
  /** 隊員經驗：每位隊員各得 amount，列出升級的隊員 */
  | { kind: 'team'; amount: number; members: TeamExpMember[] };

export interface TeamExpMember {
  cardId: string;
  from: number;
  to: number;
}

/** 結算額外要顯示的內容（由發放的模組算好傳進來，這裡只負責顯示） */
export interface ClearExtras {
  /** 出戰隊員的經驗結果（growth 的 grantBattleExp） */
  team?: TeamExpMember[];
  /** 同時領到的章節星章獎勵 */
  chapterReward?: Reward;
}

/** 一份 Reward 拆成演出項目（登入、任務、星章等領獎共用）。星晶放最後壓軸 */
export function rewardItems(reward: Reward, tag?: string): RevealItem[] {
  const out: RevealItem[] = [];
  if (reward.coin) out.push({ kind: 'count', icon: 'coin', label: '金幣', amount: reward.coin, tag });
  if (reward.stamina) out.push({ kind: 'count', icon: 'stamina', label: '體力', amount: reward.stamina, tag });
  for (const [t, n] of Object.entries(reward.tokens ?? {})) out.push({ kind: 'count', icon: 'token', label: tokenName(t), amount: n, tag });
  for (const c of reward.cards ?? []) out.push({ kind: 'card', cardId: c.card, count: c.count });
  if (reward.gems) out.push({ kind: 'count', icon: 'gem', label: '星晶', amount: reward.gems, tag, special: true });
  return out;
}

/** 關卡結算的演出順序：戰績 → 金幣 → 經驗 → 隊員經驗 → 首通獎勵（星晶壓軸）→ 章節獎勵 → 掉落卡 → 星章 */
export function clearItems(
  battle: { turns: number; maxCombo: number },
  clear: StageClearResult | null,
  starTexts: string[] = [],
  extras: ClearExtras = {},
): RevealItem[] {
  const out: RevealItem[] = [
    { kind: 'stat', label: '回合數', value: `${battle.turns}` },
    { kind: 'stat', label: '最高 Combo', value: `${battle.maxCombo}` },
  ];
  if (!clear) return out;
  if (clear.coin) out.push({ kind: 'count', icon: 'coin', label: '金幣', amount: clear.coin });
  if (clear.playerExp) out.push({ kind: 'count', icon: 'exp', label: '玩家經驗', amount: clear.playerExp });
  // 隊員經驗只在真的有發給隊員時顯示（借用隊伍、全員滿級時不顯示）
  if (clear.cardExp && extras.team?.length) out.push({ kind: 'team', amount: clear.cardExp, members: extras.team });
  if (clear.tokens) out.push(...rewardItems({ tokens: clear.tokens }));
  if (clear.firstClear) out.push(...rewardItems(clear.firstClear, '首通'));
  if (clear.periodFirstClear) out.push(...rewardItems(clear.periodFirstClear, '本週首通'));
  if (extras.chapterReward) out.push(...rewardItems(extras.chapterReward, '章節'));
  // 同一張卡掉兩次也分開翻，每張都是一次驚喜
  for (const d of clear.drops) out.push({ kind: 'card', cardId: d.cardId, count: 1 });
  starTexts.forEach((text, i) => out.push({ kind: 'star', text, got: !!clear.stars[i], isNew: !!clear.newStars[i] }));
  return out;
}

/** 數字滾動：t 為 0..1 的進度，先快後慢（ease-out），整數、單調遞增，t≥1 時正好等於目標 */
export function countValue(target: number, t: number): number {
  if (t >= 1) return target;
  if (t <= 0) return 0;
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.min(target, Math.floor(target * eased));
}

/** 滾動時間：數字越大滾越久，但控制在 0.3～0.9 秒 */
export function countDuration(amount: number): number {
  if (amount <= 1) return 0;
  return Math.round(Math.min(900, 300 + 120 * Math.log10(amount)));
}

/** 一個項目從出現到可以接下一個需要的毫秒數 */
export function itemDuration(item: RevealItem): number {
  switch (item.kind) {
    case 'stat': return 220;
    case 'count': return (item.special ? 520 : 260) + countDuration(item.amount);
    case 'card': return 480;
    case 'star': return item.got ? 360 : 200;
    case 'team': return 360 + countDuration(item.amount) + (item.members.some((m) => m.to > m.from) ? 300 : 0);
  }
}

/** 每個項目的開始時間（毫秒）與全部播完的時間；speed 為戰鬥速度倍率 */
export function revealSchedule(items: RevealItem[], speed = 1): { starts: number[]; total: number } {
  const k = 1 / Math.max(0.25, speed);
  let t = 0;
  const starts = items.map((item) => {
    const at = t;
    t += Math.round(itemDuration(item) * k);
    return at;
  });
  return { starts, total: t };
}

/** 項目出現時的音效 */
export function revealSfx(item: RevealItem): SfxName | null {
  switch (item.kind) {
    case 'stat': return 'tap';
    case 'count': return item.special ? 'gem' : 'reward';
    case 'card': return 'reward';
    case 'star': return item.got ? 'star' : null;
    case 'team': return 'reward';
  }
}

/** 計數音的間隔：一次滾動最多響 8 下，避免一直嗶 */
export function tickInterval(durationMs: number): number {
  return Math.max(60, Math.ceil(durationMs / 8));
}

export interface LevelUpView {
  from: number;
  to: number;
  gems: number;
  stamina: [number, number];
  cost: [number, number];
}

/** 升級卡要顯示的前後數值 */
export function levelUpView(info: LevelUpInfo, config: GameConfig): LevelUpView {
  return {
    from: info.from,
    to: info.to,
    gems: info.gems,
    stamina: [maxStamina(info.from, config), maxStamina(info.to, config)],
    cost: [teamCostLimit(info.from), teamCostLimit(info.to)],
  };
}

/**
 * 關卡列表的首通預告：text 是 chip 上的精簡版（圖示＋「首通 +1」，還有其他獎勵就加「…」），
 * full 是完整內容（「首通：星晶 +1、獸王代幣 +20」），放在 title。沒有首通獎勵回傳 null。
 */
export function firstClearPreview(reward: Reward | undefined, cleared: boolean, label = '首通'): { text: string; full: string; claimed: boolean; icon: ResourceIcon | 'card' } | null {
  if (!reward) return null;
  const items = rewardItems(reward);
  if (!items.length) return null;
  const top = items.at(-1)!;
  const amount = top.kind === 'count' ? ` +${top.amount.toLocaleString()}` : '';
  const more = items.length > 1 ? ' …' : '';
  // 完整清單：每一項實際的獎勵，數量寫成「+N」
  const list = rewardParts(reward).map((p) => p.label.replace(' ×', ' +')).join('、');
  return {
    text: cleared ? `${label} 已領` : `${label}${amount}${more}`,
    full: `${label}：${list}`,
    claimed: cleared,
    icon: top.kind === 'count' ? (top.icon === 'exp' ? 'gem' : top.icon) : 'card',
  };
}
