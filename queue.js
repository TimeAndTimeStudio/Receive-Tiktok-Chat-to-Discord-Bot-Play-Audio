// ==========================================================
// Queue
// รับข้อความเข้าคิว -> แปลงเป็นเสียงทีละอัน (เรียง order) -> ส่งไฟล์ให้ player เล่น
// ==========================================================

const path = require("path");
const config = require("./config");
const tts = require("./tts");
const player = require("./player");
const stats = require("./stats");

const textQueue = [];
let processing = false;
let counter = 0;
let msgIdCounter = 0;

// เก็บ text พร้อมเวลาที่เข้าคิว (queuedAt) เพื่อคำนวณว่าแต่ละข้อความ
// "รอคิว" นานแค่ไหน ก่อนจะได้เริ่มยิงไป Azure จริง ๆ
function enqueueText(text) {
  msgIdCounter += 1;
  const id = `m${msgIdCounter}`;
  stats.start(id, text);
  textQueue.push({ id, text, queuedAt: Date.now() });
  processQueue();
}

async function processQueue() {
  if (processing) return;
  if (textQueue.length === 0) return;

  processing = true;

  const { id, text, queuedAt } = textQueue.shift();
  counter += 1;

  const fileName = `${Date.now()}_${counter}.mp3`;
  const filePath = path.join(config.audio.tempDir, fileName);

  // waitMs = เวลาที่ข้อความนี้ค้างอยู่ในคิว รอข้อความก่อนหน้าแปลงเสร็จ
  // (คิวนี้ประมวลผลทีละรายการ ไม่ขนาน ดังนั้นถ้ามีข้อความสั้น ๆ เช่น
  // "อ่าว" เข้ามาตอนคิวยาว มันจะรอคิวนาน แม้ตัวมันเองแปลงเร็วก็ตาม)
  const startedAt = Date.now();
  const waitMs = startedAt - queuedAt;
  stats.record(id, "queueWaitMs", waitMs);

  try {
    const { durationMs: apiMs } = await tts.synthesizeToFile(text, filePath);
    const totalMs = Date.now() - queuedAt;
    stats.record(id, "azureApiMs", apiMs);

    console.log(
      `[queue] TTS OK text="${text}" waitInQueueMs=${waitMs} azureApiMs=${apiMs} totalMs=${totalMs} queueRemaining=${textQueue.length}`
    );

    player.enqueueAudioFile({ id, filePath, text });
  } catch (err) {
    const totalMs = Date.now() - queuedAt;
    console.error(
      `[queue] TTS failed for text="${text}" waitInQueueMs=${waitMs} totalMs=${totalMs}:`,
      err.message
    );
  } finally {
    processing = false;
    processQueue(); // ทำต่อรายการถัดไป (ถ้ามี)
  }
}

module.exports = { enqueueText };
