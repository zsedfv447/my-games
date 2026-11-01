import {describe,expect,test} from 'vitest';
import * as R from './state';
import {INTIMATE} from '../data/pets';

const made=()=>R.createCharacter(R.newGame(),'測試',0,0);
describe('寵物',()=>{
  test('捕捉後成為出戰寵物；同種再捕捉增加親密度',()=>{
    let r=R.tamePet(made(),'jelly');expect(r.isNew).toBe(true);expect(r.state.activePet).toBe('jelly');
    r=R.tamePet(r.state,'jelly');expect(r.isNew).toBe(false);expect(r.state.pets![0].intimacy).toBe(50);
    expect(()=>R.tamePet(made(),'jellyKing')).toThrow();
  });
  test('親密前加成一半，親密後全開',()=>{
    let s=R.tamePet(made(),'wolf').state;const base=R.derive({...s,activePet:null}).atk;
    expect(R.derive(s).atk).toBe(base+4);
    s.pets![0].intimacy=INTIMATE;expect(R.derive(s).atk).toBe(base+8);
  });
  test('一起打怪增加親密度；收回寵物後沒有加成',()=>{
    let s=R.tamePet(made(),'jelly').state;s=R.petKill(s);expect(s.pets![0].intimacy).toBe(1);
    const hp=R.derive(s).maxHp;s=R.setActivePet(s,null);expect(R.derive(s).maxHp).toBeLessThan(hp);
    expect(()=>R.setActivePet(s,'bat')).toThrow();
  });
});
describe('外觀',()=>{
  test('購買扣錢並自動穿上；不能重複購買；挑戰外觀不能買',()=>{
    let s=made();s.char.zeny=20000;s=R.buyCostume(s,'catEars');
    expect(s.char.zeny).toBe(17000);expect(s.costumes!.head).toBe('catEars');
    expect(()=>R.buyCostume(s,'catEars')).toThrow(/已經擁有/);
    expect(()=>R.buyCostume(s,'jellyBag')).toThrow(/挑戰/);
  });
  test('外觀不影響能力',()=>{
    let s=made();const d0=R.derive(s);s.char.zeny=99999;s=R.buyCostume(s,'angelWings');s=R.buyCostume(s,'halo');
    expect(R.derive(s)).toEqual(d0);
  });
  test('只能穿已擁有且部位正確的外觀；舊存檔自動補欄位',()=>{
    let s=made();expect(()=>R.wearCostume(s,'head','halo')).toThrow();
    s=R.unlockCostume(s,'jellyBag').state;expect(()=>R.wearCostume(s,'head','jellyBag')).toThrow(/部位/);
    s=R.wearCostume(s,'back','jellyBag');expect(s.costumes!.back).toBe('jellyBag');
    const old=made() as Partial<R.GameState>;delete old.pets;delete old.costumes;delete old.activePet;
    const n=R.normalizeGame(old);expect(()=>R.validateGame(n)).not.toThrow();
  });
});
