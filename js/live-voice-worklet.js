/* NICHODEVS Live Voice — AudioWorklet transport.
 * Buffers 512 mono Float32 samples (~10.7 ms at 48 kHz) and transfers them
 * to the main thread for PCM16 conversion/WebSocket transport. Output is silent.
 */
class NichodevsPcm16BridgeProcessor extends AudioWorkletProcessor {
  constructor(){
    super();
    this.chunkSize = 512;
    this.chunk = new Float32Array(this.chunkSize);
    this.offset = 0;
  }
  process(inputs, outputs){
    const input = inputs[0];
    const output = outputs[0];
    if(output) for(const channel of output) channel.fill(0);
    if(input && input.length){
      const channels = input.length;
      const frames = input[0].length;
      for(let i = 0; i < frames; i++){
        let sample = 0;
        for(let c = 0; c < channels; c++) sample += input[c][i] || 0;
        this.chunk[this.offset++] = sample / Math.max(1, channels);
        if(this.offset === this.chunkSize){
          const transfer = this.chunk;
          this.port.postMessage(transfer, [transfer.buffer]);
          this.chunk = new Float32Array(this.chunkSize);
          this.offset = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('nichodevs-pcm16-bridge', NichodevsPcm16BridgeProcessor);
