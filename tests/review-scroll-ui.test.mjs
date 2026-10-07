import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Window } from "happy-dom";

async function review() {
  const window = new Window({ url: "https://example.test/Whos-Free/", settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  window.document.write(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"));
  window.setInterval = () => 0;
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.URL.createObjectURL = () => "blob:test";
  window.URL.revokeObjectURL = () => {};
  window.WhosFreeImageParser = { parseScheduleImage: async () => ({ name: "Test student", person: { classes: [{ day: "Monday", start: "08:15", end: "09:35" }] } }) };
  window.eval(fs.readFileSync(new URL("../schedule-availability.js", import.meta.url), "utf8"));
  window.eval(fs.readFileSync(new URL("../app.js", import.meta.url), "utf8"));
  const tick = () => new Promise(resolve => setTimeout(resolve, 30));
  await tick();
  const input = window.document.getElementById("scheduleImageInput");
  Object.defineProperty(input, "files", { value: [{ name: "timetable.png" }] });
  input.dispatchEvent(new window.Event("change"));
  await tick();
  const grid = window.document.getElementById("reviewGrid").parentElement;
  const dialog = grid.closest(".schedule-modal");
  Object.defineProperties(grid, { scrollHeight: { value: 700 }, clientHeight: { value: 300, configurable: true } });
  Object.defineProperties(dialog, { scrollHeight: { value: 2000 }, clientHeight: { value: 600 } });
  grid.scrollTop = 0;
  dialog.scrollTop = 100;
  const touch = (x, y, identifier = 1) => ({ identifier, clientX: x, clientY: y });
  const dispatch = (type, touches, cancelable = true) => {
    const event = new window.Event(type, { bubbles: true, cancelable });
    Object.defineProperty(event, "touches", { value: touches });
    grid.dispatchEvent(event);
    return event;
  };
  return { window, grid, dialog, touch, dispatch };
}

test("picture review continues the same upward swipe into the dialog at the grid bottom", async () => {
  const a = await review();
  try {
    a.grid.scrollTop = 390;
    a.dispatch("touchstart", [a.touch(100, 300)]);
    assert.ok(a.dispatch("touchmove", [a.touch(101, 270)]).defaultPrevented);
    assert.equal(a.grid.scrollTop, 400);
    assert.equal(a.dialog.scrollTop, 120, "only the motion left after reaching the bottom transfers");
    a.dispatch("touchmove", [a.touch(101, 230)]);
    assert.equal(a.grid.scrollTop, 400);
    assert.equal(a.dialog.scrollTop, 160, "the same gesture must keep moving toward Save schedule");
    assert.equal(a.window.document.getElementById("saveImageScheduleButton").disabled, false);
  } finally { a.window.happyDOM.abort(); }
});

test("downward swipes hand off at the top and reversing direction scrolls the grid again", async () => {
  const a = await review();
  try {
    a.grid.scrollTop = 10;
    a.dispatch("touchstart", [a.touch(100, 200)]);
    a.dispatch("touchmove", [a.touch(100, 230)]);
    assert.equal(a.grid.scrollTop, 0);
    assert.equal(a.dialog.scrollTop, 80);
    a.dispatch("touchmove", [a.touch(100, 260)]);
    assert.equal(a.dialog.scrollTop, 50);
    a.dispatch("touchmove", [a.touch(100, 220)]);
    assert.equal(a.grid.scrollTop, 40);
    assert.equal(a.dialog.scrollTop, 50);
  } finally { a.window.happyDOM.abort(); }
});

test("an unbounded horizontal timetable sends vertical swipes directly to the dialog", async () => {
  const a = await review();
  try {
    Object.defineProperty(a.grid, "clientHeight", { value: 700 });
    a.dispatch("touchstart", [a.touch(100, 300)]);
    a.dispatch("touchmove", [a.touch(100, 250)]);
    assert.equal(a.grid.scrollTop, 0);
    assert.equal(a.dialog.scrollTop, 150);
    a.dialog.scrollTop = 1390;
    a.dispatch("touchmove", [a.touch(100, 200)]);
    assert.equal(a.dialog.scrollTop, 1400, "scrolling stops at the dialog boundary");
    assert.equal(a.window.document.body.style.overflow, "hidden", "the page behind the dialog stays locked");
  } finally { a.window.happyDOM.abort(); }
});

test("taps and horizontal swipes remain native even when the finger later drifts vertically", async () => {
  const a = await review();
  try {
    a.dispatch("touchstart", [a.touch(100, 300)]);
    assert.equal(a.dispatch("touchmove", [a.touch(102, 298)]).defaultPrevented, false);
    a.dispatch("touchend", []);
    a.dispatch("touchstart", [a.touch(100, 300)]);
    assert.equal(a.dispatch("touchmove", [a.touch(60, 298)]).defaultPrevented, false);
    assert.equal(a.dispatch("touchmove", [a.touch(40, 240)]).defaultPrevented, false);
    assert.equal(a.dialog.scrollTop, 100);
    assert.equal(a.grid.scrollTop, 0);
  } finally { a.window.happyDOM.abort(); }
});

test("pinch gestures, canceled gestures and a changed touch cannot move the dialog", async () => {
  const a = await review();
  try {
    a.dispatch("touchstart", [a.touch(100, 300)]);
    assert.equal(a.dispatch("touchmove", [a.touch(100, 270), a.touch(200, 270, 2)]).defaultPrevented, false);
    a.dispatch("touchmove", [a.touch(100, 250)]);
    assert.equal(a.dialog.scrollTop, 100);
    a.dispatch("touchstart", [a.touch(100, 300)]);
    a.dispatch("touchcancel", []);
    a.dispatch("touchmove", [a.touch(100, 200)]);
    assert.equal(a.grid.scrollTop, 0);
    a.dispatch("touchstart", [a.touch(100, 300)]);
    a.dispatch("touchmove", [a.touch(100, 200, 2)]);
    assert.equal(a.grid.scrollTop, 0);
  } finally { a.window.happyDOM.abort(); }
});
