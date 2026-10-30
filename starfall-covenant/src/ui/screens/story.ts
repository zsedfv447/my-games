// 劇情對話（GDD 4：每章開頭與 Boss 前各一段）。劇情腳本由創意顧問提供，現在先放序章示範。
import { h, svg } from '../dom';
import { starfieldSvg } from '../art/scenery';
import { userAsset } from '../assets';
import { storyBox, type StoryLine } from '../components/story';
import type { ScreenDef } from '../router';

const PROLOGUE: StoryLine[] = [
  { text: '很久以前，天穹上的七曜星座在一場無人記得的戰爭中碎裂。' },
  { text: '碎片如雨墜落大地，化為帶有意志的「星骸」。' },
  { speaker: '？？？', text: '……聽得見嗎？讀得懂星紋的人。' },
  { speaker: '？？？', text: '握住那顆珠子。從今天起，你就是契印師了。' },
];

export const storyScreen: ScreenDef = {
  name: 'story',
  title: '劇情',
  chrome: 'bare',
  parent: 'home',
  render({ nav }) {
    const bg = userAsset('backgrounds', 'story') ?? userAsset('backgrounds', 'title');
    return h(
      'div',
      { style: { background: 'radial-gradient(80% 50% at 50% 35%, #2a3a85, #060a1f)' } },
      bg ? h('img', { src: bg, alt: '', style: { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover' } }) : svg(starfieldSvg()),
      h('button', { type: 'button', class: 'btn small ghost', style: { position: 'absolute', right: '12px', top: 'calc(12px + var(--safe-top, 0px))' }, onClick: () => nav.back() }, '略過'),
      storyBox(PROLOGUE, () => nav.back()),
    );
  },
};
