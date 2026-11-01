// DOM interface: RO-style basic info, minimap, hotbar, log and draggable windows.
// Every change goes through main.run(), which applies a rule from rules/state.ts and saves.
import { jobs, skills, skillsOf, statNames, statHints, firstJobs, baseExpNeed, jobExpNeed, statRaiseCost, elementNames, JOB2_MAX, JOB2_REQ, job2ExpNeed, secondJobOf, secondJobs, SOULS, SOUL_IDS, SW, type SoulId, type JobId, type Stat } from './data/jobs';
import { items, cards, modules, equipSlotNames, equipSlotOrder, weaponTypeNames, shopStock, moduleCoefficient, type EquipDef, type EquipSlot } from './data/items';
import { maps } from './data/maps';
import { monsters } from './data/monsters';
import * as R from './rules/state';
import * as X from './rules/explore';
import * as C from './rules/craft';
import { recipes } from './data/crafting';
import { refineBonus, traitOf, TRAIT_NAMES, TRAIT_STEPS, bonusText, pctTrait } from './rules/refine-traits';
import { landmarks } from './data/landmarks';
import { huntSpot, habitatOf } from './data/habitats';
import { WORLD_EVENT_NAMES } from './world/sim';
import { TRIALS, SUPPLY_COOLDOWN, SECRET_AREAS, JOB2_GATES } from './data/explore';
import { pets, INTIMATE, INTIMACY_MAX, intimacyLabel } from './data/pets';
import { costumes, costumeShop } from './data/costumes';
import { quests } from './data/quests';
import { buildsOf } from './data/builds';
import type { GameState, Hotkey, Ctx } from './rules/state';
import { itemIcon, skillIcon, cardIcon, monsterIcon, monsterPortrait } from './render/art/icons';
import { fireworks } from './render/fireworks';
import { fxState } from './render/fx-state';
import { drawCharacter, CW, CH, type Look } from './render/art/characters';
import { canvas } from './render/art/util';
import { G } from './world/mapgen';
import type { World } from './world/sim';
import type { Audio } from './audio';
import { AVATAR_LABELS } from './data/avatars';
import { awakenings, masteryTier, MASTERY_TIERS, MASTERY_NAMES, MASTERY_BONUS } from './data/mastery';
import { mounts, companions, companionStats, emotes, COMPANION_MODES, DEFAULT_MODE, type CompanionRole, type CompanionMode } from './data/adventure';
import { buildCollection, filterCollection, paginateCollection, type CollectionKind } from './collection';
import type { SlotSummary } from './save';
import { QUALITY, affixText } from './rules/affix';
import { talents, TALENT_TREES, CAPSTONE_COST, type TalentKey, type TalentTree } from './data/talents';
import { GEAR_FX } from './data/ascension-items';
import * as SF from './rules/starfall';
import { DIFFICULTY, ASPECT_IDS, ASPECT_NAMES, BOONS, SIGIL_AFFIXES, PIT, HORDE, SIGIL, ECLIPSE, type AspectFx, type BoonId } from './data/starfall';

export type Settings = { autoLoot:boolean; dropMul:number; volume:number; muted:boolean; autoPotion:number; music:boolean; stopOnNoPotions:boolean; stopOnQuestDone:boolean; autoStrategy:'balanced'|'aoe'|'conserve'; uiScale:90|100|115; graphics?:'auto'|'high'|'mid'|'low'; renderer?:'3d'|'2d' };
export type Main = {
  state():GameState; world:World; audio:Audio; settings:Settings;
  run(fn:(s:GameState,ctx:Ctx)=>GameState,ok?:string,sfx?:'buy'|'click'|'levelup'):boolean;
  useHotkey(i:number):void; look(s?:GameState):Look;
  create(name:string,hair:number,color:number):void;
  respawn():void; warp(map:string,x:number,y:number):void;
  applySettings():void; exportSave():string; importSave(text:string):Promise<void>; resetGame():Promise<void>;
  isTargeting():string|null;
  completeQuest():boolean; completeBounty():boolean; setHunt(id:string|null):void; navigateHunt():void; hunt():string|null; refine(equipId:string):void;
  navigateQuest?(questId?:string):void; completeChallenge?(id:string):boolean;
  /** v6.0 二轉 ceremony. */
  ascend?():void;
  /** v7.0 星淵紀元 challenges. */
  pitEnter?(tier:number):void; hordeEnter?():void; sigilEnter?():void; hordeChoose?(b:BoonId):void; leaveArena?():void;
  /** v6.3 星光深淵. */
  abyssEnter?(floor:number):void; abyssNext?():void; abyssBest?():number;
  /** v6.1: save and go back to the character select screen. */
  switchCharacter?():Promise<void>;
  celebrate?(color?:string):void;
  toggleRide?():void; setRiding?(on:boolean):void; emote?(id:string):void;
};
type WinId='status'|'inventory'|'equip'|'skills'|'cards'|'settings'|'shop'|'refine'|'quests'|'pets'|'wardrobe'|'party'|'craft'|'talents'|'forge';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const pct=(a:number,b:number)=>b>0?Math.min(100,a/b*100):0;
const fmt=(n:number)=>Math.round(n).toLocaleString();
const monsterMap=(id:string)=>Object.values(maps).filter(m=>m.spawns.some(sp=>sp.monster===id)).map(m=>m.name).join('、')||'未知';
const winTitles:Record<WinId,string>={forge:'星淵工坊 · F',status:'冒險者狀態 · A',inventory:'冒險背包 · E',equip:'裝備與卡槽 · Q',skills:'技能與流派 · S',cards:'冒險圖鑑 · C',settings:'冒險設定 · Esc',shop:'商店',refine:'精煉工坊',quests:'冒險委託與挑戰',pets:'寵物 · P',wardrobe:'外觀衣櫥 · V',party:'夥伴・坐騎・表情 · B',craft:'工匠工坊',talents:'星光天賦 · T'};
const winDefaults:Record<WinId,{x:number;y:number;w:number}>={forge:{x:310,y:40,w:560},status:{x:310,y:24,w:370},inventory:{x:-430,y:230,w:410},equip:{x:310,y:24,w:490},skills:{x:-580,y:24,w:550},cards:{x:-680,y:24,w:650},settings:{x:310,y:34,w:470},shop:{x:310,y:120,w:560},refine:{x:310,y:120,w:480},quests:{x:310,y:24,w:490},pets:{x:310,y:60,w:470},wardrobe:{x:310,y:60,w:500},party:{x:310,y:40,w:520},craft:{x:310,y:50,w:540},talents:{x:310,y:40,w:640}};

const JOB_EMBLEM:Record<string,string>={novice:'🌱',swordman:'⚔️',mage:'🔮',archer:'🏹',knight:'🛡️',wizard:'✨',ranger:'🦅'};
const stripTags=(h:string)=>h.replace(/<[^>]*>/g,'');
export class UI {
  private root=document.getElementById('ui')!;
  private open=new Set<WinId>();
  private wins=new Map<WinId,HTMLElement>();
  private z=10;
  private collectionTab:CollectionKind|'owned'='card';
  private collectionComposing=false;
  private collectionText=''; private collectionJob=''; private collectionMap='';
  private collectionOwnership:'all'|'owned'|'missing'='all'; private collectionPage=0;
  private invTab:'use'|'equip'|'etc'|'card'='use';
  private shopKind:'tool'|'gear'|'costume'|'frontier'='tool'; private shopTab:'buy'|'sell'|'buyback'='buy';
  private compareId:string|null=null;
  private assignSlot:number|null=null;
  private saveDraft='';
  private guideId='';
  private equipPick:{equipId:string}|null=null;
  private upgradeAsk:string|null=null;
  private minimapBase:{id:string;canvas:HTMLCanvasElement}|null=null;
  private dialogEl!:HTMLElement; private logEl!:HTMLElement; private tipEl!:HTMLElement; private hoverEl!:HTMLElement;
  private questEl!:HTMLElement; private hotbarEl!:HTMLElement; private basicEl!:HTMLElement; private miniEl!:HTMLElement; private bannerEl!:HTMLElement; private walletEl!:HTMLElement; private dockEl!:HTMLElement; private expEl!:HTMLElement; private vitalsEl!:HTMLElement; private celebrateEl!:HTMLElement; private lastZeny=-1; private lastReadout=''; private lastMapName=''; private lastVitals=''; private gainTimer=0; private autoEl!:HTMLElement;
  dialogOpen=false;

  constructor(private main:Main){
    this.root.innerHTML=`
      <aside id="hud-left" aria-label="冒險資訊">
        <div id="basic" class="win"><div class="body"></div></div>
        <div id="quest" class="win"></div>
      </aside>
      <div id="wallet" role="status" aria-label="持有 Zeny"><i class="coin" aria-hidden="true"></i><span class="amt">0</span><small>Zeny</small><em class="gain" hidden></em></div>
      <div id="minimap" class="win"><canvas width="320" height="320"></canvas><div class="mapname"></div><nav id="dock" aria-label="冒險功能"></nav></div>
      <div id="actionbar"><div id="vitals"></div><div class="arow"><div id="hotbar"></div><div id="auto"></div></div></div>
      <div id="expbar"><div class="eb base"><b></b><i><s></s></i><em></em></div><div class="eb job"><b></b><i><s></s></i><em></em></div></div>
      <div id="log" aria-live="polite"></div>
      <div id="hovertip" hidden></div>
      <div id="banner"></div>
      <div id="dialog" class="win" hidden></div>
      <div id="tooltip" hidden></div>
      <div id="celebrate" hidden></div>
      <div id="cast-hint" hidden><b></b><small></small></div>
      <div id="event-announce" hidden><b></b><small></small></div>
      <div id="event-bar" hidden></div>`;
    this.questEl=this.root.querySelector('#quest')!;this.basicEl=this.root.querySelector('#basic .body')!;this.miniEl=this.root.querySelector('#minimap')!;
    this.hotbarEl=this.root.querySelector('#hotbar')!;this.logEl=this.root.querySelector('#log')!;
    this.tipEl=this.root.querySelector('#tooltip')!;this.hoverEl=this.root.querySelector('#hovertip')!;
    this.dialogEl=this.root.querySelector('#dialog')!;this.walletEl=this.root.querySelector('#wallet')!;this.dockEl=this.root.querySelector('#dock')!;this.expEl=this.root.querySelector('#expbar')!;this.vitalsEl=this.root.querySelector('#vitals')!;this.celebrateEl=this.root.querySelector('#celebrate')!;this.bannerEl=this.root.querySelector('#banner')!;this.autoEl=this.root.querySelector('#auto')!;
    this.buildHud();this.bindTooltips();this.buildHotbar();this.applyScale();
    addEventListener('resize',()=>{this.applyScale();for(const el of this.wins.values())this.clampWin(el);});
    this.questEl.addEventListener('click',e=>{const hb=(e.target as HTMLElement).closest<HTMLElement>('[data-hunt-go],[data-hunt-clear]');if(hb){if(hb.dataset.huntGo)this.main.navigateHunt();else this.main.setHunt(null);this.questKey='';this.updateQuest();return;}
      const t=(e.target as HTMLElement).closest<HTMLElement>('[data-nav],[data-quests]');if(t?.dataset.quests)this.show('quests');else if(t)this.main.navigateQuest?.();});
    this.root.addEventListener('input',e=>{const t=e.target as HTMLTextAreaElement;if(t.id==='save-json')this.saveDraft=t.value;
      if(t.id==='collection-search'&&!(e as InputEvent).isComposing){this.collectionText=t.value;this.collectionPage=0;this.renderWin('cards');}});
    this.root.addEventListener('compositionstart',e=>{if((e.target as HTMLElement).id==='collection-search')this.collectionComposing=true;});
    this.root.addEventListener('compositionend',e=>{const t=e.target as HTMLInputElement;if(t.id==='collection-search'){this.collectionComposing=false;this.collectionText=t.value;this.collectionPage=0;this.renderWin('cards');}});
    this.basicEl.addEventListener('click',e=>{if((e.target as HTMLElement).closest('[data-win-open]'))this.toggle('status');});
    this.dockEl.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-win]');if(b)this.toggle(b.dataset.win as WinId);});
    this.autoEl.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-act]');if(!b)return;
      if(b.dataset.act==='auto')this.main.world.setAuto(!this.main.world.player.auto);if(b.dataset.act==='sit')this.main.world.toggleSit();this.update();});
  }

  // ———————————————————————— HUD ————————————————————————
  /** Keep controls mounted: replacing a button between pointerdown/up loses its click. */
  private buildHud(){
    this.basicEl.innerHTML=`<div class="basic-readout"></div>`;
    this.dockEl.innerHTML=`        <button type="button" class="btn" data-win="status" aria-label="開啟冒險者狀態"><i class="mi" aria-hidden="true">📊</i><span class="ml">狀態</span><kbd>A</kbd><span class="badge" data-points="stat" hidden></span></button>
        <button type="button" class="btn" data-win="inventory" aria-label="開啟道具背包"><i class="mi" aria-hidden="true">🎒</i><span class="ml">道具</span><kbd>E</kbd></button>
        <button type="button" class="btn" data-win="equip" aria-label="開啟裝備與卡槽"><i class="mi" aria-hidden="true">🛡️</i><span class="ml">裝備</span><kbd>Q</kbd></button>
        <button type="button" class="btn" data-win="skills" aria-label="開啟技能與流派"><i class="mi" aria-hidden="true">✨</i><span class="ml">技能</span><kbd>S</kbd><span class="badge" data-points="skill" hidden></span></button>
        <button type="button" class="btn" data-win="cards" aria-label="開啟冒險圖鑑"><i class="mi" aria-hidden="true">📖</i><span class="ml">圖鑑</span><kbd>C</kbd></button>
        <button type="button" class="btn" data-win="quests" aria-label="開啟冒險委託與挑戰"><i class="mi" aria-hidden="true">📜</i><span class="ml">委託</span></button>
        <button type="button" class="btn" data-win="pets" aria-label="開啟寵物"><i class="mi" aria-hidden="true">🐾</i><span class="ml">寵物</span><kbd>P</kbd></button>
        <button type="button" class="btn" data-win="wardrobe" aria-label="開啟外觀衣櫥"><i class="mi" aria-hidden="true">👗</i><span class="ml">外觀</span><kbd>V</kbd></button>
        <button type="button" class="btn" data-win="talents" aria-label="開啟星光天賦"><i class="mi" aria-hidden="true">🌟</i><span class="ml">天賦</span><kbd>T</kbd></button>
        <button type="button" class="btn" data-win="forge" aria-label="開啟星淵工坊"><i class="mi" aria-hidden="true">⚒️</i><span class="ml">工坊</span><kbd>F</kbd></button>
        <button type="button" class="btn" data-win="party" aria-label="開啟夥伴、坐騎與表情"><i class="mi" aria-hidden="true">🤝</i><span class="ml">夥伴</span><kbd>B</kbd></button>
        <button type="button" class="btn" data-win="settings" aria-label="開啟冒險設定"><i class="mi" aria-hidden="true">⚙️</i><span class="ml">設定</span><kbd>Esc</kbd></button>`;
    this.autoEl.innerHTML=`<button type="button" class="big-auto" data-act="auto" aria-label="自動戰鬥（Z）" data-tip="${esc('<b>自動戰鬥 · Z</b>自動尋找附近魔物並施放技能、撿取掉落物。手動移動或點怪就會關閉。')}"><i>⚔️</i><span>自動</span><kbd>Z</kbd></button>
      <button type="button" class="sit-btn" data-act="sit" aria-label="坐下（X）" data-tip="${esc('<b>坐下 · X</b>坐下時 HP、SP 回復速度加倍。')}"><i>💤</i><span>坐下</span><kbd>X</kbd></button>`;
  }
  update(){
    const s=this.main.state(),w=this.main.world,c=s.char,d=w.derived;if(!d||!s.created)return;
    const p=w.player,lowHp=p.hp/d.maxHp<.25,job=jobs[c.job],j2=c.job2?jobs[c.job2]:null;
    const bNeed=baseExpNeed(c.baseLv),jNeed=jobExpNeed(c.job,c.jobLv);
    const capped=c.jobLv>=job.maxJobLv;
    const readoutHtml=`
      <button type="button" class="avatar" data-win-open="status" aria-label="開啟冒險者狀態"><span class="emb">${JOB_EMBLEM[c.job2??c.job]??'⭐'}</span><span class="lvb">${c.baseLv}</span></button>
      <div class="idn"><div class="nm">${esc(c.name)}</div><div class="tags"><small class="job" ${j2?`style="background:${j2.color}"`:''}>${c.job2==='knight'&&w.riding&&w.mountId==='emberWyvern'?'🐉 龍騎士':(j2??job).name}</small><small>${j2?`二轉 ${c.job2Lv} · `:''}Job ${c.jobLv}</small>${w.inCombat()?'<b class="combat">⚔ 戰鬥中</b>':p.sitting?'<b class="rest">💤 休息中</b>':p.auto?'<b class="auto">● 自動中</b>':''}</div></div>`;
    if(readoutHtml!==this.lastReadout){this.lastReadout=readoutHtml;this.basicEl.querySelector('.basic-readout')!.innerHTML=readoutHtml;}
    const f=p.food&&p.food.until>w.time?p.food:null,fdef=f?items[f.id]:null;
    const vitalsHtml=(f&&fdef?`<div class="food" data-tip="${esc(`<b>${fdef.name}</b>${'desc' in fdef?fdef.desc:''}<br>新的食物會取代目前的效果。`)}"><img src="${itemIcon(f.id)}" alt=""><span>${fdef.name}</span><em>${f.hp?`+${f.hp} HP`:''}${f.hp&&f.sp?' · ':''}${f.sp?`+${f.sp} SP`:''}/秒</em><b>${Math.ceil(f.until-w.time)}s</b></div>`:'')+`<div class="bar hp ${lowHp?'low':''}"><i style="width:${pct(p.hp,d.maxHp)}%"></i><label>HP</label><span>${fmt(p.hp)} / ${fmt(d.maxHp)}</span></div><div class="bar sp"><i style="width:${pct(p.sp,d.maxSp)}%"></i><label>SP</label><span>${fmt(p.sp)} / ${fmt(d.maxSp)}</span></div>`
      +(c.job2==='knight'?`<div class="resolve" data-tip="${esc('<b>戰意</b>近戰技能命中、普攻每 3 下累積；裂星重斬、守誓護壁、星落裁決會消耗。8 秒沒累積會慢慢消退。')}"><label>戰意</label>${Array.from({length:5},(_,i)=>`<i class="${i<p.resolve?'on':''}"></i>`).join('')}</div>`:'')
      +(c.job==='swordman'&&d.soul==='rock'?`<div class="resolve rock" data-tip="${esc('<b>守勢</b>被打、反擊、撼地斬時累積（最多 5 層），每層讓反擊 +10%。不會被技能用掉，離開戰鬥 6 秒後慢慢消退。')}"><label>守勢</label>${Array.from({length:SW.guardMax},(_,i)=>`<i class="${i<p.guard?'on':''}"></i>`).join('')}${p.endure&&p.endure.until>w.time?'<em>架勢</em>':''}</div>`:'')
      +(c.job2==='wizard'&&(d.skillLevels.w_study??0)>0?`<div class="resolve flow" data-tip="${esc('<b>術式回流</b>施放 3 次一轉法術後，下一個二轉技能 SP 變便宜。')}"><label>回流</label>${Array.from({length:3},(_,i)=>`<i class="${i<p.spellFlow?'on':''}"></i>`).join('')}${p.ascendUntil>w.time?`<em>昇華 ${Math.ceil(p.ascendUntil-w.time)}s</em>`:''}</div>`:'')
      +(c.job2==='ranger'&&w.prey?`<div class="resolve prey"><label>獵物</label><em>${esc(w.monsters.find(m=>m.id===w.prey!.id)?.def.name??'')} ${Math.ceil(w.prey.until-w.time)}s</em></div>`:'');
    if(vitalsHtml!==this.lastVitals){this.lastVitals=vitalsHtml;this.vitalsEl.innerHTML=vitalsHtml;}
    const ebs=this.expEl.querySelectorAll<HTMLElement>('.eb'),bp=pct(c.baseExp,bNeed),jp=capped?100:pct(c.jobExp,jNeed);
    ebs[0].querySelector('b')!.textContent=`Base Lv.${c.baseLv}`;ebs[0].querySelector('s')!.style.width=`${bp}%`;ebs[0].querySelector('em')!.textContent=`${bp.toFixed(1)}%`;
    if(c.job2){const j2cap=(c.job2Lv??1)>=JOB2_MAX,j2p=j2cap?100:pct(c.job2Exp??0,job2ExpNeed(c.job2Lv??1));
      ebs[1].querySelector('b')!.textContent=`二轉 Lv.${c.job2Lv}（一轉 ${c.jobLv}）`;ebs[1].querySelector('s')!.style.width=`${j2p}%`;ebs[1].querySelector('em')!.textContent=j2cap?'MAX':`${j2p.toFixed(1)}%`;}
    else{ebs[1].querySelector('b')!.textContent=`Job Lv.${c.jobLv}`;ebs[1].querySelector('s')!.style.width=`${jp}%`;ebs[1].querySelector('em')!.textContent=capped?'MAX':`${jp.toFixed(1)}%`;}
    this.updateWallet(c.zeny);
    const statBadge=this.dockEl.querySelector<HTMLElement>('[data-points="stat"]')!,skillBadge=this.dockEl.querySelector<HTMLElement>('[data-points="skill"]')!;
    statBadge.hidden=c.statPoints<2;statBadge.textContent=String(c.statPoints);
    const sp2=c.skillPoints+(c.skillPoints2??0);skillBadge.hidden=!sp2;skillBadge.textContent=String(sp2);
    const potions=Object.entries(s.items).reduce((n,[id,count])=>n+((items[id]?.kind==='use'&&'hp' in items[id])?count:0),0);
    const autoBtn=this.autoEl.querySelector<HTMLElement>('[data-act="auto"]')!;autoBtn.querySelector('span')!.textContent=p.auto?'自動中':'自動';
    autoBtn.classList.toggle('lowpot',!potions);autoBtn.dataset.pot=potions?'':'藥水用完';
    this.autoEl.querySelector('[data-act="auto"]')!.classList.toggle('on',p.auto);
    this.autoEl.querySelector('[data-act="sit"]')!.classList.toggle('on',p.sitting);
    this.updateHotbarState();this.drawMinimap();this.updateQuest();this.updateEventBar();
  }
  private questKey='';
  private updateQuest(){
    const st=R.questStatus(this.main.state());
    const ba=this.main.state().bounty?.active,bline=ba?`<div class="bounty-line ${ba.progress>=ba.count?'done':''}">🎯 懸賞 ${monsters[ba.monster].name} <b>${ba.progress}/${ba.count}</b>${ba.progress>=ba.count?' · 回懸賞官領賞':''}</div>`:'';
    const hid=this.main.hunt(),hs=hid?huntSpot(hid):null;
    const hline=hid?`<div class="hunt-line">🎯 狩獵：<b>${monsters[hid].name}</b>${hs?` · ${maps[hs.map].name}`:''}<span><button class="btn" data-hunt-go="1">前往</button><button class="btn" data-hunt-clear="1">✕</button></span></div>`:'';
    const key=(st?`${st.def.id}:${st.progress}:${st.done}`:'all')+bline+hline;if(key===this.questKey)return;this.questKey=key;
    if(!st){this.questEl.innerHTML=`<div class="body"><b>任務</b><small>主線委託已完成，還有強敵挑戰等著你。</small>${bline}${hline}<button class="btn" data-quests="1">查看挑戰</button></div>`;return;}
    const ratio=Math.min(1,st.current/st.need);
    this.questEl.innerHTML=`<div class="body"><div class="qhead"><b><em class="qtag">主線</em>${st.def.title}</b><span class="${st.done?'qdone':''}">${st.progress}</span></div>
      <div class="bar exp"><i style="width:${ratio*100}%"></i></div><small>${st.done?'完成了！回晨光鎮找<b>嚮導 莉莉</b>領獎勵。':st.def.text}</small>${bline}${hline}<div class="quest-actions"><button class="btn primary" data-nav="1">${st.done?'前往領獎':'追蹤目標'}</button><button class="btn" data-quests="1">委託與挑戰</button></div></div>`;
  }
  private buildHotbar(){
    this.hotbarEl.innerHTML=Array.from({length:R.HOTBAR_SIZE},(_,i)=>`<button class="slot" data-slot="${i}"><span class="key">${i+1}</span></button>`).join('');
    this.hotbarEl.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(b){const i=Number(b.dataset.slot);if(e.shiftKey||!this.main.state().hotbar[i])this.showHotkeyPicker(i);else this.main.useHotkey(i);}});
    this.hotbarEl.addEventListener('contextmenu',e=>{e.preventDefault();const b=(e.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(b)this.showHotkeyPicker(Number(b.dataset.slot));});
    this.hotbarEl.addEventListener('dragstart',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(!b||!e.dataTransfer)return;
      e.dataTransfer.setData('text/hotslot',b.dataset.slot!);e.dataTransfer.effectAllowed='move';b.classList.add('dragging');this.tipEl.hidden=true;});
    this.hotbarEl.addEventListener('dragend',e=>{(e.target as HTMLElement).closest('[data-slot]')?.classList.remove('dragging');});
    this.hotbarEl.addEventListener('dragover',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(b){e.preventDefault();b.classList.add('drop');}});
    this.hotbarEl.addEventListener('dragleave',e=>{(e.target as HTMLElement).closest('[data-slot]')?.classList.remove('drop');});
    this.hotbarEl.addEventListener('drop',e=>{e.preventDefault();const b=(e.target as HTMLElement).closest<HTMLElement>('[data-slot]');if(!b)return;b.classList.remove('drop');
      const from=e.dataTransfer?.getData('text/hotslot');
      if(from){const a=Number(from),b2=Number(b.dataset.slot);if(a!==b2&&this.main.run(s=>R.swapHotkeys(s,a,b2)))this.main.audio.play('click');return;}
      const data=e.dataTransfer?.getData('text/hotkey');if(!data)return;try{const key=JSON.parse(data) as Hotkey;if(key?.type==='skill'||key?.type==='item')this.main.run(s=>R.setHotkey(s,Number(b.dataset.slot),key));}catch{/* ignore unsupported drag data */}});
  }
  refreshHotbar(){
    const s=this.main.state();
    this.hotbarEl.querySelectorAll<HTMLElement>('[data-slot]').forEach(el=>{
      const i=Number(el.dataset.slot),h=s.hotbar[i];
      let inner=`<span class="key">${i+1}</span>`,tip='<b>空的快捷欄</b>點擊選擇技能或消耗品。也可以拖曳；右鍵或 Shift＋點擊重新設定。';
      if(h?.type==='skill'){const sk=skills[h.id],lv=s.char.skills[h.id]??0;inner+=`<img src="${skillIcon(h.id)}" alt=""><i class="cd" style="transform:scaleY(0)"></i>`;tip=`<b>${sk.name} Lv.${lv}</b>${sk.desc(lv)}<br><span class="stat">SP ${sk.sp(lv)}</span>`;}
      else if(h?.type==='item'){const n=s.items[h.id]??0;inner+=`<img src="${itemIcon(h.id)}" alt="" style="${n?'':'opacity:.35'}"><span class="cnt">${n}</span>`;tip=`<b>${items[h.id].name}</b>${items[h.id].desc}`;}
      el.innerHTML=inner;el.setAttribute('aria-label',`快捷欄 ${i+1}：${h?(h.type==='skill'?skills[h.id].name:items[h.id].name):'空白，點擊設定'}，右鍵重新設定`);el.dataset.tip=tip+'<br><span class="hint">拖到別格可互換位置；右鍵或 Shift＋點擊重新設定</span>';el.classList.toggle('empty',!h);el.draggable=!!h;
    });
  }
  private updateHotbarState(){
    const s=this.main.state(),w=this.main.world,now=w.time,targeting=this.main.isTargeting();
    this.hotbarEl.querySelectorAll<HTMLElement>('[data-slot]').forEach(el=>{
      const h=s.hotbar[Number(el.dataset.slot)];el.classList.toggle('targeting',h?.type==='skill'&&h.id===targeting);el.classList.toggle('queued',h?.type==='skill'&&h.id===w.player.queued?.skill);
      const cd=el.querySelector<HTMLElement>('.cd');if(!cd||h?.type!=='skill')return;
      const until=Math.max(w.player.cooldowns[h.id]??0,w.player.afterCastUntil),total=Math.max(skills[h.id].cooldown??0,skills[h.id].delay,.5);
      cd.style.transform=`scaleY(${Math.max(0,Math.min(1,(until-now)/total))})`;
    });
  }
  private drawMinimap(){
    const w=this.main.world,map=w.map,cv=this.miniEl.querySelector('canvas')!,g=cv.getContext('2d')!;
    const k=300/(map.w+map.h),ox=160,oy=160-(map.w+map.h)*k/4;
    const P=(x:number,y:number)=>({x:ox+(x-y)*k,y:oy+(x+y)*k/2});
    if(this.minimapBase?.id!==map.def.id){
      const [c,bg]=canvas(320,320);
      const col:Record<number,string>={[G.water]:'#4f9fd6',[G.path]:'#d8bc8c',[G.stone]:'#d9d2c4',[G.sand]:'#e5d4a0',[G.ice]:'#c4e4f5',[G.caveFloor]:'#8796ad',[G.darkGrass]:'#5f9a50'};
      for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++){
        const p=P(x+.5,y+.5),code=map.ground[y*map.w+x],blocked=map.blocked[y*map.w+x];
        bg.fillStyle=blocked&&code!==G.water?(map.def.theme==='cave'?'#3c4658':'#3d6b3a'):col[code]??'#8cc46a';
        bg.beginPath();bg.moveTo(p.x,p.y-k/2);bg.lineTo(p.x+k,p.y);bg.lineTo(p.x,p.y+k/2);bg.lineTo(p.x-k,p.y);bg.closePath();bg.fill();
      }
      this.minimapBase={id:map.def.id,canvas:c};
    }
    g.clearRect(0,0,320,320);g.drawImage(this.minimapBase.canvas,0,0);
    for(const wp of map.def.warps){const p=P(wp.x+.5,wp.y+.5);g.fillStyle='#ff5ad0';g.beginPath();g.arc(p.x,p.y,5,0,7);g.fill();g.strokeStyle='#fff';g.lineWidth=1.5;g.stroke();}
    for(const n of map.def.npcs){const p=P(n.x+.5,n.y+.5);g.fillStyle='#ffd45c';g.beginPath();g.arc(p.x,p.y,4,0,7);g.fill();}
    // v4.6: chests show up only when you are close (14 tiles), so exploring still matters.
    for(const c of w.chests)if(Math.hypot(c.x-w.player.x,c.y-w.player.y)<14){const p=P(c.x,c.y);g.fillStyle=c.tier==='normal'||c.tier==='supply'?'#c98a3a':c.tier==='rare'?'#ffd45c':'#c9a3ff';g.fillRect(p.x-3.5,p.y-3.5,7,7);g.strokeStyle='#fff';g.lineWidth=1;g.strokeRect(p.x-3.5,p.y-3.5,7,7);}
    const we=w.worldEvent;
    if(we?.kind==='golden'){const gm=w.monsters.find(m=>m.id===we.targetId&&m.state!=='dead');if(gm){const p=P(gm.x,gm.y);g.fillStyle='#ffd45c';g.strokeStyle='#5a3a06';g.lineWidth=1.5;g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?3.5:8;g.lineTo(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r);}g.closePath();g.fill();g.stroke();}}
    if(we?.kind==='invasion'&&we.center){const c=P(we.center.x,we.center.y);g.save();g.translate(c.x,c.y);g.scale(1,.5);g.beginPath();g.arc(0,0,10*k*1.42,0,7);g.restore();g.strokeStyle='#ff5a5a';g.lineWidth=2.5;g.setLineDash([4,3]);g.stroke();g.setLineDash([]);}
    const hunt=this.main.hunt(),hab=hunt?habitatOf(map.def.id,hunt):undefined;
    if(hab){const c=P(hab.x,hab.y);g.save();g.translate(c.x,c.y);g.scale(1,.5);g.beginPath();g.arc(0,0,hab.r*k*1.42,0,7);g.restore();g.fillStyle='rgba(255,212,92,.16)';g.fill();g.strokeStyle='#ffd45c';g.lineWidth=2;g.setLineDash([5,4]);g.stroke();g.setLineDash([]);}
    for(const m of w.monsters)if(m.state!=='dead'&&m.def.id===hunt){const p=P(m.x,m.y);g.fillStyle='#ffd45c';g.strokeStyle='#5a3a06';g.lineWidth=1.5;g.beginPath();g.arc(p.x,p.y,4.2,0,7);g.fill();g.stroke();}
    for(const m of w.monsters)if(m.state!=='dead'&&m.def.id!==hunt){const p=P(m.x,m.y);g.fillStyle=m.def.mvp?'#ff3030':'#e85a4a';g.beginPath();g.arc(p.x,p.y,m.def.mvp?5:2.6,0,7);g.fill();}
    const p=P(w.player.x,w.player.y);g.fillStyle='#ffffff';g.strokeStyle='#1a3a8a';g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,5,0,7);g.fill();g.stroke();
    const tierD=SF.tierOf(this.main.state()),tierTag=tierD.id>1?` <em class="tier-tag" style="color:${tierD.color}">【${tierD.name}】</em>`:'';
    const nameHtml=`<b>${map.def.name}</b>${tierTag}<span>${map.def.levelHint} · ${Math.floor(w.player.x)}, ${Math.floor(w.player.y)}</span><div class="map-legend"><span>● 自己</span><span class="portal">● 傳送點</span><span class="npc">● 城鎮人物</span><span class="chest">■ 附近寶箱</span></div>`;
    if(nameHtml!==this.lastMapName){this.lastMapName=nameHtml;this.miniEl.querySelector('.mapname')!.innerHTML=nameHtml;}
  }

  // ———————————————————————— log / banner / hover ————————————————————————
  log(text:string,cls='sys'){
    const d=document.createElement('div');d.className=cls;d.textContent=text;this.logEl.append(d);
    while(this.logEl.children.length>60)this.logEl.firstChild!.remove();
    this.logEl.scrollTop=this.logEl.scrollHeight;
  }
  /** Big, always-visible money readout; a floating "+N" shows each gain. */
  private updateWallet(z:number){
    if(z===this.lastZeny)return;
    const amt=this.walletEl.querySelector<HTMLElement>('.amt')!,gain=this.walletEl.querySelector<HTMLElement>('.gain')!;
    if(this.lastZeny>=0){const d=z-this.lastZeny;gain.textContent=`${d>0?'+':'−'}${fmt(Math.abs(d))}`;gain.className=`gain ${d>0?'up':'down'}`;gain.hidden=false;
      void gain.offsetWidth;gain.classList.add('show');clearTimeout(this.gainTimer);this.gainTimer=window.setTimeout(()=>{gain.hidden=true;},1600);
      this.walletEl.classList.remove('pulse');void this.walletEl.offsetWidth;this.walletEl.classList.add('pulse');}
    amt.textContent=fmt(z);this.lastZeny=z;
  }
  private celebrateQueue:string[]=[];private celebrating=false;
  /** v4.5: full-screen card reveal with fireworks. Queues when several cards drop at once. */
  celebrateCard(defId:string){this.celebrateQueue.push(defId);if(!this.celebrating)this.nextCelebration();}
  /** v6.0 轉職儀式: the same full-screen celebration, with the new job's emblem. */
  celebrateJob(job:JobId){this.celebrateQueue.push(`job:${job}`);if(!this.celebrating)this.nextCelebration();}
  private nextCelebration(){
    const defId=this.celebrateQueue.shift();if(!defId){this.celebrating=false;fxState.overlay=false;return;}
    fxState.overlay=true;
    this.celebrating=true;
    if(defId.startsWith('job:')){const j=jobs[defId.slice(4) as JobId],el=this.celebrateEl;el.className='mvp job';
      const sk=skillsOf(j.id);
      el.innerHTML=`<canvas class="fw"></canvas><div class="rays"></div>
        <div class="reveal"><p class="kicker">★ 二轉成功 ★</p>
          <div class="bigcard"><div class="inner"><div class="face front"><div class="frame" style="background:linear-gradient(160deg,${j.color},#1a1040)">
            <div class="art job-emblem"><span>${JOB_EMBLEM[j.id]}</span></div><div class="cname">${esc(j.name)}</div>
            <div class="cmod">${esc(j.desc)}<br>${sk.map(x=>`<img src="${skillIcon(x.id)}" alt="" style="width:22px;height:22px;vertical-align:middle">`).join('')}</div></div></div>
            <div class="face back"><span>✦</span></div></div></div>
          <p class="hint2">按 S 打開技能視窗，學習第一招二轉技能　·　點一下繼續</p></div>`;
      el.hidden=false;const stop=fireworks(el.querySelector('canvas')!,true);
      let done=false;const close=()=>{if(done)return;done=true;el.classList.add('out');setTimeout(()=>{stop();el.hidden=true;el.classList.remove('out');this.nextCelebration();},380);};
      const t=window.setTimeout(close,7500),shownAt=performance.now();el.onclick=()=>{if(performance.now()-shownAt<900)return;clearTimeout(t);close();};
      return;}
    const def=cards[defId],mon=monsters[def.monster],mod=modules[def.moduleId],mvp=!!mon?.mvp;
    const el=this.celebrateEl;el.className=mvp?'mvp':'';
    el.innerHTML=`<canvas class="fw"></canvas><div class="rays"></div>
      <div class="reveal"><p class="kicker">${mvp?'★ 傳說卡片 ★':'獲得卡片！'}</p>
        <div class="bigcard"><div class="inner">
          <div class="face front"><div class="frame"><div class="art"><img src="${monsterPortrait(def.monster)}" alt=""></div>
            <div class="cname">${esc(def.name)}</div><div class="cmod"><b>${esc(mod.name)}</b>${esc(stripTags(mod.desc(moduleCoefficient(defId,1))))}</div></div></div>
          <div class="face back"><span>✦</span></div></div></div>
        <p class="hint2">插進穿著中的裝備，再到技能視窗配置模組　·　點一下繼續</p></div>`;
    el.hidden=false;
    const stop=fireworks(el.querySelector('canvas')!,mvp);
    let done=false;const close=()=>{if(done)return;done=true;el.classList.add('out');setTimeout(()=>{stop();el.hidden=true;el.classList.remove('out');this.nextCelebration();},380);};
    const t=window.setTimeout(close,mvp?6500:5000);
    el.onclick=()=>{if(performance.now()-shownAt<700)return;clearTimeout(t);close();};
    const shownAt=performance.now();
  }
  /** v4.9 big, short-lived hint in the middle of the screen (e.g. a single-target skill with nothing near the cursor). */
  /** v5.1 星光異變: dramatic centre announcement (3 s, click-through) and a countdown bar while the event runs. */
  private announceTimer=0;
  eventAnnounce(title:string,text:string,kind:string){
    const el=this.root.querySelector<HTMLElement>('#event-announce')!;el.className=kind;el.querySelector('b')!.textContent=title;el.querySelector('small')!.textContent=text;
    el.hidden=false;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(this.announceTimer);this.announceTimer=window.setTimeout(()=>{el.hidden=true;},3600);
  }
  private lastEventBar='';
  private updateEventBar(){
    const w=this.main.world,e=w.worldEvent,el=this.root.querySelector<HTMLElement>('#event-bar')!;
    let html='',cls=e?e.kind:'';
    const c=w.challenge,mmss=(n:number)=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
    if(c&&w.map.def.id==='abyss'){cls='challenge';
      if(c.kind==='pit')html=`<span class="ev-ic">⏳</span><b>星淵深坑 ${c.tier} 階</b><span class="ev-goal">${c.bossId===null?`進度 <i class="cbar"><s style="width:${Math.round(c.progress/PIT.need*100)}%"></s></i> ${Math.round(c.progress/PIT.need*100)}%`:'打倒深坑守衛！'}</span><span class="ev-time">${c.state==='run'?mmss(Math.max(0,Math.ceil(c.until-w.time))):c.state==='won'?'通過':'失敗'}</span>`;
      else if(c.kind==='horde')html=`<span class="ev-ic">🌊</span><b>星潮圍城 ${Math.min(c.wave,HORDE.waves)}/${HORDE.waves} 波</b><span class="ev-goal">星焰 ${Math.floor(c.embers)}${c.boons.length?`　${c.boons.map(b=>BOONS[b].icon).join('')}`:''}</span><span class="ev-time">${c.phase==='fight'?mmss(Math.max(0,Math.ceil(c.until-w.time))):c.phase==='choose'?'選祝福（N）':c.phase==='boss'?'首領':c.phase==='won'?'完成':'結束'}</span>`;
      else html=`<span class="ev-ic">🜂</span><b>印記地城 Lv.${c.lv}</b><span class="ev-goal">${c.bossId===null?`房間 ${c.room}/${SIGIL.rooms}`:'守護者'}　${c.affixes.map(a=>`<span class="${SIGIL_AFFIXES[a].good?'gain':'need'}">${SIGIL_AFFIXES[a].name}</span>`).join(' ')}</span><span class="ev-time">${c.state==='run'?'進行中':c.state==='won'?'通關':'失敗'}</span>`;}
    else if(e){const nm=WORLD_EVENT_NAMES[e.kind],left=Math.max(0,Math.ceil(e.until-w.time));
      const goal=e.kind==='eclipse'?`星蝕餘燼 ${w.embers}/${ECLIPSE.chestCost}・打開地圖上的星蝕寶箱`:e.kind==='meteor'?'撿起星屑・經驗 +20%':e.kind==='golden'?`打倒${w.monsters.find(m=>m.id===e.targetId)?.def.name??'黃金魔物'}（小地圖★）`:`第 ${e.wave??0}/3 波・剩 ${w.monsters.filter(m=>m.invasion&&m.state!=='dead').length} 隻`;
      html=`<span class="ev-ic">${nm.icon}</span><b>${nm.name}</b><span class="ev-goal">${goal}</span><span class="ev-time">${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}</span>`;}
    if(html!==this.lastEventBar){this.lastEventBar=html;el.innerHTML=html;el.hidden=!html;el.className=cls;}
  }
  private castHintTimer=0;
  castHint(title:string,sub=''){
    const el=this.root.querySelector<HTMLElement>('#cast-hint')!;el.querySelector('b')!.textContent=`⚠ ${title}`;el.querySelector('small')!.textContent=sub;
    el.hidden=false;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');
    clearTimeout(this.castHintTimer);this.castHintTimer=window.setTimeout(()=>{el.hidden=true;},1400);
  }
  banner(text:string,cls=''){const d=document.createElement('div');d.textContent=text;d.className=cls;this.bannerEl.append(d);setTimeout(()=>d.remove(),4100);}
  hover(text:string|null){this.hoverEl.hidden=!text;if(text)this.hoverEl.textContent=text;}
  private bindTooltips(){
    document.addEventListener('mouseover',e=>{const t=(e.target as HTMLElement).closest<HTMLElement>('[data-tip]');if(!t){this.tipEl.hidden=true;return;}this.tipEl.innerHTML=t.dataset.tip!;this.tipEl.hidden=false;});
    document.addEventListener('mousemove',e=>{if(this.tipEl.hidden)return;const x=Math.max(4,Math.min(e.clientX/this.scale+14,innerWidth/this.scale-this.tipEl.offsetWidth-6)),y=Math.max(4,Math.min(e.clientY/this.scale+14,innerHeight/this.scale-this.tipEl.offsetHeight-6));this.tipEl.style.left=`${x}px`;this.tipEl.style.top=`${y}px`;});
    document.addEventListener('dragstart',e=>{const t=(e.target as HTMLElement).closest<HTMLElement>('[data-hk]');if(t&&e.dataTransfer){e.dataTransfer.setData('text/hotkey',t.dataset.hk!);this.tipEl.hidden=true;}});
  }

  // ———————————————————————— windows ————————————————————————
  isOpen(id:WinId){return this.open.has(id);}
  anyWindow(){return this.open.size>0||this.dialogOpen;}
  toggle(id:WinId){if(this.open.has(id))this.close(id);else this.show(id);this.main.audio.play('click');}
  show(id:WinId){
    let el=this.wins.get(id);
    if(!el){
      el=document.createElement('div');el.className='win';el.dataset.win=id;
      const def=winDefaults[id],saved=this.loadPos(id);
      el.style.width=`${def.w}px`;el.style.left=`${saved?.x??(def.x<0?innerWidth+def.x-def.w*0:def.x)}px`;el.style.top=`${saved?.y??def.y}px`;
      if(def.x<0&&!saved)el.style.left=`${Math.max(10,innerWidth+def.x)}px`;
      el.innerHTML=`<div class="title"><span>${winTitles[id]}</span><button class="x" aria-label="關閉">×</button></div><div class="body"></div>`;
      el.querySelector('.x')!.addEventListener('click',()=>this.close(id));
      this.dragWin(el,id);el.addEventListener('pointerdown',()=>{el!.style.zIndex=String(++this.z);});
      el.addEventListener('click',e=>this.onWinClick(id,e));el.addEventListener('change',e=>this.onWinChange(id,e));
      el.addEventListener('dblclick',e=>this.onWinDbl(id,e));
      this.root.append(el);this.wins.set(id,el);
    }
    el.hidden=false;el.style.zIndex=String(++this.z);this.open.add(id);this.renderWin(id);this.clampWin(el);
  }
  close(id:WinId){const el=this.wins.get(id);if(el)el.hidden=true;this.open.delete(id);if(id==='equip')this.equipPick=null;if(id==='cards'){this.upgradeAsk=null;this.collectionComposing=false;}this.tipEl.hidden=true;}
  closeAll(){for(const id of [...this.open])this.close(id);this.closeDialog();}
  refresh(){for(const id of this.open)this.renderWin(id);this.refreshHotbar();this.update();}
  private get scale(){return (this.main.settings.uiScale??100)/100;}
  private applyScale(){const n=this.scale;this.root.style.zoom=String(n);this.root.style.width=`${100/n}vw`;this.root.style.height=`${100/n}vh`;this.root.style.setProperty('--viewport-h',`${innerHeight/n}px`);}
  private clampWin(el:HTMLElement){const maxW=innerWidth/this.scale-24,maxH=innerHeight/this.scale-24;el.style.maxWidth=`${maxW}px`;el.style.maxHeight=`${maxH}px`;el.style.left=`${Math.max(12,Math.min(innerWidth/this.scale-el.offsetWidth-12,parseFloat(el.style.left)||12))}px`;el.style.top=`${Math.max(12,Math.min(innerHeight/this.scale-el.offsetHeight-12,parseFloat(el.style.top)||12))}px`;}
  private resetLayout(){for(const [id,el] of this.wins){localStorage.removeItem(`ro-win-${id}`);const d=winDefaults[id];el.style.left=`${d.x<0?innerWidth/this.scale+d.x:d.x}px`;el.style.top=`${d.y}px`;this.clampWin(el);}this.log('視窗位置已重設。');}
  private dragWin(el:HTMLElement,id:WinId){
    const title=el.querySelector<HTMLElement>('.title')!;
    title.addEventListener('pointerdown',e=>{
      if((e.target as HTMLElement).closest('.x')||e.button!==0)return;e.preventDefault();title.setPointerCapture(e.pointerId);
      const sx=e.clientX/this.scale-el.offsetLeft,sy=e.clientY/this.scale-el.offsetTop;
      const move=(m:PointerEvent)=>{el.style.left=`${m.clientX/this.scale-sx}px`;el.style.top=`${m.clientY/this.scale-sy}px`;this.clampWin(el);};
      const up=()=>{title.removeEventListener('pointermove',move);title.removeEventListener('pointerup',up);title.removeEventListener('pointercancel',up);this.savePos(id,el.offsetLeft,el.offsetTop);};
      title.addEventListener('pointermove',move);title.addEventListener('pointerup',up);title.addEventListener('pointercancel',up);
    });
  }
  private loadPos(id:string):{x:number;y:number}|null{try{const v=JSON.parse(localStorage.getItem(`ro-win-${id}`)??'null');return v&&Number.isFinite(v.x)&&Number.isFinite(v.y)?v:null;}catch{return null;}}
  private savePos(id:string,x:number,y:number){try{localStorage.setItem(`ro-win-${id}`,JSON.stringify({x,y}));}catch{/* preference only */}}

  private renderWin(id:WinId){
    if(id==='cards'&&this.collectionComposing)return;
    const el=this.wins.get(id);if(!el)return;const body=el.querySelector<HTMLElement>('.body')!;
    const s=this.main.state();
    const wallet=id==='inventory'||id==='shop'||id==='refine'||id==='forge'?`<div class="wallet-strip"><i class="coin"></i>持有 <b>${fmt(s.char.zeny)}</b> Zeny</div>`:'';
    const html=wallet+(id==='forge'?this.forgeHtml(s):id==='status'?this.statusHtml(s):id==='inventory'?this.invHtml(s):id==='equip'?this.equipHtml(s):id==='skills'?this.skillsHtml(s):id==='cards'?this.cardsHtml(s):id==='shop'?(this.shopKind==='costume'?this.costumeShopHtml(s):this.shopHtml(s)):id==='refine'?this.refineHtml(s):id==='quests'?this.questsHtml(s):id==='pets'?this.petsHtml(s):id==='wardrobe'?this.wardrobeHtml(s):id==='party'?this.partyHtml(s):id==='craft'?this.craftHtml(s):id==='talents'?this.talentsHtml(s):this.settingsHtml());
    const focused=document.activeElement as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|null;
    const focusKey=focused&&body.contains(focused)?this.formKey(focused):null;
    const controls=new Map(Array.from(body.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select')).map(t=>[this.formKey(t),{value:t.value,checked:'checked' in t?t.checked:false,start:'selectionStart' in t?t.selectionStart:null,end:'selectionEnd' in t?t.selectionEnd:null}]));
    const scroll=body.scrollTop,guideOpen=body.querySelector<HTMLDetailsElement>('.guide')?.open;const scrolls=Array.from(body.querySelectorAll<HTMLElement>('.list,textarea')).map(el=>({top:el.scrollTop,left:el.scrollLeft}));body.innerHTML=html;
    for(const t of Array.from(body.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input,textarea,select'))){const old=controls.get(this.formKey(t));if(old&&(t.id==='save-json'||t.classList.contains('qty')||this.formKey(t)===focusKey)){t.value=old.value;if('checked' in t)t.checked=old.checked;if(this.formKey(t)===focusKey){t.focus({preventScroll:true});if('setSelectionRange' in t&&old.start!==null)try{t.setSelectionRange(old.start,old.end);}catch{/* number input */}}}}
    body.scrollTop=scroll;const guide=body.querySelector<HTMLDetailsElement>('.guide');if(guide&&guideOpen!==undefined)guide.open=guideOpen;Array.from(body.querySelectorAll<HTMLElement>('.list,textarea')).forEach((el,i)=>{if(scrolls[i]){el.scrollTop=scrolls[i].top;el.scrollLeft=scrolls[i].left;}});this.clampWin(el);
    if(id==='equip'){const cv=body.querySelector<HTMLCanvasElement>('canvas.portrait-cv');if(cv){const g=cv.getContext('2d')!;g.clearRect(0,0,CW,CH);drawCharacter(g,this.main.look(s),'S','idle',0);}}
    el.querySelector('.title span')!.textContent=id==='shop'?(this.shopKind==='tool'?'道具商店':this.shopKind==='costume'?'露娜的造型屋':'武器防具店'):winTitles[id];
  }

  private formKey(t:HTMLElement){return t.id||`${t.tagName}:${t.dataset.set??t.dataset.mod??''}:${t.dataset.slot??''}`;}
  private buildGuideHtml(s:GameState){
    const list=buildsOf(s.char.job),guide=list.find(g=>g.id===this.guideId)??list[0];if(!guide)return '';
    return `<details class="guide" open><summary>成長指南 <span>${guide.name}</span></summary><select data-guide="1" aria-label="選擇成長流派">${list.map(g=>`<option value="${g.id}" ${g.id===guide.id?'selected':''}>${g.name}</option>`).join('')}</select><p>${guide.summary}</p><div class="section-label">素質優先順序 · 剩餘 ${s.char.statPoints} 點</div><div class="guide-priority">${guide.statPriority.map(k=>`<button class="btn" data-stat="${k}" ${s.char.statPoints<statRaiseCost(s.char.stats[k])||s.char.stats[k]>=99?'disabled':''}>${statNames[k]} ${s.char.stats[k]} ＋</button>`).join('<span>→</span>')}</div><p class="hint">建議依序培養，不會自動花掉點數。${guide.playstyle}</p><div class="section-label">技能路線 · 剩餘 ${s.char.skillPoints} 點</div><div class="guide-priority">${guide.skillPriority.map(k=>`<button class="btn" data-learn="${k.id}" ${R.canLearn(s,k.id)||(s.char.skills[k.id]??0)>=k.level?'disabled':''}>${skills[k.id]?.name??k.id} ${s.char.skills[k.id]??0}/${k.level} ＋</button>`).join('')}</div>${guide.gearTargets?.length?`<p class="hint">裝備目標：${guide.gearTargets.map(id=>{const d=items[id] as EquipDef|undefined;if(!d)return id;const where=Object.values(monsters).filter(m=>m.drops.some(x=>x.item===id)).map(m=>m.name);return `${d.name}（${[d.cast?`詠唱−${d.cast}%`:'',d.aspd?`攻速+${d.aspd}%`:'',d.crit?`爆擊+${d.crit}%`:'',d.delay?`延遲−${d.delay}%`:''].filter(Boolean).join(' ')}${where.length?`・${where.join('、')}掉落`:'・商店'}）`;}).join('；')}</p>`:''}${guide.cardTargets.length?`<p class="hint">卡片目標：${guide.cardTargets.map(t=>`${cards[t.cardId]?.name??t.cardId}＋${skills[t.skillId]?.name??t.skillId}（${t.reason}）`).join('；')}</p>`:''}${s.char.job==='novice'?'<p class="hint">先把基本技能學到 Lv.9，再找轉職官。基本技能 Lv.3 會自動習得急救，不消耗技能點。</p>':''}</details>`;
  }
  private showHotkeyPicker(i:number){
    this.assignSlot=i;const s=this.main.state();
    const choices:[string,()=>void][]=[];
    for(const [id,lv] of Object.entries(s.char.skills))if(lv>0&&skills[id]?.target!=='passive'&&R.derive(s).skillLevels[id])choices.push([`${skills[id].name} Lv.${lv}`,()=>{this.main.run(st=>R.setHotkey(st,i,{type:'skill',id}));this.closeDialog();}]);
    for(const [id,n] of Object.entries(s.items))if(n>0&&items[id]?.kind==='use')choices.push([`${items[id].name} ×${n}`,()=>{this.main.run(st=>R.setHotkey(st,i,{type:'item',id}));this.closeDialog();}]);
    if(s.hotbar[i])choices.push(['清空這一格',()=>{this.main.run(st=>R.setHotkey(st,i,null));this.closeDialog();}]);
    choices.push(['取消，保留原本配置',()=>this.closeDialog()]);
    this.renderDialog(`設定快捷欄 ${i+1}`,'選擇技能或消耗品。<br>選好以前，原本的快捷欄配置會保留。',choices);
  }
  private gearSummary(s:GameState,e:R.EquipInst){const d=items[e.defId] as EquipDef,cs=s.cards.filter(c=>c.loc.kind==='equip'&&c.loc.equipId===e.id);return `精煉 +${e.refine??0} · 卡槽 ${cs.length}/${d.slots}${cs.length?' · '+cs.map(c=>`${cards[c.defId].name} Lv.${c.level}`).join('、'):''}`;}
  private compareHtml(s:GameState){
    if(!this.compareId)return '<p class="hint compare-empty">點選一件裝備，比較穿上後的能力變化。</p>';
    const virtual=this.compareId.startsWith('shop:');const e:R.EquipInst|undefined=virtual?{id:'preview',defId:this.compareId.slice(5),refine:0}:s.equipment.find(e=>e.id===this.compareId);if(!e)return '';
    const def=items[e.defId] as EquipDef,current=s.equipment.find(g=>g.id===s.equipped[def.slot]);
    const next=structuredClone(s);if(virtual)next.equipment.push(e);next.equipped[def.slot]=e.id;
    const before=R.derive(s),after=R.derive(next);
    const {rows,all,summary}=this.compareRows(before,after);
    const deltas=rows.length?rows.join(''):'<div class="cmp-none">能力完全相同</div>';
    const nextSources=new Map(R.resolveModules(next).map(m=>[m.moduleId,m]));
    const lost=R.resolveModules(s).filter(m=>nextSources.get(m.moduleId)?.cardId!==m.cardId).map(m=>`${modules[m.moduleId].name} Lv.${m.level}（${cards[s.cards.find(c=>c.id===m.cardId)!.defId].name}）${nextSources.has(m.moduleId)?'：改用另一張卡':'：失去生效來源'}`);
    const why=R.canWear(s,def);
    return `<section class="compare"><div class="section-label">裝備比較 · ${equipSlotNames[def.slot]}</div><div class="compare-head"><div><small>目前穿著</small><b>${current?esc(R.equipLabel(current)):'空裝備欄'}</b><small>${current?this.gearSummary(s,current):'沒有卡片來源'}</small></div><span>→</span><div><small>${virtual?'商店新品':'候選裝備'}</small><b>${esc(R.equipLabel(e))}</b><small>${this.gearSummary(s,e)}</small></div></div><p class="cmp-summary">${summary}</p><div class="compare-stats cmp-main">${deltas}</div><details class="cmp-all"><summary>顯示全部數值</summary><div class="compare-stats">${all.join('')}</div></details>${before.weaponType!==after.weaponType?`<p class="hint">武器類型：${before.weaponType?weaponTypeNames[before.weaponType as keyof typeof weaponTypeNames]:'空手'} → ${after.weaponType?weaponTypeNames[after.weaponType as keyof typeof weaponTypeNames]:'空手'}</p>`:''}${lost.length?`<p class="need">換裝後卡片／模組來源變化：${lost.join('；')}。技能配置保留。</p>`:'<p class="hint">換裝不會失去目前的卡片模組來源。</p>'}<div class="compare-actions">${virtual?'':`<button class="btn primary" data-wear="${e.id}" ${why?'':'disabled'}>${why?'穿上這件':'不符合穿著條件'}</button><button class="btn" data-equiplock="${e.id}">${e.locked?'解除鎖定':'鎖定防誤賣'}</button>`}<button class="btn" data-act="closeCompare">收起比較</button></div></section>`;
  }
  /** v4.9 readable comparison: only changed stats, in player terms, grouped offence → casting → defence → other. */
  private compareRows(a:R.Derived,b:R.Derived){
    const pct=(x:number)=>`${Math.round(x)}%`,f1=(x:number)=>(Math.round(x*10)/10).toString();
    type Row={g:number;label:string;va:number;vb:number;show:(v:number)=>string;higherBetter:boolean;tag?:string};
    const R0:Row[]=[
      {g:0,label:'物理攻擊',va:a.atk+a.weaponAtk,vb:b.atk+b.weaponAtk,show:v=>`${v}`,higherBetter:true,tag:'物攻'},
      {g:0,label:'魔法攻擊（平均）',va:(a.matkMin+a.matkMax)/2,vb:(b.matkMin+b.matkMax)/2,show:v=>`${Math.round(v)}`,higherBetter:true,tag:'魔攻'},
      {g:0,label:'攻擊速度（每秒）',va:1/a.attackDelay,vb:1/b.attackDelay,show:v=>v.toFixed(2),higherBetter:true,tag:'攻速'},
      {g:0,label:'爆擊率',va:a.crit,vb:b.crit,show:v=>pct(v),higherBetter:true,tag:'爆擊'},
      {g:0,label:'技能傷害',va:(a.skillMult-1)*100,vb:(b.skillMult-1)*100,show:v=>`+${pct(v)}`,higherBetter:true,tag:'技能傷害'},
      {g:0,label:'追加傷害',va:(a.derivedMult-1)*100,vb:(b.derivedMult-1)*100,show:v=>`+${pct(v)}`,higherBetter:true,tag:'追加傷害'},
      {g:0,label:'命中',va:a.hit,vb:b.hit,show:v=>`${v}`,higherBetter:true},
      {g:0,label:'射程',va:a.range,vb:b.range,show:v=>f1(v),higherBetter:true},
      {g:1,label:'詠唱縮短',va:(1-a.castMult)*100,vb:(1-b.castMult)*100,show:v=>pct(v),higherBetter:true,tag:'施法更快'},
      {g:1,label:'技能延遲縮短',va:(1-a.delayMult)*100,vb:(1-b.delayMult)*100,show:v=>pct(v),higherBetter:true,tag:'收招更快'},
      {g:1,label:'SP 消耗降低',va:(1-a.spCostMult)*100,vb:(1-b.spCostMult)*100,show:v=>pct(v),higherBetter:true,tag:'更省魔'},
      {g:1,label:'最大 SP',va:a.maxSp,vb:b.maxSp,show:v=>`${v}`,higherBetter:true,tag:'SP'},
      {g:1,label:'SP 回復（每次）',va:a.spRegen,vb:b.spRegen,show:v=>f1(v),higherBetter:true},
      {g:2,label:'最大 HP',va:a.maxHp,vb:b.maxHp,show:v=>`${v}`,higherBetter:true,tag:'HP'},
      {g:2,label:'防禦',va:a.def+a.vitDef,vb:b.def+b.vitDef,show:v=>`${v}`,higherBetter:true,tag:'防禦'},
      {g:2,label:'魔法防禦',va:a.mdef,vb:b.mdef,show:v=>`${v}`,higherBetter:true,tag:'魔防'},
      {g:2,label:'迴避',va:a.flee,vb:b.flee,show:v=>`${v}`,higherBetter:true},
      {g:2,label:'HP 回復（每次）',va:a.hpRegen,vb:b.hpRegen,show:v=>f1(v),higherBetter:true},
      ...(Object.keys(statNames) as Stat[]).map(k=>({g:3,label:statNames[k],va:a.stats[k],vb:b.stats[k],show:(v:number)=>`${v}`,higherBetter:true})),
    ];
    const fmtRow=(r:Row)=>{const d=r.vb-r.va,eps=Math.abs(d)<1e-6,good=r.higherBetter?d>0:d<0,shownD=r.show(Math.abs(d)).replace(/^\+/,'');
      return `<div><span>${r.label}</span><b>${r.show(r.va)} → ${r.show(r.vb)}</b><em class="${eps?'':good?'gain':'loss'}">${eps?'—':(d>0?'▲ ':'▼ ')+shownD}</em></div>`;};
    const changed=R0.filter(r=>Math.abs(r.vb-r.va)>1e-6&&r.show(r.va)!==r.show(r.vb)).sort((x,y)=>x.g-y.g);
    const up=changed.filter(r=>r.higherBetter?r.vb>r.va:r.vb<r.va),down=changed.filter(r=>!up.includes(r));
    const words=[...up.filter(r=>r.tag).slice(0,3).map(r=>r.tag!.endsWith('快')||r.tag!.startsWith('更')?r.tag!:`${r.tag}提升`),...down.filter(r=>r.tag).slice(0,2).map(r=>`${r.tag}下降`)];
    const summary=changed.length?`${words.length?words.join('、')+'　·　':''}<span class="gain">${up.length} 項變好</span>、<span class="loss">${down.length} 項變差</span>`:'換上後能力沒有變化';
    return {rows:changed.map(fmtRow),all:R0.map(fmtRow),summary};
  }
  private questsHtml(s:GameState){
    const st=R.questStatus(s),challenges=R.challengeStatuses(s);
    return `<div class="section-label">主線委託</div>${st?`<article class="quest-card"><span class="eyebrow">${st.done?'可領取獎勵':'進行中'} · ${st.progress}</span><h3>${st.def.title}</h3><p>${st.def.text}</p><p class="hint">獎勵：${this.rewardText(st.def)}</p><button class="btn primary" data-navigate="${st.def.id}">${st.done?'前往莉莉領獎':'追蹤委託目標'}</button></article>`:'<p>你已完成所有主線委託，晨光鎮會記得你的冒險。</p>'}<div class="section-label">MVP 自選挑戰</div><p class="hint">強敵討伐是額外挑戰，不影響主線進度。準備好裝備、卡片與補給，再前往挑戰。</p><div class="list">${challenges.map(c=>`<article class="quest-card ${c.unlocked?'':'undiscovered'}"><span class="eyebrow">${c.completed?'已領取獎勵':!c.unlocked?'尚未解鎖':c.done?'可領取獎勵':'可選挑戰'} · ${c.progress}</span><h3>${c.def.title}</h3><p>${c.def.text}</p><p class="hint">獎勵：${this.rewardText(c.def)}</p>${c.unlocked&&!c.completed?`<button class="btn ${c.done?'primary':''}" ${c.done?`data-claimchallenge="${c.def.id}"`:`data-navigate="${c.def.id}"`}>${c.done?'領取挑戰獎勵':'追蹤強敵'}</button>`:''}</article>`).join('')}</div>`+this.exploreLogHtml(s);
  }
  /** v4.6 adventure log: chests, landmark trials, bounties and discovered landmarks. */
  private exploreLogHtml(s:GameState){
    const e=s.explore??X.emptyExplore(),allLm=Object.entries(landmarks).flatMap(([m,l])=>l.map((x,i)=>({key:`${m}:${i}`,name:x.name,map:maps[m]?.name??m})));
    const trials=Object.entries(TRIALS).map(([k,T])=>`<div class="setting"><span>${T.title}<small class="hint">　${allLm.find(l=>l.key===k)?.map??''}</small></span><b>${e.trials[k]??0} 次</b></div>`).join('');
    const found=allLm.map(l=>`<span class="pill ${e.found.includes(l.key)?'live':''}">${e.found.includes(l.key)?'✓ ':''}${l.name}</span>`).join(' ');
    return `<div class="section-label" style="margin-top:18px">探索紀錄</div>
      <div class="explore-stats"><div><b>${e.chests.normal}</b><small>寶箱</small></div><div><b>${e.chests.rare}</b><small>稀有寶箱</small></div><div><b>${e.chests.trial}</b><small>試煉寶箱</small></div><div><b>${e.chests.supply}</b><small>營地補給</small></div><div><b>${e.bounties}</b><small>懸賞完成</small></div></div>
      <p class="hint" style="margin:8px 0">野外隨處藏著寶箱（打開後約 3 分鐘會在別處再出現），金色的是稀有寶箱，偶爾還會遇到<b>寶箱怪</b>！營地可以領補給，石環、誓約石、封印碑、祭壇可以啟動試煉。晨光鎮的<b>懸賞官 雷克斯</b>提供可重複的討伐懸賞。</p>
      ${trials}<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px">${found}</div>`;
  }
  private statusHtml(s:GameState){
    const c=s.char,d=R.derive(s);
    const rows=(Object.keys(statNames) as Stat[]).map(k=>{const cost=statRaiseCost(c.stats[k]),bonus=d.stats[k]-c.stats[k];
      return `<b data-tip="${esc(`<b>${statNames[k]}</b>${statHints[k]}`)}">${statNames[k]}</b><span class="val">${c.stats[k]}${bonus?`<small style="color:#3a6aa8">+${bonus}</small>`:''}</span>
        <button class="btn plus" data-stat="${k}" ${c.statPoints>=cost&&c.stats[k]<99?'':'disabled'} aria-label="提升 ${statNames[k]}">+</button><span class="cost">${cost}</span>`;}).join('');
    const town=this.main.world.inTown;
    return `${this.buildGuideHtml(s)}<div class="section-label">角色素質 · 點擊 ＋ 分配一點</div><div class="stats">${rows}</div>
      <p style="margin:8px 0 0">剩餘素質點 <b class="sp-left">${c.statPoints}</b> <span class="hint">（右側數字是提升所需點數）</span></p>
      <div class="derived">
        <div><span>ATK</span><b>${d.atk} + ${d.weaponAtk}</b></div><div><span>MATK</span><b>${d.matkMin} ~ ${d.matkMax}</b></div>
        <div><span>DEF</span><b>${d.def} + ${d.vitDef}</b></div><div><span>MDEF</span><b>${d.mdef}</b></div>
        <div><span>HIT</span><b>${d.hit}</b></div><div><span>FLEE</span><b>${d.flee}</b></div>
        <div><span>爆擊</span><b>${d.crit.toFixed(1)}%</b></div><div><span>攻擊間隔</span><b>${d.attackDelay.toFixed(2)} 秒</b></div>
        <div><span>詠唱時間</span><b>${d.castMult<=0?'零詠唱！':Math.round(d.castMult*100)+'%'}</b></div><div><span>射程</span><b>${d.range.toFixed(1)} 格</b></div>
        <div data-tip="${esc('<b>詠唱</b>1 − DEX÷150 − 裝備詠唱%。歸零就是零詠唱；技能的「時晶詠唱」模組還能再縮短。')}"><span>裝備詠唱</span><b>−${d.gearCast}%</b></div><div><span>技能延遲</span><b>${Math.round(d.delayMult*100)}%</b></div>
        <div><span>裝備攻速</span><b>+${d.gearAspd}%</b></div><div><span>零詠唱所需 DEX</span><b>${Math.max(0,Math.ceil((1-Math.min(45,d.gearCast)/100)*150))}</b></div>
      </div>
      <p style="margin:10px 0 0;display:flex;justify-content:space-between;align-items:center"><span class="hint">${town?'城鎮內可免費重置素質。':'回到城鎮才能重置素質。'}</span><button class="btn" data-act="resetStats" ${town?'':'disabled'}>重置素質</button></p>`;
  }
  private invHtml(s:GameState){
    const tabs=[['use','消耗'],['equip','裝備'],['etc','素材'],['card','卡片']] as const;
    let cells='';
    if(this.invTab==='use'||this.invTab==='etc'){
      const kind=this.invTab;
      for(const [id,n] of Object.entries(s.items)){const d=items[id];if(d.kind!==kind)continue;
        cells+=`<button class="cell" ${kind==='use'?`draggable="true" data-hk='${JSON.stringify({type:'item',id})}' data-use="${id}"`:''} data-tip="${esc(`<b>${d.name}</b>${d.desc}<br><span class="hint">${kind==='use'?'雙擊使用，拖曳到快捷欄':'可在商店賣出'}　賣價 ${R.sellPrice(id)} z</span>`)}"><img src="${itemIcon(id)}" alt=""><span class="n">${n}</span></button>`;}
    }else if(this.invTab==='equip'){
      const worn=new Set(Object.values(s.equipped));
      for(const e of s.equipment){const d=items[e.defId] as EquipDef,w=worn.has(e.id),cardsIn=s.cards.filter(c=>c.loc.kind==='equip'&&c.loc.equipId===e.id);
        cells+=`<button class="cell ${w?'worn':''} ${e.locked?'locked':''} ${e.q?`q${e.q}`:''}" data-equip="${e.id}" data-tip="${esc((e.refine?`<b>+${e.refine}</b>`:'')+this.equipTip(s,e.defId,cardsIn.map(c=>`${cards[c.defId].name} Lv.${c.level}`),e))}"><img src="${itemIcon(e.defId)}" alt="">${w?'<span class="tag">E</span>':e.refine?`<span class="tag">+${e.refine}</span>`:''}${e.locked?'<span class="gear-lock" aria-label="已鎖定">◆</span>':''}${d.slots?`<span class="n">[${cardsIn.length}/${d.slots}]</span>`:''}</button>`;}
    }else{
      for(const c of [...s.cards].sort((a,b)=>a.defId.localeCompare(b.defId)||b.level-a.level)){const def=cards[c.defId];
        cells+=`<button class="cell lv${c.level}" data-opencards="1" data-tip="${esc(`<b>${def.name} Lv.${c.level}</b>${modules[def.moduleId].name}：${modules[def.moduleId].desc(moduleCoefficient(c.defId,c.level))}<br><span class="hint">${c.loc.kind==='equip'?'已插在裝備上':'在背包'}${c.locked?' · 已鎖定':''}</span>`)}"><img src="${cardIcon(c.defId)}" alt=""><span class="tag">Lv${c.level}</span></button>`;}
    }
    const empty=cells?'':'<p class="hint">這裡還沒有東西。</p>';
    return `<div class="tabs">${tabs.map(([k,n])=>`<button class="${this.invTab===k?'on':''}" data-invtab="${k}">${n}</button>`).join('')}</div><div class="grid">${cells}</div>${empty}${this.invTab==='equip'?`<div class="compare-host">${this.compareHtml(s)}</div>`:''}
      <p class="hint" style="margin:8px 0 0">${this.invTab==='equip'?'點選裝備比較能力；雙擊穿上／卸下。鎖定可防止誤賣。':this.invTab==='use'?'雙擊使用；拖曳到下方快捷欄。':this.invTab==='card'?'點卡片打開卡片冊。':'素材可以拿去商店賣錢。'}</p>`;
  }
  private equipTip(s:GameState,defId:string,inserted:string[]=[],inst?:R.EquipInst){
    const d=items[defId] as EquipDef,can=R.canWear(s,d);
    // v6.3 quality: coloured grade, random affixes and the legendary effect come first.
    const q=inst?.q??0,head=q?`<b style="color:${QUALITY[q].color}">【${QUALITY[q].name}】</b>`:'';
    const aff=q?`<br><span class="affix" style="color:${QUALITY[q].color}">${(inst!.affix??[]).map(affixText).join('　')}${inst!.legend?`<br>✦ 傳說效果：${GEAR_FX[inst!.legend]}`:''}</span>`:'';
    const stats=[d.atk?`ATK +${d.atk}`:'',d.matk?`MATK +${d.matk}%`:'',d.def?`DEF +${d.def}`:'',d.mdef?`MDEF +${d.mdef}`:'',d.hp?`HP +${d.hp}`:'',d.sp?`SP +${d.sp}`:'',...Object.entries(d.stats??{}).map(([k,v])=>`${statNames[k as Stat]} +${v}`),d.cast?`詠唱 −${d.cast}%`:'',d.aspd?`攻速 +${d.aspd}%`:'',d.crit?`爆擊 +${d.crit}%`:'',d.delay?`技能延遲 −${d.delay}%`:'',d.spCost?`SP 消耗 −${d.spCost}%`:'',d.spRegen?`SP 回復 +${d.spRegen}%`:'',d.loop?`追加傷害 +${d.loop}%`:'',d.skill?`技能傷害 +${d.skill}%`:''].filter(Boolean).join('　');
    // The piece's own build effect (流派武器、配裝) — used to live only in the code, never in the tooltip.
    const own=d.fx?`<br><span class="affix" style="color:#ff9a3d">✦ 特效：${GEAR_FX[d.fx]}</span>`:'';
    return `${head}<b>${d.name}${d.slots?` [${d.slots}]`:''}</b>${aff}${own}${aff||own?'<br>':''}${equipSlotNames[d.slot]}${d.weaponType?` · ${weaponTypeNames[d.weaponType]}`:''}<br><span class="stat">${stats}</span><br>${d.desc}<br>${this.traitLine(d)}
      <span class="${can?'hint':'need'}">需求：Lv.${d.reqLv} · ${d.jobs==='all'?'全職業':d.jobs.map(j=>jobs[j].name).join('、')}</span>${inserted.length?`<br>卡片：${inserted.join('、')}`:''}`;
  }
  /** v4.7: the piece's refine trait and what +3/+5/+7 add (plus the signature +7 bonus). */
  private traitLine(d:EquipDef,refine?:number){
    const k=traitOf(d),st=TRAIT_STEPS[k],u=pctTrait(k)?'%':'';
    const steps=`+3 ${st[0]}${u}　+5 ${st[0]+st[1]}${u}　+7 ${st[0]+st[1]+st[2]}${u}`;
    const now=refine!==undefined&&refine>0?bonusText(refineBonus(d,refine)):'';
    return `<span class="trait">精煉特性：<b>${TRAIT_NAMES[k]}</b>（${steps}）${d.refine7?`<br>+7 招牌加成：${bonusText(d.refine7)}`:''}${d.special?`<br>✦ ${d.special}`:''}${now?`<br>目前精煉加成：${now}`:''}</span><br>`;
  }
  /** v4.7 工匠工坊: craft signature gear or cook food from materials. */
  private craftTab:'gear'|'food'='gear';
  private craftHtml(s:GameState){
    const tabs=`<div class="tabs"><button class="${this.craftTab==='gear'?'on':''}" data-craft-tab="gear">打造裝備</button><button class="${this.craftTab==='food'?'on':''}" data-craft-tab="food">料理</button></div>`;
    const rows=recipes.filter(r=>r.kind===this.craftTab).map(r=>{const d=items[r.out],miss=C.missingFor(s,r);
      const mats=Object.entries(r.mats).map(([id,n])=>{const have=s.items[id]??0;return `<span class="${have>=n?'gain':'need'}">${items[id].name} ${have}/${n}</span>`;}).join('、');
      const tip=d.kind==='equip'?this.equipTip(s,r.out):`<b>${d.name}</b>${d.desc}`;
      return `<div class="row"><img src="${itemIcon(r.out)}" alt="" data-tip="${esc(tip)}"><div class="main"><b>${d.name}${r.count>1?` ×${r.count}`:''}</b><small>${d.kind==='equip'?this.statSummary(d as EquipDef):d.desc}</small><small>材料：${mats}　·　<span class="${s.char.zeny>=r.zeny?'gain':'need'}">${fmt(r.zeny)} z</span></small></div><button class="btn primary" data-craft="${r.id}" ${miss.length?'disabled':''}>${this.craftTab==='gear'?'打造':'烹煮'}</button></div>`;}).join('');
    const hint=this.craftTab==='gear'?'招牌裝備需要<b>試煉徽記</b>：完成地標試煉（試煉寶箱）或 Lv.10 以上的懸賞都會得到。MVP 素材來自各地的 MVP。':'把打怪撿到的素材做成食物，比用買的省很多。';
    return tabs+`<p class="hint" style="margin:0 0 8px">${hint}</p><div class="list">${rows}</div>`;
  }
  private statSummary(d:EquipDef){return [d.atk?`ATK ${d.atk}`:'',d.matk?`MATK +${d.matk}%`:'',d.def?`DEF ${d.def}`:'',d.cast?`詠唱 −${d.cast}%`:'',d.aspd?`攻速 +${d.aspd}%`:'',d.delay?`延遲 −${d.delay}%`:'',d.crit?`爆擊 +${d.crit}%`:'',d.spCost?`SP 消耗 −${d.spCost}%`:'',d.spRegen?`SP 回復 +${d.spRegen}%`:'',d.loop?`追加傷害 +${d.loop}%`:'',d.skill?`技能傷害 +${d.skill}%`:'',d.hp?`HP +${d.hp}`:'',d.sp?`SP +${d.sp}`:''].filter(Boolean).join(' · ')+` · Lv.${d.reqLv}`;}
  private equipHtml(s:GameState){
    const slot=(k:EquipSlot)=>{
      const id=s.equipped[k],e=id?s.equipment.find(x=>x.id===id):null,d=e?items[e.defId] as EquipDef:null;
      if(!e||!d)return `<div class="eslot"><div class="top"><span class="nm"><small>${equipSlotNames[k]}</small><span class="hint">（空）</span></span></div></div>`;
      const inserted=s.cards.filter(c=>c.loc.kind==='equip'&&c.loc.equipId===e.id);
      const cs=Array.from({length:d.slots},(_,i)=>{const c=inserted.find(c=>(c.loc as {slot:number}).slot===i);
        return c?`<button class="cardslot filled" data-removecard="${c.id}" data-tip="${esc(`<b>${cards[c.defId].name} Lv.${c.level}</b>點擊免費拔出`)}"><img src="${cardIcon(c.defId)}" alt=""></button>`
          :`<button class="cardslot" data-pick="${e.id}" data-tip="${esc('<b>空卡槽</b>點擊選擇要插入的卡片')}">＋</button>`;}).join('');
      return `<div class="eslot"><div class="top"><img src="${itemIcon(e.defId)}" alt=""><span class="nm"><small>${equipSlotNames[k]}</small><button class="btn" style="padding:0 4px;font-size:11px" data-unequip="${k}" data-tip="${esc(this.equipTip(s,e.defId,[],e)+'<br><span class="hint">點擊卸下</span>')}" ${e.q?`style="color:${QUALITY[e.q].color};text-shadow:0 1px 1px #0008"`:''}>${esc(R.equipLabel(e))}</button></span></div>${d.slots?`<div class="cards">${cs}</div>`:''}</div>`;
    };
    let picker='';
    if(this.equipPick){
      const target=s.equipment.find(e=>e.id===this.equipPick!.equipId),worn=new Set(Object.values(s.equipped));
      // v4.9: every card is offered — bag cards first, then cards sitting in other gear (moved over in one click).
      const where=(c:R.CardInst)=>{if(c.loc.kind!=='equip')return null;const eid=c.loc.equipId,e=s.equipment.find(x=>x.id===eid);return e?{name:R.equipLabel(e),worn:worn.has(e.id)}:null;};
      const pool=s.cards.filter(c=>!(c.loc.kind==='equip'&&c.loc.equipId===this.equipPick!.equipId)).sort((a,b)=>Number(a.loc.kind!=='bag')-Number(b.loc.kind!=='bag')||a.defId.localeCompare(b.defId)||b.level-a.level);
      const row=(c:R.CardInst)=>{const w=where(c),mod=modules[cards[c.defId].moduleId];
        return `<div class="row"><img src="${cardIcon(c.defId)}" alt=""><div class="main"><b>${cards[c.defId].name} Lv.${c.level}</b><small>${mod.name}：${mod.desc(moduleCoefficient(c.defId,c.level))}</small>${w?`<small class="card-where ${w.worn?'worn':''}">📍 目前插在「${esc(w.name)}」${w.worn?'（穿著中，移走後那件會失去這張卡的效果）':'（背包裡的裝備）'}</small>`:'<small class="card-where bag">在背包</small>'}</div><button class="btn ${w?'':'primary'}" data-insert="${c.id}">${w?'移到這件':'插入'}</button></div>`;};
      picker=`<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--line2)"><b>插入卡片到「${target?items[target.defId].name:''}」</b><span class="hint">　插拔免費、不會損壞，戰鬥中不能操作。插在其他裝備上的卡也能直接移過來。</span>
        <div class="list" style="margin-top:6px;max-height:240px;overflow:auto">${pool.length?pool.map(row).join(''):'<p class="hint">還沒有卡片。打倒魔物有機會掉落卡片。</p>'}</div>
        <p style="margin:6px 0 0;text-align:right"><button class="btn" data-act="cancelPick">取消</button></p></div>`;
    }
    return `<div class="equip"><div class="col">${slot('head')}${slot('armor')}${slot('shoes')}</div>
      <div class="portrait"><canvas class="portrait-cv" width="${CW}" height="${CH}"></canvas></div>
      <div class="col">${slot('weapon')}${slot('garment')}${slot('accessory')}</div></div>${picker}
      <p class="hint" style="margin:8px 0 0">卡片必須插在<b>穿著中</b>的裝備裡才會生效；生效的卡片會解鎖技能模組，到「技能」視窗配置。</p>`;
  }
  /** v4.4: per-level cast times (base → yours) and what zero-cast takes with the current gear. */
  private castTipHtml(s:GameState,id:string,lv:number,d:ReturnType<typeof R.derive>){
    const sk=skills[id];if(!sk||sk.target==='passive')return '';
    const levels=Array.from({length:sk.maxLv},(_,i)=>i+1);if(levels.every(l=>sk.cast(l)===0))return '';
    const tier=awakenings[id]?masteryTier(s.mastery?.[id]??0):0,mc=MASTERY_BONUS[tier].cast,mult=d.castMult*mc;
    const gear=Math.min(45,d.gearCast),dex=s.char.stats.dex,need=Math.ceil(150*(1-gear/100));
    const cells=levels.map(l=>`<span style="${l===lv?'font-weight:700;color:#c0392b':''}">Lv${l} ${sk.cast(l).toFixed(1)}→${(sk.cast(l)*mult).toFixed(1)}</span>`).join('　');
    return `<hr style="border:0;border-top:1px solid #ccc;margin:5px 0"><b>詠唱時間（原本→你目前，秒）</b><br>${cells}<br>`+
      `你的詠唱倍率 <strong>${Math.round(mult*100)}%</strong>＝1 − DEX ${dex}÷150 − 裝備 ${gear}%${mc<1?`，再 ×熟練 ${mc}`:''}${d.gearCast>45?'（裝備詠唱上限 45%）':''}<br>`+
      (mult<=0?'<strong style="color:#2e7d32">✓ 已達零詠唱</strong>':`<strong>零詠唱條件</strong>：DEX ÷150 ＋ 裝備詠唱% ≥ 100%。以你目前裝備（−${gear}%）需要 <strong>DEX ${need}</strong>（還差 ${Math.max(0,need-dex)}）；裝備詠唱最多算到 45%，所以 DEX 至少要 83。`)+
      `<br><small>快速詠唱卡模組另外再減，施放後延遲（${sk.delay} 秒）不受詠唱影響。</small>`;
  }
  /** v4.4: mastery summary inside the skill tooltip. */
  private masteryTipHtml(s:GameState,id:string,lv:number){
    const aw=awakenings[id];if(!aw)return '';
    const xp=s.mastery?.[id]??0,tier=masteryTier(xp);
    const rows=MASTERY_NAMES.map((n,i)=>{const b=MASTERY_BONUS[i];return `<span style="${i===tier&&lv>0?'font-weight:700;color:#c0392b':''}">${n}${i?`（${MASTERY_TIERS[i]} 次）`:''}：傷害 ×${b.dmg}・SP ×${b.sp}・詠唱 ×${b.cast}</span>`;}).join('<br>');
    return `<hr style="border:0;border-top:1px solid #ccc;margin:5px 0"><b>熟練度</b>（每施放一次 +1，目前 ${xp} 次）<br>${rows}<br><b>覺醒「${aw.name}」</b>${aw.desc}`;
  }
  /** v6.5: how the current 戰魂 changes this skill. */
  private soulLine(s:GameState,id:string){const so=s.char.job==='swordman'?SOULS[s.char.soul??'art']:null;if(!so||((s.char.soul??'art')==='art'&&!id.startsWith('k_')))return '';
    const t=id==='bash'?so.bash:id==='magnum'?so.magnum:id==='endure'?so.endure:so.k[id];return t?`<small class="soul-skill" style="color:${so.color}">${so.icon} ${so.name}：${t}</small>`:'';}
  private skillsHtml(s:GameState){
    const c=s.char,d=R.derive(s),active=new Map(R.resolveModules(s).map(m=>[m.moduleId,m]));
    let head=`<p style="margin:0 0 6px;display:flex;justify-content:space-between"><span>${jobs[c.job].name}　Job Lv.${c.jobLv}</span><span>技能點 <b class="sp-left">${c.skillPoints}</b></span></p>`;
    if(c.job2){const j2=jobs[c.job2];head+=`<div class="row job2-head" style="border-left:4px solid ${j2.color}"><div class="main"><b>${JOB_EMBLEM[c.job2]} ${j2.name}　二轉 Job Lv.${c.job2Lv}/${JOB2_MAX}</b><small>${j2.desc}</small></div><span>二轉技能點 <b class="sp-left">${c.skillPoints2??0}</b></span>${this.main.world.inTown?'<button class="btn" data-act="resetSkills2" data-tip="在城鎮裡可以免費重新分配二轉技能點（熟練度保留）。">重新分配</button>':''}</div>`;}
    else if(c.job!=='novice'&&secondJobOf[c.job]){const nx=jobs[secondJobOf[c.job]!],ok=c.baseLv>=JOB2_REQ.baseLv&&c.jobLv>=JOB2_REQ.jobLv;
      head+=`<div class="row" style="background:#fff8e1;margin-bottom:6px"><div class="main"><b>${ok?'可以二轉了！':'二轉之路'}：${nx.name}</b><small>Base ${c.baseLv}/${JOB2_REQ.baseLv} · Job ${c.jobLv}/${JOB2_REQ.jobLv}　${ok?'到<b>曙光前哨</b>找遠征隊長<b>艾德</b>。':nx.desc}</small></div></div>`;}
    // v6.5 劍士戰魂: pick one rule set; locked ones show when they open.
    if(c.job==='swordman'){const cur=c.soul??'art',inTown=this.main.world.inTown;
      head+=`<div class="souls"><div class="souls-title"><b>戰魂</b><span class="hint">${inTown?'點選切換（城鎮免費）':'到城鎮才能切換'}</span></div><div class="souls-row">${SOUL_IDS.map(id=>{const so=SOULS[id],open=R.soulUnlocked(s,id);
        return `<button class="soul ${cur===id?'on':''} ${open?'':'locked'}" data-soul="${id}" style="--sc:${so.color}" ${open&&inTown&&cur!==id?'':'disabled'} data-tip="${esc(`<b>${so.icon} ${so.name}</b>${so.desc}<br>擅長：${so.role}<br>連環重斬 → ${so.bash}<br>烈焰爆破 → ${so.magnum}${so.endure?`<br>鐵壁意志 → ${so.endure}`:''}<br>⚜ 二轉：${so.knight}${Object.entries(so.k).map(([k,v])=>`<br>${skills[k].name} → ${v}`).join('')}${open?'':`<br><span class="need">一轉 Job ${so.unlock} 解鎖</span>`}`)}"><i>${so.icon}</i><span>${so.name}</span>${open?'':`<small>Job ${so.unlock}</small>`}</button>`;}).join('')}</div>
        <small class="soul-now">${SOULS[cur].icon} ${SOULS[cur].name}：${SOULS[cur].desc}</small>${c.job2==='knight'?`<small class="soul-now" style="color:${SOULS[cur].color==='#e8eef6'?'#8a6a2a':SOULS[cur].color}">⚜ 二轉共鳴・${SOULS[cur].knight}</small>`:''}</div>`;}
    if(c.job==='novice'){const why=R.jobChangeReady(s);head+=`<div class="row" style="background:#fff8e1;margin-bottom:6px"><div class="main"><b>${why?'轉職條件':'可以轉職了！'}</b><small>職業等級 ${c.jobLv}/10 · 基本技能 Lv.${c.skills.basic??0}/9　${why?'':'到晨光鎮找<b>轉職官 葛蘭</b>。'}</small></div></div>`;}
    const section=(job:JobId)=>{
      const list=skillsOf(job);if(!list.length)return '';
      const locked=job!=='novice'&&job!==c.job&&job!==c.job2;if(locked)return '';
      const second=secondJobs.includes(job);
      return `<h4 style="margin:8px 0 4px">${jobs[job].name}技能${second?'（二轉）':''}</h4><div class="list">${list.map(sk=>{
        const lv=c.skills[sk.id]??0,why=R.canLearn(s,sk.id),missing=[...(sk.jobReq&&(c.job2Lv??0)<sk.jobReq?[`二轉 Job Lv.${sk.jobReq}`]:[]),...Object.entries(sk.prereq).filter(([p,n])=>(c.skills[p]??0)<n).map(([p,n])=>`${skills[p].name} Lv.${n}`)];
        const drag=lv>0&&sk.target!=='passive'?`draggable="true" data-hk='${JSON.stringify({type:'skill',id:sk.id})}'`:'';
        let tip=`<b>${sk.name}</b>${sk.target==='passive'?'被動技能':sk.target==='ground'?'地面指定':sk.target==='self'?'自身':'指定目標'} · ${elementNames[sk.element]}屬性${sk.range?` · 射程 ${sk.range} 格`:''}<br>${lv?`目前：${sk.desc(lv)}<br>`:''}${lv<sk.maxLv?`下一級：${sk.desc(lv+1)}<br>SP ${sk.sp(lv+1)}${sk.cast(lv+1)?` · 詠唱 ${(sk.cast(lv+1)*d.castMult).toFixed(1)} 秒`:''}`:'已達最高等級'}`;
        let mods='';
        const castTip=this.castTipHtml(s,sk.id,lv,d),awTip=this.masteryTipHtml(s,sk.id,lv);
        if(castTip||awTip)tip+=castTip+awTip;
        if(lv>0&&R.moduleSkills(sk.id)){
          const slots=(s.loadouts[sk.id]??[null,null]);
          mods=`<div class="mods">${slots.map((m,i)=>{
            const opts=Object.values(modules).filter(md=>R.moduleFits(sk.id,md.id)).map(md=>{const a=active.get(md.id);return `<option value="${md.id}" ${m===md.id?'selected':''}>${md.name}${a?` (Lv.${a.level})`:'（無卡）'}</option>`;}).join('');
            const reason=m?R.moduleInactiveReason(sk.id,m):null,a=m&&!reason?active.get(m):null;
            return `<label>模組 ${i+1} <select data-mod="${sk.id}" data-slot="${i}"><option value="">—</option>${m&&R.moduleInactiveReason(sk.id,m)?`<option selected value="${m}">${modules[m].name}（相容性調整後暫停）</option>`:''}${opts}</select></label>${m?`<span class="${a?'live':'dormant'}" data-tip="${esc(a?`<b>${modules[m].name} Lv.${a.level}</b>${modules[m].desc(moduleCoefficient(s.cards.find(x=>x.id===a.cardId)!.defId,a.level))}`:reason??'沒有插在穿著中裝備上的對應卡片，模組暫停。配置會保留。')}">${a?`生效 Lv.${a.level}`:reason?'不相容，請重選':'缺少生效卡片'}</span>`:''}`;}).join('')}</div>`;
        }
        // v4.3 mastery bar: grows with each cast; tier III awakens the skill.
        const aw=awakenings[sk.id];if(aw&&lv>0){const xp=s.mastery?.[sk.id]??0,tier=masteryTier(xp),next=MASTERY_TIERS[Math.min(3,tier+1)],prev=MASTERY_TIERS[tier];
          const pct=tier>=3?100:Math.round((xp-prev)/(next-prev)*100),b=MASTERY_BONUS[tier];
          mods=`<div class="mastery t${tier}" data-tip="${esc(`<b>${MASTERY_NAMES[tier]}</b>傷害 ×${b.dmg} · SP ×${b.sp} · 詠唱 ×${b.cast}<br>熟練 I／II／覺醒：施放 ${MASTERY_TIERS[1]}／${MASTERY_TIERS[2]}／${MASTERY_TIERS[3]} 次<br><b>覺醒「${aw.name}」</b>${aw.desc}`)}"><span>${tier>=3?`✦ 覺醒・${aw.name}`:`${MASTERY_NAMES[tier]} · ${xp}/${next}`}</span><i><b style="width:${pct}%"></b></i></div>`+mods;}
        return `<div class="skillrow ${lv?'':'off'}"><img src="${skillIcon(sk.id)}" alt="" ${drag} data-tip="${esc(tip)}">
          <div><b>${sk.name}</b> <span class="lv">Lv.${lv}/${sk.maxLv}</span>${sk.target==='passive'?' <span class="hint">被動</span>':''}<small>${sk.desc(Math.max(1,lv))}</small>${this.soulLine(s,sk.id)}${missing.length&&lv===0?`<small class="need">需要 ${missing.join('、')}</small>`:''}</div>
          <button class="btn ${why?'':'primary'}" data-learn="${sk.id}" ${why?'disabled':''} data-tip="${esc(why??(second?'學習這個技能（消耗 1 二轉技能點）':'學習這個技能（消耗 1 技能點）'))}">＋</button>${mods}</div>`;
      }).join('')}</div>`;
    };
    return this.buildGuideHtml(s)+head+(c.job2?section(c.job2):'')+section(c.job==='novice'?'novice':c.job)+(c.job!=='novice'?section('novice'):'')+`<p class="hint" style="margin:8px 0 0">點空快捷欄即可選擇技能，也可以拖曳圖示。${(c.skills.firstAid??0)>0?'急救已免費習得，可以放上快捷欄補血。':'基本技能 Lv.3 會自動習得急救，不消耗技能點。'}模組來自插在穿著裝備上的卡片。</p>`;
  }
  private cardsHtml(s:GameState){
    if(this.collectionTab!=='owned')return this.collectionHtml(s);
    const sources=new Map(R.resolveModules(s).map(m=>[m.moduleId,m]));
    const page=paginateCollection([...s.cards].sort((a,b)=>a.defId.localeCompare(b.defId)||b.level-a.level),this.collectionPage);
    this.collectionPage=page.page;
    const rows=page.entries.map(c=>{
      const def=cards[c.defId],mod=modules[def.moduleId],safe=R.safeMaterials(s,c),need=c.level;
      const where=c.loc.kind==='equip'?(()=>{const e=s.equipment.find(x=>x.id===(c.loc as {equipId:string}).equipId)!;const worn=Object.values(s.equipped).includes(e.id);return `插在 ${items[e.defId].name}${worn?'（穿著中）':'（未穿）'}`;})():'背包';
      const canUp=c.level<def.maxLevel&&safe.length>=need;
      let ask='';
      if(this.upgradeAsk===c.id){const mats=safe.slice(0,need);ask=`<div class="row" style="background:#fff8e1;flex-wrap:wrap"><div class="main"><b>升級確認：Lv.${c.level} → Lv.${c.level+1}</b><small>會消耗 ${need} 張背包中的 ${def.name} Lv.1（${mats.map(m=>m.id).join('、')}）。主卡保留，其他同名卡不受影響。<br>效果：${mod.desc(moduleCoefficient(c.defId,c.level))} → <b>${mod.desc(moduleCoefficient(c.defId,c.level+1))}</b></small></div>
        <button class="btn primary" data-upgrade-ok="${c.id}" data-mats="${mats.map(m=>m.id).join(',')}">確認升級</button><button class="btn" data-act="cancelUp">取消</button></div>`;}
      return `<div class="row ${c.locked?'':''}"><img src="${cardIcon(c.defId)}" alt=""><div class="main"><b>${def.name} Lv.${c.level}/${def.maxLevel}</b>${c.locked?' 🔒':''}<small>${mod.name}：${mod.desc(moduleCoefficient(c.defId,c.level))}</small><small>${where} · ${sources.get(def.moduleId)?.cardId===c.id?'目前生效來源':'未作為生效來源'}</small></div>
        <button class="btn" data-up="${c.id}" ${canUp?'':'disabled'} data-tip="${esc(c.level>=def.maxLevel?'已達最高等級':`需要 ${need} 張背包中、未鎖定的同名 Lv.1 卡（目前 ${safe.length} 張）`)}">升級</button>
        <button class="btn" data-lock="${c.id}">${c.locked?'解鎖':'鎖定'}</button></div>${ask}`;
    }).join('');
    return this.collectionTabsHtml()+`<section class="onboarding"><span class="eyebrow">卡片讓技能長出新玩法</span><b>${s.cards.length?'下一步：讓卡片效果生效':'你的第一張卡片，從打倒魔物開始'}</b><p>① 取得卡片 → ② 插入穿著裝備的空卡槽 → ③ 在技能中配置模組。插拔免費，戰鬥中無法更換。</p><div><button class="btn primary" data-open="equip">裝備與插卡</button><button class="btn" data-open="skills">技能模組設定</button></div></section><div class="section-label">持有卡片 · ${s.cards.length} 張</div><p class="hint">每張卡片各自升級，同名卡不共享等級。相同模組只取穿著裝備中最高等級的一張，不會疊加。升級素材只使用背包內未鎖定的 Lv.1 同名卡。</p>${this.collectionPagerHtml(page)}<div class="list">${rows||'<p class="empty-state">還沒有卡片。卡片圖鑑會告訴你可以到哪裡尋找。</p>'}</div>`;
  }

  private collectionTabsHtml(){
    const tabs=[['card','卡片圖鑑'],['equip','裝備圖鑑'],['monster','魔物圖鑑'],['owned','持有卡管理']] as const;
    return `<nav class="tabs collection-tabs" aria-label="圖鑑分類">${tabs.map(([id,label])=>`<button type="button" data-collection-tab="${id}" aria-pressed="${this.collectionTab===id}" class="${this.collectionTab===id?'on':''}">${label}</button>`).join('')}</nav>`;
  }
  private collectionPagerHtml(page:{page:number;pageCount:number;total:number}){
    return `<nav class="collection-pager" aria-label="圖鑑分頁"><span role="status">共 ${page.total} 筆 · 第 ${page.page+1} / ${page.pageCount} 頁</span><div><button type="button" class="btn" data-collection-page="${page.page-1}" ${page.page===0?'disabled':''}>上一頁</button><button type="button" class="btn" data-collection-page="${page.page+1}" ${page.page+1>=page.pageCount?'disabled':''}>下一頁</button></div></nav>`;
  }
  private collectionHtml(s:GameState){
    const kind=this.collectionTab as CollectionKind;
    const all=buildCollection(s),filtered=filterCollection(all,{kind,text:this.collectionText,job:kind==='monster'?'':this.collectionJob,map:this.collectionMap,ownership:kind==='monster'?'all':this.collectionOwnership});
    const page=paginateCollection(filtered,this.collectionPage);this.collectionPage=page.page;
    const sources=new Map(R.resolveModules(s).map(m=>[m.moduleId,m]));
    const rows=page.entries.map(d=>{
      const icon=d.kind==='card'?cardIcon(d.id):d.kind==='equip'?itemIcon(d.id):monsterIcon(d.id);
      const source=d.kind==='card'?sources.get(cards[d.id].moduleId):undefined;
      const isCardSource=source&&s.cards.some(c=>c.id===source.cardId&&c.defId===d.id);
      const where=d.mapIds.map(id=>maps[id]?.name??id).join('、')||'目前未配置出沒地圖';
      return `<article class="collection-card ${d.kind!=='monster'&&!d.owned?'undiscovered':''}" data-collection-entry="${esc(d.id)}"><div class="collection-heading"><img src="${icon}" alt=""><div><b>${esc(d.name)}</b><small>${esc(d.detail)}</small></div>${d.kind!=='monster'?`<span class="pill ${d.owned?'live':''}">${d.owned?'已持有':'未取得'}</span>`:monsters[d.id].mvp?'<span class="pill">MVP</span>':''}</div><p>${esc(d.description)}</p><small class="collection-ownership">${esc(d.ownership)}</small>${d.kind==='monster'?`<small><b>出沒：</b>${esc(where)}</small>${!monsters[d.id].mvp?`<button class="btn ${this.main.hunt()===d.id?'primary':''}" data-hunt="${esc(d.id)}">${this.main.hunt()===d.id?'✓ 狩獵目標中（點擊取消）':'🎯 設為狩獵目標'}</button>`:''}<details class="collection-details"><summary>掉落物 · ${d.compatible.length} 種</summary><small>${d.compatible.map(esc).join('<br>')}</small></details>`:`${d.kind==='equip'?`<small><b>需求職業：</b>${d.jobs.map(j=>esc(jobs[j as JobId].name)).join('、')}</small>`:''}<div class="collection-sources"><small><b>取得來源：</b></small>${d.sources.map(src=>`<small>${esc(src.label)}</small>`).join('')||'<small>目前沒有設定取得來源</small>'}</div>${d.kind==='card'?`<details class="collection-details"><summary>相容技能 · ${d.compatible.length} 種</summary><small>${d.compatible.map(esc).join('<br>')||'無相容技能'}</small></details>${isCardSource?`<small class="gain">穿著裝備提供模組 Lv.${source.level}；需配置到相容技能才會觸發。</small>`:''}${d.owned?'<button class="btn" data-open="equip">裝備與插卡</button>':''}`:d.owned?'<button class="btn" data-collection-equip="1">到背包比較裝備</button>':''}`}</article>`;
    }).join('');
    return this.collectionTabsHtml()+`<p class="hint collection-intro">${kind==='card'?'卡片插在穿著中的裝備，並在相容技能配置模組才生效。每張卡各自升級，同名卡不共享等級；相同模組只取最高等級來源。':kind==='equip'?'先查看需求等級、職業與取得來源，規劃下一件裝備。圖鑑只供查詢，物品仍須透過打怪、購買或委託取得。':'查看魔物出沒與基礎掉落機率，尋找下一個刷寶目標。一般魔物未儲存累計討伐紀錄。'}</p><div class="collection-filters"><label class="collection-search">關鍵字<input type="search" id="collection-search" value="${esc(this.collectionText)}" placeholder="名稱、模組、技能或掉落來源" autocomplete="off"></label><label>職業<select id="collection-job" data-collection-filter="job" ${kind==='monster'?'disabled':''}><option value="">全部職業</option>${Object.values(jobs).map(j=>`<option value="${j.id}" ${this.collectionJob===j.id?'selected':''}>${j.name}</option>`).join('')}</select></label><label>區域<select id="collection-map" data-collection-filter="map"><option value="">全部區域</option>${Object.values(maps).map(m=>`<option value="${m.id}" ${this.collectionMap===m.id?'selected':''}>${m.name}</option>`).join('')}</select></label>${kind!=='monster'?`<label>收藏狀態<select id="collection-ownership" data-collection-filter="ownership"><option value="all" ${this.collectionOwnership==='all'?'selected':''}>全部</option><option value="owned" ${this.collectionOwnership==='owned'?'selected':''}>已持有</option><option value="missing" ${this.collectionOwnership==='missing'?'selected':''}>未取得</option></select></label>`:''}<button type="button" class="btn" data-collection-clear="1">清除篩選</button></div>${this.collectionPagerHtml(page)}<div class="collection">${rows||'<p class="empty-state">沒有符合條件的內容，試著清除篩選或更換關鍵字。</p>'}</div><p class="hint">每頁最多 12 筆。掉率為未套用設定倍率的基礎值；查看圖鑑不會取得道具或改變解鎖進度。</p>`;
  }
  private shopHtml(s:GameState){
    const tabs=`<div class="tabs"><button class="${this.shopTab==='buy'?'on':''}" data-shoptab="buy">購買</button><button class="${this.shopTab==='sell'?'on':''}" data-shoptab="sell">販賣</button><button class="${this.shopTab==='buyback'?'on':''}" data-shoptab="buyback">裝備買回</button></div>`;
    if(this.shopTab==='buyback'){const entries=s.buyback??[];return tabs+`<p class="hint">保留最近 10 件賣出的裝備，依原賣價買回；精煉與鎖定狀態保留。卡片已退回背包，請自行重新插入。</p><div class="list">${entries.map(b=>`<div class="row"><img src="${itemIcon(b.equip.defId)}" alt=""><div class="main"><b>${esc(R.equipLabel(b.equip))}</b><small>精煉 +${b.equip.refine??0} · 卡槽 ${(items[b.equip.defId] as EquipDef).slots} · ${fmt(b.price)} z</small></div><button class="btn primary" data-buyback="${b.equip.id}" ${s.char.zeny>=b.price?'':'disabled'}>買回</button></div>`).join('')||'<p class="empty-state">目前沒有可以買回的裝備。</p>'}</div>`;}
    if(this.shopTab==='buy'){
      return tabs+`<div class="list shop">${(shopStock as Record<string,string[]>)[this.shopKind==='costume'?'tool':this.shopKind].map(id=>{const d=items[id];
        const tip=d.kind==='equip'?this.equipTip(s,id):`<b>${d.name}</b>${d.desc}`;
        return `<div class="row"><img src="${itemIcon(id)}" alt="" data-tip="${esc(tip)}"><div class="main"><b>${d.name}${d.kind==='equip'&&d.slots?` [${d.slots}]`:''}</b><small>${d.kind==='equip'?`${equipSlotNames[d.slot]} · Lv.${d.reqLv}`:d.desc}</small></div><span class="price">${fmt(d.price)} z</span>
          ${d.kind==='equip'?`<button class="btn" data-compare="shop:${id}">比較</button>`:`<input class="qty" type="number" min="1" max="99" value="1" id="qty-${id}" aria-label="數量">`}<button class="btn primary" data-buy="${id}" ${s.char.zeny>=d.price?'':'disabled'}>買</button></div>`;}).join('')}</div>${this.compareId?.startsWith('shop:')?this.compareHtml(s):''}<p class="hint" style="margin:6px 0 0">持有 ${fmt(s.char.zeny)} z</p>`;
    }
    const stacks=Object.entries(s.items).map(([id,n])=>`<div class="row"><img src="${itemIcon(id)}" alt=""><div class="main"><b>${items[id].name} ×${n}</b><small>單價 ${R.sellPrice(id)} z</small></div><button class="btn" data-sell="${id}" data-n="1">賣 1</button><button class="btn" data-sell="${id}" data-n="${n}">全部</button></div>`).join('');
    const worn=new Set(Object.values(s.equipped));
    const gear=s.equipment.filter(e=>!worn.has(e.id)).map(e=>`<div class="row"><img src="${itemIcon(e.defId)}" alt=""><div class="main"><b>${esc(R.equipLabel(e))}${e.locked?' · 已鎖定':''}</b><small>${this.gearSummary(s,e)}</small><small>${R.sellPrice(e.defId)} z · 插卡自動退回背包</small></div><button class="btn" data-equiplock="${e.id}">${e.locked?'解鎖':'鎖定'}</button><button class="btn" data-sellequip="${e.id}" ${e.locked?'disabled':''}>賣</button></div>`).join('');
    const cds=s.cards.filter(c=>c.loc.kind==='bag'&&!c.locked&&c.level===1).map(c=>`<div class="row"><img src="${cardIcon(c.defId)}" alt=""><div class="main"><b>${cards[c.defId].name} Lv.1</b><small>500 z · 賣出後就沒有了</small></div><button class="btn danger" data-sellcard="${c.id}">賣</button></div>`).join('');
    return tabs+`<div class="list">${stacks}${gear}${cds}</div>${stacks||gear||cds?'':'<p class="hint">沒有可以賣的東西。穿著中的裝備、鎖定或升級過的卡片不會出現在這裡。</p>'}`;
  }
  private refineHtml(s:GameState){
    const worn=new Set(Object.values(s.equipped));
    const list=s.equipment.slice().sort((a,b)=>Number(worn.has(b.id))-Number(worn.has(a.id)));
    if(!list.length)return '<p class="hint">沒有可以精煉的裝備。</p>';
    return `<p class="hint" style="margin:0 0 6px">武器每 +1：攻擊 +3（法杖另加魔攻 +3%）。防具每 +1：防禦 +1（飾品不加防禦，只在 +3/+5/+7 強化特性）。最高 +${R.REFINE_MAX}。失敗只扣 Zeny，裝備不會壞。<br><b>精煉特性</b>：到 +3、+5、+7 時會強化該裝備的特色（詠唱、攻速、SP 消耗……），招牌裝備 +7 另有額外加成。飾品也能精煉。</p><div class="list">${list.map(e=>{
      const info=R.refineInfo(e),d=items[e.defId] as EquipDef;
      return `<div class="row"><img src="${itemIcon(e.defId)}" alt=""><div class="main"><b>${esc(R.equipLabel(e))}</b>${worn.has(e.id)?' <span class="hint">穿著中</span>':''}<small>${equipSlotNames[d.slot]}${info?` · 下一級 +${info.next}：成功率 ${Math.round(info.rate*100)}%`:' · 已達最高'}</small><small class="trait">特性：${TRAIT_NAMES[traitOf(d)]}${(e.refine??0)>=3?`　目前 ${bonusText(refineBonus(d,e.refine??0))}`:''}${info&&[3,5,7].includes(info.next)?`　<b>下一級解鎖特性加成！</b>`:''}</small></div>
        ${info?`<span class="price">${fmt(info.cost)} z</span><button class="btn primary" data-refine="${e.id}" ${s.char.zeny>=info.cost?'':'disabled'}>精煉</button>`:''}</div>`;}).join('')}</div><p class="hint" style="margin:6px 0 0">持有 ${fmt(s.char.zeny)} z</p>`;
  }
  private petsHtml(s:GameState){
    const owned=s.pets??[];
    const head=`<p class="hint" style="margin:0 0 8px">向寵物商人咪咪買<b>星光誘捕器</b>，對著魔物使用（滑鼠指著或正在攻擊的目標）。魔物血量越低越容易成功，MVP 無法捕捉。<br>寵物會跟著你冒險，親密度到「親密」（250）後能力加成全開。一起打怪會慢慢增加親密度。</p>`;
    const rows=Object.values(pets).map(p=>{const o=owned.find(x=>x.id===p.id),active=s.activePet===p.id;
      const icon=`<img src="${monsterIcon(p.monster)}" alt="" style="${o?'':'filter:grayscale(1) brightness(1.2);opacity:.6'}">`;
      if(!o)return `<div class="row locked">${icon}<div class="main"><b>${p.name}（${monsters[p.monster].name}）</b><small>${p.label} · 尚未捕捉 · 出沒：${monsterMap(p.monster)}</small></div></div>`;
      const pctI=Math.round(o.intimacy/INTIMACY_MAX*100);
      return `<div class="row">${icon}<div class="main"><b>${p.name}</b> <span class="hint">${monsters[p.monster].name}</span>${active?' <span class="tag-on">出戰中</span>':''}<small>${p.label}（${o.intimacy>=INTIMATE?'全開':'目前一半'}）· ${p.desc}</small>
        <div class="bar exp" style="margin-top:3px" data-tip="${esc(`親密度 ${o.intimacy}/${INTIMACY_MAX}`)}"><i style="width:${pctI}%"></i></div><small>親密度 ${o.intimacy}/${INTIMACY_MAX}・${intimacyLabel(o.intimacy)}</small></div>
        ${active?`<button class="btn" data-petcall="">收回</button>`:`<button class="btn primary" data-petcall="${p.id}">出戰</button>`}</div>`;}).join('');
    return head+`<div class="list">${rows}</div>`;
  }
  /** v4.3: mounts, mercenaries and emotes in one window. */
  private partyHtml(s:GameState){
    const town=this.main.world.inTown,st=s.mounts??{owned:[],active:null},mc=s.mercs??{hired:[],active:null},riding=this.main.world.riding;
    const mountRows=Object.values(mounts).map(d=>{const own=st.owned.includes(d.id),on=st.active===d.id;
      const face=`<span class="pet-face" style="background:radial-gradient(circle at 35% 30%,#fff,${d.body} 55%,${d.accent})">${d.crown?'♛':'●'}</span>`;
      const act=own?(on?`<button class="btn primary" data-ride="1">${riding?'下坐騎':'騎乘'} <kbd>R</kbd></button>`:`<button class="btn" data-mount="${d.id}">選用</button>`)
        :d.unlock?'':`<button class="btn primary" data-mount-buy="${d.id}" ${town&&s.char.zeny>=d.price&&s.char.baseLv>=d.minLv?'':'disabled'}>${fmt(d.price)} z</button>`;
      return `<div class="row ${own?'':'locked'}">${face}<div class="main"><b>${d.name}</b>${on?' <span class="tag-on">使用中</span>':''}<small>移動速度 ×${d.speed} · ${d.desc}${own?'':d.unlock?` · ${d.hint??'擊敗果凍國王取得'}`:` · 需要 Lv.${d.minLv}`}</small></div>${act}</div>`;}).join('');
    const mercRows=(Object.values(companions)).map(d=>{const hired=mc.hired.includes(d.id),on=mc.active===d.id,a=this.main.world.ally;
      const st2=companionStats(d.id,s.char.baseLv);
      const live=on&&a?`<small>HP ${Math.round(a.hp)}/${a.maxHp}${a.dead?' · 倒下中':''}</small>`:'';
      const mode=mc.modes?.[d.id]??DEFAULT_MODE[d.id];
      const modes=hired?`<div class="merc-modes">${(Object.keys(COMPANION_MODES) as CompanionMode[]).map(k=>`<button class="btn ${k===mode?'on':''}" data-merc-mode="${d.id}:${k}" data-tip="${esc(`<b>${COMPANION_MODES[k].icon} ${COMPANION_MODES[k].name}</b>${COMPANION_MODES[k].desc}`)}">${COMPANION_MODES[k].icon} ${COMPANION_MODES[k].name}</button>`).join('')}</div>`:'';
      const act=hired?(on?`<button class="btn" data-merc="">解散</button>`:`<button class="btn primary" data-merc="${d.id}">召喚</button>`)
        :`<button class="btn primary" data-merc-hire="${d.id}" ${town&&s.char.zeny>=d.price&&s.char.baseLv>=d.minLv?'':'disabled'}>雇用 ${fmt(d.price)} z</button>`;
      return `<div class="row ${hired?'':'locked'}"><span class="pet-face" style="background:linear-gradient(135deg,${d.hair},#fff)">${d.weapon==='sword'?'⚔':d.weapon==='staff'?'✚':'➶'}</span><div class="main"><b>${d.title}・${d.name}</b>${on?' <span class="tag-on">同行中</span>':''}<small>${d.desc}<br>${d.skill} · Lv.${s.char.baseLv} 時 HP ${st2.maxHp}／攻擊 ${st2.atk}${hired?'':` · 需要 Lv.${d.minLv}`}</small>${live}</div>${act}</div>${modes}`;}).join('');
    const emoteBtns=emotes.map(e=>`<button class="btn emote" data-emote="${e.id}"><b>${e.icon}</b>${e.name}</button>`).join('');
    return `<h4 style="margin:0 0 4px">坐騎</h4><p class="hint" style="margin:0 0 6px">按 <kbd>R</kbd> 騎上／跳下。騎乘時移動更快，攻擊或施法會自動下坐騎。${town?'':'坐騎與傭兵要在城鎮購買、雇用。'}</p><div class="list">${mountRows}</div>
      <h4 style="margin:10px 0 4px">傭兵</h4><p class="hint" style="margin:0 0 6px">雇用一次就能隨時召喚，同時只會有一位同行。傭兵會隨你的 Base 等級成長，倒下 20 秒後自動歸隊。可以下指令：🛡 守護（擋怪）、⚔ 協助（打你的目標）、✚ 支援（躲後面補血、不拉仇恨）。血量低於 35% 會自動撤退。</p><div class="list">${mercRows}</div>
      <h4 style="margin:10px 0 4px">表情動作</h4><div class="emote-grid">${emoteBtns}</div>`;
  }
  private wardrobeHtml(s:GameState){
    const w=s.costumes??{owned:[],head:null,back:null};
    const section=(slot:'head'|'back',title:string)=>`<h4 style="margin:8px 0 4px">${title}</h4><div class="list">${Object.values(costumes).filter(c=>c.slot===slot).map(c=>{
      const own=w.owned.includes(c.id),on=w[slot]===c.id;
      return `<div class="row ${own?'':'locked'}"><span class="pet-face" style="background:linear-gradient(135deg,${c.color},${c.accent??c.color})">${slot==='head'?'✦':'❖'}</span><div class="main"><b>${c.name}</b>${on?' <span class="tag-on">穿戴中</span>':''}<small>${c.desc}${own?'':c.unlock?' · 挑戰取得':` · 造型師 ${fmt(c.price)} z`}</small></div>
        ${own?(on?`<button class="btn" data-costume-off="${slot}">脫下</button>`:`<button class="btn primary" data-costume-wear="${c.id}">穿上</button>`):''}</div>`;}).join('')}</div>`;
    return `<p class="hint" style="margin:0 0 4px"><a href="characters.html" target="_blank" rel="noopener">查看新人物素材展間 ↗</a><br>外觀只改變樣子，不影響能力。到晨光鎮西邊找<b>造型師 露娜</b>購買。</p>${section('head','頭飾')}${section('back','背飾')}`;
  }
  private costumeShopHtml(s:GameState){
    const w=s.costumes??{owned:[],head:null,back:null};
    return `<div class="list shop">${costumeShop.map(id=>{const c=costumes[id],own=w.owned.includes(id);
      return `<div class="row"><span class="pet-face" style="background:linear-gradient(135deg,${c.color},${c.accent??c.color})">${c.slot==='head'?'✦':'❖'}</span><div class="main"><b>${c.name}</b><small>${c.slot==='head'?'頭飾':'背飾'} · ${c.desc}</small></div><span class="price">${fmt(c.price)} z</span>
        <button class="btn primary" data-costume-buy="${id}" ${own||s.char.zeny<c.price?'disabled':''}>${own?'已擁有':'購買'}</button></div>`;}).join('')}</div><p class="hint" style="margin:6px 0 0">持有 ${fmt(s.char.zeny)} z。購買後會自動穿上，可在外觀衣櫥（V）更換。</p>`;
  }
  private settingsHtml(){
    const st=this.main.settings;
    return `<div class="setting"><span>自動撿取掉落物</span><input type="checkbox" data-set="autoLoot" ${st.autoLoot?'checked':''} aria-label="自動撿取"></div>
      <div class="setting"><span>自動喝藥<br><small class="hint">HP 低於設定值時自動使用回復道具</small></span><select data-set="autoPotion" aria-label="自動喝藥">${[0,30,50,70].map(n=>`<option value="${n}" ${st.autoPotion===n?'selected':''}>${n?`HP < ${n}%`:'關閉'}</option>`).join('')}</select></div>
      <div class="setting"><span>背景音樂</span><input type="checkbox" data-set="music" ${st.music?'checked':''} aria-label="背景音樂"></div>
      <div class="setting"><span>音量</span><input type="range" min="0" max="1" step=".05" value="${st.volume}" data-set="volume" aria-label="音量"></div>
      <div class="setting"><span>靜音</span><input type="checkbox" data-set="muted" ${st.muted?'checked':''} aria-label="靜音"></div>
      <div class="setting"><span>自動戰鬥策略</span><select data-set="autoStrategy" aria-label="自動戰鬥策略">${[['balanced','均衡'],['aoe','群怪優先'],['conserve','節省魔力']].map(([id,n])=>`<option value="${id}" ${st.autoStrategy===id?'selected':''}>${n}</option>`).join('')}</select></div>
      <div class="setting"><span>HP 回復道具用完時停止自動戰鬥</span><input type="checkbox" data-set="stopOnNoPotions" ${st.stopOnNoPotions?'checked':''} aria-label="補給耗盡時停止"></div>
      <div class="setting"><span>委託目標完成時停止自動戰鬥</span><input type="checkbox" data-set="stopOnQuestDone" ${st.stopOnQuestDone?'checked':''} aria-label="委託完成時停止"></div>
      <div class="setting"><span>介面大小</span><select data-set="uiScale" aria-label="介面大小">${[90,100,115].map(n=>`<option value="${n}" ${(st.uiScale??100)===n?'selected':''}>${n}%${n===100?'（標準）':''}</option>`).join('')}</select></div>
      <div class="setting"><span>畫質<br><small class="hint">卡的話選「低」最順；自動會依電腦速度調整</small></span><select data-set="graphics" aria-label="畫質">${(['auto','high','mid','low'] as const).map(v=>`<option value="${v}" ${(st.graphics??'auto')===v?'selected':''}>${{auto:'自動（建議）',high:'高（陰影環境光）',mid:'中',low:'低（最順）'}[v]}</option>`).join('')}</select></div>
      <div class="setting"><span>畫面模式<br><small class="hint">3D 需要較好的顯示卡；變更後重新整理生效</small></span><select data-set="renderer" aria-label="畫面模式"><option value="3d" ${(st.renderer??'3d')==='3d'?'selected':''}>3D 新世代</option><option value="2d" ${st.renderer==='2d'?'selected':''}>2D 經典</option></select></div>
      <div class="setting"><span>視窗排版</span><button class="btn" data-act="resetLayout">重設視窗位置</button></div>
      <h4 style="margin:10px 0 4px">操作說明</h4>
      <div class="help">左鍵點地：走路（按住可持續移動）　左鍵點怪：自動連續攻擊<br>左鍵點 NPC：對話　左鍵點地上物品：撿取<br>
        <kbd>1</kbd>～<kbd>9</kbd> 快捷欄（技能／藥水）　右鍵：取消技能選擇<br>
        <kbd>A</kbd> 狀態　<kbd>E</kbd> 道具　<kbd>Q</kbd> 裝備　<kbd>S</kbd> 技能　<kbd>C</kbd> 圖鑑　<kbd>P</kbd> 寵物　<kbd>V</kbd> 外觀　<kbd>B</kbd> 夥伴　<kbd>R</kbd> 騎乘<br><kbd>Z</kbd> 自動戰鬥　<kbd>X</kbd> 坐下　滾輪：縮放畫面　右鍵拖曳：旋轉視角（3D）</div>
      <h4 style="margin:10px 0 4px">存檔</h4>
      <p class="hint" style="margin:0 0 4px">存檔放在這個瀏覽器裡。清除網站資料會刪除存檔，建議定期匯出備份。</p>
      <p style="display:flex;gap:6px;margin:0 0 6px"><button class="btn" data-act="export">匯出存檔</button><button class="btn" data-act="import">匯入存檔</button><button class="btn danger" data-act="reset">刪除這個角色重新開始</button><button class="btn primary" data-act="switchChar">切換角色</button></p>
      <textarea class="json" id="save-json" placeholder="匯出的存檔會出現在這裡；要匯入時把存檔文字貼上，再按「匯入存檔」。" aria-label="存檔文字">${esc(this.saveDraft)}</textarea>`;
  }

  private onWinClick(id:WinId,e:MouseEvent){
    const t=(e.target as HTMLElement).closest<HTMLElement>('button');if(!t)return;
    const m=this.main,ds=t.dataset;
    if(ds.forgeTab){this.forgeTab=ds.forgeTab as typeof this.forgeTab;this.renderWin('forge');return;}
    if(ds.forgePick){this.forgePick=ds.forgePick;this.renderWin('forge');return;}
    if(ds.salvage){let learned:AspectFx|null=null;if(m.run(st=>{const r=SF.salvage(st,ds.salvage!);learned=r.learned;return r.state;},'分解完成，得到星塵。','click')&&learned){this.banner(`📖 威能圖鑑：學會「${ASPECT_NAMES[learned]}」！`,'gold');this.log(`📖 學會傳說威能「${ASPECT_NAMES[learned]}」：${GEAR_FX[learned]}`,'card');}return;}
    if(ds.salvageAll){let out:ReturnType<typeof SF.salvageAll>|null=null;m.run(st=>{out=SF.salvageAll(st,Number(ds.salvageAll) as 0|1|2);return out.state;});
      const o=out as ReturnType<typeof SF.salvageAll>|null;if(o){this.log(`分解了 ${o.count} 件裝備，得到 ${o.dust} 星塵${o.learned.length?`，學會威能：${o.learned.map(f=>ASPECT_NAMES[f]).join('、')}`:''}。`,'card');}return;}
    if(ds.upgrade&&this.forgePick){const id=this.forgePick;m.run(st=>SF.upgrade(st,id,Math.random),'升階完成！','levelup');return;}
    if(ds.imprint&&this.forgePick){const f=ds.imprint as AspectFx,id=this.forgePick;m.run(st=>SF.imprint(st,id,f,Math.random),`烙印完成：「${ASPECT_NAMES[f]}」！`,'levelup');return;}
    if(ds.enchant&&this.forgePick){const id=this.forgePick;let got='';m.run(st=>{const r=SF.enchant(st,id,Number(ds.enchant),Math.random);got=affixText(r.affix);return r.state;});if(got)this.log(`淬鍊結果：${got}`,'card');return;}
    if(ds.hunt){this.main.setHunt(this.main.hunt()===ds.hunt?null:ds.hunt);this.questKey='';this.renderWin(id);return;}
    if(ds.craftTab){this.craftTab=ds.craftTab as 'gear'|'food';this.renderWin('craft');return;}
    if(ds.craft){const r=recipes.find(x=>x.id===ds.craft);if(r&&m.run(st=>C.craft(st,r.id,Math.random),`${r.kind==='gear'?'打造':'烹煮'}完成：${items[r.out].name}${r.count>1?` ×${r.count}`:''}！`,'levelup'))this.renderWin('craft');return;}
    if(ds.collectionEquip){this.invTab='equip';this.show('inventory');return;}
    if(ds.collectionTab){this.collectionTab=ds.collectionTab as typeof this.collectionTab;this.collectionPage=0;this.renderWin('cards');return;}
    if(ds.collectionPage!==undefined){this.collectionPage=Number(ds.collectionPage);this.renderWin('cards');this.wins.get('cards')?.querySelector('.body')?.scrollTo(0,0);return;}
    if(ds.collectionClear){this.collectionText='';this.collectionJob='';this.collectionMap='';this.collectionOwnership='all';this.collectionPage=0;this.wins.get('cards')?.querySelector<HTMLInputElement>('#collection-search')?.blur();this.renderWin('cards');return;}
    if(ds.petcall!==undefined){const pid=ds.petcall||null;if(m.run(s=>R.setActivePet(s,pid),pid?`${pets[pid].name} 出戰！`:'寵物回去休息了。'))m.celebrate?.('#ff9ec4');return;}
    if(ds.mountBuy){const d=mounts[ds.mountBuy];if(m.run(st=>R.buyMount(st,d.id),`得到了 ${d.name}！按 R 騎上去。`,'buy'))m.celebrate?.(d.body);return;}
    if(ds.mount){const d=mounts[ds.mount];m.run(st=>R.setMount(st,d.id),`改騎 ${d.name}。`);m.setRiding?.(m.world.riding);this.renderWin('party');return;}
    if(ds.ride){m.toggleRide?.();this.renderWin('party');return;}
    if(ds.mercHire){const d=companions[ds.mercHire as CompanionRole];if(m.run(st=>R.hireCompanion(st,d.id),`${d.title}・${d.name} 加入了隊伍！`,'buy'))m.celebrate?.(d.hair);return;}
    if(ds.mercMode){const [role,mode]=ds.mercMode.split(':') as [CompanionRole,CompanionMode];if(m.run(st=>R.setCompanionMode(st,role,mode),`${companions[role].name}：改為「${COMPANION_MODES[mode].name}」模式。`))this.renderWin(id);return;}
    if(ds.merc!==undefined){const id=(ds.merc||null) as CompanionRole|null;m.run(st=>R.setCompanion(st,id),id?`${companions[id].name} 跟上來了！`:'傭兵先回營地休息了。');return;}
    if(ds.emote){m.emote?.(ds.emote);return;}
    if(ds.costumeBuy){const c=costumes[ds.costumeBuy];if(m.run(s=>R.buyCostume(s,ds.costumeBuy!),`購買了 ${c.name}！`,'buy'))m.celebrate?.(c.color);return;}
    if(ds.costumeWear){const c=costumes[ds.costumeWear];if(m.run(s=>R.wearCostume(s,c.slot,c.id),`穿上了 ${c.name}。`))m.celebrate?.(c.color);return;}
    if(ds.costumeOff){m.run(s=>R.wearCostume(s,ds.costumeOff as 'head'|'back',null),'脫下了外觀。');return;}
    if(ds.open)this.show(ds.open as WinId);
    else if(ds.navigate)m.navigateQuest?.(ds.navigate);
    else if(ds.claimchallenge)m.completeChallenge?.(ds.claimchallenge);
    else if(ds.equip){this.compareId=ds.equip;const host=this.wins.get(id)?.querySelector('.compare-host');if(host)host.innerHTML=this.compareHtml(m.state());}
    else if(ds.compare){this.compareId=ds.compare;this.renderWin(id);}
    else if(ds.act==='closeCompare'){this.compareId=null;this.renderWin(id);}
    else if(ds.wear)m.run((s,ctx)=>R.equip(s,ds.wear!,ctx),'已穿上裝備。');
    else if(ds.equiplock)m.run(s=>R.toggleEquipLock(s,ds.equiplock!));
    else if(ds.buyback)m.run(s=>R.buybackEquip(s,ds.buyback!),'已買回裝備。','buy');
    else if(ds.act==='resetLayout')this.resetLayout();
    else if(ds.stat)m.run(s=>R.allocateStat(s,ds.stat as Stat));
    else if(ds.act==='resetStats')m.run((s,ctx)=>R.resetStats(s,ctx),'素質已重置，點數全部退回。');
    else if(ds.invtab){this.invTab=ds.invtab as typeof this.invTab;this.renderWin(id);}
    else if(ds.opencards){this.collectionTab='owned';this.collectionPage=0;this.show('cards');}
    else if(ds.unequip)m.run((s,ctx)=>R.unequip(s,ds.unequip as EquipSlot,ctx));
    else if(ds.pick){this.equipPick={equipId:ds.pick};this.renderWin(id);}
    else if(ds.act==='cancelPick'){this.equipPick=null;this.renderWin(id);}
    else if(ds.insert){const eq=this.equipPick!.equipId,st0=m.state(),c=st0.cards.find(x=>x.id===ds.insert),from=c?.loc.kind==='equip'?st0.equipment.find(e=>e.id===(c.loc as {equipId:string}).equipId):null;
      const msg=from?`已把${cards[c!.defId].name}從「${R.equipLabel(from)}」移到「${R.equipLabel(st0.equipment.find(e=>e.id===eq)!)}」。`:'卡片已插入。';
      if(m.run((s,ctx)=>R.insertCard(s,ds.insert!,eq,ctx),msg))this.equipPick=null;this.renderWin(id);}
    else if(ds.removecard)m.run((s,ctx)=>R.removeCard(s,ds.removecard!,ctx),'卡片已免費拔出，回到背包。');
    else if(ds.learn){if(m.run(s=>R.learnSkill(s,ds.learn!)))m.audio.play('levelup');}
    else if(ds.up){this.upgradeAsk=ds.up;this.renderWin(id);}
    else if(ds.act==='cancelUp'){this.upgradeAsk=null;this.renderWin(id);}
    else if(ds.talent){if(m.run(st=>R.learnTalent(st,ds.talent as TalentKey)))m.audio.play('levelup');}
    else if(ds.act==='resetTalents')m.run((s,ctx)=>R.resetTalents(s,ctx),'星點已全部退回。');
    else if(ds.soul)m.run((st,ctx)=>R.setSoul(st,ds.soul as SoulId,ctx),`切換為${SOULS[ds.soul as SoulId].name}。`,'levelup');
    else if(ds.act==='resetSkills2')m.run((s,ctx)=>R.resetSkills2(s,ctx),'二轉技能點已全部退回，可以重新分配。');
    else if(ds.upgradeOk){const mats=(ds.mats??'').split(',').filter(Boolean);if(m.run((s,ctx)=>R.upgradeCard(s,ds.upgradeOk!,mats,ctx),'卡片升級成功！','levelup'))this.upgradeAsk=null;this.renderWin(id);}
    else if(ds.lock)m.run(s=>R.toggleCardLock(s,ds.lock!));
    else if(ds.refine){m.refine(ds.refine);}
    else if(ds.shoptab){this.shopTab=ds.shoptab as 'buy'|'sell'|'buyback';this.renderWin(id);}
    else if(ds.buy){const q=document.querySelector<HTMLInputElement>(`#qty-${ds.buy}`);const n=Math.max(1,Math.min(99,Math.floor(Number(q?.value??1))||1));m.run(s=>R.buy(s,ds.buy!,n),`購買了 ${items[ds.buy].name} ×${n}。`,'buy');}
    else if(ds.sell)m.run(s=>R.sellItem(s,ds.sell!,Number(ds.n)),'賣出了。','buy');
    else if(ds.sellequip)m.run(s=>R.sellEquip(s,ds.sellequip!),'賣出了裝備。','buy');
    else if(ds.sellcard)m.run(s=>R.sellCard(s,ds.sellcard!),'賣出了卡片。','buy');
    else if(ds.act==='export'){const ta=document.querySelector<HTMLTextAreaElement>('#save-json');if(ta){ta.value=m.exportSave();this.saveDraft=ta.value;ta.select();navigator.clipboard?.writeText(ta.value).then(()=>this.log('存檔已複製到剪貼簿。'),()=>this.log('已顯示存檔文字，請手動複製。'));}}
    else if(ds.act==='import'){const ta=document.querySelector<HTMLTextAreaElement>('#save-json');if(ta?.value.trim())void m.importSave(ta.value.trim());}
    else if(ds.act==='switchChar')void m.switchCharacter?.();
    else if(ds.act==='reset'){if(t.dataset.confirm){void m.resetGame();}else{t.dataset.confirm='1';t.textContent='再按一次確認刪除';}}
  }
  private onWinChange(_id:WinId,e:Event){
    const t=e.target as HTMLInputElement|HTMLSelectElement;
    if(t.dataset.collectionFilter){
      const field=t.dataset.collectionFilter;if(field==='job')this.collectionJob=t.value;else if(field==='map')this.collectionMap=t.value;else if(field==='ownership')this.collectionOwnership=t.value as typeof this.collectionOwnership;
      this.collectionPage=0;this.renderWin('cards');return;
    }
    if(t.dataset.guide){this.guideId=t.value;this.renderWin(_id);return;}
    if(t.dataset.mod){const skill=t.dataset.mod,slot=Number(t.dataset.slot),v=t.value||null;this.main.run((s,ctx)=>R.configureModule(s,skill,slot,v,ctx));}
    if(t.dataset.set){const st=this.main.settings,k=t.dataset.set as keyof Settings;
      if(k==='autoLoot'||k==='muted'||k==='music'||k==='stopOnNoPotions'||k==='stopOnQuestDone')(st[k] as boolean)=(t as HTMLInputElement).checked;else if(k==='autoStrategy')st.autoStrategy=t.value as Settings['autoStrategy'];else if(k==='graphics'){st.graphics=t.value as Settings['graphics'];this.log(`畫質已設為「${{auto:'自動',high:'高',mid:'中',low:'低'}[t.value as 'auto']}」。`,'sys');}else if(k==='renderer'){st.renderer=t.value as '3d'|'2d';this.log('畫面模式已變更，重新整理頁面後生效。','sys');}else (st[k] as number)=Number(t.value);
      this.main.applySettings();if(k==='uiScale'){this.applyScale();for(const el of this.wins.values())this.clampWin(el);}}
  }
  private onWinDbl(_id:WinId,e:MouseEvent){
    const t=(e.target as HTMLElement).closest<HTMLElement>('button');if(!t)return;
    if(t.dataset.use){const i=this.main.state().hotbar.findIndex(h=>h?.type==='item'&&h.id===t.dataset.use);
      if(i>=0)this.main.useHotkey(i);else{this.useItemDirect(t.dataset.use);} }
    if(t.dataset.equip){const s=this.main.state(),id=t.dataset.equip,worn=Object.entries(s.equipped).find(([,v])=>v===id);
      if(worn)this.main.run((st,ctx)=>R.unequip(st,worn[0] as EquipSlot,ctx));else this.main.run((st,ctx)=>R.equip(st,id,ctx),`裝備了 ${items[s.equipment.find(x=>x.id===id)!.defId].name}。`);}
  }
  useItemDirect:(id:string)=>void=()=>{};

  // ———————————————————————— NPC dialog ————————————————————————
  showDialog(npcId:string){
    const s=this.main.state(),map=this.main.world.map,npc=map.def.npcs.find(n=>n.id===npcId);if(!npc)return;
    let text='',opts:[string,()=>void][]=[];
    const close=()=>this.closeDialog();
    switch(npc.kind){
      case 'guide':{
        if(map.def.id==='frontier'&&!this.ascSkip&&this.ascensionDialog(npc.name,npcId))return;
        this.ascSkip=false;
        const st=R.questStatus(s);
        const tutorial=()=>this.showTutorial(npc.name);
        if(st?.done){this.renderDialog(npc.name,`「${st.def.title}」完成了！做得好！<br>獎勵：${this.rewardText(st.def)}`,[['領取獎勵',()=>{
            const r=this.main.completeQuest();if(!r)return;const next=R.questStatus(this.main.state());
            this.renderDialog(npc.name,next?`下一個委託：<b>${next.def.title}</b><br>${next.def.text}`:'你已經完成了所有委託，謝謝你守護晨光鎮！',[['好的',close],['冒險教學',tutorial]]);}],['等一下再領',close]]);return;}
        if(st){this.renderDialog(npc.name,`目前的委託：<b>${st.def.title}</b>（${st.progress}）<br>${st.def.text}<br><span class="hint">獎勵：${this.rewardText(st.def)}</span>`,[['好的，我去完成',close],['冒險教學',tutorial]]);return;}
        this.renderDialog(npc.name,'你已經完成所有委託了，真厲害！',[['冒險教學',tutorial],['結束對話',close]]);return;}
      case 'bounty':{
        const b=X.bountyState(s),a=b.active;
        if(a&&a.progress>=a.count){this.renderDialog(npc.name,`幹得好！「${monsters[a.monster].name} ×${a.count}」的懸賞完成了。<br>獎勵：${this.bountyReward(a)}`,[['領取賞金',()=>{if(this.main.completeBounty())this.showDialog(npcId);}],['等一下',close]]);return;}
        if(a){this.renderDialog(npc.name,`目前的懸賞：<b>${monsters[a.monster].name}</b>（${X.bountyWhere(a.monster)}）${a.progress}/${a.count}<br><span class="hint">獎勵：${this.bountyReward(a)}</span>`,[['繼續狩獵',close],['放棄這個懸賞',()=>{this.main.run(st=>X.abandonBounty(st),'已放棄懸賞，可以重新選擇。');this.showDialog(npcId);}]]);return;}
        if(!s.bounty)this.main.run(st=>({...st,bounty:X.bountyState(st)}));
        const offers=X.bountyState(this.main.state()).offers;
        this.renderDialog(npc.name,`懸賞板上貼著新的委託。一次只能接一張，完成後我會換上新的。<br><span class="hint">已完成 ${s.explore?.bounties??0} 次懸賞。</span>`,
          [...offers.map((o,i)=>[`${monsters[o.monster].name} ×${o.count}（${X.bountyWhere(o.monster)}）— ${fmt(o.zeny)} z`,()=>{if(this.main.run(st=>X.acceptBounty(st,i),`接下懸賞：${monsters[o.monster].name} ×${o.count}。`)){this.main.setHunt(o.monster);close();}}] as [string,()=>void]),['再看看',close]]);return;}
      case 'craft':
        text='我是工匠蘇菲！把試煉徽記和魔物素材交給我，就能打造會改變打法的<b>招牌裝備</b>：更快的詠唱、更省的魔力、更強的追加傷害……<br>也可以用素材做料理，比買的便宜多了。';
        opts=[['打造與料理',()=>{this.show('craft');close();}],['⚒️ 星淵工坊（分解・烙印威能・淬鍊）',()=>{this.show('forge');close();}],['精煉的新玩法？',()=>this.renderDialog(npc.name,'現在每件裝備都有自己的<b>精煉特性</b>：精煉到 +3、+5、+7 時，會強化它原本的特色。<br>例如時之沙漏會更縮短詠唱，+7 還會解鎖「時之迴響」。飾品現在也能精煉了！',[['知道了',close]])],['離開',close]];break;
      case 'refine':{
        this.renderDialog(npc.name,'想讓裝備更強嗎？武器每精煉 +1 攻擊 +3，防具每 +1 防禦 +1。<br>+4 以前一定成功；失敗只會損失 Zeny，<b>裝備不會壞掉</b>。',[['精煉裝備',()=>{close();this.show('refine');}],['離開',close]]);return;}
      case 'job':{
        const why=R.jobChangeReady(s);
        if(s.char.job!=='novice'){text=`你已經是一位${jobs[s.char.job].name}了。繼續努力，未來或許還有更進一步的道路。`;opts=[['結束對話',close]];}
        else if(why){text=`想轉職嗎？你還需要：<br>· 職業等級 10（目前 ${s.char.jobLv}）<br>· 基本技能 Lv.9（目前 ${s.char.skills.basic??0}）<br>技能點在 <b>S</b> 技能視窗分配。`;opts=[['結束對話',close]];}
        else{text='很好，你已經有足夠的實力了。選擇你要走的道路吧！轉職後職業等級會從 1 開始。';
          opts=firstJobs.map(j=>[`成為${jobs[j].name} — ${jobs[j].desc}`,()=>{if(this.main.run((st,ctx)=>R.changeJob(st,j,ctx),`恭喜！你成為了${jobs[j].name}！`,'levelup')){this.banner(`${s.char.name} 轉職為 ${jobs[j].name}！`,'gold');close();this.show('skills');}}] as [string,()=>void]);
          opts.push(['再想想',close]);}
        break;}
      case 'tool':case 'gear':
        text=map.def.id==='harbor'?(npc.kind==='tool'?'港口的補給都在這，貝露灣的潮音玻璃也可以賣給我！':(this.main.state().flags?.lighthouse?'燈塔亮了，船都回來了！我的船塢又忙起來啦。要看看遠征裝備嗎？':'燈塔熄了以後，出海的船一艘都沒回來……要裝備的話，這裡有遠征隊的貨。'))
          :map.def.id==='frontier'?(npc.kind==='tool'?'前線補給都在這裡，素材也能賣給我。':'這裡是遠征隊的軍械庫，Lv.50 以上的新一階裝備都在這。'):npc.kind==='tool'?'歡迎光臨！藥水、回城羽毛都在這裡。打怪撿到的素材也可以賣給我。':'需要好用的武器和防具嗎？轉職後記得來看看適合你的裝備。';
        opts=[['買東西',()=>{this.shopKind=(map.def.id==='frontier'||map.def.id==='harbor')&&npc.kind==='gear'?'frontier':npc.kind as 'tool'|'gear';this.shopTab='buy';this.show('shop');close();}],['賣東西',()=>{this.shopKind=npc.kind as 'tool'|'gear';this.shopTab='sell';this.show('shop');close();}],['離開',close]];break;
      case 'pet':
        text='喵～想要可愛的夥伴嗎？用<b>星光誘捕器</b>對著血量變少的魔物使用，就有機會讓牠成為你的寵物！<br>寵物會一直跟著你，越親密能力加成越強。';
        opts=[['買誘捕器（道具商店）',()=>{this.shopKind='tool';this.shopTab='buy';this.show('shop');close();}],['查看我的寵物',()=>{this.show('pets');close();}],['離開',close]];break;
      case 'stylist':
        text='歡迎來到露娜的造型屋！貓耳、天使光環、翅膀……讓你在冒險時也閃閃發亮。<br><span class="hint">外觀只改變樣子，不影響能力。</span>';
        opts=[['看看外觀',()=>{this.shopKind='costume';this.shopTab='buy';this.show('shop');close();}],['打開我的衣櫥',()=>{this.show('wardrobe');close();}],['離開',close]];break;
      case 'card':
        text='我在研究魔物卡片。卡片要插在<b>穿著中</b>的裝備裡才會生效，然後在技能視窗把模組裝到技能上。<br>重複的卡片能升級<b>其中一張</b>，升級一定成功。';
        opts=[['我的流派該找哪些卡？',()=>this.renderDialog(npc.name,this.buildCardAdvice(s),[['打開卡片冊',()=>{this.show('cards');close();}],['離開',close]])],
          ['打開卡片冊',()=>{this.show('cards');close();}],['打開裝備視窗',()=>{this.show('equip');close();}],['離開',close]];break;
      case 'service':{
        // v5.0: each hub teleports within its own region, plus a link to the other hub.
        const harborOk=!!this.main.state().char.job2;
        const tele:[string,string,number,number,number][]=map.def.id==='harbor'?[['bellBay','貝露灣',0,4,36],['frontier','曙光前哨',5000,6,24],['town','晨光鎮',8000,24,30]]
          :map.def.id==='frontier'?[['mistMarsh','霧語沼澤',0,4,36],['emberRift','熔岩裂谷',1500,4,32],['skyGarden','天空花園',2500,4,36],['starCitadel','星界城塞',4000,4,36],['town','晨光鎮',2000,24,30],...(harborOk?[['harbor','夜航港',6000,6,24] as [string,string,number,number,number]]:[])]
          :[['meadow','晨光草原',0,4,36],['forest','翠影森林',600,4,36],['cave','寒晶洞窟',1200,4,32],...(this.main.state().char.baseLv>=46?[['frontier','曙光前哨',5000,6,24] as [string,string,number,number,number]]:[])];
        text='星語服務為您效勞。要在這裡記錄存檔點，或使用傳送服務嗎？';
        // v6.3 星光深淵 entrance (曙光前哨／夜航港).
        const abyss:[string,()=>void][]=map.def.id==='frontier'||map.def.id==='harbor'?[['✦ 星淵紀元（難度・深坑・圍城・印記地城）',()=>this.starfallMenu(npc.name)],[`🌌 星光深淵（最高第 ${this.main.abyssBest?.()??0} 層）`,()=>this.abyssMenu(npc.name)]]:[];
        opts=[['在這裡記錄存檔點',()=>{if(this.main.run(st=>R.setSavePoint(st,{map:map.def.id,x:npc.x+.5,y:npc.y+2}),`存檔點已記錄在${map.def.name}。`))close();}],
          ...tele.map(([id,name,cost,x,y])=>[`傳送到${name}（${cost?`${fmt(cost)} z`:'免費'}）`,()=>{
            if(cost&&this.main.state().char.zeny<cost){this.log(`Zeny 不足，需要 ${fmt(cost)} z。`,'warn');this.main.audio.play('error');return;}
            if(cost&&!this.main.run(st=>R.addZeny(st,-cost)))return;close();this.main.warp(id,x,y);}] as [string,()=>void]),...abyss,['離開',close]];
        break;}
    }
    this.renderDialog(npc.name,text,opts);
  }
  /** v6.3 星光天賦: three constellations; capstones unlock after 15 points in that constellation. */
  private talentsHtml(s:GameState){
    const pts=R.talentPoints(s),spent=R.talentSpent(s),left=pts-spent;
    const cols=(Object.keys(TALENT_TREES) as TalentTree[]).map(tree=>{const T=TALENT_TREES[tree],inTree=R.treeSpent(s,tree);
      const nodes=Object.values(talents).filter(t=>t.tree===tree).map(t=>{const r=s.talents?.[t.id]??0,why=R.talentBlock(s,t.id);
        return `<div class="tnode ${t.capstone?'cap':''} ${r?'on':''}"><div><b>${t.capstone?'★ ':''}${t.name}</b> <span class="lv">${r}/${t.max}</span><small>${t.desc(Math.max(1,r))}</small>${t.capstone&&inTree<CAPSTONE_COST?`<small class="need">需要本星座 ${CAPSTONE_COST} 點（目前 ${inTree}）</small>`:''}</div>
          <button class="btn ${why?'':'primary'}" data-talent="${t.id}" ${why?'disabled':''} data-tip="${esc(why??'投入 1 星點')}">＋</button></div>`;}).join('');
      return `<section class="tcol" style="--tc:${T.color}"><h4>${T.icon} ${T.name}<span>${inTree} 點</span></h4>${nodes}</section>`;}).join('');
    return `<p style="margin:0 0 8px;display:flex;justify-content:space-between;align-items:center"><span>星點 <b class="sp-left">${left}</b> / ${pts}　<small class="hint">Base Lv.40 起每級 1 點，星光深淵每 5 層 1 點</small></span>${this.main.world.inTown?'<button class="btn" data-act="resetTalents">重新分配</button>':''}</p><div class="tgrid">${cols}</div>`;
  }
  // ———————————————————————— v7.0 星淵紀元 ————————————————————————
  private starfallMenu(name:string){
    const s=this.main.state(),sf=SF.starfallOf(s),t=SF.tierOf(s),close=()=>this.closeDialog(),sig=s.items.starSigil??0;
    const text=`目前難度：<b style="color:${t.color}">【${t.name}】</b>　威能圖鑑 ${sf.codex.length}/${ASPECT_IDS.length}　星塵 ${s.items.starDust??0}<br>
      星淵深坑最高 <b>${sf.pitBest}</b> 階・星潮圍城最佳 <b>${sf.hordeBest}</b> 波・印記地城等級 <b>${sf.sigilLv}</b>（持有印記 ${sig}）<br>
      <span class="hint">難度越高，魔物越強、經驗越多，裝備品質越好；煉獄以上會掉<b style="color:#e0b25a">唯一裝備</b>，噩夢以上會掉星淵印記並出現星蝕潮汐。</span>`;
    this.renderDialog(name,text,[
      [`⚔ 星光難度：${t.name}（切換）`,()=>this.difficultyMenu(name)],
      [`⏳ 星淵深坑（最高 ${sf.pitBest} 階）`,()=>this.pitMenu(name)],
      [`🌊 星潮圍城（最佳 ${sf.hordeBest} 波）`,()=>{close();this.main.hordeEnter?.();}],
      [`🜂 印記地城 Lv.${sf.sigilLv}（消耗 1 星淵印記，持有 ${sig}）`,()=>{if(!sig){this.log('沒有星淵印記：噩夢以上難度的菁英與首領會掉，深坑與圍城的獎勵也有機會給。','warn');return;}close();this.main.sigilEnter?.();}],
      ['⚒️ 星淵工坊',()=>{close();this.show('forge');}],['離開',close]]);
  }
  private difficultyMenu(name:string){
    const s=this.main.state(),cur=SF.tierOf(s),close=()=>this.closeDialog();
    const rows=DIFFICULTY.map(d=>{const why=SF.difficultyBlock(s,d);
      return [`${d.id===cur.id?'▶ ':''}【${d.name}】魔物 HP ×${d.hp}、攻擊 ×${d.atk}、經驗 ×${d.exp}${d.unique?'・唯一裝備':''}${why?`（🔒 ${d.need}）`:''}`,()=>{if(why){this.log(why,'warn');return;}
        if(this.main.run((st,ctx)=>SF.setDifficulty(st,d.id,ctx),`星光難度切換為【${d.name}】。`,'levelup')){close();}}] as [string,()=>void];});
    this.renderDialog(name,'選擇星光難度。只能在城鎮或前哨切換；新出現的魔物會照新的難度變強。',[...rows,['返回',()=>this.starfallMenu(name)]]);
  }
  private pitMenu(name:string){
    const best=SF.starfallOf(this.main.state()).pitBest,close=()=>this.closeDialog();
    // 5 階一個區間：通過第 1 階開第 5 階，通過第 5 階開第 10 階……（也可以接著挑戰下一階）。
    const open=best<1?1:Math.floor(best/5)*5+5,steps=[1];for(let t=5;t<=open;t+=5)steps.push(t);
    const tiers=[...new Set([...steps.slice(-6),best+1])].filter(t=>t>=1&&t<=Math.max(open,best+1)).sort((a,b)=>b-a);
    this.renderDialog(name,`星淵深坑：${PIT.time/60} 分鐘內打倒魔物填滿進度條，深坑守衛出現後打倒牠就通過。<br>每一階魔物 +2 級（第 1 階約 Lv.32）。每 5 階一個區間：通過第 1 階開放第 5 階，通過第 5 階開放第 10 階，依此類推（也可以一階一階往上）。最高紀錄會解鎖更高的星光難度。`,
      [...tiers.map(t=>[`第 ${t} 階（魔物約 Lv.${PIT.level(t)}）${t>best?' ← 新挑戰':t<=best?' ✓':''}`,()=>{close();this.main.pitEnter?.(t);}] as [string,()=>void]),['返回',()=>this.starfallMenu(name)]]);
  }
  /** 星潮圍城: pick one of three boons between waves (N reopens it). */
  hordeChoice(offer:BoonId[],wave:number,have:BoonId[]){
    this.renderDialog('星潮圍城',`<b>第 ${wave} 波撐過了！</b>選一個祝福，下一波就開始。<br><span class="hint">已經有：${have.length?have.map(b=>`${BOONS[b].icon}${BOONS[b].name}`).join('、'):'（還沒有）'}　按 N 可以重新打開這個選單。</span>`,
      offer.map(b=>[`${BOONS[b].icon} ${BOONS[b].name}${BOONS[b].risk?'（高風險）':''}：${BOONS[b].desc}`,()=>{this.closeDialog();this.main.hordeChoose?.(b);}] as [string,()=>void]));
  }
  challengeDone(won:boolean,title:string,reward:string){
    const close=()=>this.closeDialog();
    this.renderDialog(won?'挑戰完成':'挑戰結束',`<b>${title}</b>${reward?`<br>獎勵：${reward}`:''}<br><span class="hint">獎勵已經放進背包。</span>`,
      [['回到曙光前哨',()=>{close();this.main.leaveArena?.();}],['先留在這裡',close]]);
  }
  private forgeTab:'salvage'|'upgrade'|'imprint'|'enchant'|'codex'='salvage';private forgePick:string|null=null;
  private forgeHtml(s:GameState){
    const tabs=([['salvage','分解'],['upgrade','升階'],['imprint','烙印威能'],['enchant','淬鍊'],['codex','威能圖鑑']] as const).map(([k,n])=>`<button class="${this.forgeTab===k?'on':''}" data-forge-tab="${k}">${n}</button>`).join('');
    const sf=SF.starfallOf(s),dust=s.items.starDust??0,worn=new Set(Object.values(s.equipped));
    const name=(e:R.EquipInst)=>{const q=e.q??0;return `<b style="color:${QUALITY[q].color}">${q?`【${QUALITY[q].name}】`:''}${items[e.defId].name}${e.refine?` +${e.refine}`:''}</b>`;};
    const tip=(e:R.EquipInst)=>esc(this.equipTip(s,e.defId,[],e));
    let body='';
    if(this.forgeTab==='salvage'){
      const list=s.equipment.filter(e=>!worn.has(e.id)).sort((a,b)=>(a.q??0)-(b.q??0));
      body=`<p class="hint" style="margin:0 0 6px">分解裝備得到星塵（普通 1／精良 3／稀有 6／傳說 12／唯一 30，精煉值另外加）。<b>傳說裝備上的威能會記進威能圖鑑</b>。鎖定與穿著中的不會被分解。</p>
        <div class="forge-bulk"><button class="btn" data-salvage-all="0">分解所有普通</button><button class="btn" data-salvage-all="1">分解普通＋精良</button><button class="btn" data-salvage-all="2">分解到稀有</button></div>
        <div class="list">${list.map(e=>{const why=SF.salvageBlock(s,e),lg=e.legend&&ASPECT_IDS.includes(e.legend as AspectFx)&&!sf.codex.includes(e.legend as AspectFx);
          return `<div class="row"><img src="${itemIcon(e.defId)}" alt="" data-tip="${tip(e)}"><div class="main">${name(e)}<small>${lg?`<span class="gain">✦ 分解可學會「${ASPECT_NAMES[e.legend as AspectFx]}」</span>`:e.locked?'已鎖定':''}</small></div><button class="btn ${why?'':'primary'}" data-salvage="${e.id}" ${why?'disabled':''}>分解 +${SF.DUST[e.q??0]+(e.refine??0)}</button></div>`;}).join('')||'<p class="hint">背包裡沒有可以分解的裝備。</p>'}</div>`;}
    else if(this.forgeTab==='imprint'||this.forgeTab==='enchant'||this.forgeTab==='upgrade'){
      const ok=(e:R.EquipInst)=>!(items[e.defId] as EquipDef).unique&&(this.forgeTab==='upgrade'?(e.q??0)<2:this.forgeTab==='imprint'?(e.q??0)>=2:(e.affix?.length??0)>0);
      const list=s.equipment.filter(ok),pick=list.find(e=>e.id===this.forgePick)??null;
      const picker=`<div class="forge-pick">${list.map(e=>`<button class="cell ${e.q?`q${e.q}`:''} ${pick?.id===e.id?'sel':''} ${worn.has(e.id)?'worn':''}" data-forge-pick="${e.id}" data-tip="${tip(e)}"><img src="${itemIcon(e.defId)}" alt="">${worn.has(e.id)?'<span class="tag">E</span>':''}</button>`).join('')||`<p class="hint">${this.forgeTab==='imprint'?'需要稀有或傳說裝備。':this.forgeTab==='upgrade'?'沒有普通或精良的裝備。':'需要有詞綴的裝備（精良以上）。'}</p>`}</div>`;
      let detail='';
      if(pick&&this.forgeTab==='upgrade'){const c=SF.upgradeCost(pick),why=SF.upgradeBlock(s,pick),to=QUALITY[(pick.q??0)+1];
        detail=`<div class="forge-detail">${name(pick)}<small>升成 <b style="color:${to.color}">${to.name}</b>，多一條隨機詞綴；精煉值、卡片、武器本身的特效都保留。</small><small>費用 ${fmt(c.zeny)} z、星塵 ${c.dust}</small>
          <button class="btn ${why?'':'primary'}" data-upgrade="1" ${why?`disabled data-tip="${esc(why)}"`:''}>升階為${to.name}</button></div>`;}
      if(pick&&this.forgeTab==='imprint'){const c=SF.imprintCost(items[pick.defId] as EquipDef);
        detail=`<div class="forge-detail">${name(pick)}${pick.legend?`<small>目前：✦ ${GEAR_FX[pick.legend]}</small>`:''}<small>費用 ${fmt(c.zeny)} z、星塵 ${c.dust}${(pick.q??0)<3?'（稀有會升級成傳說並多一條詞綴）':''}</small></div>
          <div class="list">${sf.codex.map(f=>{const why=SF.imprintBlock(s,pick,f);return `<div class="row"><div class="main"><b>${ASPECT_NAMES[f]}</b><small>${GEAR_FX[f]}</small></div><button class="btn ${why?'':'primary'}" data-imprint="${f}" ${why?`disabled data-tip="${esc(why)}"`:''}>烙印</button></div>`;}).join('')||'<p class="hint">威能圖鑑還是空的：分解傳說裝備或通關印記地城來學會威能。</p>'}</div>`;}
      if(pick&&this.forgeTab==='enchant'){const c=SF.enchantCost(pick);
        detail=`<div class="forge-detail">${name(pick)}<small>每次 ${fmt(c.zeny)} z、星塵 ${c.dust}（越淬越貴）。${pick.ench?'這件只能繼續淬鍊同一條詞綴。':'第一次淬鍊後，就只能淬鍊同一條詞綴。'}</small></div>
          <div class="list">${(pick.affix??[]).map((a,i)=>{const why=SF.enchantBlock(s,pick,i);return `<div class="row"><div class="main"><b style="color:${QUALITY[pick.q??1].color}">${affixText(a)}</b>${pick.ench?.idx===i?'<small>已淬鍊 '+pick.ench.n+' 次</small>':''}</div><button class="btn ${why?'':'primary'}" data-enchant="${i}" ${why?`disabled data-tip="${esc(why)}"`:''}>淬鍊</button></div>`;}).join('')}</div>`;}
      body=`<p class="hint" style="margin:0 0 6px">${this.forgeTab==='upgrade'?'打造或掉落的普通／精良裝備可以升階：普通 → 精良 → 稀有，升到稀有後就能烙印威能變成傳說。':this.forgeTab==='imprint'?'把威能圖鑑裡的傳說威能烙印到稀有／傳說裝備上（取代原本的傳說效果）。':'重新擲一條詞綴（不會和其他詞綴重複）。'}先點一件裝備：</p>${picker}${detail}`;}
    else{body=`<p class="hint" style="margin:0 0 6px">已學會 <b>${sf.codex.length}</b> / ${ASPECT_IDS.length} 種傳說威能。分解帶有威能的傳說裝備，或通關<b>印記地城</b>都會學會新的威能；學會後可以烙印到任何稀有／傳說裝備上，任何職業都能用。</p>
      <div class="codex">${ASPECT_IDS.map(f=>`<div class="cx ${sf.codex.includes(f)?'on':''}"><b>${sf.codex.includes(f)?'✦ ':'？ '}${ASPECT_NAMES[f]}</b><small>${GEAR_FX[f]}</small></div>`).join('')}</div>`;}
    return `<div class="tabs">${tabs}</div><p class="forge-dust">星塵 <b>${dust}</b>　·　威能 ${sf.codex.length}/${ASPECT_IDS.length}</p>${body}`;
  }
  /** v6.3 星光深淵: choose a starting floor (1, or the last checkpoint every 5 floors). */
  private abyssMenu(name:string){
    const best=this.main.abyssBest?.()??0,cp=best>=5?best-best%5+1:1,close=()=>this.closeDialog();
    const opts:[string,()=>void][]=[['從第 1 層開始',()=>{close();this.main.abyssEnter?.(1);}]];
    if(cp>1)opts.push([`從第 ${cp} 層開始（檢查點）`,()=>{close();this.main.abyssEnter?.(cp);}]);
    opts.push(['再想想',close]);
    this.renderDialog(name,`星光深淵沒有盡頭：每層打倒所有魔物就能往下走，每 5 層有一隻首領。越深的寶箱，越容易開出<b style="color:#ff8a3d">傳說</b>裝備。<br>魔物從 Lv.32 開始，每層 +2；過了 Lv.82 之後還會一直變強。<br><span class="hint">在深淵裡倒下不會損失經驗；每 5 層會記錄檢查點。最高紀錄：第 ${best} 層。</span>`,opts);
  }
  abyssClear(floor:number,record:boolean){
    const close=()=>this.closeDialog();
    this.renderDialog('星光深淵',`<b>第 ${floor} 層突破！</b>${record?' <span style="color:#ff8a3d">新紀錄！</span>':''}<br>中央出現了寶箱，記得打開再走。<br>下一層：魔物約 Lv.${30+(floor+1)*2}${(floor+1)%5===0?'，<b>首領層</b>':''}。`,
      [[`前往第 ${floor+1} 層`,()=>{close();this.main.abyssNext?.();}],['回到曙光前哨',()=>{close();this.main.warp('frontier',37,26);}],['先撿東西（按 N 再打開這個選單）',close]]);
  }
  private ascSkip=false;
  /** v6.0 二轉: 遠征隊長 艾德 runs the 星路的徵召 → 誓約試煉 → 轉職儀式. Returns false to fall through to normal quests. */
  private ascensionDialog(name:string,npcId:string):boolean{
    const s=this.main.state(),c=s.char,a=R.ascensionOf(s),close=()=>this.closeDialog();
    if(c.job2||c.job==='novice'||!secondJobOf[c.job])return false;
    const nx=jobs[secondJobOf[c.job]!],other:[string,()=>void]=['談談其他委託',()=>{this.ascSkip=true;this.showDialog(npcId);}];
    const why=R.ascensionReady(s);
    if(a.stage===0){
      if(why){if(c.baseLv<55)return false;
        this.renderDialog(name,`遠征隊需要更強的戰力。等你到 <b>Base ${JOB2_REQ.baseLv}、Job ${JOB2_REQ.jobLv}</b>，我會推薦你接受<b>二轉</b>的試煉——成為<b>${nx.name}</b>。<br><span class="hint">目前：Base ${c.baseLv}、Job ${c.jobLv}</span>`,[['我會努力的',close],other]);return true;}
      this.renderDialog(name,`你的實力已經足夠了。星界城塞之外的星路一條接一條熄滅，我們需要能走得更遠的人。<br>先證明你能在前線生存：在 <b>Lv.45 以上</b>的地圖打倒 <b>${R.ASCENSION.kills} 隻</b>魔物，回來找我。<br><span class="hint">完成後會開啟誓約試煉，通過就能成為 <b>${nx.name}</b>：${nx.desc}</span>`,
        [['接下「星路的徵召」',()=>{if(this.main.run(st=>R.acceptAscension(st),'接下二轉委託「星路的徵召」！'))this.showDialog(npcId);}],other]);return true;}
    if(a.stage===1){
      if(a.kills>=R.ASCENSION.kills){this.renderDialog(name,`${R.ASCENSION.kills} 隻，一隻不少。你已經是前線的戰力了。<br>我替你打開<b>誓約試煉場</b>——裡面的守護者會測試你作為${jobs[c.job].name}的一切。`,[['回報',()=>{if(this.main.run(st=>R.reportAscensionHunt(st),'誓約試煉場開啟了！','levelup'))this.showDialog(npcId);}],other]);return true;}
      this.renderDialog(name,`「星路的徵召」：在 Lv.45 以上的地圖打倒魔物（${a.kills}/${R.ASCENSION.kills}）。<br><span class="hint">霧語沼澤、熔岩裂谷、天空花園、星界城塞都算。</span>`,[['我這就去',close],other]);return true;}
    if(a.stage===2){
      this.renderDialog(name,`誓約試煉場已經開啟。守護者是為${jobs[c.job].name}準備的，別小看牠。<br><span class="hint">試煉中倒下不會損失經驗。走出西邊的出口就能回到前哨。</span>`,[['前往誓約試煉場',()=>{close();this.main.warp('oathGround',5,18);}],['再準備一下',close],other]);return true;}
    this.renderDialog(name,`你打倒了守護者！轉職官葛蘭特地從晨光鎮趕來，要親自為你舉行儀式。<br>準備好成為 <b>${nx.name}</b> 了嗎？<br><span class="hint">一轉的技能、等級與裝備全部保留，一轉 Job 也能繼續練到 70。</span>`,
      [[`舉行轉職儀式，成為${nx.name}`,()=>{close();this.main.ascend?.();}],['等一下',close]]);return true;
  }
  /** Card researcher: per-build card targets with the monster, its level and where it lives. */
  private buildCardAdvice(s:GameState){
    const where=(mid:string)=>{const m=Object.values(maps).find(md=>md.spawns.some(sp=>sp.monster===mid));return m?m.name:'MVP 召喚';};
    const guides=s.char.job==='novice'?firstJobs.flatMap(j=>buildsOf(j)):buildsOf(s.char.job);
    const owned=new Set(s.cards.map(c=>c.defId));
    const body=guides.map(g=>`<b>${jobs[g.job].name}・${g.name}</b><br>`+g.cardTargets.map(t=>{
      const cd=cards[t.cardId],mo=monsters[cd.monster];
      return `${owned.has(t.cardId)?'✓ ':'· '}${cd.name}（${t.reason}）— ${mo.name} Lv.${mo.level}・${where(cd.monster)}`;}).join('<br>')).join('<br><br>');
    return `這些是各流派最想要的卡片和掉落地點，打勾的是你已經有的。<br><span class="hint">普通魔物卡片掉率 1/150、MVP 1/6。</span><div style="max-height:260px;overflow:auto;margin-top:6px">${body}</div>`;
  }
  private bountyReward(b:X.Bounty){return [`${fmt(b.zeny)} z`,`基本經驗 ${fmt(b.exp)}`,`職業經驗 ${fmt(b.jexp)}`,...Object.entries(b.items).map(([id,n])=>`${items[id].name} ×${n}`)].join('、');}
  private rewardText(def:{reward:{exp:number;jexp:number;zeny:number;items?:Record<string,number>}}){
    const r=def.reward;return [`基本經驗 ${fmt(r.exp)}`,`職業經驗 ${fmt(r.jexp)}`,`${fmt(r.zeny)} z`,...Object.entries(r.items??{}).map(([id,n])=>`${items[id].name}${n>1?` ×${n}`:''}`)].join('、');
  }
  private showTutorial(name:string){
    const pages=[
      '在地上<b>點一下</b>就會走過去，<b>點魔物</b>會自動連續攻擊。按住滑鼠可以一直跟著走。',
      '打倒魔物會得到<b>基本經驗</b>和<b>職業經驗</b>。基本等級提升給素質點（按 <b>A</b>），職業等級提升給技能點（按 <b>S</b>）。學會的技能會自動放到快捷欄。',
      '把<b>基本技能</b>學到 Lv.9、職業等級練到 10，再找廣場北邊的<b>轉職官 葛蘭</b>，就能成為劍士、法師或弓手。',
      '打倒魔物有機會掉落<b>卡片</b>：插進裝備卡槽（按 <b>Q</b>），再到技能視窗配置模組，技能就會有新效果！',
      '按 <b>Z</b> 開啟自動戰鬥，會自動打怪、放快捷欄上的技能、撿東西。設定裡可以開自動喝藥。精煉師布魯可以強化裝備。',
      '野外藏著<b>寶箱</b>，金色的是稀有寶箱！地圖上的<b>地標</b>也能互動：營地可以領補給，石環和石碑可以啟動<b>試煉</b>，打倒精英拿試煉寶箱。',
      '鎮上的<b>懸賞官 雷克斯</b>有可重複的討伐懸賞；<b>工匠 蘇菲</b>能用試煉徽記和素材打造招牌裝備、做料理。精煉到 +3、+5、+7 會強化裝備的特色喔！'];
    let i=0;const close=()=>this.closeDialog();
    const page=()=>{this.renderDialog(name,pages[i],[...(i<pages.length-1?[['下一頁',()=>{i++;page();}] as [string,()=>void]]:[]),['結束對話',close]]);};page();
  }
  private renderDialog(name:string,text:string,opts:[string,()=>void][]){
    this.root.classList.add('dialog-active');this.dialogOpen=true;this.dialogEl.hidden=false;this.dialogEl.style.zIndex='100000';this.dialogEl.setAttribute('role','dialog');this.dialogEl.setAttribute('aria-modal','true');this.dialogEl.setAttribute('aria-label',name);
    this.dialogEl.innerHTML=`<div class="title"><span class="speaker">${esc(name)}</span></div><div class="body"><p>${text}</p><div class="opts">${opts.map((o,i)=>`<button class="btn" data-opt="${i}">${esc(o[0])}</button>`).join('')}</div></div>`;
    this.dialogEl.querySelectorAll<HTMLElement>('[data-opt]').forEach(b=>b.onclick=()=>{this.main.audio.play('click');opts[Number(b.dataset.opt)][1]();});
    this.dialogEl.querySelector<HTMLElement>('[data-opt]')?.focus();
  }
  closeDialog(){this.root.classList.remove('dialog-active');this.assignSlot=null;this.dialogOpen=false;this.dialogEl.hidden=true;}
  showLandmark(title:string,text:string,key?:string){
    const close=()=>this.closeDialog(),[map,i]=(key??'').split(':'),lm=key?landmarks[map]?.[Number(i)]:undefined,w=this.main.world;
    let body=esc(text).replace(/\n/g,'<br>');const opts:[string,()=>void][]=[];
    if(lm?.action==='supply'){const wait=w.landmarkCooldown(key!);
      body+=`<br><br><b>營地補給</b>：每 ${SUPPLY_COOLDOWN/60} 分鐘可以在這裡領一個補給箱（食物與藥水）。`+(wait>0?`<br><span class="hint">補給還在準備中，約 ${Math.ceil(wait/60)} 分鐘後再來。</span>`:'');
      if(wait<=0)opts.push(['領取補給',()=>{close();w.useLandmark(key!);}]);}
    if(lm?.action==='trial'&&TRIALS[key!]){const T=TRIALS[key!],m=monsters[T.elite],wait=w.landmarkCooldown(key!),times=this.main.state().explore?.trials[key!]??0;
      body+=`<br><br><b>${T.title}</b>：喚醒強化的【試煉】${m.name}（約 Lv.${m.level} 的 ${T.hpMul} 倍血量）與牠的手下。打倒精英會出現<b>試煉寶箱</b>：必定有裝備，也有機會開出卡片。<br><span class="hint">完成次數 ${times}。離開地圖會中斷試煉。${wait>0?`冷卻中，約 ${Math.ceil(wait/60)} 分鐘後可再挑戰。`:'每次完成後冷卻 10 分鐘。'}</span>`;
      if(wait<=0&&!w.trial)opts.push(['啟動試煉',()=>{close();w.useLandmark(key!);}]);}
    const secret=key?SECRET_AREAS[key]:undefined;
    if(secret){const open=(this.main.state().explore?.trials[key!]??0)>0;
      body+=open?`<br><br><b>✦ ${secret.name}</b>：${secret.desc}`:`<br><br><span class="hint">附近似乎藏著一條被封住的路……也許完成這裡的試煉後，就能打開。</span>`;
      if(open)opts.push([`進入${secret.name}`,()=>{close();this.main.warp(secret.map,secret.x,secret.y);}]);}
    // v6.0 二轉 gates and the 貝露燈塔 story.
    const gate=key?JOB2_GATES[key]:undefined;
    if(gate){const st=this.main.state(),open=!!st.char.job2;
      body+=open?`<br><br><b>✦ ${gate.name}</b>：${gate.desc}`:`<br><br><span class="hint">一股更強大的力量封住了這裡……完成<b>二轉</b>的人才能通過。（曙光前哨的艾德）</span>`;
      if(open)opts.push([`前往${gate.name}`,()=>{close();this.main.warp(gate.map,gate.x,gate.y);}]);}
    if(key==='bellBay:1'){const lit=!!this.main.state().flags?.lighthouse;
      body+=lit?'<br><br>燈室裡的星燈穩穩地亮著，光束一路照向夜航港。遠方，第一艘返航的船正在靠岸。':'<br><br><span class="hint">夜航港的燈塔技師芮比說過，只要帶回 12 份星燈燈芯，就能把燈重新點亮。</span>';}
    opts.push(['繼續冒險',close]);this.renderDialog(title,body,opts);
  }
  showDeath(lost:boolean){
    this.renderDialog('系統',`你倒下了……${lost?'<br>損失了一些基本經驗值。':'<br>Lv.10 以前不會損失經驗。'}<br>裝備與卡片都還在。`,[['回到存檔點',()=>{this.closeDialog();this.main.respawn();}]]);
  }

  // ———————————————————————— v6.1 character select ————————————————————————
  /** Pick one of the character slots. Resolves with the chosen slot (empty slots go on to character creation). */
  showSlots(load:()=>Promise<SlotSummary[]>,remove:(slot:number)=>Promise<void>):Promise<number>{
    return new Promise(resolve=>{
      const el=document.createElement('div');el.id='slots';document.body.append(el);
      let last=0;try{last=Number(localStorage.getItem('starlight-slot')??0)||0;}catch{/* preference only */}
      let ask=-1;
      const render=async()=>{
        const list=await load();
        el.innerHTML=`<div class="card"><h1>星光冒險<small>選擇角色 · 最多 ${list.length} 位</small></h1><div class="cslots">${list.map(sl=>{
          if(sl.empty)return `<button class="cslot empty" data-new="${sl.slot}"><span class="plus">＋</span><b>建立新角色</b><small>空的角色欄</small></button>`;
          if(sl.broken)return `<div class="cslot broken"><b>無法讀取的存檔</b><small>第 ${sl.slot+1} 欄</small><button class="btn danger" data-del="${sl.slot}">${ask===sl.slot?'再按一次確認刪除':'刪除'}</button></div>`;
          const j2=sl.job2?jobs[sl.job2 as JobId]:null,j1=jobs[sl.job as JobId];
          return `<div class="cslot ${sl.slot===last?'last':''}" data-play="${sl.slot}" role="button" tabindex="0" aria-label="以 ${esc(sl.name??'')} 進入遊戲">
            <canvas width="${CW}" height="${CH}" data-portrait="${sl.slot}"></canvas>
            <div class="info"><b>${esc(sl.name??'')}</b><span class="jobtag" style="background:${(j2??j1)?.color??'#888'}">${JOB_EMBLEM[sl.job2??sl.job??'']??''} ${(j2??j1)?.name??''}</span>
            <small>Base Lv.${sl.baseLv}　${j2?`二轉 ${sl.job2Lv}・`:''}Job ${sl.jobLv}</small><small>📍 ${esc(mapTitle(sl.map??'town'))}　💰 ${fmt(sl.zeny??0)} z</small></div>
            <div class="acts"><button class="btn primary" data-play="${sl.slot}">進入遊戲</button><button class="btn danger" data-del="${sl.slot}">${ask===sl.slot?`再按一次刪除「${esc(sl.name??'')}」`:'刪除'}</button></div></div>`;}).join('')}</div>
          <p class="hint">每個角色有自己的等級、裝備、卡片和任務進度。遊戲中可以在設定裡「切換角色」回到這裡。</p></div>`;
        // Small painted portraits (cheap 2D sprites; the 3D scene is not running yet).
        for(const sl of list)if(!sl.empty&&!sl.broken){const cv=el.querySelector<HTMLCanvasElement>(`[data-portrait="${sl.slot}"]`);const g=cv?.getContext('2d');
          if(g)drawCharacter(g,{outfit:(sl.job??'novice') as Look['outfit'],hair:(sl.hair??0)%4,hairColor:R.hairColors[sl.hairColor??0],weapon:sl.job==='mage'?'staff':sl.job==='archer'?'bow':sl.job==='swordman'?'sword':'dagger'},'S','idle',0);}
      };
      el.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-play],[data-new],[data-del]');if(!b)return;
        if(b.dataset.del!==undefined){e.stopPropagation();const n=Number(b.dataset.del);if(ask!==n){ask=n;void render();return;}
          ask=-1;void remove(n).then(render);return;}
        const n=Number(b.dataset.play??b.dataset.new);el.remove();resolve(n);});
      el.addEventListener('keydown',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-play]');if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();el.remove();resolve(Number(b.dataset.play));}});
      void render();
    });
  }
  // ———————————————————————— character creation ————————————————————————
  showCreate(onDone:()=>void){
    const el=document.createElement('div');el.id='create';
    let hair=0,color=0;
    el.innerHTML=`<div class="card"><h1>星光冒險<small>STARLIGHT · 單人冒險</small></h1>
      <div class="cols"><div class="preview"><canvas width="${CW}" height="${CH}"></canvas></div>
      <div><label for="cname">角色名字</label><input id="cname" type="text" maxlength="12" placeholder="1～12 個字" autocomplete="off">
        <label>角色</label><div class="choices avatars" id="hairs">${AVATAR_LABELS.map((n,i)=>`<button data-h="${i}" aria-label="角色 ${n}">${n}</button>`).join('')}</div>
        <label>髮色<small>（第一格為原色）</small></label><div class="choices" id="colors">${R.hairColors.map((c,i)=>`<button data-c="${i}" style="background:${c}" aria-label="髮色 ${i+1}"></button>`).join('')}</div>
        <div class="err" role="alert"></div></div></div>
      <div class="foot"><small>從初心者開始，職業等級 10 後轉職。</small><span><button class="btn" id="back" style="padding:6px 14px;font-size:14px;margin-right:6px">返回選角</button><button class="btn primary" id="go" style="padding:6px 18px;font-size:14px">開始冒險</button></span></div></div>`;
    document.body.append(el);
    const cv=el.querySelector('canvas')!,g=cv.getContext('2d')!;
    // 3D turntable when the 3D renderer is active; the painted 2D sprite otherwise.
    let preview:{update(l:unknown):void;dispose():void}|null=null;
    const look3d=()=>({outfit:'novice' as const,hair,hairColor:R.hairColors[color],weapon:'dagger' as const});
    if(this.main.settings.renderer!=='2d'&&!/renderer=(2d|canvas)/.test(location.search)){
      const host=el.querySelector<HTMLElement>('.preview')!;cv.remove();host.classList.add('preview3d');
      void import('./render3d/preview').then(m=>{preview=m.mountPreview(host,look3d()) as typeof preview;}).catch(()=>{host.append(cv);});
    }
    let t=0;const draw=()=>{if(preview||!cv.isConnected)return;g.clearRect(0,0,CW,CH);drawCharacter(g,{outfit:'novice',hair:hair%4,hairColor:R.hairColors[color],weapon:'dagger'},(['S','SE','E','SE'] as const)[Math.floor(t/40)%4],'idle',Math.floor(t/20)%2);};
    const tick=setInterval(()=>{t++;draw();},50);
    const sync=()=>{el.querySelectorAll<HTMLElement>('[data-h]').forEach(b=>b.classList.toggle('on',Number(b.dataset.h)===hair));el.querySelectorAll<HTMLElement>('[data-c]').forEach(b=>b.classList.toggle('on',Number(b.dataset.c)===color));draw();preview?.update(look3d());};
    el.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('button');if(!b)return;if(b.dataset.h)hair=Number(b.dataset.h);if(b.dataset.c)color=Number(b.dataset.c);sync();});
    const go=()=>{const name=(el.querySelector('#cname') as HTMLInputElement).value;
      try{this.main.create(name,hair,color);clearInterval(tick);preview?.dispose();el.remove();onDone();}catch(err){el.querySelector('.err')!.textContent=err instanceof Error?err.message:String(err);}};
    el.querySelector('#go')!.addEventListener('click',go);
    el.querySelector('#back')!.addEventListener('click',()=>{clearInterval(tick);preview?.dispose();location.reload();});
    el.querySelector('#cname')!.addEventListener('keydown',e=>{if((e as KeyboardEvent).key==='Enter')go();});
    sync();(el.querySelector('#cname') as HTMLInputElement).focus();
  }
}
export const mapTitle=(id:string)=>maps[id]?.name??id;
export const monsterName=(id:string)=>monsters[id]?.name??id;
