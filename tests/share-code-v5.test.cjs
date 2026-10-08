const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { deflateRawSync, deflateSync } = require("node:zlib");
const source = fs.readFileSync(path.join(__dirname, "../schedule-share-code.js"), "utf8");
const frozen = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/share-code-wf4.json")));
const plain = x => JSON.parse(JSON.stringify(x));
function codec(compression = CompressionStream) {
  const context = vm.createContext({ TextEncoder, TextDecoder, Blob, Uint8Array, CompressionStream: compression || undefined, DecompressionStream });
  vm.runInContext(source, context); return context.WhosFreeShareCode;
}
const api = codec();
const clock = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const entry = { day: "Monday", start: "08:15", end: "09:35", course: "Differential Calculus", instructor: "Wee Keong Lim", room: "D-120B", kind: "class" };
const full = p => plain({ ...p, p: p.p.map(person => ({ ...person, c: person.c.map(row => Array.from({ length: 9 }, (_, i) => row[i] ?? null)) })) });
function varied(n) {
  const titles = ["Introduction to Psychology", "Organic Chemistry", "Physical Education", "World History", "Programming in Science", "Philosophie et rationalité", "Méthodes de travail", "Calcul différentiel", "General Chemistry", "Cellular Biology (CL)"];
  return { people: Object.fromEntries(Array.from({ length: n }, (_, p) => [`Learner ${p + 1}`, { semester: "Fall 2026", classes: Array.from({ length: 15 }, (_, i) => {
    const k = (p + i + Math.floor(i / 5)) % titles.length, start = 495 + Math.floor(i / 5) * 180 + ((p + i) % 3) * 15;
    return { day: days[i % 5], start: clock(start), end: clock(start + 80 + (p % 2) * 30), course: titles[k], course_code: `${201 + k}-SN1-RE`, section: String(p + 1), room: `${["A", "D", "H", "G"][p % 4]}-${104 + (k + p) % 25}`, instructor: `FirstName ${["Smith", "de la Cruz", "Campeau-Devlin", "Carrier", "Dubois", "Berman", "Turner", "Hughes", "Lim", "Brown"][k]}`, kind: "class" };
  }) }])) };
}

test("frozen released WF4 codes import in every mode and still merge without losing local details", async () => {
  const expected = plain(await api.decode(frozen.codes.J));
  for (const [name, code] of Object.entries(frozen.codes)) {
    assert.deepEqual(plain(await api.decode(code)), expected, name);
    const result = await api.merge(frozen.data, await api.decode(code), () => { throw Error("unexpected conflict"); });
    assert.equal(result.skipped, 3);
    assert.deepEqual(plain(result.data.people), frozen.data.people);
  }
});

test("WF5 retains the measured structure savings and preserves all retained fields", async () => {
  for (const [people, limit] of [[1, 111], [10, 406], [20, 588], [50, 892]]) {
    const data = varied(people), before = plain(data), code = await api.encode(data);
    assert.match(code, /^WF5/);
    assert.ok(code.length <= limit, `${people} schedules: ${code.length} <= ${limit}`);
    const json = Buffer.from(JSON.stringify(api.__test.packCompact(api.__test.pack(data, true), true)));
    assert.deepEqual(plain(await api.decode(code)), plain(await api.decode(api.__test.wrap(json, "J", 4))));
    assert.deepEqual(data, before);
    const merged = await api.merge(data, await api.decode(code), () => { throw Error("unexpected conflict"); });
    assert.equal(merged.skipped, people);
  }
});

test("all structural layouts, dictionary subsets and compression envelopes round-trip", async () => {
  const data = { people: { "名字 📚": { semester: null, classes: [
    { ...entry, day: "Sunday", start: "23:01", end: "23:59", course: "\uFEFFPhysics 名字 📚", room: "A-001", kind: "busy_block" },
    { ...entry, start: "00:00", end: "00:01", course: "\u0000Calculus\u001f", room: "900" },
    { day: "Tuesday", start: "08:17", end: "09:38" }
  ] }, Empty: { classes: [] }, Winter: { semester: "Winter 2000", classes: [] }, Fall: { semester: "Fall 2099", classes: [] } } };
  const payload = api.__test.pack(data, true), expected = full(payload);
  for (const config of api.__test.factor5.configs) for (let dictionary = 0; dictionary < 4; dictionary++) {
    const bytes = api.__test.factor5.encode(payload, config, dictionary);
    assert.deepEqual(plain(api.__test.factor5.decode(bytes)), expected, `${config.name}/${dictionary}`);
    for (const [mode, b] of [["T", bytes], ["U", deflateRawSync(bytes)], ["V", deflateSync(bytes)]]) {
      const decoded = await api.decode(api.__test.wrap(b, mode, 5));
      assert.equal(decoded.share_profile, "compact");
      assert.equal(decoded.people["名字 📚"].classes[0].start, "23:01");
      assert.equal(decoded.people["名字 📚"].classes[1].course, "\u0000Calculus\u001f");
    }
  }
  for (let variant = 0; variant < 3; variant++) for (const timeTable of [false, true]) for (const dictIndex of [1, 2, 3]) {
    const bytes = api.__test.packBinary(payload, variant, true, { dictIndex, timeTable });
    assert.deepEqual(plain(api.__test.unpackBinary(bytes, true, true)), expected);
    for (const [mode, b] of [["B", bytes], ["R", deflateRawSync(bytes)], ["S", deflateSync(bytes)]]) {
      assert.equal((await api.decode(api.__test.wrap(b, mode, 5))).people["名字 📚"].classes[0].end, "23:59");
    }
  }
  for (let variant = 0; variant < 2; variant++) {
    const bytes = api.__test.packBinary(payload, variant, true, { dictIndex: 3, personUnits: true });
    assert.deepEqual(plain(api.__test.unpackBinary(bytes, true, true)), expected);
  }
});

test("every valid minute survives five-minute escapes and independent time tables", () => {
  for (let minute = 0; minute < 1439; minute++) {
    const payload = api.__test.pack({ people: { Boundary: { classes: [{ ...entry, day: days[minute % 7], start: clock(minute), end: clock(minute + 1) }] } } }, true);
    for (const config of api.__test.factor5.configs) assert.deepEqual(plain(api.__test.factor5.decode(api.__test.factor5.encode(payload, config))), full(payload));
    for (let variant = 0; variant < 3; variant++) {
      const bytes = api.__test.packBinary(payload, variant, true, { dictIndex: 3, timeTable: true });
      assert.deepEqual(plain(api.__test.unpackBinary(bytes, true, true)), full(payload));
    }
  }
});

test("expanded dictionary preserves every ID, exact text and literal escapes", () => {
  assert.deepEqual(plain(api.__test.WORDS5.slice(0, 31)), plain(api.__test.WORDS));
  assert.equal(api.__test.WORDS5.length, 152);
  for (const dictionary of api.__test.DICTS5.slice(1)) for (const text of [...api.__test.WORDS5, "precalculus Calculus_extra CALCULUS écalculus", "\uFEFF名字 📚", Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join("")]) assert.equal(dictionary.decode(dictionary.encode(text)), text);
  for (const bytes of [[0], [0, 255], [0, 255, 127], [0, 128, 0], Array(20).fill(13), [255]]) assert.throws(() => api.__test.DICTS5[3].decode(Uint8Array.from(bytes)), /valid schedule/);
});

test("15-bit envelope preserves bytes and has stable single-unit characters", () => {
  for (let n = 1; n <= 1024; n++) {
    const bytes = Uint8Array.from({ length: n }, (_, i) => (n + i * 197) & 255), text = api.__test.base15(bytes);
    assert.equal(text.length, 1 + Math.ceil(n * 8 / 15));
    assert.deepEqual(api.__test.unbase15(text), bytes);
    assert.equal(text.normalize("NFC"), text); assert.equal(text.normalize("NFKC"), text);
  }
  const alphabet = Array.from({ length: 32768 }, (_, i) => api.__test.alphabet15(i)).join("");
  assert.equal(alphabet.length, [...alphabet].length);
  assert.equal(alphabet.normalize("NFC"), alphabet); assert.equal(alphabet.normalize("NFKC"), alphabet);
  assert.ok(!/\s/u.test(alphabet));
});

test("WF5 rejects damaged envelopes, excessive counts, bad indices and trailing data", async () => {
  const payload = api.__test.pack(varied(1), true), bytes = api.__test.factor5.encode(payload, api.__test.factor5.configs[5]);
  const code = api.__test.wrap(bytes, "T", 5);
  await assert.rejects(api.decode(code.slice(0, -1)), /incomplete|changed/);
  await assert.rejects(api.decode(code.slice(0, 20) + "!" + code.slice(21)), /not a valid/);
  for (const raw of [Uint8Array.from([255]), Uint8Array.from([0, 255, 255, 255, 127]), Uint8Array.from([0, 128, 0]), Uint8Array.from([...bytes, 0]), bytes.slice(0, -1)]) await assert.rejects(api.decode(api.__test.wrap(raw, "T", 5)), /valid schedule/);
  for (const header of [192, 64 | 4, 3, 128 | 31]) await assert.rejects(api.decode(api.__test.wrap(Uint8Array.from([header]), "B", 5)), /valid schedule/);
  await assert.rejects(api.decode(api.__test.wrap(deflateRawSync(Buffer.alloc(api.__test.MAX_BYTES + 1, 32)), "U", 5)), /too large/);
});

test("original JSON and binary remain fallbacks for unusual Unicode and unavailable compression", async () => {
  const data = { people: { "Name\ud800": { classes: [{ ...entry, course: "Label\udc00" }] }, Empty: { classes: [] } } };
  const code = await codec(false).encode(data);
  assert.match(code, /^WF5J/);
  assert.equal((await api.decode(code)).people["Name\ud800"].classes[0].course, "Label\udc00");
  class WrappedOnly { constructor(format) { if (format === "deflate-raw") throw Error("unsupported"); return new CompressionStream(format); } }
  const data2 = varied(20), raw = await codec(false).encode(data2), zipped = await codec(WrappedOnly).encode(data2);
  assert.match(raw, /^WF5[JBT]/); assert.match(zipped, /^WF5[ZSV]/);
  assert.deepEqual(plain(await api.decode(raw)), plain(await api.decode(zipped)));
});

test("seeded irregular collections preserve order, weekends and changing class details", async () => {
  let state = 20261008; const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
  for (let k = 0; k < 40; k++) {
    const data = { people: Object.fromEntries(Array.from({ length: 1 + random(7) }, (_, p) => [`Random ${p}`, { classes: Array.from({ length: random(32) }, () => {
      const start = random(1400); return { day: days[random(7)], start: clock(start), end: clock(start + 1 + random(1439 - start)), course: [null, "Calculus", "Unfamiliar 名字", "Physics\0"][random(4)], room: [null, "Gym", "A-001", "d-108"][random(4)], instructor: [null, "John Smith", "Anna de la Cruz"][random(3)], kind: random(5) ? "class" : "busy_block" };
    }) }])) };
    const bytes = Buffer.from(JSON.stringify(api.__test.packCompact(api.__test.pack(data, true), true)));
    assert.deepEqual(plain(await api.decode(await api.encode(data))), plain(await api.decode(api.__test.wrap(bytes, "J", 4))));
  }
});
