const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const context = vm.createContext({});
for (const file of ["schedule-availability.js", "schedule-groups.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context);
const api = context.WhosFreeGroups;
const plain = value => JSON.parse(JSON.stringify(value));
const item = (start, end, day = "Monday") => ({ day, start, end });
const people = {
  Alice: { classes: [item("08:15", "09:35"), item("09:45", "11:05"), item("12:45", "14:05")] },
  Bob: { classes: [item("09:00", "10:05"), item("10:15", "12:05"), item("15:15", "16:05")] },
};

test("joint availability uses school hours, preserves people at every transition and excludes passing gaps", () => {
  const weekly = api.week({ members: ["Alice", "Bob", "Alice", "Missing"] }, people);
  assert.deepEqual(plain(weekly.members), ["Alice", "Bob"]);
  assert.equal(weekly.start, 495); assert.equal(weekly.end, 1205);
  for (const day of weekly.days) {
    const segments = weekly.availability[day];
    assert.equal(segments[0].start, 495); assert.equal(segments.at(-1).end, 1205);
    segments.forEach((segment, index) => {
      if (index) assert.equal(segment.start, segments[index - 1].end);
      const midpoint = (segment.start + segment.end) / 2;
      const expected = Object.keys(people).filter(name => context.WhosFreeAvailability.isFree(people[name].classes.filter(c => c.day === day), midpoint));
      assert.deepEqual(plain(segment.available), expected);
      assert.equal(segment.available.length + segment.unavailable.length, 2);
    });
  }
  const at = minute => weekly.availability.Monday.find(segment => segment.start <= minute && minute < segment.end);
  assert.ok(at(580).unavailable.includes("Alice"), "9:40 is Alice's passing time");
  assert.deepEqual(plain(at(675).available), ["Alice"]);
  const next = api.nextShared(weekly, "Monday", 580);
  assert.deepEqual(plain(next), { day: "Monday", start: 725, end: 765, daysAhead: 0, now: false });
  assert.equal(api.nextShared(weekly, "Monday", 725).now, true);
});

test("short common overlaps are retained in exact data but removed from the calendar", () => {
  const weekly = api.week({ members: ["A", "B"] }, {
    A: { classes: [item("08:15", "10:00", "Tuesday"), item("10:20", "20:05", "Tuesday")] },
    B: { classes: [item("08:15", "10:15", "Tuesday"), item("10:35", "20:05", "Tuesday")] },
  });
  const brief = weekly.availability.Tuesday.find(segment => segment.start === 615);
  assert.equal(brief.end, 620); assert.equal(brief.available.length, 2);
  const display = api.smooth(weekly.availability.Tuesday);
  assert.ok(display.every(block => block.end - block.start > 10));
  assert.ok(!display.some(block => block.start === 615 && block.end === 620));
  const next = api.nextShared(weekly, "Tuesday", 600);
  assert.equal(next.day, "Wednesday"); assert.equal(next.start, 495);
});

test("ten-minute slivers extend the neighbor with the higher free count in either direction", () => {
  const make = (start, end, count) => ({ start, end, available: Array.from({ length: count }, (_, i) => `Person ${i}`), unavailable: [] });
  for (const [left, right] of [[5, 4], [4, 5]]) {
    const raw = [make(540, 590, left), make(590, 600, 7), make(600, 660, right)];
    const before = JSON.stringify(raw), blocks = api.smooth(raw);
    assert.equal(JSON.stringify(raw), before, "exact availability must not be mutated");
    assert.equal(blocks.length, 2);
    const higher = blocks.find(block => block.available.length === 5);
    assert.equal(higher.start, left === 5 ? 540 : 590);
    assert.equal(higher.end, left === 5 ? 600 : 660);
    assert.equal(higher.exact.length, 2);
    assert.equal(higher.exact.find(part => part.start === 590).available.length, 7);
  }
});

test("equal counts favor the previous block and eleven-minute transitions stay visible", () => {
  const part = (start, end, available) => ({ start, end, available, unavailable: [] });
  const blocks = api.smooth([part(540, 590, ["A"]), part(590, 600, ["A", "B"]), part(600, 660, ["B"])]);
  assert.equal(blocks[0].end, 600); assert.deepEqual(plain(blocks[0].available), ["A"]);
  const longer = api.smooth([part(540, 590, ["A"]), part(590, 601, ["A", "B"]), part(601, 660, ["B"])]);
  assert.equal(longer.length, 3);
});

test("leading, trailing and consecutive short transitions disappear without creating gaps", () => {
  const raw = [[495,500,0], [500,550,2], [550,555,0], [555,565,1], [565,1195,3], [1195,1205,0]].map(([start,end,count]) => ({ start, end, available: Array.from({length:count},(_,i)=>String(i)), unavailable: [] }));
  const blocks = api.smooth(raw);
  assert.equal(blocks[0].start, 495); assert.equal(blocks.at(-1).end, 1205);
  blocks.forEach((block, i) => { assert.ok(block.end - block.start > 10); if(i) assert.equal(block.start, blocks[i-1].end); });
  assert.deepEqual(plain(blocks.flatMap(block => block.exact)), raw);
  assert.deepEqual(plain(api.smooth([])), []);
});

test("school-hour search wraps the week and includes only relevant weekend columns", () => {
  const weekly = api.week({ members: ["Alice"] }, { Alice: { classes: [item("11:00", "12:00", "Saturday")] }, Other: { classes: [item("12:00", "13:00", "Sunday")] } });
  assert.ok(weekly.days.includes("Saturday")); assert.ok(!weekly.days.includes("Sunday"));
  assert.equal(api.nextShared(weekly, "Saturday", 1205).day, "Monday");
  assert.equal(api.nextShared(weekly, "Saturday", 1205).start, 495);
  assert.equal(api.nextShared(weekly, "Sunday", 300).day, "Monday");
  assert.equal(api.nextShared(weekly, "Monday", 300).start, 495);
  const closed = api.week({ members: ["A"] }, { A: { classes: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(day => item("08:15", "20:05", day)) } });
  assert.equal(api.nextShared(closed, "Monday", 500), null);
});

test("empty, out-of-hours and prototype-like members are safe", () => {
  const empty = api.week({ members: ["Missing"] }, {});
  assert.equal(api.nextShared(empty, "Monday", 600), null);
  const people = JSON.parse('{"__proto__":{"classes":[]},"constructor":{"classes":[]}}');
  assert.equal(api.week({ members: ["__proto__", "constructor", "toString"] }, people).members.length, 2);
  const early = api.week({ members: ["A"] }, { A: { classes: [item("05:00", "06:00"), item("21:00", "22:00")] } });
  assert.equal(early.availability.Monday.length, 1);
  assert.deepEqual(plain(early.availability.Monday[0].available), ["A"]);
});

test("same-count blocks with different people stay separate; more free people always means darker", () => {
  const weekly = api.week({ members: ["A", "B"] }, { A: { classes: [item("08:15", "10:00")] }, B: { classes: [item("10:00", "11:00")] } });
  assert.deepEqual(plain(weekly.availability.Monday[0].available), ["B"]);
  assert.deepEqual(plain(weekly.availability.Monday[1].available), ["A"]);
  const brightness = count => api.shade(count, 4).background.match(/\d+/g).map(Number).reduce((a, b) => a + b);
  for (let i = 1; i <= 4; i++) assert.ok(brightness(i) < brightness(i - 1));
  assert.equal(api.shade(4, 4).color, "#fff"); assert.equal(api.shade(0, 4).color, "#000");
});
