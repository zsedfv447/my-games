// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
async function boot(id:string){
 vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'',`#/archetypes/${id}`);const backing=localStorage,writes:string[]=[];vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{writes.push(k);backing.setItem(k,v);},removeItem:(k:string)=>{writes.push(k);backing.removeItem(k);},key:(i:number)=>backing.key(i),get length(){return backing.length;}});const state=await import('../src/ui/state');const save=structuredClone(state.getSave());save.tutorial={step:'done',giftGiven:true};save.progress.tutorialDone=true;save.inventory.cards=[];save.collection={seen:[],owned:[],claimed:[]};save.teams.forEach(t=>t.members=[null,null,null,null,null]);save.progress.clearedStages=[];state.commit(save);
 const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);const {gameData}=await import('../src/data/load');writes.length=0;return{state,host,gameData,writes};
}
const storage=()=>JSON.stringify(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i)!;return[k,localStorage.getItem(k)];}).sort());
const cases=[
 {id:'heart',summary:'依隊長條件消心取得攻擊加成並支援回復；回復力轉為攻擊力須有對應的主動技效果。',how:'依隊長技要求的心珠組數安排消除，搭配轉心與回復支援；提高回復倍率不會自動提高攻擊倍率。'},
 {id:'race',summary:'依隊長技強化指定種族的成員；同族人數不會自動提高每人的倍率，全隊同族的額外效果須另看隊長條件。',how:'依隊長種族組隊，跨屬性混搭。'},
 {id:'skillcycle',summary:'運用開場充能、冷卻縮減與隊員技能安排施技順序；能否連續施放仍須確認冷卻與封印等限制。',how:'部分隊長技會在施放主動技的回合提高攻擊；技能連鎖的追打須先啟動對應效果，再由後續施技觸發，不是每招都自帶傷害。'},
];
it.each(cases)('$id existing codex/prepare share precise text; unowned locked reading and Back are zero-write',async({id,summary,how})=>{
 const f=await boot(id),before=JSON.stringify(f.state.getSave()),disk=storage();let root=f.host.querySelector<HTMLElement>('[data-screen="archetypes"]')!;const section=root.querySelector(`[data-archetype-section="${id}"]`)!;expect(section.textContent).toContain(summary);expect(section.textContent).toContain(how);await new Promise(r=>setTimeout(r,30));root.scrollTop=529;
 const trial=f.gameData.stages.find(s=>s.id===`trial-${id}`)!;expect(trial.unlockAfter).toBeTruthy();[...section.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===trial.name)!.click();await vi.waitFor(()=>expect(f.host.querySelector('[data-screen="prepare"]')).not.toBeNull());expect(location.hash).toBe(`#/prepare/trial-${id}`);expect(f.host.textContent).toContain(how);expect(f.host.textContent).toContain('借用隊伍');
 f.host.querySelector<HTMLButtonElement>('[data-tut="sortie"] button')!.click();await vi.waitFor(()=>expect(f.host.textContent).toContain('還沒解鎖這一關'));expect(location.hash).toBe(`#/prepare/trial-${id}`);expect(f.state.getSave().activeBattle).toBeNull();expect(JSON.stringify(f.state.getSave())).toBe(before);expect(storage()).toBe(disk);expect(f.writes).toEqual([]);
 router!.back();await vi.waitFor(()=>expect(f.host.querySelector('[data-screen="archetypes"]')).not.toBeNull());root=f.host.querySelector<HTMLElement>('[data-screen="archetypes"]')!;expect(location.hash).toBe(`#/archetypes/${id}`);expect(root.scrollTop).toBe(529);expect(root.querySelector(`[data-archetype-section="${id}"]`)?.textContent).toContain(summary);expect(JSON.stringify(f.state.getSave())).toBe(before);expect(storage()).toBe(disk);expect(f.writes).toEqual([]);
});
