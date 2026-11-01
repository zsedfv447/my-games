// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
it.each(['covenant-seal','pool-standard'])('c710 named source %s overrides remembered unrelated pool; banner/tab/rates/confirmation agree, cancellation is read-only',async id=>{
  vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'','#/summon');
  const state=await import('../src/ui/state'),{gameData}=await import('../src/data/load'),{createNewSave}=await import('../src/save/save');
  const fixture=createNewSave(gameData.config,Date.now());fixture.tutorial={step:'done',giftGiven:true};fixture.progress.tutorialDone=true;state.commit(fixture);
  const pool=gameData.gachaPools.find(p=>p.id===id)!,classic=gameData.gachaPools.find(p=>p.id==='classic-seal')!;
  expect(Object.values(classic.cards).flat()).not.toContain('c710');expect(Object.values(pool.cards).flat()).toContain('c710');
  const {startApp}=await import('../src/ui/app');const stage=document.createElement('div');document.body.append(stage);router=startApp(stage);
  const screen=(name:string)=>stage.querySelector<HTMLElement>(`[data-screen="${name}"]`)!;
  const waitScreen=async(name:string)=>{await vi.waitFor(()=>expect(screen(name)).not.toBeNull());return screen(name);};
  const button=(root:ParentNode,text:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text);expect(b,`button ${text}`).toBeDefined();return b!;};
  const stored=()=>JSON.stringify(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i)!;return [k,localStorage.getItem(k)];}).sort());
  button(await waitScreen('summon'),classic.name).click();expect(screen('summon').querySelector('.seal-banner-copy h1')!.textContent).toBe(classic.name);
  router.go('collection-card',['c710']);const detail=await waitScreen('collection-card');
  const sources=[...detail.querySelectorAll<HTMLButtonElement>('.acquire-row')];expect(sources).toHaveLength(2);
  expect(sources.every(row=>row.textContent?.includes('卡池'))).toBe(true);
  expect(sources.map(row=>row.querySelector('.acquire-title')!.textContent).sort()).toEqual(['刻印封印','星海召喚'].sort());
  const before=JSON.stringify(state.getSave()),persisted=stored(),commits=vi.spyOn(state,'commit');
  sources.find(row=>row.querySelector('.acquire-title')!.textContent===pool.name)!.click();await waitScreen('summon');
  expect(location.hash).toBe(`#/summon/${id}`);
  const assertSelected=()=>{expect(screen('summon').querySelector('.seal-banner-copy h1')!.textContent).toBe(pool.name);expect(screen('summon').querySelector('[role="tab"][aria-selected="true"]')!.textContent).toBe(pool.name);};
  assertSelected();button(screen('summon'),'機率').click();const rates=await waitScreen('summon-rates');
  expect(location.hash).toBe(`#/summon-rates/${id}`);expect(rates.querySelector('h1')!.textContent).toBe(pool.name);expect(rates.textContent).toContain(gameData.cards.find(c=>c.id==='c710')!.name);
  router.back();await waitScreen('summon');assertSelected();
  screen('summon').querySelector<HTMLButtonElement>('.seal-pull-actions button')!.click();
  const dialog=stage.querySelector<HTMLElement>('[role="dialog"]:not(.closing)')!;expect(dialog.textContent).toContain(`從「${pool.name}」召喚 1 張卡片`);
  button(dialog,'取消').click();await vi.waitFor(()=>expect(stage.querySelector('[role="dialog"]')).toBeNull());
  // Ordinary no-arg navbar navigation must continue to remember selected pool.
  button(stage.querySelector('.shell-bottom')!,'隊伍').click();await waitScreen('team');
  button(stage.querySelector('.shell-bottom')!,'召喚').click();await waitScreen('summon');expect(location.hash).toBe('#/summon');assertSelected();
  expect(JSON.stringify(state.getSave())).toBe(before);expect(stored()).toBe(persisted);expect(commits).not.toHaveBeenCalled();
},15000);
it('synthetic closed named pool remains inspectable but normal summon gates stay disabled and cannot debit',async()=>{
  vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'','#/collection-card/c710');
  const now=Date.parse('2026-11-01T12:00:00Z');vi.spyOn(Date,'now').mockReturnValue(now);
  const {gameData}=await import('../src/data/load');const index=gameData.gachaPools.findIndex(p=>p.id==='covenant-seal'), original=gameData.gachaPools[index];
  // Synthetic in-memory fixture only: unchanged repository data and no real-world clock mutation.
  gameData.gachaPools[index]={...original,period:{start:'2026-12-01T00:00:00Z',end:'2026-12-10T00:00:00Z'}};
  try {
    const state=await import('../src/ui/state'),{createNewSave}=await import('../src/save/save'),{acquireRoutes}=await import('../src/ui/acquire-guide');
    const fixture=createNewSave(gameData.config,now);fixture.tutorial={step:'done',giftGiven:true};fixture.progress.tutorialDone=true;state.commit(fixture);
    const route=acquireRoutes(state.getSave(),'c710',gameData,now).find(r=>r.kind==='gacha'&&r.pool.id===original.id)!;
    expect(route.available).toBe(false);expect(route.go).toEqual(['summon',[original.id]]);
    const {startApp}=await import('../src/ui/app');const stage=document.createElement('div');document.body.append(stage);router=startApp(stage);
    const before=JSON.stringify(state.getSave()),commits=vi.spyOn(state,'commit');
    const stored=()=>JSON.stringify(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i)!;return[k,localStorage.getItem(k)];}).sort()),saved=stored();
    const source=[...stage.querySelectorAll<HTMLButtonElement>('.acquire-row')].find(b=>b.querySelector('.acquire-title')?.textContent===original.name)!;
    expect(source.classList.contains('unavailable')).toBe(true);expect(source.textContent).toContain('卡池未開放');source.click();
    await vi.waitFor(()=>expect(stage.querySelector('[data-screen="summon"]')).not.toBeNull());
    expect(location.hash).toBe(`#/summon/${original.id}`);expect(stage.querySelector('.seal-banner-copy h1')!.textContent).toBe(original.name);
    const pulls=[...stage.querySelectorAll<HTMLButtonElement>('.seal-pull-actions button')];expect(pulls).toHaveLength(2);
    for(const pull of pulls){expect(pull.disabled).toBe(true);pull.click();}
    expect(stage.querySelector('[role="dialog"]')).toBeNull();expect(commits).not.toHaveBeenCalled();expect(JSON.stringify(state.getSave())).toBe(before);expect(stored()).toBe(saved);
  } finally {gameData.gachaPools[index]=original;}
},15000);
