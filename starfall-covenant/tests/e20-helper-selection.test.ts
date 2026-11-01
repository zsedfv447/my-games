// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const allBytes = () => JSON.stringify(Array.from({length: localStorage.length}, (_, index) => localStorage.key(index)!).sort().map(key => [key, localStorage.getItem(key)]));
for (const [npc, expectedCard, reduction] of [['npc-chain','c509',20],['npc-combo','c206',null],['none',null,20]] as const) {
  it(`actual ${npc} choice survives prepare and one paid departure into the real battle roster`, async () => {
    vi.resetModules(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', '#/prepare/st-1-1');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, {
      get: (_target,key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({addColorStop(){}}) : () => {},
    }) as CanvasRenderingContext2D);
    // Drawing-only harness: avoid happy-dom synchronous image onload re-entry. Engine/input stay real.
    const { BoardView } = await import('../src/battle/view/board-view');
    vi.spyOn(BoardView.prototype as unknown as {draw():void}, 'draw').mockImplementation(() => {});
    const state = await import('../src/ui/state');
    const { SAVE_KEY } = await import('../src/save/save');
    const { gameData } = await import('../src/data/load');
    const save = structuredClone(state.getSave());
    // Explicit legal inventory/unlock/story checkpoint, not naturally obtained cards or manual story play.
    save.tutorial = {step:'done',giftGiven:true}; save.progress.tutorialDone = true;
    save.progress.clearedStages = ['st-2-9']; save.progress.storySeen = ['ch1-open'];
    const base = save.inventory.cards[0];
    save.inventory.cards = [{...base,uid:'dragon-leader',cardId:'c405'},{...base,uid:'dragon-member',cardId:'c107'}];
    save.teams[0].members = ['dragon-leader','dragon-member',null,null,null]; state.commit(save);
    const { startApp } = await import('../src/ui/app');
    const host = document.createElement('div'); document.body.append(host); router = startApp(host);
    let before = structuredClone(state.getSave()), bytesBefore = allBytes();
    const writes = vi.spyOn(localStorage,'setItem'); const removals = vi.spyOn(localStorage,'removeItem');
    const button = (text:string) => {
      const found = [...host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === text);
      expect(found).toBeDefined(); return found!;
    };
    button('更換助戰').click(); await vi.waitFor(() => expect(host.querySelectorAll('.helper-row').length).toBeGreaterThan(0));
    // The real helper list legitimately records discovered card IDs, separately from selection.
    const { markSeen } = await import('../src/growth');
    const { rosterFor } = await import('../src/ui/screens/helper');
    const stageDef = gameData.stages.find(stage => stage.id === 'st-1-1')!;
    const expectedSeen = markSeen(before, rosterFor(stageDef).map(offer => offer.card.id));
    expect(state.getSave()).toEqual(expectedSeen);
    expect(writes).toHaveBeenCalledTimes(1);
    expect(writes.mock.calls[0][0]).toBe(SAVE_KEY);
    expect(JSON.parse(writes.mock.calls[0][1]).data).toEqual(expectedSeen);
    expect(removals).not.toHaveBeenCalled();
    const beforeEntries = JSON.parse(bytesBefore) as [string,string][];
    for (const [key,value] of beforeEntries) if (key !== SAVE_KEY) expect(localStorage.getItem(key)).toBe(value);
    console.info('E20_HELPER_MARK_SEEN', JSON.stringify({npc,added:expectedSeen.collection.seen.filter(id=>!before.collection.seen.includes(id)),writes:1}));
    before = structuredClone(expectedSeen); bytesBefore = allBytes(); writes.mockClear();
    const { HELPER_NPCS } = await import('../src/progression/helpers');
    if (npc === 'none') button('不帶助戰').click();
    else {
      const name = HELPER_NPCS.find(helper => helper.id === npc)!.name;
      const row = [...host.querySelectorAll<HTMLButtonElement>('.helper-row')].find(row => row.textContent!.includes(name))!;
      expect(row.disabled).toBe(false); row.click();
    }
    await vi.waitFor(() => expect(host.querySelector('[data-tut="sortie"] button')).not.toBeNull());
    const { chosenHelper } = await import('../src/ui/sortie'); const chosen = chosenHelper('st-1-1');
    expect(chosen?.npcId ?? null).toBe(npc === 'none' ? null : npc); expect(chosen?.card.id ?? null).toBe(expectedCard);
    if (chosen) {
      expect(host.textContent).toContain(chosen.card.name);
      const leaderDescription = gameData.leaderSkills.find(skill => skill.id === chosen.card.leaderSkill)?.description;
      if (leaderDescription) expect(host.textContent).toContain(leaderDescription);
    } else expect(host.textContent).toContain('沒有帶助戰。');
    expect(state.getSave()).toEqual(before); expect(allBytes()).toBe(bytesBefore);
    expect(writes).not.toHaveBeenCalled(); expect(removals).not.toHaveBeenCalled();
    const stage = gameData.stages.find(stage => stage.id === 'st-1-1')!; expect(stage.stamina).toBe(3);
    host.querySelector<HTMLButtonElement>('[data-tut="sortie"] button')!.click();
    await vi.waitFor(() => expect(state.getSave().activeBattle?.snapshot).toBeTruthy());
    const after = state.getSave(), ticket = after.activeBattle!;
    expect(ticket.helper).toEqual(chosen?.input ?? null); expect(ticket.snapshot!.helper).toEqual(chosen?.input ?? null);
    expect(ticket.members.map(member => member.cardId)).toEqual(['c405','c107']);
    expect(after.stamina.current).toBe(before.stamina.current - stage.stamina);
    expect(after.teams).toEqual(before.teams); expect(after.inventory).toEqual(before.inventory);
    expect(after.player).toEqual(before.player); expect(after.gacha).toEqual(before.gacha);
    expect(after.progress).toEqual(before.progress);
    expect(removals).not.toHaveBeenCalled(); expect(writes.mock.calls.length).toBeGreaterThan(0);
    // Debit, arm/mark-enemies-seen, and snapshot payloads may be distinct writes, but never charge twice.
    for (const [key,value] of writes.mock.calls) {
      expect(key).toBe(SAVE_KEY); const payload = JSON.parse(value).data;
      expect(payload.stamina.current).toBe(before.stamina.current - stage.stamina);
      expect(payload.player).toEqual(before.player); expect(payload.inventory).toEqual(before.inventory); expect(payload.teams).toEqual(before.teams);
    }
    const settledBytes = allBytes(), count = writes.mock.calls.length;
    const { openStageBattle } = await import('../src/ui/battle-session');
    const opened = openStageBattle(stage); if (typeof opened === 'string') throw new Error(opened);
    const actual = opened.battle.getState();
    expect(actual.team.filter(member => member.isHelper).map(member => member.cardId)).toEqual(expectedCard ? [expectedCard] : []);
    expect(actual.team.filter(member => !member.isHelper).map(member => member.cardId)).toEqual(['c405','c107']);
    const { evaluateLeaderTurn } = await import('../src/battle/leader');
    const fx = evaluateLeaderTurn([gameData.leaderSkills.find(skill => skill.id === 'l405')], {team:actual.team,groups:[],combo:0,hpPercent:100,skillUsedThisTurn:false});
    expect(fx.damageReductions).toEqual(reduction === null ? [] : [reduction]);
    expect(allBytes()).toBe(settledBytes); expect(writes).toHaveBeenCalledTimes(count);
    console.info('E20_HELPER',JSON.stringify({npc,helper:expectedCard,staminaDelta:after.stamina.current-before.stamina.current,coinDelta:after.player.coin-before.player.coin,gemsDelta:after.player.gems-before.player.gems,roster:actual.team.map(member=>member.cardId),l405Reduction:fx.damageReductions,savePayloads:count}));
  });
}
