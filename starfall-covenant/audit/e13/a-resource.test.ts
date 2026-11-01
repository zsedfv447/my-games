import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const force = (b: HTMLButtonElement) => b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const btn = (root: ParentNode, label: string) => { const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label); expect(found, label).toBeDefined(); return found!; };
const dialog = (host: HTMLElement, label: string) => { const found = host.querySelector<HTMLElement>(`[role="dialog"][aria-label="${label}"]:not(.closing)`); expect(found, label).not.toBeNull(); return found!; };
async function boot(route: string) {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', `#/${route}`);
  const state = await import('../../src/ui/state'); const { gameData } = await import('../../src/data/load');
  const save = structuredClone(state.getSave()); save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true; save.player.gems = 200;
  save.progress.clearedStages = gameData.stages.filter(s => s.kind === 'main' && s.chapter === 1).map(s => s.id);
  save.inventory.cards.push({ ...save.inventory.cards[0], uid: 'audit-a', cardId: 'c811', locked: false }, { ...save.inventory.cards[0], uid: 'audit-b', cardId: 'c812', locked: false });
  state.commit(save);
  const { startApp } = await import('../../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  return { state, host, gameData };
}
async function ritual() {
  const f = await boot('summon'); f.host.querySelector<HTMLButtonElement>('.seal-pull-actions button')!.click(); btn(f.host.querySelector<HTMLElement>('[role="dialog"]:not(.closing)')!, '召喚').click();
  await vi.waitFor(() => expect(f.host.querySelector('.ritual-skip')).not.toBeNull());
  expect(location.hash).toBe('#/summon-ritual');
  btn(f.host, '略過').click();
  const again = () => { const b = [...f.host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes('再召喚') || b.textContent?.includes('再抽')); expect(b).toBeDefined(); b!.click(); return dialog(f.host, '再次召喚'); };
  return { ...f, again };
}
for (const mode of ['normal', 'cancel', 'leave', 'replacement'] as const) it(`ritual again ${mode}: real first pull and result, stale approval must not spend`, async () => {
  const f = await ritual(); expect(f.state.getSave().gacha.history).toHaveLength(1); const old = f.again(), approve = btn(old, '召喚'), cancel = btn(old, '取消'); const before = JSON.stringify(f.state.getSave());
  if (mode === 'normal') { approve.click(); expect(f.state.getSave().gacha.history).toHaveLength(2); const after = JSON.stringify(f.state.getSave()); force(approve); expect(JSON.stringify(f.state.getSave())).toBe(after); return; }
  if (mode === 'leave') { router!.replace('settings'); await wait(200); force(approve); expect(JSON.stringify(f.state.getSave())).toBe(before); return; }
  cancel.click(); await wait(50);
  if (mode === 'replacement') { const fresh = f.again(); force(cancel); expect(fresh.classList.contains('closing')).toBe(false); }
  force(approve); expect(JSON.stringify(f.state.getSave())).toBe(before);
});
async function expedition() {
  const f = await boot('expedition'); const open = () => { const b = [...f.host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '選擇卡片' || b.textContent === '更換')!; b.click(); return dialog(f.host, '選擇遠行的卡（最多 3 張）'); };
  const choose = (d: HTMLElement, cardId: string) => d.querySelector<HTMLButtonElement>(`[aria-label="${f.gameData.cards.find(c => c.id === cardId)!.name}"]`)!.click();
  return { ...f, open, choose };
}
for (const mode of ['normal', 'cancel', 'leave', 'replacement'] as const) it(`expedition picker ${mode}: closed selection must not change later chosen members`, async () => {
  const f = await expedition(); const old = f.open(); f.choose(old, 'c811'); const decide = btn(old, '決定');
  if (mode === 'normal') { decide.click(); btn(f.host, '出發').click(); expect(f.state.getSave().expeditions?.[0].uids).toEqual(['audit-a']); return; }
  if (mode === 'leave') { router!.replace('settings'); await wait(200); const before = JSON.stringify(f.state.getSave()); force(decide); expect(JSON.stringify(f.state.getSave())).toBe(before); expect(location.hash).toBe('#/settings'); expect(old.isConnected).toBe(false); return; }
  btn(old, '取消').click(); await wait(50);
  if (mode === 'replacement') { const fresh = f.open(); f.choose(fresh, 'c812'); btn(fresh, '決定').click(); }
  const before = f.host.querySelector('.expedition-screen')!.innerHTML; force(decide); expect(f.host.querySelector('.expedition-screen')!.innerHTML).toBe(before);
});
for (const mode of ['normal', 'cancel', 'leave', 'replacement'] as const) it(`expedition recall ${mode}: no stale recall may remove active party`, async () => {
  const f = await expedition(); const d = f.open(); f.choose(d, 'c811'); btn(d, '決定').click(); btn(f.host, '出發').click();
  expect(f.state.getSave().expeditions).toHaveLength(1); btn(f.host, '提前召回').click(); const old = dialog(f.host, '提前召回'), approve = btn(old, '召回');
  if (mode === 'normal') { approve.click(); await wait(1); expect(f.state.getSave().expeditions).toHaveLength(0); return; }
  if (mode === 'leave') { router!.replace('settings'); await wait(200); }
  else { btn(old, '取消').click(); await wait(50); if (mode === 'replacement') { btn(f.host, '提前召回').click(); expect(dialog(f.host, '提前召回')).not.toBe(old); } }
  const before = JSON.stringify(f.state.getSave()); force(approve); await wait(1); expect(JSON.stringify(f.state.getSave())).toBe(before);
});
for (const mode of ['normal', 'cancel', 'leave', 'replacement'] as const) it(`login popup ${mode}: daily guard and closed popup authority`, async () => {
  const f = await boot('home'); await vi.waitFor(() => expect(f.host.querySelector('[aria-label="七日星約"]')).not.toBeNull());
  const old = dialog(f.host, '七日星約'), claim = btn(old, '領取');
  if (mode === 'normal') { claim.click(); expect(f.state.getSave().daily.loginDay).toBe(1); const after = JSON.stringify(f.state.getSave()); force(claim); expect(JSON.stringify(f.state.getSave())).toBe(after); return; }
  if (mode === 'leave') { router!.replace('settings'); await wait(200); }
  else { btn(old, '稍後').click(); await wait(50); if (mode === 'replacement') router!.replace('login-bonus'); }
  const before = JSON.stringify(f.state.getSave()); force(claim); await wait(1); expect(JSON.stringify(f.state.getSave())).toBe(before);
});
