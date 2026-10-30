// 召喚：常駐／限定卡池、單抽、十連（保底最低稀有度）、N 抽保底、限定角色機率提升、抽卡紀錄
import type { CardDef, GachaPoolDef, Rarity, SaveData } from '../core/types';
import type { Rng } from '../core/rng';
import { fail } from './result';
import { addCards } from './rewards';

/** 抽卡紀錄最多保留筆數（超過時丟掉最舊的） */
export const GACHA_HISTORY_LIMIT = 1000;

export interface PullResult {
  cardId: string;
  rarity: Rarity;
  uid: string;
  /** 這一抽是由 N 抽保底觸發 */
  pity?: boolean;
  /** 這一抽是由十連保底觸發 */
  guarantee?: boolean;
  /** 第一次擁有這張卡 */
  isNew: boolean;
}

export type GachaFail = 'poolClosed' | 'notEnoughGems' | 'inventoryFull' | 'emptyPool';

export function isPoolOpen(pool: GachaPoolDef, now: number): boolean {
  if (!pool.period) return true;
  return now >= Date.parse(pool.period.start) && now < Date.parse(pool.period.end);
}

export function pullCost(pool: GachaPoolDef, count: 1 | 10): number {
  if (count === 1) return pool.cost.gems;
  return pool.tenPullCost?.gems ?? pool.cost.gems * 10;
}

/** 距離 N 抽保底還剩幾抽（第幾抽必出），給介面顯示 */
export function pullsUntilPity(save: SaveData, pool: GachaPoolDef): number {
  return Math.max(1, pool.pity.after + 1 - (save.gacha.pityCounter[pool.id] ?? 0));
}

/** 只保留有卡片的稀有度，並把機率重新正規化 */
function effectiveRates(pool: GachaPoolDef, minRarity: Rarity = 1): [Rarity, number][] {
  const entries = (Object.entries(pool.rates) as [string, number][])
    .map(([r, p]) => [Number(r) as Rarity, p] as [Rarity, number])
    .filter(([r, p]) => r >= minRarity && p > 0 && (pool.cards[r]?.length ?? 0) > 0)
    .sort((a, b) => b[0] - a[0]);
  const total = entries.reduce((a, [, p]) => a + p, 0);
  return entries.map(([r, p]) => [r, p / total]);
}

function rollRarity(rates: [Rarity, number][], rng: Rng): Rarity {
  let x = rng.next();
  for (const [r, p] of rates) {
    if (x < p) return r;
    x -= p;
  }
  return rates[rates.length - 1][0];
}

/** 在某稀有度內選卡：限定角色依 share 佔走該稀有度的機率，其餘平均分配 */
function pickCard(pool: GachaPoolDef, rarity: Rarity, rng: Rng): string {
  const list = pool.cards[rarity] ?? [];
  const ups = (pool.rateUp ?? []).filter((u) => list.includes(u.card));
  let x = rng.next();
  for (const u of ups) {
    if (x < u.share) return u.card;
    x -= u.share;
  }
  const rest = list.filter((id) => !ups.some((u) => u.card === id));
  return rng.pick(rest.length > 0 ? rest : list);
}

/** 卡池公開機率：每個稀有度與每張卡的實際機率（未計入保底） */
export function displayRates(pool: GachaPoolDef): { rarity: Rarity; rate: number; cards: { card: string; rate: number }[] }[] {
  return effectiveRates(pool).map(([rarity, rate]) => {
    const list = pool.cards[rarity] ?? [];
    const ups = (pool.rateUp ?? []).filter((u) => list.includes(u.card));
    const upShare = ups.reduce((a, u) => a + u.share, 0);
    const rest = list.filter((id) => !ups.some((u) => u.card === id));
    const cards = [
      ...ups.map((u) => ({ card: u.card, rate: rate * u.share })),
      ...rest.map((card) => ({ card, rate: (rate * Math.max(0, 1 - upShare)) / rest.length })),
    ];
    return { rarity, rate, cards };
  });
}

/** 卡池資料的額外檢查（validate.ts 之外的召喚規則） */
export function checkGachaPool(pool: GachaPoolDef): string[] {
  const errors: string[] = [];
  const w = `gacha-pools/${pool.id}`;
  if (effectiveRates(pool).length === 0) errors.push(`${w}: 沒有任何可抽的卡`);
  if ((pool.cards[pool.pity.rarity]?.length ?? 0) === 0) errors.push(`${w}: 保底稀有度 ${pool.pity.rarity}★ 沒有卡`);
  if (effectiveRates(pool, pool.tenPullGuarantee.minRarity).length === 0) {
    errors.push(`${w}: 十連保底 ${pool.tenPullGuarantee.minRarity}★ 以上沒有卡`);
  }
  const all = Object.values(pool.cards).flat();
  const shareByRarity = new Map<string, number>();
  for (const u of pool.rateUp ?? []) {
    if (!all.includes(u.card)) errors.push(`${w}: 機率提升的 ${u.card} 不在卡池內`);
    if (u.share <= 0 || u.share > 1) errors.push(`${w}: 機率提升 ${u.card} 的 share 需介於 0–1`);
    const r = Object.entries(pool.cards).find(([, list]) => list?.includes(u.card))?.[0];
    if (r) shareByRarity.set(r, (shareByRarity.get(r) ?? 0) + u.share);
  }
  for (const [r, total] of shareByRarity) if (total > 1 + 1e-9) errors.push(`${w}: ${r}★ 機率提升合計超過 1`);
  if (pool.period && !(Date.parse(pool.period.start) < Date.parse(pool.period.end))) errors.push(`${w}: 開放期間不正確`);
  return errors;
}

/**
 * 新手第一抽的候選：卡池裡隊伍還沒有、而且和隊長同屬性或同流派的卡。
 * owned 傳玩家已擁有的卡號（入門隊）；沒有候選時回傳空陣列。
 */
export function firstPullCandidates(pool: GachaPoolDef, cards: CardDef[], owned: string[], leader: CardDef): string[] {
  const have = new Set(owned);
  const styles = new Set(leader.archetypes.map((a) => a.id));
  const byId = new Map(cards.map((c) => [c.id, c]));
  return Object.values(pool.cards).flat().filter((id): id is string => {
    const c = id ? byId.get(id) : undefined;
    return !!c && !have.has(c.id) && (c.attribute === leader.attribute || c.archetypes.some((a) => styles.has(a.id)));
  });
}

/** 只留下候選卡的卡池；候選卡都不在可抽的稀有度時回傳 null */
function narrowPool(pool: GachaPoolDef, only: string[]): GachaPoolDef | null {
  const keep = new Set(only);
  const cards = Object.fromEntries(Object.entries(pool.cards).map(([r, list]) => [r, (list ?? []).filter((id) => keep.has(id))])) as GachaPoolDef['cards'];
  const narrowed = { ...pool, cards };
  return effectiveRates(narrowed).length > 0 ? narrowed : null;
}

export interface PullOptions {
  /** 第一抽只從這些卡裡選（新手教學）；稀有度照卡池機率，在有候選卡的稀有度之間重新分配 */
  firstFrom?: string[];
}

export function pullGacha(
  save: SaveData,
  pool: GachaPoolDef,
  count: 1 | 10,
  rng: Rng,
  now: number,
  opts: PullOptions = {},
): { ok: true; save: SaveData; results: PullResult[] } | { ok: false; reason: GachaFail } {
  if (!isPoolOpen(pool, now)) return fail('poolClosed');
  if (effectiveRates(pool).length === 0) return fail('emptyPool');
  const cost = pullCost(pool, count);
  if (save.player.gems < cost) return fail('notEnoughGems');
  if (save.inventory.cards.length + count > save.inventory.capacity) return fail('inventoryFull');

  const rates = effectiveRates(pool);
  const guaranteeRates = effectiveRates(pool, pool.tenPullGuarantee.minRarity);
  const narrowed = opts.firstFrom?.length ? narrowPool(pool, opts.firstFrom) : null;
  const owned = new Set(save.collection.owned);
  let counter = save.gacha.pityCounter[pool.id] ?? 0;
  let gotGuaranteed = false;
  const results: Omit<PullResult, 'uid'>[] = [];

  for (let i = 0; i < count; i++) {
    let rarity: Rarity;
    let pity = false;
    let guarantee = false;
    if (counter >= pool.pity.after) {
      rarity = pool.pity.rarity;
      pity = true;
    } else if (count === 10 && i === 9 && !gotGuaranteed && guaranteeRates.length > 0) {
      rarity = rollRarity(guaranteeRates, rng);
      guarantee = true;
    } else {
      rarity = rollRarity(i === 0 && narrowed ? effectiveRates(narrowed) : rates, rng);
    }
    if (rarity >= pool.tenPullGuarantee.minRarity) gotGuaranteed = true;
    counter = rarity >= pool.pity.rarity ? 0 : counter + 1;

    // 保底抽到的稀有度沒有候選卡時，照原卡池抽
    const from = i === 0 && narrowed?.cards[rarity]?.length ? narrowed : pool;
    const cardId = pickCard(from, rarity, rng);
    const isNew = !owned.has(cardId);
    owned.add(cardId);
    results.push({
      cardId, rarity, isNew,
      ...(pity ? { pity } : {}), ...(guarantee ? { guarantee } : {}),
    });
  }

  const added = addCards(save, results.map((r) => ({ cardId: r.cardId })), now);
  const history = [...save.gacha.history, ...results.map((r) => ({ pool: pool.id, card: r.cardId, at: now }))];

  return {
    ok: true,
    results: results.map((r, i) => ({ ...r, uid: added.added[i].uid })),
    save: {
      ...added.save,
      player: { ...save.player, gems: save.player.gems - cost },
      gacha: {
        pityCounter: { ...save.gacha.pityCounter, [pool.id]: counter },
        history: history.slice(-GACHA_HISTORY_LIMIT),
      },
    },
  };
}
