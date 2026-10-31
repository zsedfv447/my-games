// 養成之路（接在新手契約之後的一次性引導）：挑一張玩家已擁有、有進化路線的低星卡，
// 依序走過強化 → 升到滿級 → 收集進化素材 → 進化。全部由存檔推算（老玩家讀檔就能直接領），不另存資料。
import type { CardDef, OwnedCard, SaveData, StageDef } from '../core/types';

/** 「低星」：有進化路線、稀有度 4★ 以下 */
const MAX_RARITY = 4;

export interface NurtureLine {
  base: CardDef;
  to: CardDef;
  /** 目前最高等級的那一張（沒有時為 undefined） */
  owned?: OwnedCard;
  /** 每種進化素材：需要幾張、背包裡有幾張（不含要進化的那張本身） */
  materials: { card: string; need: number; have: number }[];
  coin: number;
  /** 玩家還沒擁有這條路線時，哪一關可以拿到（首通優先） */
  source?: string;
}

export interface NurtureSteps {
  enhanced: boolean;
  maxLevel: boolean;
  materials: boolean;
  evolved: boolean;
}

const candidates = (cards: CardDef[]) => cards.filter((c) => c.evolution && c.rarity <= MAX_RARITY && c.race !== 'material');
const uidNum = (uid: string) => Number(/^u(\d+)$/.exec(uid)?.[1] ?? Number.MAX_SAFE_INTEGER);

/**
 * 挑目標卡：背包裡最早拿到的「候選卡或它的進化型態」（同時間依 uid 排序），所以之後拿到新卡也不會換目標；
 * 一張都沒有時，推薦主線最早能拿到的一條（首通優先，其次掉落）。
 */
export function nurtureTarget(save: SaveData, cards: CardDef[], stages: StageDef[]): NurtureLine | null {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const list = candidates(cards);
  const lineOf = (cardId: string) => list.find((c) => c.id === cardId || c.evolution!.to === cardId);
  const owned = [...save.inventory.cards].sort((a, b) => a.obtainedAt - b.obtainedAt || uidNum(a.uid) - uidNum(b.uid));
  let base = owned.map((c) => lineOf(c.cardId)).find(Boolean);
  let source: string | undefined;
  if (!base) {
    const main = stages.filter((s) => s.kind === 'main');
    const ids = new Set(list.map((c) => c.id));
    const first = main.find((s) => s.rewards.firstClear?.cards?.some((c) => ids.has(c.card)));
    const drop = main.find((s) => s.drops.some((d) => ids.has(d.card)));
    const pick = first?.rewards.firstClear!.cards!.find((c) => ids.has(c.card))?.card ?? drop?.drops.find((d) => ids.has(d.card))?.card;
    base = pick ? byId.get(pick) : list[0];
    source = pick ? (first ?? drop)!.id : undefined;
  }
  if (!base) return null;
  const to = byId.get(base.evolution!.to);
  if (!to) return null;
  const best = save.inventory.cards.filter((c) => c.cardId === base!.id).sort((a, b) => b.level - a.level || b.exp - a.exp)[0];
  const need = new Map<string, number>();
  for (const m of base.evolution!.materials) need.set(m, (need.get(m) ?? 0) + 1);
  const materials = [...need].map(([card, n]) => ({
    card, need: n, have: Math.min(n, save.inventory.cards.filter((c) => c.cardId === card && c.uid !== best?.uid).length),
  }));
  return { base, to, owned: best, materials, coin: base.evolution!.coin, ...(source ? { source } : {}) };
}

/** 四個步驟的完成狀態：進化過（圖鑑擁有過進化型態）就視為前面都完成 */
export function nurtureSteps(save: SaveData, line: NurtureLine): NurtureSteps {
  const evolved = save.collection.owned.includes(line.to.id);
  const o = line.owned;
  return {
    enhanced: evolved || (!!o && (o.level > 1 || o.exp > 0)),
    maxLevel: evolved || (!!o && o.level >= line.base.maxLevel),
    materials: evolved || line.materials.every((m) => m.have >= m.need),
    evolved,
  };
}
