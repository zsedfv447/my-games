// 進化：滿級後消耗指定素材與金幣變成新型態；顯示素材、前後對比、確認與演出
import { h } from '../dom';
import { evolve, pickEvolutionMaterials } from '../../growth';
import { badge, button, emptyState, panel, stars } from '../components/basic';
import { cardPortrait, cardThumb } from '../components/card-thumb';
import { confirmDialog, toast } from '../components/overlay';
import { commit, getSave, growth } from '../state';
import type { ScreenDef } from '../router';
import { celebrate, growthBackdrop, statTable } from './enhance';
import { evolutionCompare, evolutionNeeds, statLines } from './growth-view';
import '../growth.css';

export const evolveScreen: ScreenDef = {
  name: 'evolve',
  title: '進化',
  chrome: 'sub',
  parent: 'cards',
  render({ route, nav }) {
    const uid = route.args[0];
    const save = getSave();
    const owned = save.inventory.cards.find((c) => c.uid === uid);
    const def = owned && growth.card(owned.cardId);
    const root = h('div', { class: 'growth-screen', style: growthBackdrop() });
    if (!owned || !def) return h('div', null, emptyState('cards', '找不到這張卡片'));
    const evo = def.evolution;
    const toDef = evo && growth.card(evo.to);
    if (!evo || !toDef) {
      root.append(emptyState('cards', `${def.name}已是最終型態`, '這張卡沒有可以進化的型態'));
      return root;
    }

    const levelOk = owned.level >= def.maxLevel;
    const needs = evolutionNeeds(save, growth, uid);
    const matsOk = needs.every((n) => n.have >= n.need);
    const coinOk = save.player.coin >= evo.coin;
    const cmp = evolutionCompare(owned, def, toDef, growth);
    const toSkill = toDef.activeSkill ? growth.skill(toDef.activeSkill) : undefined;
    const toLeader = toDef.leaderSkill ? growth.leaderSkill(toDef.leaderSkill) : undefined;

    const run = async () => {
      const ok = await confirmDialog('確認進化', `${def.name} 將進化為 ${toDef.name}。等級會回到 Lv1，素材卡會被消耗。`, '進化');
      if (!ok) return;
      const pick = pickEvolutionMaterials(getSave(), growth, uid);
      if (pick.missing.length) return toast('素材不足');
      const r = evolve(getSave(), growth, uid, pick.uids);
      if (!r.ok) return toast(r.error.message);
      commit(r.save);
      celebrate(toDef, '進化成功！', h('div', { class: 'growth-level-jump' },
        h('span', null, def.name), h('span', { class: 'arrow' }, '→'), h('strong', { class: 'up' }, toDef.name)),
      'summon-release', () => nav.replace('card', [uid]));
    };

    root.append(h('div', { class: 'growth-body' },
      h('div', { class: 'evolve-pair' },
        h('div', { class: 'evolve-side' }, cardPortrait(def), h('strong', null, def.name), stars(def.rarity)),
        h('div', { class: 'evolve-arrow', 'aria-hidden': 'true' }, '➤'),
        h('div', { class: 'evolve-side after' }, cardPortrait(toDef), h('strong', null, toDef.name), stars(toDef.rarity))),
      panel({ title: '能力值（目前 → 進化後 Lv1）' },
        statTable(statLines(cmp.now, cmp.lv1)),
        h('p', { class: 'small-text dim', style: { margin: '6px 0 0' } },
          `進化後最高 Lv${toDef.maxLevel}：生命 ${cmp.max.hp.toLocaleString()}・攻擊 ${cmp.max.atk.toLocaleString()}・回復 ${cmp.max.rcv.toLocaleString()}`),
        h('p', { class: 'small-text dim', style: { margin: '4px 0 0' } }, '技能等級、突破與星紋覺醒會保留。')),
      (toSkill || toLeader) && panel({ title: '進化後技能' },
        toSkill && h('p', { class: 'small-text', style: { margin: '0 0 4px' } }, h('strong', null, `主動技・${toSkill.name}`), `：${toSkill.description}`),
        toLeader && h('p', { class: 'small-text', style: { margin: '0' } }, h('strong', null, `隊長技・${toLeader.name}`), `：${toLeader.description}`)),
      panel({ title: '進化條件' },
        h('div', { class: 'evolve-reqs' },
          h('div', { class: ['req', levelOk ? 'ok' : 'ng'] }, h('span', null, levelOk ? '✓' : '✗'), `等級 ${owned.level} / ${def.maxLevel}`,
            !levelOk && button('去強化', { small: true, onClick: () => nav.go('enhance', [uid]) })),
          needs.map((n) => {
            const m = growth.card(n.id);
            const ok = n.have >= n.need;
            return h('div', { class: ['req', ok ? 'ok' : 'ng'] },
              h('span', null, ok ? '✓' : '✗'),
              m && cardThumb(m, { size: 40 }),
              h('span', { class: 'grow' }, m?.name ?? n.id),
              badge(`${Math.min(n.have, n.need)} / ${n.need}`, ok ? 'gold' : 'danger'));
          }),
          h('div', { class: ['req', coinOk ? 'ok' : 'ng'] }, h('span', null, coinOk ? '✓' : '✗'), `金幣 ${evo.coin.toLocaleString()}（持有 ${save.player.coin.toLocaleString()}）`)),
        !matsOk && h('p', { class: 'small-text dim', style: { margin: '6px 0 0' } }, '上鎖或在隊伍中的卡不會被當成素材；素材可在每日關卡取得。')),
      h('div', { class: 'growth-action' },
        button('進化', { variant: 'primary', block: true, disabled: !(levelOk && matsOk && coinOk), cost: { kind: 'coin', amount: evo.coin }, onClick: () => void run() })),
    ));
    return root;
  },
};
