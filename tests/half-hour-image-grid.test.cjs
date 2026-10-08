const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fixtures = require("./fixtures/half-hour-image-axes.json");

function load(document) {
  const context = vm.createContext({ document, URL, setTimeout, clearTimeout });
  for (const filename of ["schedule-parser.js", "schedule-image-parser.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", filename), "utf8"), context);
  }
  return context;
}
const helpers = load().WhosFreeImageParser.__test;
const clock = minute => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
function word(text, x0, y0, x1, y1) {
  return { text, x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, height: y1 - y0 };
}
function markers() {
  const items = [];
  for (let minute = 480; minute <= 1080; minute += 30) {
    const boundary = 100 + minute - 480;
    if (minute > 480) items.push(word(clock(minute), 50, boundary - 10, 80, boundary - 4));
    if (minute < 1080) items.push(word(clock(minute), 50, boundary + 4, 80, boundary + 10));
  }
  return items;
}

// These fixtures contain only weekday/time labels and their OCR coordinates.
// No screenshot, student name, instructor, or course text is stored here.
for (const fixture of fixtures) {
  test(`real ${fixture.layout} OCR geometry reconstructs an 08:00–18:00 axis`, () => {
    const items = fixture.items.map(values => word(...values));
    const columns = helpers.headersFromItems(items);
    const grid = helpers.timeGrid(items.filter(item => item.x1 <= columns[0].left + 2), Math.max(...columns.map(column => column.header.y1)));
    assert.equal(grid.mode, "half-hour");
    assert.equal(grid.items.length, 40);
    assert.equal(grid.items[0].text, "08:00");
    assert.equal(grid.items.at(-1).text, "18:00");
    for (let row = 0; row < 20; row++) {
      assert.equal(grid.items[row * 2].text, clock(480 + row * 30));
      assert.equal(grid.items[row * 2 + 1].text, clock(510 + row * 30));
      assert.ok(Math.abs(grid.items[row * 2].y0 - (grid.top + row * grid.rowHeight)) < .001);
    }
  });
}

test("duplicate boundary labels represent one shared boundary, not two time phases", () => {
  const grid = helpers.timeGrid(markers(), 94);
  assert.equal(grid.items.length, 40);
  assert.equal(grid.rowHeight, 30);
  assert.equal(grid.top, 100);
  assert.equal(grid.bottom, 700);
  assert.equal(grid.items[1].text, grid.items[2].text);
  assert.equal(grid.items[1].y1, grid.items[2].y0);
});

test("missed early and middle labels plus a stray phone time do not shift classes", () => {
  const source = markers().filter(item => !["08:00", "08:30", "09:00", "12:00", "14:30"].includes(item.text));
  source.push(word("06:30", 50, 750, 80, 756));
  const grid = helpers.timeGrid(source, 94);
  assert.equal(grid.items[0].text, "08:00");
  assert.equal(grid.items.at(-1).text, "18:00");
  assert.equal(grid.rowHeight, 30);
  assert.equal(grid.top, 100);
});

test("an inconsistent or short half-hour axis is rejected rather than guessed", () => {
  assert.throws(() => helpers.timeGrid(markers().slice(0, 7), 94), /enough time labels/);
  const inconsistent = markers().map(item => ({ ...item, cy: item.cy + (item.text.endsWith(":00") ? 25 : -25) }));
  assert.throws(() => helpers.timeGrid(inconsistent, 94), /time labels are unclear/);
});

function pixelCanvas(width, height, pixel) {
  return { width, height, getContext() { return { getImageData(left, top, w, h) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      data.set([...pixel(left + x, top + y), 255], (y * w + x) * 4);
    }
    return { data };
  } }; } };
}

test("missing duplicate OCR labels use independent time-gutter borders, not guessed times", () => {
  const labels = markers().filter((item, index) => index === 0 || index % 2 === 1);
  assert.throws(() => helpers.timeGrid(labels, 94), /shared timetable boundaries/);
  const canvas = pixelCanvas(705, 800, (_x, y) => y >= 100 && y <= 700 && (y - 100) % 30 === 0 ? [210, 210, 210] : [255, 255, 255]);
  const column = { left: 100, right: 200, width: 100 };
  const grid = helpers.timeGrid(labels, 94, { canvas, column });
  assert.equal(grid.boundaryValidated, true);
  assert.equal(grid.top, 100);
  assert.equal(grid.bottom, 700);
  assert.equal(grid.items[0].text, "08:00");
  assert.equal(grid.items.at(-1).text, "18:00");
  assert.equal(grid.rowHeight, 30);
  const missingEarly = helpers.timeGrid(labels.filter(item => item.text >= "09:00"), 94, { canvas, column });
  assert.equal(missingEarly.top, 100);
  assert.equal(missingEarly.items[0].text, "08:00");
});

test("border validation rejects middle-of-row configuration labels and inconsistent clocks", () => {
  const canvas = pixelCanvas(705, 800, (_x, y) => y >= 100 && y <= 700 && (y - 100) % 30 === 0 ? [210, 210, 210] : [255, 255, 255]);
  const column = { left: 100, right: 200, width: 100 };
  const labels = Array.from({ length: 20 }, (_, index) => word(clock(480 + index * 30), 50, 112 + index * 30, 80, 118 + index * 30));
  assert.throws(() => helpers.timeGrid(labels, 94, { canvas, column }), /shared timetable boundaries/);
  const badClocks = markers().filter((_, index) => index % 2 === 1).map((item, index) => ({ ...item, text: clock(480 + index * (index % 2 ? 60 : 30)) }));
  assert.throws(() => helpers.timeGrid(badClocks, 94, { canvas, column }));
  assert.throws(() => helpers.timeGrid(markers().slice(0, 7), 94, { canvas, column }), /enough time labels/);
});

test("retry patch restores original coordinates and cleans up after OCR failures", async () => {
  const patches = [];
  const context = load({ createElement() {
    const patch = { width: 0, height: 0, getContext() { return {
      fillRect() {}, drawImage() {},
      getImageData(_x, _y, width, height) { return { data: new Uint8ClampedArray(width * height * 4).fill(255) }; },
      putImageData() {}
    }; } };
    patches.push(patch);
    return patch;
  } });
  const rectangle = { left: 30, top: 40, width: 50, height: 100, textHeight: 8 };
  const patch = context.WhosFreeImageParser.__test.recognitionPatch({}, rectangle, { contrast: true, removeRules: true });
  assert.equal(patch.canvas.width, 174);
  assert.equal(patch.canvas.height, 324);
  const restored = patch.restore(word("08:00", 12 + 10 * 3, 12 + 20 * 3, 12 + 30 * 3, 12 + 28 * 3));
  assert.equal(restored.x0, 40);
  assert.equal(restored.y0, 60);
  assert.equal(restored.height, 8);
  const worker = { async setParameters() {}, async recognize() { throw new Error("retry failed"); } };
  await assert.rejects(context.WhosFreeImageParser.__test.patchWords(worker, {}, rectangle, 1, {}, {}), /retry failed/);
  assert.equal(patches.at(-1).width, 1);
  assert.equal(patches.at(-1).height, 1);
});

test("full pipeline retries layout, both time-column methods and empty class text", async () => {
  const canvases = [], calls = [], parameters = [];
  let terminated = false;
  const headers = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((text, index) => word(text, 130 + index * 100, 80, 170 + index * 100, 94));
  const context = load({ baseURI: "https://example.test/", createElement(type) {
    if (type === "script") return {};
    const canvas = pixelCanvas(1, 1, (x, y) => {
      const sourceX = x + 15, sourceY = y + 75;
      if (sourceY >= 100 && sourceY <= 700 && (sourceY - 100) % 30 === 0) return [225, 225, 225];
      if (sourceX > 120 && sourceX < 150 && sourceY > 110 && sourceY < 125) return [30, 30, 30];
      return [255, 255, 255];
    });
    const getContext = canvas.getContext;
    canvas.getContext = () => ({ ...getContext(), drawImage() {}, fillRect() {}, putImageData() {} });
    canvases.push(canvas);
    return canvas;
  }, head: { append(script) { queueMicrotask(() => script.onload()); } } });
  const data = items => ({ data: { blocks: [{ paragraphs: [{ lines: [{ words: items.map(item => ({ text: item.text, bbox: { x0: item.x0, x1: item.x1, y0: item.y0, y1: item.y1 }, confidence: 95 })) }] }] }] } });
  context.Tesseract = { async createWorker() { return {
    async setParameters(value) { parameters.push(value); },
    async recognize(canvas, options) {
      calls.push({ canvas, options });
      if (calls.length === 1) return data([]);
      if (calls.length === 2) return data(headers);
      if (calls.length <= 4) return data([]); // Raw gutter and sparse retry miss the axis.
      if (calls.length === 5) {
        const fx = (canvas.width - 24) / 73, fy = (canvas.height - 24) / 906;
        return data(markers().map(item => word(item.text, 12 + (item.x0 - 30) * fx, 12 + (item.y0 - 94) * fy, 12 + (item.x1 - 30) * fx, 12 + (item.y1 - 94) * fy)));
      }
      if (calls.length === 6) return data([]);
      return data([word("Workshop", 20, 20, 60, 35)]);
    },
    async terminate() { terminated = true; }
  }; } };
  const result = await context.WhosFreeImageParser.parseScheduleCanvas({ width: 705, height: 1000 }, "test.png");
  assert.equal(result.person.classes.length, 1);
  assert.equal(result.person.classes[0].start, "08:00");
  assert.equal(result.person.classes[0].end, "08:30");
  assert.equal(parameters[1].tessedit_pageseg_mode, "3");
  assert.equal(parameters[3].tessedit_pageseg_mode, "11");
  assert.equal(parameters[4].tessedit_pageseg_mode, "6");
  assert.equal(parameters[5].tessedit_char_whitelist, "");
  assert.equal(parameters[6].tessedit_pageseg_mode, "11");
  assert.equal(parameters[7].tessedit_pageseg_mode, "6");
  assert.equal(terminated, true);
  assert.ok(canvases.every(canvas => canvas.width === 1 && canvas.height === 1));
});

test("coloured cells keep shared borders and ignore non-grid lines and footer content", () => {
  const canvas = pixelCanvas(705, 300, (_x, y) => {
    if ([40, 85, 100, 160, 220].includes(y)) return [215, 215, 215];
    return y > 40 && y < 160 ? [198, 198, 255] : [238, 238, 238];
  });
  const column = { day: "Monday", left: 100, right: 200, width: 100 };
  const grid = { top: 40, bottom: 160, rowHeight: 30 };
  const regions = helpers.classRegions(canvas, [column], grid);
  assert.equal(regions.length, 2);
  assert.ok(Math.abs(regions[0].y0 - 40) <= 2);
  assert.ok(Math.abs(regions[0].y1 - 100) <= 2);
  assert.ok(Math.abs(regions[1].y1 - 160) <= 2);
});

test("dense text and compression ringing at a row boundary are not class borders", () => {
  const canvas = pixelCanvas(705, 220, (x, y) => {
    if ([40, 100, 160].includes(y)) return [225, 225, 225];
    if (y === 70) return [225, 225, 225];
    if ([68, 72].includes(y)) return x % 10 < 2 ? [30, 30, 30] : [255, 255, 255];
    return [255, 255, 255];
  });
  const borders = helpers.borderRows(canvas, { left: 100, right: 200, width: 100 }, 20, 180);
  assert.ok(!borders.some(y => Math.abs(y - 70) < 3));
  assert.equal(borders.length, 3);
});

test("a dense dark title inside a coloured class cannot split its busy interval", () => {
  const column = { day: "Monday", left: 100, right: 200, width: 100 };
  const canvas = pixelCanvas(705, 250, (x, y) => {
    if ([40, 160, 190, 220].includes(y)) return [215, 215, 215];
    if ([98, 99].includes(y) && x >= 105 && x <= 193) return [30, 30, 30];
    return y > 40 && y < 160 ? [198, 198, 255] : [238, 238, 238];
  });
  const borders = helpers.borderRows(canvas, column, 20, 230);
  assert.ok(!borders.some(y => y > 90 && y < 110), "title contrast must not become a grid line");
  const regions = helpers.classRegions(canvas, [column], { top: 40, bottom: 220, rowHeight: 30 });
  assert.equal(regions.length, 3);
  assert.ok(Math.abs(regions[0].y0 - 40) < 2);
  assert.ok(Math.abs(regions[0].y1 - 160) < 2);
});

test("a compressed tinted stripe within a purple class is not a grey grid line", () => {
  const column = { day: "Monday", left: 100, right: 200, width: 100 };
  const canvas = pixelCanvas(705, 250, (x, y) => {
    if ([40, 160, 190, 220].includes(y)) return [215, 215, 215];
    if (x >= 105 && x <= 193) {
      if (y === 98) return [208, 210, 254];
      if (y === 100) return [193, 196, 240];
      if (y === 102) return [198, 201, 244];
    }
    return y > 40 && y < 160 ? [198, 198, 255] : [238, 238, 238];
  });
  const borders = helpers.borderRows(canvas, column, 20, 230);
  assert.ok(!borders.some(y => y > 90 && y < 110));
  const regions = helpers.classRegions(canvas, [column], { top: 40, bottom: 220, rowHeight: 30 });
  assert.equal(regions.length, 3);
  assert.ok(Math.abs(regions[0].y1 - 160) < 2);
});

test("genuine tinted grid lines that reach the column edges remain detectable", () => {
  const column = { day: "Monday", left: 100, right: 200, width: 100 };
  const canvas = pixelCanvas(705, 220, (_x, y) => [40, 100, 160].includes(y) ? [178, 178, 235] : [198, 198, 255]);
  const borders = helpers.borderRows(canvas, column, 20, 180);
  for (const boundary of [40, 100, 160]) assert.ok(borders.some(y => Math.abs(y - boundary) < 2));
  const regions = helpers.classRegions(canvas, [column], { top: 40, bottom: 160, rowHeight: 30 });
  assert.equal(regions.length, 2);
});

test("a slightly miscentered column needs a border at only one padded edge", () => {
  const column = { day: "Monday", left: 100, right: 200, width: 100 };
  const canvas = pixelCanvas(705, 220, (x, y) => x >= 110 && [40, 100, 160].includes(y) ? [190, 190, 190] : [198, 198, 255]);
  const regions = helpers.classRegions(canvas, [column], { top: 40, bottom: 160, rowHeight: 30 });
  assert.equal(regions.length, 2);
  assert.ok(Math.abs(regions[0].y1 - 100) < 2);
});

test("an intensive class retains its explicit end time beyond the printed row end", () => {
  const cells = [{ rect: { day: "Monday", y0: 40, y1: 220, height: 180 }, lines: ["Test intensive", "999-AAA-ZZ sec.00001", "Classroom A-100", "16:15 to 19:15"] }];
  const classes = helpers.classesFromCells(cells, [{ time: "16:15", y0: 42, y1: 48, center: 45 }], [{ time: "19:05", y0: 212, y1: 218, center: 215 }], 30);
  assert.equal(classes.length, 1);
  assert.equal(classes[0].start, "16:15");
  assert.equal(classes[0].end, "19:15");
});

test("border alignment preserves the existing 15/35-minute timetable format", () => {
  const source = Array.from({ length: 20 }, (_, index) => {
    const minute = 495 + Math.floor(index / 2) * 30 + (index % 2 ? 20 : 0);
    const cy = 40 + (minute - 495) * 1.2;
    return word(clock(minute), 50, cy - 4, 80, cy + 4);
  });
  const grid = helpers.timeGrid(source, 20);
  assert.equal(grid.mode, "paired");
  const canvas = pixelCanvas(705, 420, (_x, y) => [30, 102, 390].includes(y) ? [247, 247, 247] : [255, 255, 255]);
  const rects = helpers.classRegions(canvas, [{ day: "Monday", left: 100, right: 200, width: 100 }], grid);
  assert.equal(rects.length, 2);
  const starts = grid.items.filter((_, index) => index % 2 === 0).map(item => ({ ...item, time: item.text, center: item.cy }));
  const ends = grid.items.filter((_, index) => index % 2 === 1).map(item => ({ ...item, time: item.text, center: item.cy }));
  const classes = helpers.classesFromCells([{ rect: rects[0], lines: ["Workshop"] }], starts, ends, grid.rowHeight);
  assert.equal(classes[0].start, "08:15");
  assert.equal(classes[0].end, "09:05");
});

test("automatic crop excludes surrounding page and rebases coordinates without changing times", () => {
  let draw;
  const context = load({ createElement(type) {
    assert.equal(type, "canvas");
    return { getContext() { return { drawImage(...args) { draw = args; } }; } };
  } });
  const api = context.WhosFreeImageParser.__test;
  const columns = api.headersFromItems(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((text, index) => word(text, 160 + index * 100, 80, 200 + index * 100, 94)));
  const grid = api.timeGrid(markers(), 94);
  const source = { width: 1410, height: 2200 };
  const cropped = api.isolateTimetable(source, columns, grid);
  assert.ok(cropped.canvas.width < source.width);
  assert.ok(cropped.canvas.height < source.height);
  assert.equal(draw[0], source);
  assert.ok(draw[1] > 0 && draw[2] > 0);
  assert.ok(draw[2] + draw[4] < source.height);
  assert.equal(cropped.grid.items.map(item => item.text).join(), grid.items.map(item => item.text).join());
  const factor = source.width / cropped.canvas.width;
  assert.equal(cropped.grid.rowHeight, grid.rowHeight * factor);
  for (const column of cropped.columns) {
    assert.ok(column.left >= 0 && column.right <= 705);
    assert.ok(column.header.y0 >= 0);
  }
  assert.equal(source.width, 1410);
  assert.equal(grid.top, 100);
});

for (const headerRetry of [false, true]) for (const failCell of [false, true]) {
  test(`${headerRetry ? "focused heading retry then " : ""}cropped per-cell OCR resets the gutter whitelist and releases resources on ${failCell ? "failure" : "success"}`, async () => {
    let cropped, terminated = false;
    const headers = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((text, index) => word(text, 160 + index * 100, 80, 200 + index * 100, 94));
    const calls = [], parameters = [];
    const context = load({ baseURI: "https://example.test/", createElement(type) {
      if (type === "script") return {};
      cropped = pixelCanvas(1, 1, (x, y) => {
        // The cropped timetable starts at original y=75, x=15.
        const sourceX = x + 15, sourceY = y + 75;
        if (sourceY >= 100 && sourceY <= 700 && (sourceY - 100) % 30 === 0) return [225, 225, 225];
        if (sourceX > 150 && sourceX < 190 && sourceY > 110 && sourceY < 125) return [30, 30, 30];
        return [255, 255, 255];
      });
      const getContext = cropped.getContext;
      cropped.getContext = () => ({ ...getContext(), drawImage() {} });
      return cropped;
    }, head: { append(script) { queueMicrotask(() => script.onload()); } } });
    const data = items => ({ data: { blocks: [{ paragraphs: [{ lines: [{ words: items.map(item => ({ text: item.text, bbox: { x0: item.x0, x1: item.x1, y0: item.y0, y1: item.y1 }, confidence: 95 })) }] }] }] } });
    context.Tesseract = { async createWorker() { return {
      async setParameters(value) { parameters.push(value); },
      async recognize(canvas, options) {
        calls.push({ canvas, options });
        if (calls.length === 1) return data(headerRetry ? headers.filter((_, i) => i === 0 || i === 4) : headers); // Force the time-column retry.
        if (headerRetry && calls.length === 2) return data(headers.filter((_, i) => i !== 2)); // One internal header remains unreadable.
        if (calls.length === (headerRetry ? 3 : 2)) return data(markers());
        if (failCell) throw new Error("cell OCR failed");
        const { left, top } = options.rectangle;
        const scale = 705 / canvas.width;
        return data([word("Workshop", left + 5, top + 5, left + 35 / scale, top + 10 / scale)]);
      },
      async terminate() { terminated = true; }
    }; } };
    const original = { width: 705, height: 1000 };
    if (failCell) await assert.rejects(context.WhosFreeImageParser.parseScheduleCanvas(original, "test.png"), /cell OCR failed/);
    else {
      const result = await context.WhosFreeImageParser.parseScheduleCanvas(original, "test.png");
      assert.equal(result.person.classes.length, 1);
      assert.equal(result.person.classes[0].start, "08:00");
      assert.equal(result.person.classes[0].end, "08:30");
    }
    const offset = headerRetry ? 1 : 0;
    if (headerRetry) {
      assert.equal(parameters[1].tessedit_pageseg_mode, "7");
      const band = calls[1].options.rectangle;
      assert.ok(band.left > 0 && band.top > 0 && band.width > 0 && band.height > 0);
    }
    assert.equal(parameters[1 + offset].tessedit_char_whitelist, "0123456789:.");
    assert.equal(parameters[2 + offset].tessedit_char_whitelist, "");
    assert.equal(calls[0].canvas, original);
    assert.equal(calls[1].canvas, original);
    assert.equal(calls[2 + offset].canvas, cropped);
    assert.equal(terminated, true);
    assert.equal(cropped.width, 1);
    assert.equal(cropped.height, 1);
    assert.equal(original.width, 705);
  });
}
