# Live enemy guidance — approved local design

User asks why the screenshot's 失控鍋爐 cannot be killed and for discoverable detailed攻略. Parent approved this bounded design on 2026-11-01 06:17 UTC; formal publication was subsequently explicitly approved at 06:24 UTC (parent retained user transcript).

## Evidence and approach
Actual st-2-6 wave 2 has e0008 HP 15,000 / DEF 200 / permanent per-enemy per-turn damage absorption threshold 20,000. Excess qualifying damage heals, not resurrection. Real c307 fixed 15,000 kills it. Existing ⓘ opens a shallow dialog; stage and defeat advice incorrectly say single-hit. Reuse this dialog with a visible 情報／攻略 button; do not add hidden long-press, a new route, or a combat solver. Alternative enemy nerf is unsupported; alternative long-press-only remains undiscoverable.

## Requirements
- Current enemy HP/defense/next attack and currently active statuses with actual thresholds, percentages and finite/permanent duration. Ability trigger history remains distinct from active status: 已觸發 does not mean expired.
- Detailed absorption explanation: per enemy, accumulated qualifying post-defense damage in the current turn, excess converted to healing; fixed/percentMaxHp and explicit ignoreShield damage bypass this absorption branch, mere ignoreDefense does not. Other shields can still apply to fixed damage. No claim of guaranteed kill or a safe combo count.
- Recognized defensive statuses (absorb/combo shield/ordinary shield/attribute shield/ring) receive truthful state-derived guidance; other statuses use existing truthful details, unknown values/types remain explicitly unknown rather than invented.
- For absorption only, optionally list actual current team direct-damage skills that bypass this absorption rule, original skill text, current cooldown and sealed state. This is a possible method, not a promise that a skill can be cast now or kill through every defense. No mutation, no skill execution.
- No remaining current-turn absorption budget claim: it is not in BattleState, and scripted practice snapshots are unsupported. Do not extend engine API.
- Clear accessible button, preserve independent target button and board gestures; no nested interactive controls. Local dialog scroll, keyboard close/focus restoration where safe. One current enemy dialog; route change/old wave/old button cannot open stale dialog. No board-enable or pause mutation from reading/closing. Busy states may refuse opening rather than show stale state.
- Correct stage-intel and defeat-advice cumulative wording. No engine, enemy/card data, rewards, save schema, PWA, hosting, Greek placement changes.

## Pure API
Keep enemyStatRows. Add enemyGuide(state: BattleState, enemyIndex: number, skills: Record<string, ActiveSkillDef>): { sections: {title: string; lines: string[]}[] }. Invalid index yields empty sections. Model does not format DOM or read global data/save. UI passes actual local battle skills and live state.

## Acceptance
Pure model actual live statuses, missing/expired status and source effects; real e0008 damage/cumulative/fixed controls; true app open/read/close/target independence and keyboard, route/wave/animation stale rejection; exact full state/RNG/save/storage invariance for reading. No mobile visual validation claim. All original formal protected files and all data/assets byte-identical.
