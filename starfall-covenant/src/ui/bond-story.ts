// 羈絆回憶的重播層（流浪契印師情誼、角色羈絆小劇場共用）：用既有的劇情對話框，掛在舞台上，離開畫面時收掉
import type { StoryLine } from '../core/types';
import { overlayRoot } from './components/overlay';
import { storyBox } from './components/story';
import { h } from './dom';
import './collection-helper.css';

export function playBondStory(lines: StoryLine[]): void {
  const layer = h('div', { class: 'story-layer bond-story-layer' });
  layer.appendChild(storyBox(lines, () => layer.remove()));
  overlayRoot().appendChild(layer);
}

/** 畫面的 onLeave 呼叫，避免回憶層留在下一個畫面上 */
export function closeBondStories(): void {
  overlayRoot().querySelectorAll('.bond-story-layer').forEach((el) => el.remove());
}
