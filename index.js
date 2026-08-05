// ==========================================================
// Minimal TTS Voice Bot
//
// รับ Event จาก Gateway (HTTP) -> คัดข้อความไม่เกิน 200 ตัวอักษร
// -> Azure TTS -> เล่นใน Discord Voice Channel ตามคิว -> ลบไฟล์หลังเล่นจบ
// ==========================================================

const { Client, GatewayIntentBits } = require("discord.js");
require("./logger"); // ต้อง require ก่อนตัวอื่นเพื่อให้ patch console.log/error ทันเวลา
const config = require("./config");
const player = require("./player");
const server = require("./server");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once("clientReady", async () => {
  console.log(`[bot] Logged in as ${client.user.tag}`);

  await player.connectVoice(client);

  server.start();
});

client.login(config.discord.token);
