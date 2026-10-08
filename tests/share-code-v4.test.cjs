const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { deflateRawSync, deflateSync } = require("node:zlib");
const source = fs.readFileSync(path.join(__dirname, "../schedule-share-code.js"), "utf8");
const plain = value => JSON.parse(JSON.stringify(value));
function codec(compression = CompressionStream) {
  const context = vm.createContext({ TextEncoder, TextDecoder, Blob, CompressionStream: compression || undefined, DecompressionStream, Uint8Array });
  vm.runInContext(source, context); return context.WhosFreeShareCode;
}
const api = codec();
const entry = { day: "Monday", start: "09:07", end: "10:13", course: "Differential Calculus", course_code: "201-SN2-RE", section: "00001", room: "D-120B", instructor: "Wee Keong Lim", kind: "class" };
const data = { schema_version: 1, people: { Student: { semester: "Fall 2026", classes: [entry, { ...entry, day: "Saturday", kind: "busy_block", course_code: "private-code", section: "99999" }] } } };
function wf3(data) {
  const payload = api.__test.pack(data), candidates = [[Buffer.from(JSON.stringify(api.__test.packCompact(payload))), "J", "D"]];
  for (let v = 0; v < 3; v++) candidates.push([api.__test.packBinary(payload, v), "B", "R"]);
  return candidates.flatMap(([bytes, raw, zipped]) => [api.__test.wrap(bytes, raw, 3), api.__test.wrap(deflateRawSync(bytes), zipped, 3)]).sort((a, b) => a.length - b.length)[0];
}

test("WF4 shares only requested details without editing the local collection", async () => {
  const before = plain(data), code = await api.encode(data), actual = await api.decode(code);
  assert.match(code, /^WF4/);
  assert.equal(actual.share_profile, "compact");
  assert.equal(actual.people.Student.semester, "Fall 2026");
  assert.deepEqual(plain(actual.people.Student.classes), data.people.Student.classes.map(item => ({ ...item, course_code: null, section: null, instructor: "Lim" })));
  assert.deepEqual(data, before);
  assert.equal(JSON.stringify(actual).includes("private-code"), false);
});

test("surname inference retains common compounds, hyphens, commas and multiple instructors", () => {
  for (const [original, expected] of [
    ["Hui En Qian", "Qian"], ["Marianne Campeau-Devlin", "Campeau-Devlin"],
    ["María de la Cruz", "de la Cruz"], ["Ludwig van der Berg", "van der Berg"],
    ["Smith, Jane Marie", "Smith"], ["名字", "名字"], [" Jean  Michel Sotiron ", "Sotiron"],
    ["John Smith / Jane Doe", "Smith/Doe"], ["John Smith & Jane Doe", "Smith/Doe"],
    ["Anna Saint Pierre", "Saint Pierre"], [null, null], ["", null]
  ]) {
    assert.equal(api.__test.familyName(original), expected, original);
    assert.equal(api.__test.familyName(expected), expected, "shortened names must remain stable on re-export");
  }
});

test("all dictionary IDs and layouts restore exact text including literal controls and Unicode", async () => {
  assert.equal(api.__test.WORDS.length, 31);
  assert.equal(api.__test.tokenize("Calculus"), "\x0e", "the released WF4 token ID is fixed");
  const labels = [...api.__test.WORDS, "precalculus CALCULUS Calculus_extra écalculus Calculus", "\uFEFFPhysics 名字 📚", "NUL\0Physics\x01\x1f", Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join("")];
  const collection = { people: { "History Student": { semester: null, classes: labels.map(course => ({ ...entry, course, instructor: "Smith" })) } } };
  const expected = plain((await api.decode(await api.encode(collection))).people);
  for (const text of labels) assert.equal(api.__test.untokenize(api.__test.tokenize(text)), text);
  assert.equal(api.__test.tokenize("precalculus CALCULUS _Calculus écalculus"), "precalculus CALCULUS _Calculus écalculus");
  for (const dictionary of [false, true]) for (let variant = 0; variant < 3; variant++) {
    const bytes = api.__test.packBinary(api.__test.pack(collection, true), variant, dictionary);
    for (const [mode, encoded] of [["B", bytes], ["R", deflateRawSync(bytes)], ["S", deflateSync(bytes)]]) {
      assert.deepEqual(plain((await api.decode(api.__test.wrap(encoded, mode, 4))).people), expected, `${variant}/${dictionary}/${mode}`);
    }
  }
});

test("dictionary escapes, expansion limits and version flags reject malformed codes", async () => {
  // Literal-layout A, one 08:00–09:00 class; course token 14 means Calculus.
  const prefix = [32, 1, 1, 65, 0, 1, 0, 60, 1];
  const valid = [...prefix, 1, 14];
  assert.equal((await api.decode(api.__test.wrap(Uint8Array.from(valid), "B", 4))).people.A.classes[0].course, "Calculus");
  const escape = [...prefix, 2, 0, 14];
  assert.equal((await api.decode(api.__test.wrap(Uint8Array.from(escape), "B", 4))).people.A.classes[0].course, "\x0e");
  for (const bytes of [[...prefix, 1, 0], [...prefix, 2, 0, 32], [...prefix, 20, ...Array(20).fill(13)], [64, ...valid.slice(1)], [128, ...valid.slice(1)]]) {
    await assert.rejects(api.decode(api.__test.wrap(Uint8Array.from(bytes), "B", 4)), /valid schedule data/);
  }
  await assert.rejects(api.decode(api.__test.wrap(Uint8Array.from(valid), "B", 3)), /valid schedule data/, "WF3 must not silently accept WF4 dictionaries");
});

test("compact JSON remains a lossless fallback for retained fields and unusual UTF-16", async () => {
  const collection = { people: { "Name\uD800": { classes: [{ ...entry, course: "Unknown\uDC00", instructor: "Jane Smith" }] }, Empty: { classes: [] } } };
  const payload = api.__test.pack(collection, true), bytes = Buffer.from(JSON.stringify(api.__test.packCompact(payload, true)));
  const expected = plain((await api.decode(await api.encode(collection))).people);
  for (const [mode, encoded] of [["J", bytes], ["D", deflateRawSync(bytes)], ["Z", deflateSync(bytes)]]) assert.deepEqual(plain((await api.decode(api.__test.wrap(encoded, mode, 4))).people), expected);
  assert.equal(expected["Name\uD800"].classes[0].course, "Unknown\uDC00");
  assert.equal(expected["Name\uD800"].classes[0].instructor, "Smith");
  await assert.rejects(api.decode(api.__test.wrap(Buffer.from('[["Bad",[[0,480,60,"x","r","i","extra"]]]]'), "J", 4)), /valid schedule data/);
});

test("compact reimports skip without removing richer local metadata; real timetable changes still ask", async () => {
  const before = plain(data), incoming = await api.decode(await api.encode(data));
  const result = await api.merge(data, incoming, () => { throw Error("unnecessary conflict"); });
  assert.equal(result.skipped, 1);
  assert.deepEqual(plain(result.data), before);
  assert.deepEqual(data, before);
  for (const [key, value] of [["course", "Changed"], ["room", "Other"], ["instructor", "Doe"], ["day", "Sunday"], ["start", "09:08"], ["end", "10:14"], ["kind", "busy_block"]]) {
    const changed = plain(incoming); changed.people.Student.classes[0][key] = value;
    let calls = 0;
    await api.merge(data, changed, () => { calls++; return "old"; });
    assert.equal(calls, 1, key);
  }
  const full = await api.decode(wf3({ people: { Student: { ...data.people.Student, classes: data.people.Student.classes.map(item => ({ ...item, section: "changed" })) } } }));
  let calls = 0; await api.merge(data, full, () => { calls++; return "old"; });
  assert.equal(calls, 1, "older full-detail imports continue comparing sections");
});

test("WF4 measures dictionary savings against WF3 and selects the smallest tested payload", async () => {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const courses = ["Calcul différentiel", "General Chemistry", "Introduction to College English", "Cellular Biology (CL)", "Mechanics"];
  const sizes = [];
  for (const people of [1, 10, 40]) {
    const collection = { people: Object.fromEntries(Array.from({ length: people }, (_, p) => [`Student ${p + 1}`, { semester: "Fall 2026", classes: Array.from({ length: 15 }, (_, i) => {
      const course = (i % 5 + Math.floor(i / 5)) % 5, minute = 495 + Math.floor(i / 5) * 180;
      const clock = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      return { day: days[i % 5], start: clock(minute), end: clock(minute + 80), course: courses[course], course_code: `${201 + course}-SN1-RE`, section: "00001", room: `A-${104 + course}`, instructor: `Instructor ${course + 1}`, kind: "class" };
    }) }])) };
    const payload = api.__test.pack(collection, true), candidates = [Buffer.from(JSON.stringify(api.__test.packCompact(payload, true)))];
    for (let variant = 0; variant < 3; variant++) for (const dictionary of [false, true]) candidates.push(api.__test.packBinary(payload, variant, dictionary));
    const smallest = Math.min(...candidates.flatMap(bytes => [bytes.length, deflateRawSync(bytes).length]));
    const code = await api.encode(collection), old = wf3(collection);
    assert.equal(api.__test.unbase14(code.slice(4)).length - 4, smallest);
    assert.ok(code.length < old.length, `${people} people: ${code.length} vs ${old.length}`);
    sizes.push({ people, classes: people * 15, wf3: old.length, wf4: code.length });
  }
  const known = { people: { Student: { classes: [{ ...entry, instructor: "Smith" }] } } };
  const payload = api.__test.pack(known, true);
  assert.ok(api.__test.packBinary(payload, 0, true).length < api.__test.packBinary(payload, 0).length);
  assert.ok((await codec(false).encode(known)).length < wf3(known).length, "uncompressed fallback also benefits");
  if (process.env.SHARE_CODE_BENCHMARK) console.log(JSON.stringify(sizes));
});
