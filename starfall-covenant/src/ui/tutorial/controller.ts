// 教學控制器：每次換畫面或教學進度改變時，依 flow.guideFor 決定要不要顯示引路人、指向哪個按鈕。
// 教學戰鬥本身的引導在 battle-guide.ts。
import { bus } from '../../core/events';
import { gameData } from '../../data/load';
import { pullCost } from '../../progression/gacha';
import { analyzeTeam } from '../../growth';
import { confirmDialog, toast } from '../components/overlay';
import { revealReward } from '../components/reward-reveal';
import type { Navigator, Route, ScreenDef } from '../router';
import { commit, getSave, growth, onStateChange } from '../state';
import { FIRST_STAGE, advanceTutorial, grantSummonGift, guideFor, tutorialStep, type GuideAction, type TeamFitHint } from './flow';
import { GuideLayer } from './guide-ui';
import { skipTutorialNow } from './skip';

export interface TutorialController {
  onRoute(screen: ScreenDef, el: HTMLElement, route: Route): void;
}

/** 目前隊伍的流派分析結果（和編隊畫面的紅框同一份計算） */
function teamFitHint(): TeamFitHint {
  const save = getSave();
  const misfits = analyzeTeam(save, growth, save.teams[save.activeTeam].members).members.filter((m) => !m.fits);
  return { misfits: misfits.length, reason: misfits[0]?.reasons[0] };
}

export function installTutorial(stage: HTMLElement, nav: Navigator): TutorialController {
  const layer = new GuideLayer(stage, 'tut-app');
  let route: Route | null = null;
  let screenEl: HTMLElement | null = null;
  let shownKey = '';
  /** 領獎演出播放中，先不疊引導 */
  let revealing = false;

  const run = (a: GuideAction, target?: string) => {
    if (a.advance) commit(advanceTutorial(getSave(), tutorialStep(getSave())));
    if (a.go) nav.go(a.go[0], a.go[1]);
    // 和玩家自己按一樣走原本的流程（確認視窗、扣星晶、召喚演出）
    if (a.press && target) screenEl?.querySelector<HTMLElement>(target)?.click();
  };

  const askSkip = async () => {
    if (!(await confirmDialog('略過教學', '之後可以在「設定」重看新手教學。確定要略過嗎？', '略過'))) return;
    toast('已略過新手教學');
    await skipTutorialNow();
  };

  const refresh = () => {
    if (!route || revealing) return;
    const step = tutorialStep(getSave());
    // 走進第一章第一關的戰鬥，教學就完成了
    if (step === 'stage' && route.name === 'battle' && route.args[0] === FIRST_STAGE) {
      commit(advanceTutorial(getSave(), 'stage'));
      toast('新手教學完成！祝你旅途順利');
      return;
    }
    // 召喚贈禮在打開召喚畫面時才送，玩家看得到星晶增加
    if (step === 'summon' && route.name === 'summon') {
      const pool = gameData.gachaPools[0];
      const gift = grantSummonGift(getSave(), pool ? pullCost(pool, 1) : 0);
      if (gift.granted) {
        // 和登入、任務獎勵同一套領獎演出；收下後才出現召喚引導
        revealing = true;
        layer.clear();
        commit(gift.save);
        void revealReward('見面禮', { gems: gift.granted }, '引路人薇菈送你一次單抽的星晶').then(() => {
          revealing = false;
          shownKey = '';
          refresh();
        });
        return;
      }
    }
    const key = `${step}|${route.name}|${route.args.join('/')}`;
    if (key === shownKey) return;
    shownKey = key;
    layer.clear();
    const spec = guideFor(step, route, step === 'team' && route.name === 'team' ? teamFitHint() : undefined);
    if (!spec) return;
    const actions = [spec.secondary, spec.action].filter((a): a is GuideAction => !!a).map((a) => ({
      label: a.label,
      variant: a === spec.secondary ? ('ghost' as const) : ('primary' as const),
      onClick: () => run(a, spec.target),
    }));
    layer.say({ lines: spec.lines, placement: spec.placement ?? 'bottom', actions, onSkip: () => void askSkip() });
    if (spec.target) {
      const host = screenEl;
      layer.pointAt(() => host?.querySelector(spec.target!));
    }
  };

  onStateChange(refresh);
  bus.on('gachaPulled', () => commit(advanceTutorial(getSave(), 'summon')));

  return {
    onRoute(_screen, el, r) {
      route = r;
      screenEl = el;
      shownKey = '';
      refresh();
    },
  };
}
