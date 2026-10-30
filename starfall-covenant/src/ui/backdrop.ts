// 場景背景接線：關卡 → 場景，使用者圖片優先，沒有才用程式產生的 SVG（style-guide 第 6 節）
import type { StageDef } from '../core/types';
import { h, svg } from './dom';
import { sceneSvg, type SceneId } from './art/scenes';
import { userAsset } from './assets';

export type { SceneId } from './art/scenes';

/** 每日關卡依屬性借用章節場景 */
const DAILY_SCENE: Record<string, SceneId> = {
  fire: 'chapter-4',
  water: 'home',
  wood: 'chapter-3',
  light: 'tower',
  dark: 'chapter-5',
};

export function sceneForStage(stage: Pick<StageDef, 'id' | 'kind' | 'chapter'>): SceneId {
  switch (stage.kind) {
    case 'main':
      return `chapter-${Math.min(5, Math.max(1, stage.chapter ?? 1))}` as SceneId;
    case 'event':
      return 'event';
    case 'tower':
    case 'trial':
      return 'tower';
    case 'daily':
      return DAILY_SCENE[/^dl-([a-z]+)-/.exec(stage.id)?.[1] ?? ''] ?? 'home';
    default:
      return 'home';
  }
}

/**
 * 使用者圖片的查找順序（assets/user/backgrounds/）：
 * Boss 波 `<場景>-boss` → `<場景>` → 舊的通用名 `battle-boss`／`battle`（只有戰鬥場景）。
 */
export function userSceneName(id: SceneId, boss: boolean, battle: boolean): string | undefined {
  const names = [boss && `${id}-boss`, id, battle && boss && 'battle-boss', battle && 'battle'].filter((n): n is string => !!n);
  return names.find((n) => userAsset('backgrounds', n));
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 場景背景元素（class="scene-bg"），放在畫面最底層 */
export function sceneBackdrop(id: SceneId, opts: { boss?: boolean; battle?: boolean } = {}): HTMLElement {
  const boss = !!opts.boss;
  const name = userSceneName(id, boss, !!opts.battle);
  const host = h('div', { class: ['scene-bg', boss && 'boss'], dataset: { scene: id } });
  if (name) host.appendChild(h('img', { src: userAsset('backgrounds', name)!, alt: '', draggable: 'false' }));
  else host.appendChild(svg(sceneSvg(id, { boss, animate: !reducedMotion() })));
  return host;
}
