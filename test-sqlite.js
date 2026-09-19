const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, 'pastes.db');
let passed = 0, failed = 0;

function assert(cond, name) {
    if (cond) { console.log('   PASS: ' + name); passed++; }
    else { console.log('   FAIL: ' + name); failed++; }
}

console.log('\n==============================================');
console.log('SQLite Database Direct Test Suite');
console.log('==============================================');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

// Test 1: Table structure
console.log('\n1. Table structure check...');
const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pastes'").get();
assert(tbl && tbl.name === 'pastes', 'pastes table exist karti hai');
const cols = db.prepare('PRAGMA table_info(pastes)').all().map(c => c.name);
['id','title','description','content','comment','createdAt','updatedAt'].forEach(c => {
    assert(cols.includes(c), c + ' column exists');
});

// Test 2: Migrated data
console.log('\n2. Migrated pastes check...');
const all = db.prepare('SELECT id, title FROM pastes').all();
assert(all.length > 0, 'Database me pastes hain (total: ' + all.length + ')');
all.forEach(p => console.log('   - ID: ' + p.id + ' | Title: "' + (p.title || 'no title') + '"'));

// Test 3: INSERT
console.log('\n3. INSERT test...');
const tid = crypto.randomBytes(3).toString('hex');
const now = new Date().toISOString();
db.prepare('INSERT INTO pastes (id,title,description,content,comment,createdAt,updatedAt) VALUES (@id,@title,@description,@content,@comment,@createdAt,@updatedAt)')
  .run({id:tid, title:'Test Title', description:'Desc', content:'Test Content', comment:'Note', createdAt:now, updatedAt:now});
const ins = db.prepare('SELECT * FROM pastes WHERE id=?').get(tid);
assert(ins && ins.id === tid, 'ID sahi save hui: ' + tid);
assert(ins && ins.content === 'Test Content', 'Content sahi save hua');
assert(ins && ins.title === 'Test Title', 'Title sahi save hui');

// Test 4: UPDATE
console.log('\n4. UPDATE test...');
db.prepare('UPDATE pastes SET content=@content, updatedAt=@updatedAt WHERE id=@id')
  .run({content:'Updated!', updatedAt:now, id:tid});
const upd = db.prepare('SELECT * FROM pastes WHERE id=?').get(tid);
assert(upd && upd.content === 'Updated!', 'Content sahi update hua');

// Test 5: Non-existent ID
console.log('\n5. Non-existent ID test...');
const ghost = db.prepare('SELECT * FROM pastes WHERE id=?').get('zzzzzz');
assert(ghost === undefined, 'Galat ID par undefined milta hai (correct 404 behavior)');

// Test 6: WAL Mode
console.log('\n6. WAL mode check...');
const wal = db.pragma('journal_mode');
assert(wal[0].journal_mode === 'wal', 'WAL mode enabled hai (fast concurrent access)');

// Test 7: Large content (bada C code)
console.log('\n7. Large content test...');
const lid = crypto.randomBytes(3).toString('hex');
const bigContent = '#include <stdio.h>\n'.repeat(500); // ~9000 characters
db.prepare('INSERT INTO pastes (id,title,description,content,comment,createdAt,updatedAt) VALUES (@id,@title,@description,@content,@comment,@createdAt,@updatedAt)')
  .run({id:lid, title:'Big Paste', description:'', content:bigContent, comment:'', createdAt:now, updatedAt:now});
const bigRow = db.prepare('SELECT * FROM pastes WHERE id=?').get(lid);
assert(bigRow && bigRow.content.length === bigContent.length, 'Large content sahi save hua (' + bigContent.length + ' chars)');

// Test 8: Transaction test
console.log('\n8. Transaction test...');
const t1 = crypto.randomBytes(3).toString('hex');
const t2 = crypto.randomBytes(3).toString('hex');
const insertMany = db.transaction((items) => {
    const stmt = db.prepare('INSERT INTO pastes (id,title,description,content,comment,createdAt,updatedAt) VALUES (@id,@title,@description,@content,@comment,@createdAt,@updatedAt)');
    for (const item of items) stmt.run(item);
});
insertMany([
    {id:t1, title:'Tx1', description:'', content:'Content1', comment:'', createdAt:now, updatedAt:now},
    {id:t2, title:'Tx2', description:'', content:'Content2', comment:'', createdAt:now, updatedAt:now}
]);
const txRows = db.prepare('SELECT COUNT(*) as c FROM pastes WHERE id IN (?,?)').get(t1, t2);
assert(txRows.c === 2, 'Transaction se 2 rows ek saath insert huin');

// Test 9: Cleanup
console.log('\n9. Cleanup (test data remove karna)...');
db.prepare('DELETE FROM pastes WHERE id IN (?,?,?,?)').run(tid, lid, t1, t2);
const rem = db.prepare('SELECT COUNT(*) as c FROM pastes WHERE id IN (?,?,?,?)').get(tid, lid, t1, t2);
assert(rem.c === 0, 'Test data cleanup ho gaya');

// Final count
const finalCount = db.prepare('SELECT COUNT(*) as c FROM pastes').get();
console.log('\n   Total pastes remaining in DB: ' + finalCount.c);

db.close();
console.log('\n==============================================');
console.log('Results: ' + passed + ' PASSED, ' + failed + ' FAILED');
if (failed === 0) {
    console.log('SAARE TESTS PASS! SQLite database bilkul perfect chal rahi hai!');
} else {
    console.log('Kuch tests fail hue. Check karein.');
}
console.log('==============================================\n');
