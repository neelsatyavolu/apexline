const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const Module = require("node:module");

const originalLoad = Module._load;
const originalDatabaseUrl = process.env.DATABASE_URL;

const db = {
  users: new Map(),
  friendships: new Map(),
  rooms: new Map(),
};

function rowForUser(user) {
  return user ? { id: user.id, friend_code: user.friendCode, display_name: user.displayName, token_hash: user.tokenHash } : null;
}

function friendshipKey(a, b) {
  return [a, b].sort().join(":");
}

async function fakeSql(strings, ...values) {
  const query = strings.join("?").replace(/\s+/g, " ").trim();
  if (query.startsWith("CREATE TABLE") || query.startsWith("ALTER TABLE")) return { rows: [] };

  if (query.includes("FROM apexline_users WHERE id =")) {
    const row = rowForUser(db.users.get(values[0]));
    return { rows: row ? [row] : [] };
  }

  if (query.includes("FROM apexline_users WHERE friend_code =")) {
    const code = values[0];
    const user = Array.from(db.users.values()).find((item) => item.friendCode === code);
    const row = rowForUser(user);
    return { rows: row ? [row] : [] };
  }

  if (query.startsWith("INSERT INTO apexline_users")) {
    db.users.set(values[0], { id: values[0], friendCode: values[1], displayName: values[2], tokenHash: values[4] });
    return { rows: [] };
  }

  if (query.startsWith("INSERT INTO apexline_rooms")) {
    db.rooms.set(values[0], { id: values[0], code: values[1] });
    return { rows: [] };
  }

  if (query.includes("FROM apexline_rooms WHERE id =")) {
    return { rows: db.rooms.has(values[0]) ? [{ "?column?": 1 }] : [] };
  }

  if (query.startsWith("INSERT INTO apexline_chat_messages")) return { rows: [] };

  if (query.startsWith("INSERT INTO apexline_friendships")) {
    const value = { a: values[0], b: values[1], status: values[2], createdAt: values[3] };
    db.friendships.set(friendshipKey(value.a, value.b), value);
    return { rows: [] };
  }

  if (query.includes("FROM apexline_friendships f")) {
    const userId = values[0];
    const rows = [];
    for (const value of db.friendships.values()) {
      if (value.a !== userId && value.b !== userId) continue;
      const other = db.users.get(value.a === userId ? value.b : value.a);
      rows.push({
        a: value.a,
        b: value.b,
        status: value.status,
        created_at: value.createdAt,
        friend_id: other?.id,
        friend_code: other?.friendCode,
        display_name: other?.displayName,
      });
    }
    return { rows };
  }

  throw new Error(`Unhandled fake SQL query: ${query}`);
}

function invoke(handler, payload) {
  return new Promise((resolve) => {
    const req = Readable.from([JSON.stringify(payload)]);
    req.method = "POST";
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(key, value) {
        this.headers[key] = value;
      },
      end(body) {
        resolve({ statusCode: this.statusCode, body: JSON.parse(body) });
      },
    };
    handler(req, res);
  });
}

(async () => {
  process.env.DATABASE_URL = "postgres://apexline-test";
  Module._load = function load(request, parent, isMain) {
    if (request === "@vercel/postgres") return { sql: fakeSql };
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const handlerPath = require.resolve("../updates-site/api/social.js");
    delete require.cache[handlerPath];
    const handler = require(handlerPath);

    const first = await invoke(handler, { action: "bootstrap", userId: "user-a", profile: { name: "First fan" } });
    const second = await invoke(handler, { action: "bootstrap", profile: { name: "Second fan" } });
    const asFirst = { userId: first.body.userId, userToken: first.body.userToken };
    const renamed = await invoke(handler, { action: "bootstrap", ...asFirst, profile: { name: "Renamed fan" } });
    const added = await invoke(handler, { action: "addFriend", ...asFirst, friendCode: second.body.friendCode });

    assert.notEqual(first.body.userId, "user-a", "The server, not the client, should choose new user ids");
    assert.ok(first.body.userToken, "Bootstrap should issue a secret user token");
    assert.equal(renamed.body.userId, first.body.userId, "Bootstrap with a valid token should resume the same identity");
    assert.equal(renamed.body.userToken, first.body.userToken, "Resuming should keep the same token");
    assert.equal(renamed.body.displayName, "Renamed fan", "Bootstrap should refresh an existing user's Settings display name");
    assert.equal(db.users.get(first.body.userId)?.displayName, "Renamed fan", "Persisted social identity should keep the latest Settings display name");
    assert.notEqual(db.users.get(first.body.userId)?.tokenHash, first.body.userToken, "Only a hash of the token should be stored");
    assert.equal(added.body.ok, true, "Adding a friend by persisted friend code should succeed");

    globalThis.__APEXLINE_SOCIAL_MEMORY__.users.clear();
    globalThis.__APEXLINE_SOCIAL_MEMORY__.tokenHashes.clear();
    globalThis.__APEXLINE_SOCIAL_MEMORY__.codeToUser.clear();
    globalThis.__APEXLINE_SOCIAL_MEMORY__.friendships.clear();

    const visibleToSecondUser = await invoke(handler, { action: "friends", userId: second.body.userId, userToken: second.body.userToken });
    assert.equal(visibleToSecondUser.body.friends.length, 1, "Persisted friendships should show for the user who was added");
    assert.equal(visibleToSecondUser.body.friends[0].friend.userId, first.body.userId, "The added user's friend list should include the requester");

    // A leaked user id (visible in chat and presence) must not grant access.
    const noToken = await invoke(handler, { action: "friends", userId: first.body.userId });
    const wrongToken = await invoke(handler, { action: "friends", userId: first.body.userId, userToken: second.body.userToken });
    assert.equal(noToken.statusCode, 401, "Actions without a token should be rejected");
    assert.equal(wrongToken.statusCode, 401, "Actions with another user's token should be rejected");

    const hijack = await invoke(handler, { action: "bootstrap", userId: first.body.userId, profile: { name: "Impostor" } });
    assert.notEqual(hijack.body.userId, first.body.userId, "Bootstrap with a stolen user id should get a fresh identity");
    assert.equal(db.users.get(first.body.userId)?.displayName, "Renamed fan", "A hijack attempt must not rename the victim");

    db.users.set("legacy-user", { id: "legacy-user", friendCode: "LEGACY01", displayName: "Legacy fan", tokenHash: null });
    const legacy = await invoke(handler, { action: "bootstrap", userId: "legacy-user", profile: { name: "Legacy fan" } });
    assert.equal(legacy.body.userId, "legacy-user", "Accounts created before tokens existed should be claimed on first bootstrap");
    assert.equal(legacy.body.friendCode, "LEGACY01", "Claiming a legacy account should keep its friend code");

    const room = await invoke(handler, { action: "roomCreate", ...asFirst, label: "Race night" });
    assert.equal(room.body.hostId, first.body.userId, "Room host should be the authenticated user");
    const unauthRoom = await invoke(handler, { action: "roomCreate", userId: first.body.userId, label: "Spoofed" });
    assert.equal(unauthRoom.statusCode, 401, "Creating a room should require a token");

    const saved = await invoke(handler, { action: "saveChat", ...asFirst, roomId: room.body.id, name: "Renamed fan", text: "Box box", userIdOverride: "x" });
    assert.equal(saved.body.message.userId, first.body.userId, "Chat messages should be attributed to the authenticated user");
    const strayChat = await invoke(handler, { action: "saveChat", ...asFirst, roomId: "not-a-room", text: "hello" });
    assert.equal(strayChat.body.ok, false, "Chat should only be saved into rooms that exist");

    process.env.ABLY_API_KEY = "app.key:secret";
    const ably = await invoke(handler, { action: "ablyToken", ...asFirst, roomId: room.body.id });
    assert.equal(ably.body.clientId, first.body.userId, "Ably clientId should come from the authenticated user");
    const strayAbly = await invoke(handler, { action: "ablyToken", ...asFirst, roomId: "not-a-room" });
    assert.equal(strayAbly.body.ok, false, "Ably tokens should only be issued for rooms that exist");
    const unauthAbly = await invoke(handler, { action: "ablyToken", userId: first.body.userId, roomId: room.body.id });
    assert.equal(unauthAbly.statusCode, 401, "Ably tokens should require a user token");
    delete process.env.ABLY_API_KEY;

    console.log("Apexline social API smoke checks passed");
  } finally {
    Module._load = originalLoad;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
