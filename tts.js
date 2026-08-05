// ==========================================================
// TTS (Azure Cognitive Services Speech - REST API)
//
// เทียบเท่ากับคำสั่ง curl ที่กำหนด:
// POST https://${SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1
// ==========================================================

const fs = require("fs");
const path = require("path");
const config = require("./config");

const AZURE_TIMEOUT_MS = 8000; // กัน Azure ช้าแล้วไปถ่วงคิวข้อความอื่น

function escapeSsml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSsml(text) {
  const { lang, voiceName, rate, pitch } = config.azure;
  const safeText = escapeSsml(text);

  return `<speak version="1.0" xml:lang="${lang}">
    <voice name="${voiceName}">
        <prosody rate="${rate}" pitch="${pitch}">
            ${safeText}
        </prosody>
    </voice>
</speak>`;
}

// เรียก Azure TTS แล้ว save เป็นไฟล์ mp3, คืนค่า path ของไฟล์ที่ save
async function synthesizeToFile(text, filePath) {
  const url = `https://${config.azure.speechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml = buildSsml(text);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AZURE_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": config.azure.speechKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": config.azure.outputFormat,
        "User-Agent": "tts-voice-bot",
      },
      body: ssml,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Azure TTS timed out after ${AZURE_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Azure TTS failed: ${res.status} ${res.statusText} ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

  return filePath;
}

module.exports = { synthesizeToFile };
