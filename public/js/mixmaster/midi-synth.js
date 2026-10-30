import { FREQUENCIES } from "./project-model.js?v=1";

export function scheduleMidiNotes(ctx,clip,bpm,when,offset,output,onSource=()=>{}){
  const stepDuration=60/bpm/4;
  for(const note of clip.notes||[]){
    const at=clip.start+note.step*stepDuration;
    if(at<offset)continue;
    const osc=ctx.createOscillator(),gain=ctx.createGain(),start=when+at-offset;
    osc.type="square";osc.frequency.value=FREQUENCIES[note.pitch]||440;
    gain.gain.setValueAtTime(0,start);
    gain.gain.linearRampToValueAtTime((note.velocity??.7)*.25,start+.012);
    gain.gain.setValueAtTime((note.velocity??.7)*.25,start+stepDuration*.75);
    gain.gain.linearRampToValueAtTime(0,start+stepDuration*.95);
    osc.connect(gain);gain.connect(output);osc.start(start);osc.stop(start+stepDuration);
    onSource(osc,gain);
  }
}
