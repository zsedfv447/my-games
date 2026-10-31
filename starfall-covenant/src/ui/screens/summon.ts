import type { GachaPoolDef, SaveData } from '../../core/types';
import { createRng, type Rng } from '../../core/rng';
import { bus } from '../../core/events';
import { gameData } from '../../data/load';
import { displayRates, isPoolOpen, pullCost, pullGacha, pullsUntilPity, type GachaFail, type PullResult } from '../../progression/gacha';
import { audio } from '../audio';
import { userAsset } from '../assets';
import { button, emptyState, stars, tabs } from '../components/basic';
import { cardPortrait, cardThumb } from '../components/card-thumb';
import { openDialog, toast, type DialogHandle } from '../components/overlay';
import { clear, h } from '../dom';
import type { ScreenContext, ScreenDef } from '../router';
import { commit, getSave } from '../state';
import { tutorialFirstPull } from '../tutorial/flow';
import '../summon.css';
import { bannerCopy } from '../summon-copy';
import { LABEL } from '../wording';

/** 新手教學的第一抽：限定和隊長合得來的夥伴（見 tutorial/flow.ts） */
function firstPullOptions(save: SaveData, pool: GachaPoolDef): { firstFrom?: string[] } {
  return { firstFrom: tutorialFirstPull(save, pool, gameData.cards) };
}

/** 一輪召喚先入庫並保存，再開始演出；鎖定期間及切頁後拒絕舊回呼。 */
export function createSummonSession(deps: { read: () => SaveData; write: (save: SaveData) => void; rng: Rng; now: () => number }) {
  let busy = false;
  let disposed = false;
  return {
    begin(pool: GachaPoolDef, count: 1 | 10): ReturnType<typeof pullGacha> | { ok: false; reason: 'busy' } {
      if (busy || disposed) return { ok: false, reason: 'busy' };
      const save = deps.read();
      const result = pullGacha(save, pool, count, deps.rng, deps.now(), firstPullOptions(save, pool));
      if (result.ok) {
        busy = true;
        deps.write(result.save);
      }
      return result;
    },
    finish() { busy = false; },
    dispose() { disposed = true; },
  };
}

const FAIL_TEXT: Record<GachaFail | 'busy', string> = {
  notEnoughGems: '星晶不足。完成冒險與任務可獲得星晶。',
  inventoryFull: '卡片空位不足，請先整理卡片或擴充背包。',
  poolClosed: '此封印尚未開放，或已結束。',
  emptyPool: '此封印暫時沒有可召喚的角色。',
  busy: '請先完成目前的召喚。',
};
export interface PendingSummon {
  pool: GachaPoolDef;
  count: 1 | 10;
  results: PullResult[];
}

/** 跨路由只交接已經扣款、入庫並儲存的結果；演出不得再次抽取。 */
let pending: PendingSummon | null = null;
let pullStarting = false;
let selectedPoolId = '';
export function setPending(p: PendingSummon): void { pending = p; }
export function takePending(): PendingSummon | null {
  const result = pending;
  pending = null;
  return result;
}
export function openPools(): GachaPoolDef[] {
  return gameData.gachaPools.filter((pool) => isPoolOpen(pool, Date.now()));
}
function emitPull(pool: GachaPoolDef, count: 1 | 10, results: PullResult[]): void {
  bus.emit('gachaPulled', { poolId: pool.id, count });
  for (const r of results) bus.emit('cardObtained', { cardId: r.cardId, uid: r.uid, source: 'gacha' });
}

/** 龍形卡夾演出的再抽入口，仍只結算一次；尚未取走的結果會阻止重複扣款。 */
export function startPull(pool: GachaPoolDef, count: 1 | 10): PendingSummon | null {
  if (pullStarting || pending) { toast(FAIL_TEXT.busy); return null; }
  pullStarting = true;
  try {
    const result = pullGacha(getSave(), pool, count, createRng(), Date.now(), firstPullOptions(getSave(), pool));
    if (!result.ok) { toast(FAIL_TEXT[result.reason]); return null; }
    commit(result.save);
    emitPull(pool, count, result.results);
    return { pool, count, results: result.results };
  } finally { pullStarting = false; }
}

const cardById = new Map(gameData.cards.map((c) => [c.id, c]));
const percent = (rate: number) => `${(rate * 100).toFixed(3).replace(/\.?0+$/, '')}%`;
function art(name: string, className: string, alt = ''): HTMLImageElement {
  return h('img', { src: userAsset('ui', `summon-${name}`), class: className, alt, draggable: 'false' });
}
function portal(): HTMLElement {
  return h('div', { class: 'seal-portal', 'aria-hidden': 'true' },
    h('div', { class: 'seal-portal-light' }),
    art('gate-back', 'seal-gate-back'),
    art('gate-left', 'seal-gate-left'), art('gate-right', 'seal-gate-right'),
    art('rim-left', 'seal-rim-left'), art('rim-right', 'seal-rim-right'),
    art('stone', 'seal-stone'),
  );
}
function poolFrom(ctx: ScreenContext): GachaPoolDef | undefined {
  return gameData.gachaPools.find((p) => p.id === ctx.route.args[0]) ?? gameData.gachaPools[0];
}

export const summonScreen: ScreenDef = {
  name: 'summon', title: '封印召喚', chrome: 'full', tab: 'summon', parent: 'home',
  render(ctx) {
    audio.playBgm('summon');
    const root = h('div', { class: 'summon-screen' });
    const poolList = gameData.gachaPools;
    if (!poolList.length) { root.append(emptyState('summon', '封印尚未開放')); return root; }
    let selected = poolList.find((pool) => pool.id === (ctx.route.args[0] || selectedPoolId)) ?? poolList[0];
    selectedPoolId = selected.id;
    let left = false;
    let confirming = false;
    let dialog: DialogHandle | undefined;
    const session = createSummonSession({ read: getSave, write: commit, rng: createRng(), now: Date.now });
    ctx.onLeave(() => { left = true; session.dispose(); dialog?.close(); });

    function askPull(count: 1 | 10) {
      if (confirming || left) return;
      confirming = true;
      const pool = selected;
      const cost = pullCost(pool, count);
      const cancel = () => { confirming = false; dialog?.close(); dialog = undefined; };
      const confirm = button(LABEL.summon, { variant: 'primary', onClick: () => {
        if (left || confirm.disabled) return;
        confirm.disabled = true;
        cancel();
        const result = session.begin(pool, count);
        if (!result.ok) { toast(FAIL_TEXT[result.reason], 3200); return; }
        emitPull(pool, count, result.results);
        setPending({ pool, count, results: result.results });
        ctx.nav.go('summon-ritual');
      } });
      dialog = openDialog(count === 10 ? LABEL.summonTen : LABEL.summonOnce,
        h('div', null, h('p', null, `消耗 ${cost} 星晶，從「${pool.name}」召喚 ${count} 張卡片。`),
          h('p', { class: 'small-text dim' }, `目前持有 ${getSave().player.gems} 星晶。${count === 10 ? `至少獲得一張 ${pool.tenPullGuarantee.minRarity}★ 以上角色。` : ''}`)),
        [button('取消', { variant: 'ghost', sound: 'back', onClick: cancel }), confirm], { dismissible: false });
    }
    function paint() {
      clear(root);
      const save = getSave();
      const open = isPoolOpen(selected, Date.now());
      const copy = bannerCopy(selected);
      const featured = copy.featured.map((id) => cardById.get(id)!).filter(Boolean);
      root.append(h('div', { class: 'seal-titlebar' }, h('span', null, '召 喚'),
        h('div', { class: 'seal-tools' },
          button('紀錄', { small: true, variant: 'ghost', onClick: () => ctx.nav.go('summon-history') }),
          button('機率', { small: true, variant: 'ghost', onClick: () => ctx.nav.go('summon-rates', [selected.id]) }))),
        tabs(poolList.map((p) => ({ id: p.id, label: p.name })), selected.id, (id) => { selected = poolList.find((p) => p.id === id)!; selectedPoolId = selected.id; paint(); }),
        h('section', { class: 'seal-banner' },
          h('span', { class: 'seal-pool-tag' }, copy.tag),
          h('div', { class: 'seal-featured', 'aria-hidden': 'true' }, featured.map((c) => cardPortrait(c))),
          portal(),
          h('div', { class: 'seal-banner-copy' }, h('small', null, copy.en), h('h1', null, selected.name),
            h('p', null, copy.flavor), h('p', { class: 'seal-banner-facts' }, copy.facts))),
        h('div', { class: 'seal-pity-strip' }, h('span', null, `十連必得 ${selected.tenPullGuarantee.minRarity}★ 以上`),
          h('strong', null, `再 ${pullsUntilPity(save, selected)} 抽必得 ${selected.pity.rarity}★`)),
        h('div', { class: 'seal-pull-actions' },
          button(h('span', null, h('strong', null, LABEL.summonOnce), h('small', null, 'SUMMON × 1')), { variant: 'primary', disabled: !open, cost: { kind: 'gem', amount: pullCost(selected, 1) }, onClick: () => askPull(1) }),
          button(h('span', null, h('strong', null, LABEL.summonTen), h('small', null, 'SUMMON × 10')), { variant: 'primary', disabled: !open, cost: { kind: 'gem', amount: pullCost(selected, 10) }, onClick: () => askPull(10) })),
        h('div', { class: 'seal-inventory' }, `卡片空位 ${Math.max(0, save.inventory.capacity - save.inventory.cards.length)} / ${save.inventory.capacity}`,
          h('span', null, '使用遊戲內星晶召喚')),
        h('p', { class: 'seal-disclaimer' }, `各封印保底分開計算，獲得 ${selected.pity.rarity}★ 以上即重置。召喚前可於「機率」查看本作卡池規則。`));
    }
    paint();
    return root;
  },
};

export const summonRatesScreen: ScreenDef = {
  name: 'summon-rates', title: '召喚機率', chrome: 'sub', parent: 'summon',
  render(ctx) {
    const pool = poolFrom(ctx);
    if (!pool) return emptyState('summon', '目前沒有開放的卡池');
    return h('div', { class: 'summon-info-screen' }, h('h1', null, pool.name),
      h('section', { class: 'panel gold seal-rules' }, h('h2', null, '本作卡池規則'),
        h('p', null, '以下為《星骸契約》自行設定的召喚機率。'),
        h('p', null, `一般單抽：${displayRates(pool).map((row) => `${row.rarity}★ ${percent(row.rate)}`).join('、')}。尚未計入保底。`),
        h('p', null, `單抽花 ${pullCost(pool, 1)} 星晶；一次十連花 ${pullCost(pool, 10)} 星晶，至少有一張 ${pool.tenPullGuarantee.minRarity}★ 以上。連按十次單抽不享有十連保證。`),
        h('p', null, `十連前九張若都低於 ${pool.tenPullGuarantee.minRarity}★，第十張會從 ${pool.tenPullGuarantee.minRarity}★ 以上抽出；若同時達到累積保底，優先套用累積保底。`),
        h('p', null, `累積保底：連續 ${pool.pity.after} 抽沒中 ${pool.pity.rarity}★ 以上，第 ${pool.pity.after + 1} 抽一定是 ${pool.pity.rarity}★，不是指定角色。中途抽到 ${pool.pity.rarity}★ 以上就重新計數；單抽和十連都會累計，但不同卡池不共用進度。`),
        h('p', null, `你的進度：最多再 ${pullsUntilPity(getSave(), pool)} 抽就會觸發 ${pool.pity.rarity}★ 保底，也可能提早抽中。`),
        h('p', null, '下方星等旁是「抽到這個星等的總機率」；角色旁是「單抽直接抽到這張卡的機率」，不需要再乘一次星等機率。'),
        pool.rateUp?.length && h('p', null, `機率提升不會提高整體高星率，只會讓同星等中這些角色更容易出現：${displayRates(pool).flatMap((row) => row.cards).filter((entry) => pool.rateUp?.some((up) => up.card === entry.card)).map((entry) => `${cardById.get(entry.card)?.name ?? entry.card} ${percent(entry.rate)}`).join('、')}。`),
        h('p', null, '例如 3% 是每次一般單抽的機會，不代表抽 100 次一定剛好中 3 次。新手教學首抽另有限定候選角色，不完全適用下表。')),
      ...displayRates(pool).map((row) => h('section', { class: 'panel seal-rate-section' },
        h('h2', null, stars(row.rarity), h('span', { class: 'seal-rate-total' }, percent(row.rate))),
        ...row.cards.map((entry) => {
          const card = cardById.get(entry.card)!;
          return h('div', { class: 'seal-rate-row' }, cardThumb(card, { size: 42 }),
            h('div', { class: 'grow' }, h('span', null, card.name), pool.rateUp?.some((u) => u.card === card.id) && h('small', { class: 'seal-up' }, '機率提升')),
            h('strong', null, percent(entry.rate)));
        }))), h('p', { class: 'small-text dim' }, '小數顯示至三位，四捨五入可能造成顯示加總的微小差異。'));
  },
};

export const summonHistoryScreen: ScreenDef = {
  name: 'summon-history', title: '召喚紀錄', chrome: 'sub', parent: 'summon',
  render() {
    const history = getSave().gacha.history.slice().reverse();
    if (!history.length) return emptyState('history', '尚無召喚紀錄', '召喚後，獲得的角色會記錄在這裡。');
    const root = h('div', { class: 'summon-info-screen' }, h('p', { class: 'small-text dim' }, `共 ${history.length} 筆，最多保存最近 1,000 筆。`));
    const list = h('div', { class: 'seal-history-list' });
    let shown = 0;
    const more = button('載入更多紀錄', { block: true, variant: 'ghost', onClick: loadMore });
    function loadMore() {
      for (const record of history.slice(shown, shown + 30)) {
        const card = cardById.get(record.card);
        const pool = gameData.gachaPools.find((p) => p.id === record.pool);
        const date = new Date(record.at).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
        list.append(h('div', { class: 'seal-history-row' }, card && cardThumb(card, { size: 46 }),
          h('div', { class: 'grow' }, h('strong', null, card?.name ?? record.card),
            h('small', null, pool?.name ?? record.pool, ' · ', date)), card && stars(card.rarity)));
      }
      shown += 30;
      more.hidden = shown >= history.length;
    }
    root.append(list, more); loadMore(); return root;
  },
};
