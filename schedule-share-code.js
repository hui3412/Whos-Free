(() => {
  "use strict";
  // 14 bits per BMP character. Unified CJK ideographs have no whitespace,
  // surrogate pairs or Unicode normalization changes; messages copy them as text.
  const FIRST = 0x4e00;
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const FIELDS = ["course", "course_code", "section", "room", "instructor"];
  const MAX_BYTES = 1048576;
  const MAX_CODE = 1800000;
  const normalizedName = name => name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  const time = value => {
    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return NaN;
    const [h, m] = value.split(":").map(Number);
    return h < 24 && m < 60 ? h * 60 + m : NaN;
  };
  function base14(bytes) {
    const result = [];
    let bits = 0, buffer = 0;
    for (const byte of bytes) {
      buffer = (buffer << 8) | byte; bits += 8;
      while (bits >= 14) { bits -= 14; result.push(String.fromCharCode(FIRST + ((buffer >>> bits) & 16383))); }
      buffer &= (1 << bits) - 1;
    }
    if (bits) result.push(String.fromCharCode(FIRST + ((buffer << (14 - bits)) & 16383)));
    return String((14 - bits) % 14 / 2) + result.join("");
  }
  function unbase14(text) {
    const padding = Number(text[0]) * 2;
    const length = ((text.length - 1) * 14 - padding) / 8;
    if (!/^[0-6][\u4e00-\u8dff]+$/.test(text) || !Number.isInteger(length) || length < 1 || length > MAX_BYTES + 4) throw new Error("The code is incomplete or contains an invalid character. Paste the full export code.");
    const result = new Uint8Array(length);
    let bits = 0, buffer = 0, offset = 0;
    for (let i = 1; i < text.length; i++) {
      buffer = (buffer << 14) | (text.charCodeAt(i) - FIRST); bits += 14;
      while (bits >= 8) { bits -= 8; const byte = (buffer >>> bits) & 255; if (offset < length) result[offset++] = byte; else if (byte) throw new Error("The code is incomplete or changed."); }
      buffer &= (1 << bits) - 1;
    }
    if (buffer || base14(result) !== text) throw new Error("The code is incomplete. Ask your friend to copy the full code again.");
    return result;
  }
  function checksum(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  async function transform(bytes, Stream, format) {
    const reader = new Blob([bytes]).stream().pipeThrough(new Stream(format)).getReader();
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
      if (person.s != null && (typeof person.s !== "string" || !/^(Winter|Fall) 20\d{2}$/.test(person.s))) throw new Error("A semester label in this code is not valid.");
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
      n: name, ...(person.semester !== undefined ? { s: person.semester } : {}), c: (person.classes || []).map(item => {
        const row = [DAYS.indexOf(item.day), item.start, item.end, ...FIELDS.map(key => item[key] || null), item.kind === "busy_block" ? "busy_block" : null];
        while (row.length > 3 && row[row.length - 1] == null) row.pop();
        return row;
      }),
    })) };
    validatePayload(payload);
    return payload;
  }
  function packCompact(payload) {
    // Numeric times and durations reduce repeated punctuation. Keep every label
    // intact: compression handles repeated courses without a course dictionary.
    return payload.p.map(person => [person.n, person.c.map(row => {
      const compact = [row[0] | (row[8] === "busy_block" ? 8 : 0), time(row[1]), time(row[2]) - time(row[1]), ...row.slice(3, 8)];
      while (compact.length > 3 && compact[compact.length - 1] == null) compact.pop();
      return compact;
    }), ...(person.s !== undefined ? [person.s] : [])]);
  }
  function unpackCompact(compact) {
    const invalid = () => { throw new Error("This code does not contain valid schedule data."); };
    if (!Array.isArray(compact) || !compact.length || compact.length > 250) invalid();
    let count = 0;
    const clock = minute => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const people = compact.map(person => {
      if (!Array.isArray(person) || person.length < 2 || person.length > 3 || !Array.isArray(person[1]) || person[1].length > 500) invalid();
      count += person[1].length; if (count > 10000) invalid();
      return { n: person[0], ...(person.length === 3 ? { s: person[2] } : {}), c: person[1].map(row => {
        if (!Array.isArray(row) || row.length < 3 || row.length > 8) invalid();
        const [day, start, duration] = row;
        if (!Number.isInteger(day) || day < 0 || day > 14 || (day & 7) > 6 || !Number.isInteger(start) || start < 0 || !Number.isInteger(duration) || duration <= 0 || start + duration > 1439) invalid();
        return [day & 7, clock(start), clock(start + duration), ...FIELDS.map((_, i) => row[i + 3] ?? null), day & 8 ? "busy_block" : null];
      }) };
    });
    const payload = { v: 1, p: people };
    validatePayload(payload);
    return payload;
  }
  function wrap(bytes, mode) {
    const checked = new Uint8Array(bytes.length + 4);
    new DataView(checked.buffer).setUint32(0, checksum(bytes), true);
    checked.set(bytes, 4);
    return `WF2${mode}${base14(checked)}`;
  }
  async function encode(data) {
    let bytes = new TextEncoder().encode(JSON.stringify(packCompact(pack(data))));
    if (bytes.length > MAX_BYTES) throw new Error("This selection is too large. Export fewer schedules at once.");
    let mode = "J";
    if (typeof CompressionStream === "function") {
      for (const [format, marker] of [["deflate-raw", "D"], ["deflate", "Z"]]) {
        try {
          const compressed = await transform(bytes, CompressionStream, format);
          if (compressed.length < bytes.length) { bytes = compressed; mode = marker; }
          break;
        } catch { /* Try the older standard format; keep compact text as a fallback. */ }
      }
    }
    const code = wrap(bytes, mode);
    if (code.length > MAX_CODE) throw new Error("This selection is too large. Export fewer schedules at once.");
    return code;
  }
  async function decode(input) {
    if (typeof input !== "string" || input.length > MAX_CODE) throw new Error("This code is too large. Ask for fewer schedules in one code.");
    const code = input.replace(/\s+/g, "");
    if (code.startsWith("WF1")) throw new Error("This is an old export code. Ask your friend to export the schedules again to create a shorter code.");
    if (!/^WF2[JDZ][0-6][\u4e00-\u8dff]+$/.test(code)) throw new Error("That is not a valid Who’s Free? export code. Paste the full code from your friend.");
    const checked = unbase14(code.slice(4));
    if (checked.length < 4) throw new Error("The code is incomplete or changed.");
    let bytes = checked.subarray(4);
    if (checksum(bytes) !== new DataView(checked.buffer).getUint32(0, true)) throw new Error("The code is incomplete or changed. Ask your friend to copy it again.");
    if (code[3] !== "J") {
      if (typeof DecompressionStream !== "function") throw new Error("Your browser cannot open this compressed code. Update Safari or use a recent Chrome or Firefox.");
      try { bytes = await transform(bytes, DecompressionStream, code[3] === "D" ? "deflate-raw" : "deflate"); }
      catch (error) { throw new Error(error.message.includes("too large") ? error.message : "The compressed code could not be opened. Ask for a new export code."); }
    }
    if (bytes.length > MAX_BYTES) throw new Error("This code is too large. Ask for fewer schedules in one code.");
    let compact;
    try { compact = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new Error("This code does not contain readable schedule data."); }
    const payload = unpackCompact(compact);
    const people = Object.create(null);
    for (const person of payload.p) {
      people[person.n] = { source_file: "Shared code", ...(person.s !== undefined ? { semester: person.s } : {}), classes: person.c.map(row => ({
        day: DAYS[row[0]], start: row[1], end: row[2],
        ...Object.fromEntries(FIELDS.map((key, index) => [key, row[index + 3] || null])),
        kind: row[8] || "class",
      })) };
    }
    return { schema_version: 1, people };
  }
  function sameSchedule(a, b) {
    const signature = person => JSON.stringify([
      person.semester ?? null,
      (person.classes || []).map(item => JSON.stringify([
        item.day, item.start, item.end, ...FIELDS.map(key => item[key] || null),
        item.kind === "busy_block" ? "busy_block" : "class"
      ])).sort()
    ]);
    // Class order, source files and local OCR review markers are not timetable content.
    return signature(a) === signature(b);
  }
  function numberedName(name, number) {
    const suffix = ` ${number}`;
    return `${name.trim().slice(0, 120 - suffix.length).trimEnd()}${suffix}`;
  }
  async function merge(existing, incoming, resolveConflict) {
    const people = { ...(existing?.people || {}) };
    const names = new Map(Object.keys(people).map(name => [normalizedName(name), name]));
    const reserved = new Set(Object.keys(incoming.people).map(normalizedName));
    const renamed = [];
    let added = 0, replaced = 0, skipped = 0, kept = 0;
    for (const [name, person] of Object.entries(incoming.people)) {
      const normalized = normalizedName(name), existingName = names.get(normalized);
      let target = name;
      if (existingName !== undefined) {
        if (sameSchedule(people[existingName], person)) { skipped++; continue; }
        let number = 2;
        while (names.has(normalizedName(numberedName(existingName, number))) || reserved.has(normalizedName(numberedName(existingName, number)))) number++;
        const newName = numberedName(existingName, number);
        if (typeof resolveConflict !== "function") throw new Error(`Choose how to import the different schedule for ${existingName}.`);
        const choice = await resolveConflict({ name, existingName, newName, existing: people[existingName], incoming: person });
        if (choice === "old") { kept++; continue; }
        if (choice === "replace") {
          Object.defineProperty(people, existingName, { value: person, enumerable: true, configurable: true, writable: true });
          replaced++; continue;
        }
        if (choice !== "both") throw new Error("Schedule import canceled. Nothing was saved.");
        target = newName;
        renamed.push({ from: name, to: target });
      }
      Object.defineProperty(people, target, { value: person, enumerable: true, configurable: true, writable: true });
      names.set(normalizedName(target), target); added++;
    }
    return { data: { ...(existing || {}), schema_version: existing?.schema_version || 1, people }, added, replaced, skipped, kept, renamed };
  }
  globalThis.WhosFreeShareCode = { encode, decode, merge, __test: { base14, unbase14, wrap, MAX_BYTES, sameSchedule } };
})();
