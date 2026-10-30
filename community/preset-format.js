(function (root) {
  "use strict";
  const guitarIds = ["ns2","cs3","bd2","ds1","ge7","ch1","bf3","ph3","fuzz","octfuzz","vibrato","tr2","dd8","rv6","shimmer"];
  const voiceBounds = {pitch:[-12,12],formant:[-50,50],bass:[-12,12],mid:[-12,12],treble:[-12,12],drive:[0,100],chorus:[0,100],reverb:[0,100],tremolo:[0,100],phaser:[0,100],delay:[0,100],octave:[-1,1],distortion:[0,100],wah:[0,100],fuzz:[0,100],octafuzz:[0,100],vibrato:[0,100],vol:[0,150]};
  const voiceIds = ["pitch","formant","eq","drive","chorus","reverb","tremolo","phaser","delay","octave","distortion","wah","fuzz","octafuzz","vibrato","volume"];
  const exact = (object,keys) => object && typeof object==="object" && !Array.isArray(object) && Object.keys(object).length===keys.length && keys.every(key=>Object.hasOwn(object,key));
  function validatePreset(value) {
    const invalid=()=>{throw new Error("O preset não é compatível com esta versão da ferramenta.");};
    if(!exact(value,["app","version","tool","data"])||value.app!=="nichodev-preset"||value.version!==1||!["voz","guitarra"].includes(value.tool))invalid();
    const data=value.data,ids=value.tool==="voz"?voiceIds:guitarIds;
    if(!exact(data,value.tool==="voz"?["values","enabled"]:["values","enabled","order","gain","tone","master"]))invalid();
    const bounds=value.tool==="voz"?voiceBounds:Object.fromEntries(guitarIds.map(id=>[id,[0,100]]));
    if(!exact(data.values,Object.keys(bounds))||!exact(data.enabled,ids))invalid();
    for(const [key,[min,max]]of Object.entries(bounds))if(!Number.isInteger(data.values[key])||data.values[key]<min||data.values[key]>max)invalid();
    for(const key of ids)if(typeof data.enabled[key]!=="boolean")invalid();
    if(value.tool==="guitarra"){
      if(!Array.isArray(data.order)||data.order.length!==ids.length||new Set(data.order).size!==ids.length||data.order.some(id=>!ids.includes(id)))invalid();
      for(const key of ["gain","tone","master"])if(!Number.isFinite(data[key])||data[key]<0||data[key]>100)invalid();
    }
    return JSON.parse(JSON.stringify(value));
  }
  function initialPreset(tool) {
    const values=tool==="voz"?Object.fromEntries(Object.keys(voiceBounds).map(key=>[key,key==="vol"?100:0])):Object.fromEntries(guitarIds.map(key=>[key,key==="ge7"?50:0]));
    const enabled=Object.fromEntries((tool==="voz"?voiceIds:guitarIds).map(key=>[key,tool==="voz"||key==="ge7"]));
    return {app:"nichodev-preset",version:1,tool,data:tool==="voz"?{values,enabled}:{values,enabled,order:[...guitarIds],gain:12,tone:58,master:55}};
  }
  const api={validatePreset,initialPreset};
  if(typeof module==="object"&&module.exports)module.exports=api;else root.NichodevPresets=api;
})(typeof globalThis==="object"?globalThis:this);
