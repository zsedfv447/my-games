// 隊員攻擊演出（提案 7）：頭像跳出該員傷害 → 屬性光點飛向敵人 → 敵人扣血；全體攻擊加橫掃
import type { BattleState, EnemyState } from '../../battle/battle-state';
import type { BattleConfig, HitResult } from '../../battle/damage';
import { strikesByMember, type MemberStrike } from '../../battle/feedback';
import { getSettings } from '../state';
import { damageText, flashClass, floatLabel, fly } from './effects';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface StrikeStage {
  root: HTMLElement;
  teamRow: HTMLElement;
  enemyZone: HTMLElement;
  enemyEls: HTMLElement[];
  config: BattleConfig;
  speed: number;
  /** 畫敵人血條（previousHp 用來播放扣血動畫） */
  updateEnemy: (i: number, e: EnemyState, previousHp: number) => void;
}

/** 關閉演出或低特效時，所有傷害一起跳出 */
export async function playStrikes(stage: StrikeStage, before: BattleState, hits: HitResult[]): Promise<void> {
  if (!hits.length) return;
  const strikes = strikesByMember(hits, before.enemies, stage.config);
  const hp = before.enemies.map((e) => e.hp);
  const land = (st: MemberStrike) => {
    if (st.sweep) flashClass(stage.root, 'sweep', 420);
    for (const t of st.targets) {
      const e = before.enemies[t.enemy];
      const el = stage.enemyEls[t.enemy];
      if (!e || !el) continue;
      const prev = hp[t.enemy];
      hp[t.enemy] = Math.max(0, prev - t.damage);
      stage.updateEnemy(t.enemy, { ...e, hp: hp[t.enemy] }, prev);
      flashClass(el, 'hit', 300);
      damageText(el, t.damage, st.attribute, t.matchup);
    }
  };
  const settings = getSettings();
  if (!settings.battleFx || settings.lowFx) {
    strikes.forEach(land);
    await wait(380 / stage.speed);
    return;
  }
  const stagger = 120 / stage.speed;
  const flight = 240 / stage.speed;
  const flights: Promise<void>[] = [];
  for (const st of strikes) {
    const thumb = st.member >= 0 ? (stage.teamRow.children[st.member] as HTMLElement | undefined) : undefined;
    if (!thumb) {
      land(st);
      continue;
    }
    flashClass(thumb, 'striking', 300);
    floatLabel(thumb, st.total.toLocaleString(), `member-dmg attr-${st.attribute ?? 'none'}`);
    const target = st.sweep ? stage.enemyZone.querySelector<HTMLElement>('.enemy-line') : stage.enemyEls[st.targets[0]?.enemy ?? -1];
    flights.push(fly(stage.root, thumb, target ?? stage.enemyZone, st.attribute, flight).then(() => land(st)));
    await wait(stagger);
  }
  await Promise.all(flights);
  await wait(260 / stage.speed);
}
