// Phaser presentation: draws the World with interpolation, turns clicks into world commands,
// and plays feedback (damage numbers, cast bars, skill effects). It never changes saved state.
import Phaser from 'phaser';
import type { World, SimEvent, Monster, GroundItem, Vec } from '../world/sim';
import { skills } from '../data/jobs';
import { items, cards } from '../data/items';
import { toScreen, toWorld, viewFor, TW, TH } from './iso';
import { drawCharacterSheet, CW, CH, VIEWS, frameIndex, FRAME_COUNT, type Look, type Pose } from './art/characters';
import { drawMonsterSheet, monsterSize, MONSTER_FRAMES, monsterFrame } from './art/monsters';
import { paintChunk, paintProp, CHUNK } from './art/world';
import { itemIconCanvas, cardIconCanvas } from './art/icons';
import {paintBackdrop,paintLandmark,landmarks,type Landmark} from './art/backdrop';
import {maps} from '../data/maps';
import type { MapData } from '../world/mapgen';

export type SceneHooks = {
  onEvents(ev:SimEvent[]):void;
  inputBlocked():boolean;
  playerLook():Look; playerName():string;
  onHover(text:string|null):void;
  onTargetingEnd():void;onManualInput?():void;onInspectLandmark?(title:string,text:string,key?:string):void;
};
const elementColor:Record<string,number>={fire:0xff7a3d,water:0x6fc3ff,wind:0xffe26b,earth:0xc9a46b,neutral:0xffffff};
type Actor={c:Phaser.GameObjects.Container;spr:Phaser.GameObjects.Sprite;shadow:Phaser.GameObjects.Ellipse;key:string};
type MonsterView=Actor&{bar:Phaser.GameObjects.Graphics;status:Phaser.GameObjects.Graphics;deadTween?:boolean;lastX:number;lastY:number;walk:number};

export class GameScene extends Phaser.Scene {
  world!:World; hooks!:SceneHooks;
  private ready=false;
  private layer!:Phaser.GameObjects.Container;
  private chunkImgs:Phaser.GameObjects.Image[]=[];
  private propImgs:Phaser.GameObjects.Image[]=[];
  private npcViews:{id:string;actor:Actor;label:Phaser.GameObjects.Text;x:number;y:number}[]=[];
  private warpGfx!:Phaser.GameObjects.Graphics;
  private player!:Actor;
  private playerLabel!:Phaser.GameObjects.Text;
  private playerBars!:Phaser.GameObjects.Graphics;
  private castBar!:Phaser.GameObjects.Graphics;
  private castText!:Phaser.GameObjects.Text;
  private circle!:Phaser.GameObjects.Graphics;
  private ground!:Phaser.GameObjects.Graphics;
  private fxG!:Phaser.GameObjects.Graphics;
  private mons=new Map<number,MonsterView>();
  private loot=new Map<number,Phaser.GameObjects.Container>();
  private walkDist=0; private lastPos:Vec={x:0,y:0}; private movingUntil=0;
  private castInfo:{skill:string;start:number;dur:number}|null=null;
  private fx:{kind:string;born:number;dur:number;x:number;y:number;tx?:number;ty?:number;r?:number;color:number;shape?:'circle'|'line';angle?:number;length?:number;attackType?:'physical'|'magic'}[]=[];
  private holdMove=0; private pointerDownAt=0; private holding=false;
  private lookKey=''; private hoverMonster:number|null=null;
  targeting:string|null=null;
  private mapId='';
  private backdrop!:Phaser.GameObjects.Image;
  private propMeta=new Map<string,{ax:number;ay:number}>();
  private navigation:{x:number;y:number;label:string}|null=null;
  private routeG!:Phaser.GameObjects.Graphics;private routeLabel!:Phaser.GameObjects.Text;
  private sceneLabels:Phaser.GameObjects.Text[]=[];
  private landmarkViews:{point:Landmark;x:number;y:number;key:string}[]=[];
  private chestViews=new Map<number,Phaser.GameObjects.Container>();
  private hurtUntil=0;
  private time0=0;

  private resolveReady!:()=>void;
  readonly whenReady=new Promise<void>(r=>{this.resolveReady=r;});
  constructor(){super('game');}
  attach(world:World,hooks:SceneHooks){this.world=world;this.hooks=hooks;}

  create(){
    this.cameras.main.setBackgroundColor('#2a3a2a');
    const bg=this.tex('backdrop:town',()=>paintBackdrop('town'));
    this.backdrop=this.add.image(0,0,bg).setOrigin(.5).setScrollFactor(0).setDepth(-20000);
    this.layer=this.add.container(0,0);
    this.routeG=this.add.graphics().setDepth(800000);this.layer.add(this.routeG);
    this.routeLabel=this.add.text(0,0,'',{fontFamily:'"PingFang TC",sans-serif',fontSize:'14px',color:'#fff6cb',stroke:'#2e5b4d',strokeThickness:4,align:'center'}).setOrigin(.5,1).setDepth(900000);this.layer.add(this.routeLabel);
    this.ground=this.add.graphics().setDepth(-9000);this.layer.add(this.ground);
    this.warpGfx=this.add.graphics();this.layer.add(this.warpGfx);
    this.circle=this.add.graphics();this.layer.add(this.circle);
    this.fxG=this.add.graphics().setDepth(900000);this.layer.add(this.fxG);
    this.castBar=this.add.graphics().setDepth(1000001);this.castText=this.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'12px',color:'#ffffff',stroke:'#203040',strokeThickness:3}).setOrigin(.5,1).setDepth(1000002);
    this.playerBars=this.add.graphics().setDepth(999990);
    this.playerLabel=this.add.text(0,0,'',{fontFamily:'"PingFang TC","Microsoft JhengHei",sans-serif',fontSize:'12px',color:'#ffffff',stroke:'#1d2a1d',strokeThickness:3}).setOrigin(.5,0).setDepth(999991);
    this.layer.add([this.castBar,this.castText,this.playerBars,this.playerLabel]);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>this.onDown(p));
    this.input.on('pointerup',()=>{this.holding=false;});
    this.input.on('wheel',(_p:unknown,_o:unknown,_dx:number,dy:number)=>{const c=this.cameras.main;c.setZoom(Phaser.Math.Clamp(c.zoom*(dy>0?.9:1.1),.6,1.6));});
    this.ready=true;this.resolveReady();
  }

  // ———————————————————————— textures ————————————————————————
  private tex(key:string,make:()=>HTMLCanvasElement,frames?:{w:number;h:number;cols:number;rows:number}){
    if(this.textures.exists(key))return key;
    const c=make(),t=this.textures.addCanvas(key,c)!;
    if(frames){let i=0;for(let r=0;r<frames.rows;r++)for(let k=0;k<frames.cols;k++)t.add(i++,0,k*frames.w,r*frames.h,frames.w,frames.h);}
    return key;
  }
  private charTexture(look:Look){
    const key=`char:${JSON.stringify(look)}`;
    return this.tex(key,()=>drawCharacterSheet(look),{w:CW,h:CH,cols:FRAME_COUNT,rows:VIEWS.length});
  }
  private makeActor(texture:string,scale:number):Actor{
    const shadow=this.add.ellipse(0,0,30*scale,11*scale,0x1a2a10,.28);
    const spr=this.add.sprite(0,0,texture,0).setOrigin(.5,1-8/CH).setScale(.5);
    const c=this.add.container(0,0,[shadow,spr]);this.layer.add(c);
    return {c,spr,shadow,key:texture};
  }

  // ———————————————————————— map ————————————————————————
  loadMap(map:MapData){
    this.mapId=map.def.id;this.fx=[];this.clearNavigation();
    this.backdrop.setTexture(this.tex(`backdrop:${map.def.theme}`,()=>paintBackdrop(map.def.theme)));
    this.sceneLabels.forEach(t=>t.destroy());this.sceneLabels=[];this.landmarkViews=[];for(const b of this.chestViews.values())b.destroy();this.chestViews.clear();
    for(const i of [...this.chunkImgs,...this.propImgs])i.destroy();this.chunkImgs=[];this.propImgs=[];
    for(const n of this.npcViews){n.actor.c.destroy();n.label.destroy();}this.npcViews=[];
    for(const m of this.mons.values()){m.c.destroy();m.bar.destroy();m.status.destroy();}this.mons.clear();
    for(const l of this.loot.values())l.destroy();this.loot.clear();
    for(const k of this.textures.getTextureKeys())if(k.startsWith('chunk:'))this.textures.remove(k);
    for(let cy=0;cy<map.h;cy+=CHUNK)for(let cx=0;cx<map.w;cx+=CHUNK){
      const ch=paintChunk(map,cx,cy),key=`chunk:${map.def.id}:${cx}:${cy}`;
      this.textures.addCanvas(key,ch.canvas);
      const img=this.add.image(ch.left,ch.top,key).setOrigin(0,0).setDepth(-10000);this.layer.add(img);this.chunkImgs.push(img);
    }
    // Map edge: a dark rim beyond the playable diamond.
    for(const p of map.props){
      const key=`prop:${p.kind}:${p.v}:${map.def.theme}:${p.w??1}x${p.h??1}`;
      if(!this.textures.exists(key)){const art=paintProp(p,map.def.theme);this.textures.addCanvas(key,art.canvas);this.propMeta.set(key,{ax:art.ax/art.canvas.width,ay:art.ay/art.canvas.height});}
      const anchor=this.propMeta.get(key)!;
      const s=toScreen(p.x,p.y),flat=p.kind==='flower'||p.kind==='tuft'||p.kind==='mushroom';
      const img=this.add.image(s.x,s.y,key).setOrigin(anchor.ax,anchor.ay).setScale(.5);
      img.setDepth(flat?s.y-40:s.y+(p.kind==='house'?((p.w??1)+(p.h??1))*4:0));
      img.setData('occludes',!flat);this.layer.add(img);this.propImgs.push(img);
    }
    for(const [li,point] of (landmarks[map.def.id]??[]).entries()){
      const cell=map.grid.nearestWalkable(point.x,point.y,8);if(!cell)continue;
      const pos=toScreen(cell.x+.5,cell.y+.5),key=this.tex(`landmark:${point.kind}`,()=>paintLandmark(point.kind));
      const img=this.add.image(pos.x,pos.y,key).setOrigin(.5,150/180).setScale(.65).setDepth(pos.y);this.layer.add(img);this.propImgs.push(img);
      const label=this.add.text(pos.x,pos.y+13,`${point.name}  ·  ${point.action==='trial'?'試煉':point.action==='supply'?'補給':'調查'}`,{fontFamily:'"PingFang TC",sans-serif',fontSize:'12px',color:'#fff1bf',stroke:'#3e5843',strokeThickness:3}).setOrigin(.5,0).setDepth(pos.y+2);this.layer.add(label);this.sceneLabels.push(label);
      this.landmarkViews.push({point,x:cell.x+.5,y:cell.y+.5,key:`${map.def.id}:${li}`});
    }
    for(const wp of map.def.warps){const pos=toScreen(wp.x+.5,wp.y+.5);const label=this.add.text(pos.x,pos.y-28,`前往 ${maps[wp.to].name}`,{fontFamily:'"PingFang TC",sans-serif',fontSize:'13px',color:'#edffed',stroke:'#315c50',strokeThickness:4}).setOrigin(.5,1).setDepth(999000);this.layer.add(label);this.sceneLabels.push(label);}
    for(const n of map.def.npcs){
      const look:Look={outfit:'npc',hair:(n.id.length)%4,hairColor:n.look.hair,cloth:n.look.outfit,hat:n.look.hat,weapon:null};
      const actor=this.makeActor(this.charTexture(look),1);
      const s=toScreen(n.x+.5,n.y+.5);actor.c.setPosition(s.x,s.y).setDepth(s.y);
      actor.spr.setFrame(frameIndex('idle',0));
      const label=this.add.text(s.x,s.y+4,n.name,{fontFamily:'"PingFang TC","Microsoft JhengHei",sans-serif',fontSize:'12px',color:'#ffe9a8',stroke:'#2a1d10',strokeThickness:3}).setOrigin(.5,0).setDepth(999000);
      this.layer.add(label);this.npcViews.push({id:n.id,actor,label,x:n.x+.5,y:n.y+.5});
    }
    const look=this.hooks.playerLook();this.lookKey='';this.ensurePlayer(look);
    const s=toScreen(this.world.player.x,this.world.player.y);
    const cam=this.cameras.main;cam.centerOn(s.x,s.y-30);
    this.lastPos={x:this.world.player.x,y:this.world.player.y};
  }
  private ensurePlayer(look:Look){
    const key=JSON.stringify(look);if(key===this.lookKey)return;
    this.lookKey=key;const old=this.player?.key,tex=this.charTexture(look);
    if(!this.player)this.player=this.makeActor(tex,1);else this.player.spr.setTexture(tex,0);
    this.player.key=tex;
    if(old&&old!==tex&&!this.npcViews.some(n=>n.actor.key===old))this.textures.remove(old);
  }

  // ———————————————————————— input ————————————————————————
  private pointerWorld(p:Phaser.Input.Pointer){const w=p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;return toWorld(w.x,w.y);}
  private pointerScreen(p:Phaser.Input.Pointer){return p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;}
  monsterAt(sx:number,sy:number):Monster|null{
    let best:Monster|null=null,bestY=-Infinity;
    for(const m of this.world.monsters){
      if(m.state==='dead')continue;const v=this.mons.get(m.id);if(!v)continue;
      const size=monsterSize(m.def.art)*.5,cx=v.c.x,cy=v.c.y-size*.42;
      if(Math.abs(sx-cx)<size*.36&&Math.abs(sy-cy)<size*.42&&v.c.y>bestY){best=m;bestY=v.c.y;}
    }
    return best;
  }
  private itemAt(sx:number,sy:number):GroundItem|null{
    for(const it of this.world.items){const s=toScreen(it.x,it.y);if(Math.abs(sx-s.x)<16&&Math.abs(sy-(s.y-8))<14)return it;}
    return null;
  }
  private npcAt(sx:number,sy:number){return this.npcViews.find(n=>Math.abs(sx-n.actor.c.x)<22&&sy<n.actor.c.y+4&&sy>n.actor.c.y-90)??null;}
  private onDown(p:Phaser.Input.Pointer){
    if(this.hooks.inputBlocked())return;
    (document.activeElement as HTMLElement|null)?.blur?.();
    if(p.rightButtonDown()){if(this.targeting){this.targeting=null;this.hooks.onTargetingEnd();}return;}
    const s=this.pointerScreen(p),w=this.pointerWorld(p);
    if(this.targeting){
      const sk=skills[this.targeting];
      let success=false;
      if(sk.target==='ground')success=this.world.useSkill(this.targeting,null,w);
      else{const m=this.monsterAt(s.x,s.y);if(m)success=this.world.useSkill(this.targeting,m.id,null);else this.floatText(this.player.c.x,this.player.c.y-85,'請選擇魔物目標','#ffdfa4',13);}
      if(success)this.targeting=null;this.hooks.onTargetingEnd();return;
    }
    this.hooks.onManualInput?.();
    const ch=this.world.chests.find(c=>{const p=toScreen(c.x,c.y);return Math.abs(s.x-p.x)<18&&s.y>p.y-26&&s.y<p.y+6;});if(ch){this.world.openChest(ch.id);return;}
    const landmark=this.landmarkViews.find(l=>{const p=toScreen(l.x,l.y);return Math.abs(s.x-p.x)<65&&s.y>p.y-85&&s.y<p.y+30;});
    if(landmark){const pos=toScreen(landmark.x,landmark.y);this.hooks.onInspectLandmark?.(landmark.point.name,landmark.point.text,landmark.key);return;}
    const m=this.monsterAt(s.x,s.y);if(m){this.world.attack(m.id);return;}
    const it=this.itemAt(s.x,s.y);if(it){this.world.pickUp(it.id);return;}
    const n=this.npcAt(s.x,s.y);if(n){this.world.talk(n.id);return;}
    this.world.moveTo(w.x,w.y);this.marker(w);
    this.holding=true;this.pointerDownAt=this.time.now;this.holdMove=this.time.now;
  }
  /** Hotkey helper: the monster under the cursor, if any. */
  hovered():Monster|null{const p=this.input.activePointer,s=this.pointerScreen(p);return this.monsterAt(s.x,s.y);}
  cursorWorld():Vec{return this.pointerWorld(this.input.activePointer);}
  private marker(w:Vec){
    const s=toScreen(w.x,w.y);this.fx.push({kind:'marker',born:this.time.now,dur:450,x:s.x,y:s.y,color:0xffffff});
  }

  // ———————————————————————— frame ————————————————————————
  update(_t:number,deltaMs:number){
    if(!this.ready||!this.world?.map)return;
    const dt=Math.min(deltaMs/1000,.1);
    if(!this.hooks.inputBlocked()&&this.holding&&this.input.activePointer.leftButtonDown()&&this.time.now-this.pointerDownAt>180&&this.time.now-this.holdMove>110){
      const w=this.pointerWorld(this.input.activePointer);this.world.moveTo(w.x,w.y);this.holdMove=this.time.now;
    }
    if(!this.hooks.inputBlocked()){const ev=this.world.step(dt);if(ev.length){this.play(ev);this.hooks.onEvents(ev);}}
    this.time0+=dt;
    this.backdrop.setPosition(this.scale.width/2,this.scale.height/2).setDisplaySize(this.scale.width/this.cameras.main.zoom,this.scale.height/this.cameras.main.zoom);
    this.syncPlayer();this.syncMonsters();this.syncLoot();this.syncChests();this.drawWarps();this.drawFx();this.drawRoute();this.hover();this.updateOcclusion();
    // Containers ignore child depth; sort by it so things farther down the screen draw in front.
    this.layer.sort('depth');
    const p=this.player.c,cam=this.cameras.main,k=1-Math.pow(.0005,dt);
    cam.scrollX+=(p.x-cam.width/2-cam.scrollX)*k;cam.scrollY+=(p.y-40-cam.height/2-cam.scrollY)*k;
  }
  private lerp(o:{x:number;y:number;px:number;py:number}){const a=this.world.alpha;return {x:o.px+(o.x-o.px)*a,y:o.py+(o.y-o.py)*a};}
  private syncPlayer(){
    this.ensurePlayer(this.hooks.playerLook());
    const w=this.world,pl=w.player,pos=this.lerp(pl),s=toScreen(pos.x,pos.y);
    const moved=Math.hypot(pos.x-this.lastPos.x,pos.y-this.lastPos.y);this.lastPos=pos;
    if(Math.hypot(pl.vx,pl.vy)>.5)this.movingUntil=this.time0+.1;
    this.walkDist+=moved;
    const {view,flip}=viewFor(pl.facing),row=VIEWS.indexOf(view);
    let pose:Pose='idle',f=Math.floor(this.time0*1.6)%2;
    if(pl.dead)pose='dead';
    else if(pl.sitting)pose='sit';
    else if(pl.cast){pose='cast';f=Math.floor(this.time0*5)%2;}
    else if(w.time-pl.attackAt<.32){pose='attack';f=Math.min(2,Math.floor((w.time-pl.attackAt)/.32*3));}
    else if(this.time0<this.movingUntil){pose='walk';f=Math.floor(this.walkDist/.21)%8;}
    this.player.spr.setFrame(row*FRAME_COUNT+frameIndex(pose,f)).setFlipX(flip);
    this.player.c.setPosition(s.x,s.y).setDepth(s.y+1);
    if(this.time.now<this.hurtUntil)this.player.spr.setTint(0xffb4a5);else this.player.spr.clearTint();
    this.player.spr.setRotation(pose==='attack'?Math.sin((w.time-pl.attackAt)/.32*Math.PI)*.045*(flip?-1:1):0);
    this.player.shadow.setVisible(!pl.dead);
    // Name and HP/SP bars under the feet (RO style).
    this.playerLabel.setText(this.hooks.playerName()).setPosition(s.x,s.y+14);
    const d=w.derived,g=this.playerBars;g.clear();
    const bw=44,bx=s.x-bw/2,by=s.y+6;
    g.fillStyle(0x10202a,.85).fillRect(bx-1,by-1,bw+2,8);
    const ratio=(v:number,max:number)=>Math.max(0,Math.min(1,v/max));
    g.fillStyle(pl.hp/d.maxHp<.25?0xff5050:0x48d848,1).fillRect(bx,by,bw*ratio(pl.hp,d.maxHp),3);
    g.fillStyle(0x4b8bff,1).fillRect(bx,by+3.5,bw*ratio(pl.sp,d.maxSp),2.5);
    if(pl.shields.length){g.lineStyle(2,0x9fe0ff,.6).strokeEllipse(s.x,s.y-30,58,76);}
    // Cast bar and magic circle.
    this.castBar.clear();this.circle.clear();
    if(pl.cast){
      const t=1-pl.cast.remaining/pl.cast.total;
      this.castBar.fillStyle(0x1a1a2a,.85).fillRect(s.x-31,s.y-104,62,8).fillStyle(0x7fd0ff,1).fillRect(s.x-30,s.y-103,60*t,6);
      this.castText.setText(`${skills[pl.cast.skill].name} Lv.${pl.cast.lv}`).setPosition(s.x,s.y-106).setVisible(true);
      const col=elementColor[skills[pl.cast.skill].element]??0xbfa2ff,rot=this.time0*1.8;
      this.circle.setDepth(s.y-2);
      for(const [r,a] of [[30,.9],[22,.6]] as const){this.circle.lineStyle(2,col,a).strokeEllipse(s.x,s.y,r*2.2,r*1.1);}
      for(let i=0;i<6;i++){const a=rot+i/6*Math.PI*2;this.circle.fillStyle(col,.9).fillCircle(s.x+Math.cos(a)*30*1.1,s.y+Math.sin(a)*30*.55,2.4);}
      for(let i=0;i<3;i++){const a=rot*-1.3+i/3*Math.PI*2,b=a+Math.PI*2/3;this.circle.lineStyle(1.5,col,.7).lineBetween(s.x+Math.cos(a)*22*1.1,s.y+Math.sin(a)*22*.55,s.x+Math.cos(b)*22*1.1,s.y+Math.sin(b)*22*.55);}
    }else this.castText.setVisible(false);
    for(const n of this.npcViews){n.actor.spr.setFrame(frameIndex('idle',Math.floor(this.time0*1.2+n.x)%2));}
  }
  private syncMonsters(){
    const w=this.world,live=new Set<number>();
    for(const m of w.monsters){
      let v=this.mons.get(m.id);
      if(m.state==='dead'){
        if(v&&!v.deadTween){v.deadTween=true;v.bar.clear();v.status.clear();
          this.tweens.add({targets:v.c,alpha:0,scaleY:.3,y:v.c.y+6,duration:420,ease:'Quad.easeIn'});}
        if(v)live.add(m.id);
        if(v&&w.time-m.deadAt>.5){v.c.destroy();v.bar.destroy();v.status.destroy();this.mons.delete(m.id);live.delete(m.id);}
        continue;
      }
      live.add(m.id);
      if(v&&v.deadTween){v.c.destroy();v.bar.destroy();v.status.destroy();this.mons.delete(m.id);v=undefined;}
      if(!v){
        const S=monsterSize(m.def.art),key=this.tex(`mon:${m.def.id}`,()=>drawMonsterSheet(m.def.art),{w:S,h:S,cols:MONSTER_FRAMES,rows:1});
        const shadow=this.add.ellipse(0,0,S*.36,S*.12,0x1a2a10,.28);
        const spr=this.add.sprite(0,0,key,0).setOrigin(.5,1-4/S).setScale(.5);
        const c=this.add.container(0,0,[shadow,spr]);c.setAlpha(0);this.tweens.add({targets:c,alpha:1,duration:300});
        const bar=this.add.graphics(),status=this.add.graphics();this.layer.add([c,bar,status]);
        v={c,spr,shadow,key,bar,status,lastX:m.x,lastY:m.y,walk:0};this.mons.set(m.id,v);
      }
      const pos=this.lerp(m),s=toScreen(pos.x,pos.y);
      const moved=Math.hypot(pos.x-v.lastX,pos.y-v.lastY);v.walk+=moved;v.lastX=pos.x;v.lastY=pos.y;
      const flying=m.def.art.kind==='bee'||m.def.art.kind==='bat';
      let frame=monsterFrame('idle',Math.floor(flying?this.time0*10:moved>.001?v.walk/.25:this.time0*3+m.id)%4);
      if(w.time-m.attackAt<.35)frame=monsterFrame('attack',w.time-m.attackAt<.15?0:1);
      if(w.time-m.hitAt<.18)frame=monsterFrame('hurt',0);
      const toPlayerX=toScreen(w.player.x,w.player.y).x-s.x,moveX=toScreen(m.x,m.y).x-toScreen(m.px,m.py).x;
      const faceLeft=Math.abs(moveX)>.01?moveX<0:toPlayerX<0;
      v.spr.setFrame(frame).setFlipX(faceLeft);
      const hit=w.time-m.hitAt<.12;
      if(m.frozenUntil>w.time)v.spr.setTint(0xa8e4ff);else if(hit)v.spr.setTintFill(0xffffff);else if(m.rootUntil>w.time)v.spr.setTint(0xb8f0a0);else if(m.slowUntil>w.time)v.spr.setTint(0xd0e4ff);else v.spr.clearTint();
      v.c.setPosition(s.x,s.y).setDepth(s.y);v.shadow.setPosition(0,0);
      const S=monsterSize(m.def.art)*.5;
      v.bar.clear();v.bar.setDepth(s.y+.5);
      const showBar=m.hp<m.maxHp||this.hoverMonster===m.id||(w.player.target?.kind==='monster'&&w.player.target.id===m.id);
      if(showBar){const bw=Math.max(36,S*.55),bx=s.x-bw/2,by=s.y+4;
        v.bar.fillStyle(0x10202a,.85).fillRect(bx-1,by-1,bw+2,6).fillStyle(m.def.mvp?0xff6b4a:0x48d848,1).fillRect(bx,by,bw*m.hp/m.maxHp,4);}
      if(w.player.target?.kind==='monster'&&w.player.target.id===m.id){v.bar.lineStyle(2,0xffd45c,.9).strokeEllipse(s.x,s.y,S*.62,S*.24);}
      v.status.clear();v.status.setDepth(s.y+1);
      if(m.stunUntil>w.time)for(let i=0;i<3;i++){const a=this.time0*5+i/3*Math.PI*2;v.status.fillStyle(0xffe26b,1).fillCircle(s.x+Math.cos(a)*14,s.y-S*.86+Math.sin(a)*4,3);}
      if(m.frozenUntil>w.time){v.status.fillStyle(0xcff0ff,.35).fillRoundedRect(s.x-S*.32,s.y-S*.78,S*.64,S*.78,6).lineStyle(2,0xffffff,.7).strokeRoundedRect(s.x-S*.32,s.y-S*.78,S*.64,S*.78,6);}
      if(m.provoke){v.status.fillStyle(0xff4a4a,1).fillTriangle(s.x-5,s.y-S*.9-14,s.x+5,s.y-S*.9-14,s.x,s.y-S*.9-2);}
      if(m.dots.some(d=>d.until>w.time))v.status.fillStyle(0x9b59d0,.7).fillCircle(s.x+S*.22,s.y-S*.75,3.5);
    }
    for(const [id,v] of this.mons)if(!live.has(id)){v.c.destroy();v.bar.destroy();v.status.destroy();this.mons.delete(id);}
  }
  /** v4.6 chests in the 2D fallback renderer: a small drawn box with a tier colour. */
  private syncChests(){
    const present=new Set<number>();
    for(const c of this.world.chests){present.add(c.id);if(this.chestViews.has(c.id))continue;
      const s=toScreen(c.x,c.y),col={normal:0x9a6a3e,rare:0xe0a82a,trial:0x6a4fd6,supply:0x7d8a5a,eclipse:0x6a1a3a}[c.tier],band=c.tier==='normal'||c.tier==='supply'?0xc9b37a:0xffe27a;
      const g=this.add.graphics();g.fillStyle(0x000000,.25).fillEllipse(0,0,30,9);g.fillStyle(col,1).fillRect(-13,-18,26,16);g.fillStyle(col,1).fillRoundedRect(-13,-24,26,8,4);
      g.fillStyle(band,1).fillRect(-9,-24,3,22).fillRect(6,-24,3,22).fillRect(-2,-15,4,5);g.lineStyle(1.5,0x3a2a18,1).strokeRect(-13,-18,26,16);
      const label=this.add.text(0,-38,{normal:'寶箱',rare:'★ 稀有寶箱',trial:'✦ 試煉寶箱',supply:'補給箱',eclipse:'🌑 星蝕寶箱'}[c.tier],{fontFamily:'"PingFang TC",sans-serif',fontSize:'11px',color:c.tier==='rare'?'#ffe27a':c.tier==='trial'?'#e4c9ff':'#fff3c4',stroke:'#000',strokeThickness:3}).setOrigin(.5,0);
      const box=this.add.container(s.x,s.y,[g,label]);box.setDepth(s.y);this.layer.add(box);this.chestViews.set(c.id,box);}
    for(const [id,b] of this.chestViews)if(!present.has(id)){b.destroy();this.chestViews.delete(id);}
  }
  private syncLoot(){
    const present=new Set<number>();
    for(const it of this.world.items){
      present.add(it.id);let c=this.loot.get(it.id);
      if(!c){
        const key=it.kind==='card'?this.cardTexture():this.itemTexture(it.defId);
        const s=toScreen(it.x,it.y);
        const img=this.add.image(0,0,key).setScale(.5).setOrigin(.5,1);
        c=this.add.container(s.x,s.y,[img]);c.setDepth(s.y-1);this.layer.add(c);this.loot.set(it.id,c);
        c.y-=24;this.tweens.add({targets:c,y:s.y,duration:420,ease:'Bounce.easeOut'});
      }
      if(it.kind==='card'){const g=c.getData('glow') as Phaser.GameObjects.Graphics|undefined;
        if(!g){const gg=this.add.graphics();c.addAt(gg,0);c.setData('glow',gg);}
        const gg=c.getData('glow') as Phaser.GameObjects.Graphics;gg.clear();const a=.35+Math.sin(this.time0*5)*.2;gg.fillStyle(0xfff3a8,a).fillCircle(0,-10,16);}
    }
    for(const [id,c] of this.loot)if(!present.has(id)){c.destroy();this.loot.delete(id);}
  }
  private itemTexture(id:string){return this.tex(`item:${id}`,()=>itemIconCanvas(id));}
  private cardTexture(){return this.tex('item:card',()=>cardIconCanvas());}
  private drawWarps(){
    const g=this.warpGfx;g.clear();
    for(const wp of this.world.map.def.warps){
      const s=toScreen(wp.x+.5,wp.y+.5);g.setDepth(s.y-5);
      for(let i=0;i<4;i++){const r=1-((this.time0*.6+i/4)%1);g.lineStyle(3,0x9fe0ff,.25+r*.6).strokeEllipse(s.x,s.y,TW*1.3*r,TH*1.3*r);}
      for(let i=0;i<10;i++){const a=this.time0*2+i/10*Math.PI*2,h=(this.time0*30+i*13)%50;g.fillStyle(0xdff6ff,.9-h/60).fillCircle(s.x+Math.cos(a)*26,s.y+Math.sin(a)*12-h,2);}
      g.fillStyle(0x6fc3ff,.25).fillEllipse(s.x,s.y,TW*1.2,TH*1.2);
    }
  }
  private hover(){
    if(this.hooks.inputBlocked()){this.hooks.onHover(null);return;}
    const p=this.input.activePointer,s=this.pointerScreen(p),m=this.monsterAt(s.x,s.y);
    this.hoverMonster=m?.id??null;
    const canvasEl=this.game.canvas;
    if(this.targeting){canvasEl.style.cursor='crosshair';this.hooks.onHover(`選擇${skills[this.targeting].target==='ground'?'地點':'目標'}：${skills[this.targeting].name}（右鍵取消）`);
      if(skills[this.targeting].target==='ground'){const w=this.pointerWorld(p),c=toScreen(w.x,w.y),r=this.targeting==='thunderStorm'?2.5:1.6;
        this.fxG.lineStyle(2,0x9fe0ff,.8).strokeEllipse(c.x,c.y,r*TW*1.4,r*TH*1.4);}
      return;}
    if(m){canvasEl.style.cursor='pointer';this.hooks.onHover(`${m.def.name} Lv.${m.def.level}${m.def.mvp?' 【MVP】':''}${m.def.aggressive?' · 主動':''}`);return;}
    const it=this.itemAt(s.x,s.y);if(it){canvasEl.style.cursor='pointer';this.hooks.onHover(it.kind==='card'?`${cards[it.defId].name}`:items[it.defId].name);return;}
    const n=this.npcAt(s.x,s.y);if(n){canvasEl.style.cursor='pointer';this.hooks.onHover(`${this.world.map.def.npcs.find(x=>x.id===n.id)!.name}（點擊對話）`);return;}
    canvasEl.style.cursor='default';this.hooks.onHover(null);
  }

  // ———————————————————————— feedback ————————————————————————
  private play(ev:SimEvent[]){
    const now=this.time.now;
    for(const e of ev){
      if(e.t==='dmg')this.damageNumber(e);
      else if(e.t==='heal'){const s=toScreen(e.x,e.y);this.floatText(s.x,s.y-70,`+${e.amount}`,e.sp?'#7fb8ff':'#7dff8a',16);}
      else if(e.t==='fx'){if(e.kind==='slam')this.cameras.main.shake(160,.003);const s=toScreen(e.x,e.y),t=e.tx!==undefined?toScreen(e.tx,e.ty!):undefined;
        this.fx.push({kind:e.kind,born:now,dur:Math.max(1,e.dur*1000+(e.kind==='warn'?0:e.kind==='bolt'||e.kind==='thunder'?250:300)),x:s.x,y:s.y,tx:t?.x,ty:t?.y,r:e.r,shape:e.shape,angle:e.angle,length:e.length,attackType:e.attackType,color:elementColor[e.element??'neutral']});}
      else if(e.t==='castStart')this.castInfo={skill:e.skill,start:now,dur:e.dur*1000};
      else if(e.t==='castEnd')this.castInfo=null;
      else if(e.t==='kill'){const s=toScreen(e.x,e.y);for(let i=0;i<8;i++)this.fx.push({kind:'puff',born:now+i*15,dur:500,x:s.x,y:s.y-14,tx:s.x+Math.cos(i)*26,ty:s.y-20+Math.sin(i)*12,color:0xffffff});}
      else if(e.t==='status'&&e.kind==='freeze'){const m=this.mons.get(e.id);if(m)this.floatText(m.c.x,m.c.y-50,'冰凍！','#a8e4ff',14);}
      else if(e.t==='status'&&e.kind==='stun'){const m=this.mons.get(e.id);if(m)this.floatText(m.c.x,m.c.y-50,'暈眩！','#ffe26b',14);}
      else if(e.t==='fail')this.floatText(this.player.c.x,this.player.c.y-96,e.reason,'#ffd0d0',13);
    }
  }
  private damageNumber(e:Extract<SimEvent,{t:'dmg'}>){
    const s=toScreen(e.x,e.y),up=e.to==='m'?60:72;
    if(e.miss){this.floatText(s.x,s.y-up,'Miss','#c9d7ff',15,true);return;}
    if(e.to==='p'){this.hurtUntil=this.time.now+140;this.floatText(s.x,s.y-up,`${e.amount}`,'#ff5a5a',20,true);if(e.absorbed)this.floatText(s.x+20,s.y-up-14,`吸收 ${e.absorbed}`,'#9fe0ff',12);this.cameras.main.shake(90,.0025);return;}
    if(e.src==='attack'){this.fx.push({kind:'impact',born:this.time.now,dur:180,x:s.x,y:s.y-28,color:e.crit?0xffdc78:0xfff7df});}
    const crit=!!e.crit,size=crit?26:e.src==='venom'?14:20;
    if(crit){this.fx.push({kind:'critStar',born:this.time.now,dur:420,x:s.x,y:s.y-up+6,color:0xffe26b});}
    this.floatText(s.x+(Math.random()-.5)*10,s.y-up,`${e.amount}`,crit?'#ffe26b':e.src==='venom'?'#d8a8ff':'#ffffff',size,true);
  }
  floatText(x:number,y:number,text:string,color:string,size:number,arc=false){
    const t=this.add.text(x,y,text,{fontFamily:'"Trebuchet MS","PingFang TC",sans-serif',fontSize:`${size}px`,fontStyle:'bold',color,stroke:'#1a1020',strokeThickness:4}).setOrigin(.5).setDepth(2000000);
    this.layer.add(t);
    const dx=arc?(Math.random()<.5?-1:1)*(18+Math.random()*14):0;
    t.setScale(1.5);
    this.tweens.add({targets:t,scale:1,duration:140,ease:'Back.easeOut'});
    this.tweens.add({targets:t,x:x+dx,duration:900,ease:'Sine.easeOut'});
    this.tweens.add({targets:t,y:y-34,duration:900,ease:'Cubic.easeOut'});
    this.tweens.add({targets:t,alpha:0,delay:550,duration:350,onComplete:()=>t.destroy()});
  }
  levelUp(kind:'base'|'job'){
    const p=this.player.c,col=kind==='base'?0xffe26b:0x9fd5ff,now=this.time.now;
    this.fx.push({kind:'pillar',born:now,dur:1500,x:p.x,y:p.y,color:col});
    const t=this.add.text(p.x,p.y-120,kind==='base'?'LEVEL UP!':'JOB LEVEL UP!',{fontFamily:'"Trebuchet MS",sans-serif',fontSize:'24px',fontStyle:'bold',color:kind==='base'?'#ffe26b':'#9fd5ff',stroke:'#3a2a10',strokeThickness:5}).setOrigin(.5).setDepth(2000001);
    this.layer.add(t);t.setScale(.4);
    this.tweens.add({targets:t,scale:1.1,duration:300,ease:'Back.easeOut'});
    this.tweens.add({targets:t,y:t.y-30,alpha:0,delay:1100,duration:500,onComplete:()=>t.destroy()});
  }
  private drawFx(){
    const g=this.fxG,now=this.time.now;g.clear();
    this.fx=this.fx.filter(f=>now-f.born<f.dur);
    for(const f of this.fx){
      const t=Math.max(0,(now-f.born)/f.dur);if(now<f.born)continue;
      switch(f.kind){
        case 'marker':g.lineStyle(2,0xffffff,1-t).strokeEllipse(f.x,f.y,20+t*14,10+t*7);break;
        case 'bolt':{const fall=Math.min(1,t*1.6),y0=f.y-260,yy=y0+(f.y-30-y0)*fall;
          if(fall<1){g.lineStyle(7,f.color,.35).lineBetween(f.x+18,yy-60,f.x,yy);g.lineStyle(3,0xffffff,.9).lineBetween(f.x+12,yy-40,f.x,yy);g.fillStyle(f.color,1).fillCircle(f.x,yy,6);}
          else{const k=(t*1.6-1)/.6;g.fillStyle(f.color,.6*(1-k)).fillEllipse(f.x,f.y-14,40+k*30,20+k*14);}break;}
        case 'thunder':{if(t<.45){g.lineStyle(4,0xfff6a0,1-t*2);let x=f.x,y=f.y-280;for(let i=0;i<7;i++){const nx=f.x+(Math.random()-.5)*24,ny=y+40;g.lineBetween(x,y,nx,ny);x=nx;y=ny;}g.lineBetween(x,y,f.x,f.y-10);}
          g.fillStyle(0xfff6a0,.5*(1-t)).fillEllipse(f.x,f.y,50,24);break;}
        case 'arrow':{if(f.tx===undefined)break;const k=Math.min(1,t*1.25),x=f.x+(f.tx-f.x)*k,y=f.y-36+(f.ty!-f.y)*k-Math.sin(k*Math.PI)*24;
          if(k<1){const a=Math.atan2(f.ty!-f.y,f.tx-f.x);g.lineStyle(2.5,0x8b5a36,1).lineBetween(x-Math.cos(a)*16,y-Math.sin(a)*16,x,y);g.fillStyle(0xe8eef4,1).fillTriangle(x+Math.cos(a)*5,y+Math.sin(a)*5,x-Math.sin(a)*3,y+Math.cos(a)*3,x+Math.sin(a)*3,y-Math.cos(a)*3);}break;}
        case 'impact':{g.lineStyle(2.5,f.color,1-t);for(let i=0;i<5;i++){const a=i/5*Math.PI*2;g.lineBetween(f.x+Math.cos(a)*5,f.y+Math.sin(a)*5,f.x+Math.cos(a)*(10+t*13),f.y+Math.sin(a)*(10+t*13));}break;}
        case 'warn':{if(f.shape==='line'){this.drawLineZone(g,f,.18+.2*t);break;}const r=(f.r??2)*TW*.7,k=t;g.fillStyle(0xff3030,.12+.25*k).fillEllipse(f.x,f.y,r*2*k,r*k);
          g.lineStyle(3,0xff4040,.5+.5*Math.abs(Math.sin(t*18))).strokeEllipse(f.x,f.y,r*2,r);break;}
        case 'slam':{if(f.shape==='line'){this.drawLineZone(g,f,.7*(1-t));break;}const r=(f.r??2)*TW*.7*(.6+t*.6);g.fillStyle(0xfff0c0,.6*(1-t)).fillEllipse(f.x,f.y,r*2,r);g.lineStyle(5,0xff8a3d,1-t).strokeEllipse(f.x,f.y,r*2.2,r*1.1);
          for(let i=0;i<8;i++){const a=i/8*Math.PI*2;g.fillStyle(0x9a8c7b,1-t).fillCircle(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r*.5-Math.sin(t*Math.PI)*30,4);}break;}
        case 'summon':{const r=(f.r??2)*TW*.7*t;g.lineStyle(3,0xb07ad9,1-t).strokeEllipse(f.x,f.y,r*2,r);g.lineStyle(2,0xffffff,.8*(1-t)).strokeEllipse(f.x,f.y,r*1.4,r*.7);break;}
        case 'orb':{if(f.tx===undefined)break;const k=Math.min(1,t*1.15),x=f.x+(f.tx-f.x)*k,y=f.y-40+(f.ty!-f.y+10)*k-Math.sin(k*Math.PI)*12;
          if(k<1){g.fillStyle(0xbfa2ff,.35).fillCircle(x,y,9);g.fillStyle(0xe8dcff,1).fillCircle(x,y,4.5);for(let i=1;i<4;i++){const kk=Math.max(0,k-i*.06);g.fillStyle(0xbfa2ff,.5-i*.12).fillCircle(f.x+(f.tx-f.x)*kk,f.y-40+(f.ty!-f.y+10)*kk-Math.sin(kk*Math.PI)*12,4-i);}}break;}
        case 'fireball':{if(f.tx===undefined)break;const k=Math.min(1,t*1.2),x=f.x+(f.tx-f.x)*k,y=f.y-40+(f.ty!-f.y)*k-Math.sin(k*Math.PI)*40;
          if(k<1){g.fillStyle(0xff7a3d,.4).fillCircle(x,y,14);g.fillStyle(0xffd27a,1).fillCircle(x,y,8);g.fillStyle(0xffffff,.9).fillCircle(x,y,3.5);}break;}
        case 'frost':{if(f.tx===undefined)break;const k=Math.min(1,t*2),x=f.x+(f.tx-f.x)*k,y=f.y-30+(f.ty!-f.y)*k;
          for(let i=0;i<4;i++){const kk=Math.max(0,k-i*.08),xx=f.x+(f.tx-f.x)*kk,yy=f.y-30+(f.ty!-f.y)*kk;g.fillStyle(0xbfe8ff,.9-i*.2).fillTriangle(xx,yy-10,xx-5,yy+4,xx+5,yy+4);}void x;void y;break;}
        case 'explode':case 'magnum':{const r=(f.r??2)*TW*.7*(.4+t*.8);g.fillStyle(0xff7a3d,.5*(1-t)).fillEllipse(f.x,f.y,r*2,r);g.lineStyle(4,0xffd27a,1-t).strokeEllipse(f.x,f.y,r*2.2,r*1.1);
          for(let i=0;i<10;i++){const a=i/10*Math.PI*2;g.fillStyle(0xffb050,1-t).fillCircle(f.x+Math.cos(a)*r,f.y+Math.sin(a)*r*.5-t*30,4*(1-t)+1);}break;}
        case 'echo':case 'pulse':{const r=(f.r??2)*TW*.7*(.3+t);g.lineStyle(3,f.kind==='echo'?0xffb3e0:0xff9ec4,1-t).strokeEllipse(f.x,f.y,r*2,r);break;}
        case 'arrowRain':{for(let i=0;i<12;i++){const a=i*2.4,rx=Math.cos(a)*((i%3)+1)*16,ry=Math.sin(a)*((i%3)+1)*8,k=Math.min(1,t*2.5+i*.03),y=f.y+ry-160*(1-k);
          g.lineStyle(2,0x8b5a36,k<1?1:1-t).lineBetween(f.x+rx+10*(1-k),y-14,f.x+rx,y);}break;}
        case 'bash':g.lineStyle(5,0xffffff,1-t).beginPath().arc(f.x,f.y-30,26+t*10,-2.4,-.4).strokePath();g.fillStyle(0xfff6c0,.6*(1-t)).fillCircle(f.x,f.y-30,14*(1-t)+4);break;
        case 'chain':if(f.tx!==undefined){g.lineStyle(3,0xc9d7ff,1-t);let x=f.x,y=f.y-30;for(let i=1;i<=4;i++){const k=i/4,nx=f.x+(f.tx-f.x)*k+(i<4?(Math.random()-.5)*14:0),ny=f.y-30+(f.ty!-f.y)*k+(i<4?(Math.random()-.5)*14:0);g.lineBetween(x,y,nx,ny);x=nx;y=ny;}}break;
        case 'shatter':for(let i=0;i<10;i++){const a=i/10*Math.PI*2;g.fillStyle(0xcff0ff,1-t).fillTriangle(f.x+Math.cos(a)*t*60,f.y-20+Math.sin(a)*t*30,f.x+Math.cos(a)*t*60+5,f.y-20+Math.sin(a)*t*30+8,f.x+Math.cos(a)*t*60-5,f.y-20+Math.sin(a)*t*30+8);}break;
        case 'heal':case 'buff':case 'shield':{const col=f.kind==='shield'?0x9fe0ff:f.kind==='heal'?0x7dff8a:0xffe26b;
          for(let i=0;i<10;i++){const a=i/10*Math.PI*2+t*3,h=t*70;g.fillStyle(col,1-t).fillCircle(f.x+Math.cos(a)*22,f.y-h+Math.sin(a)*8,2.5);}
          g.lineStyle(2,col,.8*(1-t)).strokeEllipse(f.x,f.y,50+t*20,24+t*10);break;}
        case 'provoke':g.fillStyle(0xff4a4a,1-t).fillCircle(f.x,f.y-70-t*20,7);break;
        case 'venom':g.fillStyle(0x9b59d0,.7*(1-t)).fillCircle(f.x,f.y-30-t*20,5);break;
        case 'puff':if(f.tx!==undefined){const k=t;g.fillStyle(0xffffff,.7*(1-k)).fillCircle(f.x+(f.tx-f.x)*k,f.y+(f.ty!-f.y)*k-k*10,6*(1-k)+2);}break;
        case 'critStar':{const r=22*(.6+t*.6);g.fillStyle(0xff9a3d,.8*(1-t));g.beginPath();for(let i=0;i<16;i++){const a=i/16*Math.PI*2,rr=i%2?r*.5:r;g.lineTo(f.x+Math.cos(a)*rr,f.y+Math.sin(a)*rr*.8);}g.closePath();g.fillPath();break;}
        case 'pillar':{const a=t<.2?t/.2:1-(t-.2)/.8;g.fillStyle(f.color,.25*a).fillRect(f.x-26,f.y-400,52,400);g.fillStyle(0xffffff,.35*a).fillRect(f.x-8,f.y-400,16,400);
          for(let i=0;i<14;i++){const h=((t*400+i*37)%400);g.fillStyle(0xffffff,a).fillCircle(f.x+Math.sin(i*1.7+t*6)*22,f.y-h,2);}
          g.lineStyle(3,f.color,a).strokeEllipse(f.x,f.y,70+t*40,35+t*20);break;}
      }
    }
    void TH;
  }
  setNavigation(target:{x:number;y:number;label:string}){this.navigation=target;}
  clearNavigation(){this.navigation=null;this.routeG?.clear();this.routeLabel?.setVisible(false);}
  private drawRoute(){
    const g=this.routeG;g.clear();if(!this.navigation){this.routeLabel.setVisible(false);return;}
    const target=this.navigation,s=toScreen(target.x,target.y),pl=this.world.player;
    if(Math.hypot(pl.x-target.x,pl.y-target.y)<1.1){this.clearNavigation();return;}
    const pts=[this.lerp(pl),...pl.path];g.lineStyle(2,0xffe9aa,.6);
    for(let i=1;i<pts.length;i++){const a=toScreen(pts[i-1].x,pts[i-1].y),b=toScreen(pts[i].x,pts[i].y);g.lineBetween(a.x,a.y,b.x,b.y);}
    const pulse=1+Math.sin(this.time0*3)*.15;g.lineStyle(3,0xffe5a1,.9).strokeEllipse(s.x,s.y,40*pulse,20*pulse);
    this.routeLabel.setText(target.label).setPosition(s.x,s.y-44).setVisible(true);
  }
  private updateOcclusion(){
    const p=this.player.c;
    for(const img of this.propImgs){if(!img.getData('occludes'))continue;
      const left=img.x-img.displayWidth*img.originX,top=img.y-img.displayHeight*img.originY;
      const occludes=img.depth>p.depth&&p.x>left-10&&p.x<left+img.displayWidth+10&&p.y-48>top&&p.y-48<top+img.displayHeight;
      img.setAlpha(occludes?.28:1);
    }
  }
  private drawLineZone(g:Phaser.GameObjects.Graphics,f:{x:number;y:number;angle?:number;length?:number;r?:number;attackType?:string},alpha:number){
    const a=f.angle??0,l=f.length??6,r=f.r??1;
    const dir={x:Math.cos(a),y:Math.sin(a)},side={x:-dir.y*r,y:dir.x*r};
    const points=[{x:side.x,y:side.y},{x:dir.x*l+side.x,y:dir.y*l+side.y},{x:dir.x*l-side.x,y:dir.y*l-side.y},{x:-side.x,y:-side.y}].map(p=>{const s=toScreen(p.x,p.y);return {x:f.x+s.x,y:f.y+s.y};});
    const col=f.attackType==='magic'?0xb082e8:0xe97152;g.fillStyle(col,alpha).lineStyle(3,col,.9).beginPath().moveTo(points[0].x,points[0].y);for(const p of points.slice(1))g.lineTo(p.x,p.y);g.closePath().fillPath().strokePath();
  }
  get currentMap(){return this.mapId;}
}


export function createGame(parent:HTMLElement,scene:GameScene):Phaser.Game{
  const forceCanvas=new URLSearchParams(location.search).get('renderer')==='canvas';
  return new Phaser.Game({
    type:forceCanvas?Phaser.CANVAS:Phaser.AUTO,parent,backgroundColor:'#2a3a2a',
    scale:{mode:Phaser.Scale.RESIZE,width:'100%',height:'100%'},
    render:{antialias:true,roundPixels:false,powerPreference:'high-performance'},
    scene:[scene],banner:false,fps:{smoothStep:true},
  });
}
