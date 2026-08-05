// ==========================================================
// Server
// รับ Event (JSON) จาก Gateway ตัวแรกผ่าน HTTP POST
// คัดข้อความที่ยาวไม่เกิน config.filter.maxLength -> ส่งเข้าคิว TTS
// ==========================================================

const http = require("http");
const config = require("./config");
const queue = require("./queue");

// log ตอน drop ข้อความ (เขียนลง console.log ซึ่งถูก logger.js patch ให้ลงไฟล์ด้วยแล้ว)
function logDrop(reason) {
  console.log(`[server] Dropped: ${reason}`);
}

// ดึงข้อความจาก event ที่ normalize มาจาก Gateway
function extractText(body) {
  const data = body && body.data;
  if (!data) return null;

  if (typeof data === "string") return data;

  return data.comment || data.text || data.message || data.content || null;
}

// ฟังก์ชั่นทำความสะอาดและตรวจสอบเงื่อนไขของข้อความ
function cleanAndFilterText(rawText) {
  if (!rawText) return null;

  // 1. ข้ามถ้าข้อความมี @
  if (rawText.includes("@")) {
    return null;
  }

  // 2. ลบ emoji ออกจากข้อความ
  const textWithoutEmoji = rawText
    .replace(/\p{Extended_Pictographic}/gu, "")
    .trim();

  // 3. ข้ามถ้าข้อความว่างเปล่าหลังลบ emoji
  if (!textWithoutEmoji) {
    return null;
  }

  return textWithoutEmoji;
}

function handleRequest(req, res) {
  if (req.method !== "POST" || req.url !== config.server.path) {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) req.destroy();
  });

  req.on("end", () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      logDrop(`invalid JSON - ${err.message}`);
      res.writeHead(400);
      res.end("Invalid JSON");
      return;
    }

    const rawText = extractText(parsed);
    if (!rawText) {
      logDrop("no text field found in event");
      res.writeHead(200);
      res.end("OK");
      return;
    }

    const cleanedText = cleanAndFilterText(rawText);
    if (!cleanedText) {
      logDrop(`empty/filtered after cleaning (raw="${rawText}")`);
      res.writeHead(200);
      res.end("OK");
      return;
    }

    if (cleanedText.length > config.filter.maxLength) {
      logDrop(`too long (${cleanedText.length} > ${config.filter.maxLength} chars)`);
      res.writeHead(200);
      res.end("OK");
      return;
    }

    queue.enqueueText(cleanedText);
    res.writeHead(200);
    res.end("OK");
  });
}

function start() {
  const server = http.createServer(handleRequest);
  server.listen(config.server.port, () => {
    console.log(`[server] Listening on port ${config.server.port}${config.server.path}`);
  });
}

module.exports = { start };
