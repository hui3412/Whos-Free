const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(require("node:path").join(__dirname, "../schedule-availability.js"), "utf8"), ctx);
const availability = ctx.WhosFreeAvailability;
const item = (start, end) => ({ start, end });

test("passing gaps remain unavailable; an eleven-minute gap is a real break", () => {
  for (const gap of [0, 5, 10, 11]) {
    const classes = [item("09:00", "10:00"), item(`10:${String(gap).padStart(2, "0")}`, "11:00")];
    assert.equal(availability.isFree(classes, 600), gap > 10);
    assert.equal(availability.realBreaks(classes).length, gap > 10 ? 1 : 0);
    assert.equal(availability.isFree(classes, 660), true, "free exactly when final class ends");
  }
});

test("next real break skips a chain of passing gaps and preserves original class times", () => {
  const classes = [item("08:15", "09:35"), item("09:45", "11:05"), item("11:15", "12:05"), item("12:45", "14:05")];
  const snapshot = JSON.stringify(classes);
  const gap = availability.nextFreePeriod(classes, 510);
  assert.equal(gap.start, 725);
  assert.equal(gap.end, 765);
  assert.equal(gap.afterClasses, false);
  assert.equal(availability.isFree(classes, 580), false);
  assert.equal(availability.isFree(classes, 725), true);
  assert.equal(availability.realBreaks(classes)[0].duration, 40);
  const finish = availability.nextFreePeriod(classes, 780);
  assert.equal(finish.start, 845);
  assert.equal(finish.afterClasses, true);
  assert.equal(JSON.stringify(classes), snapshot);
});

test("overlapping and nested classes do not create phantom breaks; empty days stay free", () => {
  const classes = [item("11:00", "12:00"), item("09:00", "11:30"), item("09:30", "10:00"), item("12:10", "13:00"), item("14:00", "15:00")];
  assert.equal(availability.busyPeriods(classes).length, 2);
  assert.equal(availability.realBreaks(classes)[0].start, 780);
  assert.equal(availability.realBreaks(classes)[0].duration, 60);
  assert.equal(availability.isFree(classes, 725), false);
  assert.equal(availability.isFree(classes, 785), true);
  assert.equal(availability.isFree([], 600), true);
  assert.equal(availability.nextFreePeriod([], 600), null);
});
