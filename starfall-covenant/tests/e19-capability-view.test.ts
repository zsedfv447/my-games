// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { teamScreen } from '../src/ui/screens/team';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { commit, getSave } from '../src/ui/state';
import { closeRouteScoped } from '../src/ui/route-scope';
afterEach(()=>{closeRouteScoped();document.body.replaceChildren();});
function render(ids:(string|null|undefined)[]){
 const s=createNewSave(gameData.config,Date.now()),base=s.inventory.cards[0];s.inventory.cards=[];s.teams[0].members=ids.map((id,i)=>{if(id===null)return null;const uid=`cap-${i}`;if(id!==undefined)s.inventory.cards.push({...base,uid,cardId:id});return uid;});commit(s);
 const root=teamScreen.render({route:{name:'team',args:[],query:{}},nav:{go:vi.fn(),replace:vi.fn(),back:vi.fn(),backTo:vi.fn()},onLeave(){}});document.body.replaceChildren(root);return root.querySelector<HTMLElement>('[data-team-capabilities]')!;
}
it('mixed dragon leader source is blocked, with original description and neutral collapsed summary',()=>{
 const root=render(['c405','c206',null,null,null]);expect(root).not.toBeNull();expect(root.textContent).not.toContain('✓');const details=root.querySelector<HTMLDetailsElement>('[data-capability="defense"]')!;expect(details.open).toBe(false);expect(details.querySelector('summary')?.textContent).toContain('防護');expect(details.querySelector('summary')?.textContent).toContain('含編成不符');expect(details.textContent).toContain('目前編成不符');expect(details.querySelector('[data-capability-card="c405"][data-capability-source="leader"]')?.textContent).toContain(gameData.leaderSkills.find(l=>l.id==='l405')!.description);
 const before=JSON.stringify(getSave());details.open=true;details.open=false;expect(JSON.stringify(getSave())).toBe(before);
});
it('dragon lineup without selected helper stays conditional and recovery is not direct heal promise',()=>{
 const root=render(['c405','c107',null,null,null]);expect(root.querySelector('[data-capability="defense"]')?.textContent).toContain('條件待確認');expect(root.querySelector('[data-capability="defense"] summary')?.textContent).toContain('含待確認條件');const recovery=root.querySelector('[data-capability="heal"]')!;expect(recovery.textContent).toContain('回復');expect(root.textContent).not.toContain('沒有減傷');expect(root.textContent).not.toContain('沒有回血');
});
it.each([null,undefined])('empty or unresolved leader position does not promote later c405 (%s)',first=>{
 const root=render([first,'c405',null,null,null]);expect(root.querySelector('[data-capability-card="c405"][data-capability-source="leader"]')).toBeNull();expect(root.textContent).not.toContain('✓');if(first===undefined)expect(root.textContent).toContain('部分卡片資料不完整');
});
it('available active method retains original text and absent category wording stays conservative',()=>{
 const root=render(['c110',null,null,null,null]);const source=root.querySelector('[data-capability="defense"] [data-capability-source="active"]');expect(source?.textContent).toContain('主動技手段（須能施放）');expect(source?.textContent).toContain(gameData.skills.find(s=>s.id==='s110')!.description);expect(root.textContent).toContain('未列出此類效果');expect(root.textContent).not.toContain('沒有控場');
});
it('missing referenced skill renders incomplete warning instead of an absolute absence claim',()=>{
 const card=gameData.cards.find(c=>c.id==='c110')!,original=card.activeSkill;
 try{card.activeSkill='missing-e19';const root=render(['c110',null,null,null,null]);expect(root.textContent).toContain('部分卡片資料不完整');expect(root.textContent).not.toContain('沒有減傷');expect(root.textContent).not.toContain('✓');}
 finally{card.activeSkill=original;}
});
