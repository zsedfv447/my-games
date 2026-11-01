// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms:number) => new Promise(r => setTimeout(r,ms));
const force = (b:HTMLButtonElement) => b.dispatchEvent(new MouseEvent('click',{bubbles:true}));
async function boot(gems=100) {
  vi.resetModules(); localStorage.clear(); history.replaceState(null,'','#/summon');
  const state = await import('../src/ui/state');
  const save=structuredClone(state.getSave()); save.tutorial={step:'done',giftGiven:true}; save.progress.tutorialDone=true; save.player.gems=gems; state.commit(save);
  const {startApp}=await import('../src/ui/app'); const host=document.createElement('div'); document.body.append(host); router=startApp(host);
  const {SAVE_KEY}=await import('../src/save/save'); const storage=vi.spyOn(localStorage,'setItem');
  const writes=()=>storage.mock.calls.filter(([key])=>key===SAVE_KEY);
  const first=(count:1|10=1)=>{
    host.querySelectorAll<HTMLButtonElement>('.seal-pull-actions button')[count===1?0:1].click();
    const dialog=[...host.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(d=>!d.classList.contains('closing')).at(-1)!;
    expect(dialog).toBeDefined();
    return {dialog,confirm:[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='召喚')!,cancel:[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='取消')!};
  };
  const open = async (count:1|10=1) => {
    first(count).confirm.click();
    await vi.waitFor(() => expect(host.querySelector('.ritual-skip')).not.toBeNull());
    host.querySelector<HTMLButtonElement>('.ritual-skip')!.click();
    const again = () => {
      host.querySelector<HTMLButtonElement>('.ritual-actions button')!.click();
      const dialog = host.querySelector<HTMLElement>('[aria-label="再次召喚"]:not(.closing)')!;
      expect(dialog).not.toBeNull();
      return { dialog, confirm: [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '召喚')!, cancel: [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '取消')! };
    };
    return again;
  };
  return {state,host,open,writes};
}

it('canceled again consent and old cancellation cannot consume or close its replacement', async () => {
 const { state, open, writes } = await boot(200); const again = await open();
 const old = again(); old.cancel.click(); await wait(50); expect(old.confirm.isConnected).toBe(true);
 const fresh = again(); const before = JSON.stringify(state.getSave()), n = writes().length;
 force(old.cancel); force(old.confirm);
 expect(fresh.dialog.classList.contains('closing')).toBe(false);
 expect(JSON.stringify(state.getSave())).toBe(before); expect(writes()).toHaveLength(n);
 fresh.confirm.click(); expect(state.getSave().player.gems).toBe(190);
});
it.each([1,10] as const)('normal repeat %i pull commits once without changing existing pricing', async count => {
 const { state, open, writes } = await boot(200); const again = await open(count);
 const before = structuredClone(state.getSave()); const own = again(); own.confirm.click();
 const committed = JSON.stringify(state.getSave()), n = writes().length;
 force(own.confirm); force(own.cancel);
 expect(JSON.stringify(state.getSave())).toBe(committed); expect(writes()).toHaveLength(n);
 expect(state.getSave().player.gems).toBe(before.player.gems - (count === 1 ? 5 : 50));
 expect(state.getSave().inventory.cards).toHaveLength(before.inventory.cards.length + count);
 expect(state.getSave().gacha.history).toHaveLength(count * 2);
});
it('an insufficient-funds repeat fails without spending and can be retried after a legitimate balance update', async () => {
 const { state, open } = await boot(200); const again = await open(); const old = again();
 state.commit({ ...state.getSave(), player: { ...state.getSave().player, gems: 0 } });
 const before = JSON.stringify(state.getSave()); old.confirm.click();
 expect(JSON.stringify(state.getSave())).toBe(before);
 state.commit({ ...state.getSave(), player: { ...state.getSave().player, gems: 10 } });
 const retry = again(); retry.confirm.click();
 expect(state.getSave().player.gems).toBe(5); expect(state.getSave().gacha.history).toHaveLength(2);
});
