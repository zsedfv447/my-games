import { describe, it, expect } from 'vitest';
import { World } from './sim';
import * as R from '../rules/state';
import { items } from '../data/items';

const H=1/60;
const step=(w:World,sec:number)=>{for(let i=0;i<Math.round(sec*60);i++)w.step(H);};
function world(){let s=R.createCharacter(R.newGame(),'食客',0,0);const w=new World(1);const d={...R.derive(s),maxSp:5000,maxHp:5000,spRegen:0,hpRegen:0};w.loadMap('meadow',4,36);w.monsters.length=0;w.setStats(d,1);w.setVitals(1,0);return {w,d};}

describe('v4.5 食物與快捷欄', ()=>{
  it('食物是每秒慢慢回復，不是瞬間補滿，時間到就停', ()=>{
    const f=(items.starJuice as {food:{hp:number;sp:number;dur:number}}).food;
    const A=world().w,B=world().w; // B = control without food (natural regen only)
    A.eat('starJuice',f.hp,f.sp,f.dur);
    const diff=()=>A.player.sp-B.player.sp;
    step(A,.5);step(B,.5);expect(diff()).toBeLessThan(1);
    step(A,10);step(B,10);expect(diff()).toBeGreaterThanOrEqual(18);expect(diff()).toBeLessThanOrEqual(22);
    step(A,90);step(B,90);const total=diff();expect(A.player.food).toBeNull();
    step(A,30);step(B,30);expect(diff()).toBe(total);expect(total).toBe(f.sp*f.dur);
  });
  it('新的食物會取代舊的，不會疊加', ()=>{
    const {w}=world();expect(w.eat('dawnBread',4,0,60)).toBeNull();
    expect(w.eat('starJuice',0,2,90)).toBe('dawnBread');expect(w.player.food!.id).toBe('starJuice');expect(w.player.food!.hp).toBe(0);
  });
  it('快捷欄拖曳互換位置，空格則是移動', ()=>{
    let s=R.newGame();s={...s,hotbar:s.hotbar.map((h,i)=>i===0?{type:'item',id:'redPotion'}:i===1?{type:'item',id:'apple'}:null) as typeof s.hotbar};
    s=R.swapHotkeys(s,0,1);expect(s.hotbar[0]).toEqual({type:'item',id:'apple'});expect(s.hotbar[1]).toEqual({type:'item',id:'redPotion'});
    s=R.swapHotkeys(s,1,5);expect(s.hotbar[1]).toBeNull();expect(s.hotbar[5]).toEqual({type:'item',id:'redPotion'});
    expect(()=>R.swapHotkeys(s,0,99)).toThrow();
  });
});
