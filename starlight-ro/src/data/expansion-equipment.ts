import type {EquipDef,EquipSlot,IconShape} from './items';

/** Five progression tiers. Within a tier each family trades output for tempo, survival or SP. */
export const expansionTiers=[
  {id:'dew',name:'晨露',lv:6,price:1000,color:'#8fcf85'},
  {id:'trail',name:'巡林',lv:12,price:3400,color:'#bb9964'},
  {id:'thorn',name:'荊棘',lv:18,price:6500,color:'#9f85be'},
  {id:'crystal',name:'寒晶',lv:24,price:12500,color:'#80c9eb'},
  {id:'astral',name:'星砂',lv:30,price:24000,color:'#ead397'},
];
export const expansionEquipment:EquipDef[]=expansionTiers.flatMap((t,i)=>{
  const n=i+1;
  const make=(family:string,name:string,slot:EquipSlot,shape:IconShape,accent:string,desc:string,stats:Partial<EquipDef>):EquipDef=>({
    kind:'equip',id:`exp_${t.id}_${family}`,name:`${t.name}${name}`,slot,jobs:'all',reqLv:t.lv,price:t.price,
    slots:t.lv>=24&&slot==='weapon'?2:1,icon:{shape,color:t.color,accent},desc,...stats,
  });
  const dagger=[23,35,48,62,74][i],sword=[31,44,59,77,97][i],staff=[12,20,28,35,41][i],bow=[26,38,52,67,82][i];
  const armor=[3,5,7,9,10][i],minor=[1,2,2,3,3][i];
  return [
    make('leafDagger','葉刃','weapon','dagger','#b6ef9e','輕薄葉形刃，犧牲刀身威力換取出手速度。',{weaponType:'dagger',atk:dagger,aspd:n+1,stats:{agi:1}}),
    make('fangDagger','牙匕','weapon','dagger','#fff1d9','厚刃較重，提升單擊與爆擊，沒有攻速加成。',{weaponType:'dagger',atk:dagger+6,crit:n+1}),
    make('guardSword','守備劍','weapon','sword','#a6bdcc','寬護手守住前線，傷害較低但補足生命與防禦。',{weaponType:'sword',atk:sword,hp:n*20,def:Math.ceil(n/2),jobs:['swordman']}),
    make('edgeSword','鋒刃劍','weapon','sword','#efaba4','偏重攻擊與爆擊，捨去守備劍的生命及防禦。',{weaponType:'sword',atk:sword+7,crit:n+2,jobs:['swordman']}),
    make('crystalStaff','晶簇杖','weapon','staff','#b6e7ff','晶簇縮短詠唱，魔法增幅比同階魔珠杖低。',{weaponType:'staff',atk:12+n*3,matk:staff-4,cast:n+2,jobs:['novice','mage']}),
    make('orbStaff','魔珠杖','weapon','staff','#f4b7ff','儲存魔力的圓珠，加強魔法與續航，沒有詠唱縮短。',{weaponType:'staff',atk:12+n*3,matk:staff,sp:n*10,stats:{int:1},jobs:['novice','mage']}),
    make('recurveBow','反曲弓','weapon','bow','#a9e9cc','短弓臂方便連射，單箭威力比同階長弓低。',{weaponType:'bow',atk:bow-5,aspd:n+2,jobs:['archer']}),
    make('longBow','長弓','weapon','bow','#ffe8b9','長弓臂提升單箭威力與命中，沒有攻速加成。',{weaponType:'bow',atk:bow,stats:{dex:Math.ceil(n/2)},jobs:['archer']}),
    make('guardHelm','護額','head','helm','#a6bdcc','保護額頭與生命，沒有精神力或詠唱加成。',{def:minor+1,hp:n*12}),
    make('scholarHat','研習帽','head','hat','#d6b2ef','輕布帽加強精神與魔防，物理防禦較低。',{def:Math.max(1,minor-1),mdef:n+1,sp:n*5,stats:{int:1}}),
    make('plateArmor','護衛甲','armor','armor','#a6bdcc','厚甲增加生命與防禦，沒有法袍的魔防及魔力。',{def:armor,hp:n*22,jobs:['swordman']}),
    make('focusRobe','凝神袍','armor','robe','#c2a0e8','布袍提供魔力與魔防，防禦低於同階護衛甲。',{def:Math.max(2,armor-5),mdef:n*2,sp:n*10,jobs:['mage']}),
    make('hunterVest','遊獵衣','armor','armor','#a9e9cc','方便拉弦的輕衣，以少量防禦換敏捷與靈巧。',{def:Math.max(2,armor-3),stats:{agi:1,dex:1},jobs:['archer']}),
    make('veilCape','薄紗披肩','garment','cape','#b8edb3','輕薄披肩利於閃避，防禦與魔防都較少。',{def:Math.max(1,minor-1),stats:{agi:Math.ceil(n/2)}}),
    make('wardCape','避咒披肩','garment','cape','#c2a0e8','織入抗咒紋線，補強魔防而沒有敏捷加成。',{def:minor,mdef:n+1}),
    make('sturdyBoots','厚底靴','shoes','shoes','#d3b499','厚底保護雙腳，增加防禦與生命但沒有收招加速。',{def:minor,hp:n*12}),
    make('stepShoes','踏風鞋','shoes','shoes','#a9e9cc','鞋底方便轉身，收招更快但防護較薄。',{def:Math.max(1,minor-1),delay:n+1,stats:{agi:1}}),
    make('critCharm','獵牙墜','accessory','ring','#efaba4','獵牙鼓舞攻勢，提升爆擊而沒有魔力或詠唱加成。',{crit:n+1,stats:{luk:1}}),
    make('castCharm','咒紋墜','accessory','ring','#b6e7ff','穩定咒語的刻紋，縮短詠唱而沒有攻擊加成。',{cast:n+2,sp:n*4,jobs:['mage']}),
    make('tempoCharm','節拍墜','accessory','clip','#a9e9cc','節拍協助技能銜接，縮短收招而沒有爆擊加成。',{delay:n+2,sp:n*3}),
  ];
});
/** Basic and middle tiers are sold in town; late tiers reward exploration instead. */
export const expansionShopStock=expansionEquipment.filter(e=>e.reqLv<=18).map(e=>e.id);
