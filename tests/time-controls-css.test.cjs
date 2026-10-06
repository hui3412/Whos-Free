const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("weekday and native time controls share bounded heights and centered Safari values", () => {
  const css = fs.readFileSync(path.join(__dirname, "../styles.css"), "utf8");
  const fields = css.match(/\.time-selection-row select, \.time-selection-row input \{([^}]+)\}/)[1];
  for (const property of ["height", "min-height", "max-height"]) {
    assert.match(fields, new RegExp(`(?:^|\\n)\\s*${property}: var\\(--time-control-height\\);`));
  }
  assert.match(fields, /box-sizing: border-box/);
  assert.match(fields, /padding: 0 11px/);
  assert.match(css, /\.time-selection-row \{\s*--time-control-height: 38px/);
  assert.match(css, /@media \(max-width: 560px\) \{\s*\.time-selection-row \{ --time-control-height: 44px; \}/);
  const value = css.match(/\.time-selection-row input\[type="time"\]::-webkit-date-and-time-value \{([^}]+)\}/)[1];
  assert.match(value, /display: flex/);
  assert.match(value, /align-items: center/);
  assert.match(value, /height: 100%/);
});
