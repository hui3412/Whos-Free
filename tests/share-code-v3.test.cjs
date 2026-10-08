const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { deflateRawSync, deflateSync, gzipSync } = require("node:zlib");
const source = fs.readFileSync(path.join(__dirname, "../schedule-share-code.js"), "utf8");
const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/share-code-legacy.json"), "utf8"));
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const fields = ["course", "course_code", "section", "room", "instructor"];
const plain = value => JSON.parse(JSON.stringify(value));
function codec(compression = CompressionStream) {
  const context = vm.createContext({ TextEncoder, TextDecoder, Blob, CompressionStream: compression === false ? undefined : compression, DecompressionStream, Uint8Array });
  vm.runInContext(source, context); return context.WhosFreeShareCode;
}
const api = codec();
const clock = minute => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
function expectedExport(decoded) {
  const result = plain(decoded);
  result.share_profile = "compact";
  for (const person of Object.values(result.people)) for (const item of person.classes) {
    item.course_code = null; item.section = null;
    if (item.instructor) item.instructor = item.instructor.trim().split(/\s+/).at(-1);
  }
  return result;
}
function compact(data) {
  return Object.entries(data.people).map(([name, person]) => [name, person.classes.map(item => {
    const row = [days.indexOf(item.day) | (item.kind === "busy_block" ? 8 : 0), minutes(item.start), minutes(item.end) - minutes(item.start), ...fields.map(key => item[key] || null)];
    while (row.length > 3 && row.at(-1) == null) row.pop(); return row;
  }), ...(person.semester !== undefined ? [person.semester] : [])]);
}
function oldCode(data, compression = true) {
  const bytes = Buffer.from(JSON.stringify(compact(data))), zipped = deflateRawSync(bytes);
  return api.__test.wrap(compression && zipped.length < bytes.length ? zipped : bytes, compression && zipped.length < bytes.length ? "D" : "J");
}
function wf1(bytes, mode = "J") {
  const checked = api.__test.unbase14(api.__test.wrap(bytes, "J").slice(4));
  const crc = Buffer.from(checked).readUInt32LE(0).toString(16).padStart(8, "0").toUpperCase();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let text = "", bits = 0, buffer = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; text += alphabet[(buffer >>> bits) & 31]; }
    buffer &= (1 << bits) - 1;
  }
  if (bits) text += alphabet[(buffer << (5 - bits)) & 31];
  return `WF1${mode}${crc}${text}`;
}
function week(people = 1) {
  const courses = ["Calcul différentiel", "General Chemistry", "Introduction to College English", "Cellular Biology (CL)", "Mechanics"];
  return { people: Object.fromEntries(Array.from({ length: people }, (_, p) => [`Student ${p + 1}`, { semester: "Fall 2026", classes: Array.from({ length: 15 }, (_, i) => {
    const course = (i % 5 + Math.floor(i / 5)) % 5, start = 495 + Math.floor(i / 5) * 180;
    return { day: days[i % 5], start: clock(start), end: clock(start + 80), course: courses[course], course_code: `${201 + course}-SN1-RE`, section: "00001", room: `A-${104 + course}`, instructor: `Instructor ${course + 1}`, kind: "class" };
  }) }])) };
}

test("frozen original WF1, WF2 and WF3 exports retain full details in every compression mode", async () => {
  for (const [name, code] of Object.entries(legacy.codes)) {
    const decoded = await api.decode(code.replace(/(.{25})/g, "$1\n"));
    assert.equal(decoded.people.Élodie.classes[0].course, "Calcul différentiel", name);
    assert.equal(decoded.people.Élodie.classes[1].kind, "busy_block", name);
    assert.equal(decoded.people.Élodie.classes[1].day, "Saturday", name);
    if (!name.startsWith("wf1")) {
      assert.equal(decoded.people.Élodie.semester, "Fall 2026");
      assert.equal(decoded.people["No semester"].semester, null);
      assert.deepEqual(plain(decoded), plain(await api.decode(legacy.codes.wf2Raw)));
    }
  }
  assert.deepEqual(plain(await api.decode(legacy.codes.wf1Plain.toLowerCase())), plain(await api.decode(legacy.codes.wf1Plain)));
  const damaged = legacy.codes.wf1Plain.slice(0, -1) + "A";
  await assert.rejects(api.decode(damaged), /incomplete|changed/);
  const payload = { v: 1, p: [{ n: "Bad", c: [[7, "08:00", "09:00"]] }] };
  // Old gzip codes retain decompression limits too.
  const tooLarge = gzipSync(Buffer.alloc(api.__test.MAX_BYTES + 1, 32));
  await assert.rejects(api.decode(wf1(Buffer.from(JSON.stringify(payload)))), /invalid day or time/);
  await assert.rejects(api.decode(wf1(tooLarge, "G")), /too large/);
});

test("each binary layout preserves row order, exact minutes, Unicode and semester states", async () => {
  const data = { people: {
    "名字 📚": { semester: null, classes: [
      { day: "Sunday", start: "23:01", end: "23:59", course: "\uFEFFChimie générale", course_code: "001", section: "00001", room: "900", instructor: "Élodie", kind: "busy_block" },
      { day: "Sunday", start: "00:00", end: "00:01", course: "Unknown", kind: "class" },
      { day: "Monday", start: "09:07", end: "10:13", instructor: "Other", kind: "class" }
    ] },
    Missing: { classes: [] }, Winter: { semester: "Winter 2000", classes: [] }, Fall: { semester: "Fall 2099", classes: [] }
  } };
  const expected = plain(await api.decode(oldCode(data)));
  for (let variant = 0; variant < 3; variant++) {
    const bytes = api.__test.packBinary(api.__test.pack(data), variant);
    for (const [mode, encoded] of [["B", bytes], ["R", deflateRawSync(bytes)], ["S", deflateSync(bytes)]]) {
      const actual = await api.decode(api.__test.wrap(encoded, mode, 3));
      assert.deepEqual(plain(actual), expected, `variant ${variant}, mode ${mode}`);
    }
  }
  assert.deepEqual(plain(await api.decode(await api.encode(data))), expectedExport(expected));
  const loneSurrogate = { people: { "Name\uD800": { classes: [{ day: "Monday", start: "08:00", end: "09:00", course: "Label\uDC00" }] } } };
  assert.deepEqual(plain(await api.decode(await api.encode(loneSurrogate))), expectedExport(await api.decode(oldCode(loneSurrogate))));
});

test("adaptive WF5 exports shorten synthetic collections compared with full WF2 exports", async () => {
  const sizes = [];
  for (const data of [week(), week(10), { people: { Empty: { classes: [] } } }, legacy.data]) {
    for (const compression of [true, false]) {
      const code = await codec(compression ? CompressionStream : false).encode(data);
      sizes.push({ people: Object.keys(data.people).length, entries: Object.values(data.people).reduce((n, p) => n + p.classes.length, 0), compression, old: oldCode(data, compression).length, new: code.length });
      assert.match(code, /^WF5/);
      assert.ok(code.length <= oldCode(data, compression).length);
      assert.deepEqual(plain(await api.decode(code)), expectedExport(await api.decode(oldCode(data, compression))));
    }
  }
  const data = week(10), newer = await api.encode(data), older = oldCode(data);
  assert.ok(newer.length < older.length * 0.85, `${newer.length} vs ${older.length}`);
  if (process.env.SHARE_CODE_BENCHMARK) console.log(JSON.stringify(sizes));
});

test("seeded irregular schedules round-trip through every layout without size regressions", async () => {
  let seed = 87123;
  const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  for (let sample = 0; sample < 60; sample++) {
    const data = { people: {} };
    const unit = [1, 5, 15, 30, 60][sample % 5];
    for (let p = 0; p < 1 + random(5); p++) {
      const person = { classes: [] };
      if (p % 3 === 1) person.semester = null;
      if (p % 3 === 2) person.semester = "Winter 2027";
      for (let i = 0, n = random(45); i < n; i++) {
        const start = random(Math.floor(1300 / unit)) * unit, duration = (1 + random(Math.floor(120 / unit))) * unit;
        person.classes.push({ day: days[random(7)], start: clock(start), end: clock(start + duration), ...Object.fromEntries(fields.filter(() => random(2)).map(key => [key, `${key} ${random(8)} é名字`])), kind: random(3) ? "class" : "busy_block" });
      }
      data.people[`Person ${p}`] = person;
    }
    const expected = plain(await api.decode(oldCode(data)));
    for (let variant = 0; variant < 3; variant++) assert.deepEqual(plain(await api.decode(api.__test.wrap(api.__test.packBinary(api.__test.pack(data), variant), "B", 3))), expected);
    const code = await api.encode(data);
    assert.ok(code.length <= oldCode(data).length);
    assert.deepEqual(plain(await api.decode(code)), expectedExport(expected));
  }
});

test("binary parsers reject malformed lengths, flags, times, references and trailing data", async () => {
  const valid = [0, 1, 1, 65, 0, 1, 0, 60, 0];
  const corrupt = [
    [3, ...valid.slice(1)], [20, ...valid.slice(1)], [0, 0],
    [0, 129, 0, ...valid.slice(2)], [0, 1, 1, 255, 0, 0],
    [0, 1, 1, 65, 202, 1, 0], [0, 1, 1, 65, 0, 245, 3],
    [...valid.slice(0, 6), 7, 60, 0], [...valid.slice(0, 7), 0, 0],
    [...valid.slice(0, 8), 64], [...valid, 0],
    [1, 1, 1, 120, 1, 1, 65, 0, 1, 0, 60, 1, 1],
    [2, 0, 0, 1, 1, 65, 0, 1, 0]
  ];
  for (let length = 0; length < valid.length; length++) corrupt.push(valid.slice(0, length));
  for (const bytes of corrupt) await assert.rejects(api.decode(api.__test.wrap(Uint8Array.from(bytes), "B", 3)), /valid schedule data/);
  await assert.rejects(api.decode(api.__test.wrap(deflateRawSync(Buffer.alloc(api.__test.MAX_BYTES + 1)), "R", 3)), /too large/);
});

test("large label tables and intensive durations cross varint boundaries losslessly", async () => {
  const data = { people: { Student: { classes: Array.from({ length: 180 }, (_, i) => ({ day: days[i % 7], start: "16:15", end: "19:15", course: `Course ${i}`, room: `Room ${i}`, instructor: `Instructor ${i}`, section: "00001", kind: "class" })) } } };
  for (let variant = 0; variant < 3; variant++) assert.deepEqual(plain(await api.decode(api.__test.wrap(api.__test.packBinary(api.__test.pack(data), variant), "B", 3))), plain(await api.decode(oldCode(data))));
});
