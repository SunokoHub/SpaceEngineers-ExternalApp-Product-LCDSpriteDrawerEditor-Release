export interface Settings {
  gridColor: string;
  gridOpacity: number;
  gridStep: number;
  gridOnShapes: boolean;
  showPreviewStatus: boolean;
  fineAdjust: boolean;
  fineStep: number;
  theme: "dark" | "light";
  moveStep: number;
  sizeStep: number;
  angleStep: number;
  objectDistance: number;
  grid: boolean;
  showHelp: boolean;
  snap: boolean;
  objectSnap: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  gridColor: "#ffffff",
  gridOpacity: 0.12,
  gridStep: 10,
  gridOnShapes: false,
  showPreviewStatus: true,
  fineAdjust: true,
  fineStep: 0.1,
  theme: "dark",
  moveStep: 10,
  sizeStep: 10,
  angleStep: 15,
  objectDistance: 6,
  grid: true,
  showHelp: false,
  snap: true,
  objectSnap: true,
};
export const SETTING_LIMITS = {
  moveStep: [1, 1024],
  sizeStep: [1, 1024],
  angleStep: [0.1, 360],
  objectDistance: [1, 50],
} as const;
export const DISPLAY_LIMITS = {
  gridOpacity: [0, 1],
  gridStep: [1, 1024],
  fineStep: [0.01, 10],
} as const;
export function readSettings(text: string | null): Settings {
  const result = { ...DEFAULT_SETTINGS };
  try {
    const raw: unknown = JSON.parse(text ?? "null");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
    const value = raw as Record<string, unknown>;
    if (value.theme === "dark" || value.theme === "light")
      result.theme = value.theme;
    for (const key of [
      "grid",
      "showHelp",
      "snap",
      "objectSnap",
      "gridOnShapes",
      "showPreviewStatus",
      "fineAdjust",
    ] as const)
      if (typeof value[key] === "boolean") result[key] = value[key];
    if (
      typeof value.gridColor === "string" &&
      /^#[0-9a-f]{6}$/i.test(value.gridColor)
    )
      result.gridColor = value.gridColor;
    for (const key of Object.keys(
      DISPLAY_LIMITS,
    ) as (keyof typeof DISPLAY_LIMITS)[]) {
      const n = value[key],
        [min, max] = DISPLAY_LIMITS[key];
      if (typeof n === "number" && Number.isFinite(n) && n >= min && n <= max)
        result[key] = n;
    }
    for (const key of Object.keys(
      SETTING_LIMITS,
    ) as (keyof typeof SETTING_LIMITS)[]) {
      const n = value[key],
        [min, max] = SETTING_LIMITS[key];
      if (typeof n === "number" && Number.isFinite(n) && n >= min && n <= max)
        result[key] = n;
    }
  } catch {
    /* Invalid preferences fall back to safe defaults, independently of projects. */
  }
  return result;
}
