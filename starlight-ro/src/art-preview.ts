// Dev-only page for eyeballing procedural art (not part of the game build).
import { drawCharacterSheet, CW, CH, FRAME_COUNT } from './render/art/characters';
import { drawMonsterSheet, monsterSize, MONSTER_FRAMES } from './render/art/monsters';
import { paintChunk, paintProp } from './render/art/world';
import { itemIcon, skillIcon, cardIcon } from './render/art/icons';
import { monsters } from './data/monsters';
import { items, cards } from './data/items';
import { skills } from './data/jobs';
import { buildMap } from './world/mapgen';
import { hairColors } from './rules/state';
const root=document.getElementById('root')!;
const section=(t:string)=>{const h=document.createElement('h2');h.textContent=t;root.append(h);const d=document.createElement('div');d.className='row';root.append(d);return d;};
const show=(parent:HTMLElement,c:HTMLCanvasElement,scale=.5)=>{c.style.width=`${c.width*scale}px`;parent.append(c);};
const big=section('放大檢查');
for(const [outfit,hair,col] of [['novice',0,0],['swordman',1,2],['mage',2,6],['archer',3,1]] as const){
  const sheet=drawCharacterSheet({outfit,hair,hairColor:hairColors[col],weapon:outfit==='mage'?'staff':outfit==='archer'?'bow':outfit==='swordman'?'sword':'dagger'});
  for(const [r,f] of [[0,0],[1,3],[2,2],[4,0],[0,7],[0,9],[0,11],[0,12]]){const c=document.createElement('canvas');c.width=CW;c.height=CH;c.getContext('2d')!.drawImage(sheet,f*CW,r*CH,CW,CH,0,0,CW,CH);c.style.width='96px';big.append(c);}
}
const chars=section('角色（S/SE/E/NE/N × 13 格）');
for(const [outfit,hair,col] of [['novice',0,0],['swordman',1,2],['mage',2,6],['archer',3,1]] as const)show(chars,drawCharacterSheet({outfit,hair,hairColor:hairColors[col],weapon:outfit==='mage'?'staff':outfit==='archer'?'bow':outfit==='swordman'?'sword':'dagger'}),.42);
void CW;void CH;void FRAME_COUNT;
const mons=section('怪物');
for(const m of Object.values(monsters))show(mons,drawMonsterSheet(m.art),m.art.scale>2?.25:.5);
void monsterSize;void MONSTER_FRAMES;
const ground=section('地面區塊');
for(const id of ['town','meadow','forest','cave']){const m=buildMap(id);show(ground,paintChunk(m,16,16).canvas,.5);}
const props=section('物件');
for(const [kind,theme,w,h] of [['tree','town'],['tree','meadow'],['pine','forest'],['bigTree','forest'],['bush','meadow'],['rock','meadow'],['flower','meadow'],['tuft','meadow'],['mushroom','forest'],['log','meadow'],['lamp','town'],['fountain','town'],['house','town',7,6],['house','town',5,5],['stall','town'],['sign','town'],['crystal','cave'],['stalagmite','cave'],['caveWall','cave']] as const)
  show(props,paintProp({kind:kind as never,x:0,y:0,v:1,w,h},theme).canvas,.5);
const icons=section('圖示');
for(const id of Object.keys(items)){const i=new Image();i.src=itemIcon(id);i.title=id;icons.append(i);}
for(const id of Object.keys(skills)){const i=new Image();i.src=skillIcon(id);i.title=id;icons.append(i);}
for(const id of Object.keys(cards)){const i=new Image();i.src=cardIcon(id);icons.append(i);}
