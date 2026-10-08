const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fixtures = require("./fixtures/public-omnivox-axes.json");
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../schedule-image-parser.js"), "utf8"), context);
const api = context.WhosFreeImageParser.__test;
const word = (text, x0, y0, x1, y1) => ({ text, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, height: y1 - y0 });
const headings = names => names.map((text, i) => word(text, 130 + i * 100, 20, 150 + i * 100, 30));

// Only public weekday/time labels and OCR geometry are retained, never
// screenshots, student identities, instructor names, or course text.
for (const fixture of fixtures) {
  test(`public ${fixture.layout} preserves the visible time axis`, () => {
    const items = fixture.items.map(values => word(...values));
    const columns = api.headersFromItems(items);
    const grid = api.timeGrid(items.filter(w => w.x1 <= columns[0].left + 2), Math.max(...columns.map(c => c.header.y1)));
    assert.equal(columns.map(c => c.day).join(), "Monday,Tuesday,Wednesday,Thursday,Friday");
    assert.equal(grid.mode, fixture.expected.mode);
    assert.equal(grid.period || 30, fixture.expected.period);
    assert.equal(grid.items.length, fixture.expected.count);
    assert.equal(grid.items[0].text, fixture.expected.first);
    assert.equal(grid.items.at(-1).text, fixture.expected.last);
    if (grid.period === 60) {
      assert.equal(grid.items[2].text, "09:00");
      assert.equal(grid.boundaries.length, 11);
      assert.ok(grid.bottom > grid.items.at(-1).y1);
    }
    if (fixture.layout.includes("technical")) assert.equal(grid.items.at(-2).text, "16:55");
  });
}

test("abbreviated weekdays ignore unrelated French prose", () => {
  const items = headings(["Lun.", "Mar.", "Mer.", "Jeu.", "Ven."]);
  items.unshift(word("mon", 10, 1, 25, 10));
  assert.equal(api.headersFromItems(items)[0].header.cy, 25);
  assert.equal(api.headersFromItems(headings(["Mon.", "Tue.", "Wed.", "Thu.", "Fri."])).length, 5);
});

test("complete date headings center the columns, including small guide images", () => {
  const names = ["Mon.", "Tue.", "Wed.", "Thu.", "Fri."];
  const items = names.flatMap((name, i) => [word(name, 80 + i * 30, 20, 87 + i * 30, 24), word("Jan", 88 + i * 30, 20, 94 + i * 30, 24), word(String(i + 8), 95 + i * 30, 20, 100 + i * 30, 24)]);
  const columns = api.headersFromItems(items);
  assert.equal(columns[0].center, 90);
  assert.equal(columns[0].width, 30);
});

test("only one internal missing heading can be recovered from validated spacing", () => {
  const source = headings(["Mon.", "Tue.", "Wed.", "Thu.", "Fri."]);
  const missing = source.filter((_, i) => i !== 2);
  assert.throws(() => api.headersFromItems(missing), /five weekday/);
  const recovered = api.headersFromItems(missing, { recoverMissing: true });
  assert.equal(recovered[2].day, "Wednesday");
  assert.equal(recovered[2].center, 340);
  for (const source of [missing.slice(1), headings(["Mon.", "Tue.", "Wed.", "Thu."]), missing.map((w, i) => i === 1 ? { ...w, cx: w.cx + 70 } : w)]) {
    assert.throws(() => api.headersFromItems(source, { recoverMissing: true }), /weekday|columns/);
  }
});

test("weekday symbol boxes exclude attached annotation strokes", () => {
  const text = "---Jeu.";
  const symbols = Array.from(text, (text, i) => ({ text, bbox: { x0: i * 10, x1: i * 10 + 8, y0: 20, y1: 28 } }));
  const data = { blocks: [{ paragraphs: [{ lines: [{ words: [{ text, bbox: { x0: 0, x1: 68, y0: 20, y1: 28 }, symbols }] }] }] }] };
  const [item] = api.wordsFromData(data, 1);
  assert.equal(item.text, "Jeu.");
  assert.equal(item.x0, 30);
  assert.equal(item.x1, 68);
});

function hourly() {
  return Array.from({ length: 20 }, (_, i) => {
    const hour = 8 + Math.floor(i / 2), end = i % 2;
    const cy = 60 + Math.floor(i / 2) * 50 + end * 40;
    return word(`${String(hour).padStart(2, "0")}:${end ? "50" : "00"}`, 40, cy - 3, 70, cy + 3);
  });
}
test("missing hourly labels are reconstructed without creating half-hour slots", () => {
  const grid = api.timeGrid(hourly().filter((_, i) => ![5, 6, 13].includes(i)), 20);
  assert.equal(grid.items.length, 20);
  assert.equal(grid.items[5].text, "10:50");
  assert.equal(grid.items[6].text, "11:00");
  assert.equal(grid.rowHeight, 50);
});

test("cropping rebases local hourly boundaries along with the time labels", () => {
  let draw;
  const local = vm.createContext({ document: { createElement() { return { getContext() { return { drawImage(...args) { draw = args; } }; } }; } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../schedule-image-parser.js"), "utf8"), local);
  const helpers = local.WhosFreeImageParser.__test;
  const columns = helpers.headersFromItems(headings(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]));
  const grid = helpers.timeGrid(hourly(), 30);
  const source = { width: 705, height: 1000 };
  const result = helpers.isolateTimetable(source, columns, grid);
  const factor = source.width / result.canvas.width;
  assert.equal(result.grid.boundaries.length, grid.boundaries.length);
  grid.boundaries.forEach((y, i) => assert.ok(Math.abs(result.grid.boundaries[i] - (y - draw[2]) * factor) < 1e-8));
  assert.equal(result.grid.boundaries.at(-1), result.grid.bottom);
});

test("irregular or compact numbered time axes fail instead of inventing busy times", () => {
  assert.throws(() => api.timeGrid(hourly().map((w, i) => ({ ...w, cy: w.cy + (i % 3) * 100 })), 20), /time labels|time grid/);
  const singleLabels = Array.from({ length: 20 }, (_, i) => word(`${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`, 40, 50 + i * 20, 70, 56 + i * 20));
  assert.throws(() => api.timeGrid(singleLabels, 20), /shared timetable boundaries/);
});

function pixels(pixel) {
  return { width: 705, height: 100, getContext() { return { getImageData(left, top, width, height) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([...pixel(left + x, top + y), 255], (y * width + x) * 4);
    return { data };
  } }; } };
}
test("faint gray course text is occupied but borders and coloured empty cells are not", () => {
  const rect = { x0: 100, y0: 10, width: 100, height: 80 };
  assert.equal(api.containsInk(pixels((x, y) => x > 125 && x < 150 && y > 35 && y < 55 ? [120, 120, 120] : [255, 255, 255]), rect), true);
  assert.equal(api.containsInk(pixels(x => x < 105 ? [0, 0, 0] : [238, 238, 238]), rect), false);
  assert.equal(api.containsInk(pixels(() => [198, 198, 255]), rect), false);
});
