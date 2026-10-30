/** 可設定種子的亂數產生器（mulberry32），讓戰鬥、抽卡與模擬器結果可重現 */
export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  /** 目前的內部狀態；用 createRng(state) 可從這裡接著產生同樣的序列（戰鬥續戰存檔用） */
  state?(): number;
}

export function createRng(seed: number = Date.now()): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    pick: (items) => items[Math.floor(next() * items.length)],
    state: () => a,
  };
}
