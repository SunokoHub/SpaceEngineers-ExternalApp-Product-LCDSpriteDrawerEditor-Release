import { test } from "node:test";
import assert from "node:assert/strict";
import { readSettings, DEFAULT_SETTINGS } from "../src/settings";
test("missing, malformed and non-object settings use defaults", () => {
  for (const text of [null, "oops", "null", "[]", "1"])
    assert.deepEqual(readSettings(text), DEFAULT_SETTINGS);
});
test("invalid individual settings cannot poison valid preferences", () => {
  const value = readSettings(
    JSON.stringify({
      theme: "light",
      moveStep: 0,
      sizeStep: "20",
      angleStep: 361,
      objectDistance: -1,
      snap: false,
      grid: "false",
      showHelp: "true",
    }),
  );
  assert.equal(value.theme, "light");
  assert.equal(value.snap, false);
  assert.equal(value.grid, true);
  assert.equal(value.showHelp, false);
  for (const key of [
    "moveStep",
    "sizeStep",
    "angleStep",
    "objectDistance",
  ] as const)
    assert.equal(value[key], DEFAULT_SETTINGS[key]);
});
test("settings round trip fractional increments and independent toggles", () => {
  const value = {
    ...DEFAULT_SETTINGS,
    theme: "light" as const,
    moveStep: 2.5,
    sizeStep: 5,
    angleStep: 7.5,
    objectDistance: 12,
    grid: false,
    showHelp: true,
    objectSnap: false,
  };
  assert.deepEqual(readSettings(JSON.stringify(value)), value);
});

test("display preferences migrate independently and reject invalid colors and increments", () => {
  const value = readSettings(
    JSON.stringify({
      gridColor: 'red"/>',
      gridOpacity: 2,
      gridStep: 0,
      fineStep: -1,
      gridOnShapes: true,
      showPreviewStatus: false,
    }),
  );
  assert.equal(value.gridColor, DEFAULT_SETTINGS.gridColor);
  assert.equal(value.gridOpacity, DEFAULT_SETTINGS.gridOpacity);
  assert.equal(value.gridStep, DEFAULT_SETTINGS.gridStep);
  assert.equal(value.fineStep, DEFAULT_SETTINGS.fineStep);
  assert.equal(value.gridOnShapes, true);
  assert.equal(value.showPreviewStatus, false);
  const valid = {
    ...DEFAULT_SETTINGS,
    gridColor: "#123abc",
    gridOpacity: 0.5,
    gridStep: 25,
    fineStep: 0.25,
    fineAdjust: false,
  };
  assert.deepEqual(readSettings(JSON.stringify(valid)), valid);
});
