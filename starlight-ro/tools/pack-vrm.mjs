// Shrinks VRM (glb) avatars for the web: every embedded texture is resized (sips) to at most
// `max` px, keeping PNG so hair/eyelash alpha survives, then the binary chunk is rebuilt.
// Usage: node tools/pack-vrm.mjs <in.vrm> <out.vrm> [max=1024]
import fs from 'fs';import os from 'os';import path from 'path';import {execFileSync} from 'child_process';
const [inp,out,maxArg]=process.argv.slice(2);const max=Number(maxArg??1024);
const b=fs.readFileSync(inp);const jsonLen=b.readUInt32LE(12);const json=JSON.parse(b.slice(20,20+jsonLen).toString('utf8'));
const binStart=20+jsonLen+8,bin=b.slice(binStart,binStart+b.readUInt32LE(20+jsonLen));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vrm-'));
const imageViews=new Map();(json.images??[]).forEach((im,i)=>{if(im.bufferView!==undefined)imageViews.set(im.bufferView,i);});
const chunks=[];let offset=0;
json.bufferViews.forEach((bv,vi)=>{
  let data=bin.slice(bv.byteOffset??0,(bv.byteOffset??0)+bv.byteLength);
  if(imageViews.has(vi)){const im=json.images[imageViews.get(vi)];const ext=im.mimeType==='image/jpeg'?'jpg':'png';
    const a=path.join(tmp,`${vi}.${ext}`),o=path.join(tmp,`${vi}_o.png`);fs.writeFileSync(a,data);
    const info=execFileSync('sips',['-g','pixelWidth','-g','hasAlpha',a]).toString(),w=Number(/pixelWidth: (\d+)/.exec(info)[1]),alpha=/hasAlpha: yes/.test(info);
    // Opaque textures become JPEG; alpha (hair tips, lashes, eyes) stays PNG.
    const fmt=alpha?'png':'jpeg',oo=o.replace(/png$/,alpha?'png':'jpg');
    execFileSync('sips',[...(w>max?['-Z',String(max)]:[]),'-s','format',fmt,...(alpha?[]:['-s','formatOptions','85']),a,'--out',oo],{stdio:'ignore'});
    const r=fs.readFileSync(oo);if(r.length<data.length){data=r;im.mimeType=alpha?'image/png':'image/jpeg';}}
  const pad=(4-(offset%4))%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}
  bv.byteOffset=offset;bv.byteLength=data.length;chunks.push(data);offset+=data.length;
});
const newBin=Buffer.concat(chunks);const binPad=(4-newBin.length%4)%4;
json.buffers=[{byteLength:newBin.length+binPad}];
let js=Buffer.from(JSON.stringify(json),'utf8');const jsPad=(4-js.length%4)%4;js=Buffer.concat([js,Buffer.alloc(jsPad,0x20)]);
const head=Buffer.alloc(12);head.writeUInt32LE(0x46546C67,0);head.writeUInt32LE(2,4);
const jh=Buffer.alloc(8);jh.writeUInt32LE(js.length,0);jh.writeUInt32LE(0x4E4F534A,4);
const bh=Buffer.alloc(8);bh.writeUInt32LE(newBin.length+binPad,0);bh.writeUInt32LE(0x004E4942,4);
const total=12+8+js.length+8+newBin.length+binPad;head.writeUInt32LE(total,8);
fs.writeFileSync(out,Buffer.concat([head,jh,js,bh,newBin,Buffer.alloc(binPad)]));fs.rmSync(tmp,{recursive:true});
console.log(path.basename(out),(b.length/1e6).toFixed(1),'→',(total/1e6).toFixed(1),'MB');
