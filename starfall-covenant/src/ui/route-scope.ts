// 綁定畫面的東西（主城自動跳出的彈窗等）：換畫面時由 router 一次關掉，不會跟到下一頁。
// 不碰 DOM，方便測試；overlay 把要綁定的對話框登記進來。

const closers = new Set<() => void>();

/** 登記一個換畫面時要關掉的東西；回傳取消登記的函式（自己先關掉時呼叫） */
export function bindToRoute(close: () => void): () => void {
  closers.add(close);
  return () => { closers.delete(close); };
}

/** router 換畫面時呼叫：關掉所有綁定在上一個畫面的東西 */
export function closeRouteScoped(): void {
  const list = [...closers];
  closers.clear();
  for (const close of list) close();
}

export const routeScopedCount = (): number => closers.size;
