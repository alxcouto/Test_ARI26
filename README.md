# LiveSpeech MLX TX — Embedded Web Client (`EnbededLiveSpeechMLX_TX_WebClient`)

The **Embedded Web Client** is a lightweight, low-configuration web application designed for embedding live streams with real-time AI synchronized subtitles directly into external web pages (WordPress, event websites, custom landing pages).

---

## 📁 Directory Structure

```
EnbededLiveSpeechMLX_TX_WebClient/
├── README.md                 # Integration & embed guide
├── config.json               # Central Supabase credentials & session_id mapping
├── embed.js                  # Helper script for container div auto-embedding
└── Client/
    ├── index.html            # Embedded HTML layout
    ├── style.css             # Dark & Light theme styles (vertical responsive layout)
    └── script.js             # YouTube player, Supabase Realtime, TTS & sync engine
```

---

## ⚙️ 1. Configuration (`config.json`)

Fill `config.json` located at the web client server root with your Supabase credentials and a mapping of session keys to raw YouTube Broadcast IDs:

```json
[
  {
    "supabase": {
      "project_url": "https://your-supabase-project.supabase.co",
      "anon_key": "YOUR_SUPABASE_ANON_KEY"
    },
    "broadcast_id": {
      "session_1": "RAW_YOUTUBE_ID_1",
      "session_satellite_1_topcon": "RAW_YOUTUBE_ID_2",
      "session_2": "RAW_YOUTUBE_ID_3",
      "session_satellite_2_isr": "RAW_YOUTUBE_ID_4"
    }
  }
]
```

---

## 🚀 2. Embedding Instructions

You can embed the web client on any web page using either **Mode A (Direct iFrame)** or **Mode B (HTML Container + `embed.js`)**.

### Mode A: Standard `<iframe>` Embed
Paste the following HTML `<iframe>` snippet into your WordPress custom HTML block or page editor:

```html
<iframe 
  src="https://your-domain.com/Client/index.html?session=session_1&theme=dark" 
  width="100%" 
  height="650px" 
  frameborder="0" 
  allow="autoplay; encrypted-media; fullscreen" 
  allowfullscreen>
</iframe>
```

### Mode B: HTML Container + `embed.js` (Clean Multi-Session Embed)
If your page embeds multiple live sessions (e.g. Session 1, Satellite 1, Session 2), place `<div>` containers wherever you want players to appear and include `embed.js` once:

```html
<!-- Main Hall -->
<div class="livespeech-embed" data-broadcast-id="session_1" data-theme="dark"></div>

<!-- Satellite Hall Topcon -->
<div class="livespeech-embed" data-broadcast-id="session_satellite_1_topcon" data-theme="light"></div>

<!-- Include helper script once at the end of the body -->
<script src="https://your-domain.com/embed.js" async></script>
```

---

## 🎨 3. URL Query Parameters & Theme Options

| Parameter | Values | Description |
| :--- | :--- | :--- |
| `session` / `broadcast_id` | `session_1`, `dQw4w9WgXcQ` | Session key mapped in `config.json`, or raw YouTube Broadcast ID |
| `theme` | `dark` (default), `light` | Enforces strict dark mode or light mode appearance |

---

## 🌟 Key Features

* **Zero-Setup for Web Viewers**: No configuration drawer or login required.
* **YouTube Player Autoplay**: Starts playing automatically when stream is ready.
* **Emoji Flags**: Standard emoji flag dropdown (🇬🇧 for English, 🇪🇸 for Spanish).
* **Live Status**: `Original` / `Translated` badges with `Waiting ...` idle indicator.
* **Speech Synthesis (TTS)**: `READ: ON` reads captions aloud while automatically muting YouTube video audio.
* **Clean 2-Line Uppercase Subtitles**: Centered uppercase caption box (min 30px font size) without internal flag badges.
