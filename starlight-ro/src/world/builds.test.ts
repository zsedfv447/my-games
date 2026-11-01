import {describe,expect,test} from 'vitest';
import * as R from '../rules/state';
import {World} from './sim';

/** A first-job character at a chosen level with given gear and stats (no saves involved). */
function hero(job:'mage'|'swordman'|'archer',gear:string[],stats:Partial<Record<'str'|'agi'|'vit'|'int'|'dex'|'luk',number>>){
  let s=R.createCharacter(R.newGame(),'測',0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');
  s=R.changeJob(s,job,{});s=R.gainExp(s,9e9,9e9).state;
  for(const [k,v] of Object.entries(stats))s.char.stats[k as 'dex']=v!;
  for(const id of gear){s=R.addItem(s,id,1);const e=s.equipment[s.equipment.length-1];s=R.equip(s,e.id,{});}
  return s;
}
describe('流派：零詠唱、攻速、爆擊',()=>{
  test('法師全套詠唱裝備 + DEX 83 達成零詠唱；沒裝備時 DEX 83 仍要 45% 詠唱',()=>{
    const bare=hero('mage',[],{dex:83,int:60});expect(R.derive(bare).castMult).toBeCloseTo(1-83/150,5);
    const full=hero('mage',['hourglass','sageGlasses','timeCloak','sorcererRobe','starRod'],{dex:83,int:60});
    expect(R.derive(full).gearCast).toBe(42);expect(R.derive(full).castMult).toBeLessThan(.04);
    const zero=hero('mage',['hourglass','sageGlasses','timeCloak','sorcererRobe','starRod'],{dex:88,int:60});expect(R.derive(zero).castMult).toBe(0);
  });
  test('時晶詠唱縮短詠唱、魔力節約降低 SP',()=>{
    let s=hero('mage',[],{dex:30,int:60});for(let i=0;i<10;i++)s=R.learnSkill(s,'fireBolt');
    const w=new World(1);w.loadMap('meadow',4,36);w.setStats(R.derive(s),s.char.baseLv);
    const cast0=w.castTime('fireBolt',10),sp0=w.spCost('fireBolt',10);
    let c=R.addCard(s,'clockCard');s=c.state;s=R.insertCard(s,c.cardId,s.equipped.weapon!,{});
    c=R.addCard(s,'blueJellyCard');s=c.state;s=R.insertCard(s,c.cardId,s.equipped.armor!,{});
    s=R.configureModule(s,'fireBolt',0,'quickCast',{});s=R.configureModule(s,'fireBolt',1,'spSaver',{});
    w.setStats(R.derive(s),s.char.baseLv);
    expect(w.castTime('fireBolt',10)).toBeCloseTo(cast0*.8,5);expect(w.spCost('fireBolt',10)).toBe(Math.round(sp0*.8));
  });
  test('模組不能裝到不適用的技能',()=>{
    let s=hero('swordman',[],{});s=R.learnSkill(s,'bash');
    expect(()=>R.configureModule(s,'bash',0,'quickCast',{})).toThrow(/詠唱|不適用/);
    expect(()=>R.configureModule(s,'bash',0,'amplify',{})).toThrow(/屬性/);
  });
  test('攻速裝備縮短普攻間隔，有上限；爆擊裝備疊加',()=>{
    const a0=R.derive(hero('archer',[],{agi:60,dex:60})),a1=R.derive(hero('archer',['swiftBangle','hunterCap','galeCape','galeBow'],{agi:60,dex:60}));
    expect(a1.attackDelay).toBeLessThan(a0.attackDelay*.75);expect(a1.attackDelay).toBeGreaterThanOrEqual(.28);
    const s0=R.derive(hero('swordman',[],{luk:40})),s1=R.derive(hero('swordman',['warBand','clover','meteorSword'],{luk:40}));
    expect(s1.crit-s0.crit).toBeCloseTo(24+2*.3,5);
  });
});
