const db = require('./database/db');
async function test() {
    try {
        const res = await db.prepare('SELECT * FROM leads WHERE id = ?').get('1');
        console.log(res);
    } catch (e) {
        console.error(e);
    }
}
test();
