// Zaroori modules import kar rahe hain
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const os = require('os');
const fs = require('fs');

// SQLite database module (better-sqlite3: synchronous, fast aur reliable)
const Database = require('better-sqlite3');

// .env file se environment variables load karna
dotenv.config({ path: path.join(__dirname, '.env') });

// Express app initialize kar rahe hain
const app = express();

// CORS Headers enable kar rahe hain
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Port set kar rahe hain (.env se ya default 3000)
const PORT = process.env.PORT || 3000;

// Edit password load kar rahe hain .env file se
const EDIT_PASSWORD = process.env.EDIT_PASSWORD || 'lucky123';

// Network IP pata karne ka helper function
function getNetworkIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// ==========================================
// SQLITE DATABASE SETUP
// ==========================================

// SQLite database file ka path (pastes.db)
const DB_FILE = path.join(__dirname, 'pastes.db');

// Database connection open kar rahe hain
const db = new Database(DB_FILE);

// Performance ke liye WAL mode enable karna
db.pragma('journal_mode = WAL');

// Pastes table create karna (agar pehle se exist na kare)
db.exec(`
    CREATE TABLE IF NOT EXISTS pastes (
        id TEXT PRIMARY KEY,
        title TEXT DEFAULT '',
        description TEXT DEFAULT '',
        content TEXT NOT NULL,
        comment TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    )
`);

console.log('✅ SQLite database ready: pastes.db');

// ==========================================
// PASTES.JSON SE DATA MIGRATE KARNA (Ek baar)
// ==========================================

const PASTES_JSON = path.join(__dirname, 'pastes.json');
if (fs.existsSync(PASTES_JSON)) {
    try {
        const oldData = JSON.parse(fs.readFileSync(PASTES_JSON, 'utf-8'));
        const ids = Object.keys(oldData);
        if (ids.length > 0) {
            // Pehle check karo database already populated hai ya nahi
            const count = db.prepare('SELECT COUNT(*) as cnt FROM pastes').get();
            if (count.cnt === 0) {
                // Ek batch transaction me saara data insert karo
                const insertStmt = db.prepare(`
                    INSERT OR IGNORE INTO pastes (id, title, description, content, comment, createdAt, updatedAt)
                    VALUES (@id, @title, @description, @content, @comment, @createdAt, @updatedAt)
                `);
                const migrate = db.transaction((pastes) => {
                    for (const paste of pastes) {
                        insertStmt.run(paste);
                    }
                });
                migrate(ids.map(id => oldData[id]));
                console.log(`✅ ${ids.length} pastes pastes.json se SQLite me migrate ho gaye!`);
            }
        }
    } catch (err) {
        console.error('Migration error (ignore karo agar pehli baar chal raha hai):', err.message);
    }
}

// ==========================================
// PREPARED STATEMENTS (Fast Queries)
// ==========================================

// Ek paste fetch karne ka statement
const stmtGetById = db.prepare('SELECT * FROM pastes WHERE id = ?');

// Naya paste insert karne ka statement
const stmtInsert = db.prepare(`
    INSERT INTO pastes (id, title, description, content, comment, createdAt, updatedAt)
    VALUES (@id, @title, @description, @content, @comment, @createdAt, @updatedAt)
`);

// Content update karne ka statement
const stmtUpdate = db.prepare(`
    UPDATE pastes SET content = @content, updatedAt = @updatedAt WHERE id = @id
`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// API ROUTES
// ==========================================

/**
 * Route: POST /api/paste
 * Kaam: Naya paste create karna aur SQLite me save karna
 */
app.post('/api/paste', (req, res) => {
    const { title, description, content, comment } = req.body;

    // Content check kar rahe hain (content mandatory hai)
    if (!content || typeof content !== 'string' || content.trim() === '') {
        return res.status(400).json({ error: 'Content likhna zaroori hai!' });
    }

    // 6-character ka unique hex ID generate kar rahe hain
    const id = crypto.randomBytes(3).toString('hex');
    const now = new Date().toISOString();

    try {
        // SQLite me naya paste insert karo
        stmtInsert.run({
            id,
            title: (title || '').trim(),
            description: (description || '').trim(),
            content,
            comment: (comment || '').trim(),
            createdAt: now,
            updatedAt: now
        });
    } catch (err) {
        console.error('Database insert error:', err);
        return res.status(500).json({ error: 'Paste save nahi ho saka.' });
    }

    res.status(201).json({
        success: true,
        id,
        networkIp: getNetworkIp(),
        port: PORT,
        message: 'Paste safaltapoorvak ban gaya!'
    });
});

/**
 * Route: GET /api/paste/:id
 * Kaam: SQLite se paste ka data fetch karna
 */
app.get('/api/paste/:id', (req, res) => {
    const { id } = req.params;

    const paste = stmtGetById.get(id);
    if (!paste) {
        return res.status(404).json({ error: 'Yeh paste nahi mila ya delete ho chuka hai.' });
    }

    res.json(paste);
});

/**
 * Route: PUT /api/paste/:id
 * Kaam: Password verify karke content update karna
 */
app.put('/api/paste/:id', (req, res) => {
    const { id } = req.params;
    const { content, password } = req.body;

    // Password verify kar rahe hain
    if (!password || password !== EDIT_PASSWORD) {
        return res.status(401).json({ error: 'Galat password' });
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
        return res.status(400).json({ error: 'Content khali nahi ho sakta!' });
    }

    // Pehle check karo paste exist karta hai
    const existing = stmtGetById.get(id);
    if (!existing) {
        return res.status(404).json({ error: 'Paste nahi mila.' });
    }

    const updatedAt = new Date().toISOString();

    try {
        stmtUpdate.run({ content, updatedAt, id });
    } catch (err) {
        console.error('Database update error:', err);
        return res.status(500).json({ error: 'Paste update nahi ho saka.' });
    }

    res.json({
        success: true,
        message: 'Content safaltapoorvak update ho gaya!',
        updatedAt
    });
});

/**
 * Route: GET /api/server-info
 * Kaam: Network info return karna
 */
app.get('/api/server-info', (req, res) => {
    res.json({ networkIp: getNetworkIp(), port: PORT });
});

/**
 * Route: GET /:id
 * Kaam: Short URL par view.html serve karna
 */
app.get('/:id', (req, res, next) => {
    const { id } = req.params;
    if (id === 'api' || id.includes('.')) return next();
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

// Server start karna (0.0.0.0 = sabhi network interfaces)
app.listen(PORT, '0.0.0.0', () => {
    const networkIp = getNetworkIp();
    console.log(`===========================================`);
    console.log(`🚀 Pastebin server chal raha hai!`);
    console.log(`💻 Local URL:   http://localhost:${PORT}`);
    console.log(`🌐 Network URL: http://${networkIp}:${PORT}`);
    console.log(`🗄️  Database:   SQLite (pastes.db)`);
    console.log(`🔑 Edit Password: ${EDIT_PASSWORD}`);
    console.log(`===========================================`);
});

// Process band hone par database connection gracefully close karna
process.on('SIGINT', () => {
    db.close();
    console.log('\n📴 Database connection band ho gaya. Server stop.');
    process.exit(0);
});
