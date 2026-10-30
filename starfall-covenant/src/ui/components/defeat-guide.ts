// 失敗引導視窗：放棄或撤退後顯示打到第幾波與建議（強化、換隊、借助戰、敵人對策），附捷徑
import { h } from '../dom';
import { gameData } from '../../data/load';
import type { StageDef } from '../../core/types';
import { analyzeTeam } from '../../growth';
import { stageAllowsHelper } from '../../progression/helpers';
import { defeatAdvice, waveProgressText, type Advice } from '../defeat-advice';
import { stageIntel } from '../stage-intel';
import { getSave, growth } from '../state';
import type { Navigator } from '../router';
import { button } from './basic';
import { openDialog } from './overlay';
import '../convenience.css';

const ICON: Record<Advice['kind'], string> = { enhance: '強', team: '隊', helper: '助', tip: '！' };

export function showDefeatGuide(stage: StageDef, progress: { wave: number; waveCount: number; hasHelper: boolean }, nav: Navigator): void {
  const save = getSave();
  const team = save.teams[save.activeTeam];
  const uids = stage.fixedTeam ? [] : (team?.members ?? []).filter((u): u is string => !!u);
  const members = uids.flatMap((uid) => {
    const c = save.inventory.cards.find((x) => x.uid === uid);
    const card = c && growth.card(c.cardId);
    return c && card ? [{ uid, card, level: c.level }] : [];
  });
  const advice = defeatAdvice({
    stage,
    intel: stageIntel(stage, gameData.enemies, gameData.config.battle),
    members,
    hasHelper: progress.hasHelper,
    helperAllowed: stageAllowsHelper(stage),
    primaryArchetype: members.length ? analyzeTeam(save, growth, team.members).primary : null,
    archetypeName: (id) => gameData.archetypes.find((a) => a.id === id)?.name ?? id,
  });
  const go = (a: Advice) => {
    dlg.close();
    // 取代戰鬥頁：從捷徑畫面按返回會回到出戰確認
    nav.replace(a.go!.screen, a.go!.args, a.go!.screen === 'helper' ? { from: 'prepare' } : {});
  };
  const dlg = openDialog('挑戰失敗', h('div', { class: 'defeat-guide' },
    h('p', { class: 'small-text dim', style: { margin: '0 0 8px' } }, `${stage.name}・${waveProgressText(progress.wave, progress.waveCount)}`),
    h('div', { class: 'list' }, advice.map((a) => h('div', { class: `defeat-advice ${a.kind}` },
      h('span', { class: 'defeat-advice-icon', 'aria-hidden': 'true' }, ICON[a.kind]),
      h('p', { class: 'grow small-text' }, a.text),
      a.go && button(a.go.label, { small: true, onClick: () => go(a) }))))), [
    button('返回', { variant: 'primary', sound: 'back', onClick: () => { dlg.close(); nav.back(); } }),
  ], { dismissible: false });
}
