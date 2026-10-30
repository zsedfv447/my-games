// 獎勵發放：金幣、星晶、體力、代幣、卡片
import type { GameConfig, OwnedCard, Reward, SaveData } from '../core/types';
import { addStamina } from './stamina';

/** 產生不重複的卡片 uid（u1、u2…） */
export function nextUidFactory(save: SaveData): () => string {
  let max = 0;
  for (const c of save.inventory.cards) {
    const m = /^u(\d+)$/.exec(c.uid);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return () => `u${++max}`;
}

/** 把卡片加進背包並登錄圖鑑。背包上限由呼叫端事先檢查（獎勵與掉落允許超過上限，避免結算時弄丟卡）。 */
export function addCards(
  save: SaveData,
  cards: { cardId: string; level?: number }[],
  now: number,
): { save: SaveData; added: OwnedCard[] } {
  const newUid = nextUidFactory(save);
  const added: OwnedCard[] = cards.map(({ cardId, level }) => ({
    uid: newUid(), cardId, level: level ?? 1, exp: 0, skillLevel: 1, limitBreak: 0, awakened: 0, locked: false, obtainedAt: now,
  }));
  const seen = new Set(save.collection.seen);
  const owned = new Set(save.collection.owned);
  for (const c of added) {
    seen.add(c.cardId);
    owned.add(c.cardId);
  }
  return {
    added,
    save: {
      ...save,
      inventory: { ...save.inventory, cards: [...save.inventory.cards, ...added] },
      collection: { ...save.collection, seen: [...seen], owned: [...owned] },
    },
  };
}

export function grantReward(
  save: SaveData,
  reward: Reward,
  config: GameConfig,
  now: number,
): { save: SaveData; cards: OwnedCard[] } {
  let s: SaveData = {
    ...save,
    player: {
      ...save.player,
      coin: save.player.coin + (reward.coin ?? 0),
      gems: save.player.gems + (reward.gems ?? 0),
      tokens: { ...save.player.tokens },
    },
  };
  for (const [token, n] of Object.entries(reward.tokens ?? {})) s.player.tokens[token] = (s.player.tokens[token] ?? 0) + n;
  if (reward.stamina) s = addStamina(s, reward.stamina, config, now);
  const list = (reward.cards ?? []).flatMap(({ card, count }) => Array.from({ length: count }, () => ({ cardId: card })));
  if (list.length === 0) return { save: s, cards: [] };
  const r = addCards(s, list, now);
  return { save: r.save, cards: r.added };
}

/** 合併多份獎勵（結算畫面顯示總和用） */
export function mergeRewards(...rewards: (Reward | undefined)[]): Reward {
  const out: Reward = {};
  for (const r of rewards) {
    if (!r) continue;
    if (r.coin) out.coin = (out.coin ?? 0) + r.coin;
    if (r.gems) out.gems = (out.gems ?? 0) + r.gems;
    if (r.stamina) out.stamina = (out.stamina ?? 0) + r.stamina;
    for (const [t, n] of Object.entries(r.tokens ?? {})) (out.tokens ??= {})[t] = (out.tokens[t] ?? 0) + n;
    for (const c of r.cards ?? []) {
      const hit = (out.cards ??= []).find((x) => x.card === c.card);
      if (hit) hit.count += c.count;
      else out.cards.push({ ...c });
    }
  }
  return out;
}
