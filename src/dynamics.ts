import {
  attributes,
  quoted,
  q,
  pair,
  color,
  type Element,
  type Color,
} from "./model";
export const MOTION_PROPERTIES = [
  "MoveX",
  "MoveY",
  "Width",
  "Height",
  "Angle",
  "TextScale",
  "Orbit",
] as const;
export const BINDING_PROPERTIES = [
  "MoveX",
  "MoveY",
  "Width",
  "Height",
  "Angle",
  "TextScale",
  "Orbit",
  "Data",
  "Color",
  "Visible",
] as const;
export const NUMERIC_SOURCES = [
  "Speed",
  "PowerOutput",
  "PowerMaxOutput",
  "BatteryStoredPower",
  "BatteryMaxStoredPower",
  "BatteryChargeRatio",
  "BatteryInput",
  "BatteryMaxInput",
  "GasFillRatio",
  "GasCapacity",
  "DoorOpenRatio",
  "PistonPosition",
  "PistonVelocity",
  "RotorAngle",
  "RotorVelocity",
  "ShipBaseMass",
  "ShipTotalMass",
  "ShipPhysicalMass",
  "NaturalGravity",
  "ArtificialGravity",
  "TotalGravity",
  "AngularSpeed",
] as const;
export const BOOLEAN_SOURCES = [
  "Enabled",
  "IsWorking",
  "IsFunctional",
  "BatteryIsCharging",
  "RotorLocked",
  "IsUnderControl",
  "HandBrake",
  "Dampeners",
] as const;
export const SOURCES = [...NUMERIC_SOURCES, ...BOOLEAN_SOURCES];
export type Source = (typeof SOURCES)[number];
export const isBooleanSource = (s: string) =>
  (BOOLEAN_SOURCES as readonly string[]).includes(s);
export const SOURCE_UNITS: Partial<Record<Source, string>> = {
  Speed: "m/s",
  PowerOutput: "MW",
  PowerMaxOutput: "MW",
  BatteryStoredPower: "MWh",
  BatteryMaxStoredPower: "MWh",
  BatteryInput: "MW",
  BatteryMaxInput: "MW",
  BatteryChargeRatio: "ratio",
  GasFillRatio: "ratio",
  DoorOpenRatio: "ratio",
  GasCapacity: "L",
  PistonPosition: "m",
  PistonVelocity: "m/s (set)",
  RotorAngle: "rad",
  RotorVelocity: "rpm (set)",
  ShipBaseMass: "kg",
  ShipTotalMass: "kg",
  ShipPhysicalMass: "kg",
  NaturalGravity: "m/s^2",
  ArtificialGravity: "m/s^2",
  TotalGravity: "m/s^2",
  AngularSpeed: "rad/s",
};
export const ANCHORS = [
  "TopLeft",
  "TopCenter",
  "TopRight",
  "CenterLeft",
  "Center",
  "CenterRight",
  "BottomLeft",
  "BottomCenter",
  "BottomRight",
] as const;
export type Property = (typeof MOTION_PROPERTIES)[number];
export type Anchor = (typeof ANCHORS)[number];
export interface Motion {
  property: Property;
  rate: number;
  mode?: "Clamp" | "Loop" | "PingPong";
  initial?: number;
  min?: number;
  max?: number;
  anchor?: Anchor;
  center?: [number, number];
}
export interface Binding {
  property: Property | "Data" | "Color" | "Visible";
  source: Source;
  blockName: string;
  inputMin?: number;
  inputMax?: number;
  outputMin?: number;
  outputMax?: number;
  anchor?: Anchor;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  mode?: "Clamp" | "Loop" | "PingPong";
  combine?: "Replace" | "Add" | "Multiply";
  center?: [number, number];
  thresholds?: number[];
  cases?: (string | boolean)[];
  minColor?: Color;
  maxColor?: Color;
}
function fail(message: string): never {
  throw Error(message);
}
function number(raw: string): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()))
    fail("Invalid number / 不正な数値");
  const n = Number(raw);
  if (!Number.isFinite(n)) fail("Number overflow / 数値の範囲超過");
  return n;
}
function checked(n: number): number {
  if (!Number.isFinite(n))
    fail("Animation overflow / アニメーション計算の範囲超過");
  return n;
}
function positive(n: number) {
  if (!Number.isFinite(Math.fround(n)) || Math.fround(n) <= 0)
    fail("TextScale must be positive / 文字倍率は正の有限値");
}
function typeCheck(e: Element, property: string) {
  if (e.type === "TEXT" && ["Width", "Height", "Angle"].includes(property))
    fail(
      "TEXT cannot use Width/Height/Angle / 文字には寸法・自転を指定できません",
    );
  if (e.type !== "TEXT" && ["TextScale"].includes(property))
    fail("Text/TextScale requires TEXT / 文字専用の属性です");
}
function base(e: Element, p: string) {
  return p === "Width"
    ? e.width!
    : p === "Height"
      ? e.height!
      : p === "TextScale"
        ? (e.scale ?? 1)
        : 0;
}
function rows<T>(
  text: string,
  elements: Element[],
  parse: (a: Map<string, string>, e: Element) => T,
): { element: string; value: T }[] {
  const result: { element: string; value: T }[] = [];
  const seen = new Set<string>();
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      if (line.length > 2048) fail("Line exceeds 2048 / 一行2048文字まで");
      const a = attributes(line),
        id = a.get("Element");
      const e = elements.find((e) => e.id === id);
      if (!e) fail("Unknown Element / 参照先の要素がありません");
      const key = id + "/" + a.get("Property");
      if (seen.has(key)) fail("Duplicate Property / 同じ属性が重複しています");
      const value = parse(a, e);
      seen.add(key);
      result.push({ element: id!, value });
    } catch (error) {
      fail(`Line / 行 ${i + 1}: ${(error as Error).message}`);
    }
  }
  return result;
}
function required(a: Map<string, string>, key: string) {
  return a.get(key) ?? fail("Missing / 必須: " + key);
}
function allowed(a: Map<string, string>, keys: string[]) {
  for (const key of a.keys())
    if (!keys.includes(key)) fail("Unsupported attribute / 未対応属性: " + key);
}
export function parseMotion(text: string, elements: Element[]) {
  return rows<Motion>(text, elements, (a, e) => {
    allowed(a, [
      "Element",
      "Property",
      "Rate",
      "Mode",
      "Initial",
      "Min",
      "Max",
      "Anchor",
      "Center",
    ]);
    const property = required(a, "Property") as Property;
    if (!MOTION_PROPERTIES.includes(property)) fail("Unknown Motion Property");
    typeCheck(e, property);
    const m: Motion = { property, rate: number(required(a, "Rate")) };
    if (a.has("Mode")) {
      m.mode = required(a, "Mode") as Motion["mode"];
      if (!["Clamp", "Loop", "PingPong"].includes(m.mode!))
        fail("Invalid Mode");
    }
    for (const [field, key] of [
      ["initial", "Initial"],
      ["min", "Min"],
      ["max", "Max"],
    ] as const)
      if (a.has(key)) m[field] = number(required(a, key));
    if (a.has("Anchor")) {
      m.anchor = required(a, "Anchor") as Anchor;
      if (!ANCHORS.includes(m.anchor)) fail("Invalid Anchor");
    }
    if (property === "Orbit") m.center = pair(required(a, "Center"));
    else if (a.has("Center")) fail("Center requires Orbit");
    if ((m.min === undefined) !== (m.max === undefined))
      fail("Min and Max must be paired / MinとMaxは両方指定");
    if ((m.mode ?? "Clamp") !== "Clamp" && m.min === undefined)
      fail("Loop/PingPong requires Min/Max");
    const initial = m.initial ?? base(e, property);
    if (
      m.min !== undefined &&
      (!(m.min < m.max!) ||
        initial < m.min ||
        initial > m.max! ||
        !Number.isFinite(m.max! - m.min) ||
        (m.mode === "PingPong" && !Number.isFinite(2 * (m.max! - m.min))))
    )
      fail("Invalid bounds or Initial / 範囲・初期値が不正です");
    if (property === "TextScale") {
      positive(initial);
      if (m.min !== undefined) {
        positive(m.min);
        positive(m.max!);
      }
    }
    return m;
  });
}
export function parseBinding(text: string, elements: Element[]) {
  return rows<Binding>(text, elements, (a, e) => {
    const source = required(a, "Source") as Binding["source"],
      property = required(a, "Property") as Binding["property"];
    const b: Binding = {
      property,
      source,
      blockName: quoted(required(a, "BlockName")),
    };
    if (!b.blockName) fail("Empty BlockName / 参照名は必須です");
    const common = ["Element", "Property", "Source", "BlockName"];
    typeCheck(e, property);
    if (!SOURCES.includes(source)) fail("Unknown Source");
    if (!(BINDING_PROPERTIES as readonly string[]).includes(property))
      fail("Unknown Binding Property");
    const bool = isBooleanSource(source);
    const keys = [...common];
    if (property === "Data" || property === "Visible") {
      if (a.has("Thresholds")) {
        b.thresholds = required(a, "Thresholds").split(",").map(number);
        if (b.thresholds.some((v, i, vs) => i > 0 && v <= vs[i - 1]))
          fail("Invalid Thresholds");
        b.cases = Array.from({ length: b.thresholds.length + 1 }, (_, i) => {
          keys.push("Case" + i);
          const raw = required(a, "Case" + i);
          if (property === "Visible") {
            if (!["true", "false"].includes(raw))
              fail("Visible Case requires true/false");
            return raw === "true";
          }
          const value = quoted(raw);
          if (value.length > 256 || (e.type === "TEXTURE" && !value))
            fail("Invalid Data Case");
          return value;
        });
        keys.push("Thresholds");
      } else {
        if (property !== "Data" || e.type !== "TEXT")
          fail("Thresholds required");
        keys.push("Decimals", "Prefix", "Suffix");
        if (a.has("Decimals")) {
          b.decimals = number(required(a, "Decimals"));
          if (!Number.isInteger(b.decimals) || b.decimals < 0 || b.decimals > 3)
            fail("Decimals must be 0..3");
        }
        if (a.has("Prefix")) b.prefix = quoted(required(a, "Prefix"));
        if (a.has("Suffix")) b.suffix = quoted(required(a, "Suffix"));
      }
    } else {
      keys.push("Mode");
      if (a.has("Mode")) {
        b.mode = required(a, "Mode") as Binding["mode"];
        if (
          !["Clamp", "Loop", "PingPong"].includes(b.mode!) ||
          (bool && b.mode !== "Clamp")
        )
          fail("Invalid Binding Mode");
      }
      if (!bool) {
        keys.push("InputMin", "InputMax");
        b.inputMin = number(required(a, "InputMin"));
        b.inputMax = number(required(a, "InputMax"));
        if (
          !(b.inputMin < b.inputMax) ||
          !Number.isFinite(b.inputMax - b.inputMin)
        )
          fail("Invalid Binding bounds");
      }
      if (property === "Color") {
        keys.push("MinColor", "MaxColor");
        b.minColor = color(required(a, "MinColor"));
        b.maxColor = color(required(a, "MaxColor"));
      } else {
        keys.push("OutputMin", "OutputMax", "Combine");
        b.outputMin = number(required(a, "OutputMin"));
        b.outputMax = number(required(a, "OutputMax"));
        if (!Number.isFinite(b.outputMax - b.outputMin))
          fail("Invalid Binding bounds");
        if (a.has("Combine")) {
          b.combine = required(a, "Combine") as Binding["combine"];
          if (!["Replace", "Add", "Multiply"].includes(b.combine!))
            fail("Invalid Combine");
        }
        if (property === "TextScale" && b.combine !== "Add") {
          positive(b.outputMin);
          positive(b.outputMax);
        }
        if (["Width", "Height"].includes(property)) {
          keys.push("Anchor");
          if (a.has("Anchor")) {
            b.anchor = required(a, "Anchor") as Anchor;
            if (!ANCHORS.includes(b.anchor)) fail("Invalid Anchor");
          }
        }
        if (property === "Orbit") {
          keys.push("Center");
          b.center = pair(required(a, "Center"));
        }
      }
    }
    if ((b.prefix?.length ?? 0) > 256 || (b.suffix?.length ?? 0) > 256)
      fail("Prefix/Suffix exceeds 256");
    allowed(a, keys);
    return b;
  });
}
function motionLine(id: string, m: Motion) {
  const a = [`Element=${id}`, `Property=${m.property}`, `Rate=${m.rate}`];
  for (const [key, field] of [
    ["Mode", "mode"],
    ["Initial", "initial"],
    ["Min", "min"],
    ["Max", "max"],
    ["Anchor", "anchor"],
  ] as const)
    if (m[field] !== undefined) a.push(`${key}=${m[field]}`);
  if (m.center !== undefined) a.push("Center=" + m.center.join(","));
  return a.join(";");
}
function bindingLine(id: string, b: Binding) {
  const a = [
    `Element=${id}`,
    `Property=${b.property}`,
    `Source=${b.source}`,
    `BlockName=${q(b.blockName)}`,
  ];
  for (const [key, field] of [
    ["InputMin", "inputMin"],
    ["InputMax", "inputMax"],
    ["OutputMin", "outputMin"],
    ["OutputMax", "outputMax"],
    ["Anchor", "anchor"],
    ["Decimals", "decimals"],
    ["Mode", "mode"],
    ["Combine", "combine"],
  ] as const)
    if (b[field] !== undefined) a.push(`${key}=${b[field]}`);
  for (const [key, field] of [
    ["Prefix", "prefix"],
    ["Suffix", "suffix"],
  ] as const)
    if (b[field] !== undefined) a.push(`${key}=${q(b[field]!)}`);
  for (const [key, field] of [
    ["MinColor", "minColor"],
    ["MaxColor", "maxColor"],
  ] as const)
    if (b[field] !== undefined) a.push(`${key}=${b[field]!.join(",")}`);
  if (b.center !== undefined) a.push("Center=" + b.center.join(","));
  if (b.thresholds !== undefined)
    a.push("Thresholds=" + b.thresholds.join(","));
  b.cases?.forEach((v, i) =>
    a.push("Case" + i + "=" + (typeof v === "string" ? q(v) : v)),
  );
  return a.join(";");
}
function exactRecord(
  value: unknown,
  keys: string[],
  strings: string[],
  arrays: string[],
) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("Invalid animation record");
  for (const [key, v] of Object.entries(value)) {
    if (!keys.includes(key)) fail("Unknown animation field: " + key);
    if (strings.includes(key)) {
      if (typeof v !== "string") fail("Invalid string: " + key);
    } else if (arrays.includes(key)) {
      if (
        !Array.isArray(v) ||
        (key === "cases"
          ? v.some((n) => typeof n !== "string" && typeof n !== "boolean")
          : v.some((n) => typeof n !== "number" || !Number.isFinite(n))) ||
        (!["thresholds", "cases"].includes(key) &&
          v.length !== (key === "center" ? 2 : 4))
      )
        fail("Invalid vector/color");
    } else if (typeof v !== "number" || !Number.isFinite(v))
      fail("Invalid numeric field: " + key);
  }
}
export function validateDynamics(e: Element): void {
  if (
    (e.motion !== undefined && !Array.isArray(e.motion)) ||
    (e.bindings !== undefined && !Array.isArray(e.bindings))
  )
    fail("Invalid animation arrays");
  for (const m of e.motion ?? [])
    exactRecord(
      m,
      ["property", "rate", "mode", "initial", "min", "max", "anchor", "center"],
      ["property", "mode", "anchor"],
      ["center"],
    );
  for (const b of e.bindings ?? [])
    exactRecord(
      b,
      [
        "property",
        "source",
        "blockName",
        "inputMin",
        "inputMax",
        "outputMin",
        "outputMax",
        "anchor",
        "decimals",
        "prefix",
        "suffix",
        "mode",
        "combine",
        "center",
        "thresholds",
        "cases",
        "minColor",
        "maxColor",
      ],
      [
        "property",
        "source",
        "blockName",
        "anchor",
        "prefix",
        "suffix",
        "mode",
        "combine",
      ],
      ["minColor", "maxColor", "center", "thresholds", "cases"],
    );
  const motions = parseMotion(
    (e.motion ?? []).map((m) => motionLine(e.id, m)).join("\n"),
    [e],
  ).map((r) => r.value);
  const bindings = parseBinding(
    (e.bindings ?? []).map((b) => bindingLine(e.id, b)).join("\n"),
    [e],
  ).map((r) => r.value);
  for (const b of bindings) {
    const m = motions.find((m) => m.property === b.property);
    if (!!m !== !!b.combine)
      fail(
        "Motion/Binding requires explicit Combine with matching Motion / 同じ属性のMotionとBindingにはCombineが必要です",
      );
    if (m && (m.anchor ?? "Center") !== (b.anchor ?? "Center"))
      fail("Combine Anchor mismatch");
    if (
      m &&
      b.property === "Orbit" &&
      b.combine !== "Replace" &&
      String(m.center) !== String(b.center)
    )
      fail("Combine Center mismatch");
  }
  const anchors = [...motions, ...bindings]
    .filter((m) => m.property === "Width" || m.property === "Height")
    .map((m) => m.anchor ?? "Center");
  if (new Set(anchors).size > 1)
    fail("Width/Height Anchor mismatch / 寸法の固定点が一致していません");
}
export function writeMotion(elements: Element[]) {
  elements.forEach(validateDynamics);
  return elements
    .flatMap((e) => (e.motion ?? []).map((m) => motionLine(e.id, m)))
    .join("\n");
}
export function writeBinding(elements: Element[]) {
  elements.forEach(validateDynamics);
  return elements
    .flatMap((e) => (e.bindings ?? []).map((b) => bindingLine(e.id, b)))
    .join("\n");
}
export function applyDynamics(
  elements: Element[],
  motionText: string,
  bindingText: string,
): Element[] {
  const ms = parseMotion(motionText, elements),
    bs = parseBinding(bindingText, elements);
  return elements.map((e) => {
    const next = { ...e };
    const motion = ms.filter((r) => r.element === e.id).map((r) => r.value),
      bindings = bs.filter((r) => r.element === e.id).map((r) => r.value);
    delete next.motion;
    delete next.bindings;
    if (motion.length) next.motion = motion;
    if (bindings.length) next.bindings = bindings;
    validateDynamics(next);
    return next;
  });
}
export function iniValue(key: "Motion" | "Binding", text: string) {
  return (
    key +
    "=" +
    (text
      ? "\n" +
        text
          .split("\n")
          .map((l) => "|" + l)
          .join("\n")
      : "")
  );
}
export interface PreviewSource {
  speed?: number;
  enabled?: boolean;
  values?: Partial<Record<Source, number | boolean>>;
}
export function evaluateMotion(m: Motion, e: Element, time: number): number {
  let v = checked((m.initial ?? base(e, m.property)) + checked(m.rate * time));
  if (m.min !== undefined) {
    const min = m.min,
      max = m.max!,
      w = max - min;
    if ((m.mode ?? "Clamp") === "Clamp") v = Math.max(min, Math.min(max, v));
    else {
      const period = m.mode === "Loop" ? w : 2 * w;
      const z = checked(v - min);
      const r = checked(z - checked(period * Math.floor(z / period)));
      v = min + (m.mode === "Loop" || r <= w ? r : period - r);
    }
  }
  if (m.property === "TextScale") positive(v);
  return checked(v);
}
/** One preview traversal per motion; mixed motions use the longest duration. */
export function motionPreviewDuration(
  e: Element,
  size: readonly [number, number],
): number {
  let duration = 0;
  for (const m of e.motion ?? []) {
    if (m.rate === 0) continue;
    let distance: number;
    if (m.min !== undefined && m.max !== undefined) {
      distance =
        m.mode === "Loop"
          ? m.max - m.min
          : m.mode === "PingPong"
            ? 2 * (m.max - m.min)
            : Math.abs((m.rate > 0 ? m.max : m.min) - evaluateMotion(m, e, 0));
    } else {
      distance =
        m.property === "Angle" || m.property === "Orbit"
          ? 360
          : m.property === "TextScale"
            ? 1
            : m.property === "MoveY" || m.property === "Height"
              ? size[1]
              : size[0];
    }
    const seconds = distance / Math.abs(m.rate);
    if (Number.isFinite(seconds)) duration = Math.max(duration, seconds);
  }
  return duration;
}
export function evaluateElements(
  elements: Element[],
  time: number,
  sources: Record<string, PreviewSource>,
): Element[] {
  if (!Number.isFinite(time) || time < 0) fail("Invalid preview time");
  const snapshot = new Map(
    Object.entries(sources).map(([name, value]) => [
      name,
      { ...value, values: { ...value.values } },
    ]),
  );
  return elements.map((e) => {
    validateDynamics(e);
    const result = structuredClone(e);
    const values = new Map<string, number>();
    for (const m of e.motion ?? [])
      values.set(m.property, evaluateMotion(m, e, time));
    for (const b of e.bindings ?? []) {
      const source =
        snapshot.get(b.blockName) ??
        fail("Missing simulated source / 模擬参照がありません: " + b.blockName);
      const raw =
        source.values?.[b.source] ??
        (b.source === "Speed"
          ? source.speed
          : b.source === "Enabled"
            ? source.enabled
            : undefined);
      const bool = isBooleanSource(b.source);
      if (typeof raw !== (bool ? "boolean" : "number"))
        fail("Invalid simulated " + b.source);
      const input = checked(bool ? (raw ? 1 : 0) : (raw as number));
      if (b.thresholds) {
        const value = b.cases![b.thresholds.filter((t) => input >= t).length];
        if (b.property === "Visible") result.hidden = !!e.hidden || !value;
        else result.data = value as string;
      } else if (b.property === "Data") {
        if (Math.abs(input) >= 1e21)
          fail("Source too large for fixed decimal preview");
        result.data =
          (b.prefix ?? "") + input.toFixed(b.decimals ?? 1) + (b.suffix ?? "");
        if (result.data.length > 256) fail("Text exceeds 256");
      } else {
        let u = bool
          ? input
          : (b.mode ?? "Clamp") === "Clamp" && input <= b.inputMin!
            ? 0
            : (b.mode ?? "Clamp") === "Clamp" && input >= b.inputMax!
              ? 1
              : checked(
                  checked(input - b.inputMin!) / (b.inputMax! - b.inputMin!),
                );
        if ((b.mode ?? "Clamp") === "Clamp") u = Math.max(0, Math.min(1, u));
        else if (b.mode === "Loop") u = checked(u - Math.floor(u));
        else {
          u = checked(u - checked(2 * Math.floor(u / 2)));
          if (u > 1) u = 2 - u;
        }
        if (b.property === "Color")
          result.color = b.minColor!.map((v, i) =>
            Math.round(v + (b.maxColor![i] - v) * u),
          ) as Color;
        else {
          let v = checked(
            u === 0
              ? b.outputMin!
              : u === 1
                ? b.outputMax!
                : b.outputMin! + checked((b.outputMax! - b.outputMin!) * u),
          );
          if (b.combine === "Add") v = checked(values.get(b.property)! + v);
          if (b.combine === "Multiply")
            v = checked(values.get(b.property)! * v);
          if (b.property === "TextScale") positive(v);
          values.set(b.property, v);
        }
      }
    }
    const da = values.get("Angle") ?? 0,
      b = values.get("Orbit") ?? 0;
    if (e.type === "TEXTURE") {
      result.width = values.get("Width") ?? e.width!;
      result.height = values.get("Height") ?? e.height!;
      const dims = [...(e.motion ?? []), ...(e.bindings ?? [])].find(
        (m) => m.property === "Width" || m.property === "Height",
      );
      const anchor =
        dims?.anchor ??
        (dims
          ? "Center"
          : (e.motion?.find((m) => m.property === "Angle")?.anchor ??
            "Center"));
      const index = ANCHORS.indexOf(anchor),
        qx = ((index % 3) - 1) / 2,
        qy = (Math.floor(index / 3) - 1) / 2;
      const rotate = (
        x: number,
        y: number,
        degrees: number,
      ): [number, number] => {
        const a = checked((degrees * Math.PI) / 180);
        return [
          checked(Math.cos(a) * x - Math.sin(a) * y),
          checked(Math.sin(a) * x + Math.cos(a) * y),
        ];
      };
      const a0 = e.angle ?? 0,
        before = rotate(qx * e.width!, qy * e.height!, a0),
        after = rotate(qx * result.width, qy * result.height, checked(a0 + da));
      result.x = checked(e.x + before[0] - after[0]);
      result.y = checked(e.y + before[1] - after[1]);
      result.angle = checked(a0 + da);
    } else result.scale = values.get("TextScale") ?? e.scale ?? 1;
    const orbit =
      e.bindings?.find((m) => m.property === "Orbit") ??
      e.motion?.find((m) => m.property === "Orbit");
    if (orbit) {
      const [cx, cy] = orbit.center!,
        a = checked((b * Math.PI) / 180),
        x = checked(result.x - cx),
        y = checked(result.y - cy);
      result.x = checked(cx + Math.cos(a) * x - Math.sin(a) * y);
      result.y = checked(cy + Math.sin(a) * x + Math.cos(a) * y);
    }
    result.x = checked(result.x + (values.get("MoveX") ?? 0));
    result.y = checked(result.y + (values.get("MoveY") ?? 0));
    for (const v of [
      result.x,
      result.y,
      result.width,
      result.height,
      result.angle,
      result.scale,
    ])
      if (v !== undefined && !Number.isFinite(Math.fround(v)))
        fail("Animation exceeds float range / プレビュー値の範囲超過");
    return result;
  });
}
