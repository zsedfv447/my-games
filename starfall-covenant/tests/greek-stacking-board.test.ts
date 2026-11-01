import { expect, it } from 'vitest';
import { boardFromStrings, resolveBoard, findMatches } from '../src/battle/board';
import { createRng } from '../src/core/rng';
import type { MatchedOrbSkyfall } from '../src/core/types';
const fire: MatchedOrbSkyfall = { orb: 'fire', count: 3, spawn: 1 };
const enhanced = (rows: string[], effects: MatchedOrbSkyfall[]) => resolveBoard(boardFromStrings(rows), createRng(77), { matchedOrbSkyfall: effects, enhancedChance: 0 }).steps[0].after.cells.filter(o => o.enhanced);
it('same-color duplicate3→2 and6→4; individual spawn1+2→3 and floors apply per contribution', () => {
 expect(enhanced(['fff','whd'], [fire,fire])).toHaveLength(2);
 expect(enhanced(['fff','fff','whd'], [fire,fire])).toHaveLength(4);
 expect(enhanced(['fff','www','hld'], [fire,{...fire,spawn:2}])).toHaveLength(3);
 expect(enhanced(['fff','fff','whd'], [{...fire,count:3.9,spawn:1.9},{...fire,count:2.9,spawn:1.2}])).toHaveLength(5);
});
it('mixed colors sum independently and use existing deterministic color-order slot allocation', () => {
 const mixed = enhanced(['fff','www','hld'], [fire,fire,{orb:'water',count:3,spawn:1},{orb:'water',count:3,spawn:1}]);
 expect(mixed.map(o=>o.type).sort()).toEqual(['fire','fire','water','water']);
 // Six slots total: fire fills them first even if water effects precede it in the array.
 const saturated = enhanced(['fff','www','hld'], [{orb:'water',count:1,spawn:100}, {...fire,count:1,spawn:100}]);
 expect(saturated).toHaveLength(6); expect(saturated.every(o=>o.type==='fire')).toBe(true);
});
it('invalid values add zero, finite overflow and long effect lists saturate slots without allocation blowup', () => {
 const board=boardFromStrings(['fff','whd']);
 const invalid:MatchedOrbSkyfall[]=[0,-1,0.9,NaN,Infinity,-Infinity].flatMap(v=>[{...fire,count:v},{...fire,spawn:v}]);
 const one=createRng(9),bad=createRng(9);
 expect(resolveBoard(board,bad,{matchedOrbSkyfall:[fire,...invalid]})).toEqual(resolveBoard(board,one,{matchedOrbSkyfall:[fire]})); expect(bad.state!()).toBe(one.state!());
 const overflow=resolveBoard(board,createRng(9),{matchedOrbSkyfall:[{...fire,count:1,spawn:Number.MAX_VALUE},{...fire,count:1,spawn:Number.MAX_VALUE}]});
 expect(overflow.steps.length).toBeLessThanOrEqual(50); expect(overflow.steps.every(s=>s.after.cells.length===6 && s.after.cells.filter(o=>o.enhanced).length<=6)).toBe(true);
 const many=resolveBoard(board,createRng(9),{matchedOrbSkyfall:Array.from({length:200000},()=>fire),skyfallCombo:false});
 expect(many.steps).toHaveLength(1); expect(many.board.cells).toHaveLength(6); expect(findMatches(many.board)).toEqual([]);
});
it('sum retains50 cascade safety cap and noSkyfall prevention instead of forcing matches', () => {
 const board=boardFromStrings(['fff']), effects=[{...fire,count:1,spawn:Number.MAX_VALUE},fire];
 const loop=resolveBoard(board,createRng(9),{matchedOrbSkyfall:effects});
 expect(loop.steps).toHaveLength(50); expect(loop.steps.every(s=>s.after.cells.length===3)).toBe(true);
 const stopped=resolveBoard(board,createRng(9),{matchedOrbSkyfall:effects,skyfallCombo:false});
 expect(stopped.steps).toHaveLength(1); expect(findMatches(stopped.board)).toEqual([]);
});
it('sealed colors never count; no-clear/empty-effect cases preserve RNG and input immutability', () => {
 const board=boardFromStrings(['fff','www','hld']), before=structuredClone(board), effects=[fire,fire,{orb:'water' as const,count:3,spawn:1}];
 const beforeEffects=structuredClone(effects);
 const sealed=resolveBoard(board,createRng(12),{matchedOrbSkyfall:effects,sealedOrbs:['fire'],enhancedChance:0});
 expect(sealed.steps[0].groups.map(g=>g.orb)).toEqual(['water']); expect(sealed.steps[0].after.cells.filter(o=>o.enhanced).map(o=>o.type)).toEqual(['water']);
 const a=createRng(12),b=createRng(12); expect(resolveBoard(board,a)).toEqual(resolveBoard(board,b,{matchedOrbSkyfall:[]})); expect(a.state!()).toBe(b.state!());
 const noClear=boardFromStrings(['fwh','hdf']),rng=createRng(12),initial=rng.state!();
 expect(resolveBoard(noClear,rng,{matchedOrbSkyfall:effects}).steps).toEqual([]); expect(rng.state!()).toBe(initial);
 expect(resolveBoard(board,createRng(12),{matchedOrbSkyfall:effects})).toEqual(resolveBoard(board,createRng(12),{matchedOrbSkyfall:effects}));
 expect(board).toEqual(before); expect(effects).toEqual(beforeEffects);
});
