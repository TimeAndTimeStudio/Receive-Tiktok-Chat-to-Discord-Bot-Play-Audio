// ==========================================================
// Player
// เชื่อมต่อ Discord Voice Channel
// เล่นไฟล์เสียงตามคิว เล่นทีละไฟล์ เล่นจบแล้วลบไฟล์ทิ้ง
// ==========================================================

const fs = require("fs");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

const config = require("./config");
const stats = require("./stats");

const audioPlayer = createAudioPlayer();
const playQueue = [];
let connection = null;
let isPlaying = false;

async function connectVoice(client) {
  const guild = await client.guilds.fetch(config.discord.guildId);
  const channel = await guild.channels.fetch(config.discord.voiceChannelId);

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  connection.subscribe(audioPlayer);

  console.log(`[player] Joined voice channel: ${channel.name}`);
}

function cleanupFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) console.error(`[player] Failed to delete ${filePath}:`, err.message);
  });
}

let currentFile = null; // { id, filePath, text, enqueuedAt, playStartedAt }

function processQueueTracked() {
  if (isPlaying) return;
  if (playQueue.length === 0) return;

  const item = playQueue.shift();
  const playStartedAt = Date.now();

  // discordWaitMs = เวลาที่ไฟล์นี้รอคิวเล่นใน Discord
  // (รอไฟล์ก่อนหน้าเล่นจบ + delayBetweenCommentsMs ที่ตั้งไว้)
  const discordWaitMs = playStartedAt - item.enqueuedAt;
  stats.record(item.id, "discordWaitMs", discordWaitMs);

  currentFile = { ...item, playStartedAt };
  isPlaying = true;

  console.log(
    `[player] Playing: ${item.filePath} text="${item.text}" discordWaitMs=${discordWaitMs} (queue remaining: ${playQueue.length})`
  );

  const resource = createAudioResource(item.filePath);
  audioPlayer.play(resource);
}

function finishCurrent() {
  if (!currentFile) return;

  const discordPlayMs = Date.now() - currentFile.playStartedAt;
  stats.record(currentFile.id, "discordPlayMs", discordPlayMs);

  console.log(
    `[player] Finished: ${currentFile.filePath} text="${currentFile.text}" discordPlayMs=${discordPlayMs}`
  );

  cleanupFile(currentFile.filePath);
  currentFile = null;
}

// เมื่อเล่นจบ หน่วงเวลาตาม config ก่อนอ่านคอมเมนต์ถัดไป
audioPlayer.on(AudioPlayerStatus.Idle, () => {
  isPlaying = false;
  finishCurrent();

  setTimeout(() => {
    processQueueTracked();
  }, config.audio.delayBetweenCommentsMs);
});

audioPlayer.on("error", (err) => {
  console.error("[player] AudioPlayer error:", err.message);
  isPlaying = false;
  finishCurrent();

  setTimeout(() => {
    processQueueTracked();
  }, config.audio.delayBetweenCommentsMs);
});

module.exports = {
  connectVoice,
  // item = { id, filePath, text } ที่ส่งมาจาก queue.js
  enqueueAudioFile: (item) => {
    playQueue.push({ ...item, enqueuedAt: Date.now() });
    processQueueTracked();
  },
};
