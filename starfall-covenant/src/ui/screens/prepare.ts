// 出戰確認：關卡情報、推薦流派、隊伍限制或借用隊伍、星章條件，確認後扣體力進入戰鬥
import { h, svg } from '../dom';
import { gameData } from '../../data/load';
import type { Attribute, EnemyDef, StageDef, StarCondition } from '../../core/types';
import { enterStage } from '../../progression/stages';
import { badge, button, emptyState, panel } from '../components/basic';
import { cardThumb, emptySlot } from '../components/card-thumb';
import { toast } from '../components/overlay';
import { stageContext } from '../stage-nav';
import { buildSortieTeam, chosenHelper, describeTeamRule, ensureHelper, sortieProblem, VIOLATION_TEXT } from '../sortie';
import { commit, getSave, growth } from '../state';
import { armBattle } from './battle';
import { confirmNewBattle } from '../battle-session';
import { npcAvatar, rosterFor } from './helper';
import { HELPER_NPCS, stageAllowsHelper } from '../../progression/helpers';
import type { ScreenDef } from '../router';
import { stageRewardPanel } from '../components/reward-reveal';
import { enemySvg } from '../art/enemy';
import { ATTRIBUTE_NAMES, ORB_COLORS } from '../art/palette';
import { resolveArtPath, userAsset } from '../assets';
import { stageIntel } from '../stage-intel';
import { recordsOf } from '../../progression/records';
import '../convenience.css';

const KIND_LABEL: Record<StageDef['kind'], string> = { main: '主線', daily: '每日', event: '活動', tower: '挑戰之塔', trial: '流派試煉' };

const ENTER_ERRORS: Record<string, string> = {
  locked: '還沒解鎖這一關',
  wrongDay: '這一關今天沒有開放',
  eventClosed: '活動目前沒有開放',
  unknownStage: '找不到這一關',
  inventoryFull: '背包滿了，先整理卡片再出發',
  notEnoughStamina: '體力不足',
  ...VIOLATION_TEXT,
};

const archetypeName = (id: string) => gameData.archetypes.find((a) => a.id === id)?.name ?? id;
const cardName = (id: string) => growth.card(id)?.name ?? id;

export function starText(c: StarCondition): string {
  switch (c.type) {
    case 'clearWithinTurns': return `${c.turns} 回合內通關`;
    case 'noActiveSkill': return '不使用主動技';
    case 'teamAll': return `全隊皆為${describeTeamRule({ filter: c.filter }, archetypeName, cardName)[0]?.replace('全隊必須是', '') ?? ''}`;
    case 'maxCombo': return `單回合達成 ${c.combo} Combo`;
    case 'noContinue': return '不續戰';
  }
}

function attrChip(a: Attribute): HTMLElement {
  return h('span', { class: 'attr-chip', style: { '--attr': ORB_COLORS[a].base } }, ATTRIBUTE_NAMES[a]);
}

function enemyPortrait(e: EnemyDef, boss: boolean): Element {
  const url = userAsset('enemies', e.id) ?? resolveArtPath(e.art.sprite);
  return url ? h('img', { src: url, alt: '', loading: 'lazy' }) : svg(enemySvg({ ...e, boss }));
}

/** 關卡情報：每一波的敵人頭像、屬性、能力，Boss 加框；最上面是建議帶的屬性 */
function intelPanel(stage: StageDef): HTMLElement {
  const intel = stageIntel(stage, gameData.enemies, gameData.config.battle);
  return panel(
    { title: '敵人情報' },
    intel.suggested.length > 0 && h('div', { class: 'row wrap intel-suggest' }, h('span', { class: 'small-text' }, '建議屬性'), intel.suggested.map(attrChip)),
    h('div', { class: 'intel-waves' }, intel.waves.map((w, i) => h('div', { class: `intel-wave${w.boss ? ' boss' : ''}` },
      h('div', { class: 'intel-wave-title small-text' }, `第 ${i + 1} 波`, w.boss && badge('BOSS', 'gold')),
      w.enemies.map((e) => h('div', { class: 'intel-enemy' },
        h('div', { class: 'intel-portrait' }, enemyPortrait(e.def, w.boss)),
        h('div', { class: 'grow' },
          h('div', { class: 'row small-text', style: { gap: '6px' } }, h('strong', null, e.def.name), attrChip(e.def.attribute)),
          e.abilities.length
            ? h('div', { class: 'intel-abilities' }, e.abilities.map((a) => h('span', { class: 'chip enemy' }, a)))
            : h('div', { class: 'small-text dim' }, '沒有特殊能力'))))))),
  );
}

export const prepareScreen: ScreenDef = {
  name: 'prepare',
  title: '出戰確認',
  chrome: 'sub',
  parent: 'adventure',
  render({ route, nav }) {
    const stage = gameData.stages.find((s) => s.id === route.args[0]);
    if (!stage) return h('div', null, emptyState('adventure', '找不到這一關'));

    const save = getSave();
    const helperAllowed = stageAllowsHelper(stage);
    if (helperAllowed) ensureHelper(stage.id, rosterFor(stage));
    const team = buildSortieTeam(stage, save, growth.card);
    const pickHelper = () => nav.go('helper', [stage.id], { from: 'prepare' });
    const npc = !team.borrowed && team.helperCard ? HELPER_NPCS.find((n) => n.id === chosenHelper(stage.id)?.npcId) : undefined;
    const helperLeader = team.helperCard?.leaderSkill ? growth.leaderSkill(team.helperCard.leaderSkill) : undefined;
    const problem = sortieProblem(stage, team);
    const rules = describeTeamRule(stage.teamRule, archetypeName, cardName);
    const gotStars = save.progress.stars[stage.id] ?? [];
    const fastest = recordsOf(save).fastestTurns[stage.id];

    const start = async () => {
      // 已有進行中的戰鬥：同一關可以直接回去繼續，別關要先確認放棄（記失敗）才出發
      const check = await confirmNewBattle(stage.id);
      if (check === 'resume') return nav.go('battle', [stage.id]);
      if (check === 'cancel') return;
      const now = Date.now();
      const entered = enterStage(getSave(), stage, stageContext(gameData.stages, gameData.events), gameData.config, now,
        team.borrowed ? undefined : { members: team.cards, helper: team.helperCard });
      if (!entered.ok) return toast(ENTER_ERRORS[entered.reason] ?? entered.reason);
      commit(entered.save);
      armBattle(stage.id);
      // 第一次挑戰時先播關卡開場劇情，播完直接進戰鬥
      const before = stage.story?.before;
      if (before && gameData.story[before] && !getSave().progress.storySeen.includes(before)) nav.go('story', [before], { next: `battle/${stage.id}` });
      else nav.go('battle', [stage.id]);
    };

    return h(
      'div',
      null,
      panel(
        { gold: true },
        h('div', { class: 'row between' }, h('h2', { style: { margin: '0' } }, stage.name), badge(KIND_LABEL[stage.kind], 'gold')),
        h('p', { class: 'small-text dim', style: { marginTop: '6px' } }, `${stage.waves.length} 波敵人・消耗體力 ${stage.stamina}`, fastest ? `・最快 ${fastest} 回合通關` : ''),
        stage.recommendedArchetypes?.length
          ? h('div', { class: 'row wrap', style: { gap: '4px' } }, h('span', { class: 'small-text' }, '推薦流派'), stage.recommendedArchetypes.map((a) => badge(archetypeName(a))))
          : null,
      ),
      intelPanel(stage),
      stage.kind === 'trial' && stage.archetype && panel(
        { title: `試煉：${archetypeName(stage.archetype)}` },
        h('p', { class: 'small-text' }, gameData.archetypes.find((a) => a.id === stage.archetype)?.howToPlay ?? ''),
      ),
      panel(
        { title: team.borrowed ? '借用隊伍' : `出戰隊伍・${save.teams[save.activeTeam]?.name ?? ''}` },
        team.borrowed && h('p', { class: 'small-text dim' }, '這一關由關卡提供隊伍，不需要擁有這些卡片。'),
        h(
          'div',
          { class: 'grid-5', style: { gridTemplateColumns: 'repeat(6, 1fr)' } },
          [0, 1, 2, 3, 4].map((i) => {
            const m = team.members[i];
            const def = m && growth.card(m.cardId);
            return def ? cardThumb(def, { level: m.level, size: 52 }) : emptySlot(team.borrowed ? undefined : () => nav.go('team'), 52);
          }),
          team.helperCard
            ? cardThumb(team.helperCard, { level: team.helper!.level, size: 52, onClick: helperAllowed ? pickHelper : undefined })
            : h('button', { type: 'button', class: 'card-thumb empty', style: { '--thumb': '52px' }, 'aria-label': '選擇助戰', disabled: !helperAllowed, onClick: helperAllowed ? pickHelper : undefined }, '助'),
        ),
        !team.borrowed && button('編成隊伍', { small: true, icon: 'team', onClick: () => nav.go('team') }),
      ),
      (helperAllowed || team.helperCard) && panel(
        { title: team.borrowed ? '借用助戰' : '助戰' },
        team.helperCard
          ? h('div', { class: 'row', style: { alignItems: 'flex-start' } },
            npc ? npcAvatar(npc, 44) : null,
            h('div', { class: 'grow' },
              h('div', { class: 'small-text' }, npc ? `${npc.name}・${team.helperCard.name}` : team.helperCard.name),
              helperLeader && h('div', { class: 'small-text dim' }, h('strong', { class: 'gold-text' }, `隊長技・${helperLeader.name}　`), helperLeader.description)))
          : h('p', { class: 'small-text dim', style: { margin: '0' } }, '沒有帶助戰。助戰卡的隊長技會和你的隊長技一起生效。'),
        helperAllowed && button(team.helperCard ? '更換助戰' : '選擇助戰', { small: true, icon: 'team', onClick: pickHelper }),
      ),
      rules.length > 0 && panel(
        { title: '隊伍限制' },
        h('ul', { class: 'small-text', style: { margin: '0', paddingLeft: '20px' } }, rules.map((r) => h('li', null, r))),
      ),
      (stage.stars?.length ?? 0) > 0 && panel(
        { title: '星章挑戰' },
        h('div', { class: 'list' }, stage.stars!.map((c, i) => h('div', { class: 'row small-text' }, h('span', { class: 'stars', style: { opacity: gotStars[i] ? '1' : '0.3' } }, '★'), starText(c)))),
      ),
      stageRewardPanel(stage, save.progress.clearedStages.includes(stage.id)),
      problem && h('p', { class: 'small-text', style: { color: 'var(--danger)', textAlign: 'center', margin: '0' } }, VIOLATION_TEXT[problem]),
      // data-tut：新手教學用來指向出發鈕
      h('div', { 'data-tut': 'sortie' }, button('出發', { variant: 'primary', block: true, icon: 'sword', disabled: !!problem, cost: { kind: 'stamina', amount: stage.stamina }, onClick: start })),
    );
  },
};
