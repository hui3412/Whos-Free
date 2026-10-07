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
  window.localStorage.setItem("whos-free-local-schedules", JSON.stringify({ data: { schema_version: 1, people: { Alice: person } }, meta: {} }));
  window.WhosFreeImageParser = { parseScheduleImage: async () => ({ name: "New student", person: structuredClone(person) }) };
  for (const file of ["schedule-availability.js", "schedule-share-code.js", "app.js"]) window.eval(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  const el = id => window.document.getElementById(id);
  const tick = () => new Promise(resolve => setTimeout(resolve, 50));
  await tick();
  el("scheduleDataButton").click();
  await tick();
  const dialog = el("scheduleModal").querySelector(".schedule-modal");
  const stored = () => JSON.parse(window.localStorage.getItem("whos-free-local-schedules")).data;
  const upload = async () => {
    Object.defineProperty(el("scheduleImageInput"), "files", { value: [{ name: "picture.png" }], configurable: true });
    el("scheduleImageInput").dispatchEvent(new window.Event("change"));
    await tick();
  };
  const focused = mode => {
    assert.equal(dialog.dataset.scheduleFlow, mode);
    const active = mode === "review" ? el("imageReview") : el("codeImportPanel").closest(".schedule-action-section");
    for (const section of dialog.children) {
      if (section.classList.contains("modal-header")) continue;
      assert.equal(section.hidden, section !== active);
      if (section !== active) assert.equal(window.getComputedStyle(section).display, "none");
    }
    assert.equal(dialog.querySelector(".modal-header p").hidden, true);
  };
  const restored = () => {
    assert.equal(dialog.dataset.scheduleFlow, undefined);
    assert.equal(el("peopleManagerList").closest("section").hidden, false);
    assert.equal(el("addScheduleImageButton").closest("section").hidden, false);
    assert.equal(el("importCodeButton").closest("section").hidden, false);
    assert.equal(el("advancedScheduleOptions").hidden, false);
    assert.equal(el("imageReview").hidden, true);
    assert.equal(el("codeImportPanel").hidden, true);
    assert.equal(el("codeExportPanel").hidden, true);
    assert.equal(dialog.querySelector(".modal-header p").hidden, false);
  };
  return { window, el, tick, dialog, upload, focused, restored, stored };
}

test("picture review hides all surrounding schedule sections and ends at Save/Cancel", async () => {
  const a = await app();
  try {
    await a.upload();
    a.focused("review");
    assert.equal(a.el("imageReview").lastElementChild.className, "modal-actions review-actions");
    assert.equal(a.el("cancelImageScheduleButton").closest("[hidden]"), null);
    assert.ok(a.el("importCodeButton").closest("[hidden]"));
    a.el("reviewGrid").querySelector(".review-grid-block").click();
    await a.tick();
    a.focused("review");
    a.dialog.scrollTop = 1500;
    a.el("cancelImageScheduleButton").click();
    a.restored();
    assert.equal(a.dialog.scrollTop, 0);
    assert.deepEqual(Object.keys(a.stored().people), ["Alice"]);
  } finally { await a.window.happyDOM.abort(); }
});

test("saving a picture restores the people list, while a duplicate choice keeps review isolated", async () => {
  const a = await app();
  try {
    await a.upload();
    a.el("imageReviewName").value = "Alice";
    a.el("saveImageScheduleButton").click();
    a.focused("review");
    assert.equal(a.el("duplicatePicturePrompt").hidden, false);
    a.el("duplicatePicturePrompt").querySelector('[data-duplicate-action="cancel"]').click();
    a.focused("review");
    a.el("imageReviewName").value = "Bob";
    a.el("saveImageScheduleButton").click();
    await a.tick();
    a.restored();
    assert.equal(a.el("peopleManagerCount").textContent, "2");
    assert.ok(a.stored().people.Bob);
  } finally { await a.window.happyDOM.abort(); }
});

test("code import stays isolated through errors and success until Done restores Schedules", async () => {
  const a = await app();
  try {
    a.el("importCodeButton").click();
    await a.tick();
    a.focused("code-import");
    const panel = a.el("codeImportPanel");
    for (const child of panel.parentElement.children) assert.equal(child.hidden, child !== panel);
    assert.equal(panel.lastElementChild.className, "modal-actions");
    assert.ok(a.el("addScheduleImageButton").closest("[hidden]"));
    a.el("importCodeInput").value = "invalid code";
    a.el("decodeCodeButton").click();
    await a.tick();
    a.focused("code-import");
    assert.equal(a.el("importCodeStatus").dataset.tone, "error");
    a.el("importCodeInput").value = await a.window.WhosFreeShareCode.encode({ people: { Bob: person } });
    a.el("decodeCodeButton").click();
    await a.tick();
    a.focused("code-import");
    assert.ok(a.stored().people.Bob);
    a.el("closeImportButton").click();
    a.restored();
    assert.equal(a.el("peopleManagerCount").textContent, "2");
  } finally { await a.window.happyDOM.abort(); }
});

test("manual and saved-schedule edits use the same isolated grid and return safely on cancel", async () => {
  const a = await app();
  try {
    a.el("manualScheduleButton").click();
    a.focused("review");
    a.el("cancelImageScheduleButton").click();
    a.restored();
    a.window.document.querySelector('[aria-label="Edit Alice"]').click();
    a.focused("review");
    a.el("cancelImageScheduleButton").click();
    a.restored();
    assert.deepEqual(a.stored().people.Alice, person);
  } finally { await a.window.happyDOM.abort(); }
});
