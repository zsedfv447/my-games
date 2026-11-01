// v4.4 mage element loops (design: 法師三系重設計 v2.0). Fire, ice and lightning no longer get
// fixed damage multipliers against a monster's innate element; instead each school has its own loop:
//   火 鋪火 → 選擇引爆時機 → 擴散     冰 寒氣 → 寒冰印記 → 碎冰     雷 感電 → 連擊計數 → 連鎖／落雷
// Every number here is a first-round tuning value, collected in one place so balance passes only
// touch this file. Percentages are "× MATK" through the normal magic formula (mdef applies per target).
export const LOOP={
  /** 灼燒: +1 stack per effective fire bolt hit. */
  burn:{perStackPerSec:.06,duration:4,maxStacks:5,tick:1},
  /** 爆炎球 detonation of pre-existing burn. */
  detonate:{perStack:.25,spreadStacks:2,spreadRange:2,spreadMax:3},
  /** 寒氣: +1 stack per effective cold bolt hit; 5 stacks become a 寒冰印記. */
  chill:{slowPerStack:.08,maxStacks:5,duration:5},
  mark:{duration:6},
  /** Natural freeze when a mark forms (non-MVP), with a protection window between freezes. */
  freeze:{duration:1.5,lockout:3},
  /** 冰封術 consuming a mark. */
  shatter:{bonus:1.5,shards:2,shardRange:2,shardMult:.5},
  frostDiverChill:3,
  /** 感電 (status, refreshed by lightning bolt hits) and Charge (counter, 4 hits → strike). */
  shock:{duration:4},
  charge:{need:4,strikeMult:1.2},
  chain:{chance:.3,range:3,mult:.6,rebound:.5},
  storm:{shockedBonus:.2},
} as const;
