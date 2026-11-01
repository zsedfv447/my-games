// Renderer and post stack: image-based lighting from the sky, soft shadows, ground-truth ambient
// occlusion, bloom and a final colour grade with vignette. Day/night cycle drives all of it.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

export type Mood={sky:[string,string,string];fog:string;fogNear:number;fogFar:number;sun:string;sunI:number;hemi:[string,string];hemiI:number;bloom:number};
export const moods:Record<string,Mood>={
  town:{sky:['#4a96e0','#9fd0f8','#fff0d8'],fog:'#cfe2ee',fogNear:30,fogFar:78,sun:'#fff0d8',sunI:3,hemi:['#cfe8ff','#8a9a6a'],hemiI:.55,bloom:.32},
  meadow:{sky:['#4890e0','#9cd0fa','#fff4dc'],fog:'#d4e8f0',fogNear:28,fogFar:74,sun:'#fff2da',sunI:3.1,hemi:['#d0ecff','#7aa060'],hemiI:.55,bloom:.32},
  forest:{sky:['#3f7a92','#8fc4c0','#eef2d0'],fog:'#a9c9b6',fogNear:18,fogFar:56,sun:'#ffe6b0',sunI:2.6,hemi:['#c0e8d0','#4a7a40'],hemiI:.6,bloom:.45},
  cave:{sky:['#16243e','#30507e','#7aa0cc'],fog:'#4a6890',fogNear:14,fogFar:46,sun:'#bfe0ff',sunI:1.7,hemi:['#9fc8ff','#2a3a5a'],hemiI:.7,bloom:.8},
  ruins:{sky:['#3a3a7a','#a08ad0','#ffd8b0'],fog:'#cbb6d8',fogNear:22,fogFar:64,sun:'#ffe2c4',sunI:2.7,hemi:['#e0d0ff','#7a8a6a'],hemiI:.6,bloom:.55},
  // v5.0 星界遠征 variants
  frontier:{sky:['#5a7fb8','#f0b890','#ffe8c8'],fog:'#e8d2bc',fogNear:28,fogFar:76,sun:'#ffd8a8',sunI:2.9,hemi:['#ffe0c0','#8a8a5a'],hemiI:.55,bloom:.38},
  swamp:{sky:['#2e4a3a','#6f8f6a','#c8d8a8'],fog:'#7f9a7a',fogNear:12,fogFar:46,sun:'#e6f0c0',sunI:2.1,hemi:['#b8d8a8','#3a4a2a'],hemiI:.65,bloom:.5},
  lava:{sky:['#2a0f10','#7a2a18','#ff9a4a'],fog:'#6a2a1a',fogNear:14,fogFar:50,sun:'#ffb070',sunI:2.2,hemi:['#ffb080','#3a1a10'],hemiI:.7,bloom:.9},
  sky:{sky:['#4a98e8','#bfe4ff','#ffffff'],fog:'#d8ecff',fogNear:36,fogFar:90,sun:'#ffffff',sunI:3.3,hemi:['#ffffff','#9ac0e0'],hemiI:.62,bloom:.45},
  astral:{sky:['#0c0a2a','#3a2a7a','#c08aff'],fog:'#4a3a8a',fogNear:16,fogFar:58,sun:'#d8c0ff',sunI:2.2,hemi:['#c0a8ff','#2a2050'],hemiI:.75,bloom:.95},
  // v6.0 二轉・星燈航路 variants
  forge:{sky:['#140c10','#4a1a14','#ff7a2a'],fog:'#3a1a14',fogNear:12,fogFar:44,sun:'#ff9a50',sunI:2,hemi:['#ffa070','#20100c'],hemiI:.75,bloom:1},
  bell:{sky:['#2a3a6a','#c8a0c8','#ffe0a8'],fog:'#d8c0c8',fogNear:24,fogFar:70,sun:'#ffe4b0',sunI:2.8,hemi:['#ffe8d0','#7a6a8a'],hemiI:.6,bloom:.55},
  harbor:{sky:['#2a3a7a','#e88a7a','#ffd8a0'],fog:'#e8b8a8',fogNear:28,fogFar:80,sun:'#ffc890',sunI:2.8,hemi:['#ffd8c0','#5a6a8a'],hemiI:.6,bloom:.5},
  bay:{sky:['#3a9ae0','#a8e4f0','#fff0e0'],fog:'#c8ecf0',fogNear:30,fogFar:84,sun:'#fff4e0',sunI:3.2,hemi:['#e0f8ff','#7ab0a0'],hemiI:.58,bloom:.38},
};

/** GTAO that ignores glows, particles, alpha-tested cards and the sky (they would smear dark halos). */
class SoftAO extends GTAOPass{
  overrideVisibility(){
    const cache=(this as unknown as {_visibilityCache:Map<THREE.Object3D,boolean>})._visibilityCache;
    this.scene.traverse(o=>{cache.set(o,o.visible);
      if((o as THREE.Points).isPoints||(o as THREE.Line).isLine||(o as THREE.Sprite).isSprite||o.userData.noAO){o.visible=false;return;}
      const m=(o as THREE.Mesh).material as THREE.Material|undefined;
      if(m&&!Array.isArray(m)&&(m.transparent||m.alphaTest>0||(m as THREE.MeshBasicMaterial).isMeshBasicMaterial||(m as THREE.ShaderMaterial).isShaderMaterial))o.visible=false;});
  }
  setSize(w:number,h:number){super.setSize(Math.max(1,Math.floor(w/2)),Math.max(1,Math.floor(h/2)));}
}
const GradeShader={uniforms:{tDiffuse:{value:null},vignette:{value:.32},lift:{value:new THREE.Color('#fff4e6')},sat:{value:1.08}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float vignette;uniform vec3 lift;uniform float sat;varying vec2 vUv;
    void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(.299,.587,.114));c.rgb=mix(vec3(l),c.rgb,sat);
      c.rgb*=mix(vec3(1.),lift,.35*(1.-l));vec2 d=vUv-.5;c.rgb*=1.-vignette*smoothstep(.25,.85,dot(d,d)*2.2);gl_FragColor=c;}`};

export class Engine {
  readonly renderer:THREE.WebGLRenderer;
  readonly scene=new THREE.Scene();
  readonly camera:THREE.PerspectiveCamera;
  readonly composer:EffectComposer;
  private bloom:UnrealBloomPass;
  private ao:SoftAO;
  private grade:ShaderPass;
  readonly sun=new THREE.DirectionalLight('#ffffff',2.4);
  readonly hemi=new THREE.HemisphereLight('#cfe8ff','#7fa060',1.1);
  private sky:THREE.Mesh;
  private skyMat:THREE.ShaderMaterial;
  private pmrem:THREE.PMREMGenerator;
  private envScene=new THREE.Scene();
  private envSky:THREE.Mesh;
  private envRT:THREE.WebGLRenderTarget|null=null;
  private envNight=-1;private envMood:Mood|null=null;
  mood:Mood=moods.meadow;
  /** 0..1 time of day; 0.25 morning, 0.5 noon, 0.8 dusk, 0/1 night. */
  dayTime=.38;
  constructor(readonly host:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(36,1,.1,260);
    this.scene.add(this.sun,this.sun.target,this.hemi);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(3072,3072);
    const sc=this.sun.shadow.camera;sc.left=-20;sc.right=20;sc.top=20;sc.bottom=-20;sc.near=1;sc.far=90;
    this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.035;
    this.skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color()},mid:{value:new THREE.Color()},bottom:{value:new THREE.Color()},night:{value:0},sunDir:{value:new THREE.Vector3(0,1,0)}},
      vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform vec3 top;uniform vec3 mid;uniform vec3 bottom;uniform float night;uniform vec3 sunDir;varying vec3 vP;
        float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
        void main(){float y=vP.y;vec3 c=y>0.12?mix(mid,top,smoothstep(.12,.75,y)):mix(bottom,mid,smoothstep(-.15,.12,y));
          // Keep lower-hemisphere cloud coordinates finite; NaN spreads through the bloom pyramid.
          vec2 cp=vP.xz/max(y+.25,.1)*2.;float cl=n2(cp*1.2)*.6+n2(cp*2.7)*.3+n2(cp*6.)*.1;cl=smoothstep(.55,.85,cl)*smoothstep(.02,.3,y)*(1.-night*.7);
          c=mix(c,vec3(1.,.99,.97)*(1.-night*.75),cl*.75);
          float sd=max(dot(vP,normalize(sunDir)),0.);c+=vec3(1.,.9,.7)*(pow(sd,400.)*3.+pow(sd,8.)*.25)*(1.-night);
          vec2 g=floor(vP.xz/(abs(vP.y)+.2)*90.);float s=step(.997,h(g))*smoothstep(.1,.5,y)*night;
          gl_FragColor=vec4(c+vec3(s),1.);}`});
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(200,48,24),this.skyMat);this.sky.renderOrder=-10;this.sky.frustumCulled=false;this.scene.add(this.sky);
    this.envSky=new THREE.Mesh(new THREE.SphereGeometry(10,32,16),this.skyMat.clone());this.envScene.add(this.envSky);
    this.scene.fog=new THREE.Fog('#cfe6f2',26,60);
    this.pmrem=new THREE.PMREMGenerator(this.renderer);
    const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
    this.composer=new EffectComposer(this.renderer,target);
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.ao=new SoftAO(this.scene,this.camera,1,1);this.ao.blendIntensity=.85;
    this.ao.updateGtaoMaterial({radius:.6,distanceExponent:1.4,thickness:1.2,scale:1.1,samples:12});this.ao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:6,rings:2,samples:12});
    this.composer.addPass(this.ao);
    this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.35,.6,.86);this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade=new ShaderPass(GradeShader);this.composer.addPass(this.grade);
    this.resize();addEventListener('resize',()=>this.resize());
    this.setMood('meadow');
  }
  /** 'high' keeps ambient occlusion; 'low' drops it and caps pixel ratio for weaker GPUs. */
  setQuality(q:'high'|'low'){this.setLevel(q==='high'?2:0);}
  /** 2 = full (AO, native pixel ratio ≤2), 1 = no AO at 1.5×, 0 = no AO at 1×. */
  level=2;
  setLevel(l:number){
    this.level=Math.max(0,Math.min(2,l));this.ao.enabled=this.level===2;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,[1,1.5,2][this.level]));this.resize();
  }
  resize(){
    const w=this.host.clientWidth||innerWidth,h=this.host.clientHeight||innerHeight;
    this.renderer.setSize(w,h);this.composer.setPixelRatio(this.renderer.getPixelRatio());this.composer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
    this.bloom.resolution.set(w,h);
  }
  setMood(theme:string){this.mood=moods[theme]??moods.meadow;this.applyLight();}
  /** Light and sky follow the mood blended with the time of day; caves ignore the sun cycle. */
  applyLight(){
    const m=this.mood,cave=m===moods.cave||m===moods.lava||m===moods.astral||m===moods.forge;
    const t=this.dayTime,day=cave?1:Math.max(0,Math.sin(Math.PI*(t-.05)/.9));
    const dusk=cave?0:Math.max(0,1-Math.abs(t-.8)/.08)+Math.max(0,1-Math.abs(t-.22)/.06)*.6;
    const night=1-Math.min(1,day*1.4);
    const nightTint=new THREE.Color('#1c2850'),duskTint=new THREE.Color('#ff9a5a');
    const sky=m.sky.map(c=>new THREE.Color(c).lerp(nightTint,night*.85).lerp(duskTint,dusk*.35));
    for(const u of [this.skyMat.uniforms,(this.envSky.material as THREE.ShaderMaterial).uniforms]){u.top.value.copy(sky[0]);u.mid.value.copy(sky[1]);u.bottom.value.copy(sky[2]);u.night.value=night;}
    const fog=new THREE.Color(m.fog).lerp(nightTint,night*.75).lerp(duskTint,dusk*.25);
    (this.scene.fog as THREE.Fog).color.copy(fog);(this.scene.fog as THREE.Fog).near=m.fogNear;(this.scene.fog as THREE.Fog).far=m.fogFar;
    this.sun.color.set(m.sun).lerp(duskTint,dusk*.6);this.sun.intensity=m.sunI*(.2+.8*day);
    this.hemi.color.set(m.hemi[0]).lerp(nightTint,night*.6);this.hemi.groundColor.set(m.hemi[1]);this.hemi.intensity=m.hemiI*(.6+.4*day);
    this.scene.environmentIntensity=.75-night*.35;
    this.bloom.strength=m.bloom+night*.3;this.bloom.threshold=.86-night*.12;
    this.renderer.toneMappingExposure=1.02-night*.12;
    this.grade.uniforms.lift.value.set(night>.5?'#dfe8ff':'#fff2e0');
    // Re-bake the image-based light when the sky changed noticeably.
    if(this.envMood!==m||Math.abs(night-this.envNight)>.12){
      this.envMood=m;this.envNight=night;const old=this.envRT;
      this.envRT=this.pmrem.fromScene(this.envScene,0,.1,100);this.scene.environment=this.envRT.texture;old?.dispose();
    }
  }
  get night(){return this.mood===moods.cave?.6:1-Math.min(1,Math.max(0,Math.sin(Math.PI*(this.dayTime-.05)/.9))*1.4);}
  /** Keep the shadow frustum and sky centred on what the camera looks at. */
  follow(focus:THREE.Vector3){
    const t=this.dayTime,a=(t-.25)*Math.PI*2*.6;
    this.sun.position.set(focus.x+Math.cos(a)*16,22,focus.z+10+Math.sin(a)*7);this.sun.target.position.copy(focus);
    // Snap the shadow camera to texels to stop shadow edges shimmering while walking.
    const texel=40/3072;this.sun.position.x=Math.round(this.sun.position.x/texel)*texel;this.sun.position.z=Math.round(this.sun.position.z/texel)*texel;
    this.sun.target.position.x=Math.round(focus.x/texel)*texel;this.sun.target.position.z=Math.round(focus.z/texel)*texel;
    (this.skyMat.uniforms.sunDir.value as THREE.Vector3).copy(this.sun.position).sub(focus).normalize();
    this.sky.position.copy(this.camera.position);
  }
  render(){this.composer.render();}
}
