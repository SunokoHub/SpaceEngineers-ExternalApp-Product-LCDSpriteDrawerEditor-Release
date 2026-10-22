import { test } from "node:test";
import assert from "node:assert/strict";
import { groupBounds, transformGroup, arrangeCircular, bounds, arrange, snapGroup, reorderElements } from "../src/editing";
import type { Element } from "../src/model";
const shape = (id: string, x: number, y: number, w = 20, h = 10): Element => ({
  id,
  type: "TEXTURE",
  data: "SquareSimple",
  x,
  y,
  width: w,
  height: h,
});
test("alignment uses rotated bounds and distribution keeps endpoints with equal gaps", () => {
  const a = shape("a", 0, 0),
    b = shape("b", 80, 50, 40),
    c = shape("c", 200, 80, 60);
  b.angle = 90;
  arrange([a, b, c], "left");
  assert.equal(bounds(a).left, bounds(b).left);
  assert.equal(bounds(a).left, bounds(c).left);
  b.x = 80;
  c.x = 200;
  const left = bounds(a).left,
    right = bounds(c).right;
  arrange([a, b, c], "distribute-x");
  assert.equal(bounds(a).left, left);
  assert.equal(bounds(c).right, right);
  assert.equal(
    bounds(b).left - bounds(a).right,
    bounds(c).left - bounds(b).right,
  );
  arrange([a, b, c], "align-y");
  assert.equal(a.y, b.y);
  assert.equal(b.y, c.y);
});
test("object snapping is threshold limited, snaps edges and excludes hidden targets", () => {
  const a = shape("a", 0, 0),
    b = shape("b", 100, 0);
  const result = snapGroup([a], [b], 77, 14, 4);
  assert.equal(result.dx, 80);
  assert.equal(result.guides.x, 90);
  assert.equal(snapGroup([a], [b], 70, 14, 4).dx, 70);
  b.hidden = true;
  assert.equal(snapGroup([a], [b], 77, 14, 4).dx, 77);
});
test("text bounds respect alignment and scale for editing guides", () => {
  const e: Element = {
    id: "text",
    type: "TEXT",
    data: "AB",
    x: 10,
    y: 0,
    scale: 2,
    alignment: "LEFT",
  };
  assert.equal(bounds(e).left, 10);
  assert.equal(bounds(e).width, 68);
  assert.equal(bounds(e).top, 0);
  assert.equal(bounds(e).bottom, 56);
  assert.equal(bounds(e).cy, 28);
  e.data = "AB\nCD";
  assert.equal(bounds(e).height, 56 * 2.2);
  e.alignment = "RIGHT";
  assert.equal(bounds(e).right, 10);
});

test("layer reordering handles both directions, endpoints and stable grouped order", () => {
  const elements = ["a", "b", "c", "d"].map((id, i) => shape(id, i * 20, 0));
  const ids = (items: Element[]) => items.map((e) => e.id);
  assert.deepEqual(ids(reorderElements(elements, ["d"], "a", false)), [
    "d",
    "a",
    "b",
    "c",
  ]);
  assert.deepEqual(ids(reorderElements(elements, ["a"], "d", true)), [
    "b",
    "c",
    "d",
    "a",
  ]);
  assert.deepEqual(ids(reorderElements(elements, ["c", "a"], "d", true)), [
    "b",
    "d",
    "a",
    "c",
  ]);
  assert.equal(reorderElements(elements, ["a"], "a", true), elements);
  assert.equal(reorderElements(elements, ["a"], "missing", true), elements);
});
test("hidden and locked layers cannot be dragged as sources", () => {
  const elements = ["a", "b", "c"].map((id, i) => shape(id, i * 20, 0));
  elements[0].locked = true;
  elements[1].hidden = true;
  assert.equal(reorderElements(elements, ["a", "b"], "c", true), elements);
});

const circularOptions = { cx: 10, cy: 20, radius: 100, start: 0, sweep: 360, offset: 0, rotate: false };
test("circle spacing avoids duplicate endpoints, includes arc ends and preserves text bounds", () => {
  const elements = [0, 1, 2, 3].map((i) => shape(String(i), 0, 0));
  arrangeCircular(elements, circularOptions);
  for (const [i, expected] of [[0, [110,20]], [1,[10,120]], [2,[-90,20]], [3,[10,-80]]] as const) {
    assert.ok(Math.abs(elements[i].x - expected[0]) < 1e-8);
    assert.ok(Math.abs(elements[i].y - expected[1]) < 1e-8);
  }
  arrangeCircular(elements.slice(0, 3), { ...circularOptions, sweep: -180 });
  assert.ok(Math.abs(elements[1].y + 80) < 1e-8);
  assert.ok(Math.abs(elements[2].x + 90) < 1e-8);
  const text: Element = { id: "text", type: "TEXT", data: "AB", x: 0, y: 0, alignment: "LEFT", scale: 1 };
  arrangeCircular([text], circularOptions);
  assert.equal(bounds(text).cx, 110);
  assert.equal(bounds(text).cy, 20);
  assert.equal(text.angle, undefined);
});
test("radial angles keep positions, skip center/text/locked/hidden and accept offsets", () => {
  const elements = [shape("east", 110,20), shape("south",10,120), shape("center",10,20), shape("locked",110,20), shape("hidden",110,20)];
  elements[2].angle = 33;
  elements[3].locked = true;
  elements[4].hidden = true;
  const positions = elements.map((e) => [e.x,e.y]);
  arrangeCircular(elements, { ...circularOptions, offset: 90 }, true);
  assert.deepEqual(elements.map((e) => [e.x,e.y]), positions);
  assert.deepEqual(elements.map((e) => e.angle), [90,180,33,undefined,undefined]);
  const before = structuredClone(elements);
  assert.throws(() => arrangeCircular(elements, { ...circularOptions, radius: -1 }));
  assert.throws(() => arrangeCircular(elements, { ...circularOptions, cx: NaN }));
  assert.deepEqual(elements, before);
});

test("group transforms preserve relative geometry and scale text without rotating glyphs", () => {
  const a = shape('a', -10, 0, 10, 10), b = shape('b',10,0,10,10);
  transformGroup([a,b],{x:100,y:50,scale:2,rotation:90,color:[1,2,3,128]});
  assert.ok(Math.abs(a.x-100)<1e-8);
  assert.ok(Math.abs(a.y-30)<1e-8);
  assert.ok(Math.abs(b.y-70)<1e-8);
  assert.equal(a.width,20); assert.equal(a.angle,90); assert.deepEqual(b.color,[1,2,3,128]);
  const text: Element = {id:'t', type:'TEXT', data:'AB', x:0,y:0,scale:1,alignment:'LEFT'};
  transformGroup([text],{x:50,y:60,scale:2,rotation:90});
  assert.equal(bounds(text).cx,50); assert.equal(bounds(text).cy,60); assert.equal(text.scale,2); assert.equal(text.angle,undefined);
  const mixed = [shape('m',0,0),text];
  transformGroup(mixed,{x:150,y:100,scale:1.5,rotation:35});
  assert.ok(Math.abs(groupBounds(mixed).cx-150)<1e-8);
  assert.ok(Math.abs(groupBounds(mixed).cy-100)<1e-8);
  assert.throws(() => transformGroup([a],{x:0,y:0,scale:0,rotation:0}));
  a.locked=true; const snapshot = structuredClone(a);
  assert.throws(() => transformGroup([a],{x:0,y:0,scale:1,rotation:0})); assert.deepEqual(a,snapshot);
});
