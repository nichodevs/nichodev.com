const crypto=require('node:crypto');
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function encode(bytes){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out;}
function decode(secret){let bits=0,value=0,out=[];for(const char of secret){const n=alphabet.indexOf(char);if(n<0)throw Error('Invalid secret');value=(value<<5)|n;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
function totp(secret,step,digits=6){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const mac=crypto.createHmac('sha1',decode(secret)).update(counter).digest(),offset=mac[19]&15;return String((mac.readUInt32BE(offset)&0x7fffffff)%10**digits).padStart(digits,'0');}
function match(secret,code,last=-1,time=Date.now()){
  if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;
  const step=Math.floor(time/30000);
  for(const candidate of [step,step-1,step+1])if(candidate>last&&crypto.timingSafeEqual(Buffer.from(totp(secret,candidate)),Buffer.from(code)))return candidate;
  return null;
}
function cipher(key){
  const derived=crypto.createHmac('sha256',key).update('nichodev-admin-totp-v1').digest();
  return {
    seal(value){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',derived,iv);return Buffer.concat([iv,c.update(value,'utf8'),c.final(),c.getAuthTag()]).toString('base64url');},
    open(value){const b=Buffer.from(value,'base64url'),c=crypto.createDecipheriv('aes-256-gcm',derived,b.subarray(0,12));c.setAuthTag(b.subarray(-16));return Buffer.concat([c.update(b.subarray(12,-16)),c.final()]).toString('utf8');}
  };
}
module.exports={encode,totp,match,cipher};
