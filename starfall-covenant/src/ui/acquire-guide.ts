// 追卡指南：一張卡可以從哪裡拿到、現在拿不拿得到、點了要去哪裡（純函式，不碰 DOM）。
// 資料由 stages（首通、掉落）、shop（兌換與剩餘次數）、gacha-pools（卡池）、cards（進化關係）、quests 推算。
import type { CardDef, GachaPoolDef, QuestDef, SaveData, ShopItemDef, StageDef } from '../core/types';
import { eventWindow, type EventDef } from '../progression/events';
import { isPoolOpen } from '../progression/gacha';
import { remainingPurchases } from '../progression/shop';
import { isPlayable, lockText, stageContext, stageListPath, stageRow } from './stage-nav';

export interface GuideData {
  cards: CardDef[];
  stages: StageDef[];
  shop: ShopItemDef[];
  gachaPools: GachaPoolDef[];
  quests: QuestDef[];
  events: EventDef[];
}

/** 前往的畫面：[畫面名稱, 參數] */
export type GoTo = [string, string[]];

export type AcquireRoute =
  | { kind: 'firstClear'; stage: StageDef; available: boolean; note: string; go: GoTo }
  | { kind: 'drop'; stage: StageDef; rate: number; available: boolean; note: string; go: GoTo }
  | { kind: 'shop'; item: ShopItemDef; remaining: number; available: boolean; note: string; go: GoTo }
  | { kind: 'evolve'; from: CardDef; available: boolean; note: string; go: GoTo }
  | { kind: 'gacha'; pool: GachaPoolDef; available: boolean; note: string; go: GoTo }
  | { kind: 'quest'; quest: QuestDef; available: boolean; note: string; go: GoTo };

export type AcquireKind = AcquireRoute['kind'];

export const KIND_LABEL: Record<AcquireKind, string> = {
  firstClear: '首通必得',
  drop: '隨機掉落',
  shop: '兌換',
  evolve: '進化',
  gacha: '卡池',
  quest: '任務獎勵',
};

const LIMIT_LABEL: Record<NonNullable<ShopItemDef['limit']>['per'], string> = {
  day: '今天', week: '本週', month: '本月', forever: '', event: '本期活動',
};

/** 掉落率文字：照實寫百分比，不寫成保證 */
export function rateText(rate: number): string {
  const pct = rate * 100;
  return `${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%`;
}

function stageRoute(save: SaveData, stage: StageDef, data: GuideData, now: number): { available: boolean; note: string; go: GoTo } {
  const ctx = stageContext(data.stages, data.events, now);
  const row = stageRow(save, stage, ctx, now);
  const available = isPlayable(row.status);
  const list = stageListPath(stage, data.events).split('/');
  return { available, note: available ? '' : lockText(row, data.stages), go: available ? ['prepare', [stage.id]] : [list[0], list.slice(1)] };
}

/** 用活動代幣兌換的品項：代幣所屬的活動開放中才能換 */
function shopRoute(save: SaveData, item: ShopItemDef, data: GuideData, now: number): { remaining: number; available: boolean; note: string } {
  const remaining = remainingPurchases(save, item, now, data.events);
  const token = Object.keys(item.price.tokens ?? {})[0];
  const event = token ? data.events.find((e) => e.token === token) : undefined;
  const state = event ? eventWindow(event, now).state : 'always';
  const eventOpen = state === 'open' || state === 'always';
  const per = item.limit ? LIMIT_LABEL[item.limit.per] : '';
  const left = item.limit ? (per ? `${per}還能換 ${remaining} 次` : `還能換 ${remaining} 次`) : '不限次數';
  if (!eventOpen) return { remaining, available: false, note: `${event?.name ?? '活動'}未開放` };
  if (remaining <= 0) return { remaining, available: false, note: per ? `${per}已兌換完` : '已兌換完' };
  return { remaining, available: true, note: left };
}

const hasCard = (r: { cards?: { card: string }[] } | undefined, cardId: string) => Boolean(r?.cards?.some((c) => c.card === cardId));

/** 一張卡全部的取得方式，可取得的排前面 */
export function acquireRoutes(save: SaveData, cardId: string, data: GuideData, now: number): AcquireRoute[] {
  const routes: AcquireRoute[] = [];
  for (const stage of data.stages) {
    if (hasCard(stage.rewards.firstClear, cardId)) {
      const r = stageRoute(save, stage, data, now);
      const done = save.progress.clearedStages.includes(stage.id);
      routes.push({ kind: 'firstClear', stage, ...r, available: r.available && !done, note: done ? '已經通關領過了' : r.note });
    }
    const drop = stage.drops.find((d) => d.card === cardId);
    if (drop) routes.push({ kind: 'drop', stage, rate: drop.rate, ...stageRoute(save, stage, data, now) });
  }
  for (const item of data.shop) {
    if (!('cards' in item.reward) || !hasCard(item.reward, cardId)) continue;
    const r = shopRoute(save, item, data, now);
    const tab = item.price.tokens && Object.keys(item.price.tokens).length ? 'event' : item.price.gems ? 'gems' : 'coin';
    routes.push({ kind: 'shop', item, ...r, go: ['shop', [tab]] });
  }
  const from = data.cards.find((c) => c.evolution?.to === cardId);
  if (from) {
    const ownedFrom = save.inventory.cards.some((c) => c.cardId === from.id);
    routes.push({ kind: 'evolve', from, available: ownedFrom, note: ownedFrom ? '持有進化前的卡，滿級後可以進化' : `先取得「${from.name}」`, go: ['collection-card', [from.id]] });
  }
  for (const pool of data.gachaPools) {
    if (!Object.values(pool.cards).some((list) => list?.includes(cardId))) continue;
    const open = isPoolOpen(pool, now);
    routes.push({ kind: 'gacha', pool, available: open, note: open ? '' : '卡池未開放', go: ['summon', []] });
  }
  for (const quest of data.quests) {
    if (!hasCard(quest.reward, cardId)) continue;
    const claimed = save.quests.claimed.includes(quest.id);
    routes.push({ kind: 'quest', quest, available: !claimed, note: claimed ? '已經領過了' : '', go: [quest.kind === 'achievement' ? 'achievements' : 'quests', []] });
  }
  return routes.map((r, i) => ({ r, i })).sort((a, b) => Number(b.r.available) - Number(a.r.available) || a.i - b.i).map(({ r }) => r);
}

export interface MaterialGuide {
  card: CardDef;
  need: number;
  have: number;
  /** 會掉這種素材的關卡（掉落率照實列出）與商店品項 */
  routes: AcquireRoute[];
}

/** 進化缺素材時指路：每種素材需要幾張、持有幾張、去哪裡拿（只列關卡掉落、首通與商店） */
export function materialGuide(save: SaveData, needs: { id: string; need: number; have: number }[], data: GuideData, now: number): MaterialGuide[] {
  return needs.flatMap(({ id, need, have }) => {
    const card = data.cards.find((c) => c.id === id);
    if (!card) return [];
    const routes = acquireRoutes(save, id, data, now).filter((r) => r.kind === 'drop' || r.kind === 'firstClear' || r.kind === 'shop');
    return [{ card, need, have, routes }];
  });
}
