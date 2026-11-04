function initAdminStore(db){
  db.exec("BEGIN IMMEDIATE");
  try{
  const first=!db.prepare("SELECT name FROM sqlite_master WHERE name='user_controls'").get();
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_controls(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','moderator','admin','owner')),suspended INTEGER NOT NULL DEFAULT 0,publish_until INTEGER NOT NULL DEFAULT 0,last_seen INTEGER) STRICT;
    CREATE TABLE IF NOT EXISTS admin_audit(id INTEGER PRIMARY KEY,actor_id TEXT,actor_name TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,reason TEXT NOT NULL,result TEXT NOT NULL,created INTEGER NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS audit_target ON admin_audit(target,id DESC);
    CREATE TABLE IF NOT EXISTS moderation(id INTEGER PRIMARY KEY,creation_id TEXT REFERENCES creations(id) ON DELETE SET NULL,owner TEXT REFERENCES users(id) ON DELETE SET NULL,actor TEXT,decision TEXT NOT NULL,reason TEXT NOT NULL,created INTEGER NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS moderation_owner ON moderation(owner,id DESC);
    CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,creation_id TEXT REFERENCES creations(id) ON DELETE CASCADE,reporter TEXT REFERENCES users(id) ON DELETE SET NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created INTEGER NOT NULL) STRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS report_open ON reports(creation_id,reporter) WHERE status='pending';
    CREATE INDEX IF NOT EXISTS reports_queue ON reports(status,id);
    CREATE TABLE IF NOT EXISTS notices(id INTEGER PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,message TEXT NOT NULL,created INTEGER NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS notices_user ON notices(user_id,id DESC);
    CREATE TABLE IF NOT EXISTS recovery_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,proof_hash TEXT NOT NULL,token_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reason TEXT NOT NULL DEFAULT '',expires INTEGER NOT NULL,created INTEGER NOT NULL) STRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS recovery_open ON recovery_requests(user_id) WHERE status IN ('pending','approved');
    CREATE TABLE IF NOT EXISTS community_settings(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1) STRICT;
    CREATE TABLE IF NOT EXISTS daily_activity(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day TEXT NOT NULL,PRIMARY KEY(day,user_id)) STRICT;
    CREATE TABLE IF NOT EXISTS preset_usage(creation_id TEXT NOT NULL REFERENCES creations(id) ON DELETE CASCADE,day TEXT NOT NULL,uses INTEGER NOT NULL,PRIMARY KEY(day,creation_id)) STRICT;
    CREATE TABLE IF NOT EXISTS admin_mfa(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,secret TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,last_step INTEGER NOT NULL DEFAULT -1,created INTEGER NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS mfa_backup(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,hash TEXT PRIMARY KEY) STRICT;
    CREATE TABLE IF NOT EXISTS session_mfa(token TEXT PRIMARY KEY REFERENCES sessions(token) ON DELETE CASCADE,verified INTEGER NOT NULL) STRICT;
    CREATE INDEX IF NOT EXISTS users_created ON users(created,id);
    CREATE INDEX IF NOT EXISTS creations_owner ON creations(owner,created);
    CREATE INDEX IF NOT EXISTS feedback_status ON feedback(status,created);
    CREATE INDEX IF NOT EXISTS recovery_queue ON recovery_requests(created,id);
  `);
  if(first){
    db.exec("INSERT INTO user_controls(user_id,role) SELECT id,'admin' FROM users WHERE admin=1");
    db.exec("UPDATE user_controls SET role='owner' WHERE user_id=(SELECT id FROM users WHERE admin=1 AND active=1 ORDER BY created,id LIMIT 1)");
  }
  db.exec("COMMIT");
  }catch(error){db.exec("ROLLBACK");throw error;}
}
module.exports={initAdminStore};
