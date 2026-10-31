// 選擇助戰（GDD 2.5 關卡列表 → 選助戰 → 戰鬥前確認）：NPC「流浪契印師」名單，顯示助戰卡的隊長技
import { findStage } from '../stage-lookup';
import { h } from '../dom';
import { gameData } from '../../data/load';
import type { StageDef } from '../../core/types';
import { HELPER_NPCS, helperRoster, stageAllowsHelper, type HelperNpcDef, type HelperOffer } from '../../progression/helpers';
import { bondDef, bondLevel, bondPoints, hasBondFrame, nextBondTier } from '../../progression/helper-bond';
import { ATTRIBUTE_NAMES } from '../art/palette';
import { userAsset } from '../assets';
import { audio } from '../audio';
import { badge, button, emptyState, listItem, panel } from '../components/basic';
import { closeBondStories, playBondStory } from '../bond-story';
import { cardThumb } from '../components/card-thumb';
import { chooseHelper, chosenHelper, offerToHelper, VIOLATION_TEXT } from '../sortie';
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
  const url = userAsset('ui', npc.id);
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
          offer.recommended && badge('推薦', 'gold'),
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

    const roster = rosterFor(stage);
    // 在助戰名單上看到的卡登錄為圖鑑「見過」
    // 畫面建好後才寫入存檔，不在 render 裡觸發狀態更新
    queueMicrotask(() => {
      const seen = markSeen(getSave(), roster.map((o) => o.card.id));
      if (seen !== getSave()) commit(seen);
    });
    const current = chosenHelper(stage.id);
    const done = (helper: ReturnType<typeof offerToHelper> | null) => {
      chooseHelper(stage.id, helper);
      // 從出戰確認過來就退回去；直接開網址時改成出戰確認，避免返回鍵又回到這裡
      if (route.query.from === 'prepare') nav.back();
      else nav.replace('prepare', [stage.id]);
    };
    const total = HELPER_NPCS.length;

    return h(
      'div',
      null,
      panel(
        null,
        h('div', { class: 'row between' }, h('strong', null, stage.name), h('span', { class: 'small-text dim' }, `契印師 ${roster.length} / ${total}`)),
        h('p', { class: 'small-text dim', style: { margin: '6px 0 0' } }, '助戰是副隊長：助戰卡的隊長技會和你的隊長技一起生效。名單每天輪替，推進主線會遇到更多契印師，他們帶的卡也會變強。借用契印師通關會累積情誼，到 5、10、20 點解鎖同行回憶。'),
        stage.recommendedArchetypes?.length
          ? h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '6px' } }, h('span', { class: 'small-text' }, '本關推薦'), stage.recommendedArchetypes.map((a) => badge(archetypeName(a), 'gold')))
          : null,
      ),
      roster.length
        ? h('div', { class: 'list' }, roster.map((o) => offerRow(o, current?.npcId === o.npc.id, () => done(offerToHelper(o)))))
        : emptyState('team', '目前沒有契印師可以同行'),
      button('不帶助戰', { variant: 'ghost', block: true, sound: 'back', onClick: () => done(null) }),
      bondMemories(onLeave),
    );
  },
};
