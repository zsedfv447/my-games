// Tiny synthesized sound set (no audio files). Starts after the first user gesture.
export type Sfx = 'hit'|'crit'|'miss'|'hurt'|'swing'|'arrow'|'fire'|'ice'|'thunder'|'cast'|'levelup'|'joblevel'|'pickup'|'card'|'death'|'warp'|'click'|'heal'|'buy'|'error'|'mvp'|'kill';
export class Audio {
  private ctx:AudioContext|null=null;
  private master:GainNode|null=null;
  private last=new Map<string,number>();
  private combatSources=new Set<AudioScheduledSourceNode>();
  private combatGroup=false;
  volume=.5; muted=false;
  private musicGain:GainNode|null=null;
  private musicTimer:number|undefined;
  private theme:string|null=null;
  musicOn=true;
  unlock(){
    if(this.ctx)return;
    try{this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);}catch{this.ctx=null;}
  }
  /** Procedural background music: a chord progression with pad, bass and a pentatonic melody, scheduled ahead. */
  playMusic(theme:string|null){
    if(theme===this.theme&&this.musicTimer!==undefined)return;
    this.stopMusic();this.theme=theme;
    if(!theme||!this.ctx||!this.musicOn)return;
    const c=this.ctx,song=songs[theme]??songs.meadow;
    this.musicGain=c.createGain();this.musicGain.gain.value=0;this.musicGain.connect(this.master!);
    this.musicGain.gain.linearRampToValueAtTime(.55,c.currentTime+2);
    const beat=60/song.bpm;let next=c.currentTime+.1,step=0,seed=7;
    const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
    const note=(midi:number,t:number,dur:number,type:OscillatorType,vol:number)=>{
      const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=440*2**((midi-69)/12);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+Math.min(.08,dur*.3));g.gain.exponentialRampToValueAtTime(.0008,t+dur);
      o.connect(g);g.connect(this.musicGain!);o.start(t);o.stop(t+dur+.05);
    };
    const tick=()=>{
      if(!this.musicGain)return;
      while(next<c.currentTime+.4){
        const bar=Math.floor(step/8),chord=song.chords[bar%song.chords.length],pos=step%8;
        if(pos===0){for(const n of chord)note(song.root+n,next,beat*8*.95,'triangle',.028);note(song.root+chord[0]-12,next,beat*4,'sine',.07);}
        if(pos===4)note(song.root+chord[0]-12,next,beat*4,'sine',.06);
        if(rnd()<song.density){const scale=song.scale,deg=scale[Math.floor(rnd()*scale.length)];
          note(song.root+12+deg,next,beat*(rnd()<.3?2:1)*.9,song.lead,.045);}
        next+=beat/2;step++;
      }
    };
    tick();this.musicTimer=window.setInterval(tick,120);
  }
  stopMusic(){
    if(this.musicTimer!==undefined){clearInterval(this.musicTimer);this.musicTimer=undefined;}
    if(this.musicGain&&this.ctx){const g=this.musicGain;g.gain.cancelScheduledValues(this.ctx.currentTime);g.gain.setValueAtTime(g.gain.value,this.ctx.currentTime);g.gain.linearRampToValueAtTime(0,this.ctx.currentTime+.6);setTimeout(()=>g.disconnect(),800);}
    this.musicGain=null;
  }
  setMusic(on:boolean){this.musicOn=on;const t=this.theme;if(!on)this.stopMusic();else{this.theme=null;this.playMusic(t);}}
  setVolume(v:number){this.volume=v;if(this.master)this.master.gain.value=this.muted?0:v;}
  setMuted(m:boolean){this.muted=m;if(m)this.stopCombat();if(this.master)this.master.gain.value=m?0:this.volume;}
  stopCombat(){
    for(const source of this.combatSources){try{source.stop(this.ctx?.currentTime??0);source.disconnect();}catch{/* already ended */}}
    this.combatSources.clear();for(const key of this.last.keys())if(key.startsWith('combat:'))this.last.delete(key);
  }
  private retain(source:AudioScheduledSourceNode,nodes:AudioNode[]){
    if(this.combatGroup)this.combatSources.add(source);
    source.onended=()=>{this.combatSources.delete(source);source.disconnect();nodes.forEach(n=>n.disconnect());};
  }
  private tone(freq:number,dur:number,type:OscillatorType='sine',vol=.3,slide=0,delay=0){
    const c=this.ctx!,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),t+dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.connect(g);g.connect(this.master!);this.retain(o,[g]);o.start(t);o.stop(t+dur+.02);
  }
  private noise(dur:number,vol=.25,freq=1800,delay=0){
    const c=this.ctx!,t=c.currentTime+delay,len=Math.ceil(c.sampleRate*dur),b=c.createBuffer(1,len,c.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=freq;g.gain.value=vol;
    s.connect(f);f.connect(g);g.connect(this.master!);this.retain(s,[f,g]);s.start(t);s.stop(t+dur+.02);
  }
  /** v4.5 card reveal: a ~3.5s brass-and-bell fanfare with firework pops; background music ducks under it. */
  cardFanfare(grand=false){
    if(!this.ctx||this.muted)return;
    const c=this.ctx,t0=c.currentTime+.05,step=grand?.16:.18,up=grand?2:0;
    const bus=c.createGain(),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3200;bus.gain.value=.9;bus.connect(lp);lp.connect(this.master!);
    const hz=(m:number)=>440*2**((m+up-69)/12);
    const voice=(m:number,t:number,dur:number,type:OscillatorType,vol:number)=>{const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=hz(m);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.02);g.gain.setValueAtTime(vol*.8,t+dur*.6);g.gain.exponentialRampToValueAtTime(.001,t+dur);
      o.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+.05);o.onended=()=>{o.disconnect();g.disconnect();};};
    const brass=(m:number,t:number,dur:number,vol=.07)=>{voice(m,t,dur,'sawtooth',vol);voice(m+12,t,dur,'triangle',vol*.6);};
    // Pickup arpeggio → held tonic chord → answer phrase → final bright chord.
    [67,72,76,79].forEach((m,i)=>brass(m,t0+i*step,step*1.6,.06));
    let t=t0+4*step;[72,76,79,84].forEach(m=>brass(m,t,step*4,.045));voice(96,t,step*4,'sine',.05);
    t+=step*4;[77,81,84].forEach((m,i)=>brass(m,t+i*step,step*1.4,.05));
    t+=step*3;[79,83,86].forEach((m,i)=>brass(m,t+i*step*.7,step*1.2,.05));
    t+=step*2.4;[72,76,79,84,88].forEach(m=>brass(m,t,step*7,.04));[60,48].forEach(m=>voice(m,t,step*7,'sine',.12));
    for(let i=0;i<8;i++)voice(96+[0,4,7,12][i%4],t+i*.07,.35,'sine',.035);
    const end=t+step*7;
    // Firework pops spread across the fanfare.
    const pops=grand?9:6;for(let i=0;i<pops;i++){const at=.35+i*(end-t0-.4)/pops+Math.random()*.15;this.noise(.32,.22,500+Math.random()*900,at);this.tone(1800+Math.random()*1600,.25,'sine',.025,.4,at+.02);}
    if(this.musicGain){const g=this.musicGain.gain;g.cancelScheduledValues(c.currentTime);g.setValueAtTime(g.value,c.currentTime);g.linearRampToValueAtTime(.12,c.currentTime+.2);g.setValueAtTime(.12,end);g.linearRampToValueAtTime(.55,end+1.2);}
    setTimeout(()=>{bus.disconnect();lp.disconnect();},(end-c.currentTime+1)*1000);
  }
  play(s:Sfx,group:'ui'|'combat'='ui'){
    if(!this.ctx||this.muted)return;
    const now=performance.now(),gap=s==='hit'||s==='swing'?45:20;
    const key=`${group}:${s}`;if(now-(this.last.get(key)??0)<gap)return;this.last.set(key,now);
    const previous=this.combatGroup;this.combatGroup=group==='combat';
    try{switch(s){
      case 'hit':this.noise(.08,.35,1200);this.tone(160,.08,'square',.12,.5);break;
      case 'crit':this.noise(.12,.45,900);this.tone(320,.15,'square',.18,.4);this.tone(880,.12,'triangle',.12,1,.03);break;
      case 'miss':this.noise(.12,.12,3200);break;
      case 'hurt':this.tone(220,.12,'sawtooth',.14,.6);this.noise(.08,.2,700);break;
      case 'swing':this.noise(.09,.16,2600);break;
      case 'arrow':this.noise(.07,.14,4200);this.tone(900,.05,'triangle',.06,.6);break;
      case 'fire':this.noise(.25,.3,600);this.tone(120,.25,'sawtooth',.08,.6);break;
      case 'ice':this.tone(1800,.18,'triangle',.12,.7);this.tone(2400,.12,'sine',.08,1,.04);break;
      case 'thunder':this.noise(.35,.5,300);this.tone(70,.3,'square',.12,.5);break;
      case 'cast':this.tone(660,.25,'sine',.08,1.5);this.tone(990,.25,'sine',.05,1.5,.05);break;
      case 'levelup':[523,659,784,1047].forEach((f,i)=>this.tone(f,.28,'triangle',.18,1,i*.09));break;
      case 'joblevel':[587,740,880].forEach((f,i)=>this.tone(f,.25,'triangle',.15,1,i*.08));break;
      case 'pickup':this.tone(880,.08,'triangle',.12);this.tone(1320,.1,'triangle',.1,1,.05);break;
      case 'card':[784,988,1175,1568].forEach((f,i)=>this.tone(f,.35,'sine',.16,1,i*.07));break;
      case 'death':[392,330,262].forEach((f,i)=>this.tone(f,.4,'triangle',.15,1,i*.18));break;
      case 'warp':this.tone(300,.5,'sine',.15,3);break;
      case 'click':this.tone(1200,.04,'triangle',.06);break;
      case 'heal':this.tone(700,.2,'sine',.1,1.6);break;
      case 'buy':this.tone(1046,.08,'triangle',.1);this.tone(1568,.12,'triangle',.1,1,.06);break;
      case 'error':this.tone(200,.15,'square',.08,.8);break;
      case 'mvp':[392,523,659,784,1047].forEach((f,i)=>this.tone(f,.5,'square',.08,1,i*.12));break;
      case 'kill':this.tone(500,.1,'triangle',.08,.5);break;
    }}finally{this.combatGroup=previous;}
  }
}

type Song={bpm:number;root:number;chords:number[][];scale:number[];density:number;lead:OscillatorType};
const songs:Record<string,Song>={
  town:{bpm:92,root:60,chords:[[0,4,7],[-3,0,4],[-7,-3,0],[-5,-1,2]],scale:[0,2,4,7,9,12],density:.45,lead:'triangle'},
  meadow:{bpm:112,root:55,chords:[[0,4,7],[7,11,14],[9,12,16],[5,9,12]],scale:[0,2,4,7,9,12,14],density:.55,lead:'triangle'},
  forest:{bpm:84,root:62,chords:[[0,3,7],[-2,2,5],[-4,0,3],[-2,2,5]],scale:[0,3,5,7,10,12],density:.35,lead:'sine'},
  cave:{bpm:70,root:57,chords:[[0,3,7],[5,8,12],[0,3,7],[7,11,14]],scale:[0,3,7,10,12,15],density:.25,lead:'sine'},
  ruins:{bpm:76,root:59,chords:[[0,4,7,11],[5,9,12,16],[-3,0,4,7],[7,11,14,17]],scale:[0,2,4,7,9,11,14],density:.3,lead:'sine'},
};
