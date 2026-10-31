// 敵人情報的數值列（點敵人打開的視窗用）：生命、防禦、攻擊間隔、攻擊對象。純函式，方便測試
import type { EnemyState } from '../battle/battle-state';
import { defenseProfile, enemyHitCount } from '../battle/skills/status';

export interface InfoRow {
  label: string;
  value: string;
}

export function enemyStatRows(e: EnemyState): InfoRow[] {
  const def = defenseProfile(e).def;
  const hits = enemyHitCount(e);
  return [
    { label: '生命', value: `${Math.max(0, e.hp).toLocaleString()} / ${e.maxHp.toLocaleString()}` },
    // 防禦降低時顯示目前值與原本的值
    { label: '防禦', value: def === e.def.def ? def.toLocaleString() : `${def.toLocaleString()}（原本 ${e.def.def.toLocaleString()}）` },
    { label: '攻擊間隔', value: `每 ${e.maxCooldown} 回合` },
    // 我方共用一條生命，敵人的攻擊都是打全隊；連擊會拆成好幾段（總傷害不變）
    { label: '攻擊對象', value: hits > 1 ? `我方全隊（共用生命）・${hits} 段` : '我方全隊（共用生命）' },
  ];
}
