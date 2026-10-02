(() => {
  "use strict";
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const FIELDS = ["course", "course_code", "section", "room", "instructor"];
  const MAX_BYTES = 1048576;
  const MAX_CODE = 1800000;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const normalizedName = name => name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  const time = value => {
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return NaN;
    const [h, m] = value.split(":").map(Number);
    return h < 24 && m < 60 ? h * 60 + m : NaN;
  };
  function base32(bytes) {
    const result = [];
    let bits = 0, buffer = 0;
    for (const byte of bytes) {
      buffer = (buffer << 8) | byte; bits += 8;
      while (bits >= 5) { bits -= 5; result.push(ALPHABET[(buffer >>> bits) & 31]); }
      buffer &= (1 << bits) - 1;
    }
    if (bits) result.push(ALPHABET[(buffer << (5 - bits)) & 31]);
    return result.join("");
  }
  function unbase32(text) {
    const result = new Uint8Array(Math.floor(text.length * 5 / 8));
    let bits = 0, buffer = 0, offset = 0;
    for (const character of text) {
      const value = ALPHABET.indexOf(character);
      if (value < 0) throw new Error("The code contains an invalid character. Paste only the export code.");
      buffer = (buffer << 5) | value; bits += 5;
      if (bits >= 8) { bits -= 8; result[offset++] = (buffer >>> bits) & 255; }
      buffer &= (1 << bits) - 1;
    }
    if (buffer || base32(result) !== text) throw new Error("The code is incomplete. Ask your friend to copy the full code again.");
    return result;
  }
  function checksum(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0").toUpperCase();
  }
  async function transform(bytes, Stream) {
    const reader = new Blob([bytes]).stream().pipeThrough(new Stream("gzip")).getReader();
    const chunks = [];
    let length = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > MAX_BYTES) throw new Error("This code is too large. Export fewer schedules at once.");
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally { reader.releaseLock(); }
    const output = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
    return output;
  }
  function validatePayload(payload) {
    if (!payload || payload.v !== 1 || !Array.isArray(payload.p) || !payload.p.length || payload.p.length > 250) throw new Error("This code does not contain a supported schedule collection.");
    const names = new Set();
    let count = 0;
    for (const person of payload.p) {
      if (!person || typeof person.n !== "string" || !person.n.trim() || person.n.length > 200 || !Array.isArray(person.c)) throw new Error("A person in this code is not valid.");
      const name = normalizedName(person.n);
      if (names.has(name)) throw new Error("This code contains repeated person names.");
      names.add(name);
      count += person.c.length;
      if (person.c.length > 500 || count > 10000) throw new Error("This code has too many schedule entries. Export fewer schedules at once.");
      for (const row of person.c) {
        if (!Array.isArray(row) || row.length < 3 || row.length > 9 || !Number.isInteger(row[0]) || !DAYS[row[0]] || !Number.isFinite(time(row[1])) || time(row[2]) <= time(row[1]) || !Number.isFinite(time(row[2]))) throw new Error("A schedule in this code has an invalid day or time.");
        for (const value of row.slice(3, 8)) if (value != null && (typeof value !== "string" || value.length > 200)) throw new Error("A schedule label in this code is not valid.");
        if (row[8] != null && row[8] !== "busy_block") throw new Error("A busy block in this code is not valid.");
      }
    }
  }
  function pack(data) {
    if (!data?.people || typeof data.people !== "object" || Array.isArray(data.people)) throw new Error("Select schedules to export.");
    const payload = { v: 1, p: Object.entries(data.people).map(([name, person]) => ({
      n: name, c: (person.classes || []).map(item => {
        const row = [DAYS.indexOf(item.day), item.start, item.end, ...FIELDS.map(key => item[key] || null), item.kind === "busy_block" ? "busy_block" : null];
        while (row.length > 3 && row[row.length - 1] == null) row.pop();
        return row;
      }),
    })) };
    validatePayload(payload);
    return payload;
  }
  async function encode(data) {
    let bytes = new TextEncoder().encode(JSON.stringify(pack(data)));
    if (bytes.length > MAX_BYTES) throw new Error("This selection is too large. Export fewer schedules at once.");
    let mode = "J";
    if (typeof CompressionStream === "function") {
      try {
        const compressed = await transform(bytes, CompressionStream);
        if (compressed.length < bytes.length) { bytes = compressed; mode = "G"; }
      } catch { /* Plain encoding keeps export available without compression. */ }
    }
    const code = `WF1${mode}${checksum(bytes)}${base32(bytes)}`;
    if (code.length > MAX_CODE) throw new Error("This selection is too large. Export fewer schedules at once.");
    return code;
  }
  async function decode(input) {
    if (typeof input !== "string" || input.length > MAX_CODE) throw new Error("This code is too large. Ask for fewer schedules in one code.");
    const code = input.replace(/\s+/g, "").toUpperCase();
    if (!/^WF1[GJ][0-9A-F]{8}[A-Z2-7]+$/.test(code)) throw new Error("That is not a valid Who’s Free? export code. Paste the full code from your friend.");
    let bytes = unbase32(code.slice(12));
    if (checksum(bytes) !== code.slice(4, 12)) throw new Error("The code is incomplete or changed. Ask your friend to copy it again.");
    if (code[3] === "G") {
      if (typeof DecompressionStream !== "function") throw new Error("Your browser cannot open this compressed code. Update Safari or use a recent Chrome or Firefox.");
      try { bytes = await transform(bytes, DecompressionStream); }
      catch (error) { throw new Error(error.message.includes("too large") ? error.message : "The compressed code could not be opened. Ask for a new export code."); }
    }
    if (bytes.length > MAX_BYTES) throw new Error("This code is too large. Ask for fewer schedules in one code.");
    let payload;
    try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new Error("This code does not contain readable schedule data."); }
    validatePayload(payload);
    const people = Object.create(null);
    for (const person of payload.p) {
      people[person.n] = { source_file: "Shared code", classes: person.c.map(row => ({
        day: DAYS[row[0]], start: row[1], end: row[2],
        ...Object.fromEntries(FIELDS.map((key, index) => [key, row[index + 3] || null])),
        kind: row[8] || "class",
      })) };
    }
    return { schema_version: 1, people };
  }
  function merge(existing, incoming) {
    const people = { ...(existing?.people || {}) };
    const names = new Set(Object.keys(people).map(normalizedName));
    let added = 0, skipped = 0;
    for (const [name, person] of Object.entries(incoming.people)) {
      const normalized = normalizedName(name);
      if (names.has(normalized)) { skipped++; continue; }
      Object.defineProperty(people, name, { value: person, enumerable: true, configurable: true, writable: true });
      names.add(normalized); added++;
    }
    return { data: { ...(existing || {}), schema_version: existing?.schema_version || 1, people }, added, skipped };
  }
  globalThis.WhosFreeShareCode = { encode, decode, merge, __test: { base32, checksum, MAX_BYTES } };
})();
