// Original geometric approximations only; never changes the exported material ID.
// Coordinates span -50..50; scale with the requested sprite dimensions.
const SHAPES: Record<string, string> = {
  Screen_LoadingBar: loadingRing(),
  Screen_LoadingBar2: loadingRing(),
  "No Entry":
    '<circle r="40" fill="none" stroke="currentColor" stroke-width="2"/><path fill-rule="evenodd" d="M36 0A36 36 0 1 0-36 0 36 36 0 1 0 36 0ZM-22 -5V5H22V-5Z"/>',
  Construction:
    '<path fill-rule="evenodd" d="M0 -36 36 0 0 36-36 0ZM-15 -11-7 -14-3 -10-6 -5 13 14 9 18-10 -1-15 -4ZM6 -16 11 -17 7 -11 11 -7 17 -11 16 -5 10 -2 5 -3-11 14-15 10 2 -6 2 -11Z"/><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" d="M-6 -39-3 -42Q0 -45 3 -42L6 -39M39 -6 42 -3Q45 0 42 3L39 6M6 39 3 42Q0 45-3 42L-6 39M-39 6-42 3Q-45 0-42 -3L-39 -6"/>',
  RightTriangle: '<path d="M-50 -50 50 50H-50Z"/>',
  SemiCircle: '<path d="M-50 0A50 50 0 0 1 50 0Z"/>',
  SquareTapered:
    '<svg x="-50" y="-50" width="100" height="100" viewBox="0 0 100 100" overflow="hidden"><rect width="100" height="100" style="filter:blur(.65px)"/></svg>',
  Arrow:
    '<path fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" d="M-32 5 0 -27 32 5M0 -27V33"/>',
  Cross:
    '<path fill="none" stroke="currentColor" stroke-width="11" d="M-33 -33 33 33M33 -33-33 33"/>',
  DecorativeBracketLeft: decorativeBracket(),
  DecorativeBracketRight: `<g transform="scale(-1 1)">${decorativeBracket()}</g>`,
  Danger:
    '<path fill-rule="evenodd" d="M0 -38 39 38H-39ZM-3 -17V15H3V-17ZM-4 23V31H4V23Z"/><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" d="M-9 -29-4 -38Q0 -44 4 -38L9 -29M-38 30-42 37Q-45 43-37 43H-29M38 30 42 37Q45 43 37 43H29"/>',
  IconEnergy: '<path d="M10 -40-20 6-3 9-10 40 21 -6H5L12 -40Z"/>',
  IconHydrogen:
    '<path fill="none" stroke="currentColor" stroke-width="15" stroke-linecap="round" d="M-30 -29V29M12 -29V29M-30 0H12"/>' +
    subscriptTwo(),
  IconOxygen:
    '<rect x="-31" y="-30" width="34" height="58" rx="17" fill="none" stroke="currentColor" stroke-width="14"/>' +
    subscriptTwo(),
  IconTemperature:
    '<path fill="none" stroke="currentColor" stroke-width="7" d="M-12 10V-34A12 12 0 0 1 12 -34V10A23 23 0 1 1-12 10Z"/><path stroke="currentColor" stroke-width="7" d="M0 -24V28M25 -25H44M25 -5H38"/>',
  AH_BoreSight:
    '<path fill="currentColor" stroke="none" d="M-12 -26-2 -26 16 -4Q20 0 16 4L-2 26H-12V16L3 0-12 -16Z"/>',
  AH_VelocityVector: '<circle r="20"/><path d="M-50 0H-20M20 0H50M0 -50V-20"/>',
  AH_PullUp: '<path d="M0 -47 47 0H24V47H-24V0H-47Z"/>',
  AH_TextBox: '<path d="M-47 -47H47V47H-47Z"/>',
  AH_GravityHudPositiveDegrees:
    '<path stroke-width="1" d="M-49 -48V4M49 -48V4"/><path fill="currentColor" stroke="none" d="M-50 -6H-9V5H-50ZM9 -6H50V5H9Z"/>',
  AH_GravityHudNegativeDegrees:
    '<path stroke-width="1" d="M-49 -48V5M49 -48V5"/><path stroke-width="3" d="M-42 -6V5M-34 -6V5M-26 -6V5M-18 -6V5M-10 -6V5M10 -6V5M18 -6V5M26 -6V5M34 -6V5M42 -6V5"/>',
};
// Both loading materials share the static ring seen in the comparison.
function loadingRing(): string {
  return '<path d="M0 -48A48 48 0 1 0 34 34L23 23A33 33 0 1 1 0 -33Z"/><path d="M0 -42A42 42 0 0 1 24 -34L28 -38A48 48 0 0 1 47 0H40A40 40 0 0 1 28 28L23 23A33 33 0 0 0 0 -33Z"/>';
}
// Shared original numeral geometry keeps the chemical symbols consistent.
function subscriptTwo(): string {
  return '<path fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" d="M19 23Q21 12 31 15Q41 18 32 28L20 40H39"/>';
}
// Original curves and cutouts approximate the ornament in a single color.
function decorativeBracket(): string {
  return '<g fill="currentColor" stroke="none"><path d="M-32 -47Q3 -43 27 -17L12 -20Q0 -36-32 -47ZM-32 47Q3 43 27 17L12 20Q0 36-32 47Z"/><path fill-rule="evenodd" d="M-18 -29-2 -23 3 -9-14 -4-23 -19ZM-15 -22-14 -18-5 -15-6 -19ZM-13 -14-12 -10-3 -8-4 -12Z"/><path d="M-14 0 0 -4 5 16-3 29-17 25-8 15Z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M10 -17 13 0 10 17M-31 -47 27 -46M-31 47 27 46"/></g>';
}
const OUTLINED = /^AH_/;
export const PREVIEW_SPRITE_NAMES = [
  "SquareSimple",
  "SquareHollow",
  "Circle",
  "CircleHollow",
  "Triangle",
  ...Object.keys(SHAPES),
];
export function spritePreview(
  name: string,
  width: number,
  height: number,
  color: string,
): string | undefined {
  const box = `x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}"`;
  if (name === "SquareSimple")
    return `<rect data-preview="${name}" ${box} fill="${color}"/>`;
  if (name === "Circle")
    return `<ellipse data-preview="${name}" rx="${width / 2}" ry="${height / 2}" fill="${color}"/>`;
  if (name === "SquareHollow" || name === "CircleHollow") {
    // SVG strokes straddle their path; inset it to keep the painted edge
    // inside the same dimensions used by snapping and export.
    const stroke = Math.min(2, width, height);
    const rx = (width - stroke) / 2,
      ry = (height - stroke) / 2;
    return name === "SquareHollow"
      ? `<rect data-preview="${name}" x="${-rx}" y="${-ry}" width="${2 * rx}" height="${2 * ry}" fill="none" stroke="${color}" stroke-width="${stroke}"/>`
      : `<ellipse data-preview="${name}" rx="${rx}" ry="${ry}" fill="none" stroke="${color}" stroke-width="${stroke}"/>`;
  }
  if (name === "Triangle")
    // An equilateral triangle uses the bottom edge of the texture bounds.
    return `<polygon data-preview="${name}" points="0,${height * (0.5 - Math.sqrt(3) / 2)} ${width / 2},${height / 2} ${-width / 2},${height / 2}" fill="${color}"/>`;
  const shape = Object.hasOwn(SHAPES, name) ? SHAPES[name] : undefined;
  if (!shape) return undefined;
  const style = OUTLINED.test(name)
    ? 'fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"'
    : 'fill="currentColor"';
  // Color is supplied by the renderer from validated RGBA numbers.
  return `<g data-preview="${name}" transform="scale(${width / 100} ${height / 100})" color="${color}" ${style}>${shape}</g>`;
}
