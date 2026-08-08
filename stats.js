// ==========================================================
// Stats
// เก็บเวลาที่ใช้ในแต่ละช่วงของ pipeline ต่อ 1 ข้อความ:
//   1. queueWaitMs   = เวลารอคิวก่อนได้ยิงไป Azure
//   2. azureApiMs    = เวลาที่ Azure ใช้แปลงเสียงจริง ๆ
//   3. discordWaitMs = เวลาที่ไฟล์เสียงรอคิวเล่นใน Discord (รอไฟล์ก่อนหน้าเล่นจบ + delay ที่ตั้งไว้)
//   4. discordPlayMs = เวลาที่ใช้เล่นเสียงจริง ๆ ใน Discord
//
// เมื่อโปรแกรมถูกปิด (Ctrl+C / SIGTERM) จะสรุปผลรวม (count/avg/min/max
// ของแต่ละช่วง) เขียนลง logs/summary.log ให้อัตโนมัติ
// ==========================================================

const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "logs");
const SUMMARY_FILE = path.join(LOG_DIR, "summary.log");

try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (err) {
  // เดี๋ยว writeSummary จะ catch เองตอนเขียนไฟล์จริง
}

// รีเซ็ต summary.log ทุกครั้งที่รันโปรแกรมใหม่ (ไม่ต่อจากรันก่อนหน้า)
try {
  fs.writeFileSync(SUMMARY_FILE, `[${new Date().toISOString()}] === Summary log started (fresh file on process start) ===\n`);
} catch (err) {
  // ถ้าเขียนไม่ได้ตอน reset ก็ปล่อยให้ writeSummary error เองตอนใช้งานจริง
}

// records[id] = { text, queueWaitMs, azureApiMs, discordWaitMs, discordPlayMs }
const records = new Map();

function start(id, text) {
  records.set(id, { text, queueWaitMs: null, azureApiMs: null, discordWaitMs: null, discordPlayMs: null });
}

function record(id, field, ms) {
  const r = records.get(id);
  if (!r) return;
  r[field] = ms;
}

function stats(values) {
  const nums = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (nums.length === 0) return { count: 0, avg: 0, min: 0, max: 0 };
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    count: nums.length,
    avg: Math.round(sum / nums.length),
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

function buildSummaryText() {
  const all = Array.from(records.values());

  const queueWait = stats(all.map((r) => r.queueWaitMs));
  const azureApi = stats(all.map((r) => r.azureApiMs));
  const discordWait = stats(all.map((r) => r.discordWaitMs));
  const discordPlay = stats(all.map((r) => r.discordPlayMs));

  const totalPerMsg = all.map((r) => {
    const parts = [r.queueWaitMs, r.azureApiMs, r.discordWaitMs, r.discordPlayMs];
    if (parts.some((p) => typeof p !== "number")) return null; // ยังไม่ครบทุกขั้น (เช่นถูก kill กลางคัน)
    return parts.reduce((a, b) => a + b, 0);
  });
  const total = stats(totalPerMsg);

  const lines = [];
  lines.push("========================================");
  lines.push(`สรุปเวลาการทำงาน ณ ${new Date().toISOString()}`);
  lines.push(`จำนวนข้อความทั้งหมดที่ track: ${all.length}`);
  lines.push("");
  lines.push(
    `1) รอคิว (queueWaitMs)      : count=${queueWait.count} avg=${queueWait.avg}ms min=${queueWait.min}ms max=${queueWait.max}ms`
  );
  lines.push(
    `2) Azure TTS API (azureApiMs): count=${azureApi.count} avg=${azureApi.avg}ms min=${azureApi.min}ms max=${azureApi.max}ms`
  );
  lines.push(
    `3) รอคิวเล่น Discord (discordWaitMs): count=${discordWait.count} avg=${discordWait.avg}ms min=${discordWait.min}ms max=${discordWait.max}ms`
  );
  lines.push(
    `4) เล่นเสียงจริงใน Discord (discordPlayMs): count=${discordPlay.count} avg=${discordPlay.avg}ms min=${discordPlay.min}ms max=${discordPlay.max}ms`
  );
  lines.push(
    `รวมทั้ง pipeline ต่อข้อความ (total) : count=${total.count} avg=${total.avg}ms min=${total.min}ms max=${total.max}ms`
  );
  lines.push("========================================\n");

  return lines.join("\n");
}

function writeSummary(reason = "shutdown") {
  try {
    const text = `\n[summary] เขียนตอน: ${reason}\n` + buildSummaryText();
    fs.appendFileSync(SUMMARY_FILE, text);
    console.log(`[stats] Wrote summary to ${SUMMARY_FILE} (reason: ${reason})`);
  } catch (err) {
    console.error(`[stats] Failed to write summary: ${err.message}`);
  }
}

// เขียนสรุปอัตโนมัติตอนโปรแกรมถูกปิด
let summaryWritten = false;
function writeSummaryOnce(reason) {
  if (summaryWritten) return;
  summaryWritten = true;
  writeSummary(reason);
}

process.on("SIGINT", () => {
  writeSummaryOnce("SIGINT (Ctrl+C)");
  process.exit(0);
});

process.on("SIGTERM", () => {
  writeSummaryOnce("SIGTERM");
  process.exit(0);
});

process.on("beforeExit", () => {
  writeSummaryOnce("beforeExit");
});

module.exports = { start, record, writeSummary };
