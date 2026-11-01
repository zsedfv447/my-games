import type {Texture} from 'three';
/** A glTF parser's image cache ends at one file. Scene packs reuse images across many files. */
export class StaticTexturePool{
  private textures=new Map<string,Texture>();
  use(texture:Texture,uri:string){
    const key=JSON.stringify([uri,texture.colorSpace,texture.channel,texture.wrapS,texture.wrapT,texture.minFilter,texture.magFilter,texture.flipY,texture.offset.toArray(),texture.repeat.toArray(),texture.rotation,texture.center.toArray()]);
    const shared=this.textures.get(key);if(shared)return shared;
    this.textures.set(key,texture);return texture;
  }
}
