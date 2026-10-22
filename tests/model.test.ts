import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONTRACT,
  emptyProject,
  parseLayout,
  writeLayout,
  iniLayout,
  parseSurfaceInfo,
  parseProject,
  serializeProject,
} from "../src/model";
const fixture = (name: string) =>
  readFileSync(`tests/fixtures/${name}`, "utf8");

test("project saving rejects invalid values and duplicate IDs without changing the source", () => {
  const p = emptyProject();
  p.blocks.push(parseSurfaceInfo(fixture("surface-info.ini")));
  const s = p.blocks[0].surfaces[0];
  s.elements = parseLayout('Id=a;Type=TEXTURE;Data="UnknownAsset";Size=-1,0');
  const before = structuredClone(p);
  assert.deepEqual(parseProject(serializeProject(p)), p);
  assert.deepEqual(p, before);
  s.elements[0].x = Infinity;
  assert.throws(() => serializeProject(p));
  s.elements = structuredClone(before.blocks[0].surfaces[0].elements);
  s.elements[0].width = NaN;
  assert.throws(() => serializeProject(p));
  s.elements = structuredClone(before.blocks[0].surfaces[0].elements);
  s.elements.push(structuredClone(s.elements[0]));
  assert.throws(() => serializeProject(p), /ブロック.*面/);
  s.elements = structuredClone(before.blocks[0].surfaces[0].elements);
  s.elements[0].color = [0, 0, 0, 256];
  assert.throws(() => serializeProject(p));
});

test("project rejects non-records, malformed vectors and duplicate blocks", () => {
  for (const value of [null, [], [emptyProject()], { ...emptyProject(), blocks: [null] }])
    assert.throws(() => parseProject(JSON.stringify(value)));
  const p = emptyProject();
  p.blocks.push(parseSurfaceInfo(fixture("surface-info.ini")));
  const s = p.blocks[0].surfaces[0];
  s.size = [512] as never;
  assert.throws(() => parseProject(JSON.stringify(p)));
  s.size = [512, 512];
  s.foreground = [0, 0, 0, 255, 0] as never;
  assert.throws(() => parseProject(JSON.stringify(p)));
  s.foreground = [0, 0, 0, 255];
  p.blocks.push(structuredClone(p.blocks[0]));
  assert.throws(() => parseProject(JSON.stringify(p)));
});
test("handoff Layout round trip retains values and order", () => {
  const items = parseLayout(fixture("static-layout.txt"));
  assert.equal(items.length, 2);
  assert.deepEqual(parseLayout(writeLayout(items)), items);
  assert.ok(iniLayout(items).startsWith("Layout=\n|Id="));
});
test("quoted semicolons and all supported escapes survive", () => {
  const text =
    'Id=a;Type=TEXT;Data="a;b\\n\\t\\r\\\"\\\\日本語";FontId="UnknownFont";';
  const items = parseLayout(text);
  assert.deepEqual(parseLayout(writeLayout(items)), items);
  assert.equal(items[0].font, "UnknownFont");
});
test("reject malformed Layout without coercing input", () => {
  for (const text of [
    'Id=a;Type=TEXT;Data="ok";Size=1,2',
    'Id=a;Type=TEXT;Data="ok";TextScale=1e-99',
    'Id=a;Type=TEXT;Data="\\q"',
    'Id=a;Type=TEXT;Data="ok";Position=NaN,0',
    'Id=a;Type=TEXT;Data="ok";Unknown=1',
    'Id=a;Id=b;Type=TEXT;Data="ok"',
    'Id=a;Type=TEXTURE;Data="";Size=1,2',
  ])
    assert.throws(() => parseLayout(text));
});
test("physical line numbers count blank lines, missing and empty differ", () => {
  assert.deepEqual(parseLayout(""), []);
  assert.equal(iniLayout([]), "Layout=");
  assert.throws(() => parseLayout('\n\nType=TEXT;Data=""'), /行 3/);
});
test("32 elements per surface and float overflow enforced", () => {
  const line = (i: number) =>
    `Id=a${i};Type=TEXTURE;Data="SquareSimple";Size=-1,0`;
  assert.equal(
    parseLayout(Array.from({ length: 32 }, (_, i) => line(i)).join("\n"))
      .length,
    32,
  );
  assert.throws(() =>
    parseLayout(Array.from({ length: 33 }, (_, i) => line(i)).join("\n")),
  );
  assert.throws(() =>
    parseLayout('Id=a;Type=TEXTURE;Data="SquareSimple";Size=1e39,2'),
  );
});
test("surface info preserves full ID precision and separate viewport sizes", () => {
  const text = fixture("surface-info.ini")
    .replace("123456", "9223372036854775807")
    .replace("SurfaceSize=512,512", "SurfaceSize=400,200");
  const b = parseSurfaceInfo(text);
  assert.equal(b.id, "9223372036854775807");
  assert.deepEqual(b.surfaces[0].size, [400, 200]);
  assert.deepEqual(b.surfaces[0].texture, [512, 512]);
  assert.throws(() =>
    parseSurfaceInfo(text.replace("FormatVersion=1", "FormatVersion=2")),
  );
  assert.throws(() => parseSurfaceInfo(text + "\n[SurfaceInfo]\n"));
});
test("project save/load retains unknown asset identifiers but rejects unknown data fields", () => {
  const p = emptyProject();
  p.blocks.push(parseSurfaceInfo(fixture("surface-info.ini")));
  p.blocks[0].surfaces[0].elements = parseLayout(
    'Id=a;Type=TEXT;Data="test";FontId="GameFont"',
  );
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  assert.throws(() => parseProject(JSON.stringify({ ...p, motion: [] })));
  assert.throws(() => parseProject(JSON.stringify({ ...p, version: 999 })));
  const bad = structuredClone(p);
  (bad.blocks[0].surfaces[0] as unknown as Record<string, unknown>).binding =
    [];
  assert.throws(() => parseProject(JSON.stringify(bad)));
});

test("old projects are rejected; current editor flags and editor flags round trip without entering Layout", () => {
  const p = emptyProject();
  p.blocks.push(parseSurfaceInfo(fixture("surface-info.ini")));
  p.blocks[0].surfaces[0].elements = parseLayout(
    'Id=a;Type=TEXTURE;Data="Unknown";Size=20,30',
  );
  const legacy = { ...p, version: 1 };
  assert.throws(() => parseProject(JSON.stringify(legacy)));
  const e = p.blocks[0].surfaces[0].elements[0];
  e.hidden = true;
  e.locked = true;
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  assert(!writeLayout([e]).includes("hidden"));
  assert(!writeLayout([e]).includes("locked"));
  assert.throws(() => parseProject(JSON.stringify({ ...p, version: 1 })));
  assert.throws(() =>
    parseProject(JSON.stringify(p).replace('"locked":true', '"locked":"yes"')),
  );
});

test("omitted texture and text colors survive Layout and project round trips while transparent remains explicit", () => {
  const elements = parseLayout(
    'Id=image;Type=TEXTURE;Data="SquareSimple";Position=0,0;Size=20,20\nId=text;Type=TEXT;Data="hello";Position=0,0',
  );
  assert.ok(elements.every((element) => element.color === undefined));
  assert.ok(!writeLayout(elements).includes("Color="));
  const project = emptyProject();
  project.blocks.push(parseSurfaceInfo(fixture("surface-info.ini")));
  project.blocks[0].surfaces[0].elements = elements;
  assert.deepEqual(
    parseProject(JSON.stringify(project)).blocks[0].surfaces[0].elements,
    elements,
  );
  elements[0].color = [1, 2, 3, 0];
  assert.deepEqual(parseLayout(writeLayout(elements))[0].color, [1, 2, 3, 0]);
});

test("current contract differs from historical snapshot and rejects old contracts", () => {
  const source = { sourceCommit: "ba81492bf026858e0125d6eb041b29be7766b16b", scriptVersion: "1.0.0", releaseStatus: "Stable" };
  assert.equal(source.sourceCommit, "ba81492bf026858e0125d6eb041b29be7766b16b");
  assert.equal(CONTRACT, "d81e015a1c9552c9e5196fbb042b7b861baf6e5f");
  assert.equal(source.scriptVersion, "1.0.0");
  assert.equal(source.releaseStatus, "Stable");
  assert.equal(emptyProject().contract, CONTRACT);
  assert.throws(() =>
    parseProject(
      JSON.stringify({ ...emptyProject(), contract: source.sourceCommit }),
    ),
  );
  const project = emptyProject();
  project.blocks.push(parseSurfaceInfo(fixture("surface-info.ini")));
  project.blocks[0].surfaces[0].elements = parseLayout(
    'Id=label;Type=TEXT;Data="hello";FontId="UnknownFont";Color=1,2,3,0',
  );
  for (const version of [1, 2]) {
    const legacy = {
      ...project,
      version,
      contract: "757b1d4a31bfbd5bea6c23170c3c4017bea4d8aa",
    };
    assert.throws(() => parseProject(JSON.stringify(legacy)));
  }
  assert.throws(() =>
    parseProject(JSON.stringify({ ...project, contract: "unknown" })),
  );
  assert.throws(() =>
    parseProject(
      JSON.stringify({
        ...project,
        contract: "757b1d4a31bfbd5bea6c23170c3c4017bea4d8aa",
        motion: [],
      }),
    ),
  );
});

test("project v5 stores editor groups, v4 migrates, and game layout stays flat", () => {
  const p = emptyProject();
  p.blocks.push(parseSurfaceInfo(fixture('surface-info.ini')));
  p.blocks[0].surfaces[0].elements = parseLayout('Id=a;Type=TEXTURE;Data="SquareSimple";Size=10,10\nId=b;Type=TEXTURE;Data="Circle";Size=10,10');
  p.blocks[0].surfaces[0].elements.forEach((e) => { e.group='panel'; });
  assert.deepEqual(parseProject(JSON.stringify(p)),p);
  assert.ok(!writeLayout(p.blocks[0].surfaces[0].elements).includes('panel'));
  assert.throws(() => parseProject(JSON.stringify({...p,version:4})));
  delete p.blocks[0].surfaces[0].elements[0].group; delete p.blocks[0].surfaces[0].elements[1].group;
  const migrated = parseProject(JSON.stringify({...p,version:4})); assert.equal(migrated.version,5); assert.deepEqual(migrated.blocks,p.blocks);
  for (const group of ['',42,'x'.repeat(81)]) {
    const invalid = structuredClone(p) as any; invalid.blocks[0].surfaces[0].elements[0].group=group;
    assert.throws(() => parseProject(JSON.stringify(invalid)));
  }
});
