import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Window } from "happy-dom";

const scheduleKey = "whos-free-local-schedules";
const peopleKey = "whos-free-people-preferences-v1";
const groupsKey = "whos-free-groups-v1";
const notificationsKey = "whos-free-notification-settings-v1";
const fixture = { schema_version: 1, people: {
  Alice: { semester: null, classes: [{ day: "Monday", start: "09:00", end: "10:00", course: "Math" }] },
  Bob: { semester: null, classes: [] },
} };

async function app(data = fixture) {
  const window = new Window({ url: "http://localhost/Whos-Free/", settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  window.document.write(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"));
  window.setInterval = () => 0;
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.confirm = () => true;
  const read = key => JSON.parse(window.localStorage.getItem(key) || "null");
  if (data) window.localStorage.setItem(scheduleKey, JSON.stringify({ data, meta: { filename: "Original", importedAt: "2026-10-01", peopleCount: Object.keys(data.people).length } }));
  window.localStorage.setItem(peopleKey, JSON.stringify({ nicknames: { Alice: "Al" }, pinnedPeople: ["Alice"] }));
  window.localStorage.setItem(notificationsKey, JSON.stringify({ enabled: false, mutedPeople: ["Alice"] }));
  window.localStorage.setItem(groupsKey, JSON.stringify({ groups: [{ id: "lunch", name: "Lunch", members: ["Alice", "Bob"], hidden: false }] }));
  for (const file of ["schedule-availability.js", "schedule-groups.js", "app.js"]) window.eval(fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"));
  const tick = () => new Promise(resolve => setTimeout(resolve, 30));
  await tick();
  const el = id => window.document.getElementById(id);
  const inputFile = (id, files) => {
    Object.defineProperty(el(id), "files", { value: files, configurable: true });
    el(id).dispatchEvent(new window.Event("change"));
  };
  const importJson = async data => { inputFile("scheduleFileInput", [{ name: "schedules.json", text: async () => JSON.stringify(data) }]); await tick(); };
  const undo = async (id = "undoChangesButton") => { el(id).click(); await tick(); };
  const save = async name => { el("imageReviewName").value = name; el("saveImageScheduleButton").click(); await tick(); };
  return { window, el, read, tick, inputFile, importJson, undo, save, stored: () => read(scheduleKey) };
}

test("saved edit and rename undo restores times and associated preferences without reversing unrelated pins", async () => {
  const a = await app(); const { window, el, stored, read, save, undo } = a;
  try {
    assert.equal(el("undoChangesButton").disabled, true);
    window.document.querySelector('[aria-label="Edit Al"]').click();
    window.document.querySelector('[data-field="end"]').value = "11:00";
    await save("Alicia");
    assert.equal(stored().data.people.Alicia.classes[0].end, "11:00");
    assert.deepEqual(read(groupsKey).groups[0].members, ["Alicia", "Bob"]);
    window.document.querySelector('[aria-label="Pin Bob to the top"]').click();
    await undo();
    assert.deepEqual(stored().data, fixture);
    assert.equal(stored().meta.filename, "Original");
    assert.deepEqual(read(groupsKey).groups[0].members, ["Alice", "Bob"]);
    assert.equal(read(peopleKey).nicknames.Alice, "Al");
    assert.equal(read(peopleKey).nicknames.Alicia, undefined);
    assert.deepEqual(read(peopleKey).pinnedPeople.sort(), ["Alice", "Bob"]);
    assert.deepEqual(read(notificationsKey).mutedPeople, ["Alice"]);
    assert.equal(el("undoChangesButton").disabled, true);
  } finally { await window.happyDOM.abort(); }
});

test("deleting people, including the final person, is undone in reverse order with nicknames, pins, mutes and memberships", async () => {
  const { window, el, tick, stored, read, undo } = await app();
  try {
    window.document.querySelector('[aria-label="Remove Al"]').click(); await tick();
    assert.equal(stored().data.people.Alice, undefined);
    assert.deepEqual(read(groupsKey).groups[0].members, ["Bob"]);
    window.document.querySelector('[aria-label="Remove Bob"]').click(); await tick();
    assert.equal(stored(), null);
    await undo("undoScheduleChangesButton");
    assert.deepEqual(Object.keys(stored().data.people), ["Bob"]);
    await undo();
    assert.deepEqual(stored().data, fixture);
    assert.equal(read(peopleKey).nicknames.Alice, "Al");
    assert.deepEqual(read(peopleKey).pinnedPeople, ["Alice"]);
    assert.deepEqual(read(notificationsKey).mutedPeople, ["Alice"]);
    assert.deepEqual(read(groupsKey).groups[0].members, ["Alice", "Bob"]);
    assert.equal(el("undoChangesButton").disabled, true);
  } finally { await window.happyDOM.abort(); }
});

test("remove-all undo restores the original database and group membership", async () => {
  const { window, el, tick, stored, read, undo } = await app();
  try {
    el("removeSchedulesButton").click(); await tick();
    assert.equal(stored(), null);
    assert.deepEqual(read(groupsKey).groups[0].members, []);
    assert.equal(el("undoChangesButton").disabled, false);
    await undo();
    assert.deepEqual(stored().data, fixture);
    assert.deepEqual(read(groupsKey).groups[0].members, ["Alice", "Bob"]);
  } finally { await window.happyDOM.abort(); }
});

test("one JSON import is one undo, identical imports and invalid files leave history unchanged", async () => {
  const { window, el, stored, importJson, undo } = await app();
  try {
    await importJson({ people: { Alice: { classes: [] }, Cara: { classes: [] }, Dan: { classes: [] } } });
    assert.equal(Object.keys(stored().data.people).length, 4);
    assert.match(el("undoChangesStatus").textContent, /1 change available/);
    await importJson(stored().data);
    assert.match(el("undoChangesStatus").textContent, /1 change available/);
    await importJson({ people: { Bad: { classes: [{ day: "Not a day" }] } } });
    assert.match(el("undoChangesStatus").textContent, /1 change available/);
    await undo();
    assert.deepEqual(stored().data, fixture);
  } finally { await window.happyDOM.abort(); }
});

test("manual additions undo back to no schedules, cancellation and validation errors never create history", async () => {
  const { window, el, save, stored, undo } = await app(null);
  try {
    el("manualScheduleButton").click();
    await save("");
    assert.equal(el("undoChangesButton").disabled, true);
    el("cancelImageScheduleButton").click();
    assert.equal(el("undoChangesButton").disabled, true);
    el("manualScheduleButton").click(); await save("New Person");
    assert.deepEqual(stored().data.people["New Person"].classes, []);
    await undo();
    assert.equal(stored(), null);
    assert.equal(el("peopleManagerCount").textContent, "0");
    assert.equal(el("undoChangesButton").disabled, true);
  } finally { await window.happyDOM.abort(); }
});

test("canceling deletion or replacement and canceling an edited schedule leaves history empty", async () => {
  const { window, el, tick, stored, save } = await app();
  try {
    window.confirm = () => false;
    window.document.querySelector('[aria-label="Remove Al"]').click();
    el("removeSchedulesButton").click(); await tick();
    el("manualScheduleButton").click(); await save("Alice");
    assert.deepEqual(stored().data, fixture);
    el("cancelImageScheduleButton").click();
    window.document.querySelector('[aria-label="Edit Al"]').click();
    window.document.querySelector('[data-field="end"]').value = "11:00";
    el("cancelImageScheduleButton").click();
    assert.equal(el("undoChangesButton").disabled, true);
    assert.deepEqual(stored().data, fixture);
  } finally { await window.happyDOM.abort(); }
});

test("an in-flight JSON import blocks undo and repeated undo clicks cannot skip changes", async () => {
  const { window, el, tick, inputFile, stored, importJson, undo } = await app();
  try {
    await importJson({ people: { Cara: { classes: [] } } });
    let complete;
    inputFile("scheduleFileInput", [{ name: "more.json", text: () => new Promise(resolve => { complete = resolve; }) }]);
    assert.equal(el("undoChangesButton").disabled, true);
    assert.equal(el("undoScheduleChangesButton").disabled, true);
    el("undoChangesButton").click();
    assert.ok(stored().data.people.Cara);
    complete(JSON.stringify({ people: { Dan: { classes: [] } } })); await tick();
    el("undoChangesButton").click(); el("undoScheduleChangesButton").click(); await tick();
    assert.equal(stored().data.people.Dan, undefined);
    assert.ok(stored().data.people.Cara);
    assert.match(el("undoChangesStatus").textContent, /1 change available/);
    await undo();
    assert.deepEqual(stored().data, fixture);
  } finally { await window.happyDOM.abort(); }
});

test("PDF batch import can be undone as one change even with a failed PDF", async () => {
  const { window, el, inputFile, tick, stored, undo } = await app();
  try {
    window.WhosFreeParser = { parseSchedulePdf: async file => {
      if (file.name === "bad.pdf") throw new Error("Invalid PDF");
      return { name: file.name === "alice.pdf" ? "Alice" : "Cara", person: { classes: [] } };
    } };
    inputFile("schedulePdfInput", [{ name: "alice.pdf" }, { name: "cara.pdf" }, { name: "bad.pdf" }]); await tick();
    assert.equal(Object.keys(stored().data.people).length, 3);
    assert.match(el("undoChangesStatus").textContent, /1 change available/);
    await undo();
    assert.deepEqual(stored().data, fixture);
  } finally { await window.happyDOM.abort(); }
});

test("code imports record only actual additions and undo remains blocked until the code panel closes", async () => {
  const { window, el, tick, stored, undo } = await app();
  try {
    window.WhosFreeShareCode = {
      decode: async () => ({ people: { Cara: { classes: [] } } }),
      merge: () => ({ data: { schema_version: 1, people: { ...fixture.people, Cara: { classes: [] } } }, added: 1, skipped: 0, renamed: [] }),
    };
    el("importCodeButton").click(); el("importCodeInput").value = "code";
    el("decodeCodeButton").click(); await tick();
    assert.equal(el("undoChangesButton").disabled, true);
    assert.ok(stored().data.people.Cara);
    window.WhosFreeShareCode.merge = () => ({ data: stored().data, added: 0, skipped: 1, renamed: [] });
    el("decodeCodeButton").click(); await tick();
    assert.match(el("undoChangesStatus").textContent, /1 change available/);
    el("closeImportButton").click(); await undo();
    assert.deepEqual(stored().data, fixture);
  } finally { await window.happyDOM.abort(); }
});

test("history retains only 20 changes and opening an editor blocks undo without discarding history", async () => {
  const { window, el, save, undo, stored } = await app();
  try {
    for (let i = 1; i <= 21; i++) { el("manualScheduleButton").click(); await save(`Person ${i}`); }
    assert.match(el("undoChangesStatus").textContent, /20 changes available/);
    el("manualScheduleButton").click();
    assert.equal(el("undoChangesButton").disabled, true);
    assert.equal(el("undoScheduleChangesButton").disabled, true);
    el("cancelImageScheduleButton").click();
    for (let i = 0; i < 20; i++) await undo();
    assert.deepEqual(Object.keys(stored().data.people), ["Alice", "Bob", "Person 1"]);
    assert.equal(el("undoChangesButton").disabled, true);
  } finally { await window.happyDOM.abort(); }
});

test("undo survives local persistence failure in memory and warns instead of promising a saved restore", async () => {
  const { window, el, tick, undo } = await app();
  try {
    window.document.querySelector('[aria-label="Remove Al"]').click(); await tick();
    Object.defineProperty(window.localStorage, "setItem", { value: () => { throw new Error("Storage blocked"); } });
    await undo();
    assert.equal(el("peopleManagerCount").textContent, "2");
    assert.ok(window.document.querySelector('[aria-label="Edit Al"]'));
    assert.match(el("toast").textContent, /would not allow the app to save a local copy/);
    assert.equal(el("undoChangesButton").disabled, true);
  } finally { await window.happyDOM.abort(); }
});
