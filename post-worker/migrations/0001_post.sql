CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,handle TEXT UNIQUE NOT NULL,name TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,timezone TEXT NOT NULL,daily_limit INTEGER NOT NULL DEFAULT 3,min_hours INTEGER NOT NULL DEFAULT 24,accept_mail INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS letters(id TEXT PRIMARY KEY,sender TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,snapshot TEXT NOT NULL,created_at INTEGER NOT NULL,deliver_at INTEGER NOT NULL,opened_at INTEGER,sender_day TEXT NOT NULL,nonce TEXT NOT NULL,fingerprint TEXT NOT NULL,UNIQUE(sender,nonce));
    CREATE INDEX IF NOT EXISTS letters_inbox ON letters(recipient,deliver_at);
    CREATE INDEX IF NOT EXISTS letters_quota ON letters(sender,sender_day);
    CREATE TABLE IF NOT EXISTS blocks(owner TEXT NOT NULL REFERENCES users(id),blocked TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(owner,blocked));
    CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,resets_at INTEGER NOT NULL);
