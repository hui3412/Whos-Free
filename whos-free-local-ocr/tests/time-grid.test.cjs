const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require("node:path").join(__dirname, "../schedule-parser.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(require("node:path").join(__dirname, "../schedule-image-parser.js"), "utf8"), context);
const { timeGrid, headersFromItems } = context.WhosFreeImageParser.__test;

function markers() {
  return Array.from({ length: 20 }, (_, index) => {
    const minute = 495 + Math.floor(index / 2) * 30 + (index % 2 ? 20 : 0);
    const cy = 40 + (minute - 495) * 1.2;
    return { text: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`, x0: 45, x1: 75, y0: cy - 4, y1: cy + 4, cy, height: 8 };
  });
}

test("missing middle time labels do not shift the timetable", () => {
  const source = markers().filter((_, index) => ![5, 6, 13].includes(index));
  const grid = timeGrid(source, 20);
  assert.equal(grid.items.length, 20);
  assert.equal(grid.items[5].text, "09:35");
  assert.equal(grid.items[6].text, "09:45");
  assert.ok(Math.abs(grid.rowHeight - 36) < 0.01);
});

test("an unreadable time axis fails instead of inventing class times", () => {
  assert.throws(() => timeGrid(markers().slice(0, 3), 20), /enough time labels/);
});

test("French weekday headings map to the five internal weekday names", () => {
  const headers = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"].map((text, index) => ({ text, cx: 150 + index * 114, cy: 20 }));
  assert.equal(headersFromItems(headers).map(column => column.day).join(","), "Monday,Tuesday,Wednesday,Thursday,Friday");
  assert.throws(() => headersFromItems(headers.slice(0, 4)), /five weekday headings/);
});

test("seven-day headings retain Saturday and Sunday", () => {
  const headers = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((text, index) => ({ text, cx: 100 + index * 90, cy: 20 }));
  assert.equal(headersFromItems(headers).at(-2).day, "Saturday");
  assert.equal(headersFromItems(headers).at(-1).day, "Sunday");
});

test("faint grid lines survive detection while text rows are rejected", () => {
  const canvas = { width: 705, height: 160, getContext() { return { getImageData(left, top, width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const gray = [35, 71, 107].includes(y) ? 247 : y === 53 && x % 5 === 0 ? 30 : 255;
      const offset = (y * width + x) * 4;
      data.set([gray, gray, gray, 255], offset);
    }
    return { data };
  } }; } };
  const borders = context.WhosFreeImageParser.__test.borderRows(canvas, { left: 100, right: 200, width: 100 }, 20);
  assert.equal(borders.join(","), "35,71,107");
});

test("wrapped rooms and names and numeric rooms remain complete", () => {
  const parse = context.WhosFreeParser.parseScheduleClassLines;
  const wrapped = parse(["Test course", "201-SN2-RE sec.00006", "Classroom D-", "120B", "Test Teacher", "Classroom"]);
  assert.equal(wrapped.room, "D-120B");
  assert.equal(wrapped.instructor, "Test Teacher");
  const numeric = parse(["Test course", "551-121-MS sec.00004", "Classroom 900", "TBA McGill", "Classroom"]);
  assert.equal(numeric.room, "900");
  const name = parse(["Test course", "602-UF0-MQ sec.00018", "Classroom A-311", "Test Hyphen-", "Name", "Classroom"]);
  assert.equal(name.instructor, "Test Hyphen-Name");
});

test("one-row conflict and athlete labels become busy entries without invented codes", () => {
  const starts = [{ time: "14:15", y0: 104, y1: 112, center: 108 }, { time: "14:45", y0: 144, y1: 152, center: 148 }];
  const ends = [{ time: "14:35", y0: 130, y1: 138, center: 134 }, { time: "15:05", y0: 170, y1: 178, center: 174 }];
  const cells = [{ rect: { day: "Monday", y0: 100, y1: 140, height: 40 }, lines: ["Conflict 1"] }, { rect: { day: "Tuesday", y0: 100, y1: 180, height: 80 }, lines: ["Athletes Student"] }];
  const result = context.WhosFreeImageParser.__test.classesFromCells(cells, starts, ends, 40);
  assert.equal(result.length, 2);
  assert.equal(result[0].kind, "busy_block");
  assert.equal(result[0].start, "14:15");
  assert.equal(result[0].end, "14:35");
  assert.equal(result[0].course_code, null);
  assert.equal(result[1].end, "15:05");
});

test("unfamiliar, unreadable and merged course text retain editable busy times", () => {
  const starts = [{ time: "14:15", y0: 104, y1: 112, center: 108 }];
  const ends = [{ time: "15:05", y0: 170, y1: 178, center: 174 }];
  const cells = [
    { rect: { day: "Monday", y0: 100, y1: 180, height: 80 }, lines: ["Brand new workshop"] },
    { rect: { day: "Tuesday", y0: 100, y1: 180, height: 80 }, lines: [] },
    { rect: { day: "Wednesday", y0: 100, y1: 180, height: 80 }, lines: ["First", "203-SN1-RE", "Second", "201-SN2-RE"] }
  ];
  const result = context.WhosFreeImageParser.__test.classesFromCells(cells, starts, ends, 40);
  assert.equal(result.length, 3);
  for (const item of result) { assert.equal(item.start, "14:15"); assert.equal(item.end, "15:05"); }
  assert.equal(result[0].course, "Brand new workshop");
  assert.match(result[1].review_warning, /unreadable/);
  assert.match(result[2].review_warning, /multiple courses/);
});
