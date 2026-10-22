import type { Element } from "./model";
export function bounds(e: Element) {
  const w =
    e.type === "TEXTURE"
      ? Math.abs(e.width ?? 100)
      : Math.max(1, ...e.data.split("\n").map((l) => l.length)) *
        17 *
        (e.scale ?? 1);
  const h =
    e.type === "TEXTURE"
      ? Math.abs(e.height ?? 30)
      : 28 * (e.scale ?? 1) * (1 + 1.2 * (e.data.split("\n").length - 1));
  const a = ((e.angle ?? 0) * Math.PI) / 180;
  const width = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
  const height = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const left =
    e.type === "TEXT" && e.alignment === "LEFT"
      ? e.x
      : e.type === "TEXT" && e.alignment === "RIGHT"
        ? e.x - width
        : e.x - width / 2;
  const top = e.type === "TEXT" ? e.y : e.y - height / 2;
  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height,
    cx: left + width / 2,
    cy: top + height / 2,
  };
}
export function groupBounds(elements: Element[]) {
  const boxes = elements.map(bounds);
  const left = Math.min(...boxes.map((b) => b.left)),
    right = Math.max(...boxes.map((b) => b.right));
  const top = Math.min(...boxes.map((b) => b.top)),
    bottom = Math.max(...boxes.map((b) => b.bottom));
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    cx: (left + right) / 2,
    cy: (top + bottom) / 2,
  };
}
export function arrangeCircular(
  elements: Element[],
  options: {
    cx: number;
    cy: number;
    radius: number;
    start: number;
    sweep: number;
    offset: number;
    rotate: boolean;
  },
  anglesOnly = false,
) {
  if (!Object.values(options).every((v) => typeof v === "boolean" || Number.isFinite(v)) ||
      options.radius < 0 || Math.abs(options.sweep) > 360)
    throw new Error("Invalid circular arrangement parameters");
  const targets = elements.filter((e) => !e.hidden && !e.locked);
  const fullCircle = Math.abs(options.sweep) === 360;
  targets.forEach((e, i) => {
    const box = bounds(e);
    const angle = anglesOnly
      ? Math.atan2(box.cy - options.cy, box.cx - options.cx) * 180 / Math.PI
      : options.start + options.sweep * i / Math.max(1, fullCircle ? targets.length : targets.length - 1);
    if (anglesOnly && box.cx === options.cx && box.cy === options.cy) return;
    if (!anglesOnly) {
      const radians = angle * Math.PI / 180;
      e.x += options.cx + options.radius * Math.cos(radians) - box.cx;
      e.y += options.cy + options.radius * Math.sin(radians) - box.cy;
    }
    if (e.type === "TEXTURE" && (anglesOnly || options.rotate))
      e.angle = ((angle + options.offset) % 360 + 360) % 360;
  });
}
export function arrange(elements: Element[], mode: string) {
  if (elements.length < 2) return;
  const b = groupBounds(elements);
  if (mode === "distribute-x" || mode === "distribute-y") {
    if (elements.length < 3) return;
    const horizontal = mode === "distribute-x";
    const sorted = [...elements].sort((a, b) =>
      horizontal
        ? bounds(a).left - bounds(b).left
        : bounds(a).top - bounds(b).top,
    );
    const size = sorted.reduce(
      (n, e) => n + (horizontal ? bounds(e).width : bounds(e).height),
      0,
    );
    const gap =
      ((horizontal ? b.width : b.height) - size) / (sorted.length - 1);
    let position = horizontal ? b.left : b.top;
    sorted.forEach((e) => {
      const box = bounds(e);
      if (horizontal) e.x += position - box.left;
      else e.y += position - box.top;
      position += (horizontal ? box.width : box.height) + gap;
    });
  } else
    elements.forEach((e) => {
      const box = bounds(e);
      if (mode === "left") e.x += b.left - box.left;
      if (mode === "right") e.x += b.right - box.right;
      if (mode === "align-x") e.x += b.cx - box.cx;
      if (mode === "top") e.y += b.top - box.top;
      if (mode === "bottom") e.y += b.bottom - box.bottom;
      if (mode === "align-y") e.y += b.cy - box.cy;
    });
}
export function snapGroup(
  moving: Element[],
  others: Element[],
  dx: number,
  dy: number,
  threshold: number,
) {
  const b = groupBounds(moving),
    guides: { x?: number; y?: number } = {};
  let bestX = threshold + 1,
    bestY = threshold + 1,
    adjustX = 0,
    adjustY = 0;
  for (const e of others.filter((e) => !e.hidden)) {
    const target = bounds(e);
    for (const from of [b.left, b.cx, b.right])
      for (const to of [target.left, target.cx, target.right]) {
        const delta = to - (from + dx);
        if (Math.abs(delta) <= threshold && Math.abs(delta) < bestX) {
          bestX = Math.abs(delta);
          adjustX = delta;
          guides.x = to;
        }
      }
    for (const from of [b.top, b.cy, b.bottom])
      for (const to of [target.top, target.cy, target.bottom]) {
        const delta = to - (from + dy);
        if (Math.abs(delta) <= threshold && Math.abs(delta) < bestY) {
          bestY = Math.abs(delta);
          adjustY = delta;
          guides.y = to;
        }
      }
  }
  return { dx: dx + adjustX, dy: dy + adjustY, guides };
}

/** Move selected editable layers in their original order around the target row. */
export function reorderElements(
  elements: Element[],
  ids: string[],
  targetId: string,
  after: boolean,
): Element[] {
  const movers = elements.filter(
    (e) => ids.includes(e.id) && !e.locked && !e.hidden,
  );
  if (
    !movers.length ||
    movers.some((e) => e.id === targetId) ||
    !elements.some((e) => e.id === targetId)
  )
    return elements;
  const moving = new Set(movers.map((e) => e.id));
  const rest = elements.filter((e) => !moving.has(e.id));
  const index = rest.findIndex((e) => e.id === targetId) + (after ? 1 : 0);
  return [...rest.slice(0, index), ...movers, ...rest.slice(index)];
}

export function transformGroup(elements: Element[], options: { x: number; y: number; scale: number; rotation: number; color?: [number,number,number,number] }) {
  if (!elements.length || elements.some((e) => e.locked || e.hidden)) throw Error("Group contains locked/hidden elements / ロック・非表示の要素を含むグループ");
  if (![options.x, options.y, options.scale, options.rotation].every(Number.isFinite) || options.scale <= 0) throw Error("Invalid group transform / 拡縮率は正の有限値");
  const center = groupBounds(elements), angle = options.rotation * Math.PI / 180;
  for (const e of elements) {
    const before = bounds(e), dx = (before.cx - center.cx) * options.scale, dy = (before.cy - center.cy) * options.scale;
    if (e.type === "TEXTURE") { e.width = (e.width ?? 100) * options.scale; e.height = (e.height ?? 30) * options.scale; e.angle = (e.angle ?? 0) + options.rotation; }
    else e.scale = (e.scale ?? 1) * options.scale;
    const after = bounds(e);
    e.x += options.x + dx * Math.cos(angle) - dy * Math.sin(angle) - after.cx;
    e.y += options.y + dx * Math.sin(angle) + dy * Math.cos(angle) - after.cy;
    if (options.color) e.color = [...options.color];
  }
  const result = groupBounds(elements);
  for (const e of elements) { e.x += options.x - result.cx; e.y += options.y - result.cy; }
}
