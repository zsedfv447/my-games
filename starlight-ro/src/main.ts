// Coordinator: owns the authoritative GameState, applies rule commands, feeds the World and saves.
import './style.css';
import { labState, labJob2State, LAB_JOB2 } from './rules/lab';
import { World, type SimEvent } from './world/sim';
import { GameScene, createGame } from './render/scene';
import { Scene3D } from './render3d/scene3d';
import { pets, petByMonster, TAME_ITEM } from './data/pets';
import { costumes } from './data/costumes';
import { mounts } from './data/adventure';
import { awakenings, MASTERY_NAMES } from './data/mastery';
import * as R from './rules/state';
import * as X from './rules/explore';
import { landmarks } from './data/landmarks';
import { huntSpot } from './data/habitats';
import { WORLD_EVENT_NAMES } from './world/sim';
import type { GameState, Ctx } from './rules/state';
import { SaveStore } from './save';
import {SaveQueue,captureSession} from './session';
import {nextWarp,questDestination,type Destination} from './navigation';
import {quests} from './data/quests';
import { UI, type Main, type Settings } from './ui';
import { Audio } from './audio';
import {combatSounds} from './render3d/combat-presentation';
import { items, cards, type EquipDef } from './data/items';
import { skills, jobs, secondJobOf, SOULS } from './data/jobs';
import { rollEquip, rollQuality, affixText, QUALITY, type Quality, type Roll } from './rules/affix';
import { GEAR_FX } from './data/ascension-items';
import * as SF from './rules/starfall';
import { HORDE, SIGIL_BAD, SIGIL_GOOD, BOONS, ECLIPSE, ASPECT_NAMES, type BoonId, type SigilAffix } from './data/starfall';
import { monsters } from './data/monsters';
import { maps } from './data/maps';
import type { Look } from './render/art/characters';

const store=new SaveStore();
const audio=new Audio();
const seed=crypto.getRandomValues(new Uint32Array(1))[0];
const world=new World(seed);
/** 3D is the default; `?renderer=2d` (or `canvas`) or the setting switches back to the classic 2D view. */
function want3d():boolean{
  const q=new URLSearchParams(location.search).get('renderer');if(q==='2d'||q==='canvas')return false;if(q==='3d')return true;
  try{if(JSON.parse(localStorage.getItem('starlight-ro-settings')??'{}').renderer==='2d')return false;}catch{/* default */}
  try{const c=document.createElement('canvas');return !!c.getContext('webgl2');}catch{return false;}
}
const use3d=want3d();
const scene:GameScene|Scene3D=use3d?new Scene3D():new GameScene();
let state:GameState=R.newGame();
const labQ=new URLSearchParams(location.search);
/** v4.4 mage comparison lab: a throwaway character; persist() is disabled so the real save is untouched. */
const LAB=labQ.get('lab')?(LAB_JOB2.includes(labQ.get('lab')!)?labJob2State(labQ.get('lab')!,{lv:Number(labQ.get('lv')??72),pre:labQ.get('pre')==='1'})
  :labState(labQ.get('lab')!,{zero:labQ.get('gear')==='zero',awake:labQ.get('awake')==='1',lv:Number(labQ.get('lv')??45)})):null;
let ui:UI;
const saveQueue=new SaveQueue();
let replacing=false;
let navigation:Destination|null=null;
let started=false;
const settings:Settings=loadSettings();

function loadSettings():Settings{
  const base:Settings={autoLoot:true,dropMul:1,volume:.5,muted:false,autoPotion:30,music:true,stopOnNoPotions:true,stopOnQuestDone:false,autoStrategy:'balanced',uiScale:100,renderer:'3d'};
  try{const v={...base,...JSON.parse(localStorage.getItem('starlight-ro-settings')??'{}')};return {...v,dropMul:1,autoPotion:[0,30,50,70].includes(v.autoPotion)?v.autoPotion:30,autoStrategy:['balanced','aoe','conserve'].includes(v.autoStrategy)?v.autoStrategy:'balanced',uiScale:[90,100,115].includes(v.uiScale)?v.uiScale:100,renderer:v.renderer==='2d'?'2d':'3d',graphics:(['auto','high','mid','low'] as const).includes(v.graphics)?v.graphics:'auto',volume:Number.isFinite(v.volume)?Math.max(0,Math.min(1,v.volume)):.5};}catch{return base;}
}
function applySettings(){
  world.autoLoot=settings.autoLoot;world.dropMultiplier=1;world.cardMultiplier=1;world.autoStrategy=settings.autoStrategy;
  audio.setVolume(settings.volume);audio.setMuted(settings.muted);audio.setMusic(settings.music);
  if(scene instanceof Scene3D)scene.setGraphics(settings.graphics??'auto');
  try{localStorage.setItem('starlight-ro-settings',JSON.stringify(settings));}catch{/* preference only */}
}
function look(s:GameState=state):Look{
  const wid=s.equipped.weapon,wdef=wid?items[s.equipment.find(e=>e.id===wid)!.defId] as EquipDef:null;
  const weapon=s.equipment.find(e=>e.id===wid),head=s.equipment.find(e=>e.id===s.equipped.head),armor=s.equipment.find(e=>e.id===s.equipped.armor);
  return {outfit:s.char.job as Look["outfit"],hair:s.char.hair,hairColor:R.hairColors[s.char.hairColor],weapon:wdef?.weaponType??null,weaponStyle:weapon?.defId,refine:weapon?.refine??0,headgear:head?.defId,armorStyle:armor?.defId};
}
function ctx():Ctx{return {inCombat:world.inCombat(),inTown:world.inTown};}
function refreshStats(){
  world.setStats(R.derive(state),state.char.baseLv);world.flags=state.flags??{};
  world.setTier(state.starfall?.tier??1);world.embers=state.items.eclipseEmber??0;
  {const role=state.created?state.mercs?.active??null:null;world.setAlly(role,state.char.baseLv,role?state.mercs?.modes?.[role]:undefined);}
  const mount=state.mounts?.active?mounts[state.mounts.active]:null;if(!mount)world.setRiding(false);else{world.mountSpeed=mount.speed;world.mountId=mount.id;}
  world.autoSkills=state.hotbar.filter((h):h is {type:'skill';id:string}=>h?.type==='skill').map(h=>h.id);
}
const potionOrder=['whitePotion','orangePotion','redPotion','honey','apple'];
let lastAutoPotion=0;
let noPotionWarned=false;
function stopAutoSafely(){
  if(!world.player.auto)return;
  const count=potionOrder.reduce((sum,id)=>sum+(state.items[id]??0),0);
  if(count>0)noPotionWarned=false;
  if(settings.stopOnNoPotions&&settings.autoPotion&&count===0){
    world.setAuto(false);if(!noPotionWarned){ui.log('回復道具已用完，已停止自動尋怪。請先補給或返回城鎮。','warn');ui.banner('補給用完了，先回城休息吧');noPotionWarned=true;}
  }
  if(settings.stopOnQuestDone&&R.questStatus(state)?.done){world.setAuto(false);ui.log('委託已完成，已停止自動尋怪。點任務追蹤可返回交件。','sys');}
}
/** Auto potion: drink the strongest healing item owned when HP falls under the chosen percentage. */
function autoPotion(){
  if(!started||!settings.autoPotion||world.player.dead||world.inTown||ui.dialogOpen)return;
  const now=performance.now();if(now-lastAutoPotion<800)return;
  if(world.player.hp>=world.derived.maxHp*settings.autoPotion/100)return;
  const id=potionOrder.find(i=>(state.items[i]??0)>0);if(!id)return;
  lastAutoPotion=now;useItem(id);
}
function snapshot():GameState{
  if(!started||!world.map)return state;
  return {...captureSession(state,{dead:world.player.dead,map:world.map.def.id,x:world.player.x,y:world.player.y,hp:world.player.hp,sp:world.player.sp}),mvpCooldowns:world.exportMvpCooldowns(),exploreCooldowns:world.exportExploreCooldowns(),exploreChests:world.exportChests()};
}
/** Saves the latest state; writes are serialized so an older snapshot never lands after a newer one. */
function persist(){
  if(replacing||LAB)return Promise.resolve();
  return saveQueue.write(async()=>{await store.save(snapshot());}).catch(e=>{ui?.log(`存檔失敗：${e instanceof Error?e.message:e}。請保留遊戲分頁並匯出備份。`,'warn');});
}
function run(fn:(s:GameState,c:Ctx)=>GameState,ok?:string,sfx?:'buy'|'click'|'levelup'):boolean{
  if(replacing||world.player.dead){ui.log('請先完成目前的復活或存檔操作。','warn');return false;}
  try{
    state=fn(snapshot(),ctx());refreshStats();ui.refresh();
    if(ok)ui.log(ok,'sys');if(sfx)audio.play(sfx);void persist();return true;
  }catch(e){ui.log(e instanceof Error?e.message:String(e),'warn');audio.play('error');return false;}
}
/** v6.0: scripted content that appears when a map loads (the 誓約試煉 guardian). */
/** v6.3 星光深淵: the floor to build when the abyss map loads. */
let abyssNext=0;
/** v7.0 星淵挑戰 to start when the arena loads. */
let challengeNext:Parameters<World['startChallenge']>[0]|null=null;
const abyssCheckpoint=()=>{const b=state.abyss?.best??0;return b>=5?b-b%5+1:1;};
function afterMapLoad(){
  if(world.map.def.id==='abyss'&&challengeNext){world.startChallenge(challengeNext);challengeNext=null;}
  else if(world.map.def.id==='abyss'){world.startAbyssFloor(abyssNext||abyssCheckpoint());abyssNext=0;}
  if(world.map.def.id===R.OATH_MAP&&R.ascensionOf(state).stage===2&&!state.char.job2){
    const job2=secondJobOf[state.char.job];if(job2){world.spawnBoss(`oath_${job2}`,22,18);ui.banner(`⚔ 誓約試煉：擊敗${monsters[`oath_${job2}`].name}！`,'gold');ui.log('守護者出現了！牠會預警重擊，看到地上的紅圈就快閃開。試煉中倒下不會損失經驗。','mvp');}}
}
function changeMap(to:string,x:number,y:number){
  state=snapshot();world.loadMap(to,x,y);scene.targeting=null;scene.loadMap(world.map);afterMapLoad();
  state=R.recordVitals(state,{map:to,x:world.player.x,y:world.player.y},world.player.hp,world.player.sp);
  ui.closeDialog();ui.refresh();ui.log(`進入 ${maps[to].name}（${maps[to].levelHint}）`,'sys');audio.play('warp');audio.playMusic(maps[to].theme);void persist();if(navigation)continueNavigation();
}
function navigateQuest(questId?:string){
  if(world.player.dead||replacing)return;
  const status=R.questStatus(state),challenge=questId?R.challengeStatuses(state).find(c=>c.def.id===questId):undefined;
  const q=questId?quests.find(q=>q.id===questId):status?.def;
  if((challenge?.done&&!challenge.completed)||(status?.done&&(!questId||questId===status.def.id))){
    const n=maps.town.npcs.find(n=>n.id==='guide')!;navigation={map:'town',x:n.x+.5,y:n.y+.5,name:n.name,npc:n.id};
  }else navigation=q?questDestination(q):null;
  if(!navigation){ui.log('目前沒有需要導航的目標。','sys');return;}
  ui.closeAll();ui.closeDialog();continueNavigation();
}
/** v4.9 hunt target (farm one monster kind): remembered per browser. */
function setHunt(id:string|null){
  world.huntTarget=id&&monsters[id]?id:null;try{if(world.huntTarget)localStorage.setItem('starlight-hunt',world.huntTarget);else localStorage.removeItem('starlight-hunt');}catch{/* preference only */}
  if(world.huntTarget){const spot=huntSpot(world.huntTarget);ui.log(`🎯 狩獵目標：${monsters[world.huntTarget].name}${spot?`（${maps[spot.map].name}的棲息地，小地圖上的圓圈）`:''}。自動戰鬥會優先打牠。`,'sys');}
  else ui.log('已取消狩獵目標。','sys');ui.update();
}
function navigateHunt(){
  const id=world.huntTarget;if(!id||world.player.dead)return;const spot=huntSpot(id);
  if(!spot){ui.log('這種魔物沒有固定棲息地，請用圖鑑查看出沒地點。','sys');return;}
  navigation={map:spot.map,x:spot.h.x+.5,y:spot.h.y+.5,name:`${monsters[id].name}的棲息地`,monster:id};ui.closeAll();continueNavigation();
}
function continueNavigation(){
  if(!navigation||world.player.dead)return;
  const warp=nextWarp(world.map.def.id,navigation.map);
  let x=warp?warp.x+.5:navigation.x,y=warp?warp.y+.5:navigation.y;
  if(!warp&&navigation.monster){const target=world.monsters.filter(m=>m.def.id===navigation!.monster&&m.state!=='dead').sort((a,b)=>Math.hypot(a.x-world.player.x,a.y-world.player.y)-Math.hypot(b.x-world.player.x,b.y-world.player.y))[0];if(target){x=target.x;y=target.y;}}
  const label=warp?`前往 ${maps[warp.to].name} → ${navigation.name}`:navigation.name;
  scene.setNavigation({x,y,label});world.moveTo(x,y);
  ui.log(`導航：${label}。途中仍可能遇到主動魔物，手動移動可停止。`,'sys');
  if(!warp){if(navigation.npc)world.talk(navigation.npc);navigation=null;}
}

function useItem(id:string){
  const def=items[id];if(!def||def.kind!=='use')return;
  if((state.items[id]??0)<1){ui.log(`沒有 ${def.name} 了。`,'warn');audio.play('error');return;}
  if(world.player.dead)return;
  if(def.effect==='teleport'&&world.inTown){ui.log('城鎮內不能使用瞬移葉。','warn');return;}
  if(def.effect==='tame'){tame();return;}
  if(def.food){if(!run(s=>R.consumeItem(s,id)))return;const prev=world.eat(id,def.food.hp,def.food.sp,def.food.dur);
    ui.log(prev&&prev!==id?`吃下${def.name}，取代了${items[prev]?.name??'原本的食物'}的效果。`:`吃下${def.name}，接下來 ${def.food.dur} 秒會慢慢回復。`,'item');audio.play('heal');ui.update();return;}
  if((!def.hp||world.player.hp>=world.derived.maxHp)&&(!def.sp||world.player.sp>=world.derived.maxSp)&&!def.effect){ui.log('目前不需要回復，已保留道具。','sys');return;}
  if(!run(s=>R.consumeItem(s,id)))return;
  if(def.effect==='return'){changeMap(state.savePoint.map,state.savePoint.x,state.savePoint.y);return;}
  if(def.effect==='teleport'){world.teleportRandom();audio.play('warp');return;}
  world.heal(def.hp??0,def.sp??0);audio.play('heal');
}
/** 星光誘捕器: try to capture the hovered monster (or the current target) as a pet. */
function tame(){
  if(world.inTown){ui.log('城鎮裡沒有可以捕捉的魔物。','warn');return;}
  const hov=scene.hovered(),cur=world.player.target?.kind==='monster'?world.player.target.id:null,id=hov?.id??cur;
  const m=id!==null?world.monsters.find(x=>x.id===id):undefined;
  if(!m){ui.log('請把滑鼠指著要捕捉的魔物，或先攻擊牠。','warn');audio.play('error');return;}
  const pet=petByMonster(m.def.id);if(!pet||m.def.mvp){ui.log(`${m.def.name}無法成為寵物。`,'warn');audio.play('error');return;}
  if(!run(s=>R.consumeItem(s,TAME_ITEM)))return;
  const r=world.tryCapture(m.id);
  if('error' in r){ui.log(r.error,'warn');state=R.addItem(state,TAME_ITEM,1);ui.refresh();return;}
  if(scene instanceof Scene3D)scene.tameEffect(r.x,r.y,r.ok);
  if(!r.ok){ui.log(`捕捉 ${m.def.name} 失敗了……把牠的血量打低一點再試試。`,'warn');audio.play('error');return;}
  const t=R.tamePet(state,pet.id);state=t.state;refreshStats();ui.refresh();audio.play('card');
  if(t.isNew){ui.banner(`獲得寵物「${pet.name}」！`,'gold');ui.log(`♥ ${pet.name} 成為你的夥伴了！按 P 查看寵物。`,'card');}
  else ui.log(`又遇到一隻${m.def.name}，${pets[pet.id].name} 的親密度 +50。`,'card');
  void persist();
}
function useHotkey(i:number){
  const h=state.hotbar[i];if(!h||!started||world.player.dead)return;
  audio.unlock();
  if(h.type==='item'){useItem(h.id);return;}
  const sk=skills[h.id];if(!sk)return;
  if(sk.target==='self'){world.useSkill(h.id,null,null);return;}
  // v4.9 single-target skills aim ONLY by the mouse: the monster on/nearest the cursor (bosses included).
  // No auto-lock fallback — while kiting a boss, a passing mob must never steal the spell.
  const range=(sk.range??9);
  if(sk.target==='enemy'){
    const p=world.player,t=scene.hovered()??(scene instanceof Scene3D?scene.nearCursor():null);
    // No target under/near the cursor → no targeting arrow; just a clear on-screen hint (move the mouse onto a monster, press again).
    if(t&&Math.hypot(t.x-p.x,t.y-p.y)<=range+3){world.useSkill(h.id,t.id,null);scene.targeting=null;}
    else{scene.targeting=null;ui.castHint(t?`${t.def.name} 太遠了，靠近一點再放`:'滑鼠旁邊沒有魔物',t?'靠近後再按一次技能鍵':'把滑鼠移到魔物身上，再按技能鍵');audio.play('error');}
  }else{
    // Area skills stay player-aimed: first press shows the area, click (or press again) to release at the cursor.
    if(scene.targeting===h.id){if(world.useSkill(h.id,null,scene.cursorWorld()))scene.targeting=null;}else scene.targeting=h.id;
  }
  ui.update();
}
function respawn(){
  navigation=null;scene.clearNavigation();
  const sp=state.savePoint;world.loadMap(sp.map,sp.x,sp.y);world.respawn();scene.loadMap(world.map);
  ui.refresh();ui.log('在存檔點醒來了。','sys');audio.playMusic(world.map.def.theme);void persist();
}
function onPresentationEvents(ev:SimEvent[]){
  for(const event of ev)for(const sfx of combatSounds(event,world.derived))audio.play(sfx,'combat');
}
function onEvents(ev:SimEvent[]){
  let dirty=false;
  for(const e of ev){
    // Skill mastery grows on every cast, whichever renderer presents the effect.
    if(e.t==='skill')gainMasteryFor(e.skill);
    if(use3d&&(e.t==='dmg'||e.t==='swing'||e.t==='skill'||e.t==='castStart'||e.t==='fx'))continue;
    switch(e.t){
      case 'dmg':
        if(e.to==='m')audio.play(e.miss?'miss':e.crit?'crit':'hit');
        else audio.play(e.miss?'miss':'hurt');
        break;
      case 'swing':if(e.who==='p'&&!world.derived.ranged)audio.play('swing');break;
      case 'skill':{
        const el=skills[e.skill].element;audio.play(el==='fire'?'fire':el==='water'?'ice':el==='wind'?'thunder':skills[e.skill].tags.includes('ranged')?'arrow':'swing');break;}
      case 'castStart':audio.play('cast');break;
      case 'fx':if(e.kind==='arrow')audio.play('arrow');break;
      case 'kill':{
        if(!use3d)audio.play('kill');
        state=R.noteKill(state,e.monster);
        const xm=world.eventExpMult,ex=Math.round(e.exp*xm),jx=Math.round(e.jexp*xm);
        const r=R.gainExp(state,ex,jx);state=r.state;dirty=true;
        ui.log(`打倒 ${monsters[e.monster].name}：基本經驗 +${ex}、職業經驗 +${jx}${xm>1?'（流星雨加成）':''}`,'exp');
        if(r.baseUps){scene.levelUp('base');audio.play('levelup');world.setStats(R.derive(state),state.char.baseLv);world.setVitals(state.char.hp,state.char.sp);
          ui.log(`基本等級提升到 ${state.char.baseLv}！獲得素質點，按 A 分配。${state.char.baseLv>=40?'也獲得 1 星點，按 T 打開星光天賦。':''}`,'exp');}
        if(r.jobUps){setTimeout(()=>scene.levelUp('job'),r.baseUps?600:0);audio.play('joblevel');
          ui.log(state.char.job2?`職業等級：一轉 Job ${state.char.jobLv}、二轉 Lv.${state.char.job2Lv}！按 S 學習技能。`:`職業等級提升到 ${state.char.jobLv}！獲得技能點，按 S 學習技能。`,'exp');}
        // v6.5: announce a newly unlocked 戰魂.
        if(r.jobUps&&state.char.job==='swordman'&&!state.char.job2){const so=Object.values(SOULS).find(x=>x.unlock>1&&x.unlock>state.char.jobLv-r.jobUps&&x.unlock<=state.char.jobLv);
          if(so){ui.banner(`${so.icon} 解鎖戰魂「${so.name}」！`,'gold');ui.log(`${so.icon} 解鎖戰魂「${so.name}」：${so.desc} 在城鎮按 S，於技能視窗上方切換。`,'card');}}
        if(e.monster.startsWith('oath_')&&R.ascensionOf(state).stage===3&&!state.char.job2){ui.banner('✦ 誓約試煉完成！回曙光前哨找艾德舉行轉職儀式','gold');ui.log('你打倒了誓約守護者！走出西邊的出口回到曙光前哨，找遠征隊長艾德。','mvp');audio.play('levelup');}
        state=R.petKill(state);
        if(e.mvp){const mu=Object.values(mounts).find(d=>d.unlock===e.monster&&(!d.knightOnly||state.char.job2==='knight'));if(mu){const u=R.unlockMount(state,mu.id);state=u.state;if(u.isNew){ui.banner(`★ 得到傳說坐騎「${mu.name}」！`,'gold');ui.log(`★ ${mu.name} 認可了你！按 B 選用，按 R 騎乘。`,'card');}}}
        if(e.mvp){const unlock=Object.values(costumes).find(c=>c.unlock===e.monster);if(unlock){const u=R.unlockCostume(state,unlock.id);state=u.state;if(u.isNew){ui.log(`★ 解鎖外觀「${unlock.name}」！按 V 打開衣櫥穿上。`,'card');}}}
        if(e.mvp){state=R.recordMvp(state,e.monster);ui.banner(`MVP！${state.char.name} 擊敗了 ${monsters[e.monster].name}！`,'gold');audio.play('mvp');}
        if(r.baseUps||r.jobUps){refreshStats();ui.refresh();void persist();}
        break;}
      case 'pickup':{
        const it=e.item;
        if(it.kind==='card'){const r=R.addCard(state,it.defId);state=r.state;ui.log(`★ 獲得 ${cards[it.defId].name}！`,'card');ui.celebrateCard(it.defId);audio.cardFanfare(!!monsters[cards[it.defId].monster]?.mvp);void persist();}
        else{const def=items[it.defId],roll=def.kind==='equip'?rollEquip(it.defId,(it.q??0) as Quality,Math.random,state.char.job):undefined;
          state=R.addItem(state,it.defId,it.count,roll);world.embers=state.items.eclipseEmber??0;
          if(it.defId==='starSigil'){ui.banner('🜂 得到星淵印記！','gold');ui.log('得到星淵印記：交給前哨或港口的星淵通訊員，開啟一場印記地城。','card');}
          if(roll&&roll.q>0)announceGear(def.name,roll);else{ui.log(`獲得 ${def.name}`,'item');audio.play('pickup');}dirty=true;}
        ui.refresh();break;}
      case 'warp':changeMap(e.to,e.tx,e.ty);break;
      case 'npc':ui.showDialog(e.id);audio.play('click');break;
      case 'death':{navigation=null;scene.clearNavigation();if(world.abyss)ui.log(`在星光深淵第 ${world.abyss.floor} 層倒下了。最高紀錄：第 ${state.abyss?.best??0} 層。深淵裡倒下不會損失經驗。`,'mvp');
        const trial=world.map.def.id===R.OATH_MAP||world.map.def.id==='abyss',lost=state.char.baseLv>=10&&!trial;state=R.applyDeath(snapshot(),trial);audio.play('death');ui.showDeath(lost);void persist();break;}
      case 'chest':{
        if(e.chest.tier==='eclipse'){openEclipseChest();dirty=true;break;}
        const ab=e.map==='abyss'&&world.abyss?world.abyss:null;
        const c=e.chest as typeof e.chest&{tier:Exclude<typeof e.chest.tier,'eclipse'>},loot=ab?X.rollAbyssChest(ab.floor,ab.boss,Math.random,state.char.baseLv):X.rollChest(e.map,c.tier,Math.random,c.elite),before=new Set(state.equipment.map(x=>x.id));state=X.openChest(snapshot(),loot,c.tier);
        // Abyss chests: gear near the floor's level that is never plain; deeper floors and boss floors roll better.
        if(ab)for(const id of X.abyssGear(ab.floor,ab.boss,Math.random,state.char.baseLv)){const bonus=(ab.boss?4:2)*(1+ab.floor/25);
          const q=Math.max(ab.boss?2:1,rollQuality(Math.random(),bonus)) as Quality;state=R.addItem(state,id,1,rollEquip(id,q,Math.random,state.char.job));}
        for(const g of state.equipment)if(!before.has(g.id)&&g.q)announceGear(items[g.defId].name,{q:g.q,affix:g.affix??[],legend:g.legend});
        const parts=[`${loot.zeny.toLocaleString()} z`,...Object.entries(loot.items).map(([id,n])=>`${items[id].name}${n>1?` ×${n}`:''}`)];
        const label={normal:'寶箱',rare:'稀有寶箱',trial:'試煉寶箱',supply:'補給箱'}[c.tier];
        ui.log(`打開${label}：${parts.join('、')}`,c.tier==='normal'||c.tier==='supply'?'item':'card');
        if(c.tier==='rare'||c.tier==='trial'){ui.banner(`${c.tier==='trial'?'✦ 試煉寶箱':'★ 稀有寶箱'}！${parts.slice(1).join('、')}`,'gold');audio.play('levelup');}else audio.play('pickup');
        if(loot.card){ui.log(`★ 獲得 ${cards[loot.card].name}！`,'card');ui.celebrateCard(loot.card);audio.cardFanfare(false);}
        dirty=true;break;}
      case 'worldEvent':{
        const nm=WORLD_EVENT_NAMES[e.kind];
        if(e.phase==='start'){ui.eventAnnounce(`${nm.icon} ${nm.name}`,e.text,e.kind);audio.play(e.kind==='invasion'?'mvp':'levelup');}
        else if(e.phase==='success'){ui.banner(`${nm.icon} ${e.text}`,'gold');audio.play('levelup');
          if(e.zeny){state=R.addZeny(snapshot(),e.zeny);ui.log(`黃金魔物噴出 ${e.zeny.toLocaleString()} z！`,'card');}
          if(e.exp){const r=R.gainExp(snapshot(),e.exp,Math.round(e.exp*.8));state=r.state;ui.log(`擊退大進攻：基本經驗 +${e.exp.toLocaleString()}`,'exp');if(r.baseUps){scene.levelUp('base');world.setStats(R.derive(state),state.char.baseLv);}}
          dirty=true;}
        else ui.banner(`${nm.icon} ${e.text}`);
        ui.log(`${nm.icon} ${e.text}`,e.phase==='fail'?'warn':'mvp');break;}
      case 'explore':ui.log(e.text,'sys');ui.banner(e.text);break;
      case 'abyss':
        if(e.phase==='start'){ui.banner(`🌌 星光深淵 第 ${e.floor} 層${e.boss?'・首領層':''}`,'gold');ui.log(`星光深淵第 ${e.floor} 層（魔物約 Lv.${World.abyssLevel(e.floor)}）${e.boss?'：首領出現了！':'：打倒全部魔物就能前進。'}`,'mvp');audio.play(e.boss?'mvp':'warp');}
        else{const r=R.clearAbyssFloor(snapshot(),e.floor,e.exp??0,e.zeny??0);state=r.state;if(r.baseUps){scene.levelUp('base');refreshStats();}
          ui.log(`第 ${e.floor} 層突破！經驗 +${(e.exp??0).toLocaleString()}、${(e.zeny??0).toLocaleString()} z${r.record?'（新紀錄！）':''}。寶箱出現在中央。`,'card');audio.play('levelup');
          ui.abyssClear(e.floor,r.record);void persist();}
        break;
      case 'challenge':onChallenge(e);dirty=true;break;
      case 'starfall':ui.banner(e.text,'gold');ui.log(e.text,'mvp');audio.play('levelup');break;
      case 'trialStart':ui.banner(`⚔ ${e.name}開始！擊敗【試煉】精英`,'gold');ui.log(`${e.name}開始了！打倒強化的試煉精英就能得到試煉寶箱。離開地圖會中斷試煉。`,'mvp');audio.play('mvp');break;
      case 'trialDone':state=X.noteTrial(snapshot(),e.key);ui.banner(`✦ ${e.name}完成！試煉寶箱出現了`,'gold');ui.log(`${e.name}完成！地標旁出現了試煉寶箱。`,'mvp');audio.play('levelup');dirty=true;break;
      case 'mvpSpawn':if(started){ui.banner(`【MVP】${monsters[e.monster].name} 出現在 ${e.map}！`);ui.log(`【MVP】${monsters[e.monster].name} 重新出現了！`,'mvp');audio.play('mvp');}break;
      case 'fail':ui.log(e.reason,'warn');audio.play('error');break;
    }
  }
  if(dirty)scheduleSave();
}
let saveTimer:number|undefined;
/** v6.3: a quality drop gets its affixes in the log; 稀有 a chime, 傳說 a banner and the card fanfare. */
function announceGear(name:string,roll:Roll){
  const label=`${QUALITY[roll.q].name}・${name}`,lines=[...roll.affix.map(affixText),...(roll.legend?[`✦ ${GEAR_FX[roll.legend]}`]:[])];
  ui.log(`★ 獲得 ${label}：${lines.join('、')}`,roll.q>=2?'card':'item');
  if(roll.q===4){const d=items[Object.keys(items).find(k=>items[k].name===name)??'']as EquipDef|undefined;ui.banner(`✸ 唯一裝備！${name}`,'gold');audio.cardFanfare(true);if(scene instanceof Scene3D)scene.celebrate('#e0b25a');if(d?.fx)ui.log(`✸ ${name}：${GEAR_FX[d.fx]}`,'card');}
  else if(roll.q===3){ui.banner(`✦ 傳說裝備！${label}`,'gold');audio.cardFanfare(true);if(scene instanceof Scene3D)scene.celebrate('#ff8a3d');}
  else if(roll.q===2)audio.play('levelup');else audio.play('pickup');
}
function scheduleSave(){if(saveTimer)return;saveTimer=window.setTimeout(()=>{saveTimer=undefined;void persist();},4000);}

// ———————————————————————— v7.0 星淵紀元 ————————————————————————
/** Adds challenge gear and announces it. */
function giveGear(list:{id:string;roll:Roll}[]){for(const g of list){state=R.addItem(state,g.id,1,g.roll);announceGear(items[g.id].name,g.roll);}}
function giveExp(exp:number,zeny=0){if(zeny)state=R.addZeny(state,zeny);if(exp<=0)return;const r=R.gainExp(state,exp,Math.round(exp*.7));state=r.state;
  if(r.baseUps){scene.levelUp('base');audio.play('levelup');}if(r.baseUps||r.jobUps){refreshStats();world.setVitals(state.char.hp,state.char.sp);}}
function addDust(n:number){if(n>0)state=R.addItem(state,'starDust',n);}
function openEclipseChest(){
  state=snapshot();const have=state.items.eclipseEmber??0;if(have<ECLIPSE.chestCost){ui.log('星蝕餘燼不夠。','warn');return;}
  state=structuredClone(state);state.items.eclipseEmber=have-ECLIPSE.chestCost;if(!state.items.eclipseEmber)delete state.items.eclipseEmber;world.embers=state.items.eclipseEmber??0;
  const t=SF.tierOf(state),lv=Math.min(90,state.char.baseLv+3);giveGear(SF.challengeGear(lv,2,2,3*t.quality,.04*t.unique,Math.random,state.char.job));addDust(4);
  ui.banner('🌑 打開星蝕寶箱！','gold');ui.log(`🌑 打開星蝕寶箱：得到 2 件裝備與 4 星塵（剩 ${state.items.eclipseEmber??0} 星蝕餘燼）。`,'card');audio.play('levelup');
}
function rollSigilAffixes(lv:number):SigilAffix[]{const pick=<T,>(l:T[])=>l[Math.floor(Math.random()*l.length)];
  const bad=[...SIGIL_BAD],out:SigilAffix[]=[bad.splice(Math.floor(Math.random()*bad.length),1)[0]];
  if(lv>=10)out.push(bad.splice(Math.floor(Math.random()*bad.length),1)[0]);out.push(pick(SIGIL_GOOD));return out;}
function enterChallenge(spec:NonNullable<typeof challengeNext>){if(world.player.dead||replacing)return;challengeNext=spec;changeMap('abyss',6,20);}
function onChallenge(e:Extract<SimEvent,{t:'challenge'}>){
  const c=world.challenge;
  if(e.phase==='start'||e.phase==='room'||e.phase==='boss'||e.phase==='wave'){ui.banner(e.text,'gold');ui.log(e.text,'mvp');audio.play(e.phase==='boss'?'mvp':'warp');return;}
  if(e.phase==='choose'&&c?.kind==='horde'){ui.log(e.text,'mvp');audio.play('levelup');ui.hordeChoice(c.offer,c.wave,c.boons);return;}
  if(!c)return;const won=e.phase==='won',t=SF.tierOf(state),job=state.char.job;state=snapshot();
  ui.banner(e.text,won?'gold':undefined);ui.log(e.text,won?'card':'warn');audio.play(won?'levelup':'error');
  const lines:string[]=[];
  if(c.kind==='pit'){const L=c.level;
    if(won){const rec=SF.recordPit(state,c.tier);state=rec.state;const g=SF.challengeGear(L,2+Math.floor(c.tier/10),c.tier>=10?3:2,3+c.tier/5,(t.unique?.08*t.unique:0)+(c.tier>=20?.05:0),Math.random,job);
      giveGear(g);addDust(5+c.tier);giveExp(Math.round(.55*L*L*(8+c.tier*.3)),L*L*4);if(Math.random()<.5)state=R.addItem(state,'starSigil',1);
      lines.push(`裝備 ${g.length} 件、星塵 ${5+c.tier}${rec.record?'、新紀錄！':''}`);}
    else{addDust(2);lines.push('星塵 2');}}
  if(c.kind==='horde'){const ember=Math.floor(c.embers*(won?1:.5)),waves=won?HORDE.waves:c.wave-1,L=c.level+c.wave;
    const rec=SF.recordHorde(state,waves);state=rec.state;
    const n=Math.min(8,Math.floor(ember/HORDE.perEmber)),g=SF.challengeGear(L,n,won?2:1,3*t.quality,.03*t.unique+(won?.02:0),Math.random,job);giveGear(g);
    addDust(Math.floor(ember/3));giveExp(Math.round(.55*L*L*waves*3),Math.round(L*L*waves));if(won)state=R.addItem(state,'starSigil',1);
    lines.push(`星焰 ${ember} → 裝備 ${g.length} 件、星塵 ${Math.floor(ember/3)}${rec.record?`、新紀錄（${waves} 波）！`:''}`);}
  if(c.kind==='sigil'&&won){const L=c.level,r=SF.clearSigil(state,Math.random);state=r.state;
    const g=[...SF.challengeGear(L,1,3,4,t.unique*.06,Math.random,job),...SF.challengeGear(L,c.affixes.includes('treasure')?2:1,2,3*t.quality,0,Math.random,job)];giveGear(g);
    addDust(8+c.lv);giveExp(Math.round(.55*L*L*(10+c.lv*.4)*(c.affixes.includes('bounty')?1.5:1)),L*L*5);
    if(r.learned){ui.banner(`📖 威能圖鑑：學會「${ASPECT_NAMES[r.learned]}」！`,'gold');ui.log(`📖 威能圖鑑學會了「${ASPECT_NAMES[r.learned]}」：${GEAR_FX[r.learned]} 到工匠的星淵工坊就能烙印到裝備上。`,'card');}
    lines.push(`傳說裝備 1 件＋裝備 ${g.length-1} 件、星塵 ${8+c.lv}，印記等級升到 ${SF.starfallOf(state).sigilLv}`);}
  if(lines.length)ui.log(`獎勵：${lines.join('；')}`,'card');
  refreshStats();ui.refresh();void persist();
  // A death keeps the respawn dialog; the rewards are already in the log.
  if(!world.player.dead)ui.challengeDone(won,e.text,lines.join('；'));
}
const main:Main={
  state:()=>state,world,audio,settings,run,useHotkey,look,
  create:(name,hair,color)=>{state=R.createCharacter(R.newGame(),name,hair,color);void persist();},
  respawn,warp:changeMap,applySettings,navigateQuest,setHunt,navigateHunt,hunt:()=>world.huntTarget,
  completeChallenge:id=>{
    try{const r=R.completeChallenge(snapshot(),id);state=r.state;refreshStats();if(r.baseUps||r.jobUps)world.setVitals(state.char.hp,state.char.sp);ui.refresh();ui.log(`完成挑戰「${r.def.title}」！獎勵已收下。`,'exp');audio.play('levelup');void persist();return true;}
    catch(e){ui.log(e instanceof Error?e.message:String(e),'warn');return false;}
  },
  exportSave:()=>JSON.stringify(snapshot()),
  importSave:async text=>{
    if(replacing)return;
    if(LAB){ui.log('試玩場不能匯入存檔（避免覆蓋你的正式存檔）。請關掉 ?lab= 再匯入。','warn');return;}
    try{const parsed=R.normalizeGame(JSON.parse(text));R.validateGame(parsed);R.derive(parsed);replacing=true;
      await saveQueue.exclusive(async()=>{await store.save(parsed);});started=false;state=parsed;location.reload();}
    catch(e){replacing=false;ui.log(`匯入失敗：${e instanceof Error?e.message:e}。原本的存檔沒有被改動。`,'warn');}
  },
  resetGame:async()=>{if(replacing)return;if(LAB){ui.log('試玩場不能重設遊戲（避免刪除你的正式存檔）。','warn');return;}replacing=true;try{await saveQueue.exclusive(()=>store.clear());started=false;location.reload();}catch(e){replacing=false;ui.log('無法重設，原有進度仍保留。','warn');}},
  isTargeting:()=>scene.targeting,
  celebrate:color=>{if(scene instanceof Scene3D)scene.celebrate(color);},
  switchCharacter:async()=>{if(replacing)return;if(LAB){ui.log('試玩角色不能切換，關掉 ?lab= 就會回到選角畫面。','warn');return;}
    replacing=true;try{await saveQueue.exclusive(async()=>{await store.save(snapshot());});started=false;location.reload();}
    catch(e){replacing=false;ui.log(`存檔失敗，沒有切換：${e instanceof Error?e.message:e}`,'warn');}},
  abyssEnter:(floor:number)=>{if(world.player.dead)return;abyssNext=floor;changeMap('abyss',6,20);},
  abyssNext:()=>{const a=world.abyss;if(!a?.cleared)return;world.startAbyssFloor(a.floor+1);},
  abyssBest:()=>state.abyss?.best??0,
  pitEnter:(tier:number)=>enterChallenge({kind:'pit',tier}),
  hordeEnter:()=>enterChallenge({kind:'horde'}),
  sigilEnter:()=>{try{state=SF.useSigil(snapshot(),ctx());}catch(e){ui.log(e instanceof Error?e.message:String(e),'warn');return;}
    const lv=SF.starfallOf(state).sigilLv;void persist();enterChallenge({kind:'sigil',lv,affixes:rollSigilAffixes(lv)});},
  hordeChoose:(b:BoonId)=>{if(world.hordeChoose(b)){ui.log(`選擇祝福「${BOONS[b].icon} ${BOONS[b].name}」：${BOONS[b].desc}`,'card');audio.play('levelup');}},
  leaveArena:()=>{world.leaveChallenge();changeMap('frontier',37,26);},
  ascend:()=>{
    try{const before=state.char.job;state=R.changeJob2(snapshot(),ctx());refreshStats();world.setVitals(state.char.hp,state.char.sp);
      const j2=jobs[state.char.job2!];ui.celebrateJob(j2.id);
      // 騎士的招牌：轉職儀式送星光大嘴鳥，當場騎上去。
      if(state.char.job2==='knight'){state=R.unlockMount(state,'pecoPeco').state;state=R.setMount(state,'pecoPeco');world.setRiding(true,mounts.pecoPeco.speed,'pecoPeco');
        ui.log('★ 得到騎士的招牌坐騎「星光大嘴鳥」！星誓騎士騎在牠背上也能戰鬥（按 R 上下坐騎）。','card');}audio.cardFanfare(true);if(scene instanceof Scene3D)scene.ascendFx(j2.color);
      ui.banner(`★ ${state.char.name} 成為了 ${j2.name}！`,'gold');ui.log(`★ 轉職儀式完成！你從${jobs[before].name}成為了${j2.name}。得到了轉職武器，按 S 學習第一招二轉技能。`,'card');
      ui.refresh();ui.refreshHotbar();void persist();}
    catch(e){ui.log(e instanceof Error?e.message:String(e),'warn');audio.play('error');}
  },
  toggleRide,
  setRiding:on=>{const id=state.mounts?.active??null;world.setRiding(on&&!!id,id?mounts[id].speed:1,id);ui.update();},
  emote:id=>{if(scene instanceof Scene3D&&!world.player.dead){if(world.player.sitting)world.toggleSit();if(!scene.emote(id))ui.log('這個表情還在準備中，稍後再試。','warn');}},
  completeBounty:()=>{
    try{
      const r=X.completeBounty(snapshot());state=r.state;
      ui.log(`懸賞完成：${monsters[r.bounty.monster].name} ×${r.bounty.count}！獲得 ${r.bounty.zeny.toLocaleString()} z、經驗與食物。`,'exp');audio.play('levelup');
      if(r.baseUps){scene.levelUp('base');}if(r.jobUps){setTimeout(()=>scene.levelUp('job'),r.baseUps?600:0);}
      refreshStats();if(r.baseUps||r.jobUps)world.setVitals(state.char.hp,state.char.sp);ui.refresh();void persist();return true;
    }catch(e){ui.log(e instanceof Error?e.message:String(e),'warn');audio.play('error');return false;}
  },
  completeQuest:()=>{
    try{
      const r=R.completeQuest(snapshot());state=r.state;
      ui.log(`完成任務「${r.def.title}」！獲得 ${r.def.reward.zeny.toLocaleString()} z 與獎勵道具。`,'exp');audio.play('levelup');
      if(r.def.id==='lampWick12'){world.flags=state.flags??{};ui.banner('✦ 貝露燈塔重新點亮了！星燈航路的第一盞燈','gold');ui.log('芮比把新的燈芯裝進星燈——海角的燈塔亮了，夜航港的燈台也跟著亮起來。遠方，第一艘返航的船正在靠岸。','card');
        audio.cardFanfare(true);if(world.map.def.id==='harbor'||world.map.def.id==='bellBay')scene.loadMap(world.map);}
      if(r.baseUps){scene.levelUp('base');}if(r.jobUps){setTimeout(()=>scene.levelUp('job'),r.baseUps?600:0);}
      refreshStats();if(r.baseUps||r.jobUps)world.setVitals(state.char.hp,state.char.sp);ui.refresh();void persist();return true;
    }catch(e){ui.log(e instanceof Error?e.message:String(e),'warn');audio.play('error');return false;}
  },
  refine:equipId=>{
    try{
      const before=state.equipment.find(e=>e.id===equipId);
      const r=R.refine(snapshot(),equipId,Math.random(),ctx());state=r.state;
      const after=state.equipment.find(e=>e.id===equipId)!;
      if(r.success){ui.log(`精煉成功！${R.equipLabel(after)}`,'card');audio.play('levelup');}
      else{ui.log(`精煉失敗……${before?R.equipLabel(before):''} 沒有變化（只花了 Zeny）。`,'warn');audio.play('error');}
      refreshStats();ui.refresh();void persist();
    }catch(e){ui.log(e instanceof Error?e.message:String(e),'warn');audio.play('error');}
  },
};

function gainMasteryFor(skill:string){
  const g=R.gainMastery(state,skill);state=g.state;if(!g.tierUp)return;
  refreshStats();const aw=awakenings[skill],nm=skills[skill].name;
  if(g.tierUp===3){ui.banner(`✦ ${nm} 覺醒！「${aw.name}」`,'gold');ui.log(`✦ ${nm} 覺醒為「${aw.name}」：${aw.desc}`,'card');audio.play('levelup');main.celebrate?.('#ffd45c');}
  else{ui.banner(`${nm} 熟練度提升：${MASTERY_NAMES[g.tierUp]}`);ui.log(`${nm} 熟練度提升為 ${MASTERY_NAMES[g.tierUp]}，傷害與效率提高了！`,'sys');main.celebrate?.('#9fe0ff');}
  ui.refresh();void persist();
}
/** R: jump on / off the active mount. */
function toggleRide(){
  const id=state.mounts?.active;if(!id){ui.log('還沒有坐騎。按 B 打開夥伴視窗，在城鎮購買波利坐騎。','warn');return;}
  if(world.player.dead)return;const on=!world.riding;world.setRiding(on,mounts[id].speed,id);
  ui.log(on?`騎上了${mounts[id].name}！`:'跳下坐騎。','sys');audio.play('click');ui.update();
}
function onKey(e:KeyboardEvent){
  if(e.repeat||replacing)return;
  const t=e.target;if((t instanceof Element&&t.closest('input,textarea,select'))||!started)return;
  audio.unlock();audio.playMusic(world.map.def.theme);
  const k=e.key.toLowerCase();
  if(k==='n'&&world.abyss?.cleared){ui.abyssClear(world.abyss.floor,false);return;}
  {const c=world.challenge;if(k==='n'&&c?.kind==='horde'&&c.phase==='choose'){ui.hordeChoice(c.offer,c.wave,c.boons);return;}}
  if(ui.dialogOpen&&k!=='escape')return;
  if(/^[1-9]$/.test(k)){useHotkey(Number(k)-1);e.preventDefault();return;}
  if(/^f[1-9]$/.test(k)){useHotkey(Number(k.slice(1))-1);e.preventDefault();return;}
  if(k==='escape'){if(world.player.dead&&ui.dialogOpen){e.preventDefault();return;}if(scene.targeting){scene.targeting=null;ui.update();return;}if(ui.anyWindow()){ui.closeAll();return;}if(ui.dialogOpen){if(!world.player.dead)ui.closeDialog();return;}if(ui.anyWindow())ui.closeAll();else ui.toggle('settings');return;}
  if(ui.dialogOpen)return;
  const wins:Record<string,'status'|'inventory'|'equip'|'skills'|'cards'|'pets'|'wardrobe'|'party'|'talents'|'forge'>={a:'status',e:'inventory',q:'equip',s:'skills',c:'cards',p:'pets',v:'wardrobe',b:'party',t:'talents',f:'forge'};
  if(wins[k]){ui.toggle(wins[k]);return;}
  if(k==='z'){world.setAuto(!world.player.auto);ui.log(world.player.auto?'自動戰鬥開啟（手動移動或點怪就會關閉）':'自動戰鬥關閉','sys');ui.update();return;}
  if(k==='x'||k==='insert'){world.toggleSit();ui.update();return;}
  if(k==='r'){toggleRide();return;}
  // v6.4 攻擊鍵: Space hits the monster near the cursor, or the nearest one around you.
  if(k===' '){e.preventDefault();const near=scene instanceof Scene3D?scene.nearCursor()?.id??null:null;if(!world.attackNearest(near))ui.log('附近沒有可以攻擊的魔物。','sys');return;}
}

async function boot(){
  ui=new UI(main);
  ui.useItemDirect=useItem;
  applySettings();
  if(navigator.locks&&!LAB){
    const got=await new Promise<boolean>(resolve=>{void navigator.locks.request('starlight-ro-writer',{ifAvailable:true},lock=>{resolve(!!lock);return lock?new Promise<void>(()=>{}):undefined;});});
    if(!got){document.body.innerHTML='<p style="color:#fff;font:16px sans-serif;padding:40px">星光冒險已經在另一個分頁開著了。請回到那個分頁遊玩，避免兩邊同時存檔。</p>';return;}
  }
  // v6.1: choose a character first (the lab character is throwaway and skips this).
  if(!LAB){
    const slot=await ui.showSlots(()=>store.summaries(),async n=>{const keep=store.slot;store.slot=n;try{await saveQueue.exclusive(()=>store.clear());}finally{store.slot=keep;}});
    store.slot=slot;try{localStorage.setItem('starlight-slot',String(slot));}catch{/* preference only */}
  }
  try{state=LAB??(await store.load())??R.newGame();}
  catch(e){document.body.innerHTML=`<p style="color:#fff;font:16px sans-serif;padding:40px">無法讀取存檔：${e instanceof Error?e.message:e}。原本的存檔沒有被覆蓋。</p>`;return;}
  scene.attach(world,{
    onEvents,onPresentationEvents,onPresentationReset:()=>audio.stopCombat(),inputBlocked:()=>ui.dialogOpen||!started||replacing||document.hidden,playerLook:()=>look(),playerName:()=>state.char.name,
    playerCostume:()=>({head:state.costumes?.head??null,back:state.costumes?.back??null}),playerPet:()=>state.created?state.activePet??null:null,playerMount:()=>world.riding?state.mounts?.active??null:null,
    onHover:t=>ui.hover(t),onTargetingEnd:()=>ui.update(),onManualInput:()=>{navigation=null;scene.clearNavigation();},onInspectLandmark:(title,text,key)=>{world.setAuto(false);if(key)state=X.noteFound(state,key);ui.showLandmark(title,text,key);},
  });
  if(scene instanceof Scene3D)scene.mount(document.getElementById('game')!);else createGame(document.getElementById('game')!,scene);
  await scene.whenReady;
  const start=(fresh:boolean)=>{
    refreshStats();
    if(state.char.hp<=0){state=R.recordVitals(state,state.savePoint,1,0);}
    world.importMvpCooldowns(state.mvpCooldowns??{});
    try{const h=localStorage.getItem('starlight-hunt');if(h&&monsters[h])world.huntTarget=h;}catch{/* preference only */}
    const pos=state.position;world.loadMap(pos.map,pos.x,pos.y);world.importExploreCooldowns(state.exploreCooldowns??{});world.importChests(state.exploreChests);
    const d=world.derived;world.setVitals(state.char.hp>0?state.char.hp:Math.round(d.maxHp*.5),state.char.sp);
    scene.loadMap(world.map);afterMapLoad();started=true;ui.refresh();
    ui.log(`歡迎${fresh?'':'回來'}，${state.char.name}！`,'sys');
    if(LAB){const demo=(id:string)=>{ui.celebrateCard(id);audio.cardFanfare(!!monsters[cards[id]?.monster]?.mvp);};
      (window as unknown as {demoCard:typeof demo}).demoCard=demo;
      (window as unknown as {labWorld:typeof world;labUi:typeof ui}).labWorld=world;(window as unknown as {labUi:typeof ui}).labUi=ui;(window as unknown as {labScene:typeof scene}).labScene=scene;
      if(labQ.get('demo')==='card')setTimeout(()=>demo('wolfCard'),1200);if(labQ.get('demo')==='mvp')setTimeout(()=>demo('jellyKingCard'),1200);}
    if(LAB&&LAB.char.job2)ui.log(`【二轉試玩場】${jobs[LAB.char.job2].name} Base ${LAB.char.baseLv}／二轉 Job 30，技能點已分配好，背包裡有三把流派武器。此角色不會存檔。切換：?lab=knight / wizard / ranger（&lv=60～90，&pre=1 改成準備二轉的一轉角色）`,'warn');
    else if(LAB&&labQ.get('pre')==='1')ui.log('【二轉試玩場】準備二轉的一轉角色：到曙光前哨找遠征隊長艾德接下「星路的徵召」。此角色不會存檔。','warn');
    else if(LAB)ui.log('【法師三系試玩場】此角色不會存檔，關閉或重新整理即消失；原本的存檔完全不受影響。切換：網址 ?lab=fire / ice / lightning（可加 &gear=zero、&awake=1）','warn');
    if(LAB&&!LAB_JOB2.includes(labQ.get('lab')!))ui.log('試玩角色已備好 30 萬 z、試煉徽記與各種素材，可以直接找晨光鎮的工匠蘇菲打造、懸賞官接懸賞；晨露石環、古樹誓約石、霜光封印碑的隱藏區域（果凍秘窟、翠影秘林、封印冰庫）都已開放。','sys');
    if(store.recoveryStatus.source==='backup')ui.log('已從健康備份恢復進度，請匯出一份備份保留。','warn');
    if(store.recoveryStatus.migrated)ui.log('舊版進度已安全轉換，原始備份已保留。','sys');
    if(fresh){ui.log('點地面移動、點魔物攻擊。先和嚮導莉莉聊聊吧！','sys');setTimeout(()=>world.talk('guide'),400);}
    ui.refreshHotbar();
  };
  if(!state.created)ui.showCreate(()=>start(true));else start(false);
  document.addEventListener('keydown',onKey);
  document.addEventListener('pointerdown',()=>{audio.unlock();if(started)audio.playMusic(world.map.def.theme);},{passive:true});
  setInterval(()=>{if(started&&!replacing&&!document.hidden){stopAutoSafely();ui.update();autoPotion();}},100);
  setInterval(()=>{if(started)void persist();},15000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(scene instanceof Scene3D)scene.cancelCombatPresentation();audio.stopCombat();if(started)void persist();}});
  addEventListener('pagehide',()=>{if(scene instanceof Scene3D)scene.cancelCombatPresentation();audio.stopCombat();if(started)void persist();});
  if((import.meta as unknown as {env:{DEV:boolean}}).env.DEV)(window as unknown as {__ro:unknown}).__ro={world,scene,main,get state(){return state;},set state(v:GameState){state=v;refreshStats();ui.refresh();},R};
}
void boot();
