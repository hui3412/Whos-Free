import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Window } from "happy-dom";

const person = { semester: "Fall 2026", classes: [{ day: "Monday", start: "09:00", end: "10:00", course: "Math" }] };

async function app() {
  const window = new Window({ url: "https://example.test/Whos-Free/", settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  window.document.write(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"));
  const style = window.document.createElement("style");
  style.textContent = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  window.document.head.append(style);
  window.setInterval = () => 0;
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.confirm = () => true;
  window.URL.createObjectURL = () => "blob:test";
  window.URL.revokeObjectURL = () => {};
  Object.assign(window, { TextEncoder, TextDecoder, Blob, CompressionStream, DecompressionStream });
  window.localStorage.setItem("whos-free-local-schedules", JSON.stringify({ data: { schema_version: 1, people: { Alice: person, Bob: { semester: "Fall 2026", classes: [] } } }, meta: {} }));
  window.WhosFreeImageParser = { parseScheduleImage: async () => ({ name: "Cara", person: structuredClone(person) }) };
  const el = id => window.document.getElementById(id);
  const writes = [], dismissals = [];
  let prototype = Object.getPrototypeOf(el("toast"));
  while (!Object.getOwnPropertyDescriptor(prototype, "textContent")) prototype = Object.getPrototypeOf(prototype);
  const textContent = Object.getOwnPropertyDescriptor(prototype, "textContent");
  Object.defineProperty(el("toast"), "textContent", {
    get() { return textContent.get.call(this); },
    set(value) {
      writes.push({ message: value, loading: !el("importProgressOverlay").hidden, inert: this.hasAttribute("inert") });
      textContent.set.call(this, value);
    },
  });
  const setTimeout = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => {
    if (delay === 2600) dismissals.push(callback);
    return setTimeout(callback, delay, ...args);
  };
  for (const file of ["schedule-availability.js", "schedule-share-code.js", "app.js"]) window.eval(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  const tick = () => new Promise(resolve => setTimeout(resolve, 50));
  const stored = () => JSON.parse(window.localStorage.getItem("whos-free-local-schedules"))?.data;
  const input = (id, files) => {
    Object.defineProperty(el(id), "files", { value: files, configurable: true });
    el(id).dispatchEvent(new window.Event("change"));
  };
  const expectToast = message => {
    assert.equal(el("toast").textContent, message);
    assert.equal(el("toast").hidden, false);
    assert.equal(el("toast").getAttribute("role"), "status");
    assert.equal(el("toast").getAttribute("aria-live"), "polite");
    assert.deepEqual(writes.at(-1), { message, loading: false, inert: false });
    assert.ok(Number(window.getComputedStyle(el("toast")).zIndex) > Number(window.getComputedStyle(el("scheduleModal")).zIndex));
    assert.equal(window.getComputedStyle(el("toast")).pointerEvents, "none");
  };
  await tick();
  el("scheduleDataButton").click();
  return { window, el, tick, stored, input, expectToast, writes, dismissals };
}

test("schedule additions, saved edits, replacements and removals show visible descriptive pop-ups", async () => {
  const a = await app();
  try {
    a.input("scheduleImageInput", [{ name: "picture.png" }]); await a.tick();
    a.el("saveImageScheduleButton").click(); await a.tick();
    a.expectToast("Schedule added: Cara");
    assert.equal(a.el("scheduleModal").hidden, false);
    a.window.document.querySelector('[aria-label="Edit Cara"]').click();
    a.el("reviewGrid").querySelector(".review-grid-block").click();
    a.window.document.querySelector('[data-field="end"]').value = "11:00";
    a.el("saveImageScheduleButton").click(); await a.tick();
    a.expectToast("Schedule updated: Cara");
    a.input("scheduleImageInput", [{ name: "picture.png" }]); await a.tick();
    a.el("saveImageScheduleButton").click();
    a.el("duplicatePicturePrompt").querySelector('[data-duplicate-action="replace"]').click(); await a.tick();
    a.expectToast("Schedule replaced: Cara");
    a.window.document.querySelector('[aria-label="Remove Cara"]').click(); await a.tick();
    a.expectToast("Schedule removed: Cara");
    a.el("removeSchedulesButton").click(); await a.tick();
    a.expectToast("All local schedules removed");
    a.el("undoChangesButton").click(); await a.tick();
    assert.match(a.el("toast").textContent, /^Undid:/);
    a.dismissals.at(-1)();
    assert.equal(a.el("toast").hidden, true, "the pop-up dismisses automatically");
  } finally { await a.window.happyDOM.abort(); }
});

test("PDF and JSON summaries appear after loading ends and count only changed schedules", async () => {
  const a = await app();
  try {
    a.window.WhosFreeParser = { parseSchedulePdf: async file => {
      if (file.name === "bad.pdf") throw new Error("Invalid PDF");
      return { name: file.name === "alice.pdf" ? "Alice" : "Cara", person: { semester: "Fall 2026", classes: [] } };
    } };
    a.input("schedulePdfInput", [{ name: "alice.pdf" }, { name: "cara.pdf" }, { name: "bad.pdf" }]); await a.tick();
    a.expectToast("1 schedule added · 1 schedule updated · 1 failed");
    const changes = { people: { Alice: person, Dan: { semester: "Fall 2026", classes: [] } } };
    a.input("scheduleFileInput", [{ name: "schedules.json", text: async () => JSON.stringify(changes) }]); await a.tick();
    a.expectToast("1 schedule added · 1 schedule updated");
    a.input("scheduleFileInput", [{ name: "same.json", text: async () => JSON.stringify(a.stored()) }]); await a.tick();
    a.expectToast("No schedule changes");
    assert.ok(a.writes.every(write => !write.loading && !write.inert));
  } finally { await a.window.happyDOM.abort(); }
});

test("code imports report additions, replacements and unchanged imports above the open code panel", async () => {
  const a = await app();
  try {
    const importCode = async people => {
      a.el("importCodeInput").value = await a.window.WhosFreeShareCode.encode({ people });
      a.el("decodeCodeButton").click(); await a.tick();
    };
    a.el("importCodeButton").click();
    await importCode({ Cara: person });
    a.expectToast("1 schedule added");
    assert.equal(a.el("codeImportPanel").hidden, false);
    // Compact codes omit optional empty fields; reimport the decoded stored form.
    await importCode({ Cara: a.stored().people.Cara });
    a.expectToast("No schedule changes");
    const updated = structuredClone(a.stored().people.Cara);
    updated.classes[0].end = "11:00";
    await importCode({ Cara: updated });
    a.el("codeConflictPrompt").querySelector('[data-code-conflict-action="replace"]').click(); await a.tick();
    a.expectToast("1 schedule updated");
    assert.ok(a.writes.every(write => !write.loading && !write.inert));
  } finally { await a.window.happyDOM.abort(); }
});

test("cancelled and invalid edits do not announce success, and persistence warnings remain visible", async () => {
  const a = await app();
  try {
    const initial = a.writes.length;
    a.el("manualScheduleButton").click();
    a.el("saveImageScheduleButton").click(); await a.tick();
    assert.equal(a.writes.length, initial);
    a.el("cancelImageScheduleButton").click();
    a.window.confirm = () => false;
    a.window.document.querySelector('[aria-label="Remove Alice"]').click(); await a.tick();
    assert.equal(a.writes.length, initial);
    a.window.confirm = () => true;
    a.el("manualScheduleButton").click();
    a.el("imageReviewName").value = "Cara";
    Object.defineProperty(a.window.localStorage, "setItem", { value: () => { throw new Error("Storage blocked"); } });
    a.el("saveImageScheduleButton").click(); await a.tick();
    assert.match(a.el("toast").textContent, /would not allow the app to save a local copy/);
    assert.equal(a.el("toast").hidden, false);
    assert.equal(a.writes.at(-1).loading, false);
  } finally { await a.window.happyDOM.abort(); }
});
