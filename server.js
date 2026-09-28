// Zaroori modules import kar rahe hain
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const os = require('os');
const fs = require('fs');

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
// JSON DATABASE (portable + serverless friendly)
// ==========================================

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'pastes.json');

function ensureDataStore() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, '{}', 'utf8');
    }
}

function readStore() {
    ensureDataStore();
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return raw.trim() ? JSON.parse(raw) : {};
    } catch (error) {
        console.error('Database read error:', error.message);
        return {};
    }
}

function writeStore(store) {
    ensureDataStore();
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function getPasteById(id) {
    return readStore()[id] || null;
}

function savePaste(paste) {
    const store = readStore();
    store[paste.id] = paste;
    writeStore(store);
    return paste;
}

function updatePaste(id, updates) {
    const store = readStore();
    if (!store[id]) return null;
    const updated = { ...store[id], ...updates };
    store[id] = updated;
    writeStore(store);
    return updated;
}

console.log(`✅ JSON database ready: ${DATA_FILE}`);

const legacyFile = path.join(__dirname, 'pastes.json');
if (fs.existsSync(legacyFile)) {
    try {
        const legacyData = JSON.parse(fs.readFileSync(legacyFile, 'utf-8'));
        const ids = Object.keys(legacyData);
        if (ids.length > 0) {
            const store = readStore();
            if (Object.keys(store).length === 0) {
                for (const id of ids) {
                    store[id] = legacyData[id];
                }
                writeStore(store);
                console.log(`✅ ${ids.length} pastes migrated from legacy JSON`);
            }
        }
    } catch (error) {
        console.error('Migration error (safe to ignore on first run):', error.message);
    }
}

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

    const paste = {
        id,
        title: (title || '').trim(),
        description: (description || '').trim(),
        content,
        comment: (comment || '').trim(),
        createdAt: now,
        updatedAt: now
    };

    try {
        savePaste(paste);
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

    const paste = getPasteById(id);
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
    const existing = getPasteById(id);
    if (!existing) {
        return res.status(404).json({ error: 'Paste nahi mila.' });
    }

    const updatedAt = new Date().toISOString();

    try {
        const updated = updatePaste(id, { content, updatedAt });
        if (!updated) {
            return res.status(404).json({ error: 'Paste nahi mila.' });
        }
        return res.json({
            success: true,
            message: 'Content safaltapoorvak update ho gaya!',
            updatedAt
        });
    } catch (err) {
        console.error('Database update error:', err);
        return res.status(500).json({ error: 'Paste update nahi ho saka.' });
    }
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
if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => {
        const networkIp = getNetworkIp();
        console.log(`===========================================`);
        console.log(`🚀 Pastebin server chal raha hai!`);
        console.log(`💻 Local URL:   http://localhost:${PORT}`);
        console.log(`🌐 Network URL: http://${networkIp}:${PORT}`);
        console.log(`🗄️  Database:   JSON file (${DATA_FILE})`);
        console.log(`🔑 Edit Password: ${EDIT_PASSWORD}`);
        console.log(`===========================================`);
    });
}

// Process band hone par database connection gracefully close karna
if (require.main === module) {
    process.on('SIGINT', () => {
        console.log('\n📴 Server stop.');
        process.exit(0);
    });
}

module.exports = app;
