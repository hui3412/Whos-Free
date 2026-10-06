import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Window } from "happy-dom";

const key = "whos-free-person-order-v1";
const fixture = { schema_version: 1, people: {
  "Person 1": { classes: [] }, "Person 2": { classes: [] },
  "Person 3": { classes: [{ day: "Monday", start: "08:00", end: "09:00", course: "Busy" }] },
  "Person 4": { classes: [] }
} };
const groups = { groups: ["a", "b"].map(id => ({ id, name: id.toUpperCase(), members: Object.keys(fixture.people) })) };
async function app(orders = null, data = fixture) {
  const window = new Window({ url: "http://localhost/Whos-Free/", settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  window.document.write(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"));
  window.setInterval = () => 0;
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.confirm = () => true;
  window.localStorage.setItem("whos-free-local-schedules", JSON.stringify({ data, meta: {} }));
  window.localStorage.setItem("whos-free-groups-v1", JSON.stringify(groups));
  if (orders !== null) window.localStorage.setItem(key, JSON.stringify(orders));
  for (const file of ["schedule-availability.js", "schedule-groups.js", "app.js"]) window.eval(fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"));
  const tick = () => new Promise(resolve => setTimeout(resolve, 35));
  await tick();
  const el = id => window.document.getElementById(id);
  el("daySelect").value = "Monday";
  el("daySelect").dispatchEvent(new window.Event("change"));
  el("timeInput").value = "08:30";
  el("timeInput").dispatchEvent(new window.Event("input"));
  const cards = (scope = "main") => [...el("peopleList").querySelectorAll(".person-card")].filter(card => card.dataset.orderScope === scope);
  const names = scope => cards(scope).map(card => card.dataset.person);
  const card = (name, scope = "main") => cards(scope).find(card => card.dataset.person === name);
  const move = (name, direction, scope = "main") => card(name, scope).dispatchEvent(new window.KeyboardEvent("keydown", { key: direction === "up" ? "ArrowUp" : "ArrowDown", altKey: true, bubbles: true }));
  const event = (target, type, props = {}) => {
    const e = new window.Event(type, { bubbles: true, cancelable: true });
    for (const [name, value] of Object.entries(props)) Object.defineProperty(e, name, { value });
    target.dispatchEvent(e);
  };
  const read = () => JSON.parse(window.localStorage.getItem(key));
  return { window, el, cards, names, card, move, event, read, tick };
}

test("filtered moves preserve hidden people, All/Free order and reloaded positions", async () => {
  const a = await app(); let reloaded;
  try {
    assert.deepEqual(a.names(), ["Person 1", "Person 2", "Person 4"]);
    a.move("Person 4", "up");
    assert.deepEqual(a.names(), ["Person 1", "Person 4", "Person 2"]);
    assert.deepEqual(a.read().main, ["Person 1", "Person 4", "Person 2", "Person 3"]);
    a.el("viewToggleButton").click();
    assert.deepEqual(a.names(), ["Person 1", "Person 4", "Person 2", "Person 3"]);
    a.el("viewToggleButton").click();
    assert.deepEqual(a.names(), ["Person 1", "Person 4", "Person 2"]);
    reloaded = await app(a.read());
    assert.deepEqual(reloaded.names(), a.names());
    reloaded.el("timeInput").value = "10:00";
    reloaded.event(reloaded.el("timeInput"), "input");
    assert.deepEqual(reloaded.names(), ["Person 1", "Person 4", "Person 2", "Person 3"]);
  } finally { await a.window.happyDOM.abort(); await reloaded?.window.happyDOM.abort(); }
});

test("main and overlapping groups have independent persisted orders", async () => {
  const a = await app(); let reloaded;
  try {
    a.move("Person 4", "up");
    a.el("showGroupsToggle").click();
    assert.deepEqual(a.names("group:a"), ["Person 1", "Person 2", "Person 4"]);
    assert.deepEqual(a.names("group:b"), ["Person 1", "Person 2", "Person 4"]);
    a.move("Person 2", "up", "group:a");
    assert.deepEqual(a.names("group:a"), ["Person 2", "Person 1", "Person 4"]);
    assert.deepEqual(a.names("group:b"), ["Person 1", "Person 2", "Person 4"]);
    a.el("viewToggleButton").click();
    assert.deepEqual(a.names("group:a"), ["Person 2", "Person 1", "Person 4", "Person 3"]);
    a.el("showGroupsToggle").click();
    assert.deepEqual(a.names(), ["Person 1", "Person 4", "Person 2", "Person 3"]);
    reloaded = await app(a.read());
    reloaded.el("showGroupsToggle").click();
    assert.deepEqual(reloaded.names("group:a"), ["Person 2", "Person 1", "Person 4"]);
    assert.deepEqual(reloaded.names("group:b"), ["Person 1", "Person 2", "Person 4"]);
  } finally { await a.window.happyDOM.abort(); await reloaded?.window.happyDOM.abort(); }
});

test("native drag supports before/after placement and rejects cross-group drops", async () => {
  const a = await app();
  try {
    let source = a.card("Person 4"), target = a.card("Person 2");
    a.event(source, "dragstart");
    a.event(target, "drop", { clientY: -1 });
    assert.deepEqual(a.names(), ["Person 1", "Person 4", "Person 2"]);
    source = a.card("Person 1"); target = a.card("Person 2");
    a.event(source, "dragstart"); a.event(target, "drop", { clientY: 1 });
    assert.deepEqual(a.names(), ["Person 4", "Person 2", "Person 1"]);
    a.el("showGroupsToggle").click();
    const before = a.read(); source = a.card("Person 4", "group:a");
    a.event(source, "dragstart"); a.event(a.card("Person 1", "group:b"), "drop", { clientY: -1 });
    a.event(source, "dragend");
    assert.deepEqual(a.read(), before);
  } finally { await a.window.happyDOM.abort(); }
});

test("touch grip reorders without opening details; cancellation and keyboard boundaries are safe", async () => {
  const a = await app();
  try {
    let source = a.card("Person 4"), grip = source.querySelector(".person-drag-grip");
    a.window.document.elementFromPoint = () => a.card("Person 2");
    a.event(grip, "pointerdown", { button: 0, pointerId: 7 });
    a.event(grip, "pointermove", { pointerId: 7, clientX: 10, clientY: -1 });
    a.event(grip, "pointerup", { pointerId: 7 });
    assert.deepEqual(a.names(), ["Person 1", "Person 4", "Person 2"]);
    assert.match(a.el("detailPanel").textContent, /Select someone/);
    source = a.card("Person 2"); grip = source.querySelector(".person-drag-grip");
    const before = a.read();
    a.event(grip, "pointerdown", { button: 0, pointerId: 8 });
    a.event(grip, "pointercancel", { pointerId: 8 });
    assert.deepEqual(a.read(), before);
    a.move("Person 1", "up");
    assert.deepEqual(a.read(), before);
  } finally { await a.window.happyDOM.abort(); }
});

test("new people append, invalid saved data is ignored, and unavailable storage warns", async () => {
  const extra = { schema_version: 1, people: { ...fixture.people, "Person 0": { classes: [] } } };
  const a = await app({ main: ["Person 4", "Person 1", "Person 4", 42, "Deleted", "Person 2", "Person 3"] }, extra);
  const b = await app("not an order object");
  try {
    assert.deepEqual(a.names(), ["Person 4", "Person 1", "Person 2", "Person 0"]);
    assert.deepEqual(b.names(), ["Person 1", "Person 2", "Person 4"]);
    Object.defineProperty(b.window.localStorage, "setItem", { value: () => { throw new Error("Storage blocked"); } });
    b.move("Person 4", "up");
    assert.deepEqual(b.names(), ["Person 1", "Person 4", "Person 2"]);
    // Keyboard move feedback must not hide the persistence warning.
    assert.match(b.el("toast").textContent, /could not be saved/);
  } finally { await a.window.happyDOM.abort(); await b.window.happyDOM.abort(); }
});

test("renaming retains saved positions and Undo restores the old names", async () => {
  const saved = { main: ["Person 4", "Person 1", "Person 2", "Person 3"], "group:a": ["Person 2", "Person 4", "Person 1", "Person 3"] };
  const a = await app(saved);
  try {
    a.window.document.querySelector('[aria-label="Edit Person 4"]').click();
    a.el("imageReviewName").value = "Renamed";
    a.el("saveImageScheduleButton").click(); await a.tick();
    assert.deepEqual(a.read().main, ["Renamed", "Person 1", "Person 2", "Person 3"]);
    assert.deepEqual(a.read()["group:a"], ["Person 2", "Renamed", "Person 1", "Person 3"]);
    a.el("undoChangesButton").click(); await a.tick();
    assert.deepEqual(a.read(), saved);
  } finally { await a.window.happyDOM.abort(); }
});

test("deleting and undoing a person preserves their saved place", async () => {
  const saved = { main: ["Person 4", "Person 1", "Person 2", "Person 3"] };
  const a = await app(saved);
  try {
    a.window.document.querySelector('[aria-label="Remove Person 4"]').click(); await a.tick();
    assert.deepEqual(a.names(), ["Person 1", "Person 2"]);
    a.el("undoChangesButton").click(); await a.tick();
    assert.deepEqual(a.names(), ["Person 4", "Person 1", "Person 2"]);
    assert.deepEqual(a.read(), saved);
  } finally { await a.window.happyDOM.abort(); }
});
