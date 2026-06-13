const { createHmac, randomBytes, randomUUID } = require("node:crypto");

const memory = globalThis.__APEXLINE_SOCIAL_MEMORY__ || {
  users: new Map(),
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

function readBody(req) {
  return new Promise((resolve) => {
    let text = "";
    req.on("data", (chunk) => { text += chunk; });
    req.on("end", () => {
      try { resolve(text ? JSON.parse(text) : {}); }
      catch { resolve({}); }
    });
  });
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

async function ensureSchema(db) {
  if (!db) return;
  await db`CREATE TABLE IF NOT EXISTS apexline_users (id TEXT PRIMARY KEY, friend_code TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL, created_at BIGINT NOT NULL)`;
  await db`CREATE TABLE IF NOT EXISTS apexline_friendships (a TEXT NOT NULL, b TEXT NOT NULL, status TEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY (a, b))`;
  await db`CREATE TABLE IF NOT EXISTS apexline_rooms (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, host_id TEXT NOT NULL, label TEXT NOT NULL, content_fingerprint TEXT NOT NULL, created_at BIGINT NOT NULL)`;
  await db`CREATE TABLE IF NOT EXISTS apexline_chat_messages (room_id TEXT NOT NULL, id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, sent_at BIGINT NOT NULL, PRIMARY KEY (room_id, id))`;
}

async function bootstrap(body) {
  const db = await sql();
  await ensureSchema(db);
  const displayName = clean(body.profile?.name || body.displayName || "Apexline fan", 80) || "Apexline fan";
  let userId = clean(body.userId || body.localUserId, 80);
  if (db && userId) {
    const existing = await db`SELECT id, friend_code, display_name FROM apexline_users WHERE id = ${userId}`;
    if (existing.rows[0]) return { userId: existing.rows[0].id, friendCode: existing.rows[0].friend_code, displayName: existing.rows[0].display_name };
  }
  if (!userId || !memory.users.has(userId)) userId = randomUUID();
  let code = memory.users.get(userId)?.friendCode || friendCode();
  if (db) {
    for (let i = 0; i < 4; i += 1) {
      try {
        await db`INSERT INTO apexline_users (id, friend_code, display_name, created_at) VALUES (${userId}, ${code}, ${displayName}, ${Date.now()}) ON CONFLICT (id) DO UPDATE SET display_name = ${displayName}`;
        break;
      } catch {
        code = friendCode();
      }
    }
  }
  const user = { userId, friendCode: code, displayName };
  memory.users.set(userId, user);
  memory.codeToUser.set(code, userId);
  return user;
}

function friendshipKey(a, b) {
  return [a, b].sort().join(":");
}

async function friends(body) {
  const userId = clean(body.userId, 80);
  const db = await sql();
  await ensureSchema(db);
  if (db && userId) {
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
  const userId = clean(body.userId, 80);
  const code = clean(body.friendCode, 16).toUpperCase();
  const db = await sql();
  await ensureSchema(db);
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
    hostId: clean(body.userId, 80),
    label: clean(body.label || "Watch party", 80),
    contentFingerprint: clean(body.contentFingerprint || "", 220),
    createdAt: Date.now(),
  };
  const db = await sql();
  await ensureSchema(db);
  if (db) {
    // Retry on the rare room-code collision (code is UNIQUE).
    for (let i = 0; i < 4; i += 1) {
      try {
        await db`INSERT INTO apexline_rooms (id, code, host_id, label, content_fingerprint, created_at) VALUES (${room.id}, ${room.code}, ${room.hostId}, ${room.label}, ${room.contentFingerprint}, ${room.createdAt})`;
        break;
      } catch {
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
  const code = clean(body.code, 16).toUpperCase();
  const db = await sql();
  await ensureSchema(db);
  if (db) {
    const result = await db`SELECT id, code, host_id, label, content_fingerprint, created_at FROM apexline_rooms WHERE code = ${code}`;
    if (result.rows[0]) return roomRow(result.rows[0]);
  }
  const roomId = memory.roomCodes.get(code);
  if (!roomId) return { ok: false, message: "Room code not found." };
  return memory.rooms.get(roomId);
}

async function chatHistory(body) {
  const roomId = clean(body.roomId, 80);
  const db = await sql();
  await ensureSchema(db);
  if (db && roomId) {
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
    userId: clean(body.userId, 80),
    name: clean(body.name || "Apexline fan", 80),
    text: clean(body.text, 500),
    sentAt: Number(body.sentAt) || Date.now(),
  };
  if (!roomId || !message.text) return { ok: false };
  const db = await sql();
  await ensureSchema(db);
  if (db) {
    await db`INSERT INTO apexline_chat_messages (room_id, id, user_id, name, text, sent_at) VALUES (${roomId}, ${message.id}, ${message.userId}, ${message.name}, ${message.text}, ${message.sentAt}) ON CONFLICT (room_id, id) DO NOTHING`;
  }
  const rows = memory.messages.get(roomId) || [];
  rows.push(message);
  memory.messages.set(roomId, rows.slice(-120));
  return { ok: true, message };
}

function ablyToken(body) {
  const key = clean(process.env.ABLY_API_KEY, 400);
  if (!key || !key.includes(":")) return { ok: false, message: "ABLY_API_KEY is not configured." };
  const [keyName, secret] = key.split(":");
  const roomId = clean(body.roomId, 120);
  const clientId = clean(body.userId || "apexline", 120);
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
  const body = await readBody(req);
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
    return json(res, 500, { error: "Social API unavailable", detail: clean(error?.message, 160) });
  }
};
