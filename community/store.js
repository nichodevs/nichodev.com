const {DatabaseSync,backup}=require("node:sqlite");
const fs=require("node:fs");
const path=require("node:path");

function openStore(filename){
  if(filename!==":memory:")fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
  // shortcut: one SQLite instance; move storage and limits before scaling to multiple replicas.
  const db=new DatabaseSync(filename,{timeout:5000});
  db.exec("PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;");
  db.exec("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password TEXT NOT NULL,recovery TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 0,admin INTEGER NOT NULL DEFAULT 0,confirmation TEXT,confirmation_expiry INTEGER,created INTEGER NOT NULL) STRICT;\nCREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL) STRICT;\nCREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,tool TEXT NOT NULL,experience TEXT NOT NULL,comment TEXT NOT NULL,contact TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'recebido',created INTEGER NOT NULL) STRICT;\nCREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,audio BLOB NOT NULL,created INTEGER NOT NULL) STRICT;\nCREATE TABLE IF NOT EXISTS creations(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,kind TEXT NOT NULL,tool TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,visibility TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',preset TEXT,media_id TEXT REFERENCES media(id),share_hash TEXT,version INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL) STRICT;\nCREATE TABLE IF NOT EXISTS favorites(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,creation_id TEXT NOT NULL REFERENCES creations(id) ON DELETE CASCADE,PRIMARY KEY(user_id,creation_id)) STRICT;\nCREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL) STRICT;\nCREATE INDEX IF NOT EXISTS creations_listing ON creations(visibility,status,created);CREATE INDEX IF NOT EXISTS media_owner ON media(owner);CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);");
  if(filename!==":memory:")fs.chmodSync(filename,0o600);
  return db;
}
function transaction(db,action){
  db.exec("BEGIN IMMEDIATE");
  try{const value=action();db.exec("COMMIT");return value;}catch(error){db.exec("ROLLBACK");throw error;}
}
module.exports={openStore,transaction,backup};
