// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const force = (b: HTMLButtonElement) => b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const btn = (root: ParentNode, label: string) => { const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label); expect(found, label).toBeDefined(); return found!; };
const dialog = (host: HTMLElement, label: string) => { const found = host.querySelector<HTMLElement>(`[role="dialog"][aria-label="${label}"]:not(.closing)`); expect(found, label).not.toBeNull(); return found!; };
async function boot(route: string) {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', `#/${route}`);
  const state = await import('../src/ui/state'); const { gameData } = await import('../src/data/load');
  const save = structuredClone(state.getSave()); save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true; save.player.gems = 200;
  save.progress.clearedStages = gameData.stages.filter(s => s.kind === 'main' && s.chapter === 1).map(s => s.id);
  save.inventory.cards.push({ ...save.inventory.cards[0], uid: 'audit-a', cardId: 'c811', locked: false }, { ...save.inventory.cards[0], uid: 'audit-b', cardId: 'c812', locked: false });
  state.commit(save);
  const { startApp } = await import('../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  return { state, host, gameData };
}
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

it('recall approval followed by same-task route departure does not change expedition', async () => {
  const f = await expedition(); const d = f.open(); f.choose(d, 'c811'); btn(d, '決定').click(); btn(f.host, '出發').click();
  btn(f.host, '提前召回').click(); const before = JSON.stringify(f.state.getSave()); btn(dialog(f.host, '提前召回'), '召回').click(); router!.replace('settings'); await wait(1);
  expect(JSON.stringify(f.state.getSave())).toBe(before);
});
it('dismissed login popup does not prevent a legitimate daily screen claim', async () => {
  const f = await boot('home'); await vi.waitFor(() => expect(f.host.querySelector('[aria-label="七日星約"]')).not.toBeNull());
  btn(dialog(f.host, '七日星約'), '稍後').click(); router!.replace('login-bonus'); await vi.waitFor(() => expect(f.host.querySelector('[data-screen="login-bonus"]')).not.toBeNull());
  const claim = [...f.host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes('領取今日獎勵'))!;
  expect(claim).toBeDefined(); claim.click(); expect(f.state.getSave().daily.loginDay).toBe(1); const after = JSON.stringify(f.state.getSave()); force(claim); expect(JSON.stringify(f.state.getSave())).toBe(after);
});
it('cancelled recall permits a fresh approval without losing expedition before that approval', async () => {
  const f = await expedition(); const d = f.open(); f.choose(d, 'c811'); btn(d, '決定').click(); btn(f.host, '出發').click();
  btn(f.host, '提前召回').click(); btn(dialog(f.host, '提前召回'), '取消').click(); await wait(1); expect(f.state.getSave().expeditions).toHaveLength(1);
  btn(f.host, '提前召回').click(); btn(dialog(f.host, '提前召回'), '召回').click(); await wait(1); expect(f.state.getSave().expeditions).toHaveLength(0);
});
