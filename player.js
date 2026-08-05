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

let currentFile = null;

function processQueueTracked() {
  if (isPlaying) return;
  if (playQueue.length === 0) return;

  currentFile = playQueue.shift();
  isPlaying = true;

  console.log(`[player] Playing: ${currentFile} (queue remaining: ${playQueue.length})`);

  const resource = createAudioResource(currentFile);
  audioPlayer.play(resource);
}

// เมื่อเล่นจบ หน่วงเวลาตาม config ก่อนอ่านคอมเมนต์ถัดไป
audioPlayer.on(AudioPlayerStatus.Idle, () => {
  isPlaying = false;

  if (currentFile) {
    cleanupFile(currentFile);
    currentFile = null;
  }

  setTimeout(() => {
    processQueueTracked();
  }, config.audio.delayBetweenCommentsMs);
});

audioPlayer.on("error", (err) => {
  console.error("[player] AudioPlayer error:", err.message);
  isPlaying = false;

  if (currentFile) {
    cleanupFile(currentFile);
    currentFile = null;
  }

  setTimeout(() => {
    processQueueTracked();
  }, config.audio.delayBetweenCommentsMs);
});

module.exports = {
  connectVoice,
  enqueueAudioFile: (filePath) => {
    playQueue.push(filePath);
    processQueueTracked();
  },
};
