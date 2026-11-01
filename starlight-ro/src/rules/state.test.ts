import {describe,expect,test} from 'vitest';
import * as R from './state';
import {baseExpNeed,jobExpNeed} from '../data/jobs';

const made=()=>R.createCharacter(R.newGame(),'測試者',0,0);
const novice10=()=>{let s=made();s=R.gainExp(s,0,999999).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');return s;};

describe('角色與成長（RO 式）',()=>{
  test('建立角色給新手短劍、棉衣、滿血',()=>{
    const s=made(),d=R.derive(s);
    expect(s.char.job).toBe('novice');
    expect(s.equipped.weapon).toBeTruthy();expect(s.char.hp).toBe(d.maxHp);
  });
  test('一開始沒有技能，技能點靠職業等級取得',()=>{
    const s=made();expect(Object.keys(s.char.skills)).toHaveLength(0);expect(s.char.skillPoints).toBe(0);
    const up=R.gainExp(s,0,jobExpNeed('novice',1)).state;
    expect(up.char.jobLv).toBe(2);expect(up.char.skillPoints).toBe(1);
  });
  test('基本等級升級給素質點，素質越高花費越多',()=>{
    const r=R.gainExp(made(),baseExpNeed(1),0);
    expect(r.baseUps).toBe(1);expect(r.state.char.statPoints).toBe(30+3);
    let s=r.state;s.char.stats.str=11;const before=s.char.statPoints;s=R.allocateStat(s,'str');
    expect(before-s.char.statPoints).toBe(3);
  });
  test('初心者職業等級最高 10',()=>{
    const s=R.gainExp(made(),0,9e9).state;expect(s.char.jobLv).toBe(10);expect(s.char.skillPoints).toBe(9);
  });
  test('轉職需要職業 Lv.10 與基本技能 Lv.9',()=>{
    const early=R.gainExp(made(),0,9e9).state;
    expect(()=>R.changeJob(early,'mage',{})).toThrow(/基本技能/);
    const s=R.changeJob(novice10(),'mage',{});
    expect(s.char.job).toBe('mage');expect(s.char.jobLv).toBe(1);
    expect(s.equipment.some(e=>e.defId==='rod')).toBe(true);
  });
  test('技能前置條件',()=>{
    let s=R.changeJob(novice10(),'mage',{});s=R.gainExp(s,0,9e9).state;
    expect(R.canLearn(s,'fireBall')).toMatch(/火焰矢/);
    for(let i=0;i<4;i++)s=R.learnSkill(s,'fireBolt');
    expect(R.canLearn(s,'fireBall')).toBeNull();
    expect(R.canLearn(s,'bash')).toBe('職業不符');
  });
  test('弓手轉職後拿到弓並自動裝備',()=>{
    const s=R.changeJob(novice10(),'archer',{});
    const w=s.equipment.find(e=>e.id===s.equipped.weapon)!;expect(w.defId).toBe('bow');
    expect(R.derive(s).ranged).toBe(true);
  });
  test('Lv.10 以下死亡不扣經驗，Lv.10 起扣 2%',()=>{
    let s=R.gainExp(made(),20,0).state;expect(R.applyDeath(s).char.baseExp).toBe(s.char.baseExp);
    s=made();s.char.baseLv=12;s.char.baseExp=1000;
    expect(R.applyDeath(s).char.baseExp).toBe(1000-Math.floor(baseExpNeed(12)*.02));
  });
});

describe('卡片規則（GDD Q07～Q11）',()=>{
  const withCards=()=>{
    let s=R.changeJob(novice10(),'mage',{});s=R.gainExp(s,0,9e9).state;s=R.learnSkill(s,'fireBolt');
    const ids:string[]=[];for(let i=0;i<4;i++){const r=R.addCard(s,'jellyCard');s=r.state;ids.push(r.cardId);}
    return {s,ids};
  };
  test('卡片在背包不生效，插進穿戴中的裝備才生效',()=>{
    let {s,ids}=withCards();s=R.configureModule(s,'fireBolt',0,'leech',{});
    expect(R.derive(s).skillModules.fireBolt).toHaveLength(0);
    s=R.insertCard(s,ids[0],s.equipped.weapon!,{});
    expect(R.derive(s).skillModules.fireBolt[0]).toMatchObject({moduleId:'leech',level:1,coef:1});
  });
  test('同名卡只取最高等級，不相加；拔掉後回落',()=>{
    let {s,ids}=withCards();s=R.configureModule(s,'fireBolt',0,'leech',{});
    s=R.upgradeCard(s,ids[0],[ids[1]],{});s=R.upgradeCard(s,ids[0],[ids[2],ids[3]],{});
    expect(s.cards.find(c=>c.id===ids[0])!.level).toBe(3);
    const r=R.addCard(s,'jellyCard');s=r.state;
    s=R.insertCard(s,r.cardId,s.equipped.weapon!,{});s=R.insertCard(s,ids[0],s.equipped.armor!,{});
    expect(R.derive(s).skillModules.fireBolt[0].level).toBe(3);
    s=R.removeCard(s,ids[0],{});
    expect(R.derive(s).skillModules.fireBolt[0].level).toBe(1);
  });
  test('升級只消耗指定的安全素材；鎖定與已插的卡不能當素材',()=>{
    let {s,ids}=withCards();
    s=R.toggleCardLock(s,ids[1]);
    expect(()=>R.upgradeCard(s,ids[0],[ids[1]],{})).toThrow(/未鎖定/);
    s=R.insertCard(s,ids[2],s.equipped.weapon!,{});
    expect(()=>R.upgradeCard(s,ids[0],[ids[2]],{})).toThrow();
    const n=s.cards.length;s=R.upgradeCard(s,ids[0],[ids[3]],{});
    expect(s.cards.length).toBe(n-1);expect(s.cards.find(c=>c.id===ids[0])!.level).toBe(2);
  });
  test('拆裝免費、ID 與等級不變；戰鬥中不能插拔',()=>{
    let {s,ids}=withCards();
    expect(()=>R.insertCard(s,ids[0],s.equipped.weapon!,{inCombat:true})).toThrow(/戰鬥/);
    const z=s.char.zeny;s=R.insertCard(s,ids[0],s.equipped.weapon!,{});s=R.insertCard(s,ids[0],s.equipped.armor!,{});
    const c=s.cards.find(x=>x.id===ids[0])!;expect(c.loc).toMatchObject({kind:'equip',equipId:s.equipped.armor});expect(s.char.zeny).toBe(z);
  });
  test('模組必須和技能語意相容',()=>{
    let {s}=withCards();
    expect(()=>R.configureModule(s,'fireBolt',0,'echo',{})).toThrow(/不適用/);
    s=R.configureModule(s,'fireBolt',0,'leech',{});
    expect(()=>R.configureModule(s,'fireBolt',1,'leech',{})).toThrow(/重複/);
  });
  test('未穿戴的裝備裡的卡不供應模組',()=>{
    let {s,ids}=withCards();s=R.configureModule(s,'fireBolt',0,'leech',{});
    s=R.buy({...s,char:{...s.char,zeny:9999}},'cutter',1);
    const spare=s.equipment.find(e=>e.defId==='cutter')!.id;
    s=R.insertCard(s,ids[0],spare,{});
    expect(R.derive(s).skillModules.fireBolt).toHaveLength(0);
  });
  test('存檔驗證抓得到同槽兩卡',()=>{
    let {s,ids}=withCards();s=R.insertCard(s,ids[0],s.equipped.weapon!,{});
    const bad=structuredClone(s);bad.cards.find(c=>c.id===ids[1])!.loc={kind:'equip',equipId:s.equipped.weapon!,slot:0};
    expect(()=>R.validateGame(bad)).toThrow();expect(()=>R.validateGame(s)).not.toThrow();
  });
});

describe('任務與精煉',()=>{
  test('擊殺任務計數、完成後給獎勵並進到下一個任務',()=>{
    let s=made();
    for(let i=0;i<9;i++)s=R.noteKill(s,'jelly');
    expect(R.questStatus(s)!.done).toBe(false);
    s=R.noteKill(s,'worm');expect(s.quest.count).toBe(9);
    s=R.noteKill(s,'jelly');expect(R.questStatus(s)!.done).toBe(true);
    const z=s.char.zeny,r=R.completeQuest(s);
    expect(r.state.char.zeny).toBe(z+300);expect(r.state.items.redPotion).toBe(15);
    expect(r.state.quest).toEqual({index:1,count:0});
  });
  test('收集任務交件時扣掉道具；不夠時不能交',()=>{
    let s=made();s.quest={index:1,count:0};s=R.addItem(s,'jellyGoo',5);
    expect(()=>R.completeQuest(s)).toThrow(/還沒完成/);
    s=R.addItem(s,'jellyGoo',4);const r=R.completeQuest(s);
    expect(r.state.items.jellyGoo).toBe(1);expect(r.state.equipment.some(e=>e.defId==='cap')).toBe(true);
  });
  test('精煉 +4 前必定成功；失敗只扣錢不降級；戰鬥中不能精煉',()=>{
    let s=made();s.char.zeny=999999;const wid=s.equipped.weapon!;const atk0=R.derive(s).weaponAtk;
    for(let i=0;i<4;i++)s=R.refine(s,wid,.99,{}).state;
    expect(s.equipment.find(e=>e.id===wid)!.refine).toBe(4);expect(R.derive(s).weaponAtk).toBe(atk0+12);
    const z=s.char.zeny,r=R.refine(s,wid,.9,{});expect(r.success).toBe(false);
    expect(r.state.equipment.find(e=>e.id===wid)!.refine).toBe(4);expect(r.state.char.zeny).toBeLessThan(z);
    expect(()=>R.refine(s,wid,0,{inCombat:true})).toThrow(/戰鬥/);
  });
  test('舊存檔沒有任務欄位也能載入',()=>{
    const s=made() as Partial<R.GameState>;delete s.quest;
    const n=R.normalizeGame(s);expect(()=>R.validateGame(n)).not.toThrow();
  });
  test('學會主動技能自動放到快捷欄空位',()=>{
    let s=R.changeJob(novice10(),'swordman',{});s=R.gainExp(s,0,9e9).state;s=R.learnSkill(s,'bash');
    expect(s.hotbar.some(h=>h?.type==='skill'&&h.id==='bash')).toBe(true);
    s=R.learnSkill(s,'swordMastery');expect(s.hotbar.some(h=>h?.type==='skill'&&h.id==='swordMastery')).toBe(false);
  });
});
