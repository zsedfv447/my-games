// 冒險地圖：主線章節、每日關卡、活動、挑戰之塔、流派試煉、練習場
import { h } from '../dom';
import { gameData } from '../../data/load';
import { RACE_NAMES } from '../art/palette';
import { badge, bar, button, icon, listItem, sectionTitle } from '../components/basic';
import { openDialog } from '../components/overlay';
import { LABEL } from '../wording';
import { adventureDots, type AdventureDots } from '../adventure-badges';
import { eclipseRewardStatus, eclipseUnlocked } from '../../progression/eclipse';
import { OATHS, WEEKLY_GEM_CAP, oathsOf } from '../../progression/oaths';
import type { StageContext } from '../../progression/stages';
import type { ChapterDef, SaveData } from '../../core/types';
import { chapterProgress, nextMainStage, sideStoryProgress, stageContext, type ChapterProgress } from '../stage-nav';
import { getSave } from '../state';
import { userAsset } from '../assets';
import { eventStatusText } from '../../progression/events';
import { nemesisLock, nemesisView } from '../nemesis';
import { expeditionTileSub } from './expedition';
import { puzzleEntrySub } from './puzzle';
import { openPracticePicker } from '../practice-picker';
import type { Navigator, ScreenDef } from '../router';
import type { IconName } from '../art/icons';
import { audio } from '../audio';
import { openLimitedEvents } from '../event-order';
import '../flow-polish.css';
import { ABYSS_FLOORS, ABYSS_UNLOCK_STAGE, abyssProgress, isAbyssOpen } from '../../progression/abyss';

/** 冒險頁「其他」區的小卡（兩欄）；新增入口時用同一個格式 */
export interface AdventureTile {
  icon: IconName;
  title: string;
  sub: string;
  to: [string, string[]];
  /** 右上角標籤，例如 NEW */
  badge?: string;
  /** 右上角紅點（今天還沒做、限時活動開放中） */
  dot?: boolean;
  /** 還沒開放：變灰，sub 寫開放條件 */
  locked?: boolean;
  /** 點了不直接換頁、改做別的事（例如練習場先選模式） */
  onClick?: (nav: Navigator) => void;
}

export function adventureTile(t: AdventureTile, nav: Navigator): HTMLElement {
  return h('button', { type: 'button', class: ['adv-tile', t.locked && 'locked'], onClick: () => { audio.play('tap'); if (t.onClick) t.onClick(nav); else nav.go(t.to[0], t.to[1]); } },
    h('span', { class: 'adv-tile-icon' }, icon(t.icon)),
    h('strong', null, t.title),
    h('span', { class: 'adv-tile-sub' }, t.sub),
    t.badge && badge(t.badge, 'gold adv-tile-badge'),
    t.dot && !t.badge && h('span', { class: 'badge dot', 'aria-label': '有新內容' }));
}

export const adventureScreen: ScreenDef = {
  name: 'adventure',
  title: '冒險',
  chrome: 'full',
  tab: 'adventure',
  parent: 'home',
  render({ nav }) {
    const save = getSave();
    const now = Date.now();
    const ctx = stageContext(gameData.stages, gameData.events);
    const next = nextMainStage(save, ctx, now);
    const side = sideStoryProgress(save, ctx, now);
    const trialsOpen = gameData.stages.filter((s) => s.kind === 'trial' && (!s.unlockAfter || save.progress.clearedStages.includes(s.unlockAfter))).length;
    const chapters = gameData.chapters.map((c) => ({ c, p: chapterProgress(save, c.chapter, ctx, now, c.stageCount) }));
    const unlockedChapters = chapters.filter((x) => x.p.unlocked);
    const lockedChapters = chapters.filter((x) => !x.p.unlocked).map((x) => x.c);
    const limited = openLimitedEvents(gameData.events, now)[0];
    // 紅點只算一次（ui/adventure-badges.ts），底部導覽的「冒險」分頁也讀同一份
    const dots = adventureDots(save, now);
    const nemesis = nemesisTile(save, ctx, now);
    // 終局內容集中在一區：主線通關（星淵開放）後放在章節列表上方，之前放在最下面
    const endgameOpen = isAbyssOpen(save);
    const endgameTiles: AdventureTile[] = [
      abyssTile(save, now, dots),
      eclipseTile(save, dots),
      ...(nemesis ? [nemesis] : []),
      oathTile(save, now),
      { icon: 'constellation', title: '星靈遠行', to: ['expedition', []], ...expeditionTileSub(now) },
    ];
    // 小卡的順序：每天會用的在前；新入口照同樣格式加進陣列
    const otherTiles: AdventureTile[] = [
      { icon: 'history', title: '每日關卡', sub: '素材、進化素材、金幣關', to: ['stages', ['daily']] },
      { icon: 'event', title: '活動', sub: limited ? `${limited.name}・${eventStatusText(limited, now)}` : '活動 Boss 與兌換商店', to: ['stages', ['event']], dot: dots.event },
      { icon: 'puzzle', title: '星紋謎題', sub: puzzleEntrySub(now), to: ['puzzle', []], dot: dots.puzzle },
      { icon: 'tower', title: '挑戰之塔', sub: `不耗體力・第 ${save.progress.towerFloor} 層`, to: ['stages', ['tower']] },
      {
        icon: 'scroll', title: '外傳・灰燈港夜話',
        sub: side.open ? `劇情小章・通關 ${side.cleared}/${side.total}` : side.lock,
        to: ['stages', ['side']], badge: side.open && side.cleared < side.total ? 'NEW' : undefined,
      },
      { icon: 'constellation', title: '流派試煉', sub: `借現成隊伍體驗流派・已開放 ${trialsOpen} 關`, to: ['archetypes', []] },
      // 先選模式（一般／隱藏珠／星紋封印／百分比追打），每種附一句說明
      { icon: 'sword', title: '練習場', sub: '練轉珠與敵人機制，不耗體力', to: ['battle', ['practice']], onClick: openPracticePicker },
    ];
    const endgame = [sectionTitle('終局'), h('div', { class: 'adv-tiles' }, endgameTiles.map((t) => adventureTile(t, nav)))];
    // 全部通關而且滿星的章節收成一列，點開才展開
    const done = unlockedChapters.filter(({ p }) => p.cleared >= p.total && p.stars >= p.maxStars);
    const active = unlockedChapters.filter((x) => !done.includes(x));
    const list = h('div', { class: 'list' });
    const drawChapters = () => list.replaceChildren(...[
      done.length > 0 && completedChaptersRow(done, dots, () => { showCompleted = !showCompleted; drawChapters(); }),
      ...(showCompleted ? done : []).map((x) => chapterCard(x, dots, nav)),
      ...active.map((x) => chapterCard(x, dots, nav)),
      // 還沒開放的章節合成一列，不再各佔一整張卡
      lockedChapters.length > 0 && h('div', { class: 'chapter-locked-row' }, icon('lock'),
        h('div', null,
          h('strong', null, lockedChapters.length === 1 ? `第 ${lockedChapters[0].chapter} 章・${lockedChapters[0].name}` : `第 ${lockedChapters[0].chapter}～${lockedChapters.at(-1)!.chapter} 章`),
          h('div', { class: 'small-text faint' }, '通過上一章後開放'))),
    ].filter((x): x is HTMLElement => !!x));
    drawChapters();

    return h(
      'div',
      null,
      next && listItem({
        leading: icon('sword'),
        title: `繼續主線：${next.name}`,
        sub: `第 ${next.chapter} 章・體力 ${next.stamina}`,
        onClick: () => nav.go('prepare', [next.id]),
      }),
      endgameOpen && endgame,
      sectionTitle('主線'),
      list,
      sectionTitle('其他'),
      h('div', { class: 'adv-tiles' }, otherTiles.map((t) => adventureTile(t, nav))),
      !endgameOpen && endgame,
    );
  },
};

type ChapterEntry = { c: ChapterDef; p: ChapterProgress };

/** 已通關（滿星）章節要不要展開；只記在這次遊戲階段 */
let showCompleted = false;

function chapterCard({ c, p }: ChapterEntry, dots: AdventureDots, nav: Navigator): HTMLElement {
  return h(
    'button',
    { type: 'button', class: 'chapter-card', onClick: () => nav.go('stages', [c.chapter]) },
    userAsset('backgrounds', `chapter-${c.chapter}`) && h('img', { class: 'chapter-art', src: userAsset('backgrounds', `chapter-${c.chapter}`), alt: '', loading: 'lazy' }),
    h('div', { class: 'row between' },
      h('div', null, h('div', { class: 'chapter-no' }, `第 ${c.chapter} 章`), h('div', { class: 'chapter-name' }, c.name)),
      h('div', { class: 'row', style: { gap: '4px' } }, badge(c.constellation, 'gold'), badge(RACE_NAMES[c.race]))),
    h('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } },
      h('div', { style: { flex: '1' } }, bar({ value: p.cleared, max: p.total, variant: 'gold', label: `通關 ${p.cleared}/${p.total}` })),
      h('span', { class: 'stars small-text' }, `★ ${p.stars}/${p.maxStars}`)),
    (dots.chapters.includes(c.chapter) || dots.eclipse.includes(c.chapter)) && h('span', { class: 'badge dot', 'aria-label': '有可領取的章節或星蝕獎勵' }),
  );
}

/** 「第 1～N 章（已通關）」：點了展開／收起；收起時裡面有可領的獎勵也會亮紅點 */
function completedChaptersRow(done: ChapterEntry[], dots: AdventureDots, toggle: () => void): HTMLElement {
  const nums = done.map((x) => x.c.chapter);
  const contiguous = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  const label = nums.length === 1 ? `第 ${nums[0]} 章` : contiguous ? `第 ${nums[0]}～${nums.at(-1)} 章` : `${nums.length} 個章節`;
  const stars = done.reduce((n, x) => n + x.p.stars, 0);
  const max = done.reduce((n, x) => n + x.p.maxStars, 0);
  const eclipseDone = done.filter((x) => eclipseRewardStatus(getSave(), x.c.chapter, gameData.stages) === 'claimed').length;
  const dot = done.some((x) => dots.chapters.includes(x.c.chapter) || dots.eclipse.includes(x.c.chapter));
  return h('button', { type: 'button', class: ['chapter-done-row', showCompleted && 'open'], 'aria-expanded': String(showCompleted), onClick: () => { audio.play('tap'); toggle(); } },
    h('div', { class: 'grow' },
      h('strong', null, `${label}（已通關）`),
      h('div', { class: 'small-text dim' }, `全通・★ ${stars}/${max}・星蝕獎勵 ${eclipseDone}/${done.length} 章`)),
    h('span', { class: 'chev' }, showCompleted ? '收起' : '展開'),
    dot && h('span', { class: 'badge dot', 'aria-label': '有可領取的章節或星蝕獎勵' }));
}

/** 終局區的星蝕小卡：前往第一個還沒拿到星蝕獎勵的已開放章節 */
function eclipseTile(save: SaveData, dots: AdventureDots): AdventureTile {
  const open = gameData.chapters.filter((c) => eclipseUnlocked(save, c.chapter, gameData.stages, gameData.chapters));
  if (!open.length) return { icon: 'event', title: '星蝕', sub: '集滿任一章全部星章後開放', to: ['adventure', []], locked: true };
  const claimed = open.filter((c) => eclipseRewardStatus(save, c.chapter, gameData.stages) === 'claimed');
  const target = open.find((c) => dots.eclipse.includes(c.chapter)) ?? open.find((c) => !claimed.includes(c)) ?? open[0];
  return { icon: 'event', title: '星蝕', sub: `高難度章節・獎勵 ${claimed.length}/${open.length} 章`, to: ['stages', [String(target.chapter), 'eclipse']], dot: dots.eclipse.length > 0 };
}

/** 終局區的誓約碑小卡：說明怎麼用（誓約要在出戰確認刻下），顯示本週星晶進度 */
function oathTile(save: SaveData, now: number): AdventureTile {
  const record = oathsOf(save, now);
  return {
    icon: 'quest', title: '誓約碑', sub: `在出戰確認刻下・本週星晶 ${record.gems}/${WEEKLY_GEM_CAP}`, to: ['adventure', []],
    onClick: () => {
      const dlg = openDialog('誓約碑',
        h('div', { class: 'small-text' },
          h('p', null, '在任何主線關卡的「出戰確認」頁最下方刻下 1～3 條誓約，自我設限挑戰；通關（不續戰）可拿額外的金幣、星核與少量星晶。'),
          h('p', null, `點數越高獎勵越多，每週重置；本週星晶 ${record.gems}/${WEEKLY_GEM_CAP}${record.highest ? `，最高誓約 ${record.highest} 點` : ''}。`),
          h('ul', { style: { paddingLeft: '18px', margin: '6px 0 0' } }, OATHS.map((o) => h('li', null, `${o.name}（${o.points} 點）：${o.description}`)))),
        [button(LABEL.close, { variant: 'primary', sound: 'back', onClick: () => dlg.close() })]);
    },
  };
}

/** 終局區的星淵回廊小卡：每週重置的 30 層塔，主線通關後開放 */
function abyssTile(save: SaveData, now: number, dots: AdventureDots): AdventureTile {
  if (!isAbyssOpen(save)) {
    const name = gameData.stages.find((s) => s.id === ABYSS_UNLOCK_STAGE)?.name ?? ABYSS_UNLOCK_STAGE;
    return { icon: 'tower', title: '星淵回廊', sub: `通過「${name}」後開放`, to: ['abyss', []], locked: true };
  }
  const p = abyssProgress(save, now);
  const sub = p.best > ABYSS_FLOORS ? `本週已登頂・無盡 ${p.best} 層` : `每週重置・本週 ${p.best}/${ABYSS_FLOORS} 層`;
  return { icon: 'tower', title: '星淵回廊', sub, to: ['abyss', []], dot: dots.abyss };
}

/** 終局區的流派克星週小卡：本週主題、剩餘時間、推薦流派；還沒開放時寫開放條件並變灰 */
function nemesisTile(save: SaveData, ctx: StageContext, now: number): AdventureTile | null {
  const week = nemesisView(gameData.events, gameData.stages, (id) => gameData.archetypes.find((a) => a.id === id)?.name ?? id, now);
  if (!week) return null;
  const lock = nemesisLock(save, week, ctx, now);
  return {
    icon: 'trophy',
    title: `克星週・${week.event.name.replace(/^流派克星週・/, '')}`,
    sub: lock || `${week.status}・推薦 ${week.archetypes.join('、')}`,
    to: ['stages', ['nemesis']],
    locked: !!lock,
  };
}
