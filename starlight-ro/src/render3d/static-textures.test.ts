import {describe,it,expect} from 'vitest';
import {Texture,SRGBColorSpace,RepeatWrapping} from 'three';
import {StaticTexturePool} from './static-textures';
describe('static texture sharing',()=>{
  it('shares the same source across independent model loads',()=>{
    const pool=new StaticTexturePool(),a=new Texture(),b=new Texture();
    expect(pool.use(b,'nature/bark.png')).toBe(pool.use(a,'nature/bark.png'));
  });
  it('keeps colour and normal sampling separate even for the same file',()=>{
    const pool=new StaticTexturePool(),normal=new Texture(),colour=new Texture();colour.colorSpace=SRGBColorSpace;
    expect(pool.use(normal,'same.png')).not.toBe(pool.use(colour,'same.png'));
  });
  it('preserves sampler differences and different pack URLs',()=>{
    const pool=new StaticTexturePool(),a=new Texture(),b=new Texture();b.wrapS=RepeatWrapping;
    expect(pool.use(a,'nature/texture.png')).not.toBe(pool.use(b,'nature/texture.png'));
    expect(pool.use(new Texture(),'village/texture.png')).not.toBe(a);
  });
});
