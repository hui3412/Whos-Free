const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const { gzipSync } = require("node:zlib");
const source = fs.readFileSync(require("node:path").join(__dirname, "../schedule-share-code.js"), "utf8");
function codec(compression = true) {
  const context = vm.createContext({ TextEncoder, TextDecoder, Blob, CompressionStream: compression ? CompressionStream : undefined, DecompressionStream, Uint8Array });
  vm.runInContext(source, context);
  return context.WhosFreeShareCode;
}
const api = codec();
const classItem = { day: "Saturday", start: "11:15", end: "12:05", course: "Chimie générale 📚", room: "900", instructor: "Hui En Qian", kind: "busy_block" };
const data = { schema_version: 1, people: { "Élodie Qian": { source_file: "private-original.jpg", classes: [classItem] }, "Empty Day": { classes: [] } }, nicknames: { private: "not shared" } };
const plain = value => JSON.parse(JSON.stringify(value));
function crafted(payload, compressed = false) {
  const bytes = compressed ? gzipSync(Buffer.from(payload)) : Buffer.from(payload);
  return `WF1${compressed ? "G" : "J"}${api.__test.checksum(bytes)}${api.__test.base32(bytes)}`;
}

test("a standalone alphanumeric code preserves Unicode, weekends, busy labels and empty schedules", async () => {
  const code = await api.encode(data);
  assert.match(code, /^[A-Z0-9]+$/);
  const decoded = await api.decode(code.toLowerCase().replace(/(.{40})/g, "$1\n"));
  assert.deepEqual(Object.keys(decoded.people), Object.keys(data.people));
  assert.equal(decoded.people["Élodie Qian"].source_file, "Shared code");
  assert.equal(decoded.people["Élodie Qian"].classes[0].day, "Saturday");
  for (const key of Object.keys(classItem)) assert.equal(decoded.people["Élodie Qian"].classes[0][key], classItem[key]);
  assert.equal(decoded.people["Empty Day"].classes.length, 0);
  assert.equal(decoded.nicknames, undefined);
  assert.ok(!JSON.stringify(decoded).includes("private-original"));
});

test("compression reduces message size; uncompressed fallback can be read by the same importer", async () => {
  const collection = { people: { Person: { classes: Array.from({ length: 30 }, () => ({ ...classItem })) } } };
  const compressed = await api.encode(collection);
  const uncompressed = await codec(false).encode(collection);
  assert.match(compressed, /^WF1G/);
  assert.match(uncompressed, /^WF1J/);
  assert.ok(compressed.length < uncompressed.length / 2);
  assert.deepEqual(plain(await api.decode(compressed)), plain(await api.decode(uncompressed)));
});

test("duplicate names are skipped without replacing existing schedules or dropping unrelated people", async () => {
  const oldPerson = { classes: [{ ...classItem, room: "Original room" }] };
  const existing = { schema_version: 1, people: { "Élodie Qian": oldPerson, Unrelated: { classes: [] } } };
  const incoming = await api.decode(await api.encode({ people: { "  ÉLODIE   QIAN ": { classes: [classItem] }, Friend: { classes: [classItem] } } }));
  const result = api.merge(existing, incoming);
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.data.people["Élodie Qian"], oldPerson);
  assert.equal(result.data.people.Unrelated, existing.people.Unrelated);
  assert.equal(Object.keys(existing.people).length, 2);
  const repeated = api.merge(result.data, incoming);
  assert.equal(repeated.added, 0);
  assert.equal(repeated.skipped, 2);
});

test("prototype-like names remain ordinary schedule entries", async () => {
  const dangerousNames = JSON.parse('{"people":{"__proto__":{"classes":[]},"constructor":{"classes":[]}}}');
  const decoded = await api.decode(await api.encode(dangerousNames));
  const merged = api.merge({ people: {} }, decoded);
  assert.equal(Object.keys(merged.data.people).length, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(merged.data.people, "__proto__"), true);
  assert.equal({}.classes, undefined);
});

test("damaged, unsupported and malformed codes fail without yielding schedules", async () => {
  const code = await api.encode(data);
  await assert.rejects(api.decode(""), /not a valid/);
  await assert.rejects(api.decode(code.replace(/^WF1/, "WF2")), /not a valid/);
  await assert.rejects(api.decode(code.slice(0, -4)), /incomplete|changed/);
  await assert.rejects(api.decode(code.slice(0, 12) + "!" + code.slice(13)), /not a valid/);
  await assert.rejects(api.decode(crafted("not JSON")), /readable/);
  await assert.rejects(api.decode(crafted('{"v":1,"p":[{"n":"Bad","c":[[0,"12:00","11:00"]]}]}')), /invalid day or time/);
  await assert.rejects(api.decode(crafted('{"v":1,"p":[{"n":"Bad","c":[]},{"n":"bad","c":[]}]}')), /repeated/);
  await assert.rejects(api.encode({ people: {} }), /supported schedule/);
});

test("decompression is bounded even when a tiny code expands beyond the limit", async () => {
  const code = crafted(" ".repeat(api.__test.MAX_BYTES + 1), true);
  await assert.rejects(api.decode(code), /too large/);
});
