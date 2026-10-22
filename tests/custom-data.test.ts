import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importCustomData, replaceCustomData } from "../src/custom-data";

const info = readFileSync(
  "tests/fixtures/surface-info.ini",
  "utf8",
);
const source = readFileSync(
  "tests/fixtures/static-custom-data.ini",
  "utf8",
)
  .replace(/\r\n/g, "\n")
  .replace("\n---", `\n${info.replace(/\r\n/g, "\n")}\n---`);
test("fresh CustomData preserves concurrent other-script edits, comments and opaque tail", () => {
  const b = importCustomData(source);
  assert.equal(b.surfaces[0].elements[1].data, "READY");
  b.surfaces[0].elements[1].data = "UPDATED";
  const latest = source
    .replace("Value=keep", "Value=concurrent\n; keep comment")
    .replace("Motion=", "Motion=\n; track comment");
  const result = replaceCustomData(latest, b, b.surfaces[0]);
  assert.match(result, /Value=concurrent\n; keep comment/);
  assert.match(result, /; track comment/);
  assert.equal(
    result.slice(result.indexOf("[SurfaceInfo]")),
    latest.slice(latest.indexOf("[SurfaceInfo]")),
  );
  assert.equal(
    importCustomData(result).surfaces[0].elements[1].data,
    "UPDATED",
  );
  assert.equal(replaceCustomData(result, b, b.surfaces[0]), result);
  assert.equal(importCustomData(result.replace(/\n/g, "\r\n")).id, b.id);
});
test("rejects changed dimensions, invalid INI, unsupported attributes and size overflow", () => {
  const b = importCustomData(source);
  for (const bad of [
    source.replace("SurfaceSize=512,512", "SurfaceSize=256,256"),
    source.replace("Value=keep", "Value=keep\nvalue=duplicate"),
    source.replace("ConfigFormatVersion=1", "ConfigFormatVersion=2"),
    source.replace("Surfaces=0", "Surfaces=1"),
    source.replace("TextScale=1", "Unknown=1"),
    source + "x".repeat(32000),
  ]) {
    assert.throws(() => replaceCustomData(bad, b, b.surfaces[0]));
  }
});
test("another block accepts identical surfaces while retaining destination identity and settings", () => {
  const b = importCustomData(source);
  b.surfaces[0].elements[1].data = "TRANSFERRED";
  const destination = source.replace("BlockId=123456", "BlockId=9223372036854775807")
    .replace("Owner=123456", "Owner=9223372036854775806")
    .replace("Value=keep", "Value=destination");
  const out = replaceCustomData(destination, b, b.surfaces[0]);
  assert.equal(importCustomData(out).id, "9223372036854775807");
  assert.equal(importCustomData(out).surfaces[0].elements[1].data, "TRANSFERRED");
  assert.match(out, /Owner=9223372036854775806/);
  assert.match(out, /Value=destination/);
  assert.equal(out.slice(out.indexOf("[SurfaceInfo]")), destination.slice(destination.indexOf("[SurfaceInfo]")));
  for (const key of ["SurfaceSize", "TextureSize"]) {
    assert.throws(() => replaceCustomData(destination.replace(`${key}=512,512`, `${key}=256,256`), b, b.surfaces[0]), /全表示面/);
  }
  const extra = info.slice(info.indexOf("[SurfaceInfo.Surface.0]"))
    .replace("SurfaceInfo.Surface.0", "SurfaceInfo.Surface.1");
  const two = destination.replace("SurfaceCount=1", "SurfaceCount=2")
    .replace("\n---", `\n${extra}\n---`);
  assert.throws(() => replaceCustomData(two, b, b.surfaces[0]), /全表示面/);
  const twoBlock = importCustomData(two);
  const changedUnchecked = two.replace("SurfaceSize=512,512", "SurfaceSize=256,256");
  twoBlock.id = b.id;
  assert.throws(() => replaceCustomData(changedUnchecked, twoBlock, twoBlock.surfaces[1]), /全表示面/);
});
test("64-bit identities remain strings and stale surface info is ignored", () => {
  const text = source
    .replace("BlockId=123456", "BlockId=9223372036854775807")
    .replace("Owner=123456", "Owner=9223372036854775806")
    .replace("\n---", "\n[SurfaceInfo.Surface.9]\nUnknown=keep\n---");
  const b = importCustomData(text);
  assert.equal(b.id, "9223372036854775807");
  assert.equal(b.surfaces.length, 1);
  assert.match(
    replaceCustomData(text, b, b.surfaces[0]),
    /Owner=9223372036854775806/,
  );
});

test("replacement preserves unedited surfaces and accepts missing target value keys", () => {
  const secondInfo = info
    .slice(info.indexOf("[SurfaceInfo.Surface.0]"))
    .replace("SurfaceInfo.Surface.0", "SurfaceInfo.Surface.1");
  const other =
    '[Settings.LCDSpriteDrawer.Surface.1]\nLayout=\n|Id=other;Type=TEXT;Data="KEEP"\nMotion=\nBinding=\n';
  const text = source
    .replace("SurfaceCount=1", "SurfaceCount=2")
    .replace("Surfaces=0", "Surfaces=0,1")
    .replace("\n---", `\n${secondInfo}\n${other}\n---`);
  const b = importCustomData(text);
  b.surfaces[0].elements[1].data = "NEW";
  const out = replaceCustomData(text, b, b.surfaces[0]);
  assert.ok(out.includes(other));
  assert.equal(importCustomData(out).surfaces[1].elements[0].data, "KEEP");
  const missing = text.replace("Motion=\nBinding=", "");
  assert.equal(
    importCustomData(replaceCustomData(missing, b, b.surfaces[0])).surfaces[0]
      .elements[1].data,
    "NEW",
  );
});

test("checked surfaces are added to management without changing unchecked surfaces", () => {
  const extra = info
    .slice(info.indexOf("[SurfaceInfo.Surface.0]"))
    .replace("SurfaceInfo.Surface.0", "SurfaceInfo.Surface.1");
  const text = source
    .replace("SurfaceCount=1", "SurfaceCount=2")
    .replace("\n---", `\n${extra}\n---`);
  const b = importCustomData(text);
  b.surfaces[1].elements = [
    { id: "right", type: "TEXT", data: "RIGHT", x: 0, y: 0 },
  ];
  const out = replaceCustomData(text, b, [b.surfaces[1]]);
  assert.match(out, /Surfaces=0,1/);
  assert.equal(importCustomData(out).surfaces[0].elements[1].data, "READY");
  assert.equal(importCustomData(out).surfaces[1].elements[0].data, "RIGHT");
  assert.equal(replaceCustomData(out, b, [b.surfaces[1]]), out);
  b.surfaces[0].elements[1].data = "CENTER";
  const both = replaceCustomData(text, b, b.surfaces);
  assert.equal(importCustomData(both).surfaces[0].elements[1].data, "CENTER");
  assert.equal(importCustomData(both).surfaces[1].elements[0].data, "RIGHT");
  assert.throws(() => replaceCustomData(text, b, []), /出力する面/);
  assert.throws(
    () => replaceCustomData(text, b, [b.surfaces[0], b.surfaces[0]]),
    /Duplicate/,
  );
});

test("multi-screen size limit applies to the final document regardless of selection order", () => {
  const extra = info
    .slice(info.indexOf("[SurfaceInfo.Surface.0]"))
    .replace("SurfaceInfo.Surface.0", "SurfaceInfo.Surface.1");
  const large =
    "[Settings.LCDSpriteDrawer.Surface.1]\nLayout=\n" +
    Array.from(
      { length: 10 },
      (_, i) => `|Id=old${i};Type=TEXT;Data="${"x".repeat(256)}"\n`,
    ).join("") +
    "Motion=\nBinding=\n";
  const base = source
    .replace("SurfaceCount=1", "SurfaceCount=2")
    .replace("\n---", `\n${extra}\n${large}\n---`);
  const text = base.replace(
    "Value=keep",
    `Value=${"p".repeat(31900 - base.length + 4)}`,
  );
  const b = importCustomData(text);
  b.surfaces[0].elements[1].data = "y".repeat(256);
  b.surfaces[1].elements = [];
  assert.throws(() => replaceCustomData(text, b, b.surfaces[0]), /32,000/);
  const final = replaceCustomData(text, b, b.surfaces);
  assert.equal(final, replaceCustomData(text, b, [...b.surfaces].reverse()));
  assert.equal(importCustomData(final).surfaces[1].elements.length, 0);
  assert.ok(final.length <= 32000);
});
