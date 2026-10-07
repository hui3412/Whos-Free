import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Window } from "happy-dom";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const result = { name: "Detected name", person: { semester: "Fall 2026", classes: [{ day: "Monday", start: "09:00", end: "10:00", course: "Math" }] } };

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
  for (const file of ["schedule-availability.js", "schedule-share-code.js", "app.js"]) window.eval(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  const el = id => window.document.getElementById(id);
  const tick = () => new Promise(resolve => setTimeout(resolve, 40));
  const load = (id, files) => {
    Object.defineProperty(el(id), "files", { value: files, configurable: true });
    el(id).dispatchEvent(new window.Event("change"));
  };
  const upload = () => {
    const recognition = deferred();
    window.WhosFreeImageParser = { parseScheduleImage: () => recognition.promise };
    load("scheduleImageInput", [{ name: "picture.png" }]);
    return recognition;
  };
  const type = value => {
    el("importPictureName").value = value;
    el("importPictureName").dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  const submit = () => el("importPictureNameForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const locked = () => {
    assert.equal(el("importProgressOverlay").hidden, false);
    assert.equal(el("scheduleModal").hasAttribute("inert"), true);
    assert.equal(el("imageReview").hidden, true);
    assert.equal(el("saveImageScheduleButton").disabled, true);
  };
  await tick();
  el("scheduleDataButton").click();
  return { window, el, tick, load, upload, type, submit, locked };
}

test("recognition waits without moving focus or the caret, then carries the completed name into review and saving", async () => {
  const a = await app();
  try {
    const recognition = a.upload();
    assert.equal(a.el("importPictureNameForm").hidden, false);
    a.el("importPictureName").focus();
    a.type("Anne");
    a.el("importPictureName").setSelectionRange(2, 2);
    recognition.resolve(structuredClone(result)); await a.tick();
    a.locked();
    assert.equal(a.window.document.activeElement.id, "importPictureName");
    assert.equal(a.el("importPictureName").value, "Anne");
    assert.equal(a.el("importPictureName").selectionStart, 2);
    assert.equal(a.el("finishImportPictureName").textContent, "Continue");
    assert.equal(a.el("importProgressOverlay").querySelector(".import-progress-spinner").hidden, true);
    a.type("Anne-Marie Lévesque");
    await a.tick(); a.locked();
    a.el("finishImportPictureName").click(); await a.tick();
    assert.equal(a.el("importProgressOverlay").hidden, true);
    assert.equal(a.el("imageReviewName").value, "Anne-Marie Lévesque");
    assert.equal(a.el("imageReview").hidden, false);
    assert.equal(a.el("saveImageScheduleButton").disabled, false);
    a.el("saveImageScheduleButton").click(); await a.tick();
    const stored = JSON.parse(a.window.localStorage.getItem("whos-free-local-schedules"));
    assert.ok(stored.data.people["Anne-Marie Lévesque"]);
    assert.equal(stored.data.people["Detected name"], undefined);
  } finally { await a.window.happyDOM.abort(); }
});

test("finishing the name early opens review automatically, but resumed typing makes recognition wait again", async () => {
  const a = await app();
  try {
    let recognition = a.upload();
    a.el("importPictureName").focus(); a.type("Early name");
    a.submit();
    a.locked();
    assert.equal(a.el("finishImportPictureName").disabled, true);
    recognition.resolve(structuredClone(result)); await a.tick();
    assert.equal(a.el("importProgressOverlay").hidden, true);
    assert.equal(a.el("imageReviewName").value, "Early name");
    a.el("cancelImageScheduleButton").click();
    recognition = a.upload();
    assert.equal(a.el("importPictureName").value, "");
    a.el("importPictureName").focus(); a.type("New"); a.submit();
    a.el("importPictureName").focus(); a.type("New name");
    recognition.resolve(structuredClone(result)); await a.tick();
    a.locked();
    a.submit(); await a.tick();
    assert.equal(a.el("imageReviewName").value, "New name");
  } finally { await a.window.happyDOM.abort(); }
});

test("an untouched field preserves automatic review and the detected name, while an explicitly cleared name stays blank", async () => {
  const a = await app();
  try {
    let recognition = a.upload();
    recognition.resolve(structuredClone(result)); await a.tick();
    assert.equal(a.el("importProgressOverlay").hidden, true);
    assert.equal(a.el("imageReviewName").value, result.name);
    a.el("cancelImageScheduleButton").click();
    recognition = a.upload();
    a.el("importPictureName").focus(); a.type("Temporary"); a.type("");
    recognition.resolve(structuredClone(result)); await a.tick();
    a.locked(); a.submit(); await a.tick();
    assert.equal(a.el("imageReviewName").value, "");
    a.el("saveImageScheduleButton").click();
    assert.match(a.el("imageReviewError").textContent, /person's name/);
  } finally { await a.window.happyDOM.abort(); }
});

test("IME composition is not submitted midway when recognition completes", async () => {
  const a = await app();
  try {
    const recognition = a.upload();
    a.el("importPictureName").focus();
    a.el("importPictureName").dispatchEvent(new a.window.Event("compositionstart"));
    a.type("山");
    recognition.resolve(structuredClone(result)); await a.tick();
    a.submit(); await a.tick(); a.locked();
    a.el("importPictureName").dispatchEvent(new a.window.Event("compositionend"));
    a.type("山田 花子"); a.submit(); await a.tick();
    assert.equal(a.el("imageReviewName").value, "山田 花子");
    assert.equal(a.el("importProgressOverlay").hidden, true);
  } finally { await a.window.happyDOM.abort(); }
});

test("keyboard focus stays in the naming controls, and background clicks and Escape cannot dismiss them", async () => {
  const a = await app();
  try {
    const recognition = a.upload();
    const tab = shiftKey => a.window.document.dispatchEvent(new a.window.KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true }));
    tab(false); assert.equal(a.window.document.activeElement.id, "importPictureName");
    tab(false); assert.equal(a.window.document.activeElement.id, "finishImportPictureName");
    tab(false); assert.equal(a.window.document.activeElement.id, "importPictureName");
    tab(true); assert.equal(a.window.document.activeElement.id, "finishImportPictureName");
    a.el("importPictureName").focus(); a.type("Student");
    a.el("settingsButton").focus();
    assert.equal(a.window.document.activeElement.id, "importPictureName");
    a.el("closeScheduleModal").click();
    a.window.document.dispatchEvent(new a.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    assert.equal(a.window.document.activeElement.id, "importPictureName");
    a.locked();
    assert.equal(a.window.getComputedStyle(a.el("importPictureName")).minHeight, "44px");
    assert.equal(a.window.getComputedStyle(a.el("importPictureName")).fontSize, "16px");
    recognition.resolve(structuredClone(result)); await a.tick();
    a.submit(); await a.tick();
    assert.equal(a.el("imageReviewName").value, "Student");
  } finally { await a.window.happyDOM.abort(); }
});

test("picture failures unlock the app, retry starts fresh, and other imports never show the naming field", async () => {
  const a = await app();
  try {
    let recognition = a.upload();
    a.el("importPictureName").focus(); a.type("Unfinished name");
    recognition.reject(new Error("Cannot read this picture")); await a.tick();
    assert.equal(a.el("importProgressOverlay").hidden, true);
    assert.equal(a.el("scheduleModal").hasAttribute("inert"), false);
    assert.match(a.el("imageParserStatus").textContent, /Cannot read/);
    recognition = a.upload();
    assert.equal(a.el("importPictureName").value, "");
    assert.equal(a.el("finishImportPictureName").disabled, false);
    recognition.resolve(structuredClone(result)); await a.tick();
    a.el("cancelImageScheduleButton").click();
    const pending = deferred();
    a.load("scheduleFileInput", [{ name: "schedules.json", text: () => pending.promise }]);
    assert.equal(a.el("importPictureNameForm").hidden, true);
    assert.equal(a.window.getComputedStyle(a.el("importPictureNameForm")).display, "none");
    pending.resolve(JSON.stringify({ people: {} })); await a.tick();
    assert.equal(a.el("importProgressOverlay").hidden, true);
  } finally { await a.window.happyDOM.abort(); }
});
