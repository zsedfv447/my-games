// 召喚：卡池首頁、機率說明、召喚紀錄；按下召喚後立刻結算存檔，再進入滑動解封的演出畫面
import { h, svg } from '../dom';
import { gameData } from '../../data/load';
import { bus } from '../../core/events';
import { createRng } from '../../core/rng';
import type { GachaPoolDef, Rarity } from '../../core/types';
import { displayRates, isPoolOpen, pullCost, pullGacha, pullsUntilPity, type GachaFail, type PullResult } from '../../progression/gacha';
import { sealSvg } from '../art/sigil';
import { badge, button, emptyState, listItem, panel, stars } from '../components/basic';
import { cardThumb } from '../components/card-thumb';
import { toast } from '../components/overlay';
import { commit, getSave, growth } from '../state';
import type { Navigator, ScreenDef } from '../router';

export interface PendingSummon {
  pool: GachaPoolDef;
  count: 1 | 10;
  results: PullResult[];
}

/** 已結算、等待演出的召喚結果（演出畫面取走；重新整理後就沒有了，卡片早已入袋） */
let pending: PendingSummon | null = null;

export function setPending(p: PendingSummon): void {
  pending = p;
}

export function takePending(): PendingSummon | null {
  const p = pending;
  pending = null;
  return p;
}

const FAIL_TEXT: Record<GachaFail, string> = {
  poolClosed: '這個卡池已經關閉',
  notEnoughGems: '星晶不足',
  inventoryFull: '背包空間不足，請先整理或擴充背包',
  emptyPool: '卡池目前沒有卡片',
};

export function openPools(): GachaPoolDef[] {
  const now = Date.now();
  return gameData.gachaPools.filter((p) => isPoolOpen(p, now));
}

/** 抽卡並存檔；成功回傳結果，失敗顯示原因 */
export function startPull(pool: GachaPoolDef, count: 1 | 10): PendingSummon | null {
  const r = pullGacha(getSave(), pool, count, createRng(), Date.now());
  if (!r.ok) {
    toast(FAIL_TEXT[r.reason]);
    return null;
  }
  commit(r.save);
  bus.emit('gachaPulled', { poolId: pool.id, count });
  for (const x of r.results) bus.emit('cardObtained', { cardId: x.cardId, uid: x.uid, source: 'gacha' });
  return { pool, count, results: r.results };
}

function summonAndPlay(nav: Navigator, pool: GachaPoolDef, count: 1 | 10): void {
  const p = startPull(pool, count);
  if (!p) return;
  pending = p;
  nav.go('summon-ritual');
}

let selectedPool = '';

export const summonScreen: ScreenDef = {
  name: 'summon',
  title: '召喚',
  chrome: 'full',
  tab: 'summon',
  parent: 'home',
  render({ nav }) {
    const pools = openPools();
    if (!pools.length) return h('div', null, emptyState('summon', '目前沒有開放的卡池'));
    const pool = pools.find((p) => p.id === selectedPool) ?? pools[0];
    const save = getSave();
    const top = Math.max(...Object.keys(pool.cards).map(Number)) as Rarity;
    const highRate = Object.entries(pool.rates).reduce((a, [r, p]) => a + (Number(r) >= pool.pity.rarity ? p ?? 0 : 0), 0);
    const featured = (pool.cards[top] ?? []).map((id) => growth.card(id)).filter((c) => !!c);

    return h(
      'div',
      { class: 'summon-home' },
      pools.length > 1 && h('div', { class: 'row wrap' }, pools.map((p) => button(p.name, { small: true, variant: p.id === pool.id ? 'primary' : 'ghost', onClick: () => { selectedPool = p.id; nav.replace('summon'); } }))),
      h(
        'section',
        { class: 'summon-banner' },
        h('div', { class: 'summon-banner-seal' }, svg(sealSvg())),
        h('div', { class: 'summon-banner-title' }, pool.name),
        h('div', { class: 'summon-banner-sub' }, `${pool.pity.rarity}★ 以上 ${(highRate * 100).toFixed(0)}%・十連必得 ${pool.tenPullGuarantee.minRarity}★ 以上`),
        h('div', { class: 'summon-featured' }, featured.map((c) => cardThumb(c, { size: 52, onClick: () => nav.go('summon-rates', [pool.id]) }))),
      ),
      h('div', { class: 'row between small-text' },
        h('span', { class: 'dim' }, `再 ${pullsUntilPity(save, pool)} 抽內必得 ${pool.pity.rarity}★`),
        h('span', { class: 'dim' }, `持有星晶 ${save.player.gems.toLocaleString()}`)),
      h('div', { class: 'row summon-actions' },
        button('單抽', { block: true, cost: { kind: 'gem', amount: pullCost(pool, 1) }, onClick: () => summonAndPlay(nav, pool, 1) }),
        button('十連召喚', { block: true, variant: 'primary', cost: { kind: 'gem', amount: pullCost(pool, 10) }, onClick: () => summonAndPlay(nav, pool, 10) })),
      h('div', { class: 'row' },
        button('機率說明', { small: true, block: true, variant: 'ghost', onClick: () => nav.go('summon-rates', [pool.id]) }),
        button('召喚紀錄', { small: true, block: true, variant: 'ghost', icon: 'history', onClick: () => nav.go('summon-history') })),
    );
  },
};

export const summonRatesScreen: ScreenDef = {
  name: 'summon-rates',
  title: '機率說明',
  chrome: 'sub',
  parent: 'summon',
  render({ route }) {
    const pool = gameData.gachaPools.find((p) => p.id === route.args[0]) ?? gameData.gachaPools[0];
    if (!pool) return h('div', null, emptyState('summon', '找不到卡池'));
    const pct = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 3 : 2)}%`;
    return h(
      'div',
      null,
      panel({ title: pool.name, gold: true },
        h('p', { class: 'small-text' }, `單抽 ${pullCost(pool, 1)} 星晶，十連 ${pullCost(pool, 10)} 星晶。十連召喚至少獲得 1 張 ${pool.tenPullGuarantee.minRarity}★ 以上；連續 ${pool.pity.after} 抽沒有 ${pool.pity.rarity}★ 以上時，下一抽必定是 ${pool.pity.rarity}★。`)),
      displayRates(pool).map((tier) => panel(
        null,
        h('div', { class: 'row between' }, stars(tier.rarity), h('strong', null, pct(tier.rate))),
        h('div', { class: 'list', style: { marginTop: '6px' } }, tier.cards.map((c) => {
          const def = growth.card(c.card);
          return def && listItem({
            leading: cardThumb(def, { size: 40 }),
            title: def.name,
            trailing: h('span', { class: 'small-text dim' }, pct(c.rate)),
          });
        })),
      )),
    );
  },
};

export const summonHistoryScreen: ScreenDef = {
  name: 'summon-history',
  title: '召喚紀錄',
  chrome: 'sub',
  parent: 'summon',
  render() {
    const history = getSave().gacha.history.slice(-100).reverse();
    if (!history.length) return h('div', null, emptyState('history', '還沒有召喚紀錄'));
    const fmt = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return h(
      'div',
      { class: 'list' },
      h('div', { class: 'small-text dim' }, '顯示最近 100 筆'),
      history.map((e) => {
        const def = growth.card(e.card);
        const pool = gameData.gachaPools.find((p) => p.id === e.pool);
        return def && listItem({
          leading: cardThumb(def, { size: 40 }),
          title: h('span', null, def.name, ' ', def.rarity >= 5 && badge(`${def.rarity}★`, 'gold')),
          sub: `${pool?.name ?? e.pool}・${fmt.format(e.at)}`,
          trailing: stars(def.rarity),
        });
      }),
    );
  },
};
