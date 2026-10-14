const { getDb, getUserByEmail } = require('./server/db');
async function run() {
  const db = await getDb();
  const rows = await db.execute("SELECT * FROM users WHERE email = 'kumararpit9468@gmail.com' OR role = 'admin'");
  console.log(JSON.stringify(rows[0] || rows, null, 2));
}
run();
