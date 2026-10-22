import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseLayout,
  validateElements,
  emptyProject,
  parseProject,
  parseSurfaceInfo,
  type Element,
} from "../src/model";
import {
  NUMERIC_SOURCES,
  BOOLEAN_SOURCES,
  SOURCES,
  ANCHORS,
  applyDynamics,
  parseMotion,
  parseBinding,
  evaluateElements,
  evaluateMotion,
  motionPreviewDuration,
  writeMotion,
  writeBinding,
  iniValue,
} from "../src/dynamics";
const fixture = () =>
  parseLayout(
    'Id=a;Type=TEXTURE;Data="SquareSimple";Size=100,20\nId=t;Type=TEXT;Data="BASE"',
  );
const near = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("Motion modes handle negative rates, multiple periods and exact upper boundaries", () => {
  const e = fixture()[0];
  for (const [mode, rate, time, expected] of [
    ["Loop", 10, 1, 0],
    ["Loop", -10, 2.5, 5],
    ["PingPong", -10, 1, 10],
    ["PingPong", 10, 3.5, 5],
    ["Clamp", 10, 100, 10],
  ] as const) {
    const m = parseMotion(
      `Element=a;Property=MoveX;Rate=${rate};Mode=${mode};Min=0;Max=10`,
      [e],
    )[0].value;
    near(evaluateMotion(m, e, time), expected);
  }
  assert.equal(evaluateMotion({ property: "Width", rate: 2 }, e, 5), 110);
  assert.throws(() =>
    evaluateMotion({ property: "MoveX", rate: 1e308 }, e, 10),
  );
});

test("Motion parsing rejects physical-line errors, unknown fields, invalid bounds and wrong types", () => {
  const es = fixture();
  for (const line of [
    "Element=no;Property=MoveX;Rate=1",
    "Element=a;Property=TextScale;Rate=1",
    "Element=t;Property=Angle;Rate=1",
    "Element=t;Property=Width;Rate=1",
    "Element=a;Property=Color;Rate=1",
    "Element=a;Property=MoveX;Rate=1;Unknown=1",
    "Element=a;Property=MoveX;Rate=1;Rate=2",
    "Element=a;Property=MoveX;Rate=NaN",
    "Element=a;Property=MoveX;Rate=1;Mode=Loop",
    "Element=a;Property=Width;Rate=1;Min=0;Max=50",
    "Element=a;Property=MoveX;Rate=1;Min=0",
    "Element=a;Property=MoveX;Rate=1;Center=0,0",
    "Element=a;Property=Orbit;Rate=1",
    "Element=t;Property=TextScale;Rate=1;Min=0;Max=2",
    "Element=a;Property=MoveX;Rate=1;Anchor=invalid",
  ])
    assert.throws(() => parseMotion(line, es), line);
  assert.throws(
    () => parseMotion("\n\nElement=a;Property=MoveX;Rate=bad", es),
    /行 3/,
  );
  assert.throws(() =>
    parseMotion(" ".repeat(2049) + "Element=a;Property=MoveX;Rate=1", es),
  );
  assert.throws(() =>
    parseMotion(
      "Element=a;Property=MoveX;Rate=1\nElement=a;Property=MoveX;Rate=2",
      es,
    ),
  );
});

test("all nine rotated anchors stay fixed and transforms apply anchor then orbit then screen movement", () => {
  for (const [i, anchor] of ANCHORS.entries()) {
    const e = fixture()[0];
    e.x = 20;
    e.y = -10;
    e.angle = 30;
    const es = applyDynamics(
      [e],
      `Element=a;Property=Width;Rate=20;Anchor=${anchor}\nElement=a;Property=Height;Rate=-4;Anchor=${anchor}\nElement=a;Property=Angle;Rate=15`,
      "",
    );
    const out = evaluateElements(es, 1, {})[0];
    const qx = ((i % 3) - 1) / 2,
      qy = (Math.floor(i / 3) - 1) / 2;
    const rot = (x: number, y: number, a: number) => [
      Math.cos((a * Math.PI) / 180) * x - Math.sin((a * Math.PI) / 180) * y,
      Math.sin((a * Math.PI) / 180) * x + Math.cos((a * Math.PI) / 180) * y,
    ];
    const before = rot(qx * 100, qy * 20, 30),
      after = rot(qx * out.width!, qy * out.height!, 45);
    near(e.x + before[0], out.x + after[0]);
    near(e.y + before[1], out.y + after[1]);
  }
  const es = applyDynamics(
    fixture(),
    "Element=a;Property=Width;Rate=100;Anchor=CenterLeft\nElement=a;Property=Orbit;Rate=90;Center=0,0\nElement=a;Property=MoveX;Rate=10",
    "",
  );
  const before = JSON.stringify(es),
    out = evaluateElements(es, 1, {})[0];
  near(out.x, 10);
  near(out.y, 50);
  near(out.angle!, 0);
  assert.equal(JSON.stringify(es), before);
  es[0].motion!.reverse();
  assert.deepEqual(evaluateElements(es, 1, {})[0], {
    ...out,
    motion: es[0].motion,
  });
});

test("TEXT orbit changes position without rotation, scale faults and signed sizes stay explicit", () => {
  const es = fixture();
  es[1].x = 100;
  const tracks = applyDynamics(
    es,
    "Element=t;Property=Orbit;Rate=90;Center=0,0\nElement=t;Property=TextScale;Rate=-1\nElement=a;Property=Width;Rate=-100",
    "",
  );
  const out = evaluateElements(tracks, 0.5, {});
  near(out[1].x, Math.sqrt(5000));
  near(out[1].y, Math.sqrt(5000));
  assert.equal(out[1].angle, undefined);
  assert.equal(out[1].scale, 0.5);
  assert.throws(() => evaluateElements(tracks, 1, {}));
  assert.equal(
    evaluateElements(
      applyDynamics(fixture(), "Element=a;Property=Width;Rate=-100", ""),
      2,
      {},
    )[0].width,
    -100,
  );
  assert.throws(() =>
    evaluateElements(
      applyDynamics(fixture(), "Element=a;Property=MoveX;Rate=3e38", ""),
      2,
      {},
    ),
  );
});

test("Binding validation covers combinations, conflicts and dimension Anchor agreement", () => {
  const es = fixture(),
    numeric =
      'Element=a;Property=Width;Source=Speed;BlockName="Cockpit";InputMin=0;InputMax=100;OutputMin=20;OutputMax=220;Anchor=CenterLeft';
  assert.equal(parseBinding(numeric, es)[0].value.blockName, "Cockpit");
  for (const line of [
    numeric + ";Decimals=1",
    numeric.replace("InputMax=100", "InputMax=0"),
    numeric.replace("Source=Speed", "Source=Other"),
    numeric.replace("Property=Width", "Property=TextScale"),
    numeric.replace("Anchor=CenterLeft", "Anchor=Wrong"),
    'Element=t;Property=Data;Source=Speed;BlockName="C";InputMin=0',
    'Element=t;Property=Data;Source=Speed;BlockName="C";Decimals=4',
    'Element=a;Property=Width;Source=Enabled;BlockName="C";MinColor=0,0,0,0;MaxColor=1,1,1,1',
    'Element=a;Property=Color;Source=Enabled;BlockName="";MinColor=0,0,0,0;MaxColor=1,1,1,1',
  ])
    assert.throws(() => parseBinding(line, es));
  assert.throws(() =>
    applyDynamics(es, "Element=a;Property=Width;Rate=1", numeric),
  );
  assert.throws(() =>
    applyDynamics(es, "Element=a;Property=Height;Rate=1", numeric),
  );
  assert.doesNotThrow(() =>
    applyDynamics(
      es,
      "Element=a;Property=Height;Rate=1;Anchor=CenterLeft",
      numeric,
    ),
  );
});

test("Speed clamps and supports descending output; Enabled preserves transparent colors", () => {
  const es = applyDynamics(
    fixture(),
    "",
    'Element=a;Property=Width;Source=Speed;BlockName="C";InputMin=0;InputMax=100;OutputMin=220;OutputMax=20;Anchor=CenterLeft\nElement=a;Property=Color;Source=Enabled;BlockName="C";MinColor=1,2,3,0;MaxColor=4,5,6,7\nElement=t;Property=Data;Source=Speed;BlockName="C";Prefix="speed; ";Suffix=" m/s";Decimals=2',
  );
  assert.equal(
    evaluateElements(es, 0, { C: { speed: 150, enabled: false } })[0].width,
    20,
  );
  assert.equal(
    evaluateElements(es, 0, { C: { speed: -1, enabled: true } })[0].width,
    220,
  );
  const out = evaluateElements(es, 0, { C: { speed: 50, enabled: false } });
  assert.equal(out[0].width, 120);
  assert.deepEqual(out[0].color, [1, 2, 3, 0]);
  assert.equal(out[1].data, "speed; 50.00 m/s");
  assert.throws(() => evaluateElements(es, 0, {}));
  assert.throws(() =>
    evaluateElements(es, 0, { C: { speed: Infinity, enabled: true } }),
  );
});

test("reference snapshots are reused, text boundaries checked, and simulated values never mutate layout", () => {
  const es = applyDynamics(
    fixture(),
    "",
    'Element=a;Property=MoveX;Source=Speed;BlockName="C";InputMin=0;InputMax=100;OutputMin=0;OutputMax=100\nElement=t;Property=Data;Source=Speed;BlockName="C"',
  );
  let reads = 0;
  const source = {
    get speed() {
      reads++;
      return 50;
    },
    enabled: true,
  };
  const before = JSON.stringify(es);
  evaluateElements(es, 1, { C: source });
  assert.equal(reads, 1);
  assert.equal(JSON.stringify(es), before);
  es[1].bindings![0].prefix = "x".repeat(253);
  assert.equal(
    evaluateElements(es, 0, { C: { speed: 0, enabled: true } })[1].data.length,
    256,
  );
  es[1].bindings![0].prefix += "x";
  assert.throws(() =>
    evaluateElements(es, 0, { C: { speed: 0, enabled: true } }),
  );
});

test("Motion/Binding exchange round trips quotes, empty values and relocated element IDs", () => {
  const es = applyDynamics(
    fixture(),
    "Element=a;Property=Orbit;Rate=90;Center=-5,10;Mode=PingPong;Min=-180;Max=180",
    'Element=t;Property=Data;Source=Speed;BlockName="C;\\\"\\\\";Prefix="line\\n";Suffix="\\t";Decimals=0',
  );
  assert.deepEqual(
    applyDynamics(fixture(), writeMotion(es), writeBinding(es)),
    es,
  );
  assert.equal(iniValue("Motion", ""), "Motion=");
  assert.match(
    iniValue("Binding", writeBinding(es)),
    /^Binding=\n\|Element=t;/,
  );
  const copy = structuredClone(es[0]);
  copy.id = "renamed";
  assert.match(writeMotion([copy]), /Element=renamed/);
  assert.doesNotThrow(() => validateElements([copy]));
});

test("format 5 stores animation and rejects old static formats, and unknown or malformed JSON cannot be lost", () => {
  const p = emptyProject();
  p.blocks.push(
    parseSurfaceInfo(
      readFileSync(
        "tests/fixtures/surface-info.ini",
        "utf8",
      ),
    ),
  );
  p.blocks[0].surfaces[0].elements = applyDynamics(
    fixture(),
    "Element=a;Property=MoveX;Rate=1",
    'Element=t;Property=Data;Source=Speed;BlockName="C"',
  );
  assert.equal(p.version, 5);
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  const original = JSON.stringify(p);
  for (const mutation of [
    (e: Element) => {
      (e.motion![0] as unknown as Record<string, unknown>).extra = 1;
    },
    (e: Element) => {
      (e.motion![0] as unknown as Record<string, unknown>).rate = "1";
    },
    (e: Element) => {
      e.motion = undefined;
      e.bindings = [] as never;
      (e as unknown as Record<string, unknown>).motion = {};
    },
  ]) {
    const draft = structuredClone(p);
    mutation(draft.blocks[0].surfaces[0].elements[0]);
    assert.throws(() => parseProject(JSON.stringify(draft)));
  }
  assert.throws(() =>
    parseProject(original.replace('"version":5', '"version":2')),
  );
  for (const version of [1, 2] as const) {
    const draft = structuredClone(p);
    Object.assign(draft, { version });
    draft.blocks[0].surfaces[0].elements = fixture();
    assert.throws(() => parseProject(JSON.stringify(draft)));
  }
});

test("documented Motion and Binding examples share the built-in sample IDs and round trip", () => {
  const es = parseLayout(
    'Id=background;Type=TEXTURE;Data="SquareSimple";Size=200,100\nId=label;Type=TEXT;Data="READY"',
  );
  const tracks = applyDynamics(
    es,
    readFileSync("examples/animation-motion.txt", "utf8"),
    readFileSync("examples/animation-binding.txt", "utf8"),
  );
  const result = evaluateElements(tracks, 1, {
    Light: { speed: 0, enabled: true },
    Cockpit: { speed: 50, enabled: true },
  });
  assert.equal(result[0].width, 240);
  assert.equal(result[1].data, "Speed: 50.0 m/s");
  assert.deepEqual(
    applyDynamics(es, writeMotion(tracks), writeBinding(tracks)),
    tracks,
  );
});

test("30 Sources round trip text and JSON with independent simulated values", () => {
  assert.equal(SOURCES.length, 30);
  for (const source of SOURCES) {
    const boolean = (BOOLEAN_SOURCES as readonly string[]).includes(source);
    const line = boolean
      ? "Element=t;Property=Color;Source=" +
        source +
        ';BlockName="Battery; A";MinColor=1,2,3,0;MaxColor=4,5,6,255'
      : "Element=t;Property=Data;Source=" +
        source +
        ';BlockName="Battery; A";Decimals=3;Suffix=" units"';
    const elements = applyDynamics(fixture(), "", line);
    assert.deepEqual(
      parseBinding(writeBinding(elements), elements)[0].value,
      elements[1].bindings![0],
    );
    const project = emptyProject();
    project.blocks = [
      parseSurfaceInfo(
        readFileSync(
          "tests/fixtures/surface-info.ini",
          "utf8",
        ),
      ),
    ];
    project.blocks[0].surfaces[0].elements = elements;
    assert.deepEqual(
      parseProject(JSON.stringify(project)).blocks[0].surfaces[0].elements,
      elements,
    );
    const previous = {
      ...project,
      contract: "ba81492bf026858e0125d6eb041b29be7766b16b",
    };
    assert.throws(() => parseProject(JSON.stringify(previous)));

    const evaluated = evaluateElements(elements, 0, {
      "Battery; A": { values: { [source]: boolean ? false : 0.125 } },
    });
    if (boolean) assert.deepEqual(evaluated[1].color, [1, 2, 3, 0]);
    else assert.equal(evaluated[1].data, "0.125 units");
  }
});
test("all 30 Sources connect to all applicable output properties", () => {
  for (const source of SOURCES)
    for (const type of ["TEXT", "TEXTURE"]) {
      const e = fixture()[type === "TEXT" ? 1 : 0];
      const bool = (BOOLEAN_SOURCES as readonly string[]).includes(source);
      for (const property of [
        "MoveX",
        "MoveY",
        "Width",
        "Height",
        "Angle",
        "Orbit",
        "TextScale",
        "Color",
        "Data",
        "Visible",
      ]) {
        const common =
          "Element=" +
          e.id +
          ";Property=" +
          property +
          ";Source=" +
          source +
          ';BlockName="C";';
        const extra = ["Data", "Visible"].includes(property)
          ? "Thresholds=0.5;Case0=" +
            (property === "Visible" ? "false;Case1=true" : '"A";Case1="B"')
          : (bool ? "" : "InputMin=0;InputMax=1;") +
            (property === "Color"
              ? "MinColor=0,0,0,0;MaxColor=255,255,255,255"
              : "OutputMin=1;OutputMax=2" +
                (property === "Orbit" ? ";Center=0,0" : ""));
        const valid =
          type === "TEXT"
            ? !["Width", "Height", "Angle"].includes(property)
            : property !== "TextScale";
        if (valid) {
          const es = applyDynamics([e], "", common + extra);
          assert.equal(
            evaluateElements(es, 0, {
              C: { values: { [source]: bool ? true : 1 } },
            }).length,
            1,
          );
          assert.deepEqual(applyDynamics([e], "", writeBinding(es)), es);
        } else assert.throws(() => parseBinding(common + extra, [e]));
      }
    }
});

test("same name separates boolean Sources and numeric Sources without unit conversion", () => {
  const elements = applyDynamics(
    fixture(),
    "",
    'Element=a;Property=Color;Source=Enabled;BlockName="C";MinColor=1,1,1,0;MaxColor=2,2,2,2\nElement=t;Property=Color;Source=IsWorking;BlockName="C";MinColor=3,3,3,0;MaxColor=4,4,4,4\nElement=t;Property=Data;Source=BatteryChargeRatio;BlockName="C";Decimals=3;Suffix="%"\nElement=a;Property=Angle;Source=RotorAngle;BlockName="C";InputMin=0;InputMax=6.283185307179586;OutputMin=0;OutputMax=360',
  );
  const values = {
    Enabled: true,
    IsWorking: false,
    BatteryChargeRatio: 0.5,
    RotorAngle: Math.PI,
  };
  const result = evaluateElements(elements, 0, { C: { values } });
  assert.deepEqual(result[0].color, [2, 2, 2, 2]);
  assert.deepEqual(result[1].color, [3, 3, 3, 0]);
  assert.equal(result[1].data, "0.500%");
  near(result[0].angle!, 180);
  for (const value of [NaN, Infinity])
    assert.throws(() =>
      evaluateElements(elements, 0, {
        C: { values: { ...values, BatteryChargeRatio: value } },
      }),
    );
  assert.throws(() =>
    evaluateElements(elements, 0, {
      C: { values: { ...values, IsWorking: 1 } },
    }),
  );
  assert.equal(elements[1].data, "BASE");
});

test("Binding modes wrap negative values and exact bounds; RGBA rounds halves", () => {
  for (const [mode, input, expected] of [
    ["Clamp", -5, 0],
    ["Clamp", 10, 100],
    ["Loop", 10, 0],
    ["Loop", -2.5, 75],
    ["PingPong", 10, 100],
    ["PingPong", -2.5, 25],
  ] as const) {
    const es = applyDynamics(
      fixture(),
      "",
      `Element=a;Property=MoveX;Source=Speed;BlockName="C";InputMin=0;InputMax=10;OutputMin=0;OutputMax=100;Mode=${mode}`,
    );
    near(evaluateElements(es, 0, { C: { speed: input } })[0].x, expected);
  }
  const es = applyDynamics(
    fixture(),
    "",
    'Element=a;Property=Color;Source=Speed;BlockName="C";InputMin=0;InputMax=1;MinColor=0,0,0,0;MaxColor=255,1,3,255',
  );
  assert.deepEqual(
    evaluateElements(es, 0, { C: { speed: 0.5 } })[0].color,
    [128, 1, 2, 128],
  );
});

test("switch boundaries, hidden fault checks and independent Orbit/Angle preserve baseline", () => {
  const es = applyDynamics(
    fixture(),
    "Element=a;Property=Orbit;Rate=90;Center=10,0",
    'Element=a;Property=Data;Source=Speed;BlockName="C";Thresholds=0,10;Case0="SquareSimple";Case1="Circle";Case2="Triangle"\nElement=a;Property=Visible;Source=Enabled;BlockName="C";Thresholds=0.5;Case0=false;Case1=true',
  );
  const before = JSON.stringify(es);
  const r = evaluateElements(es, 1, { C: { speed: 10, enabled: false } })[0];
  assert.equal(r.data, "Triangle");
  assert.equal(r.hidden, true);
  near(r.angle!, 0);
  near(r.x, 10);
  near(r.y, -10);
  assert.throws(() =>
    evaluateElements(es, 1, { C: { speed: Infinity, enabled: false } }),
  );
  assert.equal(JSON.stringify(es), before);
  assert.equal(
    evaluateElements(es, 0, { C: { speed: 0, enabled: true } })[0].data,
    "Circle",
  );
});

test("Combine is explicit, noncumulative, and checks anchors and Orbit centers", () => {
  for (const [combine, expected] of [
    ["Replace", 4],
    ["Add", 14],
    ["Multiply", 40],
  ] as const) {
    const es = applyDynamics(
      fixture(),
      "Element=a;Property=MoveX;Rate=10",
      `Element=a;Property=MoveX;Source=Enabled;BlockName="C";OutputMin=2;OutputMax=4;Combine=${combine}`,
    );
    near(evaluateElements(es, 1, { C: { enabled: true } })[0].x, expected);
    near(evaluateElements(es, 1, { C: { enabled: true } })[0].x, expected);
  }
  assert.throws(() =>
    applyDynamics(
      fixture(),
      "Element=a;Property=Orbit;Rate=1;Center=0,0",
      'Element=a;Property=Orbit;Source=Enabled;BlockName="C";OutputMin=0;OutputMax=1;Center=1,1;Combine=Add',
    ),
  );
  assert.throws(() =>
    applyDynamics(
      fixture(),
      "Element=a;Property=Width;Rate=1;Anchor=CenterLeft",
      'Element=a;Property=Width;Source=Enabled;BlockName="C";OutputMin=0;OutputMax=1;Combine=Replace',
    ),
  );
  const text = applyDynamics(
    fixture(),
    "Element=t;Property=TextScale;Rate=0;Initial=1",
    'Element=t;Property=TextScale;Source=Enabled;BlockName="C";OutputMin=-2;OutputMax=-1;Combine=Add',
  );
  assert.throws(() => evaluateElements(text, 0, { C: { enabled: true } }));
});

test("removed vocabulary and malformed switches are rejected without silent conversion", () => {
  for (const line of [
    "Property=Text;Decimals=1",
    "Property=Color;FalseColor=0,0,0,0;TrueColor=1,1,1,1",
    "Property=OrbitAngle;OutputMin=0;OutputMax=1;Center=0,0",
    "Property=Orbit;OutputMin=0;OutputMax=1;Center=0,0;RotateWithOrbit=true",
    "Property=Visible;Thresholds=1,1;Case0=false;Case1=true;Case2=false",
    'Property=Visible;Thresholds=1;Case0="false";Case1=true',
    "Property=Visible;Thresholds=1;Case0=false",
    'Property=Data;Thresholds=1;Case0="";Case1="Circle"',
    'Property=Data;Thresholds=1;Case0="A";Case1="B";Case2="C"',
    "Property=MoveX;OutputMin=0;OutputMax=1;Mode=Loop",
  ])
    assert.throws(() =>
      parseBinding('Element=a;Source=Enabled;BlockName="C";' + line, fixture()),
    );
  assert.throws(() =>
    parseMotion("Element=a;Property=OrbitAngle;Rate=1;Center=0,0", fixture()),
  );
});

test("mapping keeps exact endpoints despite cancellation and clamps extreme finite inputs", () => {
  const es = applyDynamics(
    fixture(),
    "",
    'Element=a;Property=MoveX;Source=Speed;BlockName="C";InputMin=-1e30;InputMax=1;OutputMin=-1e30;OutputMax=-1',
  );
  assert.equal(evaluateElements(es, 0, { C: { speed: 1e308 } })[0].x, -1);
  assert.equal(evaluateElements(es, 0, { C: { speed: -1e308 } })[0].x, -1e30);
});

test("Motion preview duration follows rate, mode and natural traversal units", () => {
  const e = fixture()[0];
  const duration = (motion: NonNullable<Element["motion"]>) =>
    motionPreviewDuration({ ...e, motion }, [512, 256]);
  near(duration([{ property: "Angle", rate: 90 }]), 4);
  near(duration([{ property: "Orbit", rate: -180, center: [0, 0] }]), 2);
  near(duration([{ property: "MoveX", rate: 32 }]), 16);
  near(duration([{ property: "MoveY", rate: -32 }]), 8);
  near(duration([{ property: "Width", rate: 128 }]), 4);
  near(duration([{ property: "TextScale", rate: 0.5 }]), 2);
  near(
    duration([
      {
        property: "MoveX",
        rate: 10,
        mode: "Loop",
        min: 0,
        max: 100,
        initial: 25,
      },
    ]),
    10,
  );
  near(
    duration([
      {
        property: "MoveX",
        rate: -10,
        mode: "PingPong",
        min: 0,
        max: 100,
        initial: 25,
      },
    ]),
    20,
  );
  near(
    duration([{ property: "MoveX", rate: -10, min: 0, max: 100, initial: 25 }]),
    2.5,
  );
  near(duration([{ property: "Width", rate: 10, min: 0, max: 200 }]), 10);
  near(duration([{ property: "MoveX", rate: 0 }]), 0);
  near(
    duration([
      { property: "Angle", rate: 90 },
      { property: "MoveY", rate: 32 },
    ]),
    8,
  );
});
