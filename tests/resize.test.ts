import { test } from "node:test";
import assert from "node:assert/strict";
import { resizeTexture } from "../src/resize";
import type { Element } from "../src/model";
const initial: Element = {
  id: "a",
  type: "TEXTURE",
  data: "SquareSimple",
  x: 40,
  y: 30,
  width: 200,
  height: 100,
};
const options = { centered: false, proportional: false, snap: false };
const near = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test("all rotated resize handles fix the opposite edge or corner", () => {
  for (const angle of [0, 30, 90, 147]) {
    const c = Math.cos((angle * Math.PI) / 180),
      s = Math.sin((angle * Math.PI) / 180);
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ]) {
      const next = resizeTexture(
        { ...initial, angle },
        [dx, dy],
        [20 * dx * c - 20 * dy * s, 20 * dx * s + 20 * dy * c],
        options,
      );
      near(next.width!, 200 + (dx ? 20 : 0));
      near(next.height!, 100 + (dy ? 20 : 0));
      const fixed = (e: typeof next) => [
        e.x - ((dx * e.width!) / 2) * c + ((dy * e.height!) / 2) * s,
        e.y - ((dx * e.width!) / 2) * s - ((dy * e.height!) / 2) * c,
      ];
      const before = fixed(initial),
        after = fixed(next);
      near(after[0], before[0]);
      near(after[1], before[1]);
    }
  }
});
test("Ctrl fixes the center and Shift preserves ratio with the opposite edge fixed", () => {
  const centered = resizeTexture(initial, [1, 0], [20, 0], {
    ...options,
    centered: true,
  });
  assert.deepEqual(centered, { x: 40, y: 30, width: 240, height: 100 });
  const shift = resizeTexture(initial, [1, 0], [20, 0], {
    ...options,
    proportional: true,
  });
  near(shift.x, 50);
  near(shift.y, 30);
  near(shift.width!, 220);
  near(shift.height!, 110);
  near(shift.x - shift.width! / 2, initial.x - initial.width! / 2);
  const both = resizeTexture(initial, [0, -1], [0, -20], {
    ...options,
    centered: true,
    proportional: true,
  });
  near(both.x, 40);
  near(both.y, 30);
  near(both.width!, 280);
  near(both.height!, 140);
  const corner = resizeTexture(initial, [-1, -1], [-20, -25], {
    ...options,
    proportional: true,
  });
  near(corner.width! / corner.height!, 2);
  near(corner.x + corner.width! / 2, 140);
  near(corner.y + corner.height! / 2, 80);
});
test("resizing clamps at minimum size and snapping keeps the opposite anchor", () => {
  const small = resizeTexture(initial, [1, 0], [-500, 0], options);
  assert.equal(small.width, 1);
  near(small.x - small.width! / 2, -60);
  const snapped = resizeTexture(initial, [1, 0], [16, 0], {
    ...options,
    snap: true,
  });
  assert.equal(snapped.width, 220);
  near(snapped.x - snapped.width! / 2, -60);
  const flat = resizeTexture(
    { ...initial, width: 0, height: 0 },
    [1, 0],
    [10, 0],
    { ...options, proportional: true },
  );
  assert.ok(Object.values(flat).every(Number.isFinite));
});

test("resize uses the configured increment independently of movement", () => {
  const next = resizeTexture(initial, [1, 0], [16, 0], {
    ...options,
    snap: true,
    step: 5,
  });
  assert.equal(next.width, 215);
  near(next.x - next.width! / 2, -60);
});
