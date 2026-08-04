// ==========================================================
// Queue
// รับข้อความเข้าคิว -> แปลงเป็นเสียงทีละอัน (เรียง order) -> ส่งไฟล์ให้ player เล่น
// ==========================================================

const path = require("path");
const config = require("./config");
const tts = require("./tts");
const player = require("./player");

const textQueue = [];
let processing = false;
let counter = 0;

function enqueueText(text) {
  textQueue.push(text);
  processQueue();
}

async function processQueue() {
  if (processing) return;
  if (textQueue.length === 0) return;

  processing = true;

  const text = textQueue.shift();
  counter += 1;

  const fileName = `${Date.now()}_${counter}.mp3`;
  const filePath = path.join(config.audio.tempDir, fileName);

  try {
    await tts.synthesizeToFile(text, filePath);
    player.enqueueAudioFile(filePath);
  } catch (err) {
    console.error(`[queue] TTS failed for text "${text}":`, err.message);
  } finally {
    processing = false;
    processQueue(); // ทำต่อรายการถัดไป (ถ้ามี)
  }
}

module.exports = { enqueueText };
