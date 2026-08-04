# Minimal TTS Voice Bot (Gateway -> Azure TTS -> Discord Voice)

รับ event จาก **Gateway ตัวแรก** (`tiktok-gateway`) ผ่าน HTTP POST
คัดเฉพาะข้อความที่ยาวไม่เกิน 200 ตัวอักษร -> แปลงเป็นเสียงด้วย Azure Speech
-> เล่นใน Discord Voice Channel เรียงตามคิว -> เล่นจบลบไฟล์ทิ้ง

```
Gateway (tiktok-gateway)
   |  HTTP POST { event, timestamp, data }
   v
server.js       รับ event, คัดความยาว <= 200 ตัวอักษร
   |
   v
queue.js        คิวข้อความ -> เรียกทีละอัน (รักษาลำดับ)
   |
   v
tts.js          เรียก Azure Speech REST API -> save .mp3
   |
   v
player.js       เข้าคิวเล่นเสียง -> เล่นทีละไฟล์ -> เล่นจบลบไฟล์
   |
   v
Discord Voice Channel
```

## Setup

```bash
npm install
```

แก้ไข `config.js`:

```js
server: {
  port: 8000,        // ต้องตรงกับ output.url ของ gateway ตัวแรก
  path: "/events",
}
filter: {
  maxLength: 200,     // ข้อความยาวเกินนี้จะถูกข้าม ไม่แปลงเป็นเสียง
}
discord: {
  token: "...",
  guildId: "...",
  voiceChannelId: "...",
}
azure: {
  speechKey: "...",
  speechRegion: "...",       // เช่น southeastasia
  voiceName: "th-TH-PremwadeeNeural",
}
```

**สำคัญ:** ตั้งค่าฝั่ง `tiktok-gateway/config.js` ให้ `output.url` ชี้มาที่ bot ตัวนี้ เช่น:

```js
output: {
  url: "http://localhost:8000/events",
}
```

## Run

```bash
npm start
```

## Flow เมื่อมีข้อความใหม่เข้ามา

1. `server.js` รับ POST body `{ event, timestamp, data }`
2. ดึงข้อความจาก `data.comment` / `data.text` / `data.message` / `data.content` (แล้วแต่ field ที่ event นั้นมี)
3. ถ้าความยาว <= 200 ตัวอักษร -> ส่งเข้าคิวใน `queue.js`
4. `queue.js` ดึงข้อความทีละรายการ (รักษาลำดับ) ส่งให้ `tts.js`
5. `tts.js` เรียก Azure Speech REST API แบบเดียวกับ curl ที่กำหนด, save เป็น `.mp3` ใน `tmp_audio/`
6. ไฟล์ที่ synth เสร็จ ถูกส่งต่อให้ `player.js` เข้าคิวเล่น
7. `player.js` เล่นทีละไฟล์ตามคิว เล่นจบ -> ลบไฟล์ทิ้งทันที -> เล่นไฟล์ถัดไป

## Dependencies

- `discord.js` — Discord client
- `@discordjs/voice` — เข้าห้องเสียง / เล่นเสียง
- `libsodium-wrappers` — encryption สำหรับ voice
- `ffmpeg-static` — ต้องมี ffmpeg เพื่อ decode mp3 เป็น opus stream ให้ Discord
- `prism-media` — audio transcoding pipeline ที่ @discordjs/voice ใช้ภายใน

Node.js เวอร์ชัน 20+ (ใช้ `fetch` ในตัว ไม่ต้องพึ่ง axios)
