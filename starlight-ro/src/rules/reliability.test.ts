import { describe, expect, test } from 'vitest';
import * as R from './state';
import { buildMap } from '../world/mapgen';

// Original v2.0 save shape, captured as literal data (before quests/refining were added).
const oldSnapshot = () => ({
  version:2,revision:34,created:true,seq:0,
  char:{name:'舊冒險者',hair:1,hairColor:2,job:'novice',baseLv:6,baseExp:40,jobLv:10,jobExp:0,
    stats:{str:4,agi:3,vit:2,int:1,dex:1,luk:1},statPoints:30,skillPoints:0,skills:{basic:8,firstAid:1},zeny:1234,hp:42,sp:6},
  equipped:{weapon:'e18',head:null,armor:'e2',garment:null,shoes:null,accessory:null},
  equipment:[{id:'e18',defId:'knife'},{id:'e2',defId:'cottonShirt'}],items:{apple:9,redPotion:12},
  cards:[{id:'c21',defId:'jellyCard',level:3,locked:true,loc:{kind:'equip',equipId:'e18',slot:0}}],
  loadouts:{firstAid:['feather',null]},hotbar:[{type:'skill',id:'firstAid'},{type:'item',id:'apple'},null,null,null,null,null,null,null],
  position:{map:'meadow',x:4,y:36},savePoint:{map:'town',x:24,y:30},mvpKills:{},
});
const made=()=>R.createCharacter(R.newGame(),'新冒險者',0,0);
const normalized=(raw:unknown)=>{const s=R.normalizeGame(raw);R.validateGame(s);return s;};

describe('novice free first aid and legacy preservation',()=>{
  test('learning first aid does not consume the nine points needed for job change',()=>{
    let s=R.gainExp(made(),0,999999).state;
    for(let i=0;i<3;i++)s=R.learnSkill(s,'basic');
    expect(s.char.skills.firstAid).toBe(1);expect(s.char.skillPoints).toBe(6);
    for(let i=3;i<9;i++)s=R.learnSkill(s,'basic');
    expect(R.jobChangeReady(s)).toBeNull();
  });
  test('basic3 automatically grants first aid into the first free hotbar slot',()=>{
    let s=R.gainExp(made(),0,999999).state;
    s=R.setHotkey(s,4,{type:'item',id:'apple'});
    const first=s.hotbar[0],chosen=s.hotbar[4];
    for(let i=0;i<3;i++)s=R.learnSkill(s,'basic');
    expect(s.char.skills.firstAid).toBe(1);expect(s.char.skillPoints).toBe(6);
    expect(s.hotbar[0]).toEqual(first);expect(s.hotbar[4]).toEqual(chosen);
    expect(s.hotbar[1]).toEqual({type:'skill',id:'firstAid'});
    expect(s.hotbar.filter(h=>h?.type==='skill'&&h.id==='firstAid')).toHaveLength(1);
    const before=s.char.skillPoints;s=R.learnSkill(s,'basic');expect(s.char.skillPoints).toBe(before-1);
    expect(s.hotbar.filter(h=>h?.type==='skill'&&h.id==='firstAid')).toHaveLength(1);
  });
  test('legacy changed-job character receives missing free aid without a paid refund',()=>{
    const raw:any=oldSnapshot();raw.char.job='swordman';raw.char.skills={basic:9} as typeof raw.char.skills;
    raw.char.jobLv=1;raw.char.skillPoints=2;raw.loadouts={};raw.hotbar[0]=null as any;
    const s=normalized(raw);expect(s.char.skills.firstAid).toBe(1);expect(s.char.skillPoints).toBe(2);
    expect(s.hotbar[0]).toEqual({type:'skill',id:'firstAid'});expect(normalized(s)).toEqual(s);
  });
  test('legacy free aid grant preserves every assigned shortcut when hotbar is full',()=>{
    const raw:any=oldSnapshot();raw.char.job='swordman';raw.char.skills={basic:9,bash:1};raw.char.jobLv=2;raw.loadouts={};
    raw.hotbar=['redPotion','orangePotion','whitePotion','bluePotion','apple','honey','returnFeather','teleportLeaf'].map(id=>({type:'item',id}));
    raw.hotbar.push({type:'skill',id:'bash'});const before=structuredClone(raw.hotbar);
    const s=normalized(raw);expect(s.char.skills.firstAid).toBe(1);expect(s.hotbar).toEqual(before);
  });
  test('first aid can be learned at zero points after basic3',()=>{
    const s=made();s.char.skills.basic=3;s.char.skillPoints=0;
    expect(R.canLearn(s,'firstAid')).toBeNull();
    expect(R.learnSkill(s,'firstAid').char.skillPoints).toBe(0);
  });
  test('original v2.0 snapshot refunds paid first aid once and retains every asset',()=>{
    const raw=oldSnapshot(),before=structuredClone(raw),s=normalized(raw);
    expect(raw).toEqual(before);expect(s.char.skillPoints).toBe(1);
    expect(s.equipment).toEqual(before.equipment);expect(s.cards).toEqual(before.cards);
    expect(s.char.skills).toEqual(before.char.skills);expect(s.loadouts).toEqual(before.loadouts);
    expect(s.seq).toBe(21);expect(normalized(s)).toEqual(s);
    const fresh=R.addCard(R.addItem(s,'knife'),'jellyCard').state;
    expect(fresh.equipment.at(-1)!.id).toBe('e22');expect(fresh.cards.at(-1)!.id).toBe('c23');R.validateGame(fresh);
  });
});

describe('untrusted save schema and playable positions',()=>{
  const corruptions:[string,(s:any)=>void][]=[
    ['unknown skill',s=>s.char.skills.missing=1],['unknown map',s=>s.position.map='missing'],
    ['nonnumeric x',s=>s.position.x='4'],['infinite coordinate',s=>s.position.y=Infinity],
    ['nonnumeric seq',s=>s.seq='21'],['fractional seq',s=>s.seq=2.5],['modern stale seq',s=>s.seq=0],
    ['invalid level',s=>s.char.baseLv=0],['invalid job level',s=>s.char.jobLv=99],['invalid exp',s=>s.char.baseExp=NaN],
    ['negative money',s=>s.char.zeny=-1],['invalid HP',s=>s.char.hp=NaN],['negative SP',s=>s.char.sp=-1],['fractional HP',s=>s.char.hp=.5],['overflow HP',s=>s.char.hp=1e100],
    ['invalid points',s=>s.char.skillPoints='1'],['invalid skill level',s=>s.char.skills.basic=10],
    ['unknown hotbar skill',s=>s.hotbar[0]={type:'skill',id:'missing'}],['unlearned hotbar skill',s=>s.hotbar[0]={type:'skill',id:'bash'}],
    ['wrong hotbar size',s=>s.hotbar=[]],['duplicate hotbar',s=>s.hotbar[3]=s.hotbar[0]],
    ['unknown module',s=>s.loadouts.firstAid=['missing',null]],['unknown loadout skill',s=>s.loadouts.missing=[null,null]],
    ['wrong module size',s=>s.loadouts.firstAid=[null]],['duplicate module',s=>s.loadouts.firstAid=['feather','feather']],
    ['unknown card location',s=>s.cards[0].loc={kind:'lost'}],['fractional card slot',s=>s.cards[0].loc.slot=.5],
    ['wrong equipment slot',s=>s.equipped.head='e18'],['unknown item',s=>s.items.missing=1],
    ['equipment in stack',s=>s.items.knife=1],['invalid counter',s=>s.mvpKills.jellyKing=NaN],
    ['unknown MVP',s=>s.mvpKills.missing=1],['invalid revision',s=>s.revision=-1],
    ['invalid quest',s=>s.quest.count='1'],['bad challenge',s=>s.challenges={completed:['missing'],counts:{}}],
    ['duplicate buyback ID',s=>s.buyback=[{equip:{...s.equipment[0]},price:25}]],
    ['unknown cooldown key',s=>s.mvpCooldowns={'town:jellyKing':Date.now()}],
  ];
  test.each(corruptions)('rejects %s',(_label,mutate)=>{
    const s=normalized(oldSnapshot());mutate(s);expect(()=>normalized(s)).toThrow();
  });
  test('legacy stale/missing sequence is repaired but malformed numeric types are rejected',()=>{
    const raw:any=oldSnapshot();delete raw.seq;expect(normalized(raw).seq).toBe(21);
    raw.seq='0';expect(()=>normalized(raw)).toThrow();
  });
  test('exhausted sequence cannot emit duplicate instances or mutate the original',()=>{
    const s=made();s.seq=Number.MAX_SAFE_INTEGER-1;const before=structuredClone(s);
    expect(()=>R.addItem(s,'knife',2)).toThrow(/流水號/);expect(s).toEqual(before);
  });
  test('v2.1 refining, bag cards and equipped cards survive normalization exactly',()=>{
    const raw={...oldSnapshot(),seq:99,quest:{index:7,count:0}};
    raw.equipment[0]={...raw.equipment[0],refine:7} as typeof raw.equipment[0];
    raw.cards.push({id:'c99',defId:'jellyKingCard',level:3,locked:false,loc:{kind:'bag'}} as typeof raw.cards[0]);
    const n=normalized(raw);expect(n.cards).toEqual(raw.cards);expect(n.equipment).toEqual(raw.equipment);
    expect(n.char.name).toBe(raw.char.name);expect(n.char.stats).toEqual(raw.char.stats);expect(n.items).toEqual(raw.items);
    expect(n.quest).toEqual({index:7,count:0});expect(n.seq).toBe(99);
  });
  test('known legacy blocked positions safely move to start; modern blocked positions are rejected',()=>{
    const raw=oldSnapshot();raw.position={map:'town',x:24,y:24};
    const s=normalized(raw);expect(s.position).toEqual({map:'town',x:24,y:30});
    s.position={map:'town',x:24,y:24};expect(()=>normalized(s)).toThrow();
    const m=buildMap(s.savePoint.map);expect(m.reachable[Math.floor(s.savePoint.y)*m.w+Math.floor(s.savePoint.x)]).toBe(1);
  });
  test('expired and future MVP cooldowns remain loadable',()=>{
    const s=normalized(oldSnapshot());s.mvpCooldowns={'meadow:jellyKing':1,'forest:forestLord':Date.now()+120000};
    expect(()=>normalized(s)).not.toThrow();
  });
});

describe('equipment recovery and status modules',()=>{
  test('locked equipment cannot be sold; buyback restores exact refine/ID and leaves cards in bag',()=>{
    let s=normalized(oldSnapshot());s=R.unequip(s,'weapon',{});s.equipment[0].refine=5;
    s=R.toggleEquipLock(s,'e18');expect(()=>R.sellEquip(s,'e18')).toThrow(/鎖定/);
    s=R.toggleEquipLock(s,'e18');const z=s.char.zeny;s=R.sellEquip(s,'e18');
    expect(s.char.zeny).toBe(z+25);expect(s.cards[0].loc).toEqual({kind:'bag'});
    expect(s.buyback![0]).toEqual({equip:{id:'e18',defId:'knife',refine:5,locked:false},price:25});
    s=R.buybackEquip(s,'e18');expect(s.char.zeny).toBe(z);
    expect(s.equipment.find(e=>e.id==='e18')).toMatchObject({refine:5});expect(s.buyback).toHaveLength(0);
    expect(()=>R.buybackEquip(s,'e18')).toThrow();R.validateGame(s);
  });
  test('buyback keeps ten most recent gear and refuses unaffordable recovery',()=>{
    let s=R.addItem(made(),'knife',11);const ids=s.equipment.slice(2).map(e=>e.id);
    for(const id of ids)s=R.sellEquip(s,id);
    expect(s.buyback).toHaveLength(10);expect(s.buyback!.map(b=>b.equip.id)).not.toContain(ids[0]);
    s.char.zeny=0;expect(()=>R.buybackEquip(s,ids[10])).toThrow(/Zeny/);
  });
  test('legacy provoke loadout is retained, explained and inactive for on-hit modules',()=>{
    let s=made();s.char.job='swordman';s.char.skills={basic:9,provoke:1};s.loadouts.provoke=['leech','feather'];
    const r=R.addCard(s,'jellyCard');s=R.insertCard(r.state,r.cardId,s.equipped.weapon!,{});
    expect(R.moduleFits('provoke','leech')).toBe(false);expect(R.moduleFits('provoke','feather')).toBe(true);
    expect(R.moduleInactiveReason('provoke','leech')).toMatch(/傷害/);
    expect(R.derive(s).skillModules.provoke).toEqual([]);expect(s.loadouts.provoke).toEqual(['leech','feather']);
    expect(()=>R.configureModule(s,'provoke',0,'leech',{})).toThrow(/不適用/);
  });
});

describe('optional MVP challenges with stable old quest indices',()=>{
  test('normal chain advances past MVP without needing boss kills',()=>{
    let s=made();s.quest={index:4,count:15};s=R.completeQuest(s).state;
    expect(s.quest.index).toBe(6);expect(R.questStatus(s)!.def.id).toBe('wolf20');
    expect(R.challengeStatuses(s).find(q=>q.def.id==='jellyKing')).toMatchObject({unlocked:true,completed:false,done:false});
  });
  test('all legacy checkpoints preserve reward history and migrate once',()=>{
    for(let index=0;index<=11;index++){
      const raw={...oldSnapshot(),quest:{index,count:index===5?1:0}},s=normalized(raw);
      expect(s.char.zeny).toBe(1234);expect(s.challenges!.completed.includes('jellyKing')).toBe(index>5);
      expect(s.challenges!.completed.includes('forestLord')).toBe(index>8);
      expect(s.challenges!.completed.includes('iceColossus')).toBe(index>10);
      expect(s.quest.index).toBe(index===5?6:index===8?9:index===10?11:index);
      expect(normalized(s)).toEqual(s);
    }
  });
  test('optional boss progress is separate from normal quest and reward is paid only once',()=>{
    let s=made();s.quest={index:6,count:7};s=R.noteKill(s,'jellyKing');
    expect(s.quest.count).toBe(7);expect(R.challengeStatuses(s)[0].done).toBe(true);
    const z=s.char.zeny;s=R.completeChallenge(s,'jellyKing').state;
    expect(s.char.zeny).toBe(z+4000);expect(s.quest).toEqual({index:6,count:7});
    expect(()=>R.completeChallenge(s,'jellyKing')).toThrow(/領取|完成/);
    expect(()=>R.completeChallenge(s,'forestLord')).toThrow();
  });
});
