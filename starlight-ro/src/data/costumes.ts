// Cosmetic costumes (外觀): purely visual, never change stats. Sold by the stylist NPC or earned.
export type CostumeSlot='head'|'back';
export type CostumeDef={id:string;name:string;slot:CostumeSlot;price:number;desc:string;color:string;accent?:string;unlock?:string};
export const costumes:Record<string,CostumeDef>=Object.fromEntries(([
  {id:'catEars',name:'貓咪耳朵',slot:'head',price:3000,desc:'毛茸茸的貓耳，會跟著心情抖動。',color:'#f2c9a0',accent:'#ff9ec4'},
  {id:'bunnyEars',name:'白兔耳朵',slot:'head',price:3000,desc:'長長的兔耳，走路時一晃一晃。',color:'#ffffff',accent:'#ffb3c8'},
  {id:'ribbon',name:'大蝴蝶結',slot:'head',price:1500,desc:'可愛的大紅蝴蝶結。',color:'#e8524a',accent:'#ffd0d0'},
  {id:'flowerCrown',name:'花冠',slot:'head',price:2500,desc:'晨光草原的花編成的花冠。',color:'#7fc25a',accent:'#ff9ec4'},
  {id:'devilHorns',name:'小惡魔角',slot:'head',price:4000,desc:'有點調皮的小角。',color:'#5a2a6a',accent:'#ff6b9a'},
  {id:'halo',name:'天使光環',slot:'head',price:8000,desc:'閃閃發光的光環。',color:'#fff3a8',accent:'#ffffff'},
  {id:'starHat',name:'星星魔女帽',slot:'head',price:6000,desc:'掛著星星的大魔女帽。',color:'#3a3a8a',accent:'#ffd45c'},
  {id:'angelWings',name:'天使之翼',slot:'back',price:12000,desc:'潔白的羽翼，會慢慢拍動。',color:'#ffffff',accent:'#cfe7ff'},
  {id:'fairyWings',name:'精靈薄翼',slot:'back',price:9000,desc:'半透明、帶著彩虹光澤的翅膀。',color:'#bfe8ff',accent:'#ffb3f0'},
  {id:'devilWings',name:'小惡魔翅膀',slot:'back',price:9000,desc:'小小的蝙蝠翅膀。',color:'#4a2a5a',accent:'#ff6b9a'},
  {id:'heroCape',name:'英雄披風',slot:'back',price:5000,desc:'隨風飄揚的長披風。',color:'#c8443e',accent:'#ffd45c'},
  {id:'jellyBag',name:'噗噗背包',slot:'back',price:0,desc:'完成「果凍國王討伐」的紀念品。',color:'#ff9ec4',accent:'#ffe3ef',unlock:'jellyKing'},
] as CostumeDef[]).map(c=>[c.id,c]));
export const costumeShop=Object.values(costumes).filter(c=>!c.unlock).map(c=>c.id);
