// 羈絆類點數的共用規則（流浪契印師的同行情誼、角色羈絆小劇場）：點數只增不減，跨過門檻時解鎖一次。純函式。

/** 已達成的門檻數 */
export function tiersReached(tiers: readonly number[], points: number): number {
  return tiers.filter((t) => points >= t).length;
}

/** 下一個門檻；全部達成時為 null */
export function nextTierOf(tiers: readonly number[], points: number): number | null {
  return tiers.find((t) => points < t) ?? null;
}

export interface PointGain {
  map: Record<string, number>;
  before: number;
  after: number;
  /** 這次新達成的門檻索引；點數只會增加，同一個門檻不會再出現第二次 */
  unlocked: number[];
}

/** 對 key 加 1 點（map 可能是舊存檔沒有的 undefined），回傳新的 map 與這次跨過的門檻 */
export function addPoint(map: Record<string, number> | undefined, key: string, tiers: readonly number[]): PointGain {
  const before = map?.[key] ?? 0;
  const after = before + 1;
  const unlocked = tiers.flatMap((t, i) => (before < t && after >= t ? [i] : []));
  return { map: { ...map, [key]: after }, before, after, unlocked };
}
