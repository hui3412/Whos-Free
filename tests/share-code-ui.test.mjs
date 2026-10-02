import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Window } from "happy-dom";

async function app(data) {
  const window = new Window({ url: "https://example.test/Whos-Free/", settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  window.document.write(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"));
  window.setInterval = () => 0;
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.confirm = () => true;
  Object.assign(window, { TextEncoder, TextDecoder, Blob, CompressionStream, DecompressionStream });
  let copied;
  Object.defineProperty(window.navigator, "clipboard", { value: { writeText: async text => { copied = text; } }, configurable: true });
  if (data) window.localStorage.setItem("whos-free-local-schedules", JSON.stringify({ data, meta: {} }));
  for (const name of ["schedule-availability.js", "schedule-share-code.js", "app.js"]) window.eval(fs.readFileSync(new URL("../" + name, import.meta.url), "utf8"));
  const wait = async () => { for (let i = 0; i < 50; i++) { await new Promise(resolve => setTimeout(resolve, 20)); if (!window.document.getElementById("decodeCodeButton").disabled) return; } throw Error("operation did not finish"); };
  await wait();
  const el = id => window.document.getElementById(id);
  return { window, el, wait, copied: () => copied, stored: () => JSON.parse(window.localStorage.getItem("whos-free-local-schedules") || "null") };
}

test("Export includes only chosen people; Import adds new people and leaves duplicates and errors untouched", async () => {
  const person = label => ({ classes: [{ day: "Monday", start: "09:00", end: "10:00", course: label }] });
  const sender = await app({ schema_version: 1, people: { Alice: person("New Alice course"), Bob: person("Bob course"), Unselected: person("Must not send") } });
  const receiver = await app({ schema_version: 1, people: { Alice: person("Keep existing Alice") } });
  try {
    sender.el("exportSchedulesButton").click();
    sender.el("generateCodeButton").click();
    assert.match(sender.el("exportCodeStatus").textContent, /Select at least one/);
    for (const name of ["Alice", "Bob"]) {
      const input = [...sender.el("exportPeopleList").querySelectorAll("input")].find(item => item.dataset.person === name);
      input.checked = true;
      input.dispatchEvent(new sender.window.Event("change"));
    }
    sender.el("generateCodeButton").click();
    await sender.wait();
    const code = sender.el("exportCodeOutput").value;
    assert.ok(code.length);
    assert.deepEqual(Object.keys((await sender.window.WhosFreeShareCode.decode(code)).people), ["Alice", "Bob"]);
    sender.el("copyCodeButton").click();
    await sender.wait();
    assert.equal(sender.copied(), code);
    receiver.el("importCodeButton").click();
    receiver.el("importCodeInput").value = code;
    receiver.el("decodeCodeButton").click();
    await receiver.wait();
    assert.match(receiver.el("importCodeStatus").textContent, /Imported 1 schedule. Skipped 1/);
    assert.equal(receiver.stored().data.people.Alice.classes[0].course, "Keep existing Alice");
    assert.equal(receiver.stored().data.people.Bob.classes[0].course, "Bob course");
    assert.equal(receiver.stored().data.people.Unselected, undefined);
    const before = JSON.stringify(receiver.stored());
    receiver.el("decodeCodeButton").click();
    await receiver.wait();
    assert.match(receiver.el("importCodeStatus").textContent, /Imported 0 schedules. Skipped 2/);
    assert.equal(JSON.stringify(receiver.stored()), before, "duplicates must not even rewrite storage");
    receiver.el("importCodeInput").value = "broken code";
    receiver.el("decodeCodeButton").click();
    await receiver.wait();
    assert.equal(receiver.el("importCodeStatus").dataset.tone, "error");
    assert.equal(JSON.stringify(receiver.stored()), before);
    receiver.el("closeImportButton").click();
    assert.equal(receiver.el("importCodeButton").disabled, false);
    // Changing the selection clears a previously generated code.
    sender.el("selectAllSchedules").checked = true;
    sender.el("selectAllSchedules").dispatchEvent(new sender.window.Event("change"));
    assert.equal(sender.el("exportCodeOutput").value, "");
    assert.equal(sender.el("copyCodeButton").disabled, true);
    sender.el("closeScheduleModal").click();
    sender.el("scheduleDataButton").click();
    assert.equal(sender.el("codeExportPanel").hidden, true);
    assert.equal(sender.el("importCodeButton").disabled, false);
  } finally { await sender.window.happyDOM.abort(); await receiver.window.happyDOM.abort(); }
});

test("a device with no schedules can import a code", async () => {
  const receiver = await app(null);
  try {
    assert.equal(receiver.el("exportSchedulesButton").disabled, true);
    assert.equal(receiver.el("importCodeButton").disabled, false);
    const code = await receiver.window.WhosFreeShareCode.encode({ people: { Friend: { classes: [] } } });
    receiver.el("importCodeButton").click();
    receiver.el("importCodeInput").value = code;
    receiver.el("decodeCodeButton").click();
    await receiver.wait();
    assert.equal(receiver.stored().data.people.Friend.classes.length, 0);
    assert.match(receiver.el("importCodeStatus").textContent, /Imported 1 schedule/);
  } finally { await receiver.window.happyDOM.abort(); }
});
