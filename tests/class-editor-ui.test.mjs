import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Window } from "happy-dom";

const person = { semester: "Fall 2026", classes: [
  { day: "Monday", start: "09:00", end: "10:00", course: "Math" },
  { day: "Tuesday", start: "11:00", end: "12:00", course: "English" },
] };

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
  window.localStorage.setItem("whos-free-local-schedules", JSON.stringify({ data: { schema_version: 1, people: { Alice: person } }, meta: {} }));
  window.WhosFreeImageParser = { parseScheduleImage: async () => ({ name: "Bob", person: structuredClone(person) }) };
  for (const file of ["schedule-availability.js", "app.js"]) window.eval(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
  const el = id => window.document.getElementById(id);
  const tick = () => new Promise(resolve => setTimeout(resolve, 40));
  const cards = () => [...el("imageReviewClasses").children];
  const blocks = () => [...el("reviewGrid").querySelectorAll(".review-grid-block")];
  const stored = () => JSON.parse(window.localStorage.getItem("whos-free-local-schedules")).data;
  const collapsed = () => {
    assert.equal(el("imageReviewClasses").hidden, true);
    assert.equal(window.getComputedStyle(el("imageReviewClasses")).display, "none");
    assert.ok(cards().every(card => card.hidden));
    assert.equal(el("addReviewClassButton").textContent, "Add a class");
    assert.equal(el("addReviewClassButton").getAttribute("aria-expanded"), "false");
  };
  const upload = async () => {
    Object.defineProperty(el("scheduleImageInput"), "files", { value: [{ name: "picture.png" }], configurable: true });
    el("scheduleImageInput").dispatchEvent(new window.Event("change"));
    await tick();
  };
  await tick();
  return { window, el, tick, cards, blocks, stored, collapsed, upload };
}

test("picture review starts with only the grid and saves without opening class details", async () => {
  const a = await app();
  try {
    await a.upload();
    a.collapsed();
    assert.equal(a.blocks().length, 2);
    assert.equal(a.el("saveImageScheduleButton").closest("[hidden]"), null);
    a.el("saveImageScheduleButton").click();
    await a.tick();
    assert.deepEqual(a.stored().people.Bob.classes, person.classes.map(item => ({ ...item, kind: "class", course_code: null, section: null, room: null, instructor: null })));
    assert.equal(a.el("imageReview").hidden, true);
    a.collapsed();
  } finally { await a.window.happyDOM.abort(); }
});

test("tapping a block opens only its editor; Done hides it while retaining corrections", async () => {
  const a = await app();
  try {
    await a.upload();
    a.blocks()[1].click();
    assert.equal(a.el("imageReviewClasses").hidden, false);
    assert.equal(a.el("addReviewClassButton").getAttribute("aria-expanded"), "true");
    assert.deepEqual(a.cards().map(card => card.hidden), [true, false]);
    const input = a.cards()[1].querySelector('[data-field="course"]');
    input.value = "Corrected English";
    input.dispatchEvent(new a.window.Event("input", { bubbles: true }));
    assert.match(a.blocks()[1].textContent, /Corrected English/);
    a.cards()[1].querySelector(".secondary-button").click();
    a.collapsed();
    a.blocks()[0].click();
    assert.deepEqual(a.cards().map(card => card.hidden), [false, true]);
    a.cards()[0].querySelector(".secondary-button").click();
    a.el("saveImageScheduleButton").click();
    await a.tick();
    assert.equal(a.stored().people.Bob.classes[1].course, "Corrected English");
  } finally { await a.window.happyDOM.abort(); }
});

test("Add a class expands a new entry; removing it collapses without opening another class", async () => {
  const a = await app();
  try {
    await a.upload();
    a.el("addReviewClassButton").click();
    assert.deepEqual(a.cards().map(card => card.hidden), [true, true, false]);
    assert.equal(a.el("imageReviewClasses").hidden, false);
    const card = a.cards()[2];
    for (const [field, value] of Object.entries({ course: "Science", day: "Wednesday", start: "14:00", end: "15:00" })) card.querySelector(`[data-field="${field}"]`).value = value;
    card.dispatchEvent(new a.window.Event("input", { bubbles: true }));
    assert.ok(a.blocks().some(block => block.textContent.includes("Science")));
    card.querySelector(".secondary-button").click();
    a.collapsed();
    a.blocks().find(block => block.textContent.includes("Science")).click();
    card.querySelector(".mini-danger-button").click();
    a.collapsed();
    assert.equal(a.cards().length, 2);
    assert.equal(a.blocks().length, 2);
    a.el("addReviewClassButton").click();
    a.el("saveImageScheduleButton").click();
    await a.tick();
    assert.equal(a.stored().people.Bob.classes.length, 3);
  } finally { await a.window.happyDOM.abort(); }
});

test("saved and manual schedules start collapsed, and invalid hidden times reopen for correction", async () => {
  const a = await app();
  try {
    a.window.document.querySelector('[aria-label="Edit Alice"]').click();
    a.collapsed();
    a.blocks()[1].click();
    const card = a.cards()[1];
    const end = card.querySelector('[data-field="end"]');
    end.value = "10:00";
    end.dispatchEvent(new a.window.Event("input", { bubbles: true }));
    card.querySelector(".secondary-button").click();
    a.collapsed();
    a.el("saveImageScheduleButton").click();
    await a.tick();
    assert.match(a.el("imageReviewError").textContent, /invalid start or end time/);
    assert.equal(a.el("imageReviewClasses").hidden, false);
    assert.deepEqual(a.cards().map(card => card.hidden), [true, false]);
    assert.deepEqual(a.stored().people.Alice, person);
    a.el("cancelImageScheduleButton").click();
    a.window.document.querySelector('[aria-label="Edit Alice"]').click();
    a.collapsed();
    assert.equal(a.cards()[1].querySelector('[data-field="end"]').value, "12:00");
    a.el("cancelImageScheduleButton").click();
    a.el("manualScheduleButton").click();
    a.collapsed();
    a.el("addReviewClassButton").click();
    assert.equal(a.cards()[0].hidden, false);
    a.cards()[0].querySelector(".mini-danger-button").click();
    a.collapsed();
    assert.equal(a.cards().length, 0);
  } finally { await a.window.happyDOM.abort(); }
});
