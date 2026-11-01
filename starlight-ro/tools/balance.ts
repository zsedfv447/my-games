// Accelerated, deterministic inventory/economy simulation; this is not a real-time human playtest.
// Run: MIN=30 node_modules/.bin/vite-node tools/balance.ts (MIN is bounded to 20–45 virtual minutes).
import {World} from '../src/world/sim';
import * as R from '../src/rules/state';
import {skills,type Stat} from '../src/data/jobs';
import {items} from '../src/data/items';
import {monsters} from '../src/data/monsters';

type Build={job:'swordman'|'mage'|'archer';stats:Stat[];skills:string[]};
const builds:Build[]=[
 {job:'swordman',stats:['str','str','vit','dex','agi'],skills:['bash','bash','bash','bash','bash','magnum','hpRecovery','swordMastery']},
 {job:'mage',stats:['int','int','dex','vit'],skills:['fireBolt','fireBolt','fireBolt','fireBolt','fireBall','lightningBolt','coldBolt','spRecovery']},
 {job:'archer',stats:['dex','dex','agi','vit'],skills:['doubleStrafe','doubleStrafe','doubleStrafe','doubleStrafe','doubleStrafe','owlEye','owlEye','owlEye','vulture','arrowShower']},
];
function spend(s:R.GameState,b:Build){
 for(let n=0;n<120;n++){let changed=false;for(const k of b.stats){try{s=R.allocateStat(s,k);changed=true;}catch{}}if(!changed)break;}
 for(let n=0;n<100;n++){
   const order=s.char.job==='novice'?['basic','firstAid']:b.skills;
   const pick=order.find(id=>!R.canLearn(s,id));if(!pick)break;s=R.learnSkill(s,pick);
 }
 return s;
}
const minutes=Math.max(20,Math.min(45,Number(process.env.MIN)||30));
for(const b of builds){
 let s=spend(R.createCharacter(R.newGame(),'模擬',0,0),b),d=R.derive(s);
 const w=new World(1234);let field='meadow';w.loadMap(field,4,36);
 const sync=()=>{d=R.derive(s);w.setStats(d,s.char.baseLv);w.autoSkills=s.hotbar.flatMap(h=>h?.type==='skill'?[h.id]:[]);};
 sync();w.setVitals(d.maxHp,d.maxSp);w.setAuto(true);
 let cooldown=0,deaths=0,kills=0,spent=0,trips=0,travelSeconds=0,earned=0,nextReport=600;
 let townRemaining=0,lastDamage='';
 const consumed:Record<string,number>={},purchased:Record<string,number>={},killers:Record<string,number>={},marks:string[]=[];
 const snapshot=()=>{s=R.recordVitals(s,{map:w.map.def.id,x:w.player.x,y:w.player.y},w.player.hp,w.player.sp);};
 const goTown=(_reason:string,duration:number)=>{snapshot();townRemaining=duration;trips++;travelSeconds+=duration;w.loadMap(s.savePoint.map,s.savePoint.x,s.savePoint.y);};
 const depart=()=>{
   // Rewards, sales, job change and actual purchases are all town actions.
   for(let n=0;n<20&&R.questStatus(s)?.done;n++){const r=R.completeQuest(s);s=r.state;marks.push(`委託 ${r.def.id}`);}
   if(s.char.job==='novice'&&!R.jobChangeReady(s)){s=R.changeJob(s,b.job,{inTown:true});marks.push(`轉職 Base${s.char.baseLv}`);}
   s=spend(s,b);
   for(const [id,count] of Object.entries(s.items))if(items[id]?.kind==='etc'&&count>0){const old=s.char.zeny;s=R.sellItem(s,id,count);earned+=s.char.zeny-old;}
   const potion=s.char.baseLv>=14?'orangePotion':'redPotion';
   const quantity=Math.min(15-(s.items[potion]??0),Math.floor(s.char.zeny/items[potion].price));
   if(quantity>0){s=R.buy(s,potion,quantity);spent+=quantity*items[potion].price;purchased[potion]=(purchased[potion]??0)+quantity;}
   sync();
   field=s.char.baseLv>=24?'cave':s.char.baseLv>=14?'forest':'meadow';
   // Returning from the save point costs 20 additional virtual seconds, already in townRemaining.
   w.loadMap(field,4,field==='cave'?32:36);w.setAuto(true);
 };
 for(let t=0;t<minutes*60;t+=1/60){
   for(const e of w.step(1/60)){
     if(e.t==='pickup'){if(e.item.kind==='card')s=R.addCard(s,e.item.defId).state;else s=R.addItem(s,e.item.defId,e.item.count);}
     if(e.t==='kill'){kills++;snapshot();s=R.noteKill(s,e.monster);const result=R.gainExp(s,e.exp,e.jexp);s=result.state;if(result.baseUps||result.jobUps){s=spend(s,b);sync();w.setVitals(s.char.hp,s.char.sp);}}
     if(e.t==='dmg'&&e.to==='p'&&e.amount>0)lastDamage=e.src;
     if(e.t==='death'){deaths++;killers[lastDamage]=(killers[lastDamage]??0)+1;s=R.applyDeath(s);goTown('死亡回記錄點',60);w.respawn();}
     if(e.t==='warp'&&townRemaining<=0)goTown('步行回城',55);
   }
   cooldown-=1/60;
   if(townRemaining>0){townRemaining-=1/60;if(townRemaining<=0){snapshot();depart();}continue;}
   if(cooldown<=0&&w.player.hp<d.maxHp*.4&&!w.player.dead){
     const id=['orangePotion','redPotion','apple','honey','whitePotion'].find(id=>(s.items[id]??0)>0);
     if(id){const it=items[id];s=R.consumeItem(s,id);if(it.kind==='use')w.heal(it.hp??0,it.sp??0);consumed[id]=(consumed[id]??0)+1;cooldown=.8;}
   }
   const supply=['orangePotion','redPotion','apple','honey','whitePotion'].reduce((n,id)=>n+(s.items[id]??0),0);
   if(R.questStatus(s)?.done||(!supply&&w.player.hp<d.maxHp*.5)||(s.char.job==='novice'&&!R.jobChangeReady(s))){goTown('補給／委託',55);continue;}
   if(!w.player.auto&&!w.player.dead)w.setAuto(true);
   // Pursue the active kill objective when safe; do not auto-pull MVPs.
   const q=R.questStatus(s)?.def;if(q?.goal.kind==='kill'&&!monsters[q.goal.monster]?.mvp){const goal=q.goal;const target=w.monsters.filter(m=>m.def.id===goal.monster&&m.state!=='dead').sort((a,b)=>Math.hypot(a.x-w.player.x,a.y-w.player.y)-Math.hypot(b.x-w.player.x,b.y-w.player.y))[0];if(target&&!w.player.cast&&!w.player.pending)w.player.target={kind:'monster',id:target.id};}
   if(t>=nextReport){marks.push(`${Math.round(t/60)}分 Base${s.char.baseLv} Job${s.char.jobLv} 殺${kills} 死${deaths}`);nextReport+=600;}
 }
 console.log(JSON.stringify({job:b.job,virtualMinutes:minutes,base:s.char.baseLv,jobLevel:s.char.jobLv,currentJob:s.char.job,map:w.map.def.id,quest:R.questStatus(s)?.def.id??'完成',kills,deaths,killers,zeny:s.char.zeny,spent,purchased,consumed,inventory:s.items,trips,travelSeconds,earnedFromSales:earned,marks,notes:'初始背包原樣；補藥扣真實庫存／金幣；回城55秒、死亡60秒，含往返與休息；城鎮自然回復；未授予額外經驗或免費補血。'},null,2));

}
