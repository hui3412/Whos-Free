(() => {
  "use strict";

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const ALIASES = [["monday", "lundi"], ["tuesday", "mardi"], ["wednesday", "mercredi"], ["thursday", "jeudi"], ["friday", "vendredi"], ["saturday", "samedi"], ["sunday", "dimanche"]];
  const BASE_WIDTH = 705;
  let libraryPromise;

  function loadOcr() {
    if (!libraryPromise) {
      libraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL("assets/ocr/tesseract.min.js", document.baseURI).href;
        script.onload = () => resolve(globalThis.Tesseract);
        script.onerror = () => reject(new Error("Picture recognition could not load. Open the app online once, then try again."));
        document.head.append(script);
      }).catch(error => { libraryPromise = null; throw error; });
    }
    return libraryPromise;
  }

  async function imageCanvas(file) {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height || width * height > 60000000) throw new Error("This picture is too large. Try a cropped screenshot of the timetable.");
      const scale = Math.min(Math.max(1, 2100 / width), 2800 / width, 4000 / height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas;
    } catch (error) {
      throw new Error(`Could not open this picture. Use a JPG, PNG or WebP screenshot. ${error.message}`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function wordsFromData(data, scale) {
    const items = [];
    for (const block of data.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const line of paragraph.lines || []) {
          for (const word of line.words || []) {
            const text = String(word.text || "").trim();
            if (!text) continue;
            const { x0, y0, x1, y1 } = word.bbox;
            items.push({ text, x0: x0 * scale, x1: x1 * scale, y0: y0 * scale, y1: y1 * scale,
              cx: (x0 + x1) * scale / 2, cy: (y0 + y1) * scale / 2, height: (y1 - y0) * scale,
              confidence: word.confidence });
          }
        }
      }
    }
    return items;
  }

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  function headersFromItems(items) {
    const matches = ALIASES.map(aliases => items.filter(item => aliases.includes(item.text.toLowerCase().replace(/[^a-z]/g, ""))).sort((a, b) => a.cy - b.cy)[0]);
    if (matches.slice(0, 5).some(header => !header)) throw new Error("Could not read all five weekday headings. Use a clear, upright screenshot with the entire timetable visible.");
    const headers = matches.filter(Boolean);
    const width = median(headers.slice(1).map((item, index) => item.cx - headers[index].cx));
    if (width < 35 || headers.some(header => Math.abs(header.cy - headers[0].cy) > width / 3)) throw new Error("Could not locate the timetable columns. Crop the picture to the schedule and keep it upright.");
    return matches.flatMap((item, index) => item ? [{ day: DAYS[index], center: item.cx, left: item.cx - width / 2, right: item.cx + width / 2, width, header: item }] : []);
  }

  function normalizedTime(text) {
    const value = String(text).replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/[;.]/g, ":").replace(/\s+/g, "");
    const match = value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
  }

  function fitTimeAxis(points) {
    const slopes = [];
    for (let i = 0; i < points.length; i += 1) for (let j = i + 1; j < points.length; j += 1) {
      const delta = points[j].minute - points[i].minute;
      if (delta >= 60) slopes.push((points[j].cy - points[i].cy) / delta);
    }
    const slope = median(slopes.filter(value => value > 0));
    const intercept = median(points.map(point => point.cy - point.minute * slope));
    return { slope, intercept };
  }

  function halfHourGrid(points, headerBottom) {
    const groups = new Map();
    for (const point of points.filter(point => point.minute % 30 === 0)) {
      if (!groups.has(point.minute)) groups.set(point.minute, []);
      groups.get(point.minute).push(point);
    }
    // Adjacent rows print their shared boundary twice. The midpoint of those
    // two labels locates the boundary, not two separate start/end phases.
    const centers = [...groups].map(([minute, labels]) => ({ minute, cy: labels.reduce((sum, label) => sum + label.cy, 0) / labels.length, labels })).sort((a, b) => a.minute - b.minute);
    const paired = centers.filter(point => point.labels.length >= 2);
    const { slope, intercept } = fitTimeAxis(paired.length >= 8 ? paired : centers);
    const valid = centers.filter(point => Math.abs(point.cy - (intercept + point.minute * slope)) < slope * 9);
    if (!Number.isFinite(slope) || valid.length < 8 || valid.length < centers.length * .65) throw new Error("The time labels are unclear. Try an upright screenshot with the full time column.");
    const observedFirst = Math.min(...valid.map(point => point.minute));
    const last = Math.max(...valid.map(point => point.minute));
    // If OCR misses early labels, the aligned weekday header identifies the
    // first row of the already validated axis. Never extrapolate a long gap.
    const headerMinute = Math.round((headerBottom - intercept) / slope / 30) * 30;
    const first = headerMinute <= observedFirst && observedFirst - headerMinute <= 120 && Math.abs(intercept + headerMinute * slope - headerBottom) <= slope * 10 ? headerMinute : observedFirst;
    const labels = valid.flatMap(point => point.labels);
    const height = median(labels.map(point => point.height));
    const x0 = Math.min(...labels.map(point => point.x0)), x1 = Math.max(...labels.map(point => point.x1));
    const items = [];
    const clock = minute => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    for (let minute = first; minute < last; minute += 30) {
      const top = intercept + minute * slope, bottom = top + slope * 30;
      items.push({ text: clock(minute), x0, x1, cx: (x0 + x1) / 2, y0: top, y1: top + height, cy: top + height / 2, height });
      items.push({ text: clock(minute + 30), x0, x1, cx: (x0 + x1) / 2, y0: bottom - height, y1: bottom, cy: bottom - height / 2, height });
    }
    return { items, rowHeight: slope * 30, top: intercept + first * slope, bottom: intercept + last * slope, mode: "half-hour" };
  }

  function timeGrid(items, headerBottom) {
    const markers = items.map(item => ({ ...item, time: normalizedTime(item.text) })).filter(item => item.time && item.y0 > headerBottom);
    markers.sort((a, b) => a.cy - b.cy);
    const points = markers.map(item => ({ ...item, minute: Number(item.time.slice(0, 2)) * 60 + Number(item.time.slice(3)) }));
    if (points.length < 8) throw new Error("Could not read enough time labels. Include the time column on the left in a sharper screenshot.");
    if (points.filter(point => point.minute % 30 === 0).length >= points.length * .75) return halfHourGrid(points, headerBottom);
    // Fit the printed time axis robustly so a missed OCR label cannot shift
    // every subsequent class by a row. Reject inconsistent axes instead.
    const { slope, intercept } = fitTimeAxis(points);
    const valid = points.filter(point => Math.abs(point.cy - (intercept + point.minute * slope)) < slope * 5);
    if (!Number.isFinite(slope) || valid.length < 8 || valid.length < points.length * 0.65) throw new Error("The time labels are unclear. Try an upright screenshot with the full time column.");
    const residues = new Map();
    for (const point of valid) residues.set(point.minute % 30, (residues.get(point.minute % 30) || 0) + 1);
    const phases = [...residues].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([phase]) => phase);
    if (phases.length !== 2) throw new Error("Could not identify the timetable start and end labels.");
    const startPhase = phases.find(phase => phases.includes((phase + 20) % 30));
    if (startPhase === undefined) throw new Error("This timetable uses an unsupported time grid. Please import its original PDF.");
    const first = Math.min(...valid.map(point => point.minute));
    const last = Math.max(...valid.map(point => point.minute));
    const firstStart = first - ((first - startPhase + 30) % 30);
    const height = median(valid.map(point => point.height));
    const x0 = Math.min(...valid.map(point => point.x0));
    const x1 = Math.max(...valid.map(point => point.x1));
    const result = [];
    for (let minute = firstStart; minute <= last; minute += 30) {
      for (const offset of [0, 20]) {
        const total = minute + offset;
        const observed = valid.find(point => point.minute === total);
        const cy = observed?.cy ?? intercept + total * slope;
        result.push({ text: `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`, x0, x1,
          cx: (x0 + x1) / 2, cy, y0: cy - height / 2, y1: cy + height / 2, height });
      }
    }
    const top = result[0].y0 - slope * 5;
    return { items: result, rowHeight: slope * 30, top, bottom: top + result.length / 2 * slope * 30, mode: "paired" };
  }

  function borderRows(canvas, column, minimumY, maximumY = canvas.height * BASE_WIDTH / canvas.width) {
    const scale = canvas.width / BASE_WIDTH;
    const left = Math.max(0, Math.round((column.left + column.width * 0.03) * scale));
    const right = Math.min(canvas.width, Math.round((column.right - column.width * 0.03) * scale));
    const width = right - left;
    const { data } = canvas.getContext("2d").getImageData(left, 0, width, canvas.height);
    const hits = [];
    const offsetY = Math.max(2, Math.ceil(scale * 1.3));
    for (let y = Math.max(offsetY, Math.floor(minimumY * scale)); y < Math.min(canvas.height - offsetY, Math.ceil(maximumY * scale) + offsetY); y += 1) {
      let matches = 0;
      const shades = [];
      const aboveShades = [], belowShades = [];
      for (let x = 0; x < width; x += 2) {
        const offset = (y * width + x) * 4;
        const red = data[offset], green = data[offset + 1], blue = data[offset + 2];
        const gray = (red + green + blue) / 3;
        shades.push(gray);
        if (gray < 90 || gray > 248) continue;
        const above = ((y - offsetY) * width + x) * 4;
        const below = ((y + offsetY) * width + x) * 4;
        const aboveGray = (data[above] + data[above + 1] + data[above + 2]) / 3;
        const belowGray = (data[below] + data[below + 1] + data[below + 2]) / 3;
        aboveShades.push(aboveGray); belowShades.push(belowGray);
        const neighbor = Math.max(aboveGray, belowGray);
        const transition = Math.max(Math.abs(data[above] - data[below]), Math.abs(data[above + 1] - data[below + 1]), Math.abs(data[above + 2] - data[below + 2]));
        if (neighbor - gray > 3 || transition > 18) matches += 1;
      }
      if (matches / Math.ceil(width / 2) >= 0.72) {
        shades.sort((a, b) => a - b);
        aboveShades.sort((a, b) => a - b); belowShades.sort((a, b) => a - b);
        // A border has nearly uniform brightness. Dense text and JPEG ringing
        // can cover most of a row too, but have a much wider brightness range.
        const uniform = values => values[Math.floor(values.length * .9)] - values[Math.floor(values.length * .1)] < 24;
        if (uniform(shades) && uniform(aboveShades) && uniform(belowShades)) hits.push(y / scale);
      }
    }
    const groups = [];
    for (const y of hits) {
      const group = groups[groups.length - 1];
      if (group && y - group[group.length - 1] < 2) group.push(y);
      else groups.push([y]);
    }
    return groups.map(group => (group[0] + group[group.length - 1]) / 2);
  }

  function classRegions(canvas, columns, grid) {
    const rects = [];
    for (const column of columns) {
      const detected = borderRows(canvas, column, grid.top - grid.rowHeight * 0.25, grid.bottom + grid.rowHeight * .15);
      // A dense line of course text can resemble a border. Only keep lines
      // aligned with the validated row lattice, merging nearby JPEG edges.
      const aligned = new Map();
      for (const y of detected) {
        const row = Math.round((y - grid.top) / grid.rowHeight);
        const expected = grid.top + row * grid.rowHeight;
        if (row < 0 || expected > grid.bottom + 1 || Math.abs(y - expected) > Math.max(2, grid.rowHeight * .12)) continue;
        if (!aligned.has(row) || Math.abs(y - expected) < Math.abs(aligned.get(row) - expected)) aligned.set(row, y);
      }
      const boundaries = [...aligned.values()].sort((a, b) => a - b);
      if (boundaries.length < 3) throw new Error(`Could not locate the class borders for ${column.day}. Use a screenshot with visible grid lines.`);
      for (let index = 0; index < boundaries.length - 1; index += 1) {
        const y0 = boundaries[index], y1 = boundaries[index + 1];
        if (y1 - y0 < grid.rowHeight * 0.65) continue;
        rects.push({ x0: column.left, x1: column.right, y0, y1, width: column.width, height: y1 - y0, day: column.day });
      }
    }
    return rects;
  }

  function isolateTimetable(canvas, columns, grid) {
    const scale = BASE_WIDTH / canvas.width;
    const left = Math.max(0, Math.floor((grid.items[0].x0 - columns[0].width * .35) / scale));
    const right = Math.min(canvas.width, Math.ceil(columns.at(-1).right / scale));
    const top = Math.max(0, Math.floor((Math.min(...columns.map(column => column.header.y0)) - 5) / scale));
    const bottom = Math.min(canvas.height, Math.ceil((grid.bottom + grid.rowHeight * .15) / scale));
    const cropped = document.createElement("canvas");
    cropped.width = right - left;
    cropped.height = bottom - top;
    cropped.getContext("2d", { willReadFrequently: true }).drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    const factor = canvas.width / cropped.width;
    const x = value => (value - left * scale) * factor;
    const y = value => (value - top * scale) * factor;
    const box = item => ({ ...item, x0: x(item.x0), x1: x(item.x1), y0: y(item.y0), y1: y(item.y1), cx: x(item.cx), cy: y(item.cy), height: item.height * factor });
    return { canvas: cropped,
      columns: columns.map(column => ({ ...column, left: x(column.left), right: x(column.right), center: x(column.center), width: column.width * factor, header: box(column.header) })),
      grid: { ...grid, items: grid.items.map(box), rowHeight: grid.rowHeight * factor, top: y(grid.top), bottom: y(grid.bottom) },
    };
  }

  function containsInk(canvas, rectangle) {
    const scale = canvas.width / BASE_WIDTH;
    const left = Math.max(0, Math.ceil((rectangle.x0 + 2) * scale));
    const top = Math.max(0, Math.ceil((rectangle.y0 + 2) * scale));
    const width = Math.min(canvas.width - left, Math.floor((rectangle.width - 4) * scale));
    const height = Math.min(canvas.height - top, Math.floor((rectangle.height - 4) * scale));
    if (width < 1 || height < 1) return false;
    const { data } = canvas.getContext("2d").getImageData(left, top, width, height);
    let ink = 0;
    for (let offset = 0; offset < data.length; offset += 16) {
      const r = data[offset], g = data[offset + 1], b = data[offset + 2];
      if (Math.min(r, g, b) < 95 && (r + g + b) / 3 < 160) ink += 1;
    }
    return ink > Math.max(12, width * height * 0.0003);
  }

  async function parseScheduleCanvas(canvas, filename, options = {}) {
    const status = options.onProgress || (() => {});
    status("Loading picture recognition on this device…");
    const Tesseract = await loadOcr();
    const base = new URL("assets/ocr/", document.baseURI);
    let worker;
    let croppedCanvas;
    let stage = "Reading the timetable";
    let bootTimer;
    let bootFailed = false;
    try {
      let rejectBoot;
      const bootFailure = new Promise((_, reject) => { rejectBoot = reject; });
      bootTimer = setTimeout(() => rejectBoot(new Error("Picture recognition took too long to start. Open the app online and try again.")), 120000);
      const creation = Tesseract.createWorker("eng+fra", 1, {
        workerPath: new URL("worker.min.js", base).href,
        corePath: new URL("core/", base).href,
        langPath: new URL("lang/", base).href.replace(/\/$/, ""),
        workerBlobURL: false,
        errorHandler: error => rejectBoot(new Error(`Picture recognition could not start. Open the app online and try again. ${String(error)}`)),
        logger: message => { if (message.status === "recognizing text") status(`${stage}… ${Math.round(message.progress * 100)}%`); },
      });
      creation.then(value => { if (bootFailed) value.terminate(); }, () => {});
      worker = await Promise.race([creation, bootFailure]);
      clearTimeout(bootTimer);
      await worker.setParameters({ tessedit_pageseg_mode: "11", user_defined_dpi: "300" });
      let scale = BASE_WIDTH / canvas.width;
      const full = await worker.recognize(canvas, {}, { blocks: true, text: true });
      const fullItems = wordsFromData(full.data, scale);
      let columns = headersFromItems(fullItems);
      const headerBottom = Math.max(...columns.map(column => column.header.y1));
      stage = "Reading the time column";
      let grid;
      try {
        grid = timeGrid(fullItems.filter(item => item.x1 <= columns[0].left + 2), headerBottom);
      } catch {
        // Leave enough room for the final digit: header text can be off-center.
        await worker.setParameters({ tessedit_pageseg_mode: "6", tessedit_char_whitelist: "0123456789:." });
        const gutter = await worker.recognize(canvas, { rectangle: { left: 0, top: Math.max(0, Math.floor(headerBottom / scale)), width: Math.floor((columns[0].left + 3) / scale), height: canvas.height - Math.floor(headerBottom / scale) } }, { blocks: true });
        grid = timeGrid(wordsFromData(gutter.data, scale).filter(item => item.x1 <= columns[0].left + 3), headerBottom);
      }
      status("Isolating the timetable from the rest of the picture…");
      const isolated = isolateTimetable(canvas, columns, grid);
      canvas = croppedCanvas = isolated.canvas;
      columns = isolated.columns;
      grid = isolated.grid;
      scale = BASE_WIDTH / canvas.width;
      const rects = classRegions(canvas, columns, grid).filter(rect => containsInk(canvas, rect));
      const items = [...columns.map(column => ({ ...column.header, text: column.day })), ...grid.items];
      const recognizedCells = [];
      await worker.setParameters({ tessedit_pageseg_mode: "6", tessedit_char_whitelist: "" });
      let recognized = 0;
      for (const rect of rects) {
        stage = `Reading class ${++recognized} of ${rects.length}`;
        const left = Math.max(0, Math.ceil((rect.x0 + 1.5) / scale));
        const top = Math.max(0, Math.ceil((rect.y0 + 1.5) / scale));
        const right = Math.min(canvas.width, Math.floor((rect.x1 - 1.5) / scale));
        const bottom = Math.min(canvas.height, Math.floor((rect.y1 - 1.5) / scale));
        const result = await worker.recognize(canvas, { rectangle: { left, top, width: right - left, height: bottom - top } }, { blocks: true, text: true });
        const words = wordsFromData(result.data, scale);
        // Merge each line within one cell so spaced course codes and section
        // labels remain together without ever joining neighboring columns.
        const groups = [];
        for (const word of words.sort((a, b) => a.cy - b.cy || a.x0 - b.x0)) {
          const group = groups.find(value => Math.abs(value.cy - word.cy) < Math.max(2.7, word.height * 0.35));
          if (group) { group.words.push(word); group.cy = group.words.reduce((sum, value) => sum + value.cy, 0) / group.words.length; }
          else groups.push({ cy: word.cy, words: [word] });
        }
        for (const group of groups) {
          const row = group.words.sort((a, b) => a.x0 - b.x0);
          const text = row.map(word => word.text).join(" ")
            .replace(/\b([A-Z0-9]{3})\s*-\s*([A-Z0-9]{3})\s*-\s*([A-Z0-9]{2})\b/gi, "$1-$2-$3")
            // OCR frequently reads the letter I in room I-216 as 1 or |.
            // Only correct it after an explicit room label, never in names.
            .replace(/\b(Classroom|Local|Classe|Salle(?: de classe)?)\s+([1|])\s*-\s*(\d{2,4})\b/gi, "$1 I-$3");
          const x0 = Math.min(...row.map(word => word.x0)), x1 = Math.max(...row.map(word => word.x1));
          const y0 = Math.min(...row.map(word => word.y0)), y1 = Math.max(...row.map(word => word.y1));
          items.push({ text, x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: group.cy, height: y1 - y0 });
        }
        const lines = globalThis.WhosFreeParser.groupScheduleLines(items.filter(item => item.cx >= rect.x0 && item.cx <= rect.x1 && item.cy > rect.y0 && item.cy < rect.y1), 2.8);
        recognizedCells.push({ rect, lines, words });
      }
      const starts = grid.items.filter((_, index) => index % 2 === 0).map(item => ({ time: item.text, y0: item.y0, y1: item.y1, center: item.cy }));
      const ends = grid.items.filter((_, index) => index % 2 === 1).map(item => ({ time: item.text, y0: item.y0, y1: item.y1, center: item.cy }));
      const classes = classesFromCells(recognizedCells, starts, ends, grid.rowHeight);
      if (!classes.length) throw new Error("No classes could be read. Use a sharper screenshot showing the entire timetable.");
      const name = globalThis.WhosFreeParser.extractScheduleName(fullItems) || "";
      return { name, person: { source_file: filename, classes }, needsReview: true };
    } finally {
      bootFailed = true;
      clearTimeout(bootTimer);
      await worker?.terminate();
      if (croppedCanvas) croppedCanvas.width = croppedCanvas.height = 1;
    }
  }

  function classesFromCells(cells, starts, ends, rowHeight) {
    const classes = [];
    for (const { rect, lines, words } of cells) {
      const codes = lines.join(" ").match(/\b[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{2}\b/gi) || [];
      const warnings = [];
      if (codes.length > 1) warnings.push("Check this busy span: multiple courses were detected. Split it if needed.");
      if (!lines.length) warnings.push("Text unreadable: check these busy times.");
      const scores = (words || []).filter(word => Number.isFinite(word.confidence) && word.confidence >= 0 && word.confidence <= 100);
      const weight = scores.reduce((sum, word) => sum + Math.max(1, String(word.text || "").length), 0);
      const confidence = weight ? scores.reduce((sum, word) => sum + word.confidence * Math.max(1, String(word.text || "").length), 0) / weight : null;
      // OCR confidence is a text-reading signal, not a probability that the
      // schedule is correct. Missing scores never imply reliable recognition.
      if (confidence !== null && (confidence < 70 || scores.some(word => String(word.text || "").length >= 3 && word.confidence < 45))) {
        warnings.push("Text recognition is uncertain. Check the wording and busy times against the picture.");
      } else if (words?.length && scores.length !== words.length) {
        warnings.push("Some text confidence is unavailable. Check this block against the picture.");
      }
      const warning = warnings.join(" ");
      const parsed = globalThis.WhosFreeParser.parseScheduleClassLines(lines);
      const label = lines.join(" ").trim();
      const busy = /^(?:athletes?\s+(?:student|etudiant)|confli(?:ct|t)\s*\d*)$/i.test(label.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      // Occupancy follows the cell geometry, never a known course name/code.
      let times = (codes.length <= 1 && parsed.explicitTime) || globalThis.WhosFreeParser.scheduleTimesFromRectangle(rect, starts, ends, rowHeight);
      delete parsed.explicitTime;
      if (busy || !parsed.course_code) parsed.course = label || "Busy block";
      if (times.end <= times.start) continue;
      classes.push({ day: rect.day, ...times, ...parsed, kind: busy || !parsed.course_code ? "busy_block" : "class", ...(confidence !== null ? { recognition_confidence: Math.round(confidence * 10) / 10 } : {}), ...(warning ? { review_warning: warning } : {}) });
    }
    classes.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.start.localeCompare(b.start));
    return classes;
  }

  async function parseScheduleImage(file, options = {}) {
    if (!(file instanceof Blob)) throw new Error("Choose a schedule picture.");
    const canvas = await imageCanvas(file);
    try { return await parseScheduleCanvas(canvas, file.name || "schedule.png", options); }
    finally { canvas.width = canvas.height = 1; }
  }

  globalThis.WhosFreeImageParser = { parseScheduleImage, parseScheduleCanvas, __test: { timeGrid, borderRows, headersFromItems, classesFromCells, classRegions, containsInk, isolateTimetable } };
})();

