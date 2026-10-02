const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const { deflateRawSync, deflateSync } = require("node:zlib");
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
  const bytes = compressed ? deflateRawSync(Buffer.from(payload)) : Buffer.from(payload);
  return api.__test.wrap(bytes, compressed ? "D" : "J");
}

test("a standalone Unicode code preserves Unicode, weekends, busy labels and empty schedules", async () => {
  const code = await api.encode(data);
  assert.match(code, /^WF2[DJZ][0-6][\u4e00-\u8dff]+$/);
  assert.equal([...code].length, code.length, "one UTF-16 code unit per visible character");
  const decoded = await api.decode(code.normalize("NFC").replace(/(.{40})/g, "$1\n"));
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
  assert.match(compressed, /^WF2D/);
  assert.match(uncompressed, /^WF2J/);
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
  await assert.rejects(api.decode(code.replace(/^WF2/, "WF9")), /not a valid/);
  await assert.rejects(api.decode(code.slice(0, -4)), /incomplete|changed/);
  await assert.rejects(api.decode(code.slice(0, 12) + "!" + code.slice(13)), /not a valid/);
  await assert.rejects(api.decode(crafted("not JSON")), /readable/);
  await assert.rejects(api.decode(crafted('[["Bad",[[0,720,-60]]]]')), /valid schedule data/);
  await assert.rejects(api.decode(crafted('[["Bad",[]],["bad",[]]]')), /repeated/);
  await assert.rejects(api.encode({ people: {} }), /supported schedule/);
  await assert.rejects(api.decode("WF1G01234567OLD"), /old export code/);
  await assert.rejects(api.decode(code.toLowerCase()), /not a valid/);
  const index = 20;
  const changed = code.slice(0, index) + String.fromCharCode(0x4e00 + ((code.charCodeAt(index) - 0x4e00 + 1) % 16384)) + code.slice(index + 1);
  await assert.rejects(api.decode(changed), /changed/);
});

test("decompression is bounded even when a tiny code expands beyond the limit", async () => {
  const code = crafted(" ".repeat(api.__test.MAX_BYTES + 1), true);
  await assert.rejects(api.decode(code), /too large/);
});


test("dense encoding preserves every byte alignment and survives Unicode normalization", () => {
  for (let length = 4; length < 512; length++) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 197 + length * 13) & 255);
    const text = api.__test.base14(bytes);
    assert.equal(text.length, 1 + Math.ceil(length * 8 / 14));
    assert.equal(text.normalize("NFC"), text);
    assert.equal(text.normalize("NFKC"), text);
    assert.deepEqual(api.__test.unbase14(text), bytes);
  }
  const alphabet = Array.from({ length: 16384 }, (_, i) => String.fromCharCode(0x4e00 + i)).join("");
  assert.equal(alphabet.normalize("NFC"), alphabet);
  assert.equal(alphabet.normalize("NFKC"), alphabet);
  assert.ok(!/\s/.test(alphabet));
});

test("raw and wrapped compression have the same portable result", async () => {
  class OlderCompressionStream {
    constructor(format) {
      if (format === "deflate-raw") throw new TypeError("unsupported");
      return new CompressionStream(format);
    }
  }
  const context = vm.createContext({ TextEncoder, TextDecoder, Blob, CompressionStream: OlderCompressionStream, DecompressionStream, Uint8Array });
  vm.runInContext(source, context);
  const collection = { people: { Person: { classes: Array.from({ length: 30 }, () => ({ ...classItem })) } } };
  const code = await context.WhosFreeShareCode.encode(collection);
  assert.match(code, /^WF2Z/);
  assert.deepEqual(plain(await api.decode(code)), plain(await api.decode(await api.encode(collection))));
  const unavailable = vm.createContext({ TextEncoder, TextDecoder, Blob, Uint8Array });
  vm.runInContext(source, unavailable);
  await assert.rejects(unavailable.WhosFreeShareCode.decode(await api.encode(collection)), /browser cannot open/);
});

test("arbitrary minute times and unfamiliar course labels survive compact packing", async () => {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const classes = days.map((day, i) => ({ day, start: "09:07", end: "10:13", course: `Unfamiliar course ${i}`, course_code: "XYZ", section: "00001", room: "A-101", instructor: "名字", kind: i % 2 ? "busy_block" : "class" }));
  const code = await api.encode({ people: { Student: { classes } } });
  assert.deepEqual(plain((await api.decode(code)).people.Student.classes), classes);
  assert.ok(code.length < 180, "a representative week stays short without dropping labels or minutes");
});

test("compact payload rejects invalid flags, fractions, labels and oversized collections", async () => {
  for (const row of [[7,540,60], [15,540,60], [-1,540,60], [0,540.5,60], [0,540,60.5], [0,1430,10], [0,540,0], [0,540,60,123], [0,540,60,"x".repeat(201)]]) {
    await assert.rejects(api.decode(crafted(JSON.stringify([["Bad",[row]]]))), /valid schedule data|label/);
  }
  await assert.rejects(api.decode(crafted(JSON.stringify([["Bad",Array(501).fill([0,540,60])]]))), /valid schedule data/);
  await assert.rejects(api.decode(crafted(JSON.stringify(Array(251).fill(["Bad",[]])))), /valid schedule data/);
  await assert.rejects(api.decode(api.__test.wrap(deflateSync(Buffer.from("not JSON")), "D")), /could not be opened/);
});
