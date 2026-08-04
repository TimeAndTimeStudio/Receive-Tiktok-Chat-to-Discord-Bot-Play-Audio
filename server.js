// ==========================================================
// Server
// รับ Event (JSON) จาก Gateway ตัวแรกผ่าน HTTP POST
// คัดข้อความที่ยาวไม่เกิน config.filter.maxLength -> ส่งเข้าคิว TTS
// ==========================================================

const http = require("http");
const config = require("./config");
const queue = require("./queue");

// ดึงข้อความจาก event ที่ normalize มาจาก Gateway
// รองรับหลายรูปแบบ field เพราะโครงสร้าง data ขึ้นกับ EulerStream
function extractText(body) {
  const data = body && body.data;
  if (!data) return null;

  if (typeof data === "string") return data;

  return data.comment || data.text || data.message || data.content || null;
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
    // กันข้อมูล payload ใหญ่ผิดปกติ
    if (body.length > 1_000_000) req.destroy();
  });

  req.on("end", () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      res.writeHead(400);
      res.end("Invalid JSON");
      return;
    }

    const text = extractText(parsed);

    if (text && text.length > 0 && text.length <= config.filter.maxLength) {
      queue.enqueueText(text);
    }

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
