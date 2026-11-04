const {cipher}=require('../../community/mfa');
// Test fixtures only. Enrollment and replay protection are exercised through HTTP in admin.test.js.
function staffFixture(f,username,role='admin'){
  const db=f.app.locals.db,u=db.prepare('SELECT id FROM users WHERE username=?').get(username);
  db.prepare('UPDATE users SET admin=1 WHERE id=?').run(u.id);
  db.prepare('INSERT INTO user_controls(user_id,role) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role').run(u.id,role);
  const secret=cipher(db.prepare('SELECT secret FROM security_config').get().secret).seal('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  db.prepare('INSERT OR REPLACE INTO admin_mfa VALUES(?,?,1,-1,?)').run(u.id,secret,Date.now());
  db.prepare('INSERT OR REPLACE INTO session_mfa SELECT token,? FROM sessions WHERE user_id=?').run(Date.now(),u.id);
  return u;
}
module.exports={staffFixture};
