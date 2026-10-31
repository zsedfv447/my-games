// 誓約碑（提案 97）：出戰確認的入口與選擇對話框。規則在 progression/oaths.ts。
// 選擇只留在記憶體（同一關回到出戰確認時保留），出發時寫進入場券，中途續戰從存檔還原。
import type { StageDef } from '../core/types';
import { gameData } from '../data/load';
import {
  MAX_OATHS, OATHS, WEEKLY_GEM_CAP, oathCoreCard, oathPoints, oathRewardFor, oathsOf, type OathId,
} from '../progression/oaths';
import { badge, button, panel, toggle } from './components/basic';
import { openDialog } from './components/overlay';
import { h } from './dom';
import { getSave } from './state';

let chosen: { stageId: string; oaths: OathId[] } | null = null;

/** 這一關目前刻下的誓約（沒選就是空陣列） */
export function chosenOaths(stageId: string): OathId[] {
  return chosen?.stageId === stageId ? [...chosen.oaths] : [];
}

function rewardPreview(stage: StageDef, oaths: OathId[]): string {
  const points = oathPoints(oaths);
  if (!points) return '選 1～3 條誓約，通關後依點數拿額外獎勵（每週重置）。';
  const record = oathsOf(getSave(), Date.now());
  const prev = record.best[stage.id] ?? 0;
  if (points <= prev) return `本週這一關已拿過 ${prev} 點的獎勵，要更高點數才會再給。`;
  const now = oathRewardFor(points);
  const was = oathRewardFor(prev);
  const gems = Math.max(0, Math.min(now.gems - was.gems, WEEKLY_GEM_CAP - record.gems));
  const core = oathCoreCard(stage, gameData.enemies, gameData.cards);
  const coreName = core ? gameData.cards.find((c) => c.id === core)?.name : null;
  const parts = [`金幣 ${(now.coin - was.coin).toLocaleString()}`];
  if (now.cores - was.cores > 0 && coreName) parts.push(`${coreName} ×${now.cores - was.cores}`);
  if (gems > 0) parts.push(`星晶 ${gems}`);
  return `通關（不續戰）可得：${parts.join('、')}。本週星晶 ${record.gems}/${WEEKLY_GEM_CAP}。`;
}

/** 出戰確認上的誓約碑區塊；選完會呼叫 onChange 重畫出戰確認（隊伍可能因誓約改變） */
export function oathStelePanel(stage: StageDef, onChange: () => void): HTMLElement {
  const oaths = chosenOaths(stage.id);
  const highest = oathsOf(getSave(), Date.now()).highest;
  return panel({ title: '誓約碑' },
    h('p', { class: 'small-text dim', style: { margin: '0 0 6px' } }, '刻下誓約自我設限，通關可拿額外的金幣、星核與少量星晶。用了續戰誓約就會破除。'),
    oaths.length
      ? h('div', { class: 'row wrap' }, oaths.map((id) => badge(OATHS.find((o) => o.id === id)!.name, 'gold')), h('strong', { class: 'small-text' }, `${oathPoints(oaths)} 點`))
      : h('p', { class: 'small-text', style: { margin: '0' } }, `尚未刻下誓約${highest ? `・最高誓約 ${highest} 點` : ''}`),
    h('div', { class: 'row', style: { marginTop: '6px' } }, button(oaths.length ? '修改誓約' : '刻下誓約', { small: true, onClick: () => openOathPicker(stage, onChange) })),
  );
}

function openOathPicker(stage: StageDef, onChange: () => void): void {
  let picked = chosenOaths(stage.id);
  const summary = h('p', { class: 'small-text', style: { margin: '6px 0 0' } });
  const list = h('div', { class: 'list oath-list' });
  const render = () => {
    list.replaceChildren(...OATHS.map((o) => {
      const on = picked.includes(o.id);
      const row = toggle(`${o.name}（${o.points} 點）：${o.description}`, on, (v) => {
        picked = v ? [...picked, o.id] : picked.filter((x) => x !== o.id);
        render();
      });
      // 已選滿 3 條：其他的不能再勾
      const input = row.querySelector('input');
      if (input && !on && picked.length >= MAX_OATHS) input.disabled = true;
      return row;
    }));
    summary.textContent = `已選 ${picked.length}/${MAX_OATHS}・${oathPoints(picked)} 點。${rewardPreview(stage, picked)}`;
  };
  render();
  const dlg = openDialog('誓約碑', h('div', null, list, summary), [
    button('清除', { variant: 'ghost', small: true, onClick: () => { picked = []; render(); } }),
    button('確定', { variant: 'primary', onClick: () => { chosen = { stageId: stage.id, oaths: picked }; dlg.close(); onChange(); } }),
  ]);
}
