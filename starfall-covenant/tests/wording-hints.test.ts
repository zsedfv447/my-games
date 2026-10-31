// 找差距第 112、117、118 項：第一次遇到機制的提示、按鈕用語統一、召喚用語
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { boardFromStrings } from '../src/battle/board';
import { createNewSave, parseSave, serializeSave } from '../src/save/save';
import { hintsSeenOf, markHintsSeen, mechanicsIn, MECHANIC_HINTS, newMechanics } from '../src/ui/tutorial/mechanic-hints';
import { LABEL } from '../src/ui/wording';

const NOW = Date.UTC(2026, 10, 1, 6);
const fresh = () => createNewSave(gameData.config, NOW);
const board = (hidden = false) => {
  const b = boardFromStrings(['ghlwgd', 'dgwwlh', 'ffwfgd', 'ldhgfg', 'gwlhdf']);
  if (hidden) b.cells[0] = { ...b.cells[0], hidden: true };
  return b;
};
const ring = (broken = '') => ({ id: 'ringShield' as const, turns: null, value: 60, params: { slots: 'fire,water,wood,heart', vulnerable: 2, broken } });
const state = (opts: { ring?: ReturnType<typeof ring>; hp?: number; hidden?: boolean; seal?: boolean } = {}) => ({
  enemies: [{ hp: opts.hp ?? 100, statuses: opts.ring ? [opts.ring] : [] }],
  board: board(opts.hidden),
  teamStatuses: opts.seal ? [{ id: 'attributeSeal' as const, turns: 2, params: { attribute: 'fire' } }] : [],
  team: [{ attribute: 'fire' }],
}) as unknown as Parameters<typeof mechanicsIn>[0];

describe('第一次遇到機制的提示', () => {
  it('偵測七曜環、隱藏珠、星紋封印', () => {
    expect(mechanicsIn(state())).toEqual([]);
    expect(mechanicsIn(state({ ring: ring() }))).toEqual(['ringShield']);
    expect(mechanicsIn(state({ hidden: true }))).toEqual(['hiddenOrbs']);
    expect(mechanicsIn(state({ seal: true }))).toEqual(['starSeal']);
  });

  it('已碎裂的環、已倒下的敵人不算', () => {
    expect(mechanicsIn(state({ ring: ring('fire,water,wood,heart') }))).toEqual([]);
    expect(mechanicsIn(state({ ring: ring(), hp: 0 }))).toEqual([]);
  });

  it('看過的不再提示，記在存檔的 hintsSeen（存讀後保留，不升存檔版本）', () => {
    const s0 = fresh();
    expect(hintsSeenOf(s0)).toEqual([]);
    expect(newMechanics(s0, state({ ring: ring(), hidden: true }))).toEqual(['ringShield', 'hiddenOrbs']);
    const s1 = markHintsSeen(s0, ['ringShield']);
    expect(newMechanics(s1, state({ ring: ring(), hidden: true }))).toEqual(['hiddenOrbs']);
    expect(markHintsSeen(s1, ['ringShield'])).toBe(s1);
    const r = parseSave(serializeSave(s1), gameData.config, NOW);
    expect(r.ok && r.save.hintsSeen).toEqual(['ringShield']);
    expect(r.ok && r.migratedFrom).toBeUndefined();
  });

  it('七曜環的說明涵蓋破格、心格、碎裂易傷、固定傷害不能破環', () => {
    const text = MECHANIC_HINTS.ringShield.join('');
    for (const k of ['點掉', '心珠', '碎裂', '加倍', '固定傷害']) expect(text).toContain(k);
  });
});

/** src/ui 下所有 .ts 原始碼 */
function uiSources(dir = 'src/ui'): { file: string; text: string }[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return uiSources(p);
    return p.endsWith('.ts') ? [{ file: p, text: readFileSync(p, 'utf8') }] : [];
  });
}

describe('按鈕用語統一', () => {
  const sources = uiSources().filter((s) => !s.file.endsWith('wording.ts'));

  it('舊的說法不再出現在按鈕上', () => {
    const old = ["button('稍後再說'", "button('跳過'", "button('闔上'", "'拿去強化…'", "'再戰一次'", "label: '知道了'", "button('練習轉珠'"];
    for (const { file, text } of sources) for (const o of old) expect(text.includes(o), `${file} 還有 ${o}`).toBe(false);
  });

  it('召喚的動作統一叫「召喚」，「封印」不再當動詞', () => {
    for (const { file, text } of sources) {
      for (const o of ["'開啟封印'", "'單次封印'", "'十連封印'", "'再抽一次'", "'再十連'"]) expect(text.includes(o), `${file} 還有 ${o}`).toBe(false);
    }
    expect(LABEL.summonOnce).toBe('召喚一次');
    expect(LABEL.summonTen).toBe('召喚十次');
    expect(LABEL.summon).toBe('召喚');
  });

  it('每組用語只有一種說法', () => {
    expect(LABEL).toMatchObject({ later: '稍後', skip: '略過', close: '關閉', toEnhance: '去強化', retry: '再戰', accept: '收下', ok: '確定', practice: '練習場' });
  });
});
