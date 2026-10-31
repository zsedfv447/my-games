export const ASSISTANT_GOALS = [
  {id:'norse',label:'流派：北歐強化爆發'}, {id:'greek',label:'流派：希臘同色連鎖'}, {id:'classicbeast',label:'流派：經典獸隊'},
  { id: 'puzzle', label: '本題目標' }, { id: 'clearcolor', label: '清空指定色' }, { id: 'ring', label: '七曜環破格' }, { id: 'absorb', label: '避免傷害吸收' },
  { id: 'auto', label: '智慧判斷' }, { id: 'damage', label: '最高傷害' }, { id: 'target', label: '擊倒指定敵人' },
  { id: 'survive', label: '優先生存' }, { id: 'heal', label: '優先補血' }, { id: 'maxcombo', label: '最多 Combo' },
  { id: 'exactcombo', label: '指定 Combo' }, { id: 'color', label: '指定消珠' }, { id: 'rainbow', label: '五屬齊消' },
  { id: 'dual', label: '雙屬共鳴' }, { id: 'allattack', label: '全體攻擊' }, { id: 'chain', label: '長串貫穿' },
  { id: 'enhance', label: '強化珠增幅' }, { id: 'heartgroups', label: '多組心珠' }, { id: 'avoidcolor', label: '避免指定珠' },
  { id: 'poison', label: '避開毒珠' }, { id: 'stall', label: '存技留敵' }, { id: 'star', label: '關卡星章' },
  { id: 'mono', label: '流派：單屬爆發' }, { id: 'combo', label: '流派：連擊狂潮' }, { id: 'heart', label: '流派：心之守護' },
  { id: 'race', label: '流派：種族羈絆' }, { id: 'control', label: '流派：時之控場' }, { id: 'berserk', label: '流派：背水一戰' },
  { id: 'skillcycle', label: '流派：技能循環' }, { id: 'fixed', label: '流派：固定傷害' },
] as const;
export type AssistantGoalId = typeof ASSISTANT_GOALS[number]['id'];
