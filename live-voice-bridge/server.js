'use strict';

// NICHODEVS Live Voice Bridge — Node.js puro, sem dependências externas.
// Recebe PCM mono de 16 bits por WebSocket e salva um WAV por sessão.
// Não cria um endpoint de microfone do Windows: isso exige integração nativa/driver.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const HOST = '127.0.0.1'; // intencionalmente limitado à máquina local
const PORT = Number(process.env.LIVE_VOICE_PORT || 8787);
const TOKEN = process.env.LIVE_VOICE_TOKEN || crypto.randomBytes(18).toString('hex');
const RECORDINGS = path.join(__dirname, 'recordings');
const ALLOWED_ORIGINS = new Set([
  'https://nichodev.com',
  'https://www.nichodev.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
]);
fs.mkdirSync(RECORDINGS, { recursive: true });

function wavHeader(sampleRate, dataBytes) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + dataBytes, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(dataBytes, 40);
  return h;
}

function wsFrame(payload, opcode = 1) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x80 | opcode, body.length]);
  } else if (body.length <= 65535) {
    header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(body.length, 2);
  } else {
    header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(body.length), 2);
  }
  return Buffer.concat([header, body]);
}

function closeFrame(code, reason = '') {
  const reasonBytes = Buffer.from(reason).subarray(0, 120);
  const payload = Buffer.alloc(2 + reasonBytes.length);
  payload.writeUInt16BE(code, 0); reasonBytes.copy(payload, 2);
  return wsFrame(payload, 8);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ status: 'ok', app: 'NICHODEVS Live Voice Bridge', host: HOST, port: PORT, protocol: 'PCM16 mono WebSocket', virtualMicrophone: false }));
    return;
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('NICHODEVS Live Voice Bridge ativo. Use /health para verificar o serviço.\n');
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const origin = req.headers.origin;
  if (url.pathname !== '/live-voice') return socket.end('HTTP/1.1 404 Not Found\r\n\r\n');
  if (origin && !ALLOWED_ORIGINS.has(origin)) return socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
  if (!safeEqual(url.searchParams.get('token') || '', TOKEN)) return socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n');
  const key = req.headers['sec-websocket-key'];
  if (!key || req.headers.upgrade?.toLowerCase() !== 'websocket') return socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');

  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');

  const sampleRate = Math.max(8000, Math.min(96000, Number(url.searchParams.get('sampleRate')) || 48000));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `nichodevs-live-voice-${stamp}.wav`;
  const filePath = path.join(RECORDINGS, fileName);
  const fd = fs.openSync(filePath, 'w');
  fs.writeSync(fd, wavHeader(sampleRate, 0));
  let dataBytes = 0;
  let frames = Buffer.alloc(0);
  let closed = false;
  let lastStatus = Date.now();

  function sendStatus() {
    if (closed || socket.destroyed) return;
    const msg = JSON.stringify({ type: 'bridge-status', sampleRate, seconds: Math.floor(dataBytes / (sampleRate * 2)), file: fileName });
    try { socket.write(wsFrame(msg)); } catch (_) {}
  }
  const statusTimer = setInterval(sendStatus, 1000);

  function finish() {
    if (closed) return;
    closed = true;
    clearInterval(statusTimer);
    try { fs.writeSync(fd, wavHeader(sampleRate, dataBytes), 0, 44, 0); } catch (_) {}
    try { fs.closeSync(fd); } catch (_) {}
    console.log(`Sessão finalizada: ${filePath} (${(dataBytes / 1024).toFixed(1)} KiB de PCM)`);
  }

  function handleFrame(opcode, payload) {
    if (opcode === 8) {
      if (!socket.destroyed) socket.end(closeFrame(1000, 'Sessão finalizada'));
      finish();
      return;
    }
    if (opcode === 9) { try { socket.write(wsFrame(payload, 10)); } catch (_) {} return; }
    if (opcode === 2) {
      if (!payload.length || dataBytes + payload.length > 0xFFFFFFFF - 36) return;
      // O navegador envia PCM16 little-endian, mono.
      fs.writeSync(fd, payload);
      dataBytes += payload.length;
      if (Date.now() - lastStatus >= 1000) { lastStatus = Date.now(); sendStatus(); }
    }
  }

  socket.on('data', chunk => {
    frames = Buffer.concat([frames, chunk]);
    while (frames.length >= 2) {
      const b0 = frames[0], b1 = frames[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let length = b1 & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (frames.length < 4) return;
        length = frames.readUInt16BE(2); offset = 4;
      } else if (length === 127) {
        if (frames.length < 10) return;
        const big = frames.readBigUInt64BE(2);
        if (big > 16n * 1024n * 1024n) { socket.end(closeFrame(1009, 'Frame muito grande')); finish(); return; }
        length = Number(big); offset = 10;
      }
      let mask;
      if (masked) {
        if (frames.length < offset + 4) return;
        mask = frames.subarray(offset, offset + 4); offset += 4;
      }
      if (frames.length < offset + length) return;
      let payload = Buffer.from(frames.subarray(offset, offset + length));
      frames = frames.subarray(offset + length);
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      handleFrame(opcode, payload);
      if (closed) break;
    }
  });
  socket.on('error', err => { if (!closed) console.error('WebSocket:', err.message); finish(); });
  socket.on('close', finish);
  sendStatus();
});

function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

server.listen(PORT, HOST, () => {
  console.log('\nNICHODEVS LIVE VOICE BRIDGE');
  console.log(`Serviço local: http://${HOST}:${PORT}/health`);
  console.log(`WebSocket: ws://${HOST}:${PORT}/live-voice`);
  console.log(`TOKEN (cole no Voice Studio): ${TOKEN}`);
  console.log(`Gravações WAV: ${RECORDINGS}`);
  console.log('\nImportante: este bridge recebe PCM e grava WAV. Ele NÃO cria um microfone virtual do Windows.');
  console.log('Mantenha esta janela aberta enquanto usar a ponte.\n');
});

process.on('SIGINT', () => { console.log('\nEncerrando bridge…'); server.close(() => process.exit(0)); });
