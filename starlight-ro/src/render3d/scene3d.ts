import { fxState } from '../render/fx-state';
// 3D presentation (default renderer): toon-shaded chibi world in the spirit of RO's 3D era.
// Same contract as the 2D GameScene: reads the World with interpolation, turns clicks into
// world commands and plays feedback. It never changes saved state.
import * as THREE from 'three';
import type { World, SimEvent, Monster, GroundItem, Vec } from '../world/sim';
import { skills } from '../data/jobs';
import { items, cards } from '../data/items';
import { maps } from '../data/maps';
import type { MapData } from '../world/mapgen';
import type { Look } from '../render/art/characters';
import { landmarks } from '../render/art/backdrop';
import { itemIconCanvas, cardIconCanvas } from '../render/art/icons';
import { Engine } from './engine';
import { type CharLook, type CharPose } from './character3d';
import { VrmHero, vrmLookFrom, type VrmCast } from './vrm-hero';
import { companions, mounts, type CompanionRole } from '../data/adventure';
import { hairColors } from '../rules/state';
import {createNpcHero,type NpcHero} from './npc-hero';
import {CombatPresentation} from './combat-presentation';
import { MonsterModel, type MonPose } from './monster3d';
import { buildWorld, type WorldView } from './world3d';
import { enableOcclusionFade, updateOcclusionFade } from './occlusion-fade';
import { Particles, EffectMeshes, rune, beamTexture, type Effect } from './fx3d';
import { Overlay, type Tag } from './overlay';
import { toon, inked, glow, additive } from './toon';

export type SceneHooks = {
  onEvents(ev:SimEvent[]):void; inputBlocked():boolean;
  onPresentationEvents?(ev:SimEvent[]):void;onPresentationReset?():void;
  playerLook():Look; playerName():string; playerCostume?():{head:string|null;back:string|null};
  playerPet?():string|null;
  /** Mount id while riding, else null. */
  playerMount?():string|null;
  onHover(text:string|null):void; onTargetingEnd():void; onManualInput?():void; onInspectLandmark?(title:string,text:string,key?:string):void;
};
const elementHex:Record<string,string>={fire:'#ff7a3d',water:'#6fc3ff',wind:'#ffe26b',earth:'#c9a46b',neutral:'#ffffff'};
type MonView={model:MonsterModel;bar:Tag;name:Tag;walk:number;last:Vec;yaw:number;deadAt:number;spawnAt:number;art?:object};
type NpcView={id:string;chibi:NpcHero;tag:Tag;x:number;y:number};

export class Scene3D {
  world!:World; hooks!:SceneHooks;
  engine!:Engine; private overlay!:Overlay;
  private particles=new Particles(); private fx=new EffectMeshes();
  private worldView:WorldView|null=null;
  private player:VrmHero|null=null; private playerKey='';
  private playerTag!:Tag; private castTag!:Tag;
  private pet:{model:MonsterModel;id:string;pos:THREE.Vector3;yaw:number;walk:number}|null=null;
  private npcs:NpcView[]=[];
  private mons=new Map<number,MonView>();
  private loot=new Map<number,{obj:THREE.Object3D;born:number;card:boolean}>();
  private chestViews=new Map<number,{obj:THREE.Group;tag:Tag;gem:THREE.Object3D|null}>();
  private landmarkViews:{x:number;y:number;name:string;text:string;key:string;tag:Tag;obj:THREE.Object3D}[]=[];
  private warpTags:Tag[]=[];
  private castRune:THREE.Mesh|null=null;
  private navigation:{x:number;y:number;label:string}|null=null;
  private navObj:THREE.Group|null=null;
  targeting:string|null=null;
  private aim:THREE.Mesh|null=null;
  private focus=new THREE.Vector3();
  private frustum=new THREE.Frustum();private projView=new THREE.Matrix4();private cullSphere=new THREE.Sphere(new THREE.Vector3(),1.4);private frameNo=0;
  private html=new WeakMap<HTMLElement,string>();
  /** Writes innerHTML only when it changed (per-frame DOM writes force style/layout work). */
  private setHTML(el:HTMLElement,s:string){if(this.html.get(el)!==s){this.html.set(el,s);el.innerHTML=s;}}
  private yaw=Math.PI/4; private pitch=.58; private dist=13;
  private shake=0;
  private time=0; private last=0;
  private walkPhase=0; private playerYaw=0; private hurtUntil=0;
  private presentation=new CombatPresentation();private wasBlocked=false;
  private presentedHits=new Map<number,number>();
  private pointer={x:0,y:0,inside:false,left:false,right:false,downX:0,downY:0,dragged:false,downAt:0,holdAt:0};
  private ray=new THREE.Raycaster(); private ndc=new THREE.Vector2(); private plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private mapId=''; private weatherAcc=0;
  private resolveReady!:()=>void;
  readonly whenReady=new Promise<void>(r=>{this.resolveReady=r;});

  attach(world:World,hooks:SceneHooks){this.world=world;this.hooks=hooks;}
  mount(host:HTMLElement){
    this.engine=new Engine(host);this.overlay=new Overlay(host);this.setGraphics(this.graphics);
    this.engine.scene.add(this.particles.points,this.fx.group);
    this.playerTag=this.overlay.tag('','ov-player',0);this.castTag=this.overlay.tag('','ov-cast',0);this.castTag.visible=false;
    const el=this.engine.renderer.domElement;el.style.display='block';el.addEventListener('contextmenu',e=>e.preventDefault());
    el.addEventListener('pointerdown',e=>this.onDown(e));addEventListener('pointerup',e=>this.onUp(e));
    el.addEventListener('pointermove',e=>this.onMove(e));el.addEventListener('pointerleave',()=>{this.pointer.inside=false;});
    el.addEventListener('wheel',e=>{e.preventDefault();this.dist=THREE.MathUtils.clamp(this.dist*(e.deltaY>0?1.1:.9),4.5,24);},{passive:false});
    this.engine.dayTime=.3;
    const loop=(ms:number)=>{const dt=Math.min(.1,(ms-(this.last||ms))/1000);this.last=ms;this.frame(dt);requestAnimationFrame(loop);};
    requestAnimationFrame(loop);this.resolveReady();
  }
  get currentMap(){return this.mapId;}

  // ———————————————————————— map ————————————————————————
  loadMap(map:MapData){
    this.resetPresentation();
    this.mapId=map.def.id;this.clearNavigation();this.fx.clear();this.keyed.clear();
    if(this.worldView){this.engine.scene.remove(this.worldView.group);disposeTree(this.worldView.group);}
    for(const n of this.npcs){this.engine.scene.remove(n.chibi.root);n.chibi.dispose();this.overlay.remove(n.tag);}this.npcs=[];
    for(const m of this.mons.values())this.dropMonster(m);this.mons.clear();
    for(const l of this.loot.values())this.engine.scene.remove(l.obj);this.loot.clear();
    for(const l of this.landmarkViews){this.overlay.remove(l.tag);}this.landmarkViews=[];
    for(const c of this.chestViews.values()){this.engine.scene.remove(c.obj);this.overlay.remove(c.tag);}this.chestViews.clear();
    for(const t of this.warpTags)this.overlay.remove(t);this.warpTags=[];
    this.worldView=buildWorld(map);this.engine.scene.add(this.worldView.group);enableOcclusionFade(this.worldView.group);
    this.engine.setMood(map.def.variant??map.def.theme);
    for(const n of map.def.npcs){
      const chibi=createNpcHero(n);
      chibi.root.position.set(n.x+.5,0,n.y+.5);chibi.root.rotation.y=Math.PI/4;this.engine.scene.add(chibi.root);
      const tag=this.overlay.tag(`<div class="ov-name npc">${n.name}</div>`,'',14);tag.pos.set(n.x+.5,0,n.y+.5);
      this.npcs.push({id:n.id,chibi,tag,x:n.x+.5,y:n.y+.5});
    }
    for(const wp of map.def.warps){const t=this.overlay.tag(`<div class="ov-name warp">➜ ${maps[wp.to].name}</div>`,'',0);t.pos.set(wp.x+.5,2.7,wp.y+.5);this.warpTags.push(t);}
    for(const [li,lm] of (landmarks[map.def.id]??[]).entries()){
      const cell=map.grid.nearestWalkable(lm.x,lm.y,8);if(!cell)continue;
      const obj=this.landmarkModel(lm.kind);obj.position.set(cell.x+.5,0,cell.y+.5);this.worldView.group.add(obj);
      const verb=lm.action==='trial'?'試煉':lm.action==='supply'?'補給':'調查';
      const tag=this.overlay.tag(`<div class="ov-name landmark ${lm.action??''}">✧ ${lm.name}・${verb}</div>`,'',18);tag.pos.set(cell.x+.5,0,cell.y+.5);
      this.landmarkViews.push({x:cell.x+.5,y:cell.y+.5,name:lm.name,text:lm.text,key:`${map.def.id}:${li}`,tag,obj});
    }
    this.playerKey='';this.ensurePlayer();
    // v4.9 warm-up: compile this map's shaders in the background so first effects/monsters don't hitch.
    const r=this.engine.renderer as THREE.WebGLRenderer&{compileAsync?:(s:THREE.Object3D,c:THREE.Camera)=>Promise<unknown>};
    void r.compileAsync?.(this.engine.scene,this.engine.camera).catch(()=>{});
    const p=this.world.player;this.focus.set(p.x,0,p.y);
    this.pet=null;
  }
  private landmarkModel(kind:'camp'|'ruin'|'shrine'|'lighthouse'){
    const g=new THREE.Group();
    if(kind==='lighthouse'){
      // v6.0 星燈航路: a striped tower; once the story lights it, a glowing lamp and a slowly sweeping beam (no real light source).
      for(let i=0;i<4;i++){const seg=inked(new THREE.CylinderGeometry(.62-i*.08,.7-i*.08,.9,14),toon(i%2?'#e85a5a':'#f4f0ea'),.03);seg.position.y=.45+i*.9;g.add(seg);}
      const deck=inked(new THREE.CylinderGeometry(.62,.62,.12,14),toon('#5a6a7a'),.03);deck.position.y=3.66;g.add(deck);
      const lit=!!this.world.flags.lighthouse;
      const lamp=new THREE.Mesh(new THREE.SphereGeometry(.32,14,10),lit?glow('#ffe27a',3):toon('#7a7a7a'));lamp.position.y=4;g.add(lamp);
      const roof=inked(new THREE.ConeGeometry(.5,.55,14),toon('#3a4a6a'),.03);roof.position.y=4.55;g.add(roof);
      if(lit){const beam=new THREE.Mesh(new THREE.ConeGeometry(1.3,9,16,1,true),additive('#fff2b0',.22));beam.rotation.z=Math.PI/2;beam.position.x=4.5;
        const pivot=new THREE.Group();pivot.name='beam';pivot.position.y=4;pivot.add(beam);g.add(pivot);}
      return g;}
    if(kind==='camp'){const tent=inked(new THREE.ConeGeometry(.9,1.3,4),toon('#e6cfa3'),.04);tent.position.y=.65;tent.rotation.y=Math.PI/4;g.add(tent);
      const fire=new THREE.Mesh(new THREE.ConeGeometry(.15,.4,8),glow('#ff9a3d',2.2));fire.position.set(1.1,.25,.4);g.add(fire);
      const logs=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.5,6),toon('#7a4e32'));logs.rotation.z=Math.PI/2;logs.position.set(1.1,.05,.4);g.add(logs);
      const light=new THREE.PointLight('#ff9a3d',2,5,1.5);light.position.set(1.1,.6,.4);g.add(light);}
    else if(kind==='ruin'){for(let i=0;i<6;i++){const a=i/6*Math.PI*2,h=.6+((i*7)%3)*.35;const st=inked(new THREE.BoxGeometry(.3,h,.3),toon('#b8b2a4'),.03);st.position.set(Math.cos(a)*1.1,h/2,Math.sin(a)*1.1);st.rotation.y=a;g.add(st);}
      const core=new THREE.Mesh(new THREE.OctahedronGeometry(.18),glow('#ff9ec4',1.8));core.position.y=.6;g.add(core);}
    else{const pillar=inked(new THREE.CylinderGeometry(.25,.32,1.6,8),toon('#9aa6b8'),.03);pillar.position.y=.8;g.add(pillar);
      const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.22,1),glow('#9fe0ff',2.2));orb.position.y=1.85;g.add(orb);}
    return g;
  }
  private ensurePlayer(){
    const l=this.hooks.playerLook(),c=this.hooks.playerCostume?.()??{head:null,back:null};
    const look:CharLook={outfit:l.outfit,hair:l.hair,hairColor:l.hairColor,weapon:l.weapon,weaponStyle:l.weaponStyle,refine:l.refine,headgear:l.headgear,armorStyle:l.armorStyle,costumeHead:c.head,costumeBack:c.back};
    const key=JSON.stringify(look);if(key===this.playerKey&&this.player)return;
    this.playerKey=key;if(this.player){this.engine.scene.remove(this.player.root);this.player.dispose();}
    this.player=new VrmHero(vrmLookFrom(look,hairColors[0]));this.engine.scene.add(this.player.root);
  }
  // ———————————————————————— companion, mount, emotes (v4.3) ————————————————————————
  private allyView:{hero:VrmHero;role:CompanionRole;tag:Tag;yaw:number;cast:string}|null=null;
  private mountView:{model:MonsterModel;id:string;halo:THREE.Object3D|null;top:number}|null=null;
  /** Starts an emote on the player (visual only). */
  emote(id:string){return this.player?.playEmote(id)??false;}
  private ensureAlly(){
    const a=this.world.ally,role=a?.role??null,playerCast=this.player?.look.cast;
    const def=role?companions[role]:null,cast=def?(def.avatars.find(c=>c!==playerCast)??def.avatars[0]):'';
    if(this.allyView&&this.allyView.role===role&&this.allyView.cast===cast)return;
    if(this.allyView){this.engine.scene.remove(this.allyView.hero.root);this.allyView.hero.dispose();this.overlay.remove(this.allyView.tag);this.allyView=null;}
    if(!a||!def)return;
    const hero=new VrmHero({cast:cast as VrmCast,weapon:def.weapon,job:def.job,hairColor:def.hair});
    hero.root.position.set(a.x,0,a.y);this.engine.scene.add(hero.root);
    const tag=this.overlay.tag('','ov-ally',0);
    this.allyView={hero,role:a.role,tag,yaw:0,cast};
  }
  private syncAlly(dt:number){
    const v=this.allyView,a=this.world.ally;if(!v||!a)return;
    const al=this.world.alpha,x=a.px+(a.x-a.px)*al,z=a.py+(a.y-a.py)*al;v.hero.root.position.set(x,0,z);
    const speed=Math.hypot(a.x-a.px,a.y-a.py)*60,since=this.world.time-a.attackAt;
    let pose:CharPose='idle',act=0;
    if(a.dead)pose='dead';else if(since<.45){pose=a.role==='priest'?'cast':'attack';act=since/.45;}else if(speed>.4)pose='walk';
    let want=v.yaw;const tgt=a.targetId!==null?this.world.monsters.find(m=>m.id===a.targetId):undefined;
    if(speed>.4)want=Math.atan2(a.x-a.px,a.y-a.py);else if(tgt)want=Math.atan2(tgt.x-a.x,tgt.y-a.y);
    v.yaw=lerpAngle(v.yaw,want,1-Math.pow(.002,dt));v.hero.root.rotation.y=v.yaw;v.hero.moveSpeed=speed;
    v.hero.animate(pose,this.time,0,act);
    const def=companions[a.role],hp=Math.max(0,Math.min(1,a.hp/a.maxHp));
    this.setHTML(v.tag.el,`<div class="ov-name ally">${def.title}・${def.name} <small>Lv.${a.level}</small></div><div class="ov-bars"><i class="${hp<.25?'low':''}"><b style="width:${(hp*100).toFixed(1)}%"></b></i></div>`);
    v.tag.pos.set(x,0,z);v.tag.offsetY=26;v.tag.visible=!a.dead||Math.floor(this.time*2)%2===0;
  }
  /** The giant jelly steed under the player while riding. */
  private syncMount(x:number,z:number,yaw:number,moving:boolean){
    const id=this.hooks.playerMount?.()??null;
    if((this.mountView?.id??null)!==id){
      if(this.mountView){this.engine.scene.remove(this.mountView.model.root);this.mountView=null;}
      const def=id?mounts[id]:null;
      if(def){const model=new MonsterModel({kind:def.kind??'jelly',body:def.body,accent:def.accent,scale:def.scale??1.25,crown:def.crown});
        let halo:THREE.Object3D|null=null;
        if(def.wings){const g=new THREE.Group();for(const s of [-1,1]){const w=new THREE.Mesh(new THREE.SphereGeometry(.28,16,10),toon('#ffffff',{emissive:'#fff6d8',emissiveIntensity:.3}));w.scale.set(.25,.9,1.6);w.position.set(s*.45,.62,-.12);w.rotation.z=s*.6;g.add(w);}
          const ring=new THREE.Mesh(new THREE.TorusGeometry(.3,.03,8,32),glow('#ffe26b',2.2));ring.rotation.x=Math.PI/2;ring.position.y=2.35;g.add(ring);model.root.add(g);halo=g;}
        if(def.horns){const g=new THREE.Group();g.name='horns';for(const sx of [-1,1]){const h=new THREE.Mesh(new THREE.ConeGeometry(.09,.42,8),toon('#ffd45c',{emissive:'#ff9a3d',emissiveIntensity:.35}));h.position.set(sx*.22,0,.18);h.rotation.set(-.5,0,sx*.35);g.add(h);}
          const tail=new THREE.Mesh(new THREE.ConeGeometry(.12,.8,8),toon(def.body));tail.position.set(0,-.55,-.62);tail.rotation.x=-1.9;g.add(tail);model.root.add(g);halo=null;
          model.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(model.body);g.position.y=b.max.y-.05;tail.position.y=-(b.max.y-.05)+.55;}
        model.animate('idle',0,0);model.root.updateMatrixWorld(true);let top=0;model.body.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&!m.parent?.userData.crown){m.geometry.computeBoundingBox();top=Math.max(top,m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld).max.y);}});
        top=Math.min(top,def.kind&&def.kind!=='jelly'?2.4:1.1);
        this.engine.scene.add(model.root);this.mountView={model,id:id!,halo,top};
        this.particles.emit(x,.4,z,{count:40,color:[def.body,'#ffffff'],speed:3,up:3,life:.7,size:.3,gravity:-4});
      }
    }
    const mv=this.mountView;if(!mv)return 0;
    mv.model.root.position.set(x,0,z);mv.model.root.rotation.y=yaw;mv.model.animate(moving?'move':'idle',this.time,this.time*9);
    if(mv.halo)mv.halo.children.forEach((c,i)=>{if(i<2)c.rotation.y=Math.sin(this.time*8)*.4*(i?1:-1);});
    const bounce=moving?Math.abs(Math.sin(this.time*9))*.1:0;
    return mv.top+bounce;
  }
  private ensurePet(){
    const id=this.hooks.playerPet?.()??null;
    if((this.pet?.id??null)===id)return;
    if(this.pet){this.engine.scene.remove(this.pet.model.root);this.pet=null;}
    if(!id)return;
    const art=petArt(id);if(!art)return;
    const model=new MonsterModel({...art,scale:art.scale*.6});const p=this.world.player;
    const pos=new THREE.Vector3(p.x-.8,0,p.y+.4);model.root.position.copy(pos);this.engine.scene.add(model.root);
    this.pet={model,id,pos,yaw:0,walk:0};
  }

  // ———————————————————————— input ————————————————————————
  private onDown(e:PointerEvent){
    const P=this.pointer;P.x=e.offsetX;P.y=e.offsetY;P.downX=e.offsetX;P.downY=e.offsetY;P.dragged=false;
    if(e.button===2){P.right=true;return;}
    if(e.button!==0||this.hooks.inputBlocked())return;
    (document.activeElement as HTMLElement|null)?.blur?.();
    P.left=true;P.downAt=performance.now();P.holdAt=P.downAt;
    if(this.targeting){
      const sk=skills[this.targeting];let ok=false;
      if(sk.target==='ground'){const w=this.groundAt(P.x,P.y);if(w)ok=this.world.useSkill(this.targeting,null,w);}
      else{const m=this.monsterAt(P.x,P.y);if(m)ok=this.world.useSkill(this.targeting,m.id,null);else this.say('請選擇魔物目標','info');}
      if(ok)this.targeting=null;this.hooks.onTargetingEnd();P.left=false;return;
    }
    this.hooks.onManualInput?.();
    const lm=this.landmarkViews.find(l=>this.near(l.x,.8,l.y,P.x,P.y,60));
    const ch=this.world.chests.find(c=>this.near(c.x,.4,c.y,P.x,P.y,40));if(ch){this.world.openChest(ch.id);P.left=false;return;}
    if(lm){this.hooks.onInspectLandmark?.(lm.name,lm.text,lm.key);P.left=false;return;}
    // v6.2: an item right under the cursor wins over a monster standing next to it; the click area is larger.
    const close=this.itemAt(P.x,P.y,14);if(close){this.world.pickUp(close.id);P.left=false;return;}
    // v6.4: melee needs to click right on a body — a click landing close to one counts as clicking it.
    const melee=!this.world.derived.ranged&&this.world.derived.weaponType!=='staff';
    const m=this.monsterAt(P.x,P.y)??(melee?this.nearCursor(45):null);if(m){this.world.attack(m.id);P.left=false;return;}
    const it=this.itemAt(P.x,P.y);if(it){this.world.pickUp(it.id);P.left=false;return;}
    const n=this.npcs.find(n=>this.near(n.x,.9,n.y,P.x,P.y,46));if(n){this.world.talk(n.id);P.left=false;return;}
    const w=this.groundAt(P.x,P.y);if(w){this.world.moveTo(w.x,w.y);this.fx.ring(w.x,w.y,.15,.55,'#ffffff',performance.now(),.45,.06,.25);}
  }
  private onUp(e:PointerEvent){
    const P=this.pointer;
    if(e.button===2){if(P.right&&!P.dragged&&this.targeting){this.targeting=null;this.hooks.onTargetingEnd();}P.right=false;}
    if(e.button===0)P.left=false;
  }
  private onMove(e:PointerEvent){
    const P=this.pointer;const dx=e.offsetX-P.x,dy=e.offsetY-P.y;P.x=e.offsetX;P.y=e.offsetY;P.inside=true;
    if(P.right&&(e.buttons&2)){if(Math.hypot(e.offsetX-P.downX,e.offsetY-P.downY)>4)P.dragged=true;
      this.yaw-=dx*.008;this.pitch=THREE.MathUtils.clamp(this.pitch+dy*.004,.35,1.25);}
  }
  private groundAt(sx:number,sy:number):Vec|null{
    const el=this.engine.renderer.domElement;this.ndc.set(sx/el.clientWidth*2-1,-(sy/el.clientHeight)*2+1);
    this.ray.setFromCamera(this.ndc,this.engine.camera);const hit=new THREE.Vector3();
    if(!this.ray.ray.intersectPlane(this.plane,hit))return null;
    const m=this.world.map;return {x:THREE.MathUtils.clamp(hit.x,.5,m.w-.5),y:THREE.MathUtils.clamp(hit.z,.5,m.h-.5)};
  }
  private pt={x:0,y:0,behind:false};private tmp=new THREE.Vector3();
  private near(x:number,h:number,z:number,sx:number,sy:number,px:number){
    this.overlay.project(this.tmp.set(x,h,z),this.engine.camera,this.pt);
    return !this.pt.behind&&Math.hypot(this.pt.x-sx,this.pt.y-sy)<px*(12.5/this.dist);
  }
  /** Monster under the cursor, precise: a ray against each monster's solid meshes (glows, halos, additive or
   *  see-through parts and the empty ground under floating monsters never count). Nearest hit wins. Only when the
   *  ray misses everything, a tiny screen-space fallback (14px at default zoom) keeps very small/far monsters clickable. */
  monsterAt(sx:number,sy:number):Monster|null{
    const el=this.engine.renderer.domElement;this.ndc.set(sx/el.clientWidth*2-1,-(sy/el.clientHeight)*2+1);
    this.ray.setFromCamera(this.ndc,this.engine.camera);
    let best:Monster|null=null,bd=Infinity;
    for(const m of this.world.monsters){if(m.state==='dead')continue;const v=this.mons.get(m.id);if(!v)continue;
      for(const h of this.ray.intersectObject(v.model.root,true)){
        const o=h.object as THREE.Mesh;if(!o.visible||!(o as THREE.Mesh).isMesh)continue;
        const mats=Array.isArray(o.material)?o.material:[o.material];
        if(mats.some(mt=>!mt||mt.blending===THREE.AdditiveBlending||(mt.transparent&&mt.opacity<.85)||mt.depthWrite===false))continue;
        if(h.distance<bd){bd=h.distance;best=m;}break;}}
    if(best)return best;
    const k=12.5/this.dist;let near:Monster|null=null,nd=14*k;
    for(const m of this.world.monsters){if(m.state==='dead')continue;const v=this.mons.get(m.id);if(!v)continue;const rp=v.model.root.position;
      this.overlay.project(this.tmp.set(rp.x,v.model.height*.5,rp.z),this.engine.camera,this.pt);if(this.pt.behind)continue;
      const d=Math.hypot(this.pt.x-sx,this.pt.y-sy);if(d<nd){nd=d;near=m;}}
    return near;
  }

  private itemAt(sx:number,sy:number,px=32):GroundItem|null{let best:GroundItem|null=null,bd=Infinity;
    for(const it of this.world.items){this.overlay.project(this.tmp.set(it.x,.3,it.y),this.engine.camera,this.pt);if(this.pt.behind)continue;const d=Math.hypot(this.pt.x-sx,this.pt.y-sy);if(d<px*(12.5/this.dist)&&d<bd){bd=d;best=it;}}
    return best;}
  hovered():Monster|null{return this.pointer.inside?this.monsterAt(this.pointer.x,this.pointer.y):null;}
  /** v4.9 aim assist for single-target skills: the monster whose on-screen body (feet→head) is closest to the cursor,
   *  within a generous radius. null when the cursor is far from every monster. */
  nearCursor(radius=80):Monster|null{
    if(!this.pointer.inside)return null;const sx=this.pointer.x,sy=this.pointer.y,k=12.5/this.dist,R=radius*k;
    let best:Monster|null=null,bd=R;
    for(const m of this.world.monsters){if(m.state==='dead')continue;const v=this.mons.get(m.id);if(!v)continue;const rp=v.model.root.position;
      this.overlay.project(this.tmp.set(rp.x,0,rp.z),this.engine.camera,this.pt);if(this.pt.behind)continue;const fx=this.pt.x,fy=this.pt.y;
      this.overlay.project(this.tmp.set(rp.x,v.model.height,rp.z),this.engine.camera,this.pt);const hy=this.pt.y;
      const cy=Math.max(hy,Math.min(fy,sy)),d=Math.hypot(sx-fx,sy-cy);if(d<bd){bd=d;best=m;}}
    return best;
  }
  cursorWorld():Vec{return this.groundAt(this.pointer.x,this.pointer.y)??{x:this.world.player.x,y:this.world.player.y};}
  setNavigation(target:{x:number;y:number;label:string}){this.navigation=target;}
  clearNavigation(){this.navigation=null;if(this.navObj){this.engine.scene.remove(this.navObj);this.navObj=null;}}
  private say(text:string,cls:string){const p=this.world.player;this.overlay.float(new THREE.Vector3(p.x,2.2,p.y),this.engine.camera,text,cls);}

  // ———————————————————————— frame ————————————————————————
  // Adaptive quality: watch real frame times and step the renderer down (or back up) to hold ~60fps.
  private perf={sum:0,n:0,cool:0};
  /** v4.9 graphics setting: 'auto' adapts; high/mid/low pin the level. */
  graphics:'auto'|'high'|'mid'|'low'='auto';
  setGraphics(mode:'auto'|'high'|'mid'|'low'){
    this.graphics=mode;const e=this.engine;if(!e)return; // applied again once the engine exists (mount)
    if(mode!=='auto'){e.setLevel(mode==='high'?2:mode==='mid'?1:0);return;}
    // Big high-DPI canvases start at medium; auto mode upgrades later if frames are fast.
    const px=innerWidth*innerHeight*Math.min(devicePixelRatio,2)**2;if(px>4e6&&e.level>1)e.setLevel(1);
    this.perf={sum:0,n:0,cool:0};this.allowUpgrade=true;
  }
  private adapt(dt:number){
    // Only skip real hiccups (tab switch, breakpoints): genuinely slow frames MUST count, or a struggling PC never steps down.
    const P=this.perf;if(this.graphics!=='auto'||document.hidden||fxState.overlay||dt>=.5)return;P.sum+=Math.min(dt,.25);P.n++;P.cool=Math.max(0,P.cool-dt);
    if(P.n<60&&P.sum<3)return;const avg=P.sum/P.n;P.sum=0;P.n=0;if(P.cool>0)return;
    const e=this.engine;if(avg>1/20&&e.level>0){e.setLevel(0);P.cool=4;}
    else if(avg>1/48&&e.level>0){e.setLevel(e.level-1);P.cool=4;}
    else if(avg<1/70&&e.level<2&&this.allowUpgrade){e.setLevel(e.level+1);P.cool=12;this.allowUpgrade=false;}
  }
  private allowUpgrade=true;
  private frame(dt:number){
    this.adapt(dt);
    if(!this.world?.map||!this.worldView)return;
    const now=performance.now(),blocked=this.hooks.inputBlocked();
    const P=this.pointer;
    if(!blocked&&P.left&&now-P.downAt>180&&now-P.holdAt>110){const w=this.groundAt(P.x,P.y);if(w)this.world.moveTo(w.x,w.y);P.holdAt=now;}
    if(blocked&&!this.wasBlocked)this.resetPresentation();this.wasBlocked=blocked;
    if(!blocked){
      this.presentation.advance(dt);
      const ev=this.world.step(dt),p=this.world.player;
      if(ev.some(e=>e.t==='death'||e.t==='castEnd'&&!e.ok))this.hooks.onPresentationReset?.();
      this.presentation.enqueue(ev,{weaponType:this.world.derived.weaponType,ranged:this.world.derived.ranged,
        attackCadence:Math.max(.28,p.attackTimer-p.attackAt),skillCadence:Math.max(.1,p.afterCastUntil-p.attackAt)});
      const visible=this.presentation.drain();
      if(visible.length){this.play(visible);this.hooks.onPresentationEvents?.(visible);}
      if(ev.length)this.hooks.onEvents(ev);
    }
    this.time+=dt;
    this.engine.dayTime=(this.engine.dayTime+dt/600)%1;this.engine.applyLight();
    for(const lv of this.landmarkViews){const b=lv.obj.getObjectByName('beam');if(b)b.rotation.y=this.time*.6;}
    // v6.2 烈焰附刃: a few embers trail from the weapon hand while the blade burns (cheap particles only).
    {const p=this.world.player;if(p.enchant&&p.enchant.until>this.world.time&&Math.random()<.6){const a=this.world.alpha,x=p.px+(p.x-p.px)*a,z=p.py+(p.y-p.py)*a,f=p.facing*Math.PI/4;
      this.particles.emit(x+Math.cos(f)*.35,.9+Math.random()*.4,z+Math.sin(f)*.35,{count:2,color:['#ff9a3d','#ffd45c'],speed:.4,up:1.2,life:.45,size:.2,gravity:0});}}
    if(this.keyed.size){const p=this.world.player,a=this.world.alpha,x=p.px+(p.x-p.px)*a,z=p.py+(p.y-p.py)*a,t=performance.now();
      for(const [key,k] of this.keyed){if(k.list.every(ef=>t-ef.born>=ef.dur*1000)){this.keyed.delete(key);continue;}if(k.follow)for(const ef of k.list){ef.obj.position.x=x;ef.obj.position.z=z;}}}
    this.frameNo++;this.ensurePlayer();this.ensurePet();this.ensureAlly();this.syncPlayer(dt);this.syncAlly(dt);this.syncPet(dt);this.syncNpcs();this.syncMonsters(dt);this.syncLoot();this.syncChests();this.syncTargeting();this.syncNav();
    this.weather(dt);
    this.worldView.update(this.time,this.engine.night);
    this.particles.update(dt,this.time);this.fx.update(now);
    // Camera follows the player smoothly; right-drag rotates, wheel zooms.
    const p=this.world.player,a=this.world.alpha,px=p.px+(p.x-p.px)*a,pz=p.py+(p.y-p.py)*a;
    this.focus.lerp(this.tmp.set(px,0,pz),1-Math.pow(.0008,dt));
    const cam=this.engine.camera,cp=Math.cos(this.pitch),sh=this.shake>0?(Math.random()-.5)*this.shake:0;this.shake=Math.max(0,this.shake-dt*.8);
    cam.position.set(this.focus.x+Math.sin(this.yaw)*cp*this.dist+sh,Math.sin(this.pitch)*this.dist+.8,this.focus.z+Math.cos(this.yaw)*cp*this.dist+sh);
    cam.lookAt(this.focus.x,.9,this.focus.z);
    this.particles.setScale(this.engine.renderer.domElement.clientHeight*.9);
    this.engine.follow(this.focus);
    this.hover();
    updateOcclusionFade(this.engine.renderer,cam,px,pz,this.dist);
    if(!fxState.overlay||this.frameNo%3===0)this.engine.render();this.overlay.update(cam);
  }
  cancelCombatPresentation(){this.resetPresentation();}
  private resetPresentation(){this.presentation.reset();this.presentedHits.clear();this.hooks?.onPresentationReset?.();}
  private syncPlayer(dt:number){
    const w=this.world,pl=w.player,ch=this.player!,a=w.alpha;
    const x=pl.px+(pl.x-pl.px)*a,z=pl.py+(pl.y-pl.py)*a;
    ch.root.position.set(x,0,z);
    const speed=Math.hypot(pl.vx,pl.vy);
    let pose:CharPose='idle',act=0;const action=this.presentation.action();
    const riding=!!this.hooks.playerMount?.()&&!pl.dead;
    if(pl.dead)pose='dead';else if(riding&&!pl.cast&&!action)pose='ride' as CharPose;else if(pl.sitting)pose='sit';else if(pl.cast)pose='cast';
    else if(action){pose='attack';act=action.progress;}
    else if(performance.now()<this.hurtUntil)pose='hurt';
    else if(speed>.5){pose='walk';this.walkPhase+=dt*speed*2.6;}
    const fa=pl.facing*Math.PI/4,want=Math.atan2(Math.cos(fa),Math.sin(fa));
    this.playerYaw=lerpAngle(this.playerYaw,want,1-Math.pow(.0005,dt));ch.root.rotation.y=this.playerYaw;
    const seat=this.syncMount(x,z,this.playerYaw,speed>.5);ch.root.position.y=0;
    ch.moveSpeed=speed;ch.animate(pose,this.time,this.walkPhase,act,pose==='attack'&&!!action);
    // Seat the rider: put the hips just below the jelly's top so they sink in a little.
    if(riding&&seat){const h=ch.hipsWorld();if(h){ch.root.position.y=seat-.12-h.y;ch.root.position.x+=x-h.x;ch.root.position.z+=z-h.z;}}
    // Labels: name + HP/SP under the feet, cast bar above.
    const d=w.derived,hp=Math.max(0,Math.min(1,pl.hp/d.maxHp)),sp=Math.max(0,Math.min(1,pl.sp/d.maxSp));
    this.setHTML(this.playerTag.el,`<div class="ov-name">${esc(this.hooks.playerName())}</div><div class="ov-bars"><i class="${hp<.25?'low':''}"><b style="width:${(hp*100).toFixed(1)}%"></b></i><i class="sp"><b style="width:${(sp*100).toFixed(1)}%"></b></i></div>`);
    this.playerTag.pos.set(x,0,z);this.playerTag.offsetY=26;
    if(pl.cast){
      const k=1-pl.cast.remaining/pl.cast.total,sk=skills[pl.cast.skill];
      this.castTag.visible=true;this.castTag.pos.set(x,2.05,z);this.setHTML(this.castTag.el,`${sk.name} Lv.${pl.cast.lv}<i><b style="width:${(k*100).toFixed(0)}%"></b></i>`);
      const col=elementHex[sk.element]??'#bfa2ff';
      if(!this.castRune){this.castRune=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6),additive(col,.95,rune(col)));this.castRune.rotation.x=-Math.PI/2;this.engine.scene.add(this.castRune);}
      this.castRune.position.set(x,.06,z);this.castRune.rotation.z+=dt*1.2;this.castRune.scale.setScalar(.6+k*.5);
      if(Math.random()<.6)this.particles.emit(x+(Math.random()-.5)*1.4,.1,z+(Math.random()-.5)*1.4,{count:1,color:col,speed:.2,up:1.6,life:.9,size:.18,gravity:0,spread:.2});
    }else{this.castTag.visible=false;if(this.castRune){this.engine.scene.remove(this.castRune);this.castRune=null;}}
    if(pl.shields.length&&Math.random()<.3)this.particles.emit(x,1,z,{count:1,color:'#9fe0ff',speed:.6,up:.2,life:.6,size:.16,gravity:0,radius:.5});
  }
  private syncPet(dt:number){
    if(!this.pet)return;const pt=this.pet,pl=this.world.player;
    const target=this.tmp.set(pl.x-Math.sin(this.playerYaw)*.9+Math.cos(this.playerYaw)*.5,0,pl.y-Math.cos(this.playerYaw)*.9-Math.sin(this.playerYaw)*.5);
    const d=target.distanceTo(pt.pos);let pose:MonPose='idle';
    if(d>.25){const step=Math.min(d,dt*(d>3?7:3.2));const dir=target.clone().sub(pt.pos).normalize();pt.pos.addScaledVector(dir,step);pt.yaw=lerpAngle(pt.yaw,Math.atan2(dir.x,dir.z),.2);pt.walk+=step*5;pose='move';}
    if(d>12)pt.pos.copy(target);
    pt.model.root.position.copy(pt.pos);pt.model.root.rotation.y=pt.yaw;pt.model.animate(pose,this.time,pt.walk);
    if(Math.random()<.004)this.overlay.float(pt.pos.clone().setY(1),this.engine.camera,'♥','heal');
  }
  private syncNpcs(){
    // Frustum-cull townsfolk: off-screen NPCs neither draw nor tick their spring bones.
    const cam=this.engine.camera;this.frustum.setFromProjectionMatrix(this.projView.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));
    for(const n of this.npcs){this.cullSphere.center.set(n.x,.9,n.y);const vis=this.frustum.intersectsSphere(this.cullSphere);n.chibi.root.visible=vis;
      if(!vis&&(this.frameNo+n.x)%8>.5)continue;n.chibi.animate('idle');n.tag.offsetY=24;
    const p=this.world.player,dx=p.x-n.x,dz=p.y-n.y;if(dx*dx+dz*dz<16)n.chibi.root.rotation.y=lerpAngle(n.chibi.root.rotation.y,Math.atan2(dx,dz),.08);}}
  private syncMonsters(dt:number){
    const w=this.world,live=new Set<number>(),a=w.alpha,target=w.player.target?.kind==='monster'?w.player.target.id:null,hov=this.hovered()?.id??null;
    for(const m of w.monsters){
      let v=this.mons.get(m.id);
      if(m.state==='dead'){
        if(v&&this.presentation.pendingImpact(m.id)){live.add(m.id);continue;}
        if(v){live.add(m.id);if(!v.deadAt){v.deadAt=performance.now();v.bar.visible=false;v.name.visible=false;}
          const k=(performance.now()-v.deadAt)/450;v.model.root.scale.setScalar(Math.max(.01,1-k));v.model.root.position.y=-k*.2;v.model.animate('hurt',this.time,0);
          if(k>=1){this.dropMonster(v);this.mons.delete(m.id);this.presentedHits.delete(m.id);live.delete(m.id);}}
        continue;
      }
      live.add(m.id);
      if(v&&v.deadAt){this.dropMonster(v);this.mons.delete(m.id);v=undefined;}
      // v5.1: a monster whose look changed (黃金魔物, back to normal) is rebuilt so the new colours/name show at once.
      if(v&&v.art!==m.def.art){this.dropMonster(v);this.mons.delete(m.id);v=undefined;}
      if(!v){
        const model=new MonsterModel(m.def.art);this.engine.scene.add(model.root);
        const bar=this.overlay.tag('',`ov-bars mon${m.def.mvp?' mvp':''}`,0);const name=this.overlay.tag(`<div class="ov-name${m.def.mvp?' mvp':''}${m.invasion?' invader':''}${m.elite?' elite':''}">${m.def.mvp?'👑 ':m.invasion?'⚔ 進攻・':''}${m.def.name} Lv.${m.def.level}</div>`,'',0);
        v={model,bar,name,walk:0,last:{x:m.x,y:m.y},yaw:Math.random()*6,deadAt:0,spawnAt:performance.now(),art:m.def.art};this.mons.set(m.id,v);
        this.particles.emit(m.x,.2,m.y,{count:10,color:'#ffffff',speed:1.2,up:1,life:.5,size:.3});
      }
      const x=m.px+(m.x-m.px)*a,z=m.py+(m.y-m.py)*a,moved=Math.hypot(x-v.last.x,z-v.last.y);v.walk+=moved*6;
      let want=v.yaw;if(moved>.002)want=Math.atan2(x-v.last.x,z-v.last.y);else if(m.state==='chase')want=Math.atan2(w.player.x-x,w.player.y-z);
      v.yaw=lerpAngle(v.yaw,want,1-Math.pow(.002,dt));v.last={x,y:z};
      const grow=Math.min(1,(performance.now()-v.spawnAt)/350);
      v.model.root.position.set(x,0,z);v.model.root.rotation.y=v.yaw;v.model.root.scale.setScalar(grow);
      let pose:MonPose=moved>.002?'move':'idle',act=0;
      if(w.time-m.attackAt<.4){pose='attack';act=(w.time-m.attackAt)/.4;}
      if(performance.now()-(this.presentedHits.get(m.id)??-Infinity)<160)pose='hurt';
      if(m.frozenUntil>w.time||m.stunUntil>w.time)pose='hurt';
      v.model.animate(pose,this.time+m.id,v.walk,act);
      // v4.4 element-loop states beside the HP bar: 灼燒 stacks, 寒氣 stacks, 寒冰印記 seconds, 感電 + Charge.
      const el=m.el,now=w.time,st:string[]=[];
      if(el){if(el.burn&&el.burn.until>now)st.push(`<em class="st burn">🔥${el.burn.stacks}</em>`);
        if(el.chill&&el.chill.until>now)st.push(`<em class="st chill">❄${el.chill.stacks}</em>`);
        if(el.mark&&el.mark.until>now)st.push(`<em class="st mark">◆${Math.ceil(el.mark.until-now)}</em>`);
        if(el.shockUntil>now)st.push(`<em class="st shock">⚡${el.charge}/4</em>`);}
      if(w.prey&&w.prey.id===m.id){st.push(`<em class="st prey">🎯${Math.ceil(w.prey.until-now)}</em>`);if(Math.random()<.35)this.particles.emit(x+Math.cos(this.time*3)*.7,.08,z+Math.sin(this.time*3)*.7,{count:1,color:'#ff6b6b',speed:0,up:.05,life:.4,size:.18,gravity:0});}
      const hp=m.hp/m.maxHp,show=m.def.mvp||hp<1||hov===m.id||target===m.id||st.length>0;
      v.bar.visible=show;v.bar.pos.set(x,v.model.height+.25,z);this.setHTML(v.bar.el,`<i><b style="width:${Math.max(0,hp*100).toFixed(1)}%"></b></i>${st.length?`<div class="sts">${st.join('')}</div>`:''}`);
      v.name.visible=m.def.mvp||!!m.invasion||!!m.elite||hov===m.id||target===m.id;
      if(m.elite&&Math.random()<.3)this.particles.emit(x,.15,z,{count:1,color:['#c070ff','#ffd45c'],speed:.5,up:1.3,life:.7,size:.24,gravity:0,radius:.6});
      if(m.invasion&&Math.random()<.25)this.particles.emit(x,.1,z,{count:1,color:['#ff4a3a','#ff9a3d'],speed:.4,up:1,life:.6,size:.22,gravity:0,radius:.5});v.name.pos.set(x,v.model.height+.25,z);v.name.offsetY=-14;
      // Status sparkles.
      if(m.frozenUntil>w.time&&Math.random()<.3)this.particles.emit(x,.5,z,{count:1,color:'#cff0ff',speed:.3,up:.4,life:.6,size:.2,gravity:0,radius:.4});
      if(m.stunUntil>w.time&&Math.random()<.4){const ang=this.time*6;this.particles.emit(x+Math.cos(ang)*.35,v.model.height+.15,z+Math.sin(ang)*.35,{count:1,color:'#ffe26b',speed:.05,up:0,life:.3,size:.22,gravity:0});}
      if(m.dots.some(d=>d.until>w.time)&&Math.random()<.2)this.particles.emit(x,.6,z,{count:1,color:'#b07ad9',speed:.2,up:.8,life:.6,size:.18,gravity:0});
      if(target===m.id){if(Math.random()<.5)this.particles.emit(x+Math.cos(this.time*4)*.6,.05,z+Math.sin(this.time*4)*.6,{count:1,color:'#ffd45c',speed:0,up:.05,life:.35,size:.15,gravity:0});}
      if(m.def.mvp&&Math.random()<.3)this.particles.emit(x,.1,z,{count:1,color:['#ff6b9a','#ffd45c'],speed:.6,up:1.4,life:1,size:.25,gravity:0,radius:1});
    }
    for(const [id,v] of this.mons)if(!live.has(id)){this.dropMonster(v);this.mons.delete(id);}
  }
  private dropMonster(v:MonView){this.engine.scene.remove(v.model.root);this.overlay.remove(v.bar);this.overlay.remove(v.name);}
  /** v4.6 treasure chests: built once per chest, a soft bob + spinning gem on rare/trial chests (no extra lights). */
  private syncChests(){
    const present=new Set<number>();
    for(const c of this.world.chests){
      present.add(c.id);let v=this.chestViews.get(c.id);
      if(!v){const obj=this.chestModel(c.tier),gem=obj.getObjectByName('gem')??null;obj.position.set(c.x,0,c.y);obj.rotation.y=Math.PI/4;this.engine.scene.add(obj);
        const label={normal:'寶箱',rare:'★ 稀有寶箱',trial:'✦ 試煉寶箱',supply:'補給箱',eclipse:'🌑 星蝕寶箱'}[c.tier];
        const tag=this.overlay.tag(`<div class="ov-name chest ${c.tier}">${label}</div>`,'',8);tag.pos.set(c.x,1.1,c.y);
        v={obj,tag,gem};this.chestViews.set(c.id,v);}
      if(v.gem){v.gem.rotation.y=this.time*2;v.gem.position.y=1.05+Math.sin(this.time*2.4+c.id)*.08;}
    }
    for(const [id,v] of this.chestViews)if(!present.has(id)){this.fx.ring(v.obj.position.x,v.obj.position.z,.2,1.2,'#ffe27a',performance.now(),.5,.08,.3);this.engine.scene.remove(v.obj);this.overlay.remove(v.tag);this.chestViews.delete(id);}
  }
  /** One prototype per tier; every chest is a clone that shares its geometry and materials (never disposed). */
  private chestProtos=new Map<string,THREE.Group>();
  private chestModel(tier:'normal'|'rare'|'trial'|'supply'|'eclipse'):THREE.Group{
    let proto=this.chestProtos.get(tier);if(!proto){proto=this.buildChest(tier);this.chestProtos.set(tier,proto);}
    return proto.clone(true);
  }
  private buildChest(tier:'normal'|'rare'|'trial'|'supply'|'eclipse'){
    const g=new THREE.Group(),wood={normal:'#9a6a3e',rare:'#c8902a',trial:'#5a4aa0',supply:'#7d8a5a',eclipse:'#4a1a2a'}[tier],band=tier==='normal'||tier==='supply'?'#c9b37a':'#ffe27a';
    const body=inked(new THREE.BoxGeometry(.62,.36,.42),toon(wood),.03);body.position.y=.18;g.add(body);
    const lid=inked(new THREE.CylinderGeometry(.21,.21,.62,10,1,false,0,Math.PI),toon(wood),.03);lid.rotation.z=Math.PI/2;lid.rotation.y=Math.PI/2;lid.position.y=.36;g.add(lid);
    for(const x of [-.22,.22]){const b=new THREE.Mesh(new THREE.BoxGeometry(.06,.38,.44),toon(band));b.position.set(x,.19,0);g.add(b);}
    const lock=new THREE.Mesh(new THREE.BoxGeometry(.1,.12,.04),toon(band));lock.position.set(0,.3,.22);g.add(lock);
    let gem:THREE.Object3D|null=null;
    if(tier==='rare'||tier==='trial'||tier==='eclipse'){gem=new THREE.Mesh(new THREE.OctahedronGeometry(.13),glow(tier==='rare'?'#ffd45c':tier==='eclipse'?'#ff4a6a':'#c9a3ff',2.4));gem.name='gem';gem.position.y=1.05;g.add(gem);
      const halo=new THREE.Mesh(new THREE.RingGeometry(.45,.6,24),additive(tier==='rare'?'#ffe27a':tier==='eclipse'?'#ff4a6a':'#c9a3ff',.45));halo.rotation.x=-Math.PI/2;halo.position.y=.02;g.add(halo);}
    g.scale.setScalar(tier==='normal'||tier==='supply'?1.35:1.5);
    return g;
  }
  private syncLoot(){
    const present=new Set<number>();
    for(const it of this.world.items){
      present.add(it.id);let l=this.loot.get(it.id);
      if(!l){
        const card=it.kind==='card';const tex=new THREE.CanvasTexture(card?cardIconCanvas():itemIconCanvas(it.defId));tex.colorSpace=THREE.SRGBColorSpace;
        const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthWrite:false}));spr.scale.setScalar(card?.7:.55);
        const g=new THREE.Group();g.add(spr);g.position.set(it.x,0,it.y);
        if(card){const beam=new THREE.Mesh(new THREE.CylinderGeometry(.18,.25,3,16,1,true),additive('#ffe27a',.6,beamTexture()));beam.position.y=1.5;g.add(beam);}
        // v6.3: quality gear shows a coloured pillar (稀有 gold, 傳說 orange and taller) so it reads from across the map.
        else if((it.q??0)>=1){const c=['','#5fb0ff','#ffd23f','#ff8a3d'][it.q!],h=it.q===3?6:it.q===2?3.5:1.6;
          const beam=new THREE.Mesh(new THREE.CylinderGeometry(.14,.22,h,16,1,true),additive(c,it.q===1?.35:.65,beamTexture()));beam.position.y=h/2;g.add(beam);}
        this.engine.scene.add(g);l={obj:g,born:performance.now(),card};this.loot.set(it.id,l);
      }
      const k=Math.min(1,(performance.now()-l.born)/500),hop=Math.sin(k*Math.PI)*.8;
      const spr=l.obj.children[0];spr.position.y=.35+hop+Math.sin(this.time*3+it.id)*.05;
      if(l.card&&Math.random()<.3)this.particles.emit(it.x,.2,it.y,{count:1,color:'#ffe27a',speed:.3,up:1.2,life:.8,size:.2,gravity:0,radius:.3});
      if((it.q??0)>=2&&Math.random()<.35)this.particles.emit(it.x,.2,it.y,{count:1,color:it.q===3?['#ff8a3d','#ffd45c']:['#ffd23f','#ffffff'],speed:.3,up:1.4,life:.8,size:.22,gravity:0,radius:.3});
    }
    for(const [id,l] of this.loot)if(!present.has(id)){this.engine.scene.remove(l.obj);this.loot.delete(id);}
  }
  private syncTargeting(){
    const sk=this.targeting?skills[this.targeting]:null;
    if(sk?.target==='ground'&&this.pointer.inside){
      const w=this.cursorWorld(),r=this.targeting==='thunderStorm'?2.5:1.6;
      if(!this.aim){this.aim=new THREE.Mesh(new THREE.RingGeometry(.92,1,48),additive('#9fe0ff',.9));this.aim.rotation.x=-Math.PI/2;this.engine.scene.add(this.aim);}
      this.aim.position.set(w.x,.07,w.y);this.aim.scale.setScalar(r);
    }else if(this.aim){this.engine.scene.remove(this.aim);this.aim=null;}
  }
  private syncNav(){
    if(!this.navigation){return;}
    const n=this.navigation,p=this.world.player;
    if(Math.hypot(p.x-n.x,p.y-n.y)<1.1){this.clearNavigation();return;}
    if(!this.navObj){this.navObj=new THREE.Group();const r=new THREE.Mesh(new THREE.RingGeometry(.5,.62,40),additive('#ffe5a1',.9));r.rotation.x=-Math.PI/2;r.position.y=.07;
      const b=new THREE.Mesh(new THREE.ConeGeometry(.18,.4,4),glow('#ffd45c',1.8));b.rotation.x=Math.PI;b.position.y=1.6;this.navObj.add(r,b);this.engine.scene.add(this.navObj);}
    this.navObj.position.set(n.x,0,n.y);this.navObj.children[1].position.y=1.5+Math.sin(this.time*3)*.15;this.navObj.children[1].rotation.y=this.time*2;
  }
  private hover(){
    if(this.hooks.inputBlocked()||!this.pointer.inside){this.hooks.onHover(null);return;}
    const el=this.engine.renderer.domElement,P=this.pointer;
    if(this.targeting){el.style.cursor='crosshair';this.hooks.onHover(`選擇${skills[this.targeting].target==='ground'?'地點':'目標'}：${skills[this.targeting].name}（右鍵取消）`);return;}
    const m=this.monsterAt(P.x,P.y);if(m){el.style.cursor='pointer';this.hooks.onHover(`⚔ 點擊攻擊：${m.def.name} Lv.${m.def.level}${m.def.mvp?' 【MVP】':''}${m.def.aggressive?' · 主動':''}`);return;}
    const it=this.itemAt(P.x,P.y);if(it){el.style.cursor='pointer';this.hooks.onHover(`✋ 點擊撿起：${it.kind==='card'?cards[it.defId].name:items[it.defId].name}`);return;}
    const n=this.npcs.find(n=>this.near(n.x,.9,n.y,P.x,P.y,46));if(n){el.style.cursor='pointer';this.hooks.onHover(`${this.world.map.def.npcs.find(x=>x.id===n.id)!.name}（點擊對話）`);return;}
    el.style.cursor=P.right?'grabbing':'default';this.hooks.onHover(null);
  }
  /** Ambient weather particles around the camera focus. */
  private weather(dt:number){
    const theme=this.world.map.def.theme,f=this.focus,night=this.engine.night;this.weatherAcc+=dt;
    const rate=theme==='cave'?40:theme==='forest'?(10+night*30):theme==='meadow'?14:theme==='ruins'?22:8;
    while(this.weatherAcc>1/rate){this.weatherAcc-=1/rate;
      const x=f.x+(Math.random()-.5)*26,z=f.z+(Math.random()-.5)*26;
      if(theme==='cave')this.particles.spawn(x,7,z,(Math.random()-.5)*.3,-.7,(Math.random()-.5)*.3,9,.12,new THREE.Color('#e8f6ff'),0,0);
      else if(theme==='forest'){if(night>.2||Math.random()<.4)this.particles.spawn(x,.3+Math.random()*2,z,(Math.random()-.5)*.3,(Math.random()-.5)*.2,(Math.random()-.5)*.3,4,.14,new THREE.Color('#d8ff8a'),0,0);
        else this.particles.spawn(x,6,z,.4,-.6,.2,9,.12,new THREE.Color('#9fd06a').multiplyScalar(.6),0,0);}
      else if(theme==='ruins')this.particles.spawn(x,.2+Math.random()*.5,z,(Math.random()-.5)*.1,.35+Math.random()*.3,(Math.random()-.5)*.1,6,.12,new THREE.Color(Math.random()<.5?'#e0c8ff':'#fff0c0'),0,0);
      else if(theme==='meadow')this.particles.spawn(x,6,z,.6,-.55,.2,10,.12,new THREE.Color(Math.random()<.5?'#ffd0e8':'#ffffff').multiplyScalar(.7),0,0);
      else this.particles.spawn(x,.4+Math.random()*2.5,z,(Math.random()-.5)*.15,.05,(Math.random()-.5)*.15,5,.08,new THREE.Color('#fff6d0').multiplyScalar(.6),0,0);
    }
    for(const fpos of this.worldView!.fountains)if(Math.random()<.8)this.particles.emit(fpos.x,fpos.y+.3,fpos.z,{count:1,color:'#cfeeff',speed:1.1,up:2.4,life:.9,size:.16,gravity:-5,spread:.3,drag:.2});
    for(const c of this.worldView!.crystals)if(Math.random()<.05)this.particles.emit(c.x,c.y,c.z,{count:1,color:'#bfe8ff',speed:.2,up:.6,life:1.2,size:.15,gravity:0,radius:.3});
  }

  // ———————————————————————— feedback ————————————————————————
  private V(x:number,y:number,z:number){return new THREE.Vector3(x,y,z);}
  private play(ev:SimEvent[]){
    const now=performance.now(),F=this.fx,Pt=this.particles,cam=this.engine.camera,w=this.world;
    for(const e of ev){
      if(e.t==='dmg'){
        if(e.to==='m'&&e.id!==undefined&&!e.miss)this.presentedHits.set(e.id,now);
        const head=this.V(e.x,(e.to==='m'?(this.mons.get(e.id??-1)?.model.height??.8):1.6)+.3,e.y);
        if(e.miss){this.overlay.float(head,cam,'Miss','miss');continue;}
        if(e.to==='a'){this.overlay.float(this.V(e.x,1.9,e.y),cam,`${e.amount}`,'hurt ally');continue;}
        if(e.to==='p'){this.hurtUntil=now+180;this.overlay.float(head,cam,`${e.amount}`,'hurt');if(e.absorbed)this.overlay.float(head.clone().setY(head.y+.4),cam,`吸收 ${e.absorbed}`,'status');this.shake=Math.max(this.shake,.12);
          Pt.emit(e.x,1,e.y,{count:8,color:'#ff7a7a',speed:2,up:1,life:.35,size:.18});continue;}
        const srcCls:Record<string,string>={venom:'venom',burn:'burn',detonate:'detonate',shatter:'shatter',shard:'shard',chain:'chainz',rebound:'chainz',strike:'strike',blast:'detonate'};
        this.overlay.float(head,cam,`${e.src==='shatter'?'碎冰 ':e.src==='detonate'?'引爆 ':e.src==='strike'?'落雷 ':''}${e.amount}`,e.crit?'crit':srcCls[e.src]??'dmg');
        const col=elementHex[e.element]??'#ffffff';
        Pt.emit(e.x,.6,e.y,{count:e.crit?22:10,color:e.crit?['#ffe26b','#ffffff']:[col,'#ffffff'],speed:e.crit?4.5:3,up:1.5,life:.35,size:e.crit?.3:.2,gravity:-6});
        if(e.crit){this.shake=Math.max(this.shake,.18);F.sphere(this.V(e.x,.6,e.y),.5,'#fff2b0',now,.18);}
      }
      else if(e.t==='heal')this.overlay.float(this.V(e.x,1.9,e.y),cam,`+${e.amount}`,e.sp?'heal sp':'heal');
      else if(e.t==='kill'){Pt.emit(e.x,.4,e.y,{count:26,color:['#ffffff','#fff2b0','#ffd0e8'],speed:3,up:2,life:.6,size:.28,gravity:-4});F.ring(e.x,e.y,.2,1.4,'#ffffff',now,.4);
        if(e.mvp){F.beam(e.x,e.y,1.2,14,'#ffd45c',now,2.2,true);Pt.emit(e.x,.5,e.y,{count:160,color:['#ffd45c','#ff9ec4','#ffffff'],speed:7,up:5,life:1.6,size:.35,gravity:-4});this.shake=.5;}}
      else if(e.t==='castStart'){}
      else if(e.t==='skill'){const el=skills[e.skill]?.element??'neutral';Pt.emit(e.from.x,1.2,e.from.y,{count:12,color:elementHex[el],speed:1.5,up:1,life:.4,size:.2,gravity:0});}
      else if(e.t==='swing'){
        if(e.who==='p'&&!w.derived.ranged&&w.derived.weaponType!=='staff'){const p=w.player,yaw=Math.atan2(e.tx-p.x,e.ty-p.y);F.slash(p.x+Math.sin(yaw)*.5,.9,p.y+Math.cos(yaw)*.5,yaw+Math.PI/2,'#fff6d8',now,.7);}
      }
      else if(e.t==='status'){const m=w.monsters.find(x=>x.id===e.id);if(m){const h=this.V(m.x,(this.mons.get(m.id)?.model.height??.8)+.6,m.y);
        if(e.kind==='freeze'){this.overlay.float(h,cam,'冰凍！','status');Pt.emit(m.x,.6,m.y,{count:20,color:['#cff0ff','#ffffff'],speed:2,up:1,life:.6,size:.25});}
        if(e.kind==='stun')this.overlay.float(h,cam,'暈眩！','info');
        if(e.kind==='mark'){this.overlay.float(h,cam,'寒冰印記','status');F.ring(m.x,m.y,.2,1,'#bfe8ff',now,.5);}
        if(e.kind==='prey'){this.overlay.float(h,cam,'🎯 獵物','status');F.ring(m.x,m.y,.2,1.3,'#ff6b6b',now,.5);}}}
      else if(e.t==='fail')this.say(e.reason,'info');
      else if(e.t==='ally'){const h=this.V(e.x,2.1,e.y);
        if(e.kind==='heal'){this.overlay.float(h,cam,'治癒術','heal');Pt.emit(e.x,.3,e.y,{count:30,color:['#9fffb0','#ffffff'],speed:1.2,up:3,life:1,size:.25,gravity:-1});F.ring(e.x,e.y,.2,1.2,'#9fffb0',now,.6);}
        else if(e.kind==='bless'){this.overlay.float(h,cam,'祝福！','status');F.beam(e.x,e.y,.6,4,'#ffe26b',now,1);Pt.emit(e.x,1,e.y,{count:24,color:['#ffe26b','#ffffff'],speed:1.5,up:2,life:.9,size:.22,gravity:-1});}
        else if(e.kind==='retreat'){this.overlay.float(h,cam,'撤退！','info');}
        else if(e.kind==='taunt'){this.overlay.float(h,cam,'挑釁怒吼！','info');F.ring(e.x,e.y,.3,4,'#ff6a5a',now,.5);this.shake=Math.max(this.shake,.08);}
        else if(e.kind==='strafe')this.overlay.float(h,cam,'二連矢！','status');
        else if(e.kind==='down')this.overlay.float(h,cam,'傭兵倒下了…（20 秒後歸隊）','miss');
        else if(e.kind==='up'){this.overlay.float(h,cam,'傭兵歸隊！','heal');F.beam(e.x,e.y,.5,3,'#ffffff',now,.8);}}
      else if(e.t==='dismount'){const p=w.player;Pt.emit(p.x,.4,p.y,{count:24,color:['#ff9ec4','#ffffff'],speed:2.5,up:2,life:.5,size:.25,gravity:-4});}
      else if(e.t==='fx')this.fxEvent(e,now);
      else if(e.t==='fxEnd'){const k=this.keyed.get(e.key);if(k){const t=performance.now();for(const ef of k.list)ef.dur=Math.max(.001,(t-ef.born)/1000);this.keyed.delete(e.key);}}
    }
  }
  /** v6.0 effects that live until the simulation ends them (zones, traps, shields). */
  private keyed=new Map<number,{list:Effect[];follow:boolean}>();
  private fxEvent(e:Extract<SimEvent,{t:'fx'}>,now:number){
    const F=this.fx,Pt=this.particles,col=elementHex[e.element??'neutral']??'#ffffff',dur=e.dur;
    const at=this.V(e.x,.6,e.y),to=e.tx!==undefined?this.V(e.tx,.7,e.ty!):at;
    const later=(ms:number,fn:()=>void)=>this.presentation.defer(ms/1000,fn);
    const keep=(list:Effect[],follow=false)=>{if(e.key!==undefined)this.keyed.set(e.key,{list,follow});};
    const ang=e.tx!==undefined?Math.atan2(e.ty!-e.y,e.tx-e.x):0,len=e.tx!==undefined?Math.hypot(e.tx-e.x,e.ty!-e.y):0;
    switch(e.kind){
      // ═══════════ v6.0 二轉 ═══════════
      case 'wheel':{const spins=Math.max(3,Math.round((dur-.2)/.16));for(let i=0;i<spins;i++)later(i*160,()=>{const t=performance.now(),pp=this.world.player;
          for(let k=0;k<3;k++){const yaw=k*Math.PI*2/3+i*.9;F.slash(pp.x+Math.sin(yaw)*1.1,.8,pp.y+Math.cos(yaw)*1.1,yaw+Math.PI/2,'#ffe9a8',t,1.3,.24);}
          F.ring(pp.x,pp.y,.5,e.r??2.5,'#ffd45c',t,.32);Pt.emit(pp.x,.6,pp.y,{count:16,color:['#ffd45c','#ffffff'],speed:4,up:.5,life:.35,size:.22,gravity:0,radius:.8});});
        this.shake=Math.max(this.shake,.1);break;}
      case 'dash':F.streak(e.x,e.y,ang,len,.9,'#ffd45c',now,.4,.5);for(let i=0;i<=10;i++){const k=i/10;Pt.emit(e.x+(e.tx!-e.x)*k,.5,e.y+(e.ty!-e.y)*k,{count:4,color:['#ffd45c','#ffffff'],speed:1.2,up:.6,life:.45,size:.25,gravity:0});}
        later(dur*1000,()=>{F.ring(e.tx!,e.ty!,.3,1.6,'#ffd45c',performance.now(),.35);this.shake=Math.max(this.shake,.16);});break;
      case 'ward':case 'veil':{const c=e.kind==='ward'?'#ffd45c':'#9fb8ff';keep([F.dome(this.V(e.x,0,e.y),(e.r??1.2)*1.1,c,now,dur),F.field(e.x,e.y,(e.r??1.2)*1.2,c,now,dur,.18)],true);
        F.ring(e.x,e.y,.2,1.6,c,now,.5);Pt.emit(e.x,.2,e.y,{count:36,color:[c,'#ffffff'],speed:1,up:2.5,life:.8,size:.24,gravity:0,radius:.8});break;}
      case 'counter':F.lightning(this.V(e.x,1,e.y),to,'#ffd45c',now,.22,.3);later(120,()=>{F.slash(e.tx!,.8,e.ty!,ang+Math.PI/2,'#fff2b0',performance.now(),.9,.25);});break;
      case 'rend':{const n=e.r??0,p=this.world.player,yaw=Math.atan2(e.x-p.x,e.y-p.y);F.slash(e.x,1,e.y,yaw+Math.PI/2,'#fff2b0',now,1.4+n*.15,.38);F.slash(e.x,.7,e.y,yaw+Math.PI/2+.6,'#ffd45c',now+60,1.2+n*.15,.34);
        F.beam(e.x,e.y,.45+n*.08,4+n,'#ffd45c',now,.45);Pt.emit(e.x,.8,e.y,{count:30+n*12,color:['#ffffff','#ffd45c','#ff9a3d'],speed:5+n,up:2,life:.5,size:.28,gravity:-6});this.shake=Math.max(this.shake,.18+n*.04);break;}
      case 'quake':if(e.key!==undefined)keep([F.field(e.x,e.y,e.r??3,'#c9a46b',now,dur,.22),F.runeCircle(e.x,e.y,e.r??3,'#e8c48a',now,dur)]);
        else{F.disc(e.x,e.y,e.r??3,'#c9a46b',now,.5,.8);F.ring(e.x,e.y,.4,(e.r??3)*1.1,'#fff2b0',now,.45);Pt.emit(e.x,.2,e.y,{count:60,color:['#c9a46b','#9a8c7b','#ffffff'],speed:5,up:3.5,life:.6,size:.3,gravity:-9,radius:(e.r??3)*.5});this.shake=Math.max(this.shake,.3);}
        break;
      case 'judgment':{const spread=(e.length??120)*Math.PI/180;F.fan(e.x,e.y,e.r??4,e.angle??0,spread,'#ffd45c',now,.55);F.fan(e.x,e.y,(e.r??4)*.8,e.angle??0,spread,'#ffffff',now+80,.4);
        for(let i=0;i<8;i++){const a=(e.angle??0)+(i/7-.5)*Math.min(spread,Math.PI*2*.95),r=(e.r??4)*.7;F.beam(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r,.25,6,'#ffe9a8',now+i*30,.5);}
        Pt.emit(e.x,.5,e.y,{count:90,color:['#ffd45c','#ffffff','#c9a3ff'],speed:6,up:3,life:.7,size:.3,gravity:-4,radius:1});this.shake=Math.max(this.shake,.35);break;}
      case 'flameZone':case 'frostZone':case 'totem':{const c=e.kind==='flameZone'?'#ff7a3d':e.kind==='frostZone'?'#7fd0ff':'#ffe26b',r=e.r??2.5;
        const list=[F.field(e.x,e.y,r,c,now,dur,e.kind==='totem'?.14:.26),F.runeCircle(e.x,e.y,r,c,now,dur)];
        if(e.kind==='totem')list.push(F.beam(e.x,e.y,.22,3.4,'#fff6a0',now,dur,true));
        keep(list);Pt.emit(e.x,.2,e.y,{count:40,color:[c,'#ffffff'],speed:2,up:1.5,life:.6,size:.25,gravity:0,radius:r*.6});break;}
      case 'zoneTick':{const c=e.element==='fire'?'#ff9a3d':e.element==='water'?'#bfe8ff':'#e8c48a';F.ring(e.x,e.y,.3,e.r??2.5,c,now,.4);
        Pt.emit(e.x,.15,e.y,{count:14,color:[c,'#ffffff'],speed:.6,up:e.element==='fire'?2.2:.8,life:.5,size:.24,gravity:e.element==='water'?2:0,radius:(e.r??2.5)*.8});break;}
      case 'ascend':F.beam(e.x,e.y,.8,7,'#9fb8ff',now,1.2,true);F.ring(e.x,e.y,.3,2.4,'#ffd45c',now,.6);F.runeCircle(e.x,e.y,2,'#9fb8ff',now,1.2);
        Pt.emit(e.x,.2,e.y,{count:60,color:['#9fb8ff','#ffd45c','#ffffff'],speed:1.5,up:4,life:1,size:.26,gravity:0,radius:1});break;
      case 'arcana':{const c=e.element==='fire'?'#ff7a3d':e.element==='water'?'#7fd0ff':'#ffe26b',r=e.r??3;F.runeCircle(e.x,e.y,r,c,now,1);F.beam(e.x,e.y,r*.4,12,c,now,.9,true);
        later(350,()=>{const t=performance.now();F.disc(e.x,e.y,r,c,t,.6,.85);F.ring(e.x,e.y,.3,r*1.2,'#ffffff',t,.5);
          Pt.emit(e.x,.3,e.y,{count:120,color:[c,'#ffffff','#ffd45c'],speed:6,up:4,life:.8,size:.32,gravity:-3,radius:r*.5});this.shake=Math.max(this.shake,.4);});break;}
      case 'snipe':F.streak(e.x,e.y,ang,len,.12,'#ffffff',now,.3,.95);F.streak(e.x,e.y,ang,len,.4,'#ffe9a8',now,.4,.95);
        F.projectile(this.V(e.x,1,e.y),to,'#ffffff',now,Math.max(1/60,dur),.1,0,undefined,'arrow');later(dur*1000,()=>{F.ring(e.tx!,e.ty!,.2,1.2,'#ffffff',performance.now(),.3);this.shake=Math.max(this.shake,.14);});break;
      case 'pierce':F.streak(e.x,e.y,ang,len,(e.r??.85)*2,'#bff5d8',now,.45,.6);F.streak(e.x,e.y,ang,len,.15,'#ffffff',now,.3,.6);
        F.projectile(this.V(e.x,1,e.y),to,'#bff5d8',now,Math.max(.1,dur),.12,0,p=>Pt.emit(p.x,p.y,p.z,{count:2,color:['#bff5d8','#ffffff'],speed:.6,up:0,life:.35,size:.2,gravity:0}),'arrow');break;
      case 'trap':if(e.key!==undefined)keep([F.runeCircle(e.x,e.y,e.r??1,'#c9a3ff',now,dur),F.field(e.x,e.y,(e.r??1)*.9,'#c9a3ff',now,dur,.2)]);
        Pt.emit(e.x,.2,e.y,{count:16,color:['#c9a3ff','#ffffff'],speed:1,up:1,life:.5,size:.2,gravity:0});break;
      case 'trapBoom':F.disc(e.x,e.y,e.r??2,'#c9a3ff',now,.45,.8);F.ring(e.x,e.y,.3,(e.r??2)*1.15,'#ffffff',now,.4);F.beam(e.x,e.y,.6,4,'#c9a3ff',now,.4);
        Pt.emit(e.x,.3,e.y,{count:50,color:['#c9a3ff','#ffffff','#ffd45c'],speed:4.5,up:3,life:.55,size:.28,gravity:-6});this.shake=Math.max(this.shake,.2);break;
      case 'falcon':F.projectile(this.V(e.x,2.6,e.y),this.V(e.tx!,.8,e.ty!),'#e8d8b0',now,Math.max(.1,dur),.24,1.4,p=>Pt.emit(p.x,p.y,p.z,{count:1,color:['#c9a46b','#ffffff'],speed:.3,up:0,life:.4,size:.2,gravity:0}));
        later(dur*1000,()=>{Pt.emit(e.tx!,.8,e.ty!,{count:18,color:['#c9a46b','#ffffff'],speed:3,up:2,life:.5,size:.22,gravity:-3});F.ring(e.tx!,e.ty!,.2,1,'#e8d8b0',performance.now(),.3);this.overlay.float(this.V(e.tx!,2,e.ty!),this.engine.camera,'🦅','info');});break;
      case 'starRain':{const r=e.r??2.5;F.runeCircle(e.x,e.y,r*1.1,'#ffe9a8',now,dur);F.beam(e.x,e.y,r*.5,10,'#ffe9a8',now,dur);
        for(let i=0;i<24;i++){const ox=(Math.random()-.5)*r*2,oz=(Math.random()-.5)*r*2;F.projectile(this.V(e.x+ox+2,9,e.y+oz+2),this.V(e.x+ox,.1,e.y+oz),'#fff6c4',now+120+i*35,.4,.16,0,undefined,'orb');}break;}
      case 'bolt':{const from=this.V(e.x+1.6,7,e.y+1.6),hit=this.V(e.x,.6,e.y),c=e.element==='water'?'#7fd0ff':'#ff8a3d';
        F.projectile(from,hit,c,now,Math.max(1/60,dur),.22,0,p=>Pt.emit(p.x,p.y,p.z,{count:2,color:[c,'#ffffff'],speed:.4,up:0,life:.3,size:.22,gravity:0}),e.element==='water'?'shard':'orb');
        later(Math.max(1000/60,dur*1000),()=>{Pt.emit(e.x,.5,e.y,{count:22,color:[c,'#ffffff'],speed:3.5,up:2,life:.45,size:.25,gravity:-5});F.ring(e.x,e.y,.2,1.1,c,performance.now(),.35);});break;}
      case 'meteor':{ // 星落: a glowing rock streaks in from high up-left, then a star-shaped impact
        const from=this.V(e.x-3.2,11,e.y-3.2),hit=this.V(e.x,.3,e.y);
        F.warn(e.x,e.y,{r:1.1},'#ffe08a',now,dur);
        F.projectile(from,hit,'#ffe27a',now,Math.max(.1,dur),.42,0,p=>Pt.emit(p.x,p.y,p.z,{count:4,color:['#fff6c4','#ffd45c','#c9a3ff'],speed:.5,up:.2,life:.45,size:.34,gravity:0}),'orb');
        later(dur*1000,()=>{const t=performance.now();F.disc(e.x,e.y,1.4,'#ffd45c',t,.45,.75);F.ring(e.x,e.y,.2,1.9,'#fff2b0',t,.45);F.ring(e.x,e.y,.1,1.2,'#c9a3ff',t+60,.4);
          F.beam(e.x,e.y,.5,3.2,'#ffe27a',t,.35);Pt.emit(e.x,.3,e.y,{count:36,color:['#ffe27a','#fff6c4','#c9a3ff'],speed:4.5,up:3,life:.6,size:.3,gravity:-4,radius:.4});
          this.overlay.float(this.V(e.x,2.2,e.y),this.engine.camera,'星落！','status');this.shake=Math.max(this.shake,.12);});break;}
      case 'thunder':{F.lightning(this.V(e.x+(Math.random()-.5),9,e.y+(Math.random()-.5)),this.V(e.x,.1,e.y),'#fff6a0',now,.3,.9);F.disc(e.x,e.y,1,'#fff6a0',now,.3,.8);
        Pt.emit(e.x,.2,e.y,{count:14,color:['#fff6a0','#ffffff'],speed:4,up:2,life:.35,size:.2,gravity:-6});this.shake=Math.max(this.shake,.08);break;}
      case 'arrow':F.projectile(this.V(e.x,1,e.y),to,'#fff6d8',now,Math.max(1/60,dur),.1,.3,undefined,'arrow');break;
      case 'orb':{const c=e.attackType==='magic'?'#d08aff':'#bfa2ff';F.projectile(this.V(e.x,1.1,e.y),to,c,now,Math.max(1/60,dur),.18,.25,p=>Pt.emit(p.x,p.y,p.z,{count:1,color:c,speed:.2,up:0,life:.3,size:.18,gravity:0}));break;}
      case 'fireball':F.projectile(this.V(e.x,1.1,e.y),to,'#ff8a3d',now,Math.max(.1,dur),.4,1.2,p=>Pt.emit(p.x,p.y,p.z,{count:3,color:['#ffb04a','#ff5a2a','#fff0a0'],speed:.6,up:.4,life:.4,size:.32,gravity:1}));break;
      case 'explode':case 'magnum':{const r=(e.r??2);F.disc(e.x,e.y,r,'#ff7a2a',now,.5,.8);F.ring(e.x,e.y,.3,r*1.1,'#ffd27a',now,.45);F.sphere(this.V(e.x,.4,e.y),r*.7,'#ffb04a',now,.35);
        Pt.emit(e.x,.3,e.y,{count:60,color:['#ffb04a','#ff5a2a','#fff0a0'],speed:5,up:3,life:.7,size:.35,gravity:-3,radius:r*.4});this.shake=Math.max(this.shake,.2);break;}
      case 'frost':F.projectile(this.V(e.x,1,e.y),to,'#9fe0ff',now,Math.max(.1,dur),.2,0,p=>Pt.emit(p.x,p.y,p.z,{count:2,color:['#cff0ff','#ffffff'],speed:.3,up:0,life:.4,size:.2,gravity:0}),'shard');
        later(dur*1000,()=>{Pt.emit(to.x,.5,to.z,{count:30,color:['#cff0ff','#ffffff','#7fd0ff'],speed:3,up:2,life:.6,size:.25});F.ring(to.x,to.z,.2,1.3,'#9fe0ff',performance.now(),.4);});break;
      case 'echo':case 'pulse':F.ring(e.x,e.y,.3,e.r??2,e.kind==='echo'?'#ffb3e0':'#ff9ec4',now,.5);F.ring(e.x,e.y,.1,(e.r??2)*.7,'#ffffff',now+80,.4);Pt.emit(e.x,.2,e.y,{count:20,color:'#ffc0e8',speed:3,up:.5,life:.4,size:.2,gravity:0});break;
      case 'arrowRain':for(let i=0;i<16;i++){const ox=(Math.random()-.5)*(e.r??1.5)*2,oz=(Math.random()-.5)*(e.r??1.5)*2;F.projectile(this.V(e.x+ox+1.5,7,e.y+oz+1.5),this.V(e.x+ox,.1,e.y+oz),'#fff6d8',now+i*18,.35,.1,0,undefined,'arrow');}
        later(380,()=>{Pt.emit(e.x,.2,e.y,{count:24,color:['#e8d8a8','#ffffff'],speed:2.5,up:1.5,life:.4,size:.2,radius:e.r??1.5});F.ring(e.x,e.y,.3,(e.r??1.5)*1.2,'#fff6d8',performance.now(),.35);});break;
      case 'bash':{const p=this.world.player,yaw=Math.atan2(e.x-p.x,e.y-p.y),last=e.r===1,fire=!!p.enchant,c=fire?'#ffb04a':'#fff2b0';
        // v6.2 連環重斬: alternating quick cuts; only the last one gets the big flash and the screen shake.
        const tilt=((this.frameNo%2)?.5:-.5);F.slash(e.x,.8,e.y,yaw+Math.PI/2+tilt,c,now,last?1.25:.9,last?.36:.22);
        if(last){F.sphere(this.V(e.x,.7,e.y),.7,'#ffffff',now,.22);this.shake=Math.max(this.shake,.2);}
        Pt.emit(e.x,.7,e.y,{count:last?30:12,color:fire?['#ffffff','#ff9a3d','#ffd45c']:['#ffffff','#ffe26b'],speed:last?5.5:3.5,up:1.5,life:.35,size:.24,gravity:-6});break;}
      case 'trample':{const a=e.angle??0,r=e.r??4,fire=e.element==='fire',c=fire?'#ff6a2a':'#e8c48a',k=(e.length??0)/2;
        // 大嘴鳥踐踏 / 龍息: each stomp pushes the fan a little further; the dragon breathes fire instead.
        F.fan(e.x,e.y,r*(.6+.2*k),a,1.8,c,now,.38);if(fire)F.fan(e.x,e.y,r*(.45+.2*k),a,1.4,'#ffd45c',now+40,.3);
        const fx=e.x+Math.cos(a)*r*(.35+.25*k),fz=e.y+Math.sin(a)*r*(.35+.25*k);
        Pt.emit(fx,.2,fz,{count:fire?40:24,color:fire?['#ff6a2a','#ffd45c','#ffffff']:['#c9a46b','#9a8c7b','#ffffff'],speed:fire?4:3,up:fire?2:2.5,life:.5,size:.3,gravity:fire?-1:-8,radius:1});
        F.ring(fx,fz,.3,1.4,c,now,.3);this.shake=Math.max(this.shake,.14);break;}
      case 'cleave':{const a=Math.atan2(e.ty!-e.y,e.tx!-e.x),c=e.element==='fire'?'#ff8a3d':'#fff2b0';F.fan(e.x,e.y,e.r??2.2,a,Math.PI*2/3,c,now,.32);
        F.slash(e.x+Math.cos(a)*.9,.75,e.y+Math.sin(a)*.9,Math.atan2(e.tx!-e.x,e.ty!-e.y)+Math.PI/2,c,now,1.4,.26);
        Pt.emit(e.x+Math.cos(a)*1.2,.6,e.y+Math.sin(a)*1.2,{count:18,color:[c,'#ffffff'],speed:3.5,up:1.2,life:.35,size:.24,gravity:-4,radius:.6});this.shake=Math.max(this.shake,.08);break;}
      case 'enchant':F.ring(e.x,e.y,.2,1.6,'#ff8a3d',now,.5);F.beam(e.x,e.y,.45,2.6,'#ffb04a',now,.5);
        Pt.emit(e.x,.4,e.y,{count:40,color:['#ff9a3d','#ffd45c','#ffffff'],speed:2,up:3,life:.7,size:.26,gravity:-1,radius:.5});this.overlay.float(this.V(e.x,2.2,e.y),this.engine.camera,'烈焰附刃！','status');break;
      case 'chain':F.lightning(this.V(e.x,.7,e.y),to,'#c9d7ff',now,.3,.4);break;
      case 'shatter':Pt.emit(e.x,.6,e.y,{count:40,color:['#cff0ff','#ffffff'],speed:5,up:2,life:.6,size:.25,gravity:-6});F.ring(e.x,e.y,.2,e.r??2,'#cff0ff',now,.4);break;
      case 'heal':case 'buff':case 'shield':{const c=e.kind==='shield'?'#9fe0ff':e.kind==='heal'?'#7dff8a':'#ffe26b';F.ring(e.x,e.y,.2,1.1,c,now,.6);F.beam(e.x,e.y,.55,2.4,c,now,.7);
        Pt.emit(e.x,.1,e.y,{count:30,color:[c,'#ffffff'],speed:.6,up:2.6,life:.9,size:.2,gravity:0,radius:.6});
        if(e.kind==='shield')F.sphere(this.V(e.x,.9,e.y),1,'#9fe0ff',now,.7);break;}
      case 'provoke':this.overlay.float(this.V(e.x,1.6,e.y),this.engine.camera,'💢','info');break;
      case 'venom':Pt.emit(e.x,.6,e.y,{count:10,color:['#b07ad9','#d8a8ff'],speed:1,up:1.4,life:.6,size:.2,gravity:0});break;
      case 'warn':F.warn(e.x,e.y,{r:e.r??2,line:e.shape==='line'?{angle:e.angle??0,length:e.length??6}:undefined},e.attackType==='magic'?'#c070ff':'#ff4a3a',now,Math.max(.1,dur));break;
      case 'slam':{const c=e.attackType==='magic'?'#c070ff':'#ffb04a';
        if(e.shape==='line'){const a=e.angle??0,L=e.length??6;for(let i=0;i<=8;i++){const k=i/8,x=e.x+Math.cos(a)*L*k,z=e.y+Math.sin(a)*L*k;Pt.emit(x,.2,z,{count:6,color:[c,'#ffffff'],speed:2.5,up:3,life:.5,size:.3,gravity:-8});}}
        else{F.disc(e.x,e.y,e.r??2,c,now,.4,.9);F.ring(e.x,e.y,.4,(e.r??2)*1.2,'#ffffff',now,.4);Pt.emit(e.x,.2,e.y,{count:50,color:[c,'#9a8c7b','#ffffff'],speed:5,up:4,life:.6,size:.3,gravity:-9,radius:(e.r??2)*.5});}
        this.shake=Math.max(this.shake,.35);break;}
      case 'summon':F.runeCircle(e.x,e.y,e.r??2.5,'#c070ff',now,1.2);Pt.emit(e.x,.2,e.y,{count:50,color:['#c070ff','#ffffff'],speed:1,up:3,life:1,size:.25,gravity:0,radius:2});break;
      default:Pt.emit(e.x,.5,e.y,{count:10,color:col,speed:2,up:1,life:.4,size:.2});
    }
  }
  levelUp(kind:'base'|'job'){
    const p=this.world.player,now=performance.now(),c=kind==='base'?'#ffe26b':'#9fd5ff';
    this.fx.beam(p.x,p.y,.9,12,c,now,1.8,true);this.fx.runeCircle(p.x,p.y,1.8,c,now,1.8);this.fx.ring(p.x,p.y,.3,3,c,now,1);
    this.particles.emit(p.x,.2,p.y,{count:120,color:[c,'#ffffff'],speed:2,up:5,life:1.6,size:.3,gravity:-1,radius:.8});
    this.overlay.banner(this.V(p.x,2.4,p.y),this.engine.camera,kind==='base'?'LEVEL UP!':'JOB LEVEL UP!',kind);
  }
  /** Brief celebratory burst (pet tamed, costume equipped). */
  /** v6.0 轉職儀式: a tall pillar, a rune circle and a shower of stars around the player. */
  ascendFx(color:string){const p=this.world.player,now=performance.now(),F=this.fx;
    F.runeCircle(p.x,p.y,3.6,'#ffd45c',now,3.2);F.beam(p.x,p.y,1.5,18,color,now,3,true);F.beam(p.x,p.y,.6,18,'#ffffff',now,2.4);
    for(let i=0;i<4;i++)F.ring(p.x,p.y,.4,3+i,i%2?color:'#ffd45c',now+i*260,.8);
    this.particles.emit(p.x,.3,p.y,{count:220,color:[color,'#ffd45c','#ffffff'],speed:5,up:6,life:2,size:.34,gravity:-2,radius:1.5});this.shake=.4;}
  celebrate(color='#ff9ec4'){const p=this.world.player;this.particles.emit(p.x,.3,p.y,{count:60,color:[color,'#ffffff'],speed:3,up:4,life:1.2,size:.3,gravity:-2});this.fx.ring(p.x,p.y,.3,2,color,performance.now(),.7);}
  tameEffect(x:number,y:number,ok:boolean){
    const now=performance.now();
    if(ok){this.fx.beam(x,y,.6,5,'#ff9ec4',now,1.2);this.particles.emit(x,.3,y,{count:40,color:['#ff9ec4','#ffffff'],speed:2,up:3,life:1,size:.3,gravity:-1});this.overlay.float(this.V(x,1.5,y),this.engine.camera,'♥ 捕捉成功！','heal');}
    else{this.particles.emit(x,.5,y,{count:16,color:'#cccccc',speed:2,up:1,life:.5,size:.2});this.overlay.float(this.V(x,1.5,y),this.engine.camera,'捕捉失敗…','miss');}
  }
}
function lerpAngle(a:number,b:number,t:number){let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return a+d*t;}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
function disposeTree(o:THREE.Object3D){o.userData.disposeVisuals?.();o.traverse(x=>{if(x instanceof THREE.Mesh||x instanceof THREE.InstancedMesh){if(x instanceof THREE.InstancedMesh)x.dispose();x.geometry?.dispose();const m=x.material as THREE.Material|THREE.Material[];
  for(const mm of Array.isArray(m)?m:[m]){const map=(mm as THREE.MeshBasicMaterial).map;if(map&&(map as THREE.CanvasTexture).isCanvasTexture)map.dispose();}}});}
import { monsters } from '../data/monsters';
import { pets } from '../data/pets';
function petArt(id:string){const p=pets[id];return p?monsters[p.monster]?.art:undefined;}
