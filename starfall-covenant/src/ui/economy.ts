// 商店、登入、任務、成就畫面共用的純資料整理（不碰 DOM，方便測試）
import type { QuestDef, Reward, SaveData, ShopItemDef } from '../core/types';
import type { ResourceIcon } from './art/icons';
import { ATTRIBUTE_NAMES, RACE_NAMES } from './art/palette';
import { gameData } from '../data/load';
import loginRewardsJson from '../../data/login-rewards.json';
import { canClaimLogin, type LoginRewardDef } from '../progression/login';
import { claimableQuests, derivedCounters, type DerivedCounters } from '../progression/quests';
import { claimableChapterRewards } from '../progression/stages';
import { claimableCollection, createGrowthContext, type GrowthContext } from '../growth';
import type { ShopFail } from '../progression/shop';

export const loginRewards = loginRewardsJson as LoginRewardDef[];

/** 活動代幣的顯示名稱 */
const TOKEN_NAMES = new Map(gameData.events.flatMap((e) => (e.token && e.tokenName ? [[e.token, e.tokenName] as const] : [])));
/** 代幣名稱來自 data/events.json 的 tokenName */
export const tokenName = (id: string) => TOKEN_NAMES.get(id) ?? id;

const stageKind = new Map(gameData.stages.map((s) => [s.id, s.kind]));
const evolvedForms = new Set(gameData.cards.flatMap((c) => (c.evolution ? [c.evolution.to] : [])));
const nemesisEvents = new Set(gameData.events.filter((e) => e.series === 'nemesis').map((e) => e.id));
const derivedData = {
  evolvedForms,
  nemesisStages: new Set(gameData.stages.filter((s) => s.event && nemesisEvents.has(s.event)).map((s) => s.id)),
  cardTotal: gameData.cards.length,
};
export const questDerived = (save: SaveData): DerivedCounters => derivedCounters(save, (id) => stageKind.get(id), derivedData);

// ---------- 獎勵 ----------
export interface RewardPart {
  icon: ResourceIcon | 'card';
  /** 卡片時為卡號 */
  card?: string;
  label: string;
}

const cardName = (id: string) => gameData.cards.find((c) => c.id === id)?.name ?? id;

export function rewardParts(r: Reward): RewardPart[] {
  const out: RewardPart[] = [];
  if (r.gems) out.push({ icon: 'gem', label: `星晶 ×${r.gems}` });
  if (r.coin) out.push({ icon: 'coin', label: `金幣 ×${r.coin.toLocaleString()}` });
  if (r.stamina) out.push({ icon: 'stamina', label: `體力 ×${r.stamina}` });
  for (const [t, n] of Object.entries(r.tokens ?? {})) out.push({ icon: 'token', label: `${tokenName(t)} ×${n}` });
  for (const c of r.cards ?? []) out.push({ icon: 'card', card: c.card, label: `${cardName(c.card)}${c.count > 1 ? ` ×${c.count}` : ''}` });
  return out;
}

// ---------- 商店 ----------
export type ShopTab = 'gems' | 'coin' | 'event';

export function shopTab(item: ShopItemDef): ShopTab {
  if (item.price.tokens && Object.keys(item.price.tokens).length) return 'event';
  return item.price.gems ? 'gems' : 'coin';
}

/** 價格（只取第一種貨幣；資料裡每件商品只標一種價格） */
export function shopPrice(item: ShopItemDef): { icon: ResourceIcon; amount: number; token?: string } {
  const { gems, coin, tokens } = item.price;
  if (gems) return { icon: 'gem', amount: gems };
  if (coin) return { icon: 'coin', amount: coin };
  const [token, amount] = Object.entries(tokens ?? {})[0] ?? ['', 0];
  return { icon: 'token', amount, token };
}

const PER_TEXT = { day: '每日', week: '每週', forever: '限購', event: '活動限購' } as const;

export function limitText(item: ShopItemDef, remaining: number): string {
  if (!item.limit) return '不限次數';
  return `${PER_TEXT[item.limit.per]} ${remaining}/${item.limit.count}`;
}

export function shopItemDetail(item: ShopItemDef): string {
  const r = item.reward;
  if ('type' in r) return r.type === 'refillStamina' ? '立即把體力補滿' : `卡片背包上限 +${r.amount}`;
  const only = r.cards?.length === 1 && !r.coin && !r.gems && !r.stamina && !r.tokens ? gameData.cards.find((c) => c.id === r.cards![0].card) : undefined;
  if (only) return `${only.rarity}★ ${ATTRIBUTE_NAMES[only.attribute]}屬性・${RACE_NAMES[only.race]}`;
  return rewardParts(r).map((p) => p.label).join('、');
}

export const SHOP_FAIL_TEXT: Record<ShopFail, string> = {
  soldOut: '已達購買上限',
  notEnoughGems: '星晶不足',
  notEnoughCoin: '金幣不足',
  notEnoughTokens: '代幣不足',
  alreadyFull: '體力已經是滿的',
};

// ---------- 7 日登入 ----------
export type LoginDayState = 'claimed' | 'today' | 'claimedToday' | 'upcoming';

/** 7 格的狀態：今天可領的那格是 today，今天已領的那格是 claimedToday */
export function loginCalendar(save: SaveData, now: number, rewards = loginRewards): { day: number; reward: Reward; state: LoginDayState }[] {
  const cycle = rewards.length;
  const claimable = canClaimLogin(save, now);
  // 本輪已領到第幾天；領完第 7 天後的下一天開始新的一輪
  const last = save.daily.loginDay % cycle === 0 && claimable ? 0 : save.daily.loginDay;
  const current = claimable ? last + 1 : last;
  return rewards.map((r) => ({
    day: r.day,
    reward: r.reward,
    state: r.day < current ? 'claimed' : r.day === current ? (claimable ? 'today' : 'claimedToday') : 'upcoming',
  }));
}

// ---------- 紅點 ----------
export interface HomeBadges {
  login: boolean;
  quests: boolean;
  achievements: boolean;
  /** 有章節星章集滿、還沒領獎 */
  chapters: boolean;
  /** 圖鑑有已擁有、還沒領的收集獎勵 */
  collection: boolean;
}

let growthCtx: GrowthContext | undefined;

export function homeBadges(save: SaveData, now: number, quests: QuestDef[] = gameData.quests): HomeBadges {
  const ready = claimableQuests(save, quests, now, questDerived(save));
  growthCtx ??= createGrowthContext(gameData);
  return {
    login: canClaimLogin(save, now),
    quests: ready.some((q) => q.kind !== 'achievement'),
    achievements: ready.some((q) => q.kind === 'achievement'),
    chapters: claimableChapterRewards(save, gameData.chapters, gameData.stages).length > 0,
    collection: claimableCollection(save, growthCtx).length > 0,
  };
}

/** 任務列表排序：可領 → 進行中 → 已領 */
export function sortQuests<T extends { done: boolean; claimed: boolean }>(rows: T[]): T[] {
  const rank = (r: T) => (r.claimed ? 2 : r.done ? 0 : 1);
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map(({ r }) => r);
}
