import {describe,it,expect} from 'vitest';
import * as R from './state';
import {buildMap} from '../world/mapgen';
describe('old village save locations',()=>{
  it('moves an old character out of new props while retaining every owned asset',()=>{
    const s=R.addCard(R.createCharacter(R.newGame(),'舊角色',0,0),'jellyCard').state;
    const site=buildMap('town').villageSites[0];s.position={map:'town',x:site.x,y:site.z};s.savePoint={...s.position};
    const before=structuredClone(s),next=R.normalizeGame(s) as R.GameState;R.validateGame(next);
    expect(s).toEqual(before);expect(next.position).not.toEqual(before.position);
    expect({...next,position:before.position,savePoint:before.savePoint}).toEqual(before);
    expect(R.normalizeGame(next)).toEqual(next);
  });
  it('does not accept unrelated blocked locations or non-finite coordinates',()=>{
    const s=R.createCharacter(R.newGame(),'舊角色',0,0);
    s.position={map:'town',x:24,y:24};expect(()=>R.validateGame(R.normalizeGame(s))).toThrow('角色位置');
    s.position={map:'town',x:NaN,y:9};expect(()=>R.validateGame(R.normalizeGame(s))).toThrow('角色位置');
  });
});
