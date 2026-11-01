// Copies the CC0 Quaternius character assets the game uses into public/models/, shrinking
// textures to web sizes (JPEG, 512–1024px) and rewriting the glTF image URIs to match.
// Usage: node tools/prepare-assets.mjs <asset-downloads dir>
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const src=process.argv[2];if(!src)throw new Error('usage: node tools/prepare-assets.mjs <asset-downloads dir>');
const out=path.resolve('public/models');fs.mkdirSync(out,{recursive:true});
const BASE=path.join(src,'basechars/Universal Base Characters[Standard]');
const OUTF=path.join(src,'outfits/Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits');
const HAIR=path.join(BASE,'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)');
const BODY=path.join(BASE,'Base Characters/Godot - UE');
const done=new Map();
function texture(file,dir,size){
  const name=path.basename(file).replace(/\.png$/i,'').replace(/_png$/,'')+'.jpg';
  if(done.has(name))return name;
  // Some glTFs reference "X_png.png" while the pack ships "X.png" (or keeps it in a sibling Textures folder).
  const tries=[path.join(dir,file),path.join(dir,file.replace(/_png\.png$/i,'.png')),path.join(BASE,'Base Characters/Textures',file.replace(/_png\.png$/i,'.png'))];
  const from=tries.find(f=>fs.existsSync(f));if(!from)throw new Error(`missing texture ${tries[0]}`);
  execFileSync('sips',['-Z',String(size),'-s','format','jpeg','-s','formatOptions','88',from,'--out',path.join(out,name)],{stdio:'ignore'});
  done.set(name,true);return name;
}
function gltf(file,dir,rename,size=1024){
  const j=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  for(const img of j.images??[]){const s=/hair|eye/i.test(img.uri)?512:size;img.uri=texture(decodeURIComponent(img.uri),dir,s);img.mimeType='image/jpeg';}
  for(const b of j.buffers??[]){const bin=decodeURIComponent(b.uri),to=rename.replace(/\.gltf$/,'.bin');fs.copyFileSync(path.join(dir,bin),path.join(out,to));b.uri=to;}
  fs.writeFileSync(path.join(out,rename),JSON.stringify(j));
}
gltf('Superhero_Female_FullBody.gltf',BODY,'body_f.gltf');
gltf('Superhero_Male_FullBody.gltf',BODY,'body_m.gltf');
for(const o of ['Female_Ranger','Male_Ranger','Female_Peasant','Male_Peasant'])gltf(`${o}.gltf`,OUTF,`${o.toLowerCase()}.gltf`);
for(const h of ['Hair_Long','Hair_Buns','Hair_SimpleParted','Hair_Buzzed','Hair_BuzzedFemale','Eyebrows_Female','Eyebrows_Regular'])gltf(`${h}.gltf`,HAIR,`${h.toLowerCase()}.gltf`);
fs.copyFileSync(path.join(src,'ual1/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb'),path.join(out,'anim1.glb'));
fs.copyFileSync(path.join(src,'ual2/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb'),path.join(out,'anim2.glb'));
fs.writeFileSync(path.join(out,'LICENSE.txt'),'Character models, outfits, hairstyles and animations by Quaternius (quaternius.com), CC0 1.0 Universal.\nhttps://creativecommons.org/publicdomain/zero/1.0/\n');
console.log(fs.readdirSync(out).length,'files');
