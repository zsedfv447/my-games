// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { startBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import { DEMO_TEAM, DEMO_HELPER, practiceSetup } from '../src/ui/demo';
import * as readability from '../src/ui/battle-fx/readability';
import { enemyGuide } from '../src/ui/enemy-info';
import { closeRouteScoped } from '../src/ui/route-scope';
import { setOverlayHost } from '../src/ui/components/overlay';
afterEach(() => { closeRouteScoped(); document.body.replaceChildren(); vi.restoreAllMocks(); });
function fixture() {
  const setup = practiceSetup('normal');
  const battle = startBattle(setup.stage, DEMO_TEAM, DEMO_HELPER, setup.rng?.(createRng(3)) ?? createRng(3), setup.data);
  const host = document.createElement('div'); document.body.append(host); setOverlayHost(host);
  return { ...setup, state: battle.getState(), host };
}
it('visible information entry calls owner only while its exact button remains mounted', () => {
  const f = fixture(), owner = vi.fn();
  readability.renderIntent(f.host, f.state, 0, f.data.config.battle, owner);
  const old = f.host.querySelector<HTMLButtonElement>('button')!;
  expect(old.textContent).toContain('情報／攻略');
  expect(old.getAttribute('aria-label')).toContain('查看情報與攻略'); old.click(); expect(owner).toHaveBeenCalledTimes(1);
  readability.renderIntent(f.host, f.state, 0, f.data.config.battle, owner);
  old.click(); expect(owner).toHaveBeenCalledTimes(1);
});
it('live model sections are read-only, keyboard focus remains local and Escape/route revoke dialog', () => {
  const f = fixture(), trigger = document.createElement('button'); f.host.append(trigger); trigger.focus();
  f.state.enemies[0].statuses.push({ id: 'damageAbsorb', value: 20000, turns: null });
  const before = JSON.stringify(f.state), closed = vi.fn();
  const handle = readability.showEnemyInfo(f.state, 0, f.data.config.battle, {}, trigger, closed)!;
  const dialog = f.host.querySelector<HTMLElement>('[role="dialog"]')!;
  expect(dialog.querySelector('[data-enemy-guide]')).not.toBeNull();
  for (const section of enemyGuide(f.state, 0, {}).sections) {
    expect(dialog.textContent).toContain(section.title);
    for (const line of section.lines) expect(dialog.textContent).toContain(line);
  }
  for (const label of ['生命', '防禦', '攻擊間隔', '攻擊對象']) {
    const statNodes = [...dialog.querySelectorAll('p, span')].filter(node => node.textContent === label || node.textContent?.startsWith(`${label}：`));
    expect(statNodes, label).toHaveLength(1);
  }
  expect(dialog.textContent).toContain('20,000');
  expect(dialog.textContent).toContain('永久');
  expect(dialog.contains(document.activeElement)).toBe(true);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(dialog.querySelector('[data-enemy-guide]'));
  expect(document.activeElement?.getAttribute('role')).toBe('region');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  expect(document.activeElement?.textContent).toBe('關閉');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(closed).toHaveBeenCalledTimes(1); expect(document.activeElement).toBe(trigger); handle.close();
  expect(closed).toHaveBeenCalledTimes(1); expect(JSON.stringify(f.state)).toBe(before);
  readability.showEnemyInfo(f.state, 0, f.data.config.battle, {}, trigger, closed);
  closeRouteScoped(); expect(closed).toHaveBeenCalledTimes(2);
});
