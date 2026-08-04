// ==========================================================
// Config
// แก้ไขค่าตรงนี้โดย Developer เท่านั้น
// ==========================================================

module.exports = {
  // HTTP server ที่รับ event จาก Gateway ตัวแรก
  server: {
    port: 8000,
    path: "/events",
  },

  // เงื่อนไขความยาวข้อความที่จะแปลงเป็นเสียง
  filter: {
    maxLength: 200,
  },

  // Discord Bot
  discord: {
    token: "YOUR_DISCORD_BOT_TOKEN",
    guildId: "YOUR_GUILD_ID",
    voiceChannelId: "YOUR_VOICE_CHANNEL_ID",
  },

  // Azure Speech (TTS)
  azure: {
    speechKey: "YOUR_AZURE_SPEECH_KEY",
    speechRegion: "YOUR_AZURE_SPEECH_REGION", // เช่น "southeastasia"
    voiceName: "th-TH-PremwadeeNeural",
    lang: "th-TH",
    rate: "0%",
    pitch: "0%",
    outputFormat: "audio-24khz-160kbitrate-mono-mp3",
  },

  // โฟลเดอร์เก็บไฟล์เสียงชั่วคราว (จะถูกลบหลังเล่นจบ)
  audio: {
    tempDir: "./tmp_audio",
  },
};
