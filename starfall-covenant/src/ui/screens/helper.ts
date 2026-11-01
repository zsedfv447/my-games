import { leaderSupportRoster, type LeaderSupportOffer } from '../helper-support';
// 選擇助戰（GDD 2.5 關卡列表 → 選助戰 → 戰鬥前確認）：NPC「流浪契印師」名單，顯示助戰卡的隊長技
import { findStage } from '../stage-lookup';
import { h } from '../dom';
import { gameData } from '../../data/load';
import type { StageDef } from '../../core/types';
import { HELPER_NPCS, helperRoster, stageAllowsHelper, type HelperNpcDef, type HelperOffer } from '../../progression/helpers';
import { bondDef, bondLevel, bondPoints, hasBondFrame, nextBondTier } from '../../progression/helper-bond';
import { ATTRIBUTE_NAMES, RACE_NAMES } from '../art/palette';
import { userAsset } from '../assets';
import { audio } from '../audio';
import { badge, button, emptyState, listItem, panel } from '../components/basic';
import { closeBondStories, playBondStory } from '../bond-story';
import { cardThumb } from '../components/card-thumb';
import { chooseHelper, chosenHelper, offerToHelper, supportToHelper, VIOLATION_TEXT } from '../sortie';
import { markSeen } from '../../growth';
import { commit, getSave, growth } from '../state';
import type { ScreenDef } from '../router';
import '../collection-helper.css';
import { nextBondTitle } from '../../progression/titles';

const archetypeName = (id: string) => gameData.archetypes.find((a) => a.id === id)?.name ?? id;

/** 本關的助戰名單（畫面與出戰確認共用） */
export function rosterFor(stage: StageDef): HelperOffer[] {
  return helperRoster(getSave(), stage, HELPER_NPCS, gameData.stages, growth.card, Date.now());
}

export function npcAvatar(npc: HelperNpcDef, size = 64): HTMLElement {
  const classicCard: Record<string,string> = {'npc-norse':'c801','npc-greek':'c806','npc-classicbeast':'c811'};
  const url = classicCard[npc.id] ? userAsset('cards',classicCard[npc.id]) : userAsset('ui', npc.id);
  // 情誼滿 20 點的星契頭像框（純 CSS）
  return h('div', { class: ['npc-avatar', hasBondFrame(bondPoints(getSave(), npc.id)) && 'bond-frame'], style: { '--avatar': `${size}px` } },
    url ? h('img', { src: url, alt: npc.name, draggable: 'false', loading: 'lazy' }) : h('span', null, npc.name.split('・').pop()!.slice(0, 1)));
}

/** 回憶全部解鎖後的長期目標：下一個情誼稱號（progression/titles.ts） */
function afterBondCap(points: number): string {
  const goal = nextBondTitle('helperBond', points);
  return goal ? `・回憶全部解鎖・下一個目標：稱號「${goal.title.name}」（情誼 ${goal.atLeast}）` : '・回憶與情誼稱號全部解鎖';
}

/** 情誼點數與下一個門檻 */
function bondText(npc: HelperNpcDef): HTMLElement {
  const points = bondPoints(getSave(), npc.id);
  const next = nextBondTier(points);
  return h('div', { class: 'helper-bond small-text' },
    h('span', { class: 'helper-bond-heart' }, '♥'),
    ` 情誼 ${points}`,
    h('span', { class: 'faint' }, next === null ? afterBondCap(points) : `・下一段回憶 ${next}`));
}

/** 已解鎖的情誼回憶：點了用劇情對話框播放 */
function bondMemories(onLeave: (fn: () => void) => void): HTMLElement | null {
  const save = getSave();
  const items = HELPER_NPCS.flatMap((npc) => {
    const def = bondDef(npc.id);
    const n = bondLevel(bondPoints(save, npc.id));
    return def ? def.stories.slice(0, n).map((story, i) => ({ npc, story, i })) : [];
  });
  if (!items.length) return null;
  // 回憶層掛在舞台上，離開畫面時一起收掉
  onLeave(closeBondStories);
  return h('div', null,
    h('h2', { class: 'section-title' }, '同行回憶'),
    h('div', { class: 'list' }, items.map(({ npc, story, i }) => listItem({
      leading: npcAvatar(npc, 36),
      title: story.title,
      sub: `${npc.name}・第 ${i + 1} 段`,
      onClick: () => { audio.play('confirm'); playBondStory(story.lines); },
    }))));
}

function offerRow(offer: HelperOffer, selected: boolean, pick: () => void): HTMLElement {
  const leader = offer.card.leaderSkill ? growth.leaderSkill(offer.card.leaderSkill) : undefined;
  return h(
    'button',
    { type: 'button', class: ['helper-row', selected && 'selected', offer.problem && 'blocked'], disabled: !!offer.problem, onClick: () => { audio.play('confirm'); pick(); } },
    h('div', { class: 'helper-head' },
      npcAvatar(offer.npc, 52),
      h('div', { class: 'grow' },
        h('div', { class: 'helper-name' }, offer.npc.name),
        h('div', { class: 'small-text dim' }, offer.npc.title),
        h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '4px' } },
          offer.recommended && badge('本關推薦', 'gold'),
          badge(archetypeName(offer.npc.archetype)),
          selected && badge('出戰中', 'gold')),
        bondText(offer.npc)),
      cardThumb(offer.card, { level: offer.level, size: 56 })),
    h('div', { class: 'helper-card-name small-text' }, `${ATTRIBUTE_NAMES[offer.card.attribute]}・${offer.card.name}`, h('span', { class: 'faint' }, `　技能 Lv.${offer.skillLevel}`)),
    leader
      ? h('div', { class: 'helper-leader' }, h('strong', null, `隊長技・${leader.name}`), h('p', null, leader.description))
      : h('div', { class: 'helper-leader dim small-text' }, '沒有隊長技'),
    offer.problem ? h('div', { class: 'small-text', style: { color: 'var(--danger)' } }, VIOLATION_TEXT[offer.problem]) : h('div', { class: 'helper-quote small-text dim' }, `「${offer.npc.quote}」`),
  );
}

export const helperScreen: ScreenDef = {
  name: 'helper',
  title: '選擇助戰',
  chrome: 'sub',
  parent: 'adventure',
  render({ route, nav, onLeave }) {
    const stage = findStage(route.args[0] ?? '');
    if (!stage) return h('div', null, emptyState('team', '找不到這一關'), button('回到冒險', { block: true, onClick: () => nav.replace('adventure') }));
    if (!stageAllowsHelper(stage)) {
      return h('div', null,
        emptyState('team', stage.fixedTeam ? '這一關使用借用隊伍' : '這一關不能帶助戰', stage.fixedTeam ? '流派試煉由關卡提供隊伍與助戰。' : undefined),
        button('回到出戰確認', { block: true, onClick: () => nav.replace('prepare', [stage.id]) }));
    }

    let disposed = false, settled = false, generation = 0;
    onLeave(() => { disposed = true; generation++; });
    const roster = rosterFor(stage);
    const supports = () => leaderSupportRoster(getSave(), stage, gameData.cards, gameData.leaderSkills, gameData.stages);
    const current = chosenHelper(stage.id);
    const done = (helper: ReturnType<typeof offerToHelper> | null) => {
      if (disposed || settled || !root.isConnected) return;
      settled = true;
      chooseHelper(stage.id, helper);
      if (route.query.from === 'prepare') nav.back();
      else nav.replace('prepare', [stage.id]);
    };
    const selectedText = current === null ? '不帶助戰' : current ? current.card.name : '尚未選擇（出戰確認沿用原 NPC 預設）';
    const save = getSave();
    const uid = (save.teams[save.activeTeam] ?? save.teams[0])?.members[0];
    const owned = uid ? save.inventory.cards.find(c => c.uid === uid) : undefined;
    const leader = owned ? growth.card(owned.cardId) : undefined;
    const list = h('div', { class: 'list' });
    const count = h('span', { class: 'small-text dim' });
    let showAll = false;
    const input = h('input', { type: 'search', class: 'text-input', 'aria-label': '搜尋常駐助戰名稱或卡號', placeholder: '名稱或卡號' });
    const show = button('顯示全部', { small: true, onClick: () => { if (!disposed && !settled) { showAll = true; draw(); } } });
    const clear = button('清除搜尋', { small: true, variant: 'ghost', onClick: () => { if (!disposed && !settled) { input.value = ''; showAll = false; draw(); } } });
    const supportRow = (offer: LeaderSupportOffer, token: number) => {
      const skill = offer.card.leaderSkill ? growth.leaderSkill(offer.card.leaderSkill) : undefined;
      const thumb = cardThumb(offer.card, { level: offer.level, size: 56 });
      const row = h('button', { type: 'button', class: ['helper-row', 'support-row', current?.npcId === offer.id && 'selected', offer.problem && 'blocked'],
        'data-support-id': offer.id, disabled: !!offer.problem,
        onClick: () => {
          if (disposed || settled || token !== generation || !row.isConnected) return;
          const fresh = supports().find(o => o.id === offer.id);
          if (!fresh || fresh.problem) return;
          done(supportToHelper(fresh));
        } },
        h('div', { class: 'row' }, h('span', { class: thumb.className, style: { '--thumb': '56px' } }, ...Array.from(thumb.childNodes)),
          h('strong', null, offer.card.name)),
        h('div', { class: 'small-text dim' }, `${offer.card.id}・${ATTRIBUTE_NAMES[offer.card.attribute]}・${RACE_NAMES[offer.card.race]}・Lv.${offer.level}・技能 Lv.${offer.skillLevel}`),
        skill && h('div', { class: 'helper-leader' }, h('strong', null, `隊長技・${skill.name}`), h('p', null, skill.description)),
        offer.reasons.map(reason => h('p', { class: 'small-text dim' }, reason)),
        offer.warnings.map(warning => h('p', { class: 'small-text' }, warning)),
        offer.problem && h('p', { class: 'small-text', style: { color: 'var(--danger)' } }, VIOLATION_TEXT[offer.problem]));
      return row;
    };
    const draw = () => {
      if (disposed || settled) return;
      const token = ++generation, query = input.value.trim().toLocaleLowerCase();
      const filtered = supports().filter(o => !query || o.card.id.toLocaleLowerCase().includes(query) || o.card.name.toLocaleLowerCase().includes(query));
      const visible = showAll ? filtered : filtered.slice(0, 12);
      list.replaceChildren(...visible.map(o => supportRow(o, token)));
      count.textContent = `顯示 ${visible.length} / ${filtered.length}`;
      show.hidden = visible.length >= filtered.length;
      if (!visible.length) list.append(emptyState('team', '沒有符合名稱或卡號的常駐支援'));
      queueMicrotask(() => {
        if (disposed || settled || token !== generation || !root.isConnected) return;
        const seen = markSeen(getSave(), [...visible.map(o => o.card.id), ...roster.map(o => o.card.id)]);
        if (seen !== getSave()) commit(seen);
      });
    };
    input.addEventListener('input', () => { showAll = false; draw(); });
    const total = HELPER_NPCS.length;

    const root = h(
      'div',
      null,
      panel({ title: '常駐隊長支援' },
        h('p', { class: 'small-text' }, `目前隊長：${leader?.name ?? '無有效隊長'}。`),
        h('p', { class: 'small-text dim' }, '排序依隊長技與目前編成作參考；生命、消珠等條件仍以實戰及技能原文為準。借用不代表持有。'),
        h('p', { class: 'small-text dim' }, '既有情誼仍依卡片對應 NPC 的規則計算；常駐借用既有 NPC 關聯卡片也可能累積該 NPC 情誼。'),
        h('p', { 'data-current-helper': '', class: 'small-text' }, `目前選擇：${selectedText}`),
        input, h('div', { class: 'row between' }, clear, count, show), list),
      h('h2', { class: 'section-title' }, '流浪契印師'),
      panel(
        null,
        h('div', { class: 'row between' }, h('strong', null, stage.name), h('span', { class: 'small-text dim' }, `契印師 ${roster.length} / ${total}`)),
        h('p', { class: 'small-text dim', style: { margin: '6px 0 0' } }, '助戰是副隊長：助戰卡的隊長技會和你的隊長技一起生效。名單每天輪替，推進主線會遇到更多契印師，他們帶的卡也會變強。借用契印師通關會累積情誼，到 5、10、20 點解鎖同行回憶。'),
        stage.recommendedArchetypes?.length
          ? h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '6px' } }, h('span', { class: 'small-text' }, '本關推薦'), stage.recommendedArchetypes.map((a) => badge(archetypeName(a), 'gold')))
          : null,
      ),
      roster.length
        ? h('div', { class: 'list' }, roster.map((o) => {
          const row = offerRow(o, current?.npcId === o.npc.id, () => {
            if (disposed || settled || !row.isConnected) return;
            const fresh = rosterFor(stage).find(n => n.npc.id === o.npc.id);
            if (fresh && !fresh.problem) done(offerToHelper(fresh));
          });
          return row;
        }))
        : emptyState('team', '目前沒有契印師可以同行'),
      button('不帶助戰', { variant: 'ghost', block: true, sound: 'back', onClick: () => done(null) }),
      bondMemories(onLeave),
    );
    draw();
    return root;
  },
};
