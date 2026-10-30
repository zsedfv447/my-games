/** 簡易事件匯流排：邏輯模組發出事件，UI 與任務計數器訂閱 */
export type Listener<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(type: K, fn: Listener<Events[K]>): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn as Listener<never>);
    return () => this.listeners.get(type)?.delete(fn as Listener<never>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    this.listeners.get(type)?.forEach((fn) => (fn as Listener<Events[K]>)(payload));
  }
}

/** 全遊戲共用事件（任務、成就、音效都靠這些事件計數） */
export interface GameEvents extends Record<string, unknown> {
  comboResolved: { combo: number; orbsCleared: number };
  stageCleared: { stageId: string; turns: number; stars: boolean[] };
  stageFailed: { stageId: string };
  cardObtained: { cardId: string; uid: string; source: 'gacha' | 'drop' | 'reward' };
  cardEnhanced: { uid: string };
  cardEvolved: { uid: string; from: string; to: string };
  gachaPulled: { poolId: string; count: number };
  saveWritten: { at: number };
}

export const bus = new EventBus<GameEvents>();
