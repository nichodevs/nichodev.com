"use strict";
(() => {
  const TITLES = {gain:'VOLUME',filter:'FILTRO',delay:'DELAY',distortion:'DISTORÇÃO',reverb:'REVERB'};
  const FIELDS = {
    gain:[['gain','Saída',0,150,100,'%']],
    filter:[['frequency','Frequência',150,8000,1800,'Hz'],['q','Ressonância',0.1,12,1,'']],
    delay:[['time','Tempo',80,800,280,'ms'],['feedback','Retorno',0,85,30,'%'],['mix','Mistura',0,80,35,'%']],
    distortion:[['amount','Intensidade',0,100,35,'%']],
    reverb:[['mix','Mistura',0,90,30,'%']]
  };

  function makeEffect(ctx, type, values){
    if(type==='gain'){
      const node=ctx.createGain(); node.gain.value=values.gain/100;
      return {input:node,output:node,nodes:[node],update:()=>{node.gain.setTargetAtTime(values.gain/100,ctx.currentTime,0.015)}};
    }
    if(type==='filter'){
      const node=ctx.createBiquadFilter(); node.type='lowpass';
      const update=()=>{node.frequency.setTargetAtTime(Number(values.frequency),ctx.currentTime,0.015);node.Q.setTargetAtTime(Number(values.q),ctx.currentTime,0.015)};
      update(); return {input:node,output:node,nodes:[node],update};
    }
    if(type==='distortion'){
      const node=ctx.createWaveShaper(); node.oversample='4x';
      const update=()=>{const amount=Number(values.amount),curve=new Float32Array(44100);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=(1+amount/12)*x/(1+amount/12*Math.abs(x))}node.curve=curve};
      update();return {input:node,output:node,nodes:[node],update};
    }
    if(type==='delay'){
      const input=ctx.createGain(),delay=ctx.createDelay(2),feedback=ctx.createGain(),wet=ctx.createGain(),dry=ctx.createGain(),output=ctx.createGain();
      input.connect(dry);dry.connect(output);input.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(output);
      const update=()=>{const mix=Number(values.mix)/100;delay.delayTime.setTargetAtTime(Number(values.time)/1000,ctx.currentTime,0.015);feedback.gain.setTargetAtTime(Number(values.feedback)/100,ctx.currentTime,0.015);wet.gain.setTargetAtTime(mix,ctx.currentTime,0.015);dry.gain.setTargetAtTime(1-mix*.45,ctx.currentTime,0.015)};
      update();return {input,output,nodes:[input,delay,feedback,wet,dry,output],update};
    }
    const input=ctx.createGain(),convolver=ctx.createConvolver(),dry=ctx.createGain(),wet=ctx.createGain(),output=ctx.createGain();
    const seconds=1.2,length=Math.floor(ctx.sampleRate*seconds),ir=ctx.createBuffer(2,length,ctx.sampleRate);
    for(let ch=0;ch<2;ch++){const data=ir.getChannelData(ch);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,3)}
    convolver.buffer=ir;input.connect(dry);dry.connect(output);input.connect(convolver);convolver.connect(wet);wet.connect(output);
    const update=()=>{const mix=Number(values.mix)/100;dry.gain.setTargetAtTime(1-mix*.5,ctx.currentTime,0.015);wet.gain.setTargetAtTime(mix,ctx.currentTime,0.015)};
    update();return {input,output,nodes:[input,convolver,dry,wet,output],update};
  }

  class LiveModularFX{
    constructor(ctx,toneOutput,processedDestination,container,status){
      this.ctx=ctx;this.toneOutput=toneOutput;this.container=container;this.status=status;this.items=[];this.serial=0;
      this.input=ctx.createGain();this.output=ctx.createGain();
      toneOutput.connect(this.input);this.output.connect(ctx.destination);this.output.connect(processedDestination);
      document.querySelectorAll('[data-live-fx-add]').forEach(button=>button.addEventListener('click',()=>this.add(button.dataset.liveFxAdd)));
      this.render();this.rebuild();
    }
    add(type,values){
      if(!FIELDS[type])return;
      const params=Object.fromEntries(FIELDS[type].map(([key,,min,max,value])=>[key,values?.[key]??value]));
      const item={id:++this.serial,type,params,effect:makeEffect(this.ctx,type,params)};
      this.items.push(item);this.render();this.rebuild();this.say(`${TITLES[type]} adicionado à cadeia ao vivo.`);
    }
    remove(id){const index=this.items.findIndex(item=>item.id===id);if(index<0)return;this.disposeItem(this.items[index]);this.items.splice(index,1);this.render();this.rebuild();this.say('Módulo removido da cadeia ao vivo.')}
    move(id,direction){const index=this.items.findIndex(item=>item.id===id),next=index+direction;if(index<0||next<0||next>=this.items.length)return;[this.items[index],this.items[next]]=[this.items[next],this.items[index]];this.render();this.rebuild();this.say('Ordem da cadeia atualizada.')}
    update(item){item.effect.update()}
    disposeItem(item){try{item.effect.input.disconnect();item.effect.output.disconnect()}catch(e){}for(const node of item.effect.nodes){try{node.disconnect()}catch(e){}}}
    rebuild(){
      try{this.input.disconnect()}catch(e){}
      for(const item of this.items){try{item.effect.input.disconnect();item.effect.output.disconnect()}catch(e){}}
      let previous=this.input;
      for(const item of this.items){previous.connect(item.effect.input);previous=item.effect.output}
      previous.connect(this.output);
      this.status.textContent=this.items.length?`${this.items.length} módulo(s) ativo(s) no monitoramento e na gravação ao vivo.`:'Sem módulos: o áudio ao vivo passa direto. Ligue o microfone para ouvir.';
    }
    say(message){this.status.textContent=message}
    render(){
      this.container.replaceChildren();
      if(!this.items.length){const empty=document.createElement('p');empty.className='live-fx-empty';empty.textContent='A cadeia está vazia. Adicione um módulo para começar.';this.container.append(empty);return}
      this.items.forEach((item,index)=>{
        const card=document.createElement('article');card.className='live-fx-module';
        const head=document.createElement('header'),title=document.createElement('strong');title.textContent=`${String(index+1).padStart(2,'0')} / ${TITLES[item.type]}`;head.append(title);
        const actions=document.createElement('div');actions.className='live-fx-actions';
        [['↑','Mover para cima',-1],['↓','Mover para baixo',1]].forEach(([label,aria,direction])=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',aria);button.disabled=(direction<0&&index===0)||(direction>0&&index===this.items.length-1);button.addEventListener('click',()=>this.move(item.id,direction));actions.append(button)});
        const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remover ${TITLES[item.type]}`);remove.addEventListener('click',()=>this.remove(item.id));actions.append(remove);head.append(actions);card.append(head);
        const body=document.createElement('div');body.className='live-fx-module-body';
        FIELDS[item.type].forEach(([key,label,min,max,initial,unit])=>{const row=document.createElement('label'),caption=document.createElement('span'),output=document.createElement('output'),range=document.createElement('input');caption.textContent=label;output.textContent=`${item.params[key]}${unit}`;range.type='range';range.min=min;range.max=max;range.step=key==='q'?'.1':'1';range.value=item.params[key];range.addEventListener('input',()=>{item.params[key]=Number(range.value);output.textContent=`${range.value}${unit}`;item.effect.update()});row.append(caption,output,range);body.append(row)});
        card.append(body);this.container.append(card);
      });
    }
    destroy(){
      try{this.toneOutput.disconnect(this.input)}catch(e){}
      try{this.input.disconnect();this.output.disconnect()}catch(e){}
      this.items.forEach(item=>this.disposeItem(item));this.items=[];this.container.replaceChildren();
      this.status.textContent='Modular FX desligado.';
    }
  }
  window.LiveModularFX=LiveModularFX;
})();
