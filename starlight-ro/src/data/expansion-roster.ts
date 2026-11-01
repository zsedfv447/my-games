import type {CardDef} from './items';
import type {MonsterDef} from './monsters';
import {expansionEquipment} from './expansion-equipment';

type Role='sturdy'|'swift'|'striker'|'caster';
type Variant={id:string;name:string;map:'meadow'|'forest'|'cave'|'ruins';base:string;lv:number;module:string;role:Role;color:string};
const v=(id:string,name:string,map:Variant['map'],base:string,lv:number,module:string,role:Role,color:string):Variant=>({id:`exp_${id}`,name,map,base,lv,module,role,color});
/** These are biome variants of the existing creatures, never new combat AI branches.
 * Distinct routes unlock existing modules; cards with different ids cannot upgrade one another. */
export const expansionVariants:Variant[]=[
  v('dewJelly','晨露果凍','meadow','jelly',2,'leech','sturdy','#ade9cf'),
  v('amberJelly','琥珀果凍','meadow','jelly',4,'spSaver','caster','#e8b963'),
  v('silkWorm','吐絲綠蟲','meadow','worm',4,'snare','sturdy','#a9cb75'),
  v('reedWorm','蘆葦幼蟲','meadow','worm',6,'snare','swift','#d0bb72'),
  v('bellShroom','鈴傘菇','meadow','shroom',6,'echo','caster','#bfa3e5'),
  v('redcapShroom','赤傘菇','meadow','shroom',8,'echo','striker','#cd6c55'),
  v('reedChick','蘆葦雛雞','meadow','chick',7,'feather','swift','#c2b282'),
  v('goldChick','金羽雛雞','meadow','chick',9,'feather','sturdy','#e5be55'),
  v('mintJelly','薄荷果凍','meadow','blueJelly',8,'spSaver','caster','#81d4bd'),
  v('mossWorm','苔背幼蟲','meadow','worm',10,'leech','sturdy','#6c9d73'),
  v('briarWolf','荊棘狼','forest','wolf',12,'chain','striker','#8d8781'),
  v('duskWolf','暮影狼','forest','wolf',16,'keen','swift','#777192'),
  v('amberBee','琥珀蜂','forest','bee',11,'venom','sturdy','#cda450'),
  v('needleBee','長針蜂','forest','bee',15,'venom','striker','#b8bb54'),
  v('vineSapling','藤蔓樹苗精','forest','sapling',14,'root','sturdy','#6ba284'),
  v('cedarSapling','杉木樹苗精','forest','sapling',18,'regrowth','caster','#719981'),
  v('brookWisp','溪畔精靈','forest','wisp',13,'manaRefund','caster','#79cdd5'),
  v('duskWisp','暮光精靈','forest','wisp',19,'delayCut','swift','#c9a7e4'),
  v('emberFox','餘燼狐','forest','fox',16,'fatal','striker','#d58a67'),
  v('fernFox','蕨尾狐','forest','fox',20,'pierce','swift','#ab9a68'),
  v('quartzBat','石英蝙蝠','cave','bat',19,'keen','swift','#bac9e3'),
  v('echoBat','鳴晶蝙蝠','cave','bat',23,'echo','caster','#9fafe3'),
  v('powderBunny','細雪兔','cave','bunny',20,'frostbite','swift','#d9eaf1'),
  v('hailBunny','冰雹兔','cave','bunny',24,'frostbite','sturdy','#9bbbd2'),
  v('slateGolem','板岩魔像','cave','golem',24,'quake','sturdy','#828e9a'),
  v('quartzGolem','晶簇魔像','cave','golem',28,'shatter','striker','#b4bddb'),
  v('rimeFox','霧凇狐','cave','iceFox',22,'pierce','swift','#c9dfe8'),
  v('glacierFox','冰河狐','cave','iceFox',27,'fatal','striker','#8fb5cb'),
  v('minuteWisp','分針妖精','cave','clockWisp',23,'quickCast','caster','#e5cb80'),
  v('hourWisp','時針妖精','cave','clockWisp',29,'spSaver','sturdy','#c0ad79'),
  v('galeWisp','陣風精靈','ruins','windWisp',30,'delayCut','swift','#9eddd6'),
  v('tempestWisp','暴風精靈','ruins','windWisp',35,'amplify','caster','#80b6d0'),
  v('eclipseBat','蝕月蝙蝠','ruins','shadowBat',31,'split','swift','#776d9d'),
  v('velvetBat','絨夜蝙蝠','ruins','shadowBat',34,'keen','striker','#9078a6'),
  v('runeGolem','符文守衛','ruins','templeGolem',34,'amplify','sturdy','#ab9fc4'),
  v('obsidianGolem','黑曜守衛','ruins','templeGolem',38,'pierce','striker','#727988'),
  v('stardustWisp','星塵精靈','ruins','windWisp',32,'manaRefund','caster','#e0c5e8'),
  v('cometWisp','彗光精靈','ruins','windWisp',39,'starfall','caster','#e9d199'),
  v('astralGolem','星砂魔像','ruins','templeGolem',36,'pulse','sturdy','#cdbf99'),
  v('fallenGolem','隕晶魔像','ruins','templeGolem',40,'shatter','striker','#b995b5'),
];
export const expansionCards:CardDef[]=expansionVariants.map(s=>({id:`${s.id}Card`,name:`${s.name}卡`,monster:s.id,moduleId:s.module,maxLevel:5}));

export function createExpansionMonsters(original:Record<string,MonsterDef>):Record<string,MonsterDef>{
  return Object.fromEntries(expansionVariants.map((s,index)=>{
    const base=original[s.base],lv=s.lv,hard=s.role==='sturdy',fast=s.role==='swift',caster=s.role==='caster';
    const hp=Math.round((45+lv*16+lv*lv*.7)*(hard?1.3:fast?.82:caster?.86:1));
    const atk=Math.round((6+lv*2.5)*(s.role==='striker'?1.15:hard?.9:1));
    // The five equipment tiers are assigned to nearby level ranges, four variants per tier.
    const tier=s.map==='meadow'?(index<5?0:1):s.map==='forest'?(index<15?1:2):s.map==='cave'?(index<25?2:3):4;
    const nearby=expansionEquipment.filter(e=>e.reqLv===[6,12,18,24,30][tier]);
    const local=index%5;
    const gearDrops=nearby.filter((_,i)=>i%5===local).map(e=>({item:e.id,rate:e.slot==='weapon'?.008:.012}));
    const loot=base.drops.slice(0,1);
    const def:MonsterDef={...base,id:s.id,name:s.name,level:lv,hp,atk:[atk,Math.round(atk*1.28)],
      def:Math.round(lv*.6)+(hard?7:fast?-2:0),mdef:Math.round(lv*.35)+(caster?12:0),
      flee:lv+10+(fast?6:0),hit:lv*2+20,exp:Math.round(3+lv*lv*.65),jexp:Math.round(3+lv*lv*.53),
      aspd:base.aspd*(fast?.85:hard?1.1:1),speed:Math.min(3.6,base.speed*(fast?1.12:hard?.85:1)),
      range:caster?3:base.range,attackType:caster?'magic':'physical',attackElement:caster?base.element:'neutral',
      aggressive:s.map!=='meadow'&&base.aggressive,mvp:false,respawn:8,cardRate:1/150,card:`${s.id}Card`,
      art:{...base.art,body:s.color,scale:base.art.scale*(hard?1.08:fast?.95:1),crown:false},drops:[...loot,...gearDrops],
    };
    return [s.id,def];
  }));
}
