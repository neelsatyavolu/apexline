const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const Module = require("node:module");

const originalLoad = Module._load;
const originalDatabaseUrl = process.env.DATABASE_URL;

const db = {
  users: new Map(),
  friendships: new Map(),
};

function rowForUser(user) {
  return user ? { id: user.id, friend_code: user.friendCode, display_name: user.displayName } : null;
}

function friendshipKey(a, b) {
  return [a, b].sort().join(":");
}

async function fakeSql(strings, ...values) {
  const query = strings.join("?").replace(/\s+/g, " ").trim();
  if (query.startsWith("CREATE TABLE")) return { rows: [] };

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
    db.users.set(values[0], { id: values[0], friendCode: values[1], displayName: values[2] });
    return { rows: [] };
  }

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
    const second = await invoke(handler, { action: "bootstrap", userId: "user-b", profile: { name: "Second fan" } });
    const renamed = await invoke(handler, { action: "bootstrap", userId: "user-a", profile: { name: "Renamed fan" } });
    const added = await invoke(handler, { action: "addFriend", userId: first.body.userId, friendCode: second.body.friendCode });

    assert.equal(renamed.body.displayName, "Renamed fan", "Bootstrap should refresh an existing user's Settings display name");
    assert.equal(db.users.get(first.body.userId)?.displayName, "Renamed fan", "Persisted social identity should keep the latest Settings display name");
    assert.equal(added.body.ok, true, "Adding a friend by persisted friend code should succeed");

    globalThis.__APEXLINE_SOCIAL_MEMORY__.users.clear();
    globalThis.__APEXLINE_SOCIAL_MEMORY__.codeToUser.clear();
    globalThis.__APEXLINE_SOCIAL_MEMORY__.friendships.clear();

    const visibleToSecondUser = await invoke(handler, { action: "friends", userId: second.body.userId });
    assert.equal(visibleToSecondUser.body.friends.length, 1, "Persisted friendships should show for the user who was added");
    assert.equal(visibleToSecondUser.body.friends[0].friend.userId, first.body.userId, "The added user's friend list should include the requester");

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
