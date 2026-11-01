import { describe, test, expect } from 'vitest';
import * as R from './state';
import * as C from './craft';
import { items, type EquipDef } from '../data/items';
import { recipes, craftGear } from '../data/crafting';
import { refineBonus, traitOf } from './refine-traits';
import { World } from '../world/sim';
import { monsters } from '../data/monsters';

const ctx={inCombat:false,inTown:true} as unknown as R.Ctx;
function mage(lv=40){
  let s=R.createCharacter(R.newGame(),'工匠測試',0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');
  s=R.changeJob(s,'mage',{});s.char.baseLv=lv;s.char.jobLv=50;s.char.stats.int=60;s.char.stats.dex=40;return s;
}
const wear=(s:R.GameState,id:string,refine=0)=>{s=R.addItem(s,id,1);const e=s.equipment[s.equipment.length-1];e.refine=refine;return R.equip(s,e.id,ctx);};

describe('v4.7 精煉特性',()=>{
  test('每件裝備都有特性：詠唱飾品→詠唱、弓→攻速、法杖→魔攻',()=>{
    expect(traitOf(items.hourglass as EquipDef)).toBe('cast');expect(traitOf(items.galeBow as EquipDef)).toBe('aspd');
    expect(traitOf(items.woodStaff as EquipDef)).toBe('matk');expect(traitOf(items.thriftCloak as EquipDef)).toBe('spCost');
  });
  test('+3/+5/+7 逐步強化特性；+7 招牌裝備有額外加成',()=>{
    const h=items.hourglass as EquipDef;
    expect(refineBonus(h,2)).toEqual({});expect(refineBonus(h,3)).toEqual({cast:2});expect(refineBonus(h,5)).toEqual({cast:4});
    expect(refineBonus(h,7)).toEqual({cast:10});// 2+2+3 milestones + 3 signature
  });
  test('精煉加成真的進入角色能力：沙漏 +7 詠唱更快並開啟時之迴響',()=>{
    const base=R.derive(wear(mage(),'hourglass',0)),r7=R.derive(wear(mage(),'hourglass',7));
    expect(r7.castMult).toBeLessThan(base.castMult-.09);expect(r7.castEcho).toBe(true);expect(base.castEcho).toBe(false);
  });
  test('飾品現在可以精煉',()=>{
    let s=wear(mage(),'hourglass',0);s.char.zeny=1e7;const id=s.equipped.accessory!;
    const r=R.refine(s,id,0,ctx);expect(r.success).toBe(true);expect(r.state.equipment.find(e=>e.id===id)!.refine).toBe(1);
  });
  test('新屬性：SP 消耗、SP 回復、技能/追加傷害倍率都會計算',()=>{
    let s=mage();const before=R.derive(s);
    s=wear(s,'thriftCloak',0);s=wear(s,'meditationRobe',0);s=wear(s,'emberScepter',0);s=wear(s,'trialBadge',0);
    const d=R.derive(s);expect(d.spCostMult).toBeCloseTo(.92);expect(d.spRegen).toBeGreaterThan(before.spRegen*1.2);
    expect(d.derivedMult).toBeCloseTo(1.15);expect(d.skillMult).toBeCloseTo(1.06);
  });
  test('戰鬥中 SP 消耗真的變少',()=>{
    const s=wear(mage(),'thriftCloak',7),w=new World(3);w.loadMap('meadow',4,36);w.setStats(R.derive(s),40);
    const w0=new World(3);w0.loadMap('meadow',4,36);w0.setStats(R.derive(mage()),40);
    expect(w.spCost('fireBolt',10)).toBeLessThan(w0.spCost('fireBolt',10));
  });
});

describe('v4.7 打造與料理',()=>{
  test('所有配方的產出與材料都是存在的道具',()=>{
    for(const r of recipes){expect(items[r.out]).toBeTruthy();for(const m of Object.keys(r.mats))expect(items[m]).toBeTruthy();}
    for(const g of craftGear)expect(recipes.some(r=>r.out===g.id)).toBe(true);
  });
  test('材料不足不能打造；足夠時扣材料與錢並拿到裝備',()=>{
    let s=mage();expect(()=>C.craft(s,'r_trialBadge')).toThrow();
    s=R.addItem(s,'trialSigil',6);s.char.zeny=20000;
    const t=C.craft(s,'r_trialBadge');expect(t.items.trialSigil).toBe(1);expect(t.char.zeny).toBe(10000);expect(t.equipment.some(e=>e.defId==='trialBadge')).toBe(true);
    expect(()=>R.validateGame(t)).not.toThrow();
  });
  test('料理把素材變成食物',()=>{
    let s=mage();s=R.addItem(s,'apple',3);s=R.addItem(s,'jellyGoo',2);s.char.zeny=100;
    const apples=s.items.apple;const t=C.craft(s,'c_dawnBread');expect(t.items.dawnBread).toBe(3);expect(t.items.apple??0).toBe(apples-3);
  });
  test('星落女神像會掉星輝碎片（星落頭冠的材料）',()=>{
    expect(monsters.starIdol.drops.some(d=>d.item==='starShard')).toBe(true);
  });
});
