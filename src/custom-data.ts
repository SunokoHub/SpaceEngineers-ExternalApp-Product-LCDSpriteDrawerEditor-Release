import {
  parseSurfaceInfo,
  parseLayout,
  writeLayout,
  validateElements,
  type Block,
  type Surface,
} from "./model";
import { applyDynamics, writeMotion, writeBinding } from "./dynamics";

const settings = "settings.lcdspritedrawer";
interface Entry {
  value: string;
  start: number;
  end: number;
}
interface Section {
  name: string;
  start: number;
  end: number;
  entries: Map<string, Entry>;
}
function document(text: string) {
  if (text.length > 32000)
    throw Error("CustomData exceeds 32,000 characters / 全文32,000文字まで");
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const sections = new Map<string, Section>();
  let current: Section | undefined,
    last: Entry | undefined,
    offset = 0,
    tail = text.length;
  for (const raw of lines) {
    const line = raw.replace(/\r?\n$/, ""),
      trimmed = line.trim();
    if (trimmed === "---") {
      tail = offset;
      break;
    }
    if (line.startsWith("|")) {
      if (!last) throw Error("Invalid INI continuation");
      last.value += (last.value ? "\n" : "") + line.slice(1);
      last.end = offset + raw.length;
    } else if (!trimmed || trimmed.startsWith(";")) {
      last = undefined;
    } else if (/^\[[^\]]+\]$/.test(trimmed)) {
      if (current) current.end = offset;
      const name = trimmed.slice(1, -1).toLowerCase();
      if (sections.has(name))
        throw Error("Duplicate INI section / セクション重複");
      current = { name, start: offset, end: text.length, entries: new Map() };
      sections.set(name, current);
      last = undefined;
    } else {
      const match = /^([^=]+)=(.*)$/.exec(trimmed);
      if (!current || !match) throw Error("Invalid INI line / INI解析不能");
      const key = match[1].trim().toLowerCase();
      if (current.entries.has(key)) throw Error("Duplicate INI key / キー重複");
      last = {
        value: match[2].trim(),
        start: offset,
        end: offset + raw.length,
      };
      current.entries.set(key, last);
    }
    offset += raw.length;
  }
  if (current) current.end = tail;
  return { sections, tail };
}
function value(s: Section | undefined, key: string) {
  return s?.entries.get(key.toLowerCase())?.value ?? "";
}
function read(text: string) {
  const doc = document(text),
    head = doc.sections.get("surfaceinfo");
  const count = Number(value(head, "SurfaceCount"));
  if (!Number.isInteger(count) || count < 1 || count > text.length)
    throw Error("Invalid SurfaceCount");
  const keys = [
    "SurfaceInfoFormatVersion",
    "BlockId",
    "BlockName",
    "BlockType",
    "SurfaceCount",
  ];
  const info = ["[SurfaceInfo]", ...keys.map((k) => `${k}=${value(head, k)}`)];
  for (let i = 0; i < count; i++) {
    const s = doc.sections.get(`surfaceinfo.surface.${i}`);
    info.push(
      `[SurfaceInfo.Surface.${i}]`,
      ...[
        "DisplayName",
        "TextureSize",
        "SurfaceSize",
        "ForegroundColor",
        "BackgroundColor",
      ].map((k) => `${k}=${value(s, k)}`),
    );
  }
  const block = parseSurfaceInfo(info.join("\n"));
  const config = doc.sections.get(settings);
  if (value(config, "ConfigFormatVersion") !== "1")
    throw Error("Unsupported ConfigFormatVersion");
  const owner = value(config, "Owner");
  if (!/^[1-9]\d*$/.test(owner) || BigInt(owner) > 9223372036854775807n)
    throw Error("Invalid Owner");
  const managed = value(config, "Surfaces")
    .split(",")
    .map((v) => v.trim());
  if (
    managed.some((v) => !/^\d+$/.test(v) || Number(v) >= count) ||
    new Set(managed.map(Number)).size !== managed.length
  )
    throw Error("Invalid managed Surfaces");
  for (const s of block.surfaces) {
    const section = doc.sections.get(`${settings}.surface.${s.index}`);
    s.elements = validateElements(
      applyDynamics(
        parseLayout(value(section, "Layout")),
        value(section, "Motion"),
        value(section, "Binding"),
      ),
    );
  }
  return { ...doc, block, managed: managed.map(Number) };
}
/** Import editing data only. The final merge always requires a fresh document. */
export function importCustomData(text: string): Block {
  return read(text).block;
}

/** Selected surfaces become managed; all other current settings are retained. */
export function replaceCustomData(
  text: string,
  block: Block,
  surface: Surface | Surface[],
): string {
  const surfaces = (Array.isArray(surface) ? surface : [surface])
    .slice()
    .sort((a, b) => a.index - b.index);
  if (!surfaces.length)
    throw Error("Select output surfaces / 出力する面を選んでください");
  if (new Set(surfaces.map((s) => s.index)).size !== surfaces.length)
    throw Error("Duplicate output surface");
  const doc = read(text);
  if (doc.block.id !== block.id) {
    const structure = (b: Block) => JSON.stringify(b.surfaces
      .map((s) => ({ index: s.index, size: s.size, texture: s.texture }))
      .sort((a, b) => a.index - b.index));
    if (structure(doc.block) !== structure(block))
      throw Error("Different surface structure / 別ブロックへの出力には全表示面の番号・表示寸法・テクスチャ寸法の一致が必要です");
  }
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const patches: { start: number; end: number; text: string }[] = [];
  const managed = [
    ...new Set([...doc.managed, ...surfaces.map((s) => s.index)]),
  ].sort((a, b) => a - b);
  if (managed.length !== doc.managed.length) {
    const entry = doc.sections.get(settings)!.entries.get("surfaces")!;
    patches.push({
      start: entry.start,
      end: entry.end,
      text: `Surfaces=${managed.join(",")}${newline}`,
    });
  }
  for (const surface of surfaces) {
    const fresh = doc.block.surfaces.find((s) => s.index === surface.index);
    if (
      !fresh ||
      JSON.stringify([fresh.size, fresh.texture]) !==
        JSON.stringify([surface.size, surface.texture])
    )
      throw Error(
        "Surface changed / 面情報が変更されています。再取込してください",
      );
    const elements = validateElements(surface.elements);
    const section = doc.sections.get(`${settings}.surface.${surface.index}`);
    let missing = "";
    for (const [key, body] of [
      ["Layout", writeLayout(elements)],
      ["Motion", writeMotion(elements)],
      ["Binding", writeBinding(elements)],
    ] as const) {
      const replacement =
        (
          key +
          "=" +
          (body
            ? "\n" +
              body
                .split("\n")
                .map((line) => "|" + line)
                .join("\n")
            : "")
        ).replace(/\n/g, newline) + newline;
      const entry = section?.entries.get(key.toLowerCase());
      if (entry)
        patches.push({ start: entry.start, end: entry.end, text: replacement });
      else missing += replacement;
    }
    if (missing) {
      const at = section?.end ?? doc.tail;
      const addition = {
        start: at,
        end: at,
        text:
          (at && !text.slice(0, at).endsWith("\n") ? newline : "") +
          (section
            ? ""
            : `[Settings.LCDSpriteDrawer.Surface.${surface.index}]${newline}`) +
          missing,
      };
      // Multiple absent sections can share the same insertion point.
      const previous = patches.find((p) => p.start === at && p.end === at);
      if (previous) previous.text += addition.text;
      else patches.push(addition);
    }
  }
  let result = text;
  for (const patch of patches.sort((a, b) => b.start - a.start))
    result =
      result.slice(0, patch.start) + patch.text + result.slice(patch.end);
  read(result);
  return result;
}
