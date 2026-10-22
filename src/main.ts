import { importCustomData, replaceCustomData } from "./custom-data";
import { dynamicsDialog } from "./dynamics-ui";
import {
  isBooleanSource,
  SOURCE_UNITS,
  type Source,
  applyDynamics,
  evaluateElements,
  evaluateMotion,
  motionPreviewDuration,
  writeMotion,
  writeBinding,
  iniValue,
  type PreviewSource,
} from "./dynamics";
import "./style.css";
import {
  DEFAULT_SETTINGS,
  SETTING_LIMITS,
  DISPLAY_LIMITS,
  readSettings,
} from "./settings";
import { transformGroup, bounds, groupBounds, arrangeCircular, arrange, snapGroup, reorderElements } from "./editing";
import { FONT_IDS } from "./fonts";
import { resizeTexture } from "./resize";
import { SPRITE_NAMES, SPRITE_GROUPS } from "./sprites";
import { PREVIEW_SPRITE_NAMES, spritePreview } from "./sprite-preview";
import {
  emptyProject,
  validateElements,
  parseLayout,
  parseSurfaceInfo,
  parseProject,
  serializeProject,
  writeLayout,
  iniLayout,
  finite,
  type Project,
  type Element,
  type Surface,
  type Color,
} from "./model";
const words = {
  ja: {
    gridColor: "グリッドの色",
    gridOpacity: "グリッドの濃さ（0〜1）",
    gridStep: "グリッドの間隔",
    gridOnShapes: "図形上にもグリッドを表示",
    showPreviewStatus: "近似表示の対応状況を表示",
    fineAdjust: "Shift：微調整",
    fineStep: "微調整の刻み幅（移動・寸法・角度）",

    title: "LCD Sprite Drawer",
    dynamics: "動作・変数",
    new: "新規",
    open: "開く",
    save: "保存",
    import: "ゲームから読み込む",
    layout: "描画だけ読み込む",
    export: "ゲームへ書き出す",
    undo: "元に戻す",
    redo: "やり直す",
    surfaces: "ブロック / 表示面",
    elements: "描画順 · 下から上へ",
    addShape: "＋ 図形",
    addText: "＋ 文字",
    duplicate: "複製",
    delete: "削除",
    up: "前面へ",
    down: "背面へ",
    properties: "プロパティ",
    approx: "簡易プレビュー：素材・フォントは代替表示 · 表示面の外：薄く表示（ゲームでは非表示）",
    empty: "編集するデータをゲームから読み込み",
    sample: "サンプルで始める",
    grid: "グリッド",
    help: "ヘルプ",
    helpHint: "座標・操作の補助表示",
    snap: "スナップ",
    numberValue: "数値",
    settings: "設定",
    theme: "テーマ",
    dark: "ダーク",
    light: "ライト",
    moveStep: "移動の刻み幅",
    sizeStep: "サイズ変更の刻み幅",
    angleStep: "回転の刻み幅（度）",
    objectDistance: "要素への吸着距離（画面px）",
    defaults: "初期値に戻す",
    settingsError: "設定の保存に失敗。今回の起動中のみ適用。",
    layerDrag: "ドラッグ：レイヤーの描画順を変更",
    zoom: "表示倍率",
    id: "ID",
    data: "素材名 / 文字",
    texture: "素材名",
    basic: "基本図形",
    symbols: "記号・HUD",
    blocks: "ブロック・アイテム",
    textures: "画像・その他",
    preserved: "取込済みの素材",
    palette: "一時カラーパレット",
    slot: "保存枠",
    emptySlot: "空：現在の色を保存",
    show: "表示（編集用）",
    hide: "非表示（編集用・出力対象）",
    lock: "ロック",
    unlock: "ロック解除",
    guides: "要素スナップ",
    left: "左揃え",
    right: "右揃え",
    top: "上揃え",
    bottom: "下揃え",
    alignX: "左右中央",
    alignY: "上下中央",
    distributeX: "横に等間隔",
    distributeY: "縦に等間隔",
    restore: "復元する",
    discard: "破棄する",
    recovery: "前回の未保存データがあります",
    recoveryError: "復旧データの読み込みに失敗。元データは保持。",
    recoveryHint:
      "前回データの確認中は自動復旧保存を停止。他の操作は使用可能。編集中の内容はファイルへ保存。",
    later: "あとで確認",
    recoveryPending: "前回データを確認",
    projectTools: "プロジェクト",
    placementImport: "インポート",
    exchangeTools: "取込・出力",
    viewTools: "表示・スナップ",
    exitTitle: "編集を終了しますか？",
    exitHint: "未保存の変更あり。保存または破棄を選択。",
    saveExit: "保存して終了",
    discardExit: "保存せず終了",
    keepEditing: "編集に戻る",
    replaceTitle: "編集中の内容を置き換えますか？",
    replaceHint:
      "置き換えると未保存の変更を破棄。保持する場合はキャンセル後に保存。",
    replace: "置き換える",
    saveCanceled: "保存をキャンセル。編集は継続可能。",
    storageError: "自動復旧データの保存に失敗。ファイルへの保存が必要。",
    eyedropper: "スポイト",
    pickHint: "要素・背景をクリック：色を取得 / Esc：取消",
    x: "位置 X",
    y: "位置 Y",
    width: "幅",
    height: "高さ",
    angle: "角度（度）",
    scale: "文字倍率",
    font: "FontId",
    alignment: "文字揃え",
    color: "色 RGBA",
    apply: "適用",
    cancel: "キャンセル",
    text: "テキスト",
    paste: "テキストを貼り付け",
    raw: "設定値",
    ini: "MyIni貼付形式",
    download: "ファイル保存",
    status: "静止編集 · 契約形式 1",
    confirm: "未保存の変更を破棄しますか？",
    imported: "取り込みました",
    saved: "保存しました",
    unknown: "未対応素材",
    invalid: "エラー",
    noSelection: "編集対象の要素を選択",
    drag: "ドラッグ：移動 · 8方向のハンドル：サイズ変更 · 上の丸：回転 · Ctrl+スクロール：表示倍率 · Ctrl+Z：元に戻す",
    center: "中央へ整列",
    fileFrom: "ファイルから",
    spriteType: "文字 / 画像",
    inheritColor: "ゲーム内の色を使う",
    previewBackground: "背景色（プレビュー専用）",
    resetBackground: "面の背景色に戻す",
  },
  en: {
    gridColor: "Grid color",
    gridOpacity: "Grid opacity (0–1)",
    gridStep: "Grid spacing",
    gridOnShapes: "Show grid over shapes",
    showPreviewStatus: "Show preview support status",
    fineAdjust: "Fine adjustment with Shift",
    fineStep: "Fine increment (move / size / angle)",

    title: "LCD Sprite Drawer",
    dynamics: "Behavior / variables",
    new: "New",
    open: "Open",
    save: "Save",
    import: "Read from game",
    layout: "Read drawings only",
    export: "Write to game",
    undo: "Undo",
    redo: "Redo",
    surfaces: "Blocks / surfaces",
    elements: "Draw order · bottom to top",
    addShape: "+ Shape",
    addText: "+ Text",
    duplicate: "Duplicate",
    delete: "Delete",
    up: "Bring forward",
    down: "Send backward",
    properties: "Properties",
    approx: "Approximate preview · substitute shapes and fonts · Outside surface: dimmed (hidden in game)",
    empty: "Read from game to start editing",
    sample: "Start with sample",
    grid: "Grid",
    help: "Help",
    helpHint: "Coordinate and operation aids",
    snap: "Snap",
    numberValue: "value",
    settings: "Settings",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    moveStep: "Move increment",
    sizeStep: "Resize increment",
    angleStep: "Rotation increment (degrees)",
    objectDistance: "Object snap distance (screen px)",
    defaults: "Restore defaults",
    settingsError: "Cannot save settings. Changes apply for this session.",
    layerDrag: "Drag to reorder layer",
    zoom: "Zoom",
    id: "ID",
    data: "Texture name / text",
    texture: "Texture name",
    basic: "Basic shapes",
    symbols: "Symbols / HUD",
    blocks: "Blocks / items",
    textures: "Images / other",
    preserved: "Imported texture",
    palette: "Temporary color palette",
    slot: "Slot",
    emptySlot: "Empty: store current color",
    show: "Show (editor)",
    hide: "Hide (editor only; included in export)",
    lock: "Lock",
    unlock: "Unlock",
    guides: "Object snap",
    left: "Align left",
    right: "Align right",
    top: "Align top",
    bottom: "Align bottom",
    alignX: "Align center X",
    alignY: "Align center Y",
    distributeX: "Distribute X",
    distributeY: "Distribute Y",
    restore: "Restore",
    discard: "Discard",
    recovery: "Unsaved recovery data is available",
    recoveryError: "Cannot read recovery data. Original data is preserved.",
    recoveryHint:
      "You can keep working. Automatic recovery saving is paused until you decide, to protect the previous data. Save your work to a file as needed.",
    later: "Review later",
    recoveryPending: "Review previous data",
    projectTools: "Project",
    placementImport: "Import",
    exchangeTools: "Import / export",
    viewTools: "View / snapping",
    exitTitle: "Finish editing?",
    exitHint: "You have unsaved changes. You can save them before closing.",
    saveExit: "Save and exit",
    discardExit: "Exit without saving",
    keepEditing: "Keep editing",
    replaceTitle: "Replace the current project?",
    replaceHint:
      "Unsaved changes will be lost. To keep them, cancel and save first.",
    replace: "Replace",
    saveCanceled: "Save canceled. You can continue editing.",
    storageError: "Cannot store recovery data. Save to a file.",
    eyedropper: "Eyedropper",
    pickHint: "Click a sprite or background to pick its color (Esc to cancel)",
    x: "Position X",
    y: "Position Y",
    width: "Width",
    height: "Height",
    angle: "Angle (degrees)",
    scale: "Text scale",
    font: "FontId",
    alignment: "Alignment",
    color: "RGBA color",
    apply: "Apply",
    cancel: "Cancel",
    text: "Text",
    paste: "Paste text",
    raw: "Raw value",
    ini: "MyIni format",
    download: "Save file",
    status: "Static editing · contract format 1",
    confirm: "Discard unsaved changes?",
    imported: "Imported",
    saved: "Saved",
    unknown: "Unsupported texture",
    invalid: "Error",
    noSelection: "Select an element",
    drag: "Drag: move · 8 handles: resize · Top circle: rotate · Ctrl+scroll: zoom · Ctrl+Z: undo",
    center: "Align to center",
    fileFrom: "From file",
    spriteType: "Text / texture",
    inheritColor: "Use game colors",
    previewBackground: "Background (preview only)",
    resetBackground: "Use surface background",
  },
};
type Lang = keyof typeof words;
let lang: Lang = localStorage.getItem("language") === "en" ? "en" : "ja";
const SETTINGS_KEY = "lcd-editor-settings";
let settings = readSettings(null);
try {
  settings = readSettings(localStorage.getItem(SETTINGS_KEY));
} catch {
  /* Use defaults. */
}
let project = emptyProject(),
  blockIndex = 0,
  surfaceIndex = 0,
  selected = -1,
  zoom = 1,
  grid = settings.grid,
  snap = settings.snap;
let circularTool: {
  anglesOnly: boolean;
  surface: Surface;
  ids: string[];
  values: Record<string, string>;
  rotate: boolean;
} | undefined;
let previewBackground: Color | undefined;
const paletteColors: (Color | undefined)[] = [
  [255, 255, 255, 255], // white
  [0, 0, 0, 255], // black
  [255, 64, 64, 255], // red
  [255, 160, 48, 255], // orange
  [255, 224, 64, 255], // yellow
  [80, 208, 112, 255], // green
  [64, 208, 224, 255], // cyan
  [80, 128, 255, 255], // blue
];
let selectedPalette = -1;
let pickingColor = false;
let previewActive = false,
  previewTime = 0,
  previewPlaying = false,
  previewError = "";
let scrubTarget: Element | "all" | undefined;
let selectedPreviewTime = 0,
  previewDuration = 10;
let selectedPlaying = false;
let scrubLast:
  | { surface: Surface; target: Element | "all"; elements: Element[] }
  | undefined;
let previewFrame: number | undefined;
let previewLast: { surface: Surface; elements: Element[] } | undefined;
const previewSources: Record<string, PreviewSource> = Object.create(null);
let selection = new Set<string>();
let editingGroupMember = false;
const expandedGroups = new WeakMap<Surface, Set<string>>();
let selectionAnchor: { surface: Surface; id: string } | undefined;
let inspectorScrollTop = 0;
let objectSnap = settings.objectSnap,
  spaceHeld = false;
let activeGuides: { x?: number; y?: number } = {};
const RECOVERY_KEY = "lcd-editor-recovery";
let pendingRecovery: string | null = null;
let recoveryExpanded = true;
try {
  pendingRecovery = localStorage.getItem(RECOVERY_KEY);
} catch {
  /* UI reports write failures on change. */
}
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
function flushRecovery() {
  if (pendingRecovery) return;
  try {
    if (dirty()) localStorage.setItem(RECOVERY_KEY, JSON.stringify(project));
    else localStorage.removeItem(RECOVERY_KEY);
  } catch {
    app.querySelector(".status")!.textContent = t("storageError");
  }
}
function scheduleRecovery() {
  clearTimeout(recoveryTimer);
  recoveryTimer = setTimeout(flushRecovery, 250);
}
function groupBlocked(group: string) { return surface()?.elements.some((e) => e.group === group && (e.locked || e.hidden)); }
function expandGroups() {
  if (editingGroupMember) return;
  const groups = new Set(surface()?.elements.filter((e) => selection.has(e.id)).map((e) => e.group).filter(Boolean));
  surface()?.elements.forEach((e) => { if (e.group && groups.has(e.group)) selection.add(e.id); });
}
function selectedGroup() {
  const elements = chosen();
  const name = elements[0]?.group;
  return !editingGroupMember && name && elements.length >= 2 && elements.every((e) => e.group === name) && surface()!.elements.filter((e) => e.group === name).length === elements.length ? name : undefined;
}
function layerRow(f: Element, i: number, child = false, collapsed = false) {
  return `<li data-layer-row="${i}" class="${child ? "group-child" : ""}" ${collapsed ? "hidden" : ""}><button class="layer-drag" type="button" draggable="${!f.locked && !f.hidden}" data-layer-drag="${i}" aria-label="${t("layerDrag")}" title="${t("layerDrag")}" ${f.locked || f.hidden ? "disabled" : ""}>↕</button><button class="${selection.has(f.id) ? "active" : ""}" data-element="${i}"><span>${f.type === "TEXT" ? "T" : "◇"}</span><div>${esc(f.id)}<small>${child ? `#${i + 1} · ` : ""}${esc(f.data.slice(0, 30))}</small></div></button><div class="layer-flags"><button data-visibility="${i}" title="${f.hidden ? t("show") : t("hide")}" aria-label="${f.hidden ? t("show") : t("hide")}">${f.hidden ? "○" : "●"}</button><button data-lock="${i}" title="${f.locked ? t("unlock") : t("lock")}" aria-label="${f.locked ? t("unlock") : t("lock")}">${lockIcon(!!f.locked)}</button></div><div class="layer-row-actions"><button data-action="duplicate" data-layer-index="${i}" title="${t("duplicate")}" aria-label="${t("duplicate")}" ${f.locked || f.hidden ? "disabled" : ""}>⧉</button><button data-action="delete" data-layer-index="${i}" title="${t("delete")}" aria-label="${t("delete")}" ${f.locked || f.hidden ? "disabled" : ""}>×</button></div></li>`;
}
function layerListMarkup(s: Surface) {
  const open = expandedGroups.get(s) ?? new Set<string>();
  const seen = new Set<string>();
  return s.elements.map((e, i) => {
    if (!e.group) return layerRow(e, i);
    const name = e.group;
    if (seen.has(name)) return "";
    seen.add(name);
    const members = s.elements.map((e, i) => ({ e, i })).filter(({ e }) => e.group === name);
    const expanded = open.has(name), blocked = groupBlocked(name), ja = lang === "ja";
    const selected = members.every(({e}) => selection.has(e.id));
    const allHidden = members.every(({e}) => e.hidden), anyHidden = members.some(({e}) => e.hidden);
    const allLocked = members.every(({e}) => e.locked), anyLocked = members.some(({e}) => e.locked);
    const visibilityLabel = ja ? `グループ：${allHidden ? "表示（編集用）" : "非表示（編集用・出力対象）"}${anyHidden && !allHidden ? " / 一部非表示" : ""}` : `${allHidden ? "Show" : "Hide"} group (editor only; exported)${anyHidden && !allHidden ? " / mixed visibility" : ""}`;
    const lockLabel = ja ? `グループ：${allLocked ? "ロック解除" : "ロック"}${anyLocked && !allLocked ? " / 一部ロック" : ""}` : `${allLocked ? "Unlock" : "Lock"} group${anyLocked && !allLocked ? " / mixed locks" : ""}`;
    return `<li class="group-row" data-layer-row="${i}"><button class="layer-drag" draggable="${!blocked}" data-layer-drag="${i}" aria-label="${t("layerDrag")}" ${blocked ? "disabled" : ""}>↕</button><button class="group-toggle" type="button" data-group-toggle="${esc(name)}" aria-expanded="${expanded}" aria-label="${ja ? expanded ? "グループを折りたたむ" : "グループを展開" : expanded ? "Collapse group" : "Expand group"}">${expanded ? "▾" : "▸"}</button><button type="button" data-group-select="${i}" class="group-select ${selected ? "group-selected" : ""}"><span>▧</span><div>${esc(name)}<small>${members.length}${ja ? "要素" : " elements"}</small></div></button><div class="layer-flags"><button type="button" data-group-visibility="${esc(name)}" title="${visibilityLabel}" aria-label="${visibilityLabel}" aria-pressed="${allHidden ? "true" : anyHidden ? "mixed" : "false"}">${allHidden ? "○" : anyHidden ? "◐" : "●"}</button><button type="button" data-group-lock="${esc(name)}" class="${anyLocked && !allLocked ? "flag-mixed" : ""}" title="${lockLabel}" aria-label="${lockLabel}" aria-pressed="${allLocked ? "true" : anyLocked ? "mixed" : "false"}">${lockIcon(anyLocked)}</button></div><div class="layer-row-actions"><button data-action="duplicate" data-layer-index="${i}" title="${t("duplicate")}" aria-label="${t("duplicate")}" ${blocked ? "disabled" : ""}>⧉</button><button data-action="delete" data-layer-index="${i}" title="${t("delete")}" aria-label="${t("delete")}" ${blocked ? "disabled" : ""}>×</button></div></li>${members.map(({e,i}) => layerRow(e,i,true,!expanded)).join("")}`;
  }).join("");
}
function groupTools() {
  const ja = lang === "ja";
  return `<div class="group-tools">${button("group", ja ? "グループ化" : "Group", chosen(true).length < 2)}${button("ungroup", ja ? "グループ解除" : "Ungroup", !chosen().some((e) => e.group))}<small>${ja ? "クリック：グループ選択 / Alt＋クリック：個別編集 / Ctrl+G：グループ化 / Ctrl+Shift+G：解除" : "Click: select group / Alt+click: edit member"}</small></div>`;
}
function chosen(editable = false) {
  return (
    surface()?.elements.filter(
      (e) => selection.has(e.id) && (!editable || (!e.locked && !e.hidden && (editingGroupMember || !e.group || !groupBlocked(e.group)))),
    ) ?? []
  );
}
function selectElement(index: number, additive = false, individual = false) {
  editingGroupMember = individual;
  if (scrubTarget !== "all") {
    scrubTarget = undefined;
    selectedPreviewTime = 0;
  }
  const s = surface()!;
  if (!additive) selection.clear();
  const id = s.elements[index].id;
  selectionAnchor = { surface: s, id };
  if (additive && selection.has(id)) {
    const group = s.elements[index].group;
    for (const e of s.elements) if (e.id === id || (!individual && group && e.group === group)) selection.delete(e.id);
  } else { selection.add(id); expandGroups(); }
  selected = selection.has(id)
    ? index
    : s.elements.map((e) => selection.has(e.id)).lastIndexOf(true);
}
function selectLayer(index: number, event: MouseEvent) {
  const s = surface()!;
  const anchor = selectionAnchor?.surface === s ? s.elements.findIndex((e) => e.id === selectionAnchor!.id) : -1;
  if (!event.shiftKey || anchor < 0 || !selection.size) {
    selectElement(index, event.ctrlKey || event.metaKey, event.altKey);
    return;
  }
  editingGroupMember = event.altKey;
  scrubTarget = undefined;
  selectedPreviewTime = 0;
  const range = s.elements.slice(Math.min(anchor, index), Math.max(anchor, index) + 1).filter((e) => !e.locked && !e.hidden && (!e.group || !groupBlocked(e.group)));
  if (!event.ctrlKey && !event.metaKey) selection.clear();
  range.forEach((e) => selection.add(e.id));
  expandGroups();
  selected = selection.has(s.elements[index].id) ? index : s.elements.map((e) => selection.has(e.id)).lastIndexOf(true);
}
function arrangementIcon(action: string) {
  const vertical = ["top", "align-y", "bottom", "distribute-y"].includes(action);
  const distributed = action.startsWith("distribute");
  const widths = distributed ? [4, 4, 4] : [10, 6, 8];
  const edge = ["right", "bottom"].includes(action) ? 21 : 3;
  const centered = action.startsWith("align");
  const bars = widths.map((width, i) => {
    const x = distributed ? 3 + i * 7 : centered ? 12 - width / 2 : edge === 21 ? 21 - width : 3;
    const y = distributed ? 7 : 4 + i * 6;
    return `<rect x="${x}" y="${y}" width="${width}" height="${distributed ? 10 : 4}" rx="1" fill="currentColor"/>`;
  }).join("");
  const guide = distributed
    ? '<path d="M 8 4 H 9 M 15 4 H 16 M 8 2 V 6 M 9 2 V 6 M 15 2 V 6 M 16 2 V 6"/>'
    : `<path d="M ${centered ? 12 : edge} 1 V 23" ${centered ? 'stroke-dasharray="2 2"' : ""}/>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g transform="${vertical ? "translate(24 0) rotate(90)" : ""}">${bars}<g class="arrange-guide" fill="none" stroke="currentColor" stroke-width="1.5">${guide}</g></g></svg>`;
}
function arrangementTools() {
  const ja = lang === "ja";
  const count = chosen(true).length;
  const groups = [
    { heading: ja ? "横方向に揃える" : "Align horizontally", hint: ja ? "2要素以上" : "2+ elements", actions: [["left", "left"], ["align-x", "alignX"], ["right", "right"]] },
    { heading: ja ? "縦方向に揃える" : "Align vertically", hint: ja ? "2要素以上" : "2+ elements", actions: [["top", "top"], ["align-y", "alignY"], ["bottom", "bottom"]] },
    { heading: ja ? "間隔を揃える" : "Distribute spacing", hint: ja ? "3要素以上・両端を維持" : "3+ elements · keep outer edges", actions: [["distribute-x", "distributeX"], ["distribute-y", "distributeY"]] },
  ];
  return `<section class="arrange-tools" aria-label="${ja ? "選択要素の整列" : "Arrange selection"}"><p>${ja ? "整列" : "Arrange"} · ${count}${ja ? "要素" : " elements"}</p><small>${ja ? "基準：選択要素全体の外接範囲" : "Reference: selection bounding box"}</small>${groups.map((group) => `<div class="arrange-group" role="group" aria-label="${group.heading}"><div class="arrange-heading">${group.heading}<small>${group.hint}</small></div><div class="arrange-row" style="--arrange-columns:${group.actions.length}">${group.actions.map(([action, label]) => `<button type="button" data-action="${action}" title="${t(label as keyof typeof words.ja)} · ${group.hint}" ${count < (action.startsWith("distribute") ? 3 : 2) ? "disabled" : ""}>${arrangementIcon(action)}<span>${t(label as keyof typeof words.ja)}</span></button>`).join("")}</div></div>`).join("")}<div class="arrange-group"><div class="arrange-heading">${ja ? "円・放射状" : "Circle / radial"}</div><div class="arrange-row" style="--arrange-columns:2">${button("circle-arrange", ja ? "円周上に配置…" : "Arrange on circle…", count < 2)}${button("radial-arrange", ja ? "放射状に角度揃え…" : "Align radial angles…", !chosen(true).some((e) => e.type === "TEXTURE"))}</div>${circularMarkup()}</div></section>`;
}

function paletteMarkup() {
  return `<div class="palette" role="group" aria-label="${t("palette")}">${paletteColors.map((color, index) => `<button type="button" data-palette-slot="${index}" aria-label="${t("slot")} ${index + 1}" aria-pressed="${selectedPalette === index}" title="${color ? color.join(",") : t("emptySlot")}" style="${color ? `background:${rgba(color)}` : ""}">${index + 1}</button>`).join("")}</div>`;
}
function refreshPalette() {
  app
    .querySelectorAll<HTMLButtonElement>("[data-palette-slot]")
    .forEach((button) => {
      const index = Number(button.dataset.paletteSlot),
        color = paletteColors[index];
      button.style.background = color ? rgba(color) : "";
      button.setAttribute("aria-pressed", String(selectedPalette === index));
      button.title = color ? color.join(",") : t("emptySlot");
    });
}
function rememberColor(color: Color) {
  if (selectedPalette >= 0) {
    paletteColors[selectedPalette] = [...color];
    refreshPalette();
  }
}
function scrollPositions() {
  return [
    ".viewport",
    ".inspector",
    ".right-panel",
    ".elements",
    ".surface-list",
  ].map((selector) => {
    const node = app.querySelector<HTMLElement>(selector);
    if (selector === ".inspector" && node?.querySelector("#properties, #group-properties"))
      inspectorScrollTop = node.scrollTop;
    return { selector, left: node?.scrollLeft ?? 0, top: selector === ".inspector" ? inspectorScrollTop : node?.scrollTop ?? 0 };
  });
}
function restoreScroll(positions: ReturnType<typeof scrollPositions>) {
  positions.forEach(({ selector, left, top }) => {
    app.querySelector(selector)?.scrollTo(left, top);
  });
}
const typeSettings = new WeakMap<
  Surface,
  Map<string, Partial<Record<Element["type"], Element>>>
>();
// Editor-only colors; omitted Color still uses the surface foreground in exports.
const unusedColors = new WeakMap<Surface, Map<string, Color>>();
let past: string[] = [],
  future: string[] = [],
  saved = JSON.stringify(project),
  notice = "";
const app = document.querySelector<HTMLDivElement>("#app")!;
const t = (key: keyof typeof words.ja) => words[lang][key];
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const surface = (): Surface | undefined =>
  project.blocks[blockIndex]?.surfaces[surfaceIndex];
const element = () => surface()?.elements[selected];
const dirty = () => JSON.stringify(project) !== saved;
function checkpoint() {
  past.push(JSON.stringify(project));
  if (past.length > 100) past.shift();
  future = [];
}
function mutate(action: () => void) {
  scrubTarget = undefined;
  checkpoint();
  action();
  notice = "";
  render();
}
function notify(error: unknown) {
  notice = String(error instanceof Error ? error.message : error);
  render();
}
function button(action: string, label: string, disabled = false) {
  return `<button data-action="${action}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
}
function rgba(c: Color) {
  return `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`;
}
function render() {
  pausePlayback();
  if (!project.blocks[blockIndex]) blockIndex = 0;
  if (!project.blocks[blockIndex]?.surfaces[surfaceIndex]) surfaceIndex = 0;
  if (scrubTarget !== "all" && scrubTarget !== element())
    scrubTarget = undefined;
  ensurePreviewSources(surface());
  const positions = scrollPositions();
  document.documentElement.lang = lang;
  document.documentElement.dataset.theme = settings.theme;
  window.desktop?.setTheme?.(settings.theme);
  const s = surface(),
    e = element();
  if (!e) selection.clear();
  else if (!selection.has(e.id)) selection = new Set([e.id]);
  else
    selection = new Set(
      [...selection].filter((id) => s!.elements.some((e) => e.id === id)),
    );
  if (circularTool && (circularTool.surface !== s ||
      circularTool.ids.join("\0") !== chosen(true).map((e) => e.id).join("\0")))
    circularTool = undefined;
  let recoveryValid = false;
  if (pendingRecovery) {
    try {
      parseProject(pendingRecovery);
      recoveryValid = true;
    } catch {
      /* Keep unknown/corrupt input until explicit discard. */
    }
  }
  app.innerHTML = `<div class="titlebar"><span>▧</span> LCD Sprite Drawer Editor<small class="dirty-indicator" title="${t("exitHint")}">${dirty() ? "●" : ""}</small></div><header><nav><div class="action-group" aria-label="${t("projectTools")}"><span class="group-label">${t("projectTools")}</span><div>${button("new", t("new"))}${button("open", t("open"))}${button("save", t("save"))}${button("placement-import", t("placementImport"), !s)}</div></div><div class="action-group" aria-label="${t("exchangeTools")}"><span class="group-label">${t("exchangeTools")}</span><div>${button("import", t("import"))}${button("export", t("export"), !s)}</div></div></nav>${snapSettingsMarkup()}<div class="app-preferences">${pendingRecovery && !recoveryExpanded ? button("review-recovery", t("recoveryPending")) : ""}${button("settings", t("settings"))}<select id="language" aria-label="Language"><option value="ja" ${lang === "ja" ? "selected" : ""}>日本語</option><option value="en" ${lang === "en" ? "selected" : ""}>English</option></select></div></header>${pendingRecovery && recoveryExpanded ? `<section class="recovery" role="region" aria-labelledby="recovery-title"><div class="recovery-icon" aria-hidden="true">↶</div><div class="recovery-copy"><h2 id="recovery-title">${recoveryValid ? t("recovery") : t("recoveryError")}</h2><p>${t("recoveryHint")}</p></div><div class="recovery-actions">${button("restore-recovery", t("restore"), !recoveryValid)}${button("discard-recovery", t("discard"))}${button("defer-recovery", t("later"))}</div></section>` : ""}
  <main><aside class="inspector"><h2>${t("properties")}</h2>${e ? (selectedGroup() ? groupProperties() : selectedPreviewMarkup(e) + properties(e)) + arrangementTools() : `<p>${t("noSelection")}</p>`}${s ? `<div class="dimensions">Texture: ${s.texture.join(" × ")}<br>Surface: ${s.size.join(" × ")}<br>${t("status")}<br>${s.elements.length} / 32</div>` : ""}</aside>
  <section class="workspace"><div class="toolbar">${button("undo", "↶ " + t("undo"), !past.length)}${button("redo", "↷ " + t("redo"), !future.length)}<label><input id="grid" type="checkbox" ${grid ? "checked" : ""}>${t("grid")}</label><label title="${t("helpHint")}"><input id="show-help" type="checkbox" ${settings.showHelp ? "checked" : ""}>${t("help")}</label><label>${t("zoom")}<input id="zoom" type="range" min="25" max="800" value="${zoom * 100}"></label></div><div class="preview-note">${t("approx")}</div><div class="viewport">${s ? draw(s) : `<div class="empty"><div class="empty-icon">▧</div><h2>${t("empty")}</h2>${button("import", t("import"))}${button("sample", t("sample"))}</div>`}</div><footer>${t("drag")}</footer></section>
<aside class="right-panel"><h2>${lang === "ja" ? "表示・再生" : "View / playback"}</h2>${previewMarkup(s)}<div class="layers"><h2>${t("surfaces")}</h2><div class="surface-list">${project.blocks.map((b, bi) => `<div class="block-name">${esc(b.name)}<small>${esc(b.id)}</small></div>${b.surfaces.map((f, si) => `<button class="surface ${bi === blockIndex && si === surfaceIndex ? "active" : ""}" data-block="${bi}" data-surface="${si}">${esc(f.name)} <small>#${f.index} · ${f.size.join(" × ")}</small></button>`).join("")}`).join("")}</div><h2>${t("elements")}</h2><div class="row">${button("shape", t("addShape"), !s)}${button("text", t("addText"), !s)}</div>${groupTools()}<p class="layer-selection-hint"><kbd>Shift</kbd> ${lang === "ja" ? "範囲" : "range"} · <kbd>Ctrl</kbd> ${lang === "ja" ? "追加／解除" : "toggle"} · <kbd>Ctrl+A</kbd> ${lang === "ja" ? "全選択" : "select all"}</p><ol class="elements">${s ? layerListMarkup(s) : ""}</ol></div>${backgroundMarkup(s)}</aside></main><div class="status" role="status">${esc(notice || t("status"))}</div><dialog id="dialog"></dialog><dialog id="confirm-dialog" class="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-description"></dialog>`;
  restoreScroll(positions);
  bindPreview(s);
  scheduleRecovery();
  app
    .querySelectorAll<HTMLButtonElement>("[data-visibility], [data-lock]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const key = b.dataset.lock !== undefined ? "locked" : "hidden";
          const index = Number(b.dataset.lock ?? b.dataset.visibility);
          mutate(() => {
            s!.elements[index][key] = !s!.elements[index][key];
          });
        }),
    );
  app.querySelector<HTMLInputElement>("#object-snap")!.onchange = (event) => {
    objectSnap = (event.target as HTMLInputElement).checked;
    persistSettings();
  };
  app
    .querySelectorAll<HTMLInputElement>("[data-snap-setting]")
    .forEach((input) => {
      const key = input.name as keyof typeof SETTING_LIMITS;
      input.oninput = () => {
        if (!input.value || !input.validity.valid) return;
        settings[key] = Number(input.value);
        persistSettings();
        const positions = scrollPositions();
        const svg = app.querySelector("#canvas");
        if (s && svg) {
          svg.outerHTML = draw(s);
          bindSprites();
          restoreScroll(positions);
        }
      };
      input.onblur = () => {
        input.value = String(settings[key]);
      };
    });
  bindPan();
  bindLayerDrag();
  app.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.layerIndex !== undefined) {
          const index = Number(b.dataset.layerIndex);
          if (!selection.has(s!.elements[index].id)) selectElement(index);
        }
        return act(b.dataset.action!);
      }),
  );
  app.querySelectorAll<HTMLButtonElement>("[data-surface]").forEach(
    (b) =>
      (b.onclick = () => {
        pickingColor = false;
        blockIndex = Number(b.dataset.block);
        surfaceIndex = Number(b.dataset.surface);
        selected = -1;
        render();
      }),
  );
  app.querySelectorAll<HTMLButtonElement>("[data-group-visibility], [data-group-lock]").forEach((b) => {
    b.onclick = () => {
      const key = b.dataset.groupLock !== undefined ? "locked" : "hidden";
      const name = b.dataset.groupLock ?? b.dataset.groupVisibility;
      const members = s!.elements.filter((e) => e.group === name);
      if (!members.length) return;
      const next = !members.every((e) => e[key]);
      mutate(() => { members.forEach((e) => { e[key] = next; }); });
    };
  });
  app.querySelectorAll<HTMLButtonElement>("[data-group-toggle]").forEach((b) => {
    b.onclick = () => {
      const open = expandedGroups.get(s!) ?? new Set<string>();
      const name = b.dataset.groupToggle!;
      if (open.has(name)) open.delete(name); else open.add(name);
      expandedGroups.set(s!, open);
      render();
    };
  });
  app.querySelectorAll<HTMLButtonElement>("[data-group-select]").forEach((b) => {
    b.onclick = (event) => { selectLayer(Number(b.dataset.groupSelect), event); render(); };
  });
  app.querySelectorAll<HTMLButtonElement>("[data-element]").forEach(
    (b) =>
      (b.onclick = (event) => {
        pickingColor = false;
        selectLayer(Number(b.dataset.element), event);
        render();
      }),
  );
  document.querySelector<HTMLSelectElement>("#language")!.onchange = (ev) => {
    lang = (ev.target as HTMLSelectElement).value as Lang;
    localStorage.setItem("language", lang);
    render();
  };
  document.querySelector<HTMLInputElement>("#grid")!.onchange = (ev) => {
    grid = (ev.target as HTMLInputElement).checked;
    persistSettings();
    render();
  };
  document.querySelector<HTMLInputElement>("#show-help")!.onchange = (ev) => {
    settings.showHelp = (ev.target as HTMLInputElement).checked;
    persistSettings();
    render();
  };
  document.querySelector<HTMLInputElement>("#snap")!.onchange = (ev) => {
    snap = (ev.target as HTMLInputElement).checked;
    persistSettings();
  };
  document.querySelector<HTMLInputElement>("#zoom")!.oninput = (event) => {
    const viewport = app.querySelector<HTMLElement>(".viewport")!;
    const rect = viewport.getBoundingClientRect();
    setZoom(
      Number((event.target as HTMLInputElement).value) / 100,
      rect.x + viewport.clientWidth / 2,
      rect.y + viewport.clientHeight / 2,
    );
  };
  const form = app.querySelector<HTMLFormElement>("#properties");
  let session: EventTarget | null = null;
  const refresh = () => {
    const positions = scrollPositions();
    const svg = app.querySelector("#canvas");
    if (s && svg) svg.outerHTML = draw(s);
    restoreScroll(positions);
    bindSprites();
    app.querySelector(".dirty-indicator")!.textContent = dirty() ? "●" : "";
    app.querySelector<HTMLButtonElement>('[data-action="undo"]')!.disabled =
      !past.length;
    app.querySelector<HTMLButtonElement>('[data-action="redo"]')!.disabled =
      !future.length;
    const support = app.querySelector("#preview-support");
    if (support && element()) support.textContent = previewSupport(element()!);
    const layer = app.querySelector(`[data-element="${selected}"] div`);
    if (layer && element())
      layer.innerHTML = `${esc(element()!.id)}<small>${esc(element()!.data.slice(0, 30))}</small>`;
  };
  const commit = (event: Event) => {
    event.preventDefault();
    if (!form || !s || !e || e.locked || e.hidden) return;
    scrubTarget = undefined;
    try {
      if (!form.checkValidity()) throw Error(t("invalid"));
      const values = new FormData(form);
      const next = { ...element()! };
      for (const key of ["id", "data", "font", "alignment"] as const)
        if (values.has(key))
          (next as unknown as Record<string, unknown>)[key] = String(
            values.get(key),
          );
      for (const key of [
        "x",
        "y",
        "width",
        "height",
        "angle",
        "scale",
      ] as const)
        if (values.has(key)) next[key] = finite(String(values.get(key)));
      const color = String(values.get("color") ?? "");
      next.color = color ? (color.split(",").map(finite) as Color) : undefined;
      const colorChanged =
        JSON.stringify(next.color) !== JSON.stringify(element()!.color);
      const checked = validateElements(
        s.elements.map((old, i) => (i === selected ? next : old)),
      );
      if (JSON.stringify(s.elements) !== JSON.stringify(checked)) {
        if (session !== event.target) checkpoint();
        session = event.target;
        if (next.id !== element()!.id) {
          const colors = unusedColors.get(s);
          const previousColor = colors?.get(element()!.id);
          colors?.delete(element()!.id);
          if (previousColor) colors!.set(next.id, previousColor);
          selection.delete(element()!.id);
          selection.add(next.id);
        }
        s.elements = checked;
        refresh();
        scheduleRecovery();
      }
      if (colorChanged) rememberColor(element()!.color ?? s.foreground);
      app.querySelector(".status")!.textContent = t("status");
    } catch (error) {
      app.querySelector(".status")!.textContent = String(
        error instanceof Error ? error.message : error,
      );
    }
  };
  form?.addEventListener("submit", (event) => event.preventDefault());
  form?.addEventListener("focusout", () => {
    session = null;
  });
  // Sliders and palette update the RGBA field before validation.
  form?.addEventListener("input", commit);
  form?.addEventListener("change", commit);
  const backgroundSliders = [
    ...app.querySelectorAll<HTMLInputElement>("[data-background]"),
  ];
  const backgroundNumbers = [
    ...app.querySelectorAll<HTMLInputElement>("[data-background-number]"),
  ];
  const updateBackground = (color: Color) => {
    previewBackground = color;
    backgroundSliders.forEach((input, i) => {
      input.value = String(color[i]);
      backgroundNumbers[i].value = input.value;
    });
    app.querySelector("#preview-fill")?.setAttribute("fill", rgba(color));
  };
  backgroundSliders.forEach(
    (input) =>
      (input.oninput = () =>
        updateBackground([
          ...backgroundSliders.map((input) => Number(input.value)),
          255,
        ] as Color)),
  );
  backgroundNumbers.forEach((input) => {
    input.oninput = () => {
      if (backgroundNumbers.every((field) => field.checkValidity())) {
        updateBackground([
          ...backgroundNumbers.map((field) => Number(field.value)),
          255,
        ] as Color);
      }
    };
  });
  app.querySelector<HTMLElement>(".viewport")!.addEventListener(
    "wheel",
    (event) => {
      if (!(event.ctrlKey || event.metaKey) || !s) return;
      event.preventDefault();
      if (event.deltaY === 0) return;
      setZoom(
        zoom + (event.deltaY < 0 ? 0.1 : -0.1),
        event.clientX,
        event.clientY,
      );
    },
    { passive: false },
  );
  document
    .querySelector<HTMLInputElement>("#sprite-type")
    ?.addEventListener("change", () => {
      const e = element();
      if (!e || !s || e.locked || e.hidden) return;
      const cache = typeSettings.get(s) ?? new Map();
      typeSettings.set(s, cache);
      const settings = cache.get(e.id) ?? {};
      settings[e.type] = structuredClone(e);
      cache.set(e.id, settings);
      const type = e.type === "TEXT" ? "TEXTURE" : "TEXT";
      const previous = settings[type];
      const next: Element = {
        id: e.id,
        type,
        data: e.data,
        x: e.x,
        y: e.y,
        color: e.color,
        motion: e.motion,
        bindings: e.bindings,
        hidden: e.hidden,
        locked: e.locked,
        group: e.group,
        ...(type === "TEXTURE"
          ? {
              width: previous?.width ?? 100,
              height: previous?.height ?? 60,
              angle: previous?.angle ?? 0,
              alignment: "CENTER" as const,
            }
          : {
              scale: previous?.scale ?? 1,
              font: previous?.font ?? "Debug",
              alignment: previous?.alignment ?? ("CENTER" as const),
            }),
      };
      try {
        const checked = validateElements([next])[0];
        mutate(() => {
          s.elements[selected] = checked;
        });
      } catch (error) {
        document.querySelector<HTMLInputElement>("#sprite-type")!.checked =
          e.type === "TEXT";
        notify(error);
      }
    });
  const colorInput = document.querySelector<HTMLInputElement>('#properties [name="color"]');
  const inherit = document.querySelector<HTMLInputElement>("#inherit-color");
  const sliders = [...app.querySelectorAll<HTMLInputElement>("[data-channel]")];
  const channelNumbers = [
    ...app.querySelectorAll<HTMLInputElement>("[data-channel-number]"),
  ];
  if (colorInput) colorInput.required = true;
  const colorControls =
    app.querySelector<HTMLFieldSetElement>("#color-controls");
  const syncChannels = (values: number[]) => {
    sliders.forEach((input, i) => {
      input.value = String(values[i]);
      channelNumbers[i].value = String(values[i]);
    });
  };
  channelNumbers.forEach(
    (input) =>
      (input.oninput = () => {
        if (channelNumbers.every((input) => input.checkValidity())) {
          const values = channelNumbers.map((input) => Number(input.value));
          syncChannels(values);
          inherit!.checked = false;
          colorInput!.value = values.join(",");
        }
      }),
  );
  sliders.forEach(
    (slider) =>
      (slider.oninput = () => {
        inherit!.checked = false;
        colorInput!.value = sliders.map((input) => input.value).join(",");
        syncChannels(sliders.map((input) => Number(input.value)));
      }),
  );
  inherit?.addEventListener("input", () => {
    const current = element()!;
    const colors = unusedColors.get(s!) ?? new Map<string, Color>();
    unusedColors.set(s!, colors);
    if (inherit.checked && current.color)
      colors.set(current.id, [...current.color]);
    const color = current.color ?? colors.get(current.id) ?? s!.foreground;
    colorControls!.disabled = inherit.checked;
    syncChannels(color);
    colorInput!.value = color.join(",");
  });
  colorInput?.addEventListener("input", () => {
    const values = colorInput.value.split(",").map(Number);
    if (
      colorInput.value &&
      values.length === 4 &&
      values.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    ) {
      inherit!.checked = false;
      colorControls!.disabled = false;
      syncChannels(values);
    }
  });
  app
    .querySelectorAll<HTMLButtonElement>("[data-palette-slot]")
    .forEach((button) => {
      button.onclick = () => {
        const index = Number(button.dataset.paletteSlot);
        if (element()?.locked || element()?.hidden) return;
        if (selectedPalette === index) {
          selectedPalette = -1;
          refreshPalette();
          return;
        }
        const color = paletteColors[index];
        selectedPalette = index;
        if (color) {
          colorInput!.value = color.join(",");
          colorInput!.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          paletteColors[index] = [...(element()!.color ?? s!.foreground)];
        }
        refreshPalette();
      };
    });
  bindGroupProperties();
  bindSprites();
}
function lockIcon(locked: boolean) {
  return `<svg class="lock-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${locked ? "M7 10V7a5 5 0 0 1 10 0v3" : "M7 10V7a5 5 0 0 1 10 0"}"/><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M12 14v3"/></svg>`;
}
function bindSprites() {
  bindCircular();
  bindGroupHandles();
  app.querySelectorAll<SVGGElement>("[data-orbit-center]").forEach((g) => {
    g.onpointerdown = (event) => drag(event, selected);
  });
  const backgroundCanvas = app.querySelector<SVGSVGElement>("#canvas");
  backgroundCanvas?.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      spaceHeld ||
      pickingColor ||
      (event.target as SVGElement).closest("[data-sprite], [data-orbit-center], [data-circular-handle], [data-group-transform]")
    )
      return;
    event.preventDefault();
    const svg = backgroundCanvas;
    const inverse = svg.getScreenCTM()!.inverse();
    const point = (e: PointerEvent) =>
      new DOMPoint(e.clientX, e.clientY).matrixTransform(inverse);
    const start = point(event),
      oldSelection = new Set(selection),
      oldSelected = selected;
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("class", "selection-marquee");
    rect.setAttribute("pointer-events", "none");
    svg.append(rect);
    svg.setPointerCapture(event.pointerId);
    let moved = false;
    const move = (e: PointerEvent) => {
      const end = point(e);
      moved ||=
        Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) >= 4;
      if (!moved) return;
      const left = Math.min(start.x, end.x),
        right = Math.max(start.x, end.x),
        top = Math.min(start.y, end.y),
        bottom = Math.max(start.y, end.y);
      for (const [k, v] of Object.entries({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      }))
        rect.setAttribute(k, String(v));
      if (previewActive || scrubTarget) return;
      selection = additive ? new Set(oldSelection) : new Set();
      surface()!.elements.forEach((e) => {
        const b = bounds(e);
        if (
          !e.hidden &&
          !e.locked &&
          (!e.group || !groupBlocked(e.group)) &&
          b.left >= left &&
          b.right <= right &&
          b.top >= top &&
          b.bottom <= bottom
        )
          selection.add(e.id);
      });
    };
    const finish = (cancel = false) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancelled);
      window.removeEventListener("keydown", key);
      if (svg.hasPointerCapture(event.pointerId))
        svg.releasePointerCapture(event.pointerId);
      if (cancel) {
        selection = oldSelection;
        selected = oldSelected;
      } else {
        if (!moved && !additive) selection.clear();
        else { editingGroupMember = false; expandGroups(); }
        selected = surface()!
          .elements.map((e) => selection.has(e.id))
          .lastIndexOf(true);
        if (scrubTarget !== "all") scrubTarget = undefined;
        selectedPreviewTime = 0;
      }
      render();
    };
    const up = () => finish();
    const cancelled = () => finish(true);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(true);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancelled);
    window.addEventListener("keydown", key);
  });
  if (previewActive) return;
  if (scrubTarget) {
    app.querySelectorAll<SVGGElement>("[data-sprite]").forEach((sprite) => {
      sprite.onpointerdown = (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        selectElement(
          Number(sprite.dataset.sprite),
          event.shiftKey || event.ctrlKey,
        );
        render();
      };
    });
    return;
  }
  const canvas = app.querySelector<SVGSVGElement>("#canvas");
  if (canvas) {
    canvas.classList.toggle("picking-color", pickingColor);
    canvas.onpointerdown = (event) => {
      if (!pickingColor || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const source = (event.target as SVGElement).closest<SVGGElement>(
        "[data-sprite]",
      );
      const s = surface()!,
        target = element();
      if (!target || target.locked || target.hidden) return;
      const color = source
        ? (s.elements[Number(source.dataset.sprite)].color ?? s.foreground)
        : (previewBackground ?? s.background);
      pickingColor = false;
      if (JSON.stringify(target.color) !== JSON.stringify(color)) {
        checkpoint();
        target.color = [...color];
      }
      rememberColor(color);
      notice = "";
      render();
    };
    // Capture must precede the sprite's drag listener.
    canvas.addEventListener("pointerdown", canvas.onpointerdown, {
      capture: true,
    });
    canvas.onpointerdown = null;
  }
  app
    .querySelectorAll<SVGGElement>("[data-sprite]")
    .forEach(
      (g) =>
        (g.onpointerdown = (event) => drag(event, Number(g.dataset.sprite))),
    );
}

function guideMarkup(s: Surface) {
  return `<g class="alignment-guides" pointer-events="none" stroke="#ffbf69" stroke-width="${1 / zoom}">${activeGuides.x !== undefined ? `<path d="M ${activeGuides.x} ${-s.texture[1] / 2} V ${s.texture[1] / 2}"/>` : ""}${activeGuides.y !== undefined ? `<path d="M ${-s.texture[0] / 2} ${activeGuides.y} H ${s.texture[0] / 2}"/>` : ""}</g>`;
}
function setZoom(value: number, clientX: number, clientY: number) {
  const svg = app.querySelector<SVGSVGElement>("#canvas"),
    s = surface();
  if (!svg || !s) return;
  const viewport = app.querySelector<HTMLElement>(".viewport")!;
  const before = svg.getBoundingClientRect();
  const px = (clientX - before.left) / zoom,
    py = (clientY - before.top) / zoom;
  zoom = Math.max(0.25, Math.min(8, Math.round(value * 100) / 100));
  const drawing = draw(s);
  const updated = new DOMParser().parseFromString(drawing, "image/svg+xml").documentElement;
  svg.setAttribute("style", updated.getAttribute("style")!);
  const after = svg.getBoundingClientRect();
  viewport.scrollLeft += after.left + px * zoom - clientX;
  viewport.scrollTop += after.top + py * zoom - clientY;
  app.querySelector<HTMLInputElement>("#zoom")!.value = String(zoom * 100);
  svg.outerHTML = drawing;
  bindSprites();
}
function bindPan() {
  const viewport = app.querySelector<HTMLElement>(".viewport")!;
  viewport.addEventListener(
    "pointerdown",
    (event) => {
      if (!(event.button === 1 || (event.button === 0 && spaceHeld))) return;
      event.preventDefault();
      event.stopPropagation();
      viewport.setPointerCapture(event.pointerId);
      const x = event.clientX,
        y = event.clientY,
        left = viewport.scrollLeft,
        top = viewport.scrollTop;
      const move = (ev: PointerEvent) => {
        viewport.scrollLeft = left - (ev.clientX - x);
        viewport.scrollTop = top - (ev.clientY - y);
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        if (viewport.hasPointerCapture(event.pointerId))
          viewport.releasePointerCapture(event.pointerId);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    },
    { capture: true },
  );
  viewport.addEventListener("auxclick", (event) => {
    if (event.button === 1) event.preventDefault();
  });
}

function draw(s: Surface) {
  const displayElements = previewActive
    ? evaluatedPreview(s)
    : scrubTarget
      ? evaluatedScrub(s)
      : s.elements;
  const [tw, th] = s.texture,
    [w, h] = s.size;
  // SVG overflow and layout margins keep off-surface controls reachable without changing coordinates.
  const boxes = displayElements.filter((e) => !e.hidden).map(bounds);
  // Reserve guide space in both states so toggling help preserves layout and scroll limits.
  const extentX = Math.max(tw / 2, w / 2 + 84 / zoom, ...boxes.flatMap((b) => [Math.abs(b.left) + 64 / zoom, Math.abs(b.right) + 64 / zoom]));
  const extentY = Math.max(th / 2, h / 2 + 64 / zoom, ...boxes.flatMap((b) => [Math.abs(b.top) + 64 / zoom, Math.abs(b.bottom) + 64 / zoom]));
  return `<svg id="canvas" viewBox="${-tw / 2} ${-th / 2} ${tw} ${th}" style="width:${tw * zoom}px;height:${th * zoom}px;margin:${(extentY - th / 2) * zoom}px ${(extentX - tw / 2) * zoom}px;overflow:visible" xmlns="http://www.w3.org/2000/svg" tabindex="0"><defs><pattern id="gridpattern" width="${settings.gridStep}" height="${settings.gridStep}" patternUnits="userSpaceOnUse"><path d="M ${settings.gridStep} 0 L 0 0 0 ${settings.gridStep}" fill="none" stroke="${settings.gridColor}" stroke-opacity="${settings.gridOpacity}" stroke-width=".5"/></pattern>${gridMask(displayElements, tw, th)}<mask id="surface-visibility" maskUnits="userSpaceOnUse" x="${-extentX}" y="${-extentY}" width="${extentX * 2}" height="${extentY * 2}" style="mask-type:alpha"><rect x="${-extentX}" y="${-extentY}" width="${extentX * 2}" height="${extentY * 2}" fill="white" fill-opacity=".25"/><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="white"/></mask><clipPath id="visible"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"/></clipPath></defs><rect x="${-tw / 2}" y="${-th / 2}" width="${tw}" height="${th}" fill="#202936"/><g clip-path="url(#visible)"><rect id="preview-fill" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="${rgba(previewBackground ?? s.background)}"/></g>${displayElements.map((e, i) => sprite(e, i, s)).join("")}<g clip-path="url(#visible)">${grid ? `<rect id="grid-overlay" pointer-events="none" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="url(#gridpattern)" ${settings.gridOnShapes ? "" : 'mask="url(#grid-mask)"'}/>` : ""}${guideMarkup(s)}<path d="M ${-w / 2} 0 H ${w / 2} M 0 ${-h / 2} V ${h / 2}" stroke="#71becd" stroke-opacity=".25" stroke-width=".5" pointer-events="none"/></g><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="none" stroke="#65d3bd" stroke-opacity=".6" stroke-width="1" pointer-events="none"/>${groupSelectionMarkup()}${orbitGuidesMarkup()}${orbitCenterMarkup()}${circularCenterMarkup()}${coordinateGuideMarkup(s)}</svg>`;
}
function coordinateGuideMarkup(s: Surface) {
  if (!settings.showHelp) return "";
  const [w, h] = s.size;
  const corner = `(${-w / 2}, ${-h / 2})`;
  const origin = lang === "ja" ? "原点 (0, 0)" : "Origin (0, 0)";
  return `<g id="coordinate-guide" pointer-events="none" aria-label="${lang === "ja" ? "座標の基準" : "Coordinate reference"}" fill="#a8d8e5" font-size="11" font-family="Segoe UI, sans-serif"><g id="coordinate-corner" transform="translate(${-w / 2} ${-h / 2})"><g transform="scale(${1 / zoom})"><text x="0" y="-18" stroke="#18232e" stroke-width="3" paint-order="stroke">${corner}</text><path d="M 0 -6 H 48 M 43 -10 L 48 -6 L 43 -2 M -12 0 V 40 M -16 35 L -12 40 L -8 35" fill="none" stroke="#a8d8e5" stroke-width="1.5"/><text x="56" y="-2" stroke="#18232e" stroke-width="3" paint-order="stroke">+X</text><text x="-12" y="56" text-anchor="middle" stroke="#18232e" stroke-width="3" paint-order="stroke">+Y</text></g></g><g id="coordinate-corner-end" transform="translate(${w / 2} ${h / 2})"><g transform="scale(${1 / zoom})"><text x="0" y="22" text-anchor="end" stroke="#18232e" stroke-width="3" paint-order="stroke">(${w / 2}, ${h / 2})</text><path d="M 0 6 H -48 M -43 2 L -48 6 L -43 10 M 12 0 V -40 M 8 -35 L 12 -40 L 16 -35" fill="none" stroke="#a8d8e5" stroke-width="1.5"/><text x="-56" y="10" text-anchor="end" stroke="#18232e" stroke-width="3" paint-order="stroke">−X</text><text x="12" y="-48" text-anchor="middle" stroke="#18232e" stroke-width="3" paint-order="stroke">−Y</text></g></g><g id="coordinate-origin" transform="scale(${1 / zoom})"><path d="M -5 0 H 5 M 0 -5 V 5" fill="none" stroke="#a8d8e5" stroke-width="1"/><text x="10" y="-10" stroke="#18232e" stroke-width="3" paint-order="stroke">${origin}</text></g></g>`;
}
let orbitGuideDraft: Element | null | undefined;
function orbitGuidesMarkup() {
  const e = orbitGuideDraft === undefined ? element() : orbitGuideDraft;
  if (!e || e.hidden) return '<g id="orbit-guides" pointer-events="none"/>';
  const guides = (["motion", "bindings"] as const).flatMap((kind) => (e[kind] ?? []).filter((record) => ["Orbit", "MoveX", "MoveY"].includes(record.property)).map((orbit) => {
    try {
      const isOrbit = orbit.property === "Orbit";
      const [cx, cy] = orbit.center ?? [e.x, e.y];
      const angles: [string, number][] = [];
      if ("rate" in orbit) {
        angles.push([lang === "ja" ? "開始" : "Start", evaluateMotion(orbit, e, 0)]);
        if (orbit.min !== undefined && orbit.max !== undefined) {
          if ((orbit.mode ?? "Clamp") === "Clamp") {
            angles.push([lang === "ja" ? "終点" : "End", orbit.rate === 0 ? angles[0][1] : orbit.rate > 0 ? orbit.max : orbit.min]);
          } else {
            angles.push([lang === "ja" ? "下限" : "Min", orbit.min], [lang === "ja" ? "上限" : "Max", orbit.max]);
          }
        } else if (!isOrbit) {
          const duration = previewActive || scrubTarget === "all"
            ? Math.max(previewDuration, previewTime)
            : motionPreviewDuration(e, surface()!.size);
          angles.push([lang === "ja" ? "\u78ba\u8a8d\u7bc4\u56f2\u306e\u7aef" : "Preview end", evaluateMotion(orbit, e, duration)]);
        }
      } else {
        angles.push([lang === "ja" ? "入力下限" : "Input min", orbit.outputMin!], [lang === "ja" ? "入力上限" : "Input max", orbit.outputMax!]);
      }
      return angles.map(([label, degrees], index) => {
        const radians = degrees * Math.PI / 180;
        const x = isOrbit ? cx + (e.x - cx) * Math.cos(radians) - (e.y - cy) * Math.sin(radians) : e.x + (orbit.property === "MoveX" ? degrees : 0);
        const y = isOrbit ? cy + (e.x - cx) * Math.sin(radians) + (e.y - cy) * Math.cos(radians) : e.y + (orbit.property === "MoveY" ? degrees : 0);
        if (![x, y].every(Number.isFinite)) return "";
        const color = index === 0 ? "#61e2c2" : "#ffbf69";
        return `<g data-orbit-guide="${kind}" data-motion-property="${orbit.property}" ${isOrbit ? `data-orbit-degrees="${degrees}"` : `data-move-offset="${degrees}"`}><path d="M ${cx} ${cy} L ${x} ${y}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/><g transform="translate(${x} ${y}) scale(${1 / zoom})"><circle r="4" fill="none" stroke="${color}"/><text x="7" y="${-8 - index * 14}" font-size="11" fill="${color}" stroke="#18232e" stroke-width="3" paint-order="stroke">${kind === "motion" ? "Motion" : "Binding"} ${label} ${Number(degrees.toFixed(3))}${isOrbit ? "\u00b0" : "px"}</text></g></g>`;
      }).join("");
    } catch {
      return "";
    }
  })).join("");
  return `<g id="orbit-guides" pointer-events="none">${guides}</g>`;
}
function orbitCenterMarkup() {
  const e = element();
  if (!e || e.hidden || previewActive || scrubTarget) return "";
  return (["motion", "bindings"] as const).map((kind) => {
    const orbit = e[kind]?.find((record) => record.property === "Orbit");
    if (!orbit?.center) return "";
    const [x, y] = orbit.center;
    const label = `${kind === "motion" ? "Motion" : "Binding"} ${lang === "ja" ? "公転中心" : "Orbit center"}`;
    return `<g data-orbit-center="${kind}" transform="translate(${x} ${y})" style="cursor:move"><g transform="scale(${1 / zoom})"><circle data-handle="orbit" data-kind="${kind}" r="10" fill="transparent" pointer-events="all" stroke="#ffbf69" stroke-width="2"/><rect data-handle="orbit-move" data-kind="${kind}" x="19" y="-17" width="10" height="10" fill="#ffbf69" pointer-events="all" stroke="#ffbf69" stroke-width="2"><title>${lang === "ja" ? "\u56f3\u5f62\u3068\u4e2d\u5fc3\u70b9\u3092\u79fb\u52d5" : "Move shape and center"}</title></rect><circle data-handle="orbit-rotate" data-kind="${kind}" cx="24" cy="12" r="5" fill="#ffbf69" pointer-events="all" stroke="#ffbf69" stroke-width="2" style="cursor:crosshair"><title>${lang === "ja" ? "\u4e2d\u5fc3\u70b9\u3092\u8ef8\u306b\u56de\u8ee2" : "Rotate around orbit center"}</title></circle><path d="M -14 0 H 14 M 0 -14 V 14" stroke="#ffbf69" pointer-events="none"/><text x="40" y="${kind === "motion" ? -12 : 20}" font-size="11" fill="#ffbf69" stroke="#18232e" stroke-width="3" paint-order="stroke" pointer-events="none">${label} (${x}, ${y})</text></g></g>`;
  }).join("");
}
function sprite(e: Element, i: number, s: Surface) {
  if (e.hidden) return "";
  const fill = rgba(e.color ?? s.foreground),
    w = Math.abs(e.width ?? 100),
    h = Math.abs(e.height ?? 30);
  let content = "";
  if (e.type === "TEXT") {
    const anchor = ({ LEFT: "start", CENTER: "middle", RIGHT: "end" } as const)[
      e.alignment ?? "CENTER"
    ];
    // Text positions anchor the first line's top; font metrics remain approximate.
    content = `<text fill="${fill}" font-family="${e.font === "Monospace" ? "Consolas, monospace" : "Segoe UI, sans-serif"}" font-size="${28 * (e.scale ?? 1)}" text-anchor="${anchor}" dominant-baseline="text-before-edge">${e.data
      .split("\n")
      .map(
        (line, j) =>
          `<tspan x="0" dy="${j ? 1.2 : 0}em">${esc(line) || "&#8203;"}</tspan>`,
      )
      .join("")}</text>`;
  } else {
    const box = `x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}"`;
    content =
      spritePreview(e.data, w, h, fill) ??
      `<rect ${box} fill="${fill}" fill-opacity=".25" stroke="${fill}" stroke-dasharray="5 3"/><text text-anchor="middle" fill="${fill}" font-size="12">${esc(e.data)}</text><title>${t("unknown")}</title>`;
  }
  const selectionBox = bounds(e);
  // Keep adjacent controls separated even when the sprite is smaller than a handle.
  const controlWidth = Math.max(w, 32 / zoom);
  const controlHeight = Math.max(h, 32 / zoom);
  const outline = selection.has(e.id)
    ? `<rect x="${e.type === "TEXT" ? selectionBox.left - e.x - 4 / zoom : -controlWidth / 2 - 4 / zoom}" y="${e.type === "TEXT" ? -4 / zoom : -controlHeight / 2 - 4 / zoom}" width="${(e.type === "TEXT" ? selectionBox.width : controlWidth) + 8 / zoom}" height="${(e.type === "TEXT" ? selectionBox.height : controlHeight) + 8 / zoom}" fill="none" stroke="#61e2c2" stroke-width="1.5" stroke-dasharray="${4 / zoom} ${2 / zoom}" vector-effect="non-scaling-stroke" pointer-events="none"/>`
    : "";
  // Apply the surface mask in canvas coordinates while leaving controls unmasked.
  return `<g data-sprite="${i}" transform="translate(${e.x} ${e.y}) rotate(${e.angle ?? 0})" style="cursor:move"><g class="sprite-content" transform="rotate(${-(e.angle ?? 0)}) translate(${-e.x} ${-e.y})" mask="url(#surface-visibility)"><g transform="translate(${e.x} ${e.y}) rotate(${e.angle ?? 0})">${content}</g></g>${outline}${
    !previewActive &&
    !scrubTarget &&
    i === selected &&
    !selectedGroup() &&
    !e.locked &&
    e.type === "TEXTURE"
      ? `<circle data-handle="rotate" cx="0" cy="${-controlHeight / 2 - 24 / zoom}" r="${6 / zoom}" fill="#61e2c2"/>${[
          [-1, -1],
          [0, -1],
          [1, -1],
          [-1, 0],
          [1, 0],
          [-1, 1],
          [0, 1],
          [1, 1],
        ]
          .map(
            ([dx, dy]) =>
              `<rect data-handle="resize" data-dx="${dx}" data-dy="${dy}" x="${(dx * controlWidth) / 2 - 5 / zoom}" y="${(dy * controlHeight) / 2 - 5 / zoom}" width="${10 / zoom}" height="${10 / zoom}" fill="#61e2c2" style="cursor:${dx === 0 ? "ns" : dy === 0 ? "ew" : dx === dy ? "nwse" : "nesw"}-resize"/>`,
          )
          .join("")}`
      : ""
  }</g>`;
}
function previewSupport(e: Element) {
  return e.type === "TEXT"
    ? lang === "ja"
      ? "代替フォント"
      : "Substitute font"
    : PREVIEW_SPRITE_NAMES.includes(e.data)
      ? lang === "ja"
        ? "表示：近似図形"
        : "Geometric approximation"
      : lang === "ja"
        ? "未対応：名前付き代替枠"
        : "Unsupported: labeled placeholder";
}
function groupSelectionMarkup() {
  if (!selectedGroup() || previewActive || scrubTarget) return "";
  const b = groupBounds(chosen());
  const handles = groupBlocked(selectedGroup()!) ? "" : [[b.left,b.top],[b.right,b.top],[b.left,b.bottom],[b.right,b.bottom]].map(([x,y]) => `<rect data-group-transform="scale" x="${x - 5 / zoom}" y="${y - 5 / zoom}" width="${10 / zoom}" height="${10 / zoom}" fill="#61e2c2" style="cursor:nwse-resize"/>`).join("") + `<circle data-group-transform="rotate" cx="${b.cx}" cy="${b.top - 24 / zoom}" r="${6 / zoom}" fill="#61e2c2" style="cursor:grab"/>`;
  return `<rect id="group-selection" x="${b.left - 5 / zoom}" y="${b.top - 5 / zoom}" width="${b.width + 10 / zoom}" height="${b.height + 10 / zoom}" fill="none" stroke="#61e2c2" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/><g id="group-center-marker" transform="translate(${b.cx} ${b.cy})" pointer-events="none" aria-label="${lang === "ja" ? "グループ中心" : "Group center"}"><g transform="scale(${1 / zoom})"><rect x="-4" y="-4" width="8" height="8" rx="1" fill="#18232e" stroke="#61e2c2" stroke-width="1.5"/><path d="M -9 0 H -4 M 4 0 H 9 M 0 -9 V -4 M 0 4 V 9" fill="none" stroke="#61e2c2" stroke-width="1.5"/><text x="12" y="-10" font-size="11" fill="#61e2c2" stroke="#18232e" stroke-width="3" paint-order="stroke">${lang === "ja" ? "グループ中心" : "Group center"}</text></g></g>${handles}`;
}
function bindGroupHandles() {
  app.querySelectorAll<SVGElement>("[data-group-transform]").forEach((handle) => {
    handle.onpointerdown = (event) => {
      if (event.button !== 0 || spaceHeld || !selectedGroup() || groupBlocked(selectedGroup()!)) return;
      event.preventDefault(); event.stopPropagation();
      const s = surface()!, originals = structuredClone(chosen()), center = groupBounds(originals);
      const originalElements = structuredClone(s.elements), ids = new Set(originals.map((e) => e.id));
      const svg = app.querySelector<SVGSVGElement>("#canvas")!, inverse = svg.getScreenCTM()!.inverse();
      const point = (ev: PointerEvent) => new DOMPoint(ev.clientX,ev.clientY).matrixTransform(inverse);
      const start = point(event), distance = Math.hypot(start.x-center.cx,start.y-center.cy);
      const previousPast = [...past], previousFuture = [...future];
      let changed = false, delta = 0, previousAngle = Math.atan2(start.y-center.cy,start.x-center.cx)*180/Math.PI;
      svg.setPointerCapture(event.pointerId);
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== event.pointerId) return;
        const p = point(ev), angle = Math.atan2(p.y-center.cy,p.x-center.cx)*180/Math.PI;
        delta += ((angle-previousAngle+540)%360)-180; previousAngle=angle;
        const step = settings.fineAdjust && ev.shiftKey ? settings.fineStep : snap ? settings.angleStep : 1;
        const scale = handle.dataset.groupTransform === "scale" ? Math.max(.001, Math.round(Math.hypot(p.x-center.cx,p.y-center.cy)/Math.max(distance,.001)*1000)/1000) : 1;
        const rotation = handle.dataset.groupTransform === "rotate" ? Math.round(delta/step)*step : 0;
        try {
          const members = structuredClone(originals);
          transformGroup(members,{x:center.cx,y:center.cy,scale,rotation});
          const next = validateElements(originalElements.map((e) => ids.has(e.id) ? members.find((m) => m.id === e.id)! : e));
          if (JSON.stringify(next) === JSON.stringify(s.elements)) return;
          if (!changed) { checkpoint(); changed = true; }
          s.elements = next;
          svg.innerHTML = new DOMParser().parseFromString(draw(s),"image/svg+xml").documentElement.innerHTML;
          const form = app.querySelector<HTMLFormElement>("#group-properties");
          if (form) {
            (form.elements.namedItem("scale") as HTMLInputElement).value = String(scale);
            (form.elements.namedItem("rotation") as HTMLInputElement).value = String(rotation);
          }
        } catch { /* Invalid transforms leave the last valid geometry unchanged. */ }
      };
      const finish = (cancel = false) => {
        window.removeEventListener("pointermove",move); window.removeEventListener("pointerup",up);
        window.removeEventListener("pointercancel",cancelDrag); window.removeEventListener("keydown",key);
        if (cancel && changed) { s.elements=originalElements; past=previousPast; future=previousFuture; }
        if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
        render();
      };
      const up = (ev: PointerEvent) => { if (ev.pointerId === event.pointerId) finish(); };
      const cancelDrag = () => finish(true);
      const key = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.preventDefault(); finish(true); } };
      window.addEventListener("pointermove",move); window.addEventListener("pointerup",up);
      window.addEventListener("pointercancel",cancelDrag); window.addEventListener("keydown",key);
    };
  });
}
function groupProperties() {
  const name = selectedGroup()!, elements = chosen(), box = groupBounds(elements), ja = lang === "ja";
  const input = (key: string, label: string, value: string | number, numeric = true) => `<label>${label}<input name="${key}" type="${numeric ? "number" : "text"}" ${numeric ? 'required step="any"' : ""} value="${esc(value)}" ${key === "x" || key === "y" ? 'readonly aria-readonly="true" aria-describedby="group-wheel-hint"' : ""}></label>`;
  const color = elements[0].color ?? surface()!.foreground;
  return `<section class="group-properties"><h3>▧ ${esc(name)} · ${elements.length}${ja ? "要素" : " elements"}</h3><p>${ja ? "移動：ドラッグ・矢印キー・座標欄のホイール / 座標：直接入力不可 / 拡縮・回転：中心マーク基準、入力直後に反映 / 色：全要素に適用" : "Move: drag, arrow keys or coordinate wheel / Coordinates: no direct typing / Scale and rotation: around center marker, apply immediately / Color: all members"}</p><form id="group-properties"><fieldset ${groupBlocked(name) ? "disabled" : ""}>${input("name", ja ? "グループ名" : "Group name", name, false)}<div class="pair">${input("x", ja ? "中心X（px・表示専用）" : "Center X (px, read-only)", box.cx)}${input("y", ja ? "中心Y（px・表示専用）" : "Center Y (px, read-only)", box.cy)}</div><small id="group-wheel-hint">${ja ? "座標欄のホイール：上＋／下−（X＋：右、Y＋：下） / Shift：微調整（設定ON時）" : "Coordinate wheel: up + / down − (X+: right, Y+: down) / Shift: fine step when enabled"}</small><div class="pair">${input("scale", ja ? "拡縮率（倍）" : "Scale factor", 1)}${input("rotation", ja ? "追加の回転（°）" : "Rotation delta (°)", 0)}</div><small>${ja ? "1倍・0°：この編集開始時の状態が基準" : "1× and 0°: relative to the start of this edit"}</small>${input("color", ja ? "共通色 RGBA（空欄：元の色を保持）" : "Shared RGBA (blank: keep original colors)", "", false)}<div class="color-sliders">${["R", "G", "B", "A"].map((channel, i) => `<label>${channel}<input type="range" data-group-channel="${i}" aria-label="Group ${channel}" min="0" max="255" step="1" value="${color[i]}"><input type="number" data-group-channel-number="${i}" aria-label="Group ${channel} ${t("numberValue")}" min="0" max="255" step="1" required value="${color[i]}"></label>`).join("")}</div><label class="inherit-color"><input type="checkbox" id="group-inherit" ${elements.every((e) => !e.color) ? "checked" : ""}>${t("inheritColor")}</label>${paletteMarkup()}<small>${ja ? "文字：位置・倍率・色を変更、字形の回転は対象外" : "Text: position, scale and color change; glyph rotation is unsupported"}</small></fieldset><p id="group-error" role="status">${groupBlocked(name) ? ja ? "ロック・非表示の要素あり：グループ編集を停止" : "Locked/hidden members: group editing disabled" : ""}</p></form></section>`;
}
function bindGroupProperties() {
  const form = app.querySelector<HTMLFormElement>("#group-properties");
  if (!form || !selectedGroup()) return;
  const s = surface()!;
  let currentName = selectedGroup()!;
  const original = structuredClone(chosen());
  const ids = new Set(original.map((e) => e.id));
  const center = groupBounds(original);
  const colorInput = form.elements.namedItem("color") as HTMLInputElement;
  const inherit = form.querySelector<HTMLInputElement>("#group-inherit")!;
  const sliders = [...form.querySelectorAll<HTMLInputElement>("[data-group-channel]")];
  const numbers = [...form.querySelectorAll<HTMLInputElement>("[data-group-channel-number]")];
  let colorMode: "keep" | "explicit" | "inherit" = "keep";
  let session: EventTarget | null = null;
  const syncChannels = (values: number[]) => {
    sliders.forEach((el, i) => { el.value = String(values[i]); numbers[i].value = String(values[i]); });
  };
  const commit = (event: Event) => {
    if (groupBlocked(currentName)) return false;
    try {
      if (!form.checkValidity()) throw Error(t("invalid"));
      const data = new FormData(form), name = String(data.get("name")).trim();
      if (!name || name.length > 80 || (name !== currentName && s.elements.some((e) => e.group === name))) throw Error(lang === "ja" ? "グループ名：1〜80文字、既存名との重複不可" : "Group name: 1–80 characters, must be unique");
      const members = structuredClone(original);
      const color = colorMode === "explicit" && colorInput.value.trim() ? colorInput.value.split(",").map(finite) as Color : undefined;
      transformGroup(members, { x: center.cx, y: center.cy, scale: Number(data.get("scale")), rotation: Number(data.get("rotation")), ...(color ? { color } : {}) });
      members.forEach((e) => { e.group = name; if (colorMode === "inherit") delete e.color; });
      const draft = s.elements.map((e) => ids.has(e.id) ? members.find((m) => m.id === e.id)! : e);
      const valid = validateElements(draft);
      if (JSON.stringify(valid) !== JSON.stringify(s.elements)) {
        pausePlayback(); scrubTarget = undefined;
        if (session !== event.target) checkpoint();
        session = event.target;
        s.elements = valid;
        const positions = scrollPositions();
        const svg = app.querySelector("#canvas");
        if (svg) { svg.outerHTML = draw(s); bindSprites(); }
        restoreScroll(positions);
        if (name !== currentName) {
          const open = expandedGroups.get(s);
          if (open?.delete(currentName)) open.add(name);
          for (const key of ["groupToggle", "groupVisibility", "groupLock"] as const) {
            app.querySelectorAll<HTMLElement>("[data-group-toggle], [data-group-visibility], [data-group-lock]").forEach((el) => { if (el.dataset[key] === currentName) el.dataset[key] = name; });
          }
          const header = app.querySelector(`[data-group-select="${s.elements.findIndex((e) => ids.has(e.id))}"] > div`);
          if (header) header.innerHTML = `${esc(name)}<small>${members.length}${lang === "ja" ? "要素" : " elements"}</small>`;
          form.closest(".group-properties")!.querySelector("h3")!.textContent = `▧ ${name} · ${members.length}${lang === "ja" ? "要素" : " elements"}`;
          currentName = name;
        }
        app.querySelector(".dirty-indicator")!.textContent = dirty() ? "●" : "";
        app.querySelector<HTMLButtonElement>('[data-action="undo"]')!.disabled = !past.length;
        app.querySelector<HTMLButtonElement>('[data-action="redo"]')!.disabled = !future.length;
        scheduleRecovery();
      }
      if (color) { syncChannels(color); rememberColor(color); }
      for (const [key, value] of [["x", center.cx], ["y", center.cy]] as const)
        (form.elements.namedItem(key) as HTMLInputElement).value = String(value);
      form.querySelector("#group-error")!.textContent = "";
      return true;
    } catch (error) { form.querySelector("#group-error")!.textContent = String(error); return false; }
  };
  sliders.forEach((el) => { el.oninput = () => { colorMode = "explicit"; inherit.checked = false; colorInput.value = sliders.map((el) => el.value).join(","); syncChannels(sliders.map((el) => Number(el.value))); }; });
  numbers.forEach((el) => { el.oninput = () => { if (numbers.every((el) => el.value && el.checkValidity())) { colorMode = "explicit"; inherit.checked = false; colorInput.value = numbers.map((el) => el.value).join(","); syncChannels(numbers.map((el) => Number(el.value))); } }; });
  colorInput.oninput = () => { colorMode = colorInput.value.trim() ? "explicit" : "keep"; if (colorMode === "explicit") inherit.checked = false; else inherit.checked = original.every((e) => !e.color); };
  inherit.oninput = () => {
    colorMode = inherit.checked ? "inherit" : "explicit";
    colorInput.value = inherit.checked ? "" : sliders.map((el) => el.value).join(",");
  };
  let lastWheelTime = -Infinity;
  for (const [name, axis] of [["x", "cx"], ["y", "cy"]] as const) {
    const input = form.elements.namedItem(name) as HTMLInputElement;
    input.addEventListener("wheel", (event) => {
      if (!event.deltaY || event.ctrlKey || event.metaKey || input.matches(":disabled") || groupBlocked(currentName) || surface() !== s || selectedGroup() !== currentName) return;
      event.preventDefault(); event.stopPropagation();
      const now = performance.now();
      if (now - lastWheelTime > 400) session = null;
      const before = center[axis];
      const step = settings.fineAdjust && event.shiftKey ? settings.fineStep : snap ? settings.moveStep : 1;
      center[axis] = Number((before + (event.deltaY < 0 ? step : -step)).toFixed(8));
      if (commit(event)) lastWheelTime = now;
      else center[axis] = before;
    }, { passive: false });
  }
  form.addEventListener("input", commit);
  form.addEventListener("focusout", () => { session = null; });
  form.onsubmit = (event) => event.preventDefault();
  form.querySelectorAll<HTMLButtonElement>("[data-palette-slot]").forEach((button) => {
    button.onclick = () => {
      if (groupBlocked(currentName)) return;
      const index = Number(button.dataset.paletteSlot);
      if (selectedPalette === index) { selectedPalette = -1; refreshPalette(); return; }
      selectedPalette = index;
      const color = paletteColors[index];
      if (color) { colorInput.value = color.join(","); colorInput.dispatchEvent(new Event("input", { bubbles: true })); }
      else paletteColors[index] = [...(s.elements.find((e) => ids.has(e.id))!.color ?? s.foreground)];
      refreshPalette();
    };
  });
}
function properties(e: Element) {
  const color =
    e.color ?? unusedColors.get(surface()!)?.get(e.id) ?? surface()!.foreground;
  const field = (key: string, label: string, value: unknown, numeric = false) =>
    `<label>${esc(label)}<input name="${key}" value="${esc(value ?? "")}" ${numeric ? 'type="number" step="any" required' : ""}></label>`;
  const known = SPRITE_NAMES.includes(e.data);
  const dataField =
    e.type === "TEXTURE"
      ? `<label>${t("texture")}<select name="data" aria-label="${t("texture")}">${!known ? `<optgroup label="${t("preserved")}"><option selected value="${esc(e.data)}">${esc(e.data)}</option></optgroup>` : ""}${SPRITE_GROUPS.map((group) => `<optgroup label="${t(group.key)}">${group.names.map((name) => `<option value="${esc(name)}" ${name === e.data ? "selected" : ""}>${esc(name)}</option>`).join("")}</optgroup>`).join("")}</select></label>`
      : `<label>${t("text")}<textarea name="data" rows="3">${esc(e.data)}</textarea></label>`;
  return `<fieldset ${e.locked || e.hidden ? "disabled" : ""}><label class="type-toggle">${t("spriteType")}<input id="sprite-type" type="checkbox" role="switch" aria-label="${t("spriteType")}" ${e.type === "TEXT" ? "checked" : ""}><span>${e.type === "TEXT" ? t("text") : t("texture")}</span></label><form id="properties">${field("id", t("id"), e.id)}${dataField}${settings.showPreviewStatus ? `<small id="preview-support">${previewSupport(e)}</small>` : ""}<div class="pair">${field("x", t("x"), e.x, true)}${field("y", t("y"), e.y, true)}</div>${e.type === "TEXTURE" ? `<div class="pair">${field("width", t("width"), e.width, true)}${field("height", t("height"), e.height, true)}</div>${field("angle", t("angle"), e.angle ?? 0, true)}` : `${field("scale", t("scale"), e.scale ?? 1, true)}<label>${t("font")}<select name="font">${!FONT_IDS.includes((e.font ?? "Debug") as (typeof FONT_IDS)[number]) ? `<option selected value="${esc(e.font)}">${esc(e.font)}</option>` : ""}${FONT_IDS.map((font) => `<option value="${font}" ${font === (e.font ?? "Debug") ? "selected" : ""}>${font}</option>`).join("")}</select></label><label>${t("alignment")}<select name="alignment">${["LEFT", "CENTER", "RIGHT"].map((v) => `<option ${v === (e.alignment ?? "CENTER") ? "selected" : ""}>${v}</option>`).join("")}</select></label>`}<label class="inherit-color" title="${lang === "ja" ? "色の指定なし：ゲーム内の面の前景色を使用" : "Omit the color and use the in-game surface foreground color"}"><input id="inherit-color" type="checkbox" ${e.color ? "" : "checked"}>${t("inheritColor")}</label><fieldset id="color-controls" ${e.color ? "" : "disabled"}>${field("color", t("color"), color.join(","))}<div class="color-sliders">${["R", "G", "B", "A"].map((channel, i) => `<label>${channel}<input type="range" data-channel="${i}" aria-label="${channel}" min="0" max="255" step="1" value="${color[i]}"><input type="number" data-channel-number="${i}" aria-label="${channel} ${t("numberValue")}" min="0" max="255" step="1" required value="${color[i]}"></label>`).join("")}</div></fieldset></form>${paletteMarkup()}<div class="property-actions">${button("eyedropper", t("eyedropper"))}${button("center", t("center"))}</div></fieldset>`;
}
function gridMask(elements: Element[], width: number, height: number) {
  if (settings.gridOnShapes || !grid) return "";
  return `<mask id="grid-mask" maskUnits="userSpaceOnUse" x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}"><rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" fill="white"/>${elements
    .filter((e) => !e.hidden)
    .map((e) => {
      const w = Math.abs(e.width ?? 100),
        h = Math.abs(e.height ?? 30);
      if (e.type === "TEXTURE")
        return `<g transform="translate(${e.x} ${e.y}) rotate(${e.angle ?? 0})">${spritePreview(e.data, w, h, "black") ?? `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" fill="black"/>`}</g>`;
      const b = bounds(e);
      return `<rect x="${b.left}" y="${b.top}" width="${b.width}" height="${b.height}" fill="black"/>`;
    })
    .join("")}</mask>`;
}
function uniqueId() {
  const ids = new Set(surface()!.elements.map((e) => e.id));
  let i = 1;
  while (ids.has("element" + i)) i++;
  return "element" + i;
}
async function download(
  name: string,
  text: string,
  type = "text/plain",
): Promise<boolean> {
  if (window.desktop) return window.desktop.saveDocument(name, text);
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
function pick(accept: string, callback: (text: string) => unknown) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = async () => {
    try {
      if (input.files?.[0]) {
        if (input.files[0].size > 10_000_000)
          throw Error("File too large / ファイルが大きすぎます");
        await callback(await input.files[0].text());
      }
    } catch (err) {
      notify(err);
    }
  };
  input.click();
}
function persistSettings() {
  settings = { ...settings, grid, snap, objectSnap };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    notice = t("settingsError");
    app.querySelector(".status")!.textContent = notice;
    return false;
  }
}
function snapSettingsMarkup() {
  const labels =
    lang === "ja"
      ? ["移動", "サイズ", "回転°", "吸着px"]
      : ["Move", "Size", "Angle°", "Snap px"];
  return `<div class="snap-settings" role="group" aria-label="${t("snap")}"><div class="snap-group"><label><input id="snap" type="checkbox" ${snap ? "checked" : ""}>${t("snap")}</label>${(Object.keys(SETTING_LIMITS) as (keyof typeof SETTING_LIMITS)[]).map((key, i) => `${i === 3 ? `</div><div class="snap-group"><label><input id="object-snap" type="checkbox" ${objectSnap ? "checked" : ""}>${t("guides")}</label>` : ""}<label title="${t(key)}">${labels[i]}<input data-snap-setting name="${key}" aria-label="${t(key)}" type="number" required step="any" min="${SETTING_LIMITS[key][0]}" max="${SETTING_LIMITS[key][1]}" value="${settings[key]}"></label>`).join("")}</div></div>`;
}
function circularDialog(anglesOnly: boolean) {
  const targets = chosen(true);
  if (!targets.length) return;
  if (circularTool?.anglesOnly === anglesOnly) { circularTool = undefined; render(); return; }
  const box = groupBounds(targets);
  circularTool = { anglesOnly, surface: surface()!, ids: targets.map((e) => e.id), rotate: false,
    values: { cx: String(box.cx), cy: String(box.cy), radius: String(Math.max(1, Math.max(box.width, box.height) / 2)), start: "-90", sweep: "360", offset: "0" } };
  pickingColor = false;
  render();
}
function circularHelp(anglesOnly: boolean) {
  const ja = lang === "ja";
  const diagrams = [
    [ja ? "中心：全体を移動" : "Center: move layout", '<path d="M10 25H50M30 5V45"/><rect x="26" y="21" width="8" height="8"/>'],
    ...(anglesOnly ? [] : [
      [ja ? "半径：円の大きさ" : "Radius: circle size", '<circle cx="22" cy="25" r="18"/><path d="M22 25H46"/><rect x="42" y="21" width="8" height="8"/>'],
      [ja ? "開始：先頭の位置" : "Start: first position", '<circle cx="30" cy="25" r="18"/><path d="M30 25V7"/><rect x="26" y="3" width="8" height="8"/>'],
      [ja ? "範囲：並べる区間" : "Sweep: occupied arc", '<path d="M30 7A18 18 0 1 1 12 25L30 25Z"/><rect x="8" y="21" width="8" height="8"/>'],
    ]),
    [anglesOnly ? ja ? "予定位置：向きを調整" : "Preview: rotate" : ja ? "予定位置：大きさ・開始" : "Preview: size / start", '<path d="M10 35L25 10L40 35M40 35L35 25M40 35L28 35" stroke-dasharray="3 2"/><rect x="21" y="6" width="8" height="8"/>'],
  ];
  return `<div class="circular-help" aria-label="${ja ? "ドラッグ操作の図解" : "Drag controls"}">${diagrams.map(([caption, shape]) => `<div><svg viewBox="0 0 60 50" aria-hidden="true">${shape}</svg><span>${caption}</span></div>`).join("")}</div><div class="circular-preview-key"><span class="preview-swatch"></span>${ja ? "半透明＝配置予定" : "Translucent = preview"}<span>${ja ? "適用：確定 / Esc：ドラッグ取消" : "Apply: confirm / Esc: cancel drag"}</span></div>`;
}
function circularMarkup() {
  const tool = circularTool;
  if (!tool) return "";
  const { anglesOnly } = tool;
  const ja = lang === "ja";
  const input = (name: string, label: string, limits = "") => `<label>${label}<input type="number" name="${name}" value="${esc(tool.values[name])}" required step="any" ${limits}></label>`;
  return `<div class="circular-settings"><h3>${ja ? anglesOnly ? "放射状に角度を揃える" : "円周上に配置" : anglesOnly ? "Align radial angles" : "Arrange on circle"}</h3>${circularHelp(anglesOnly)}<form id="circular-form"><div class="pair">${input("cx", ja ? "中心X（px）" : "Center X (px)")}${input("cy", ja ? "中心Y（px）" : "Center Y (px)")}</div>${anglesOnly ? "" : input("radius", ja ? "半径（px）" : "Radius (px)", 'min="0"') + input("start", ja ? "開始角度（°）" : "Start angle (°)") + input("sweep", ja ? "配置範囲（°）" : "Sweep (°)", 'min="-360" max="360"')}${anglesOnly ? "" : `<label><input type="checkbox" name="rotate" ${tool.rotate ? "checked" : ""}>${ja ? "図形の向きも放射状に揃える" : "Also rotate shapes radially"}</label>`}${input("offset", ja ? "放射方向からの回転（°）" : "Rotation from radial direction (°)")}<div class="angle-compass" aria-label="${ja ? "角度の向き" : "Angle directions"}"><span>↑ −90°</span><span>← 180°　 ✛　 → 0°</span><span>↓ +90°</span></div><small>${ja ? "＋ 時計回り / − 反時計回り" : "+ clockwise / − counterclockwise"}</small><details class="circular-notes"><summary>${ja ? "配置のルール" : "Placement rules"}</summary><p>${ja ? anglesOnly ? "位置は維持。中心と同じ位置の図形は角度を維持。" : "レイヤー一覧の上から順に等間隔。±360°は一周、その他は両端を含む。文字は概算範囲の中心を配置。" : anglesOnly ? "Positions stay fixed. Shapes at the center keep their angles." : "Equal spacing in layer order. ±360° forms a full circle; arcs include both ends. Text uses its estimated center."}</p><p>${ja ? "面の中心がX=0、Y=0。Xは右、Yは下。図形の右方向が回転0°の基準。上向き矢印を外向きに揃える場合は回転+90°。文字は回転対象外。ロック・非表示は除外。" : "Surface center is X=0, Y=0; X right, Y down. A shape’s local right is the 0° reference. Use +90° to point an upward arrow outward. Text is not rotated. Locked/hidden elements are excluded."}</p></details><p id="circular-error" role="status"></p><div class="row"><button type="submit">${t("apply")}</button><button type="button" id="circular-close">${ja ? "閉じる" : "Close"}</button></div></form></div>`;
}
function circularOptions() {
  const tool = circularTool;
  if (!tool || Object.values(tool.values).some((v) => !v.trim() || !Number.isFinite(Number(v)))) return;
  const value = (key: string) => Number(tool.values[key]);
  if (value("radius") < 0 || Math.abs(value("sweep")) > 360) return;
  return { cx: value("cx"), cy: value("cy"), radius: value("radius"), start: value("start"), sweep: value("sweep"), offset: value("offset"), rotate: tool.rotate };
}
function circularCenterMarkup() {
  const tool = circularTool, options = circularOptions();
  if (!tool || !options) return "";
  const { cx, cy, radius, start, sweep } = options;
  const ja = lang === "ja";
  const polar = (angle: number, r = radius) => ({ x: cx + r * Math.cos(angle * Math.PI / 180), y: cy + r * Math.sin(angle * Math.PI / 180) });
  const line = (x: number, y: number) => `M ${cx} ${cy} L ${x} ${y}`;
  const label = (x: number, y: number, text: string) => {
    const right = tool.surface.texture[0] / 2;
    return `<text class="circular-label" x="${Math.min(x, right - 8 / zoom)}" y="${y}" text-anchor="${x > right - 100 / zoom ? "end" : "start"}" font-size="${11 / zoom}" pointer-events="none">${text}</text>`;
  };
  const handle = (kind: string, x: number, y: number, title: string, index?: number) => `<g ${kind === "center" ? 'id="circular-center"' : ""} data-circular-handle="${kind}" ${index === undefined ? "" : `data-index="${index}"`} transform="translate(${x} ${y})" aria-label="${title}"><g transform="scale(${1 / zoom})"><circle class="circular-hit" r="11"/><rect class="circular-grip" x="-4" y="-4" width="8" height="8" rx="1"/>${kind === "center" ? '<path class="circular-cross" d="M -8 0 H -3 M 3 0 H 8 M 0 -8 V -3 M 0 3 V 8"/>' : ""}<title>${title}</title></g></g>`;
  const draft = structuredClone(tool.surface.elements.filter((e) => tool.ids.includes(e.id) && !e.locked && !e.hidden));
  try { arrangeCircular(draft, options, tool.anglesOnly); validateElements(draft); } catch { return ""; }
  const ghosts = draft.map((e) => sprite(e, -1, tool.surface).replace('data-sprite="-1"', 'data-circular-preview="true"')).join("");
  const points = draft.map((e, i) => {
    const box = bounds(e);
    return handle(tool.anglesOnly ? "offset" : "point", box.cx, box.cy, ja ? `配置予定 ${i + 1}：ドラッグ → ${tool.anglesOnly ? "角度補正" : "半径・開始角度"}の調整` : `Planned position ${i + 1}: drag to adjust`, i) + label(box.cx + 10 / zoom, box.cy - 10 / zoom, String(i + 1));
  }).join("");
  let guides = "", controls = "";
  if (!tool.anglesOnly) {
    const first = polar(start), last = polar(start + sweep), middle = polar(start + sweep / 2);
    const arc = Array.from({ length: 97 }, (_, i) => polar(start + sweep * i / 96)).map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
    guides = `<circle class="circular-track" cx="${cx}" cy="${cy}" r="${radius}"/><path class="circular-sector" d="${line(first.x, first.y)} ${arc.replace(/^M/, "L")} Z"/><path class="circular-arc" d="${arc}"/><path class="circular-ray" d="${line(middle.x, middle.y)}"/>`;
    const startHandle = polar(start, radius + 22 / zoom), endHandle = polar(start + sweep, radius + 44 / zoom);
    const radiusGrip = polar(start + sweep / 2, Math.max(radius, 24 / zoom));
    controls = handle("radius", radiusGrip.x, radiusGrip.y, ja ? "半径をドラッグ" : "Drag radius") +
      handle("start", startHandle.x, startHandle.y, ja ? "開始角度をドラッグ" : "Drag start angle") +
      handle("sweep", endHandle.x, endHandle.y, ja ? "配置範囲をドラッグ" : "Drag sweep") +
      label(middle.x + 12 / zoom, middle.y + 16 / zoom, `R ${radius.toFixed(1)} px`) +
      label(startHandle.x + 12 / zoom, startHandle.y, `${ja ? "開始" : "Start"} ${start.toFixed(1)}°`) +
      label(endHandle.x + 12 / zoom, endHandle.y, `${ja ? "範囲" : "Sweep"} ${sweep.toFixed(1)}°`);
  } else {
    guides = draft.filter((e) => e.type === "TEXTURE").map((e) => { const box = bounds(e); return `<path class="circular-ray" d="${line(box.cx, box.cy)}"/>`; }).join("");
  }
  return `<g id="circular-overlay"><g pointer-events="none">${guides}<g class="circular-ghosts">${ghosts}</g></g>${points}${controls}${handle("center", cx, cy, ja ? "整列の中心点" : "Arrangement center")}</g>`;
}
function refreshCircularCenter() {
  app.querySelector("#circular-overlay")?.remove();
  app.querySelector("#canvas")?.insertAdjacentHTML("beforeend", circularCenterMarkup());
  bindCircularCenter();
}
function bindCircularCenter() {
  app.querySelectorAll<SVGGElement>("[data-circular-handle]").forEach((handle) => {
    handle.onpointerdown = (event) => {
      if (event.button !== 0 || spaceHeld || !circularTool) return;
      event.preventDefault(); event.stopPropagation();
      const tool = circularTool, kind = handle.dataset.circularHandle;
      const svg = app.querySelector<SVGSVGElement>("#canvas")!;
      const inverse = svg.getScreenCTM()!.inverse();
      const point = (ev: PointerEvent) => new DOMPoint(ev.clientX, ev.clientY).matrixTransform(inverse);
      const origin = point(event), before = { ...tool.values };
      const cx = Number(before.cx), cy = Number(before.cy);
      const angle = (p: DOMPoint) => Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI;
      let previousAngle = angle(origin), delta = 0;
      svg.setPointerCapture(event.pointerId);
      const update = () => {
        for (const name of Object.keys(tool.values)) {
          const input = app.querySelector<HTMLInputElement>(`#circular-form [name="${name}"]`);
          if (input) input.value = tool.values[name];
        }
        refreshCircularCenter();
      };
      const set = (key: string, value: number) => { tool.values[key] = String(Math.round(value * 1000) / 1000); };
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== event.pointerId || circularTool !== tool) return;
        const p = point(ev), next = angle(p);
        delta += ((next - previousAngle + 540) % 360) - 180;
        previousAngle = next;
        if (kind === "center") { set("cx", cx + p.x - origin.x); set("cy", cy + p.y - origin.y); }
        if (kind === "radius" || kind === "point") set("radius", Math.hypot(p.x - cx, p.y - cy));
        if (kind === "start" || kind === "point") set("start", Number(before.start) + delta);
        if (kind === "sweep") set("sweep", Math.max(-360, Math.min(360, Number(before.sweep) + delta)));
        if (kind === "offset") set("offset", Number(before.offset) + delta);
        update();
      };
      const finish = (cancel = false) => {
        if (cancel && circularTool === tool) { tool.values = before; update(); }
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancelDrag); window.removeEventListener("keydown", key);
        if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
      };
      const up = (ev: PointerEvent) => { if (ev.pointerId === event.pointerId) finish(); };
      const cancelDrag = () => finish(true);
      const key = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.preventDefault(); finish(true); } };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancelDrag); window.addEventListener("keydown", key);
    };
  });
}
function bindCircular() {
  bindCircularCenter();
  const tool = circularTool;
  const form = app.querySelector<HTMLFormElement>("#circular-form");
  if (!tool || !form) return;
  form.oninput = () => {
    for (const input of form.querySelectorAll<HTMLInputElement>('input[type="number"]'))
      tool.values[input.name] = input.value;
    tool.rotate = !!form.querySelector<HTMLInputElement>('[name="rotate"]')?.checked;
    refreshCircularCenter();
  };
  form.querySelector<HTMLButtonElement>("#circular-close")!.onclick = () => { circularTool = undefined; render(); };
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const data = new FormData(form);
      const num = (key: string, fallback = 0) => data.has(key) ? Number(data.get(key)) : fallback;
      const draft = structuredClone(tool.surface.elements);
      arrangeCircular(draft.filter((e) => tool.ids.includes(e.id)), {
        cx: num("cx"), cy: num("cy"), radius: num("radius"), start: num("start"),
        sweep: num("sweep", 360), offset: num("offset"), rotate: data.has("rotate"),
      }, tool.anglesOnly);
      const valid = validateElements(draft);
      mutate(() => { tool.surface.elements = valid; });
    } catch (error) {
      form.querySelector("#circular-error")!.textContent = String(error);
    }
  };
}
function settingsDialog() {
  const dialog = app.querySelector<HTMLDialogElement>("#dialog")!;
  dialog.classList.remove("dynamics-dialog");
  dialog.innerHTML = `<button type="button" id="settings-cancel" class="dialog-close" aria-label="${lang === "ja" ? "閉じる" : "Close"}">×</button><h2>${t("settings")}</h2><form id="settings-form"><label>${t("theme")}<select name="theme"><option value="dark">${t("dark")}</option><option value="light">${t("light")}</option></select></label><div class="settings-toggles">${[
    ["gridOnShapes", "gridOnShapes"],
    ["showPreviewStatus", "showPreviewStatus"],
    ["fineAdjust", "fineAdjust"],
  ]
    .map(
      ([key, label]) =>
        `<label><span>${t(label as keyof typeof words.ja)}</span><input type="checkbox" name="${key}"></label>`,
    )
    .join(
      "",
    )}</div><label>${t("gridColor")}<input type="color" name="gridColor"></label>${(Object.keys(DISPLAY_LIMITS) as (keyof typeof DISPLAY_LIMITS)[]).map((key) => `<label>${t(key)}<input type="number" name="${key}" step="any" required min="${DISPLAY_LIMITS[key][0]}" max="${DISPLAY_LIMITS[key][1]}"></label>`).join("")}<div class="row"><button type="submit">${t("save")}</button><button type="button" id="settings-defaults">${t("defaults")}</button></div></form>`;
  const form = dialog.querySelector<HTMLFormElement>("form")!;
  const fill = (value: typeof settings) => {
    (form.elements.namedItem("theme") as HTMLSelectElement).value = value.theme;
    for (const key of [
      "gridColor",
      "gridOpacity",
      "gridStep",
      "fineStep",
    ] as const)
      (form.elements.namedItem(key) as HTMLInputElement).value = String(
        value[key],
      );
    for (const key of [
      "gridOnShapes",
      "showPreviewStatus",
      "fineAdjust",
    ] as const)
      (form.elements.namedItem(key) as HTMLInputElement).checked = value[key];
  };
  fill({ ...settings, grid, snap, objectSnap });
  dialog.querySelector<HTMLButtonElement>("#settings-defaults")!.onclick = () =>
    fill(DEFAULT_SETTINGS);
  dialog.querySelector<HTMLButtonElement>("#settings-cancel")!.onclick = () =>
    dialog.close();
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form),
      next = { ...settings, theme: String(data.get("theme")) };
    for (const key of [
      "gridOnShapes",
      "showPreviewStatus",
      "fineAdjust",
    ] as const)
      next[key] = data.has(key);
    for (const key of Object.keys(
      DISPLAY_LIMITS,
    ) as (keyof typeof DISPLAY_LIMITS)[])
      next[key] = Number(data.get(key));
    next.gridColor = String(data.get("gridColor"));
    settings = readSettings(JSON.stringify(next));
    grid = settings.grid;
    snap = settings.snap;
    objectSnap = settings.objectSnap;
    notice = "";
    persistSettings();
    dialog.close();
    render();
  };
  dialog.showModal();
}
function bindLayerDrag() {
  const s = surface(),
    list = app.querySelector<HTMLOListElement>(".elements");
  if (!s || !list) return;
  let dragging: string[] | undefined;
  let preview: HTMLOListElement | undefined;
  const indicator = document.createElement("li");
  indicator.className = "layer-drop-indicator";
  indicator.setAttribute("aria-hidden", "true");
  const clear = () => {
    indicator.remove();
    preview?.remove();
    preview = undefined;
    list
      .querySelectorAll(".layer-dragging")
      .forEach((row) => row.classList.remove("layer-dragging"));
  };
  // Both the line and the actual drop use this one geometry calculation.
  const destination = (clientY: number) => {
    const rows = [...list.querySelectorAll<HTMLLIElement>("[data-layer-row]")].filter((row) => !row.hidden);
    const before = rows.find((row) => {
      const r = row.getBoundingClientRect();
      return clientY < r.top + r.height / 2;
    });
    const row = before ?? rows.at(-1);
    if (!row) return;
    return {
      target: row.classList.contains("group-row") && !before
        ? s.elements.filter((e) => e.group === s.elements[Number(row.dataset.layerRow)].group).at(-1)!
        : s.elements[Number(row.dataset.layerRow)],
      after: !before,
      top: row.offsetTop + (before ? 0 : row.offsetHeight),
    };
  };
  list
    .querySelectorAll<HTMLButtonElement>("[data-layer-drag]")
    .forEach((handle) => {
      handle.ondragstart = (event) => {
        const e = s.elements[Number(handle.dataset.layerDrag)];
        if (e.locked || e.hidden || !event.dataTransfer) {
          event.preventDefault();
          return;
        }
        clear();
        if (e.group && (handle.closest(".group-row") || (!editingGroupMember && !event.altKey))) {
          if (groupBlocked(e.group)) { event.preventDefault(); return; }
          dragging = s.elements.filter((member) => member.group === e.group).map((e) => e.id);
        } else dragging = selection.has(e.id) ? chosen(true).map((e) => e.id) : [e.id];
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          "application/x-lcd-layers",
          JSON.stringify(dragging),
        );
        // Use a stable whole-row drag image, independent of insertion decorations.
        const row = handle.closest<HTMLLIElement>("[data-layer-row]")!;
        preview = document.createElement("ol");
        preview.className = "elements layer-drag-preview";
        preview.style.width = list.clientWidth + "px";
        preview.append(row.cloneNode(true));
        document.body.append(preview);
        event.dataTransfer.setDragImage(preview, 16, row.offsetHeight / 2);
        list
          .querySelectorAll<HTMLLIElement>("[data-layer-row]")
          .forEach((row) => {
            row.classList.toggle(
              "layer-dragging",
              dragging!.includes(s.elements[Number(row.dataset.layerRow)].id),
            );
          });
      };
      handle.ondragend = () => {
        dragging = undefined;
        clear();
      };
    });
  list.ondragover = (event) => {
    if (!dragging || surface() !== s) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    const place = destination(event.clientY);
    if (!place) return;
    indicator.style.top = Math.max(2, place.top - 1) + "px";
    if (!indicator.isConnected) list.append(indicator);
  };
  list.ondragleave = (event) => {
    if (!list.contains(event.relatedTarget as Node | null)) indicator.remove();
  };
  list.ondrop = (event) => {
    if (!dragging || surface() !== s) return;
    event.preventDefault();
    const ids = dragging,
      place = destination(event.clientY);
    dragging = undefined;
    clear();
    if (!place) return;
    const next = reorderElements(s.elements, ids, place.target.id, place.after);
    if (next.every((e, i) => e === s.elements[i])) return;
    const primary = element()?.id;
    mutate(() => {
      s.elements = next;
      selection = new Set(ids);
      selected = next.findIndex(
        (e) => e.id === (primary && ids.includes(primary) ? primary : ids[0]),
      );
    });
  };
}

function textDialog(
  title: string,
  initial: string,
  submit?: (text: string) => void | Promise<void>,
  output = false,
  kind: "Layout" | "Motion" | "Binding" = "Layout",
) {
  const d = document.querySelector<HTMLDialogElement>("#dialog")!;
  d.classList.remove("dynamics-dialog");
  d.innerHTML = `<button type="button" data-action="close" class="dialog-close" aria-label="${lang === "ja" ? "閉じる" : "Close"}">×</button><h2>${esc(title)}</h2>${output ? `<select id="format"><option value="raw">${t("raw")}</option><option value="ini">${t("ini")}</option></select>` : ""}<textarea id="input" spellcheck="false" ${output ? "readonly" : ""}>${esc(initial)}</textarea><p id="diagnostic" role="alert"></p><div class="row">${submit ? button("apply", t("apply")) : ""}${button("file", output ? t("download") : t("fileFrom"))}</div>`;
  const input = d.querySelector<HTMLTextAreaElement>("#input")!;
  d.querySelector<HTMLButtonElement>('[data-action="close"]')!.onclick = () =>
    d.close();
  d.querySelector<HTMLButtonElement>('[data-action="file"]')!.onclick = () =>
    output
      ? download(
          kind === "Layout" ? "layout.txt" : `${kind.toLowerCase()}.txt`,
          input.value,
        ).catch((error) => {
          d.querySelector("#diagnostic")!.textContent = String(error);
        })
      : pick(".txt,.ini,text/plain", (text) => (input.value = text));
  d.querySelector<HTMLButtonElement>('[data-action="apply"]')?.addEventListener(
    "click",
    async () => {
      try {
        await submit!(input.value);
      } catch (err) {
        d.querySelector("#diagnostic")!.textContent = (err as Error).message;
      }
    },
  );
  d.querySelector<HTMLSelectElement>("#format")?.addEventListener(
    "change",
    (ev) =>
      (input.value =
        (ev.target as HTMLSelectElement).value === "ini"
          ? kind === "Layout"
            ? iniLayout(surface()!.elements)
            : iniValue(
                kind,
                kind === "Motion"
                  ? writeMotion(surface()!.elements)
                  : writeBinding(surface()!.elements),
              )
          : kind === "Layout"
            ? writeLayout(surface()!.elements)
            : kind === "Motion"
              ? writeMotion(surface()!.elements)
              : writeBinding(surface()!.elements)),
  );
  if (title === t("import") && !output) {
    const hint = document.createElement("p");
    hint.textContent =
      lang === "ja"
        ? "読込対象：LCDのカスタムデータ全文。"
        : "Paste the complete custom data from the LCD.";
    d.querySelector("h2")!.after(hint);
    const alternatives = document.createElement("details");
    alternatives.innerHTML = `<summary>${lang === "ja" ? "補助操作" : "Alternative tools"}</summary><button id="drawing-import" ${surface() ? "" : "disabled"}>${t("layout")}</button>`;
    d.append(alternatives);
    alternatives.querySelector<HTMLButtonElement>("button")!.onclick = () => {
      d.close();
      void act("layout");
    };
  }
  d.showModal();
}
function gameImportDialog(initial = " ") {
  textDialog(t("import"), initial, async (text) => {
    const b = /\[Settings\.LCDSpriteDrawer\]/i.test(text)
      ? importCustomData(text)
      : parseSurfaceInfo(text);
    if (dirty() && (await confirmChanges()) !== "discard") {
      gameImportDialog(text);
      return;
    }
    mutate(() => {
      project.blocks = [b];
      blockIndex = surfaceIndex = 0;
      selected = -1;
    });
  });
}
function placementImportDialog() {
  const target = surface();
  if (!target) return;
  const ja = lang === "ja";
  const d = document.querySelector<HTMLDialogElement>("#dialog")!;
  d.classList.remove("dynamics-dialog");
  d.innerHTML = `<button id="placement-close" class="dialog-close" aria-label="${ja ? "閉じる" : "Close"}">×</button>
    <h2>${ja ? "配置のインポート" : "Import placement"}</h2>
    <p>${ja ? "取込先（現在の面）" : "Destination (current surface)"}: ${esc(project.blocks[blockIndex].name)} / ${esc(target.name)} (#${target.index})</p>
    <div class="placement-import">
      <section aria-label="${ja ? "取込元データ" : "Source data"}">
        <button id="placement-file">${ja ? "ファイルを選ぶ…" : "Choose file…"}</button>
        <span>${ja ? ".lcdproj／.json／CustomDataのテキストファイル" : ".lcdproj / .json / CustomData text file"}</span>
        <label for="placement-input">${ja ? "または、プロジェクト／CustomData全文を貼り付け" : "Or paste the complete project / CustomData"}</label>
        <textarea id="placement-input" spellcheck="false" placeholder="${ja ? "貼り付け後、下の面一覧を自動更新" : "Pasting automatically updates the surface list below"}"></textarea>
        <p id="placement-error" role="alert"></p>
      </section>
      <section aria-label="${ja ? "面の選択" : "Surface selection"}">
        <label for="placement-source">${ja ? "読み込む面" : "Surface to import"}</label><select id="placement-source" size="4" disabled></select>
        <p id="placement-info" role="status">${ja ? "先にファイルを選択、またはデータを貼り付け" : "Choose a file or paste data first"}</p>
        <div class="row"><button id="placement-apply" disabled>${ja ? "インポート" : "Import"}</button></div>
      </section>
    </div>`;
  const input = d.querySelector<HTMLTextAreaElement>("#placement-input")!;
  const select = d.querySelector<HTMLSelectElement>("#placement-source")!;
  const apply = d.querySelector<HTMLButtonElement>("#placement-apply")!;
  const error = d.querySelector("#placement-error")!;
  const info = d.querySelector("#placement-info")!;
  let sources: Surface[] = [];
  const invalidate = () => {
    sources = [];
    select.innerHTML = "";
    select.disabled = apply.disabled = true;
    error.textContent = "";
    info.textContent = ja ? "先にファイルを選択、またはデータを貼り付け" : "Choose a file or paste data first";
  };
  const describe = () => {
    const s = select.value === "" ? undefined : sources[Number(select.value)];
    info.textContent = s ? `${ja ? "要素" : "Elements"}: ${s.elements.length} / ${ja ? "表示寸法" : "Surface size"}: ${s.size.join(" × ")}` : (ja ? "一覧から読み込む面を選択" : "Select a surface from the list");
    apply.disabled = !s;
  };
  select.onchange = describe;
  d.querySelector<HTMLButtonElement>("#placement-close")!.onclick = () => d.close();
  const readSource = () => {
    invalidate();
    if (!input.value.trim()) return;
    try {
      const blocks = input.value.trimStart().startsWith("{")
        ? parseProject(input.value).blocks : [importCustomData(input.value)];
      select.add(new Option(ja ? "読み込む面を選択…" : "Select a surface…", ""));
      for (const b of blocks) for (const s of b.surfaces) {
        select.add(new Option(`${b.name} (${b.id}) / ${s.name} (#${s.index})`, String(sources.length)));
        sources.push(s);
      }
      if (!sources.length) throw Error(ja ? "取込元の面がありません" : "No source surfaces");
      select.disabled = false;
      describe();
    } catch (err) { error.textContent = (err as Error).message; }
  };
  input.oninput = readSource;
  d.querySelector<HTMLButtonElement>("#placement-file")!.onclick = () =>
    pick(".lcdproj,.json,.ini,.txt", (text) => { input.value = text; readSource(); });
  apply.onclick = () => {
    try {
      const source = select.value === "" ? undefined : sources[Number(select.value)];
      if (!source || surface() !== target) throw Error(ja ? "取込先または取込元の面を再確認" : "Check the source and destination surfaces");
      const elements = validateElements(structuredClone(source.elements));
      mutate(() => { target.elements = elements; selection.clear(); selected = -1; });
    } catch (err) { error.textContent = (err as Error).message; }
  };
  d.showModal();
}
function customDataDialog() {
  const b = project.blocks[blockIndex],
    s = surface()!;
  const d = document.querySelector<HTMLDialogElement>("#dialog")!;
  const ja = lang === "ja";
  d.classList.remove("dynamics-dialog");
  d.innerHTML = `<button id="custom-close" class="dialog-close">×</button><h2>${t("export")}</h2><p>${esc(b.name)} / ${ja ? "面" : "Screen"}: ${s.index}</p><p>${ja ? "ゲーム内スクリプトを停止し、対象LCDの最新カスタムデータ全文を控えて入力。チェックした面の描画・動きと表示対象の指定を更新。未チェック面の設定・管理状態は保持。作成した全文を同じLCDへ上書き保存後、スクリプトの設定を再読込。入力後のゲーム側変更は検知対象外。" : "Stop the in-game script. Back up and paste the latest complete custom data from this LCD. Replace checked surfaces and automatically enable them for in-game display. Unchecked surfaces retain their settings and management status. Overwrite the same LCD with the generated document and reload the settings in the in-game script. Changes after pasting cannot be detected."}</p><fieldset id="custom-surfaces"><legend>${ja ? "出力する面（チェックした面をゲームで表示）" : "Output surfaces (enable checked surfaces in game)"}</legend>${b.surfaces.map((f) => `<label><input type="checkbox" data-output-surface="${f.index}" ${f.index === s.index ? "checked" : ""}>${esc(f.name)} (#${f.index})</label>`).join("")}</fieldset><details id="exchange-alternatives"><summary>${ja ? "補助操作" : "Alternative tools"}</summary><p>${ja ? "補助操作：描画部分だけをコピーして手動貼り付け。" : "Use this when manually copying only the drawing portion."}</p><button id="drawing-export">${ja ? "描画だけ書き出す" : "Write drawings only"}</button></details><textarea id="custom-current" aria-label="Latest CustomData" spellcheck="false"></textarea><div class="row"><button id="custom-file">${t("fileFrom")}</button><button id="custom-generate">${ja ? "貼り付け用データを作成" : "Prepare data to paste"}</button></div><p id="custom-error" role="alert"></p><textarea id="custom-result" aria-label="Replacement CustomData" readonly></textarea><div class="row"><button id="custom-copy" disabled>${ja ? "全文コピー" : "Copy all"}</button><button id="custom-download" disabled>${t("download")}</button></div>`;
  const input = d.querySelector<HTMLTextAreaElement>("#custom-current")!,
    output = d.querySelector<HTMLTextAreaElement>("#custom-result")!;
  d.querySelector("h2 + p")!.prepend(ja ? "編集中：" : "Editing: ");
  const destinationHint = document.createElement("p");
  destinationHint.textContent = ja
    ? "別ブロックIDへの出力：全表示面の番号・表示寸法・テクスチャ寸法が一致する場合に対応。入力した全文のブロックID・Owner・他設定を保持。生成結果は、この入力全文を取得したLCDへ貼り付け。"
    : "A different block ID is supported when every surface index, surface size and texture size matches. The destination document's block ID, Owner and other settings are retained. Paste the result into the LCD that supplied this input document.";
  d.querySelector("#custom-surfaces")!.before(destinationHint);
  const copy = d.querySelector<HTMLButtonElement>("#custom-copy")!,
    save = d.querySelector<HTMLButtonElement>("#custom-download")!;
  const error = d.querySelector("#custom-error")!;
  const invalidate = () => {
    output.value = "";
    copy.disabled = save.disabled = true;
    error.textContent = "";
  };
  d.querySelector<HTMLButtonElement>("#drawing-export")!.onclick = () => {
    d.close();
    textDialog(
      ja ? "描画だけ書き出す" : "Write drawings only",
      writeLayout(s.elements),
      undefined,
      true,
    );
  };
  input.oninput = invalidate;
  d.querySelectorAll<HTMLInputElement>("[data-output-surface]").forEach(
    (box) => {
      box.onchange = invalidate;
    },
  );
  d.querySelector<HTMLButtonElement>("#custom-close")!.onclick = () =>
    d.close();
  d.querySelector<HTMLButtonElement>("#custom-file")!.onclick = () =>
    pick(".txt,.ini,text/plain", (text) => {
      input.value = text;
      invalidate();
    });
  d.querySelector<HTMLButtonElement>("#custom-generate")!.onclick = () => {
    invalidate();
    try {
      const selected = new Set(
        Array.from(
          d.querySelectorAll<HTMLInputElement>("[data-output-surface]:checked"),
        ).map((box) => Number(box.dataset.outputSurface)),
      );
      output.value = replaceCustomData(
        input.value,
        b,
        b.surfaces.filter((f) => selected.has(f.index)),
      );
      copy.disabled = save.disabled = false;
    } catch (e) {
      error.textContent = (e as Error).message;
    }
  };
  copy.onclick = async () => {
    error.textContent = "";
    try {
      await navigator.clipboard.writeText(output.value);
      return;
    } catch {
      // Clipboard permissions may be unavailable in the browser preview.
    }
    output.focus();
    output.select();
    try {
      if (document.execCommand("copy")) return;
    } catch {
      // Keep only the generated document selected for manual copying.
    }
    error.textContent = ja
      ? "自動コピーに失敗。出力欄の全文を選択済み。Ctrl+C：全文をコピー。"
      : "Automatic copy failed. The output is selected. Press Ctrl+C to copy.";
  };
  save.onclick = () => {
    download("custom-data.ini", output.value).catch((e) => {
      error.textContent = String(e);
    });
  };
  d.showModal();
}
function confirmChanges(exit = false): Promise<"save" | "discard" | null> {
  const previous = app.querySelector<HTMLDialogElement>("#confirm-dialog")!;
  // A close request can arrive while an import/settings dialog is open.
  app
    .querySelectorAll<HTMLDialogElement>("dialog[open]")
    .forEach((d) => d.close());
  const dialog = previous.cloneNode(false) as HTMLDialogElement;
  previous.replaceWith(dialog);
  dialog.innerHTML = `<button type="button" class="dialog-close" aria-label="${lang === "ja" ? "閉じる" : "Close"}">×</button><div class="dialog-symbol" aria-hidden="true">▧</div><h2 id="confirm-title">${t(exit ? "exitTitle" : "replaceTitle")}</h2><p id="confirm-description">${t(exit ? "exitHint" : "replaceHint")}</p><form method="dialog" class="confirm-actions"><button value="cancel" autofocus>${t(exit ? "keepEditing" : "cancel")}</button><button value="discard" class="danger">${t(exit ? "discardExit" : "replace")}</button>${exit ? `<button value="save" class="confirm-primary">${t("saveExit")}</button>` : ""}</form>`;
  dialog.querySelector<HTMLButtonElement>(".dialog-close")!.onclick = () =>
    dialog.close("cancel");
  dialog.returnValue = "cancel";
  return new Promise((resolve) => {
    dialog.querySelector("form")!.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = (event.submitter as HTMLButtonElement).value;
      dialog.close(value);
      resolve(value === "save" || value === "discard" ? value : null);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dialog.close("cancel");
      resolve(null);
    });
    dialog.addEventListener(
      "close",
      () => {
        resolve(
          dialog.returnValue === "save" || dialog.returnValue === "discard"
            ? dialog.returnValue
            : null,
        );
      },
      { once: true },
    );
    dialog.showModal();
  });
}
let closing = false;
async function requestClose() {
  pausePlayback();
  if (closing) return;
  closing = true;
  try {
    if (dirty()) {
      const choice = await confirmChanges(true);
      if (!choice) return;
      if (choice === "save") {
        await act("save");
        if (dirty()) return;
      }
    }
    flushRecovery();
    window.desktop?.closeWindow?.();
  } catch (error) {
    notify(error);
  } finally {
    closing = false;
  }
}
window.desktop?.onCloseRequested?.(() => void requestClose());
async function act(action: string) {
  if (action === "reset-scrub") {
    pausePlayback();
    previewActive = false;
    scrubTarget = undefined;
    previewError = "";
    render();
    return;
  }
  scrubTarget = undefined;
  if (
    previewActive &&
    ![
      "preview",
      "play-preview",
      "reset-preview",
      "save",
      "export",
      "motion-export",
      "binding-export",
    ].includes(action)
  ) {
    pausePlayback();
    previewActive = false;
    render();
  }
  if (["new", "open", "import", "layout", "undo", "redo"].includes(action))
    pickingColor = false;
  try {
    const s = surface(),
      e = element();
    switch (action) {
      case "preview":
        previewActive = !previewActive;
        previewTime = 0;
        previewError = "";
        previewLast = undefined;
        render();
        break;
      case "play-preview":
        if (previewPlaying) pausePlayback();
        else startPlayback();
        break;
      case "reset-preview":
        pausePlayback();
        previewTime = 0;
        refreshPreview();
        break;
      case "dynamics":
        if (s) openDynamics(s, e?.id);
        break;
      case "motion-import":
      case "binding-import":
      case "motion-export":
      case "binding-export":
        if (s)
          exchangeDynamics(
            s,
            action.startsWith("motion") ? "Motion" : "Binding",
            action.endsWith("export"),
          );
        break;
      case "circle-arrange":
      case "radial-arrange":
        circularDialog(action === "radial-arrange");
        break;
      case "settings":
        settingsDialog();
        break;
      case "defer-recovery":
        recoveryExpanded = false;
        render();
        break;
      case "review-recovery":
        recoveryExpanded = true;
        render();
        break;
      case "restore-recovery": {
        if (!pendingRecovery) break;
        const next = parseProject(pendingRecovery);
        if (dirty() && (await confirmChanges()) !== "discard") return;
        project = next;
        saved = JSON.stringify(emptyProject());
        past = [];
        future = [];
        selected = -1;
        blockIndex = surfaceIndex = 0;
        pendingRecovery = null;
        render();
        break;
      }
      case "discard-recovery":
        localStorage.removeItem(RECOVERY_KEY);
        pendingRecovery = null;
        render();
        break;
      case "left":
      case "right":
      case "top":
      case "bottom":
      case "align-x":
      case "align-y":
      case "distribute-x":
      case "distribute-y":
        if (chosen(true).length >= (action.startsWith("distribute") ? 3 : 2))
          mutate(() => {
            const draft = structuredClone(s!.elements);
            arrange(
              draft.filter(
                (e) => selection.has(e.id) && !e.locked && !e.hidden,
              ),
              action,
            );
            s!.elements = validateElements(draft);
          });
        break;
      case "eyedropper":
        if (e && !e.locked && !e.hidden) {
          pickingColor = !pickingColor;
          notice = pickingColor ? t("pickHint") : "";
          render();
        }
        break;
      case "reset-background":
        previewBackground = undefined;
        render();
        break;
      case "new":
        if (dirty() && (await confirmChanges()) !== "discard") return;
        project = emptyProject();
        saved = JSON.stringify(project);
        past = [];
        future = [];
        selected = -1;
        blockIndex = surfaceIndex = 0;
        render();
        break;
      case "open":
        pick(".lcdproj,.json,application/json", async (text) => {
          const next = parseProject(text);
          if (dirty() && (await confirmChanges()) !== "discard") return;
          project = next;
          saved = JSON.stringify(project);
          past = [];
          future = [];
          selected = -1;
          blockIndex = surfaceIndex = 0;
          render();
        });
        break;
      case "save": {
        const snapshot = JSON.stringify(project);
        const completed = await download(
          "lcd-project.lcdproj",
          serializeProject(project),
          "application/json",
        );
        if (completed) {
          saved = snapshot;
          notice = t("saved");
          render();
        } else {
          notice = t("saveCanceled");
          app.querySelector(".status")!.textContent = notice;
        }
        break;
      }
      case "import":
        gameImportDialog();
        break;
      case "placement-import":
        placementImportDialog();
        break;
      case "layout":
        if (s)
          textDialog(t("layout"), writeLayout(s.elements), (text) => {
            const parsed = parseLayout(text);
            if (
              s.elements.some(
                (old) =>
                  (old.motion?.length ?? 0) + (old.bindings?.length ?? 0) &&
                  !parsed.some((e) => e.id === old.id),
              )
            )
              throw Error(
                "Remove the element tracks first / 取込時に削除される要素の動作・変数を先に削除",
              );
            const elements = validateElements(
              parsed.map((e) => {
                const old = s.elements.find((old) => old.id === e.id);
                return {
                  ...e,
                  ...(old?.motion ? { motion: old.motion } : {}),
                  ...(old?.bindings ? { bindings: old.bindings } : {}),
                };
              }),
            );
            mutate(() => {
              s.elements = elements;
              selected = -1;
            });
          });
        break;
      case "custom-export":
        if (s) customDataDialog();
        break;
      case "export":
        if (s) customDataDialog();
        break;
      case "sample":
        mutate(() => {
          project.blocks.push(parseSurfaceInfo(sample));
          blockIndex = project.blocks.length - 1;
          surfaceIndex = 0;
          surface()!.elements = parseLayout(
            'Id=background;Type=TEXTURE;Data="SquareSimple";Size=200,100;Color=20,40,60,255\nId=label;Type=TEXT;Data="READY";TextScale=1;Color=255,255,255,255',
          );
        });
        break;
      case "shape":
      case "text":
        if (s) {
          if (s.elements.length >= 32)
            throw Error("Maximum 32 elements / 一面32要素まで");
          mutate(() => {
            s.elements.push(
              action === "shape"
                ? {
                    id: uniqueId(),
                    type: "TEXTURE",
                    data: "SquareSimple",
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 60,
                  }
                : {
                    id: uniqueId(),
                    type: "TEXT",
                    data: "TEXT",
                    x: 0,
                    y: 0,
                    scale: 1,
                  },
            );
            selected = s.elements.length - 1;
          });
        }
        break;
      case "group":
        if (s && chosen(true).length >= 2) mutate(() => {
          let n = 1;
          while (s.elements.some((e) => e.group === (lang === "ja" ? "グループ " : "Group ") + n)) n++;
          const name = (lang === "ja" ? "グループ " : "Group ") + n;
          for (const e of chosen(true)) e.group = name;
          editingGroupMember = false;
        });
        break;
      case "ungroup":
        if (s && chosen().some((e) => e.group)) mutate(() => {
          const groups = new Set(chosen().map((e) => e.group));
          for (const e of s.elements) if (e.group && groups.has(e.group)) delete e.group;
          editingGroupMember = false;
        });
        break;
      case "duplicate":
        if (s && chosen(true).length) {
          const originals = chosen(true);
          if (s.elements.length + originals.length > 32)
            throw Error("Maximum 32 elements / 一面32要素まで");
          mutate(() => {
            const groups = new Map<string, string>();
            const used = new Set(s.elements.map((e) => e.group));
            for (const e of originals) if (e.group && !groups.has(e.group)) {
              let n = 1; let name = e.group.slice(0, 60) + " (" + n + ")";
              while (used.has(name)) name = e.group.slice(0, 60) + " (" + (++n) + ")";
              groups.set(e.group, name); used.add(name);
            }
            selection.clear();
            for (const original of originals) {
              const copy = {
                ...structuredClone(original),
                id: uniqueId(),
                x: original.x + 10,
                y: original.y + 10,
              };
              if (copy.group) {
                const count = originals.filter((e) => e.group === copy.group).length;
                if (count >= 2 && count === s.elements.filter((e) => e.group === copy.group).length) copy.group = groups.get(copy.group);
                else delete copy.group;
              }
              s.elements.push(copy);
              selection.add(copy.id);
            }
            selected = s.elements.length - 1;
          });
        }
        break;
      case "delete":
        if (s && chosen(true).length)
          mutate(() => {
            const ids = new Set(chosen(true).map((e) => e.id));
            s.elements = s.elements.filter((e) => !ids.has(e.id));
            selection.clear();
            selected = -1;
          });
        break;
      case "center":
        if (chosen(true).length)
          mutate(() => {
            for (const e of chosen(true)) e.x = e.y = 0;
          });
        break;
      case "up":
      case "down":
        if (s && e && !e.locked && !e.hidden) {
          const target = selected + (action === "up" ? 1 : -1);
          if (target < 0 || target >= s.elements.length) return;
          mutate(() => {
            [s.elements[selected], s.elements[target]] = [
              s.elements[target],
              s.elements[selected],
            ];
            selected = target;
          });
        }
        break;
      case "undo":
        if (past.length) {
          future.push(JSON.stringify(project));
          project = JSON.parse(past.pop()!);
          selected = -1;
          render();
        }
        break;
      case "redo":
        if (future.length) {
          past.push(JSON.stringify(project));
          project = JSON.parse(future.pop()!);
          selected = -1;
          render();
        }
        break;
    }
  } catch (err) {
    notify(err);
  }
}
function drag(ev: PointerEvent, index: number) {
  if (ev.button !== 0) return;
  if (spaceHeld) return;
  const selectionGuardUntil = !selection.has(surface()!.elements[index].id)
    ? performance.now() + 150
    : 0;
  ev.preventDefault();
  const previousElement = element();
  const handle = (ev.target as SVGElement).dataset;
  const mode = handle.handle;
  if (mode?.startsWith("orbit") && (previewActive || scrubTarget)) return;
  const directionX = Number(handle.dx),
    directionY = Number(handle.dy);
  if (!mode && (ev.shiftKey || ev.ctrlKey || ev.metaKey)) {
    selectElement(index, true, ev.altKey);
    render();
    return;
  }
  if (ev.altKey || !selection.has(surface()!.elements[index].id)) selectElement(index, false, ev.altKey);
  else selected = index;
  if (element()!.locked || element()!.hidden || !chosen(true).length) {
    render();
    return;
  }
  if (previousElement !== element()) render();
  const syncGeometry = () => {
    const form = app.querySelector<HTMLFormElement>("#properties");
    const groupForm = app.querySelector<HTMLFormElement>("#group-properties");
    if (groupForm && selectedGroup()) {
      const box = groupBounds(chosen());
      for (const [key, value] of [["x", box.cx], ["y", box.cy]] as const) (groupForm.elements.namedItem(key) as HTMLInputElement).value = String(value);
    }
    const current = element();
    if (!form || !current) return;
    for (const key of ["x", "y", "width", "height", "angle"] as const) {
      const input = form.elements.namedItem(key) as HTMLInputElement | null;
      if (input) input.value = String(current[key] ?? 0);
    }
  };
  const group = chosen(true);
  const groupInitial = group.map((e) => ({ ...e }));
  const e = element()!,
    svg = document.querySelector<SVGSVGElement>("#canvas")!,
    dragTarget = svg;
  dragTarget.setPointerCapture(ev.pointerId);
  const inverse = svg.getScreenCTM()!.inverse(),
    point = (x: number, y: number) =>
      new DOMPoint(x, y).matrixTransform(inverse),
    start = point(ev.clientX, ev.clientY),
    x = e.x,
    y = e.y,
    angle = e.angle ?? 0,
    initialAngle = Math.atan2(start.y - y, start.x - x);
  const initial = structuredClone(e);
  const previousFuture = [...future];
  const previousPast = [...past];
  let changed = false;
  let lastPointer = ev;
  const move = (event: PointerEvent) => {
    lastPointer = event;
    // Suppress accidental snapping just after selection; repeated drags start immediately.
    if (!mode && performance.now() < selectionGuardUntil) return;
    const p = point(event.clientX, event.clientY),
      step =
        settings.fineAdjust && event.shiftKey
          ? settings.fineStep
          : snap
            ? settings.moveStep
            : 1;
    let next: Partial<Element>;
    if (mode?.startsWith("orbit")) {
      const kind = handle.kind as "motion" | "bindings";
      const draft = structuredClone(initial);
      const orbit = draft[kind]!.find((record) => record.property === "Orbit")!;
      if (mode === "orbit-rotate") {
        const [cx, cy] = orbit.center!;
        const from = Math.atan2(start.y - cy, start.x - cx);
        const to = Math.atan2(p.y - cy, p.x - cx);
        const rotationStep = settings.fineAdjust && event.shiftKey ? settings.fineStep : snap ? settings.angleStep : 1;
        const degrees = Math.round(((to - from) * 180 / Math.PI) / rotationStep) * rotationStep;
        const radians = degrees * Math.PI / 180;
        draft.x = cx + (initial.x - cx) * Math.cos(radians) - (initial.y - cy) * Math.sin(radians);
        draft.y = cy + (initial.x - cx) * Math.sin(radians) + (initial.y - cy) * Math.cos(radians);
        if (draft.type === "TEXTURE") draft.angle = (initial.angle ?? 0) + degrees;
      } else {
        const dx = Math.round((p.x - start.x) / step) * step;
        const dy = Math.round((p.y - start.y) / step) * step;
        orbit.center = [orbit.center![0] + dx, orbit.center![1] + dy];
        if (mode === "orbit-move") {
          draft.x += dx;
          draft.y += dy;
          for (const record of [...(draft.motion ?? []), ...(draft.bindings ?? [])])
            if (record.property === "Orbit" && record !== orbit)
              record.center = [record.center![0] + dx, record.center![1] + dy];
        }
      }
      const binding = draft.bindings?.find((record) => record.property === "Orbit");
      // Combined Orbit records must retain the same center.
      if (binding?.combine && binding.combine !== "Replace") {
        for (const record of [...(draft.motion ?? []), ...(draft.bindings ?? [])])
          if (record.property === "Orbit") record.center = [orbit.center![0], orbit.center![1]];
      }
      try { validateElements([draft]); } catch { return; }
      if (JSON.stringify(e) === JSON.stringify(draft)) return;
      if (!changed) { checkpoint(); changed = true; }
      Object.assign(e, draft);
      syncGeometry();
      svg.innerHTML = new DOMParser().parseFromString(draw(surface()!), "image/svg+xml").documentElement.innerHTML;
      return;
    } else if (mode === "rotate") {
      const degrees =
        angle + ((Math.atan2(p.y - y, p.x - x) - initialAngle) * 180) / Math.PI;
      const rotationStep =
        settings.fineAdjust && event.shiftKey
          ? settings.fineStep
          : snap
            ? settings.angleStep
            : 1;
      next = { angle: Math.round(degrees / rotationStep) * rotationStep };
    } else if (mode === "resize") {
      next = resizeTexture(
        initial,
        [directionX, directionY],
        [p.x - start.x, p.y - start.y],
        {
          centered: event.ctrlKey || event.metaKey,
          proportional: event.shiftKey,
          snap: snap || (settings.fineAdjust && event.shiftKey),
          step:
            settings.fineAdjust && event.shiftKey
              ? settings.fineStep
              : settings.sizeStep,
        },
      );
    } else {
      let dx = Math.round((p.x - start.x) / step) * step,
        dy = Math.round((p.y - start.y) / step) * step;
      if (objectSnap && !(settings.fineAdjust && event.shiftKey)) {
        const result = snapGroup(
          groupInitial,
          surface()!.elements.filter((e) => !selection.has(e.id)),
          dx,
          dy,
          settings.objectDistance / zoom,
        );
        dx = result.dx;
        dy = result.dy;
        activeGuides = result.guides;
      }
      next = { x: x + dx, y: y + dy };
    }
    if (
      Object.entries(next).every(
        ([key, value]) => e[key as keyof Element] === value,
      )
    )
      return;
    try {
      writeLayout(
        mode
          ? [{ ...e, ...next }]
          : groupInitial.map((old) => ({
              ...old,
              x: old.x + (next.x! - x),
              y: old.y + (next.y! - y),
            })),
      );
    } catch {
      return;
    }
    if (!changed) {
      checkpoint();
      changed = true;
    }
    if (!mode) {
      group.forEach((item, i) => {
        item.x = groupInitial[i].x + (next.x! - x);
        item.y = groupInitial[i].y + (next.y! - y);
      });
      syncGeometry();
      svg.innerHTML = new DOMParser().parseFromString(
        draw(surface()!),
        "image/svg+xml",
      ).documentElement.innerHTML;
      return;
    }
    Object.assign(e, next);
    syncGeometry();
    const visibility = svg.querySelector("#surface-visibility");
    if (visibility) visibility.outerHTML = new DOMParser().parseFromString(draw(surface()!), "image/svg+xml").querySelector("#surface-visibility")!.outerHTML;
    const guides = svg.querySelector("#orbit-guides");
    if (guides) guides.outerHTML = orbitGuidesMarkup();
    const mask = svg.querySelector("#grid-mask");
    if (mask)
      mask.outerHTML = gridMask(surface()!.elements, ...surface()!.texture);
    svg.querySelector(`[data-sprite="${index}"]`)!.outerHTML = sprite(
      e,
      index,
      surface()!,
    );
  };
  const finish = (cancel = false) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancelDrag);
    window.removeEventListener("keydown", modifiers);
    window.removeEventListener("keyup", modifiers);
    if (cancel && changed) {
      if (mode) surface()!.elements[index] = initial;
      else group.forEach((item, i) => Object.assign(item, groupInitial[i]));
      past = previousPast;
      future = previousFuture;
    }
    if (dragTarget.hasPointerCapture(ev.pointerId))
      dragTarget.releasePointerCapture(ev.pointerId);
    activeGuides = {};
    render();
  };
  const up = () => finish();
  const cancelDrag = () => finish(true);
  const modifiers = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelDrag();
      return;
    }
    if (
      (mode === "resize" && ["Control", "Meta", "Shift"].includes(event.key)) ||
      (settings.fineAdjust && event.key === "Shift")
    ) {
      move(
        new PointerEvent("pointermove", {
          clientX: lastPointer.clientX,
          clientY: lastPointer.clientY,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
        }),
      );
    }
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancelDrag);
  window.addEventListener("keydown", modifiers);
  window.addEventListener("keyup", modifiers);
}
window.addEventListener("keydown", (ev) => {
  if (
    ev.code === "Space" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(
      (ev.target as HTMLElement).tagName,
    ) &&
    !document.querySelector("dialog[open]")
  ) {
    ev.preventDefault();
    spaceHeld = true;
  }

  if (ev.key === "Escape" && pickingColor) {
    pickingColor = false;
    notice = "";
    render();
    return;
  }
  if (
    previewActive ||
    document.querySelector("dialog[open]") ||
    ["INPUT", "TEXTAREA", "SELECT"].includes((ev.target as HTMLElement).tagName)
  )
    return;
  const key = ev.key.toLowerCase();
  if (ev.ctrlKey || ev.metaKey) {
    if (key === "g") { ev.preventDefault(); act(ev.shiftKey ? "ungroup" : "group"); return; }
    if (key === "a" && !(ev.target as HTMLElement).isContentEditable) {
      const s = surface();
      if (!s) return;
      ev.preventDefault();
      const editable = s.elements.filter((e) => !e.locked && !e.hidden && (!e.group || !groupBlocked(e.group)));
      editingGroupMember = false;
      selection = new Set(editable.map((e) => e.id));
      expandGroups();
      selected = s.elements.findIndex((e) => e.id === editable.at(-1)?.id);
      selectionAnchor = editable.length ? { surface: s, id: editable[0].id } : undefined;
      scrubTarget = undefined;
      selectedPreviewTime = 0;
      render();
      return;
    }
    if (["z", "y", "s", "d"].includes(key)) {
      ev.preventDefault();
      act(
        key === "z"
          ? ev.shiftKey
            ? "redo"
            : "undo"
          : key === "y"
            ? "redo"
            : key === "s"
              ? "save"
              : "duplicate",
      );
    }
    return;
  }
  if (key === "delete") {
    act("delete");
    return;
  }
  const e = element();
  if (
    e &&
    chosen(true).length &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(ev.key)
  ) {
    ev.preventDefault();
    mutate(() => {
      const step = ev.shiftKey
        ? settings.fineAdjust
          ? settings.fineStep
          : settings.moveStep
        : 1;
      for (const item of chosen(true)) {
        item.x +=
          ev.key === "ArrowRight" ? step : ev.key === "ArrowLeft" ? -step : 0;
        item.y +=
          ev.key === "ArrowDown" ? step : ev.key === "ArrowUp" ? -step : 0;
      }
    });
  }
});
window.addEventListener("keyup", (event) => {
  if (event.code === "Space") spaceHeld = false;
});
window.addEventListener("blur", () => {
  spaceHeld = false;
  flushRecovery();
});
window.addEventListener("beforeunload", (ev) => {
  flushRecovery();
  if (dirty() && !window.desktop?.onCloseRequested) {
    ev.preventDefault();
    ev.returnValue = "";
  }
});
function openDynamics(s: Surface, id?: string) {
  dynamicsDialog(
    s,
    {
      lang,
      previewOrbit: (draft) => {
        orbitGuideDraft = draft;
        const guides = app.querySelector("#orbit-guides");
        if (guides) guides.outerHTML = orbitGuidesMarkup();
      },
      change: (elements) =>
        mutate(() => {
          s.elements = elements;
        }),
      exchange: (kind, output) => exchangeDynamics(s, kind, output),
    },
    id,
  );
}
function exchangeDynamics(
  s: Surface,
  kind: "Motion" | "Binding",
  output: boolean,
) {
  const raw =
    kind === "Motion" ? writeMotion(s.elements) : writeBinding(s.elements);
  textDialog(
    `${kind} ${lang === "ja" ? (output ? "出力" : "取込") : output ? "export" : "import"}`,
    raw,
    output
      ? undefined
      : (text) => {
          const next = applyDynamics(
            s.elements,
            kind === "Motion" ? text : writeMotion(s.elements),
            kind === "Binding" ? text : writeBinding(s.elements),
          );
          mutate(() => {
            s.elements = validateElements(next);
          });
        },
    output,
    kind,
  );
}
function previewNames(s?: Surface) {
  return [
    ...new Set(
      s?.elements.flatMap((e) => (e.bindings ?? []).map((b) => b.blockName)) ??
        [],
    ),
  ];
}
function ensurePreviewSources(s?: Surface) {
  for (const name of previewNames(s))
    previewSources[name] ??= {
      speed: 0,
      enabled: true,
      values: Object.create(null),
    };
  for (const e of s?.elements ?? [])
    for (const b of e.bindings ?? []) {
      const values = (previewSources[b.blockName].values ??=
        Object.create(null));
      values[b.source] ??= isBooleanSource(b.source) ? true : 0;
    }
}
function previewMarkup(s?: Surface) {
  const label = (ja: string, en: string) => (lang === "ja" ? ja : en);
  const names = previewNames(s);
  ensurePreviewSources(s);
  return `<section class="animation-preview" aria-label="${label("アニメーションプレビュー", "Animation preview")}">${globalTimelineMarkup(s)}${button("preview", previewActive ? label("基準編集に戻る", "Back to layout") : label("プレビュー", "Preview"), !s)}${previewActive ? `${button("play-preview", label("再生 / 一時停止", "Play / pause"))}${button("reset-preview", label("時刻を0へ", "Reset time"))}<span>${label("模擬入力・編集データには保存されません", "Simulated inputs; not saved to your project")}</span><div class="preview-sources">${names.map((name, i) => `<fieldset><legend>${esc(name)}</legend>${[...new Set(s?.elements.flatMap((e) => (e.bindings ?? []).filter((b) => b.blockName === name).map((b) => b.source)) ?? [])].map((source) => (isBooleanSource(source) ? `<label><input type="checkbox" data-preview-enabled="${i}" data-source="${source}" ${previewSources[name].values?.[source] ? "checked" : ""}>${source} (true)</label>` : `<label>${source} (${esc(SOURCE_UNITS[source] ?? "")})<input type="number" step="any" data-preview-speed="${i}" data-source="${source}" value="${previewSources[name].values?.[source]}"></label>`)).join("")}</fieldset>`).join("")}</div><p id="preview-error" role="alert">${esc(previewError)}</p>` : ""}</section>`;
}
function pausePlayback() {
  previewPlaying = false;
  selectedPlaying = false;
  updatePlaybackButton();
  if (previewFrame !== undefined) cancelAnimationFrame(previewFrame);
  previewFrame = undefined;
}
function evaluatedPreview(s: Surface) {
  try {
    const elements = evaluateElements(s.elements, previewTime, previewSources);
    previewLast = { surface: s, elements };
    previewError = "";
    return elements;
  } catch (error) {
    pausePlayback();
    previewError = (error as Error).message;
    return previewLast?.surface === s ? previewLast.elements : s.elements;
  }
}
function refreshPreview() {
  const s = surface(),
    svg = app.querySelector("#canvas");
  if (s && svg) {
    const positions = scrollPositions();
    svg.outerHTML = draw(s);
    restoreScroll(positions);
    bindSprites();
  }
  for (const selector of [
    "#preview-error",
    "#scrub-error",
    "#selected-preview-error",
  ]) {
    const error = app.querySelector(selector);
    if (error) error.textContent = previewError;
  }
  syncScrubControls();
}
function updatePlaybackButton() {
  const selectedButton =
    app?.querySelector<HTMLButtonElement>("#selected-play");
  if (selectedButton) {
    selectedButton.textContent =
      lang === "ja"
        ? selectedPlaying
          ? "停止"
          : "再生"
        : selectedPlaying
          ? "Stop"
          : "Play";
    selectedButton.setAttribute("aria-pressed", String(selectedPlaying));
  }
  const button = app?.querySelector<HTMLButtonElement>(
    "[data-action=play-preview]",
  );
  if (button) {
    button.textContent =
      lang === "ja"
        ? previewPlaying
          ? "一時停止"
          : "再生"
        : previewPlaying
          ? "Pause"
          : "Play";
    button.setAttribute("aria-pressed", String(previewPlaying));
  }
}
function startPlayback() {
  if (!previewActive || !surface()) return;
  previewPlaying = true;
  updatePlaybackButton();
  let previous: number | undefined;
  const tick = (now: number) => {
    if (!previewPlaying) return;
    // The first callback can predate the performance.now() at registration.
    // Use only frame timestamps, with the first frame as the origin.
    previewTime +=
      previous === undefined ? 0 : Math.max(0, now - previous) / 1000;
    previous = Math.max(previous ?? now, now);
    refreshPreview();
    if (previewPlaying) previewFrame = requestAnimationFrame(tick);
  };
  previewFrame = requestAnimationFrame(tick);
}
function bindPreview(s?: Surface) {
  updatePlaybackButton();
  if (previewActive)
    for (const selector of [".inspector", ".layers"])
      app.querySelector(selector)?.setAttribute("inert", "");
  const names = previewNames(s);
  app.querySelectorAll<HTMLInputElement>("[data-preview-speed]").forEach(
    (input) =>
      (input.oninput = () => {
        if (
          input.value &&
          input.checkValidity() &&
          Number.isFinite(Number(input.value))
        ) {
          previewSources[names[Number(input.dataset.previewSpeed)]].values![
            input.dataset.source as Source
          ] = Number(input.value);
          refreshPreview();
        }
      }),
  );
  app.querySelectorAll<HTMLInputElement>("[data-preview-enabled]").forEach(
    (input) =>
      (input.onchange = () => {
        previewSources[names[Number(input.dataset.previewEnabled)]].values![
          input.dataset.source as Source
        ] = input.checked;
        refreshPreview();
      }),
  );
  bindScrubControls(s);
  if (previewActive || scrubTarget) refreshPreview();
}
const sample =
  "[SurfaceInfo]\nSurfaceInfoFormatVersion=1\nBlockId=123456\nBlockName=Bridge LCD\nBlockType=MyObjectBuilder_TextPanel/LargeLCDPanel\nSurfaceCount=1\n[SurfaceInfo.Surface.0]\nDisplayName=Screen\nTextureSize=512,512\nSurfaceSize=512,512\nForegroundColor=255,255,255,255\nBackgroundColor=0,0,0,255";
render();
function globalTimelineMarkup(s?: Surface) {
  if (!s || (!previewActive && !s.elements.some((e) => e.motion?.length)))
    return "";
  const text = (ja: string, en: string) => (lang === "ja" ? ja : en);
  return `<div class="global-timeline"><label>${text("共通時間（秒・面全体）", "Shared time (s, entire surface)")}<input id="global-time-range" type="range" min="0" max="${Math.max(previewDuration, previewTime)}" step="any" value="${previewTime}"></label><input id="global-time-number" aria-label="${text("共通時間（秒）", "Shared time (s)")}" type="number" min="0" step="any" value="${previewTime}"><label>${text("スライダー上限（秒）", "Slider limit (s)")}<input id="timeline-duration" type="number" min="0.001" step="any" value="${previewDuration}"></label>${button("reset-scrub", text("基準表示に戻す", "Show base layout"))}<span>${text("確認専用・保存されません", "Preview only; not saved")}</span><p id="scrub-error" role="alert"></p></div>`;
}
function selectedPreviewMarkup(e: Element) {
  const text = (ja: string, en: string) => (lang === "ja" ? ja : en);
  const duration = motionPreviewDuration(e, surface()!.size);
  selectedPreviewTime = Math.min(selectedPreviewTime, duration);
  return `<section class="selected-preview"><h3>${text("選択要素の動作確認", "Selected element preview")}</h3>${button("dynamics", t("dynamics"), !!e.locked || !!e.hidden)}${e.motion?.length ? `<label>${text("選択要素の時間（秒）", "Selected element time (s)")}<input id="selected-time-range" type="range" min="0" max="${duration}" step="any" value="${selectedPreviewTime}"><input id="selected-time-number" type="number" min="0" max="${duration}" step="any" aria-label="${text("選択要素の時間（秒）", "Selected element time (s)")}" value="${selectedPreviewTime}"></label><button type="button" id="selected-play" aria-pressed="false" ${duration > 0 ? "" : "disabled"}>${text("再生", "Play")}</button><small>${text("1サイクル・複数動作は最長時間", "One cycle; longest duration for multiple motions")}</small>` : ""}${(
    e.bindings ?? []
  )
    .map((b, index, bindings) => {
      if (
        bindings.findIndex(
          (other) =>
            other.blockName === b.blockName && other.source === b.source,
        ) !== index
      )
        return "";
      const value = previewSources[b.blockName].values![b.source]!;
      const boolean = isBooleanSource(b.source);
      let min = b.inputMin ?? 0,
        max =
          b.inputMax ??
          (b.source.includes("Ratio")
            ? 1
            : b.source === "RotorAngle"
              ? 2 * Math.PI
              : 100);
      if (typeof value === "number") {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
      if (!Number.isFinite(max - min) || !(min < max)) {
        min = b.inputMin ?? 0;
        max = b.inputMax ?? 100;
      }
      return `<label>${esc(b.blockName)} · ${b.source} (${boolean ? "false / true" : esc(SOURCE_UNITS[b.source] ?? "")})<input type="range" data-scrub-binding="${index}" min="${boolean ? 0 : min}" max="${boolean ? 1 : max}" step="${boolean ? 1 : "any"}" value="${boolean ? Number(value) : value}">${boolean ? `<output data-scrub-value="${index}">${value}</output>` : `<input type="number" step="any" min="${min}" max="${max}" data-scrub-number="${index}" aria-label="${esc(b.blockName)} ${b.source}" value="${value}">`}</label>`;
    })
    .join(
      "",
    )}${button("reset-scrub", text("基準表示に戻す", "Show base layout"))}<p id="selected-preview-error" role="alert"></p></section>`;
}
function evaluatedScrub(s: Surface) {
  const target = scrubTarget!;
  try {
    const elements =
      target === "all"
        ? evaluateElements(s.elements, previewTime, previewSources)
        : s.elements.map((e) =>
            e === target
              ? evaluateElements([e], selectedPreviewTime, previewSources)[0]
              : e,
          );
    scrubLast = { surface: s, target, elements };
    previewError = "";
    return elements;
  } catch (error) {
    pausePlayback();
    previewError = (error as Error).message;
    return scrubLast?.surface === s && scrubLast.target === target
      ? scrubLast.elements
      : s.elements;
  }
}
function syncScrubControls() {
  for (const [rangeId, numberId, value] of [
    ["global-time-range", "global-time-number", previewTime],
    ["selected-time-range", "selected-time-number", selectedPreviewTime],
  ] as const) {
    const range = app.querySelector<HTMLInputElement>("#" + rangeId),
      number = app.querySelector<HTMLInputElement>("#" + numberId);
    const limit =
      rangeId === "selected-time-range" && element()
        ? motionPreviewDuration(element()!, surface()!.size)
        : Math.max(previewDuration, value);
    if (range) {
      range.max = String(limit);
      range.value = String(value);
    }
    if (number) {
      if (numberId === "selected-time-number") number.max = String(limit);
      if (document.activeElement !== number)
        number.value = String(Number(value.toFixed(3)));
    }
  }
  const e = element();
  for (const b of app.querySelectorAll<HTMLInputElement>(
    "[data-scrub-binding]",
  )) {
    const binding = e?.bindings?.[Number(b.dataset.scrubBinding)];
    if (!binding) continue;
    const value = previewSources[binding.blockName].values![binding.source]!;
    b.value = String(typeof value === "boolean" ? Number(value) : value);
    const label = app.querySelector(
      `[data-scrub-value="${b.dataset.scrubBinding}"]`,
    );
    if (label) label.textContent = String(value);
    const number = app.querySelector<HTMLInputElement>(
      `[data-scrub-number="${b.dataset.scrubBinding}"]`,
    );
    if (number && document.activeElement !== number)
      number.value = String(value);
  }
}
function bindScrubControls(s?: Surface) {
  const begin = (target: Element | "all") => {
    pausePlayback();
    if (scrubTarget !== target) {
      scrubLast = undefined;
      previewError = "";
    }
    scrubTarget = target;
  };
  const play = app.querySelector<HTMLButtonElement>("#selected-play");
  if (play)
    play.onclick = () => {
      if (selectedPlaying) {
        pausePlayback();
        return;
      }
      const e = element();
      if (!e || !s) return;
      const duration = motionPreviewDuration(e, s.size);
      if (!(duration > 0)) return;
      begin(e);
      if (previewActive) {
        previewActive = false;
        render();
      }
      if (selectedPreviewTime >= duration) selectedPreviewTime = 0;
      selectedPlaying = true;
      updatePlaybackButton();
      let previous: number | undefined;
      const tick = (now: number) => {
        if (!selectedPlaying || element() !== e || surface() !== s) {
          pausePlayback();
          return;
        }
        selectedPreviewTime = Math.min(
          duration,
          selectedPreviewTime +
            (previous === undefined ? 0 : Math.max(0, now - previous) / 1000),
        );
        previous = Math.max(previous ?? now, now);
        refreshPreview();
        if (selectedPreviewTime >= duration) pausePlayback();
        if (selectedPlaying) previewFrame = requestAnimationFrame(tick);
      };
      previewFrame = requestAnimationFrame(tick);
    };
  for (const id of [
    "global-time-range",
    "global-time-number",
    "selected-time-range",
    "selected-time-number",
  ]) {
    const input = app.querySelector<HTMLInputElement>("#" + id);
    if (!input) continue;
    if (id === "selected-time-number")
      input.onblur = () => {
        input.value = String(selectedPreviewTime);
      };
    input.oninput = () => {
      const value = Number(input.value);
      if (
        !input.value ||
        !input.checkValidity() ||
        !Number.isFinite(value) ||
        value < 0
      )
        return;
      if (id.startsWith("global")) {
        begin("all");
        previewTime = value;
      } else {
        const e = element();
        if (!e) return;
        begin(e);
        if (previewActive) {
          previewActive = false;
          render();
        }
        selectedPreviewTime = value;
      }
      refreshPreview();
    };
  }
  const duration = app.querySelector<HTMLInputElement>("#timeline-duration");
  if (duration)
    duration.oninput = () => {
      if (
        duration.value &&
        duration.checkValidity() &&
        Number.isFinite(Number(duration.value))
      ) {
        previewDuration = Number(duration.value);
        syncScrubControls();
        const guides = app.querySelector("#orbit-guides");
        if (guides) guides.outerHTML = orbitGuidesMarkup();
      }
    };
  app
    .querySelectorAll<HTMLInputElement>("[data-scrub-number]")
    .forEach((input) => {
      input.onblur = () => {
        const range = app.querySelector<HTMLInputElement>(
          `[data-scrub-binding="${input.dataset.scrubNumber}"]`,
        );
        if (range) input.value = range.value;
      };
    });
  app
    .querySelectorAll<HTMLInputElement>(
      "[data-scrub-binding],[data-scrub-number]",
    )
    .forEach(
      (input) =>
        (input.oninput = () => {
          const e = element(),
            binding =
              e?.bindings?.[
                Number(input.dataset.scrubBinding ?? input.dataset.scrubNumber)
              ];
          if (
            !s ||
            !e ||
            !binding ||
            !input.value ||
            !Number.isFinite(Number(input.value)) ||
            !input.checkValidity()
          )
            return;
          begin(e);
          previewSources[binding.blockName].values![binding.source] =
            isBooleanSource(binding.source)
              ? Number(input.value) === 1
              : Number(input.value);
          refreshPreview();
        }),
    );
}

function backgroundMarkup(s?: Surface) {
  return `<div class="preview-controls"><div>${t("previewBackground")} <span class="background-sliders">${["R", "G", "B"].map((channel, i) => `<label>${channel}<input type="range" data-background="${i}" aria-label="Background ${channel}" min="0" max="255" step="1" value="${(previewBackground ?? s?.background ?? [0, 0, 0, 255])[i]}"><input type="number" data-background-number="${i}" aria-label="Background ${channel} ${t("numberValue")}" min="0" max="255" step="1" required value="${(previewBackground ?? s?.background ?? [0, 0, 0, 255])[i]}"></label>`).join("")}</span></div>${button("reset-background", t("resetBackground"))}</div>`;
}
