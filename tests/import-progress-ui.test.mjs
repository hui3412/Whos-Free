import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Window } from "happy-dom";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const schedule = { classes: [{ day: "Monday", start: "08:15", end: "09:35", course: "Math" }] };

async function app(people = {}) {
  const window = new Window({ url: "https://example.test/Whos-Free/", settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  window.document.write(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"));
  window.setInterval = () => 0;
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.URL.createObjectURL = () => "blob:test";
  window.URL.revokeObjectURL = () => {};
  window.localStorage.setItem("whos-free-local-schedules", JSON.stringify({ data: { schema_version: 1, people }, meta: {} }));
  for (const file of ["schedule-availability.js", "schedule-share-code.js", "app.js"]) window.eval(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  const el = id => window.document.getElementById(id);
  const tick = () => new Promise(resolve => setTimeout(resolve, 30));
  await tick();
  el("scheduleDataButton").click();
  await tick();
  const load = (id, files) => {
    Object.defineProperty(el(id), "files", { value: files, configurable: true });
    el(id).dispatchEvent(new window.Event("change"));
  };
  const overlay = el("importProgressOverlay");
  const background = window.document.querySelector(".app-shell");
  const unlocked = () => {
    assert.equal(overlay.hidden, true);
    assert.equal(background.hasAttribute("inert"), false);
    assert.equal(el("scheduleModal").hasAttribute("inert"), false);
    assert.equal(background.getAttribute("aria-hidden"), null);
  };
  return { window, el, tick, load, overlay, background, unlocked };
}

test("picture import centers live progress, blocks background controls and keyboard dismissal, then opens review", async () => {
  const a = await app();
  const pending = deferred();
  let progress;
  a.window.WhosFreeImageParser = { parseScheduleImage: (_file, options) => { progress = options.onProgress; return pending.promise; } };
  try {
    a.load("scheduleImageInput", [{ name: "timetable.png" }]);
    assert.equal(a.overlay.hidden, false);
    assert.equal(a.overlay.getAttribute("role"), "dialog");
    assert.equal(a.overlay.getAttribute("aria-modal"), "true");
    assert.equal(a.window.document.activeElement, a.overlay);
    assert.equal(a.background.hasAttribute("inert"), true);
    assert.equal(a.el("scheduleModal").getAttribute("aria-hidden"), "true");
    assert.equal(a.window.document.body.style.overflow, "hidden");
    progress("Reading class 1 of 15… 50%");
    assert.equal(a.el("importProgressMessage").textContent, "Reading class 1 of 15… 50%");
    a.el("settingsButton").click();
    a.el("closeScheduleModal").click();
    assert.equal(a.el("settingsModal").hidden, true);
    assert.equal(a.el("scheduleModal").hidden, false);
    for (const key of ["Tab", "Escape"]) {
      const event = new a.window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      a.window.document.dispatchEvent(event);
      assert.ok(event.defaultPrevented);
    }
    a.el("settingsButton").focus();
    assert.equal(a.window.document.activeElement, a.overlay);
    pending.resolve({ name: "Student", person: schedule });
    await a.tick();
    a.unlocked();
    assert.equal(a.el("imageReview").hidden, false);
    assert.equal(a.el("saveImageScheduleButton").disabled, false);
    assert.equal(a.window.document.activeElement, a.el("imageReviewTitle"));
  } finally { a.window.happyDOM.abort(); }
});

test("picture errors dismiss the blocker and restore pre-existing accessibility attributes", async () => {
  const a = await app();
  const pending = deferred();
  a.window.WhosFreeImageParser = { parseScheduleImage: () => pending.promise };
  try {
    const toast = a.el("toast");
    toast.setAttribute("inert", "");
    toast.setAttribute("aria-hidden", "true");
    a.load("scheduleImageInput", [{ name: "bad.png" }]);
    pending.reject(new Error("Picture could not be recognized"));
    await a.tick();
    a.unlocked();
    assert.match(a.el("imageParserStatus").textContent, /could not be recognized/);
    assert.equal(a.el("addScheduleImageButton").disabled, false);
    assert.equal(a.window.document.activeElement, a.el("addScheduleImageButton"));
    assert.equal(toast.hasAttribute("inert"), true);
    assert.equal(toast.getAttribute("aria-hidden"), "true");
  } finally { a.window.happyDOM.abort(); }
});

test("PDF batches update centered file counts, tolerate failures and unlock after the last PDF", async () => {
  const a = await app();
  const first = deferred(), second = deferred();
  a.window.WhosFreeParser = { parseSchedulePdf: file => file.name === "one.pdf" ? first.promise : second.promise };
  try {
    a.load("schedulePdfInput", [{ name: "one.pdf" }, { name: "two.pdf" }]);
    assert.equal(a.overlay.hidden, false);
    assert.match(a.el("importProgressMessage").textContent, /one.pdf \(1 of 2\)/);
    first.resolve({ name: "Student", person: schedule });
    await a.tick();
    assert.match(a.el("importProgressMessage").textContent, /two.pdf \(2 of 2\)/);
    assert.equal(a.background.hasAttribute("inert"), true);
    second.reject(new Error("Unsupported PDF"));
    await a.tick();
    a.unlocked();
    assert.match(a.el("parserStatus").textContent, /1 added.*1 failed/);
    assert.equal(a.el("addSchedulePdfButton").disabled, false);
  } finally { a.window.happyDOM.abort(); }
});

test("JSON imports block during file reading and restore page scrolling after completion", async () => {
  const a = await app();
  const pending = deferred();
  try {
    a.load("scheduleFileInput", [{ name: "schedules.json", text: () => pending.promise }]);
    assert.equal(a.overlay.hidden, false);
    assert.match(a.el("importProgressMessage").textContent, /schedules.json/);
    pending.resolve(JSON.stringify({ people: { Student: schedule } }));
    await a.tick();
    a.unlocked();
    assert.equal(a.el("scheduleModal").hidden, true);
    assert.equal(a.window.document.body.style.overflow, "");
    a.el("settingsButton").click();
    assert.equal(a.el("settingsModal").hidden, false);
  } finally { a.window.happyDOM.abort(); }
});

test("failed JSON reading unlocks the app and keeps the import error visible", async () => {
  const a = await app();
  const pending = deferred();
  try {
    a.load("scheduleFileInput", [{ name: "broken.json", text: () => pending.promise }]);
    pending.reject(new Error("Cannot read file"));
    await a.tick();
    a.unlocked();
    assert.equal(a.el("scheduleModal").hidden, false);
    assert.match(a.el("toast").textContent, /Cannot read file/);
  } finally { a.window.happyDOM.abort(); }
});

test("share-code import releases the blocker for conflict choices and resumes it while saving", async () => {
  const a = await app({ Student: schedule });
  const decoding = deferred(), saving = deferred();
  const original = a.window.WhosFreeShareCode;
  a.window.WhosFreeShareCode = {
    ...original,
    decode: () => decoding.promise,
    merge: async (existing, imported, choose) => {
      const choice = await choose({ existingName: "Student", newName: "Student 2" });
      assert.equal(choice, "old");
      await saving.promise;
      return { data: existing, added: 0, replaced: 0, kept: 1, skipped: 0, renamed: [] };
    },
  };
  try {
    a.el("importCodeButton").click();
    a.el("importCodeInput").value = "test code";
    a.el("decodeCodeButton").click();
    assert.equal(a.overlay.hidden, false);
    decoding.resolve({ people: { Student: schedule } });
    await a.tick();
    a.unlocked();
    assert.equal(a.el("codeConflictPrompt").hidden, false);
    a.el("codeConflictPrompt").querySelector('[data-code-conflict-action="old"]').click();
    assert.equal(a.overlay.hidden, false);
    assert.match(a.el("importProgressMessage").textContent, /Finishing/);
    saving.resolve();
    await a.tick();
    a.unlocked();
    assert.equal(a.el("decodeCodeButton").disabled, false);
  } finally { a.window.happyDOM.abort(); }
});
