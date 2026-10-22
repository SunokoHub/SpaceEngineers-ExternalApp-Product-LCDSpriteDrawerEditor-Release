import type { Element } from "./model";

/** Resize in the sprite's local axes, then rotate the center displacement back. */
export function resizeTexture(
  initial: Element,
  direction: [number, number],
  delta: [number, number],
  options: {
    centered: boolean;
    proportional: boolean;
    snap: boolean;
    step?: number;
  },
): Pick<Element, "x" | "y" | "width" | "height"> {
  const [sx, sy] = direction;
  const radians = ((initial.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians),
    sin = Math.sin(radians);
  const dx = delta[0] * cos + delta[1] * sin;
  const dy = -delta[0] * sin + delta[1] * cos;
  const w = Math.max(1, Math.abs(initial.width ?? 100)),
    h = Math.max(1, Math.abs(initial.height ?? 30));
  const step = options.snap ? (options.step ?? 10) : 1;
  const round = (n: number) => Math.max(1, Math.round(n / step) * step);
  const multiplier = options.centered ? 2 : 1;
  let width = sx ? round(w + sx * dx * multiplier) : w;
  let height = sy ? round(h + sy * dy * multiplier) : h;
  if (options.proportional) {
    const useWidth =
      sx !== 0 &&
      (sy === 0 || Math.abs((width - w) / w) >= Math.abs((height - h) / h));
    const ratio = Math.max(useWidth ? width / w : height / h, 1 / w, 1 / h);
    width = w * ratio;
    height = h * ratio;
  }
  const offsetX = options.centered ? 0 : (sx * (width - w)) / 2;
  const offsetY = options.centered ? 0 : (sy * (height - h)) / 2;
  return {
    x: initial.x + offsetX * cos - offsetY * sin,
    y: initial.y + offsetX * sin + offsetY * cos,
    width,
    height,
  };
}
