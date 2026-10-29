"use strict";

function wav(seconds = 1, frequency = 0) {
  const rate = 8000, samples = rate * seconds, buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) buffer.writeInt16LE(frequency ? Math.round(16384 * Math.sin(2 * Math.PI * frequency * i / rate)) : 16384, 44 + i * 2);
  return buffer;
}

async function downloadBytes(page, selector) {
  const pending = page.waitForEvent("download");
  await page.locator(selector).click();
  const stream = await (await pending).createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = { wav, downloadBytes };
