const { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } = require("node:crypto");

const memory = globalThis.__APEXLINE_SOCIAL_MEMORY__ || {
  users: new Map(),
  tokenHashes: new Map(),
  codeToUser: new Map(),
  friendships: new Map(),
  rooms: new Map(),
  roomCodes: new Map(),
  messages: new Map(),
};
globalThis.__APEXLINE_SOCIAL_MEMORY__ = memory;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(body));
}

const MAX_BODY_BYTES = 16 * 1024;

class BodyTooLargeError extends Error {}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let text = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new BodyTooLargeError("Request body too large"));
        req.destroy();
        return;
      }
      text += chunk;
    });
    req.on("error", reject);
    req.on("end", () => {
      try { resolve(text ? JSON.parse(text) : {}); }
      catch { resolve({}); }
    });
  });
}

// Only a UNIQUE collision on a random code is worth retrying with a new code;
// any other failure (DB down, bad SQL) must surface instead of faking success.
function isUniqueViolation(error) {
  return error?.code === "23505";
}

function clean(value, limit = 120) {
  return String(value || "").trim().replace(/[\u0000-\u001f]+/g, " ").slice(0, limit);
}

function friendCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

async function sql() {
  if (!process.env.POSTGRES_URL && !process.env.POSTGRES_PRISMA_URL && !process.env.DATABASE_URL) return null;
  try {
    return require("@vercel/postgres").sql;
  } catch {
    return null;
  }
}

let schemaReady = null;

function ensureSchema(db) {
  if (!db) return Promise.resolve();
  schemaReady = schemaReady || (async () => {
    await db`CREATE TABLE IF NOT EXISTS apexline_users (id TEXT PRIMARY KEY, friend_code TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, created_at BIGINT NOT NULL)`;
    await db`ALTER TABLE apexline_users ADD COLUMN IF NOT EXISTS token_hash TEXT`;
    await db`CREATE TABLE IF NOT EXISTS apexline_friendships (a TEXT NOT NULL, b TEXT NOT NULL, status TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (a, b))`;
    await db`CREATE TABLE IF NOT EXISTS apexline_rooms (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, host_id TEXT NOT NULL, label TEXT NOT NULL, content_fingerprint TEXT NOT NULL, created_at BIGINT NOT NULL)`;
    await db`CREATE TABLE IF NOT EXISTS apexline_chat_messages (room_id TEXT NOT NULL, id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, sent_at BIGINT NOT NULL, PRIMARY KEY (room_id, id))`;
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

class AuthError extends Error {}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(token, storedHash) {
  if (!token || !storedHash) return false;
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function storedUser(db, userId) {
  if (!userId) return null;
  if (db) {
    const result = await db`SELECT id, friend_code, token_hash FROM apexline_users WHERE id = ${userId}`;
    const row = result.rows[0];
    return row ? { friendCode: row.friend_code, tokenHash: row.token_hash || "" } : null;
  }
  const user = memory.users.get(userId);
  return user ? { friendCode: user.friendCode, tokenHash: memory.tokenHashes.get(userId) || "" } : null;
}

// Every action except bootstrap must prove it owns userId with the secret
// token issued at bootstrap. User ids are visible to other users (chat,
// presence), so they are never enough on their own.
async function authenticate(body) {
  const userId = clean(body.userId, 80);
  const db = await sql();
  await ensureSchema(db);
  const user = await storedUser(db, userId);
  if (!user || !tokenMatches(clean(body.userToken, 200), user.tokenHash)) throw new AuthError("Unauthorized");
  return userId;
}

async function bootstrap(body) {
  const db = await sql();
  await ensureSchema(db);
  const displayName = clean(body.profile?.name || body.displayName || "Apexline fan", 80) || "Apexline fan";
  const presentedToken = clean(body.userToken, 200);
  let userId = clean(body.userId || body.localUserId, 80);
  let existing = await storedUser(db, userId);
  // An account that already has a token can only be resumed with that token.
  // Legacy accounts without one are claimed by the first client to bootstrap.
  if (existing?.tokenHash && !tokenMatches(presentedToken, existing.tokenHash)) existing = null;
  if (!existing) userId = randomUUID();
  const userToken = existing?.tokenHash ? presentedToken : randomBytes(32).toString("base64url");
  const tokenHash = hashToken(userToken);
  let code = existing?.friendCode || friendCode();
  if (db) {
    for (let i = 0; i < 4; i += 1) {
      try {
        await db`INSERT INTO apexline_users (id, friend_code, display_name, created_at, token_hash) VALUES (${userId}, ${code}, ${displayName}, ${Date.now()}, ${tokenHash}) ON CONFLICT (id) DO UPDATE SET display_name = ${displayName}, token_hash = ${tokenHash}`;
        break;
      } catch (error) {
        if (!isUniqueViolation(error) || i === 3) throw error;
        code = friendCode();
      }
    }
  }
  memory.users.set(userId, { userId, friendCode: code, displayName });
  memory.tokenHashes.set(userId, tokenHash);
  memory.codeToUser.set(code, userId);
  return { userId, userToken, friendCode: code, displayName };
}

async function roomExists(db, roomId) {
  if (!roomId) return false;
  if (db) {
    const result = await db`SELECT 1 FROM apexline_rooms WHERE id = ${roomId}`;
    return result.rows.length > 0;
  }
  return memory.rooms.has(roomId);
}

function friendshipKey(a, b) {
  return [a, b].sort().join(":");
}

async function friends(body) {
  const userId = await authenticate(body);
  const db = await sql();
  if (db) {
    const result = await db`
      SELECT f.a, f.b, f.status, f.created_at, u.id AS friend_id, u.friend_code, u.display_name
      FROM apexline_friendships f
      JOIN apexline_users u ON u.id = CASE WHEN f.a = ${userId} THEN f.b ELSE f.a END
      WHERE f.a = ${userId} OR f.b = ${userId}
      ORDER BY f.created_at DESC
    `;
    return {
      friends: result.rows.map((row) => ({
        a: row.a,
        b: row.b,
        status: row.status,
        createdAt: Number(row.created_at) || Date.now(),
        friend: {
          userId: row.friend_id,
          friendCode: row.friend_code,
          displayName: row.display_name || "Apexline fan",
        },
      })),
    };
  }
  const rows = [];
  for (const [key, value] of memory.friendships) {
    if (!key.split(":").includes(userId)) continue;
    const otherId = value.a === userId ? value.b : value.a;
    rows.push({ ...value, friend: memory.users.get(otherId) || { userId: otherId, displayName: "Apexline fan" } });
  }
  return { friends: rows };
}

async function addFriend(body) {
  const userId = await authenticate(body);
  const code = clean(body.friendCode, 16).toUpperCase();
  const db = await sql();
  let targetId = "";
  if (db) {
    const target = await db`SELECT id, friend_code, display_name FROM apexline_users WHERE friend_code = ${code}`;
    targetId = clean(target.rows[0]?.id, 80);
  } else {
    targetId = memory.codeToUser.get(code);
  }
  if (!userId || !targetId || userId === targetId) return { ok: false, message: "Friend code not found." };
  const [a, b] = [userId, targetId].sort();
  const value = { a, b, status: "accepted", createdAt: Date.now() };
  if (db) {
    await db`
      INSERT INTO apexline_friendships (a, b, status, created_at)
      VALUES (${a}, ${b}, ${value.status}, ${value.createdAt})
      ON CONFLICT (a, b) DO UPDATE SET status = ${value.status}, created_at = ${value.createdAt}
    `;
  }
  memory.friendships.set(friendshipKey(a, b), value);
  return { ok: true, friendship: value };
}

async function roomCreate(body) {
  const room = {
    id: randomUUID(),
    code: friendCode(),
    hostId: await authenticate(body),
    label: clean(body.label || "Watch party", 80),
    contentFingerprint: clean(body.contentFingerprint || "", 220),
    createdAt: Date.now(),
  };
  const db = await sql();
  if (db) {
    // Retry on the rare room-code collision (code is UNIQUE).
    for (let i = 0; i < 4; i += 1) {
      try {
        await db`INSERT INTO apexline_rooms (id, code, host_id, label, content_fingerprint, created_at) VALUES (${room.id}, ${room.code}, ${room.hostId}, ${room.label}, ${room.contentFingerprint}, ${room.createdAt})`;
        break;
      } catch (error) {
        if (!isUniqueViolation(error) || i === 3) throw error;
        room.code = friendCode();
      }
    }
  }
  memory.rooms.set(room.id, room);
  memory.roomCodes.set(room.code, room.id);
  return room;
}

function roomRow(row) {
  return {
    id: row.id,
    code: row.code,
    hostId: row.host_id,
    label: row.label,
    contentFingerprint: row.content_fingerprint,
    createdAt: Number(row.created_at) || Date.now(),
  };
}

async function roomJoin(body) {
  await authenticate(body);
  const code = clean(body.code, 16).toUpperCase();
  const db = await sql();
  if (db) {
    const result = await db`SELECT id, code, host_id, label, content_fingerprint, created_at FROM apexline_rooms WHERE code = ${code}`;
    if (result.rows[0]) return roomRow(result.rows[0]);
  }
  const roomId = memory.roomCodes.get(code);
  if (!roomId) return { ok: false, message: "Room code not found." };
  return memory.rooms.get(roomId);
}

async function chatHistory(body) {
  await authenticate(body);
  const roomId = clean(body.roomId, 80);
  const db = await sql();
  if (!(await roomExists(db, roomId))) return { messages: [] };
  if (db) {
    const result = await db`SELECT id, user_id, name, text, sent_at FROM apexline_chat_messages WHERE room_id = ${roomId} ORDER BY sent_at DESC LIMIT 80`;
    const messages = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name || "Apexline fan",
      text: row.text,
      sentAt: Number(row.sent_at) || Date.now(),
    })).reverse();
    return { messages };
  }
  return { messages: (memory.messages.get(roomId) || []).slice(-80) };
}

async function saveChat(body) {
  const roomId = clean(body.roomId, 80);
  const message = {
    id: clean(body.id || randomUUID(), 120),
    userId: await authenticate(body),
    name: clean(body.name || "Apexline fan", 80),
    text: clean(body.text, 500),
    sentAt: Number(body.sentAt) || Date.now(),
  };
  if (!message.text) return { ok: false };
  const db = await sql();
  if (!(await roomExists(db, roomId))) return { ok: false, message: "Room not found." };
  if (db) {
    await db`INSERT INTO apexline_chat_messages (room_id, id, user_id, name, text, sent_at) VALUES (${roomId}, ${message.id}, ${message.userId}, ${message.name}, ${message.text}, ${message.sentAt}) ON CONFLICT (room_id, id) DO NOTHING`;
  }
  const rows = memory.messages.get(roomId) || [];
  rows.push(message);
  memory.messages.set(roomId, rows.slice(-120));
  return { ok: true, message };
}

async function ablyToken(body) {
  const clientId = await authenticate(body);
  const key = clean(process.env.ABLY_API_KEY, 400);
  if (!key || !key.includes(":")) return { ok: false, message: "ABLY_API_KEY is not configured." };
  const [keyName, secret] = key.split(":");
  const roomId = clean(body.roomId, 120);
  if (!(await roomExists(await sql(), roomId))) return { ok: false, message: "Room not found." };
  const ttl = 1000 * 60 * 60 * 4;
  const capability = JSON.stringify({ [`watch:${roomId}`]: ["publish", "subscribe", "presence"] });
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString("hex");
  const signText = [keyName, ttl, capability, clientId, timestamp, nonce, ""].join("\n");
  const mac = createHmac("sha256", secret).update(signText).digest("base64");
  return { keyName, ttl, capability, clientId, timestamp, nonce, mac };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method !== "POST") return json(res, 405, { error: "POST required" });
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return json(res, 413, { error: "Request body too large" });
    return json(res, 400, { error: "Bad request" });
  }
  const action = clean(body.action, 40);
  try {
    const data = await ({
      bootstrap,
      friends,
      addFriend,
      roomCreate,
      roomJoin,
      chatHistory,
      saveChat,
      ablyToken,
    }[action] || (async () => ({ error: "Unknown action" })))(body);
    return json(res, data?.error ? 400 : 200, data);
  } catch (error) {
    if (error instanceof AuthError) return json(res, 401, { error: "Unauthorized" });
    console.error("[social] action failed:", action, error?.message);
    return json(res, 500, { error: "Social API unavailable" });
  }
};
