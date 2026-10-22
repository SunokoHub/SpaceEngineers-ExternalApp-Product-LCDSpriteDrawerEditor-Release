import { validateDynamics, type Motion, type Binding } from "./dynamics";
export const CONTRACT = "d81e015a1c9552c9e5196fbb042b7b861baf6e5f";
export type Color = [number, number, number, number];
export interface Element {
  group?: string;
  motion?: Motion[];
  bindings?: Binding[];
  hidden?: boolean;
  locked?: boolean;
  id: string;
  type: "TEXTURE" | "TEXT";
  data: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: Color;
  angle?: number;
  scale?: number;
  font?: string;
  alignment?: "LEFT" | "CENTER" | "RIGHT";
}
export interface Surface {
  index: number;
  name: string;
  texture: [number, number];
  size: [number, number];
  foreground: Color;
  background: Color;
  elements: Element[];
}
export interface Block {
  id: string;
  name: string;
  type: string;
  surfaces: Surface[];
}
export interface Project {
  version: 5;
  contract: string;
  configFormatVersion: 1;
  surfaceInfoFormatVersion: 1;
  blocks: Block[];
}
export function emptyProject(): Project {
  return {
    version: 5,
    contract: CONTRACT,
    configFormatVersion: 1,
    surfaceInfoFormatVersion: 1,
    blocks: [],
  };
}
function fail(message: string): never {
  throw new Error(message);
}
export function finite(s: string): number {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s.trim()))
    fail(`Invalid number / 不正な数値: ${s}`);
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isFinite(Math.fround(n)))
    fail("Number overflow / 数値の範囲超過");
  return n;
}
export function pair(s: string): [number, number] {
  const p = s.split(",");
  if (p.length !== 2) fail("Expected x,y / 2値が必要");
  return [finite(p[0]), finite(p[1])];
}
export function color(s: string): Color {
  const p = s.split(",").map(finite);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    fail("Invalid RGBA / 不正なRGBA");
  return p as Color;
}
export function quoted(s: string): string {
  if (!/^"(?:[^"\\\r\n]|\\["\\nrt])*"$/.test(s))
    fail("Invalid string escape / 不正な文字列エスケープ");
  return s
    .slice(1, -1)
    .replace(
      /\\(["\\nrt])/g,
      (_, c: string) =>
        ({ n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" })[c]!,
    );
}
export function attributes(line: string): Map<string, string> {
  const pieces: string[] = [];
  let start = 0,
    inside = false,
    escaped = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inside && c === "\\") {
      escaped = true;
      continue;
    }
    if (c === '"') inside = !inside;
    if (c === ";" && !inside) {
      pieces.push(line.slice(start, i));
      start = i + 1;
    }
  }
  if (inside || escaped) fail("Unclosed string / 引用符が閉じていません");
  pieces.push(line.slice(start));
  if (!pieces.at(-1)!.trim()) pieces.pop();
  const result = new Map<string, string>();
  for (const p of pieces) {
    const match = /^\s*([A-Za-z][A-Za-z0-9]*)\s*=\s*(.*?)\s*$/.exec(p);
    if (!match || result.has(match[1]))
      fail("Invalid or duplicate attribute / 不正・重複属性");
    result.set(match[1], match[2]);
  }
  return result;
}
export function parseLayout(text: string): Element[] {
  const elements: Element[] = [],
    ids = new Set<string>();
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    try {
      if (raw.length > 2048) fail("Line exceeds 2048 / 行が2048文字を超過");
      const a = attributes(raw),
        get = (k: string) => a.get(k) ?? fail(`Missing / 必須: ${k}`);
      const id = get("Id"),
        type = get("Type");
      if (!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(id) || ids.has(id))
        fail("Invalid or duplicate Id / 不正・重複ID");
      if (type !== "TEXTURE" && type !== "TEXT")
        fail("Unsupported Type / 未対応のType");
      const allowed = new Set([
        "Id",
        "Type",
        "Data",
        "Position",
        "Color",
        "Alignment",
        ...(type === "TEXTURE"
          ? ["Size", "AngleDegrees"]
          : ["TextScale", "FontId"]),
      ]);
      for (const k of a.keys())
        if (!allowed.has(k)) fail(`Unsupported attribute / 未対応属性: ${k}`);
      const data = quoted(get("Data"));
      if (data.length > 256 || (type === "TEXTURE" && !data))
        fail("Invalid Data length / Dataの文字数不正");
      const [x, y] = a.has("Position") ? pair(get("Position")) : [0, 0];
      const e: Element = { id, type, data, x, y };
      if (a.has("Color")) e.color = color(get("Color"));
      if (a.has("Alignment")) {
        const v = get("Alignment");
        if (
          !["LEFT", "CENTER", "RIGHT"].includes(v) ||
          (type === "TEXTURE" && v !== "CENTER")
        )
          fail("Invalid Alignment");
        e.alignment = v as Element["alignment"];
      }
      if (type === "TEXTURE") {
        [e.width, e.height] = pair(get("Size"));
        if (a.has("AngleDegrees")) e.angle = finite(get("AngleDegrees"));
      } else {
        if (a.has("TextScale")) {
          e.scale = finite(get("TextScale"));
          if (Math.fround(e.scale) <= 0)
            fail("TextScale must be positive / TextScaleは正数");
        }
        if (a.has("FontId")) {
          e.font = quoted(get("FontId"));
          if (!e.font) fail("Empty FontId");
        }
      }
      ids.add(id);
      elements.push(e);
      if (elements.length > 32) fail("Maximum 32 elements / 一面32要素まで");
    } catch (error) {
      fail(`Line / 行 ${i + 1}: ${(error as Error).message}`);
    }
  }
  return elements;
}
export const q = (s: string) =>
  '"' +
  s.replace(
    /[\\"\n\r\t]/g,
    (c) =>
      ({ "\\": "\\\\", '"': '\\"', "\n": "\\n", "\r": "\\r", "\t": "\\t" })[c]!,
  ) +
  '"';
export function writeLayout(elements: Element[]): string {
  const text = elements
    .map((e) => {
      const a = [
        `Id=${e.id}`,
        `Type=${e.type}`,
        `Data=${q(e.data)}`,
        `Position=${e.x},${e.y}`,
      ];
      if (e.type === "TEXTURE") {
        a.push(`Size=${e.width},${e.height}`);
        if (e.angle !== undefined) a.push(`AngleDegrees=${e.angle}`);
      } else {
        if (e.scale !== undefined) a.push(`TextScale=${e.scale}`);
        if (e.font !== undefined) a.push(`FontId=${q(e.font)}`);
      }
      if (e.color) a.push(`Color=${e.color.join(",")}`);
      if (e.alignment) a.push(`Alignment=${e.alignment}`);
      return a.join(";");
    })
    .join("\n");
  parseLayout(text);
  return text;
}
export function iniLayout(elements: Element[]): string {
  const text = writeLayout(elements);
  return (
    "Layout=" +
    (text
      ? "\n" +
        text
          .split("\n")
          .map((l) => "|" + l)
          .join("\n")
      : "")
  );
}
export function parseSurfaceInfo(text: string): Block {
  if (text.length > 8000) fail("Info exceeds 8000 characters");
  const sections = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined, lastKey: string | undefined;
  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith(";")) continue;
    if (raw.startsWith("|")) {
      if (!current || !lastKey) fail(`Invalid continuation: ${i + 1}`);
      current.set(
        lastKey,
        (current.get(lastKey) ? current.get(lastKey) + "\n" : "") +
          raw.slice(1),
      );
      continue;
    }
    const heading = /^\[([^\]]+)\]$/.exec(line);
    if (heading) {
      const key = heading[1].toLowerCase();
      if (sections.has(key)) fail("Duplicate section");
      current = new Map();
      sections.set(key, current);
      lastKey = undefined;
      continue;
    }
    const entry = /^([^=]+)=(.*)$/.exec(line);
    if (!entry || !current) fail(`Invalid INI line: ${i + 1}`);
    const key = entry[1].trim().toLowerCase();
    if (current.has(key)) fail("Duplicate key");
    current.set(key, entry[2].trim());
    lastKey = key;
  }
  const section = (name: string, keys: string[]) => {
    const s =
      sections.get(name.toLowerCase()) ?? fail(`Missing section: ${name}`);
    for (const key of s.keys())
      if (!keys.map((k) => k.toLowerCase()).includes(key))
        fail(`Unsupported key: ${key}`);
    return (key: string) => s.get(key.toLowerCase()) ?? fail(`Missing: ${key}`);
  };
  const head = section("SurfaceInfo", [
    "SurfaceInfoFormatVersion",
    "BlockId",
    "BlockName",
    "BlockType",
    "SurfaceCount",
  ]);
  if (head("SurfaceInfoFormatVersion") !== "1")
    fail("Unsupported SurfaceInfoFormatVersion");
  const id = head("BlockId");
  if (!/^[1-9]\d*$/.test(id) || BigInt(id) > 9223372036854775807n)
    fail("Invalid BlockId");
  const count = finite(head("SurfaceCount"));
  if (!Number.isInteger(count) || count < 1) fail("Invalid SurfaceCount");
  if (sections.size !== count + 1)
    fail("Surface count mismatch / 面数の不一致");
  const surfaces: Surface[] = [];
  for (let i = 0; i < count; i++) {
    const get = section(`SurfaceInfo.Surface.${i}`, [
      "DisplayName",
      "TextureSize",
      "SurfaceSize",
      "ForegroundColor",
      "BackgroundColor",
    ]);
    const texture = pair(get("TextureSize")),
      size = pair(get("SurfaceSize"));
    if ([...texture, ...size].some((n) => n <= 0))
      fail("Invalid surface dimensions");
    surfaces.push({
      index: i,
      name: get("DisplayName"),
      texture,
      size,
      foreground: color(get("ForegroundColor")),
      background: color(get("BackgroundColor")),
      elements: [],
    });
  }
  return { id, name: head("BlockName"), type: head("BlockType"), surfaces };
}
export function parseProject(text: string): Project {
  const p = JSON.parse(text) as Omit<Project, "version"> & { version: number };
  const exact = (o: object, keys: string[]) => {
    if (
      !o ||
      typeof o !== "object" ||
      Array.isArray(o) ||
      Object.keys(o).some((k) => !keys.includes(k))
    )
      fail("Unsupported project field / 未対応の保存項目");
  };
  exact(p, [
    "version",
    "contract",
    "configFormatVersion",
    "surfaceInfoFormatVersion",
    "blocks",
  ]);
  if (
    (p.version !== 4 && p.version !== 5) ||
    p.contract !== CONTRACT ||
    p.configFormatVersion !== 1 ||
    p.surfaceInfoFormatVersion !== 1 ||
    !Array.isArray(p.blocks)
  )
    fail("Unsupported project version / 未対応の保存形式");
  const ids = new Set<string>();
  for (const b of p.blocks) {
    exact(b, ["id", "name", "type", "surfaces"]);
    if (
      typeof b.id !== "string" ||
      typeof b.name !== "string" ||
      typeof b.type !== "string" ||
      !Array.isArray(b.surfaces) ||
      !b.surfaces.length ||
      ids.has(b.id)
    )
      fail("Invalid block");
    ids.add(b.id);
    const info = [
      "[SurfaceInfo]",
      "SurfaceInfoFormatVersion=1",
      `BlockId=${b.id}`,
      "BlockName=project",
      "BlockType=project",
      `SurfaceCount=${b.surfaces.length}`,
    ];
    for (const [i, s] of b.surfaces.entries()) {
      exact(s, [
        "index",
        "name",
        "texture",
        "size",
        "foreground",
        "background",
        "elements",
      ]);
      if (
        s.index !== i ||
        typeof s.name !== "string" ||
        !Array.isArray(s.elements)
      )
        fail("Invalid surface");
      for (const key of [
        "texture",
        "size",
        "foreground",
        "background",
      ] as const)
        if (
          !Array.isArray(s[key]) ||
          s[key].some((n) => typeof n !== "number" || !Number.isFinite(n))
        )
          fail("Invalid surface values");
      info.push(
        `[SurfaceInfo.Surface.${i}]`,
        "DisplayName=project",
        `TextureSize=${s.texture}`,
        `SurfaceSize=${s.size}`,
        `ForegroundColor=${s.foreground}`,
        `BackgroundColor=${s.background}`,
      );
      for (const e of s.elements) {
        exact(e, [
          "id",
          "type",
          "data",
          "x",
          "y",
          "width",
          "height",
          "color",
          "angle",
          "scale",
          "font",
          "alignment",
          ...(p.version >= 2 ? ["hidden", "locked"] : []),
          ...(p.version >= 4 ? ["motion", "bindings"] : []),
          ...(p.version >= 5 ? ["group"] : []),
        ]);
        for (const key of ["hidden", "locked"] as const)
          if (e[key] !== undefined && typeof e[key] !== "boolean")
            fail("Invalid editor flag");
        if (
          typeof e.id !== "string" ||
          typeof e.data !== "string" ||
          !["TEXTURE", "TEXT"].includes(e.type) ||
          typeof e.x !== "number" ||
          typeof e.y !== "number" ||
          !Number.isFinite(e.x) ||
          !Number.isFinite(e.y)
        )
          fail("Invalid element");
        for (const key of ["width", "height", "angle", "scale"] as const) {
          if (e[key] !== undefined &&
            (typeof e[key] !== "number" || !Number.isFinite(e[key])))
            fail(`Invalid numeric field / 要素 ${e.id}: ${key}`);
        }
        if (e.font !== undefined && typeof e.font !== "string")
          fail("Invalid FontId");
        if (e.alignment !== undefined && typeof e.alignment !== "string")
          fail("Invalid Alignment");
        if (
          e.color !== undefined &&
          (!Array.isArray(e.color) ||
            e.color.some((n) => typeof n !== "number"))
        )
          fail("Invalid color");
        if (
          (e.type === "TEXT" &&
            (e.width !== undefined ||
              e.height !== undefined ||
              e.angle !== undefined)) ||
          (e.type === "TEXTURE" &&
            (e.font !== undefined || e.scale !== undefined))
        )
          fail("Invalid element fields");
      }
      try {
        s.elements = validateElements(s.elements);
      } catch (error) {
        fail(`Block / ブロック ${b.id}, Surface / 面 ${i}: ${(error as Error).message}`);
      }
    }
    parseSurfaceInfo(info.join("\n"));
  }
  p.version = 5;
  p.contract = CONTRACT;
  return p as Project;
}

export function validateElements(elements: Element[]): Element[] {
  elements.forEach((e) => {
    try {
      validateDynamics(e);
    } catch (error) {
      fail(`Element / 要素 ${e.id}: ${(error as Error).message}`);
    }
    if (e.group !== undefined && (typeof e.group !== "string" || !e.group.trim() || e.group.length > 80))
      fail("Invalid group name / グループ名は1〜80文字");
  });
  return parseLayout(writeLayout(elements)).map((e, i) => ({
    ...e,
    ...(elements[i].group !== undefined ? { group: elements[i].group } : {}),
    ...(elements[i].motion !== undefined
      ? { motion: structuredClone(elements[i].motion) }
      : {}),
    ...(elements[i].bindings !== undefined
      ? { bindings: structuredClone(elements[i].bindings) }
      : {}),
    ...(elements[i].hidden !== undefined ? { hidden: elements[i].hidden } : {}),
    ...(elements[i].locked !== undefined ? { locked: elements[i].locked } : {}),
  }));
}

export function serializeProject(project: Project): string {
  const text = JSON.stringify(project, null, 2);
  parseProject(text);
  return text;
}
