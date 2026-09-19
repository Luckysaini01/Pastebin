# 📝 MyPastebin - Node.js & Express Code/Text Sharing

Ek simple, fast, secure aur lightweight Pastebin web application jise **Node.js** aur **Express** ke sath banaya gaya hai. Data **SQLite database** (`pastes.db`) me store hota hai aur har paste ke liye ek unique **6-character short link** generate hota hai.

---

## ✨ Features (Visheshayein)

1. **Quick Paste Creation**:
   - Fields: Title (Optional), Description (Optional), Content (Zaroori), Comment/Note (Optional).
   - Instant unique 6-character hex short link (Jaise: `http://localhost:3000/161e00`).
   - Shortcut: Textarea me `Ctrl + Enter` dabakar seedhe link generate karein.

2. **Full-Featured View Page**:
   - 📋 **Copy Content**: Ek click me content clipboard me copy ho jata hai (browser fallback ke saath).
   - ✏️ **Replace**: Content ko editable textarea me badalta hai.
   - 💾 **Save**: Password popup (`prompt()`) se verify karke content server par update karta hai.
   - ❌ **Cancel**: Edit mode se bina save kiye wapas original view par le jata hai.
   - ⬇️ **Download**: Content ko `<id>.txt` file me download karta hai.

3. **Multi-Device & Network Sharing**:
   - **Local Link**: Apne computer par (`http://localhost:3000/...`).
   - **Wi-Fi Link**: Same network ke doosre devices par (`http://192.168.x.x:3000/...`).
   - **Internet**: `npx localtunnel --port 3000` se free public HTTPS link.

4. **Security**:
   - Password-protected editing (`.env` se `EDIT_PASSWORD` set karo).
   - Galat password par `401 Unauthorized` response.
   - XSS protection (`textContent` rendering — no innerHTML).

---

## 📂 Project Structure

```
pastebin/
├── server.js             # Express backend — API routes, SQLite integration
├── package.json          # Dependencies (express, dotenv, better-sqlite3)
├── .env                  # Port & edit password (git me nahi jaata)
├── .gitignore            # node_modules, pastes.db, pastes.json, .env ignore
├── pastes.db             # SQLite database (auto-created on first run)
├── pastes.json           # Purana JSON backup (auto-migrate hota hai)
├── test-sqlite.js        # Database test script (18 tests)
├── README.md             # Yeh file
└── public/
    ├── index.html        # Paste creation form & shareable link UI
    └── view.html         # Paste viewer (Copy, Replace, Save, Download)
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
[Node.js](https://nodejs.org/) v18 ya usse upar installed hona chahiye.

### 2. Dependencies Install Karein
```bash
npm install
```

### 3. `.env` File Configure Karein
```env
PORT=3000
EDIT_PASSWORD=lucky123
```

### 4. Server Start Karein
```bash
npm start
```

First run par terminal me dikhega:
```
✅ SQLite database ready: pastes.db
===========================================
🚀 Pastebin server chal raha hai!
💻 Local URL:   http://localhost:3000
🌐 Network URL: http://192.168.x.x:3000
🗄️  Database:   SQLite (pastes.db)
🔑 Edit Password: lucky123
===========================================
```

---

## 🌐 Kaise Access Karein?

| Kahan Kholna Hai | URL | Notes |
| :--- | :--- | :--- |
| **Apne PC par** | `http://localhost:3000` | Seedhe browser me |
| **Doosre PC / Phone (Wi-Fi)** | `http://192.168.x.x:3000` | Same Wi-Fi network zaroori |
| **Internet (Global)** | `https://xyz.loca.lt` | `npx localtunnel --port 3000` se |

---

## 🗄️ Database (SQLite)

- **File**: `pastes.db` (auto-create hoti hai)
- **Library**: `better-sqlite3` (synchronous, fast, production-ready)
- **WAL Mode**: Enabled — concurrent reads ke liye fast
- **Auto-Migration**: Agar `pastes.json` exist karta ho to data SQLite me automatically migrate ho jaata hai
- **Table**: `pastes` — columns: `id`, `title`, `description`, `content`, `comment`, `createdAt`, `updatedAt`

### Database Test Karna
```bash
node test-sqlite.js
```
```
Results: 18 PASSED, 0 FAILED
SAARE TESTS PASS! SQLite database bilkul perfect chal rahi hai!
```

### Database Backup
```bash
copy pastes.db pastes_backup.db
```

---

## 🔌 API Endpoints

### `POST /api/paste` — Naya paste banayein
**Body:**
```json
{
  "title": "My Script",
  "description": "Short summary",
  "content": "console.log('Hello!');",
  "comment": "Optional note"
}
```
**Response (201):**
```json
{ "success": true, "id": "161e00", "networkIp": "192.168.x.x", "port": 3000 }
```

### `GET /api/paste/:id` — Paste fetch karein
**Response (200):**
```json
{
  "id": "161e00", "title": "My Script",
  "content": "console.log('Hello!');",
  "createdAt": "2026-09-18T18:50:00.000Z",
  "updatedAt": "2026-09-18T18:50:00.000Z"
}
```

### `PUT /api/paste/:id` — Content update karein (password required)
**Body:**
```json
{ "content": "Updated content", "password": "lucky123" }
```
- Sahi password → `200 OK`
- Galat password → `401 { "error": "Galat password" }`

### `GET /:id` — Short URL se view kholein
- `http://localhost:3000/161e00` → `public/view.html` serve karta hai

### `GET /api/server-info` — Network info
```json
{ "networkIp": "192.168.x.x", "port": 3000 }
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js, Express.js |
| **Database** | SQLite (`better-sqlite3`) |
| **Environment** | dotenv |
| **ID Generation** | `crypto.randomBytes(3).toString('hex')` |
| **Frontend** | HTML5, Vanilla JavaScript, CSS |
| **Fonts** | Google Fonts — Inter, JetBrains Mono |

---

## 🚀 EADDRINUSE Error (Port Already in Use)
Agar server start karte waqt error aaye:
```bash
Stop-Process -Name node -Force
npm start
```
