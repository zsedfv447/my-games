// 教學控制器：每次換畫面或教學進度改變時，依 flow.guideFor 決定要不要顯示引路人、指向哪個按鈕。
// 教學戰鬥本身的引導在 battle-guide.ts。
import { bus } from '../../core/events';
import { gameData } from '../../data/load';
import { pullCost } from '../../progression/gacha';
import { confirmDialog, toast } from '../components/overlay';
import type { Navigator, Route, ScreenDef } from '../router';
import { commit, getSave, onStateChange } from '../state';
import { FIRST_STAGE, advanceTutorial, grantSummonGift, guideFor, skipTutorial, tutorialStep, type GuideAction } from './flow';
import { GuideLayer } from './guide-ui';

export interface TutorialController {
  onRoute(screen: ScreenDef, el: HTMLElement, route: Route): void;
}

export function installTutorial(stage: HTMLElement, nav: Navigator): TutorialController {
  const layer = new GuideLayer(stage);
  let route: Route | null = null;
  let screenEl: HTMLElement | null = null;
  let shownKey = '';

  const run = (a: GuideAction) => {
    if (a.advance) commit(advanceTutorial(getSave(), tutorialStep(getSave())));
    if (a.go) nav.go(a.go[0], a.go[1]);
  };

  const askSkip = async () => {
    if (!(await confirmDialog('略過教學', '之後可以在「設定」重看新手教學。確定要略過嗎？', '略過'))) return;
    commit(skipTutorial(getSave()));
    toast('已略過新手教學');
  };

  const refresh = () => {
    if (!route) return;
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
        commit(gift.save);
        toast(`薇菈送你 ${gift.granted} 星晶`);
        return;
      }
    }
    const key = `${step}|${route.name}|${route.args.join('/')}`;
    if (key === shownKey) return;
    shownKey = key;
    layer.clear();
    const spec = guideFor(step, route);
    if (!spec) return;
    const actions = [spec.secondary, spec.action].filter((a): a is GuideAction => !!a).map((a) => ({
      label: a.label,
      variant: a === spec.secondary ? ('ghost' as const) : ('primary' as const),
      onClick: () => run(a),
    }));
    layer.say({ lines: spec.lines, placement: 'bottom', actions, onSkip: () => void askSkip() });
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
