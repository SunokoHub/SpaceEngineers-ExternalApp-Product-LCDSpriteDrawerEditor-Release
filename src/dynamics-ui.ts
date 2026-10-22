import { SPRITE_NAMES } from "./sprites";
import { validateElements, color, type Element, type Surface } from "./model";
import {
  SOURCES,
  SOURCE_UNITS,
  isBooleanSource,
  MOTION_PROPERTIES,
  BINDING_PROPERTIES,
  ANCHORS,
  evaluateMotion,
  type Motion,
  type Binding,
} from "./dynamics";
interface Options {
  lang: "ja" | "en";
  change(elements: Element[]): void;
  exchange(kind: "Motion" | "Binding", output: boolean): void;
  previewOrbit?(element?: Element | null): void;
}
const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const descriptions: Record<Binding["source"], [string, string]> = {
  Speed: [
    "船舶コントローラーが報告する船速。",
    "Ship speed reported by the controller.",
  ],
  Enabled: [
    "ブロックの有効・無効。trueは有効。",
    "Whether the functional block is enabled.",
  ],
  IsWorking: [
    "ブロックの稼働状態。trueは稼働中。",
    "Whether the block is working.",
  ],
  IsFunctional: [
    "ブロックの機能状態。trueは機能可能。",
    "Whether the block is functional.",
  ],
  PowerOutput: ["発電ブロックの現在出力。", "Current power producer output."],
  PowerMaxOutput: [
    "発電ブロックの最大出力。",
    "Maximum power producer output.",
  ],
  BatteryStoredPower: [
    "バッテリーの現在蓄電量。",
    "Current stored battery energy.",
  ],
  BatteryMaxStoredPower: [
    "バッテリーの最大蓄電量。",
    "Maximum stored battery energy.",
  ],
  BatteryChargeRatio: [
    "現在蓄電量 ÷ 最大蓄電量。通常0〜1。",
    "Stored / maximum battery energy, normally 0–1.",
  ],
  BatteryInput: ["バッテリーの現在入力。", "Current battery input."],
  BatteryMaxInput: ["バッテリーの最大入力。", "Maximum battery input."],
  BatteryIsCharging: [
    "バッテリーの充電状態。trueは充電中。",
    "Whether the battery is charging.",
  ],
  GasFillRatio: [
    "ガスタンクの充填比率。通常0〜1。",
    "Gas tank fill ratio, normally 0–1.",
  ],
  GasCapacity: ["ガスタンクの容量。", "Gas tank capacity."],
  DoorOpenRatio: [
    "ドアの開き具合。0は閉、1は開。",
    "Door opening ratio: 0 closed, 1 open.",
  ],
  PistonPosition: ["ピストンの現在位置。", "Current piston position."],
  PistonVelocity: [
    "ピストンの設定速度（実測値ではない）。",
    "Piston velocity setting, not measured velocity.",
  ],
  RotorAngle: [
    "ローターの角度。入力はrad、角度の出力は度。",
    "Rotor angle in rad; Angle output uses degrees.",
  ],
  RotorVelocity: [
    "ローターの設定回転速度（実測値ではない）。",
    "Rotor velocity setting in rpm, not measured velocity.",
  ],
  RotorLocked: [
    "ローターのロック状態。trueはロック中。",
    "Whether the rotor is locked.",
  ],
  ShipBaseMass: [
    "コントローラーが報告する船の基礎質量。",
    "Ship base mass reported by the controller.",
  ],
  ShipTotalMass: [
    "コントローラーが報告する船の総質量。",
    "Ship total mass reported by the controller.",
  ],
  ShipPhysicalMass: [
    "コントローラーが報告する船の物理質量。",
    "Ship physical mass reported by the controller.",
  ],
  NaturalGravity: [
    "自然重力の加速度の大きさ。",
    "Natural gravity acceleration magnitude.",
  ],
  ArtificialGravity: [
    "人工重力の加速度の大きさ。",
    "Artificial gravity acceleration magnitude.",
  ],
  TotalGravity: [
    "合成重力の加速度の大きさ。",
    "Total gravity acceleration magnitude.",
  ],
  AngularSpeed: [
    "船の角速度の大きさ（回転角ではない）。",
    "Ship angular speed magnitude, not a rotation angle.",
  ],
  IsUnderControl: [
    "コントローラーの操作状態。trueは操作中。",
    "Whether the controller is under control.",
  ],
  HandBrake: [
    "コントローラーのハンドブレーキ状態。",
    "Controller handbrake state.",
  ],
  Dampeners: [
    "コントローラーの慣性ダンパー状態。",
    "Controller dampeners state.",
  ],
};
const operationDescriptions: Record<
  Binding["property"] | "Orbit",
  [string, string]
> = {
  MoveX: [
    "基準位置から画面のX方向へ移動（px）。正は右、負は左。要素の回転に関係なく画面の横方向。",
    "Moves from the base position along the screen X axis in px: positive right, negative left, independent of element rotation.",
  ],
  MoveY: [
    "基準位置から画面のY方向へ移動（px）。正は下、負は上。要素の回転に関係なく画面の縦方向。",
    "Moves from the base position along the screen Y axis in px: positive down, negative up, independent of element rotation.",
  ],
  Width: [
    "図形の最終的な幅（px）。基準幅への加算なし。固定点を維持して伸縮。高さと併用する場合は固定点の一致が必要。",
    "Sets the final texture width in px, rather than adding to its base width. Resizes around Anchor; Width and Height must use the same Anchor.",
  ],
  Height: [
    "図形の最終的な高さ（px）。基準高への加算なし。固定点を維持して伸縮。幅と併用する場合は固定点の一致が必要。",
    "Sets the final texture height in px, rather than adding to its base height. Resizes around Anchor; Width and Height must use the same Anchor.",
  ],
  Angle: [
    "基準角度に加える回転角（度）。正は時計回り、負は反時計回り。寸法の固定点を優先し、未指定時は角度の固定点を使用。",
    "Adds a rotation offset to the base angle in degrees: positive clockwise, negative counterclockwise. Dimension Anchor takes priority over Angle Anchor.",
  ],
  TextScale: [
    "文字の最終倍率。標準は1、正の有限値が必要。基準倍率への加算なし。",
    "Sets the final text scale: 1 is standard, rather than an offset from base scale. Text only; the scale must remain positive and finite.",
  ],
  Orbit: [
    "公転中心X/Yを基準とする角度差（度）。正は時計回り。図形の向き：回転角度（Angle）として別に指定。",
    "Orbits the base position around Center X/Y by an offset in degrees, positive clockwise. Orientation is controlled independently by Angle.",
  ],
  Data: [
    "元の文字列を参照値へ置き換え。小数桁・前後の文字を指定可能。倍率・百分率への自動換算なし。",
    "Replaces the base text with the source number, formatted with decimals and optional prefix/suffix. No automatic unit or percentage conversion.",
  ],
  Visible: ["しきい値による表示切替。", "Switches visibility at thresholds."],
  Color: [
    "入力値の割合に応じて最小色から最大色へRGBAを補間。各成分は0〜255の整数。A=0は透明。",
    "Interpolates RGBA between MinColor and MaxColor. Channels are integers 0–255; A=0 is transparent.",
  ],
};
const modeDescriptions = {
  Clamp: [
    "初期値から毎秒の変化量を加算。最小・最大は両方指定すると範囲内に制限。両方空欄は範囲制限なし。",
    "Changes from Initial at Rate per second and stays within Min/Max when provided. Specify both bounds or leave both blank for unbounded motion.",
  ],
  Loop: [
    "最小・最大の間を循環。上端から下端へ戻り、変化量が負なら逆方向。最小・最大は必須。初期値は範囲内。",
    "Repeats between Min and Max, wrapping from the upper end to the lower end; a negative Rate reverses direction. Both bounds are required and Initial must be within them.",
  ],
  PingPong: [
    "最小・最大の間を往復。端に到達すると進行方向を反転。反対端への移動なし。最小・最大は必須。初期値は範囲内。",
    "Moves back and forth between Min and Max, reversing at each end without jumping to the opposite end. Both bounds are required and Initial must be within them.",
  ],
} satisfies Record<NonNullable<Motion["mode"]>, [string, string]>;
const sourceGroups: { ja: string; en: string; sources: readonly string[] }[] = [
  { ja: "時間", en: "Time", sources: ["Motion"] },
  {
    ja: "すべてのブロック",
    en: "All blocks",
    sources: ["IsWorking", "IsFunctional"],
  },
  { ja: "機能ブロック共通", en: "Functional blocks", sources: ["Enabled"] },
  {
    ja: "発電ブロック（バッテリーを含む）",
    en: "Power producers (including batteries)",
    sources: ["PowerOutput", "PowerMaxOutput"],
  },
  {
    ja: "バッテリー",
    en: "Battery",
    sources: [
      "BatteryStoredPower",
      "BatteryMaxStoredPower",
      "BatteryChargeRatio",
      "BatteryInput",
      "BatteryMaxInput",
      "BatteryIsCharging",
    ],
  },
  {
    ja: "ガスタンク",
    en: "Gas tank",
    sources: ["GasFillRatio", "GasCapacity"],
  },
  { ja: "ドア", en: "Door", sources: ["DoorOpenRatio"] },
  {
    ja: "ピストン",
    en: "Piston",
    sources: ["PistonPosition", "PistonVelocity"],
  },
  {
    ja: "ローター・ヒンジ",
    en: "Rotor / hinge",
    sources: ["RotorAngle", "RotorVelocity", "RotorLocked"],
  },
  {
    ja: "船舶コントローラー",
    en: "Ship controller",
    sources: [
      "Speed",
      "ShipBaseMass",
      "ShipTotalMass",
      "ShipPhysicalMass",
      "NaturalGravity",
      "ArtificialGravity",
      "TotalGravity",
      "AngularSpeed",
      "IsUnderControl",
      "HandBrake",
      "Dampeners",
    ],
  },
];
export function dynamicsDialog(
  surface: Surface,
  options: Options,
  targetId?: string,
  editing?: { kind: "motion" | "bindings"; index: number } | null,
) {
  const text = (ja: string, en: string) => (options.lang === "ja" ? ja : en);
  const d = document.querySelector<HTMLDialogElement>("#dialog")!;
  d.classList.add("dynamics-dialog");
  const e = surface.elements.find((e) => e.id === targetId);
  if (editing === undefined) {
    editing = e?.motion?.length
      ? { kind: "motion", index: 0 }
      : e?.bindings?.length
        ? { kind: "bindings", index: 0 }
        : null;
  }
  const motion =
    editing?.kind === "motion" ? e?.motion?.[editing.index] : undefined;
  const binding =
    editing?.kind === "bindings" ? e?.bindings?.[editing.index] : undefined;
  const select = (
    name: string,
    label: string,
    values: readonly string[],
    value?: string,
  ) =>
    `<label>${label}<select name="${name}">${name === "source" ? sourceGroups.map((group) => `<optgroup label="${escape(text(group.ja, group.en))}">${group.sources.map((v) => `<option value="${v}" ${v === value ? "selected" : ""}>${v === "Motion" ? text("Motion（時間変化）", "Motion (time)") : v}</option>`).join("")}</optgroup>`).join("") : values.map((v) => `<option value="${escape(v)}" ${v === value ? "selected" : ""}>${escape(v)}</option>`).join("")}</select></label>`;
  const input = (
    name: string,
    label: string,
    value: unknown = "",
    required = false,
    type = "number",
  ) =>
    `<label>${label}<input name="${name}" type="${type}" ${type === "number" ? 'step="any"' : ""} ${required ? "required" : ""} value="${escape(value)}"></label>`;
  const rows = (kind: "motion" | "bindings") =>
    (e?.[kind] ?? [])
      .map(
        (r, index) =>
          `<li><button type="button" class="dynamic-record ${editing?.kind === kind && editing.index === index ? "active" : ""}" aria-pressed="${editing?.kind === kind && editing.index === index}" data-edit="${kind}" data-index="${index}">${"rate" in r ? `Motion · ${r.property} · ${r.mode ?? "Clamp"} / ${r.rate}` : `${r.source} · ${r.property} · ${escape(r.blockName)}`}</button><button type="button" class="dynamic-remove" data-remove="${kind}" data-index="${index}" aria-label="${text("削除", "Delete")}" title="${text("削除", "Delete")}">×</button></li>`,
      )
      .join("");
  d.innerHTML = `<button type="button" id="dynamics-close" class="dialog-close" aria-label="${text("閉じる", "Close")}">×</button><h2>${text("動作・変数の設定", "Behavior and variables")}</h2><p>${text("入力変数と連動先の属性を選択。時間変化はMotionを使用。", "Choose an input variable and the property it drives. Motion changes with time.")}</p>
  <p id="dynamic-target">${text("対象要素", "Element")}: ${escape(e?.id ?? "—")} ${e ? `(${e.type})` : ""}</p>
  <fieldset ${!e || e.locked || e.hidden ? "disabled" : ""}><div class="dynamic-columns"><section><h3>${text("登録済みの動作", "Configured behaviors")}</h3><ul class="dynamic-records">${rows("motion")}${rows("bindings")}</ul><button type="button" id="dynamic-new">${text("新しい動作", "New behavior")}</button></section>
  <form id="binding-form" class="dynamic-form">
  ${select("source", text("入力変数", "Input variable"), ["Motion", ...SOURCES], binding?.source ?? "Motion")}
  ${select("property", text("連動する属性", "Driven property"), [...BINDING_PROPERTIES], motion?.property ?? binding?.property)}
  <div class="anchor-fields">${select("anchor", text("基準点（固定点）", "Anchor (pivot)"), ANCHORS, motion?.anchor ?? binding?.anchor ?? "Center")}</div>
  <aside id="source-help" class="dynamic-help" aria-live="polite"></aside>
  <p id="operation-help" class="dynamic-help" aria-live="polite"></p>
  <div class="block-binding">${input("blockName", text("参照ブロック名（完全一致）", "Exact block name"), binding?.blockName ?? "", true, "text")}</div>
  <div class="motion-fields">${select("mode", text("範囲端の動作", "Behavior at bounds"), ["Clamp", "Loop", "PingPong"], motion?.mode ?? "Clamp")}${input("rate", text("変化量 / 秒", "Rate / second"), motion?.rate ?? 10, true)}${input("initial", text("初期値（空欄＝基準値）", "Initial (blank = layout)"), motion?.initial)}${input("min", text("最小値", "Min"), motion?.min)}${input("max", text("最大値", "Max"), motion?.max)}</div>
  <p id="mode-help" class="dynamic-help" aria-live="polite"></p>

  <div class="binding-map"><p class="mapping-heading">${text("\u5165\u529b\uff08\u53c2\u7167\u5024\uff09 \u2192 \u51fa\u529b\uff08\u53cd\u6620\u5024\uff09", "Input (source value) \u2192 Output (applied value)")}</p>
  <div class="binding-input-range">${input("inputMin", text("入力の下限", "Input minimum"), binding?.inputMin ?? 0, true)}${input("inputMax", text("入力の上限", "Input maximum"), binding?.inputMax ?? 100, true)}</div>
  <div class="numeric-binding">${input("outputMin", text("下限に対応する出力", "Output at input minimum"), binding?.outputMin ?? 0, true)}${input("outputMax", text("上限に対応する出力", "Output at input maximum"), binding?.outputMax ?? 100, true)}</div>
  <div class="color-binding">${input("minColor", "Min RGBA", binding?.minColor?.join(",") ?? "255,60,60,255", true, "text")}${input("maxColor", "Max RGBA", binding?.maxColor?.join(",") ?? "60,255,120,255", true, "text")}</div>
  <div class="boolean-inputs"><span>false (0)</span><span>true (1)</span></div></div>
  <div class="text-binding">${input("decimals", text("小数桁（0〜3）", "Decimals (0–3)"), binding?.decimals ?? 1, true)}${input("prefix", text("前につける文字", "Prefix"), binding?.prefix ?? "", false, "text")}${input("suffix", text("後につける文字", "Suffix"), binding?.suffix ?? "", false, "text")}</div>

  <div class="orbit-fields">${input("centerX", text("公転中心 X", "Orbit center X"), (motion?.center ?? binding?.center)?.[0] ?? 0, true)}${input("centerY", text("公転中心 Y", "Orbit center Y"), (motion?.center ?? binding?.center)?.[1] ?? 0, true)}<p id="orbit-summary" class="dynamic-help" aria-live="polite"></p></div>

  <div class="binding-mode">${select("bindingMode", "Mode", ["Clamp", "Loop", "PingPong"], binding?.mode ?? "Clamp")}</div>
  <div class="binding-combine">${select("combine", text("Motionとの合成", "Combine with Motion"), ["", "Replace", "Add", "Multiply"], binding?.combine ?? "")}</div>
  <div class="switch-fields"><div class="switch-default"><div class="data-mode">${select("dataMode", text("デフォルト値", "Default value"), ["number", "image", "direct"], binding?.thresholds ? (e?.type === "TEXTURE" ? "image" : "direct") : e?.type === "TEXTURE" ? "image" : "number")}</div><div id="default-result"><span class="visible-default-label">${text("デフォルト値", "Default value")}</span></div><button type="button" id="threshold-add" aria-label="${text("しきい値を追加", "Add threshold")}">＋</button></div><p id="thresholds-help"></p><div id="switch-rows"></div><small id="cases-help"></small></div>
  <p id="property-help" class="dynamic-help" aria-live="polite"></p>
  <button type="submit">${editing ? text("動作を更新", "Update behavior") : text("動作を追加", "Add behavior")}</button></form></div></fieldset><p id="dynamic-error" role="alert"></p>
  <div class="dynamic-exchange">${(["Motion", "Binding"] as const).map((kind) => `<button data-exchange="${kind}">${kind}${text("取込", " import")}</button><button data-output="${kind}">${kind}${text("出力", " export")}</button>`).join("")}</div>`;
  const report = (error: unknown) => {
    d.querySelector("#dynamic-error")!.textContent =
      error instanceof Error ? error.message : String(error);
  };
  const commit = (
    change: (
      next: Element,
    ) => { kind: "motion" | "bindings"; index: number } | void,
  ) => {
    try {
      if (!e || e.locked || e.hidden) throw Error("Element is not editable");
      const next = structuredClone(e);
      const selected = change(next);
      options.change(
        validateElements(
          surface.elements.map((old) => (old.id === e.id ? next : old)),
        ),
      );
      dynamicsDialog(surface, options, e.id, selected || undefined);
    } catch (error) {
      report(error);
    }
  };
  d.querySelector<HTMLButtonElement>("#dynamic-new")!.onclick = () =>
    dynamicsDialog(surface, options, e?.id, null);
  d.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach(
    (b) =>
      (b.onclick = () =>
        dynamicsDialog(surface, options, e!.id, {
          kind: b.dataset.edit as "motion" | "bindings",
          index: Number(b.dataset.index),
        })),
  );
  d.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(
    (b) =>
      (b.onclick = () =>
        commit((next) => {
          next[b.dataset.remove as "motion" | "bindings"]!.splice(
            Number(b.dataset.index),
            1,
          );
        })),
  );
  const form = d.querySelector<HTMLFormElement>("#binding-form")!;
  const field = (name: string) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  let dataType = e?.type;
  let boundaries = binding?.thresholds?.map(String) ?? [];
  let outputs = binding?.cases?.map(String) ?? [
    e?.data ?? "",
  ];
  let rowModes: string[] = boundaries.map(() => dataType === "TEXTURE" ? "image" : "direct");
  let renderedProperty = field("property").value;
  const switchDrafts = new Map<string, { boundaries: string[]; outputs: string[]; rowModes: string[] }>();
  const captureSwitch = () => {
    rowModes = Array.from(form.querySelectorAll<HTMLSelectElement>("[name=caseMode]"), (i) => i.value);
    boundaries = Array.from(
      form.querySelectorAll<HTMLInputElement>("[name=threshold]"),
      (i) => i.value,
    );
    outputs = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[name=case]",
      ),
      (i) => i.value,
    );
  };
  const renderSwitch = () => {
    const visible = field("property").value === "Visible";
    const add = form.querySelector<HTMLButtonElement>("#threshold-add")!;
    add.disabled = !visible && field("dataMode").value === "number";
    add.title = add.disabled ? text("現在値はしきい値との併用不可。テキストを選択して追加。", "Current value cannot use thresholds. Select Text to add thresholds.") : "";

    const result = (index: number) => {
      const image = !visible && (index === 0 ? field("dataMode").value : rowModes[index - 1]) === "image";
      const raw = outputs[index];
      const value = visible
        ? ["true", "false"].includes(raw)
          ? raw
          : "true"
        : (raw ?? (image ? (e?.data ?? "SquareSimple") : ""));
      if (visible || image) {
        const choices = visible ? ["false", "true"] : [...SPRITE_NAMES];
        if (!choices.includes(value)) choices.unshift(value);
        return (
          '<select name="case" aria-label="' +
          text("結果", "Result") +
          " " +
          index +
          '">' +
          choices
            .map(
              (v) =>
                '<option value="' +
                escape(v) +
                '" ' +
                (v === value ? "selected" : "") +
                ">" +
                escape(v) +
                "</option>",
            )
            .join("") +
          "</select>"
        );
      }
      return (
        '<input name="case" type="text" aria-label="' +
        text("結果", "Result") +
        " " +
        index +
        '" value="' +
        escape(value) +
        '">'
      );
    };
    form.querySelector("#default-result")!.innerHTML = !visible && field("dataMode").value === "number"
      ? '<span role="status" aria-label="' + text("デフォルト値の内容", "Default value content") + '">' + text("参照変数の現在値を表示", "Displays the current source value") + '</span>'
      : (visible ? `<label>${text("デフォルト値", "Default value")}${result(0)}</label>` : result(0));
    form.querySelector("#switch-rows")!.innerHTML =
      boundaries
        .map(
          (v, i) =>
            '<div class="switch-row"><label>' +
            text("しきい値", "Threshold") +
            '<input name="threshold" type="number" step="any" required value="' +
            escape(v) +
            '" aria-label="' +
            text("しきい値", "Threshold") +
            " " +
            (i + 1) +
            '"></label><label>' +
            (visible ? '' : text("入力", "Input") + '<select name="caseMode" aria-label="' + text("入力方式", "Input mode") + ' ' + (i + 1) + '"><option value="direct" ' + (dataType === "TEXTURE" ? 'disabled' : '') + ' ' + (rowModes[i] === "direct" ? 'selected' : '') + '>' + text("テキスト", "Text") + '</option>' + (dataType === "TEXTURE" ? '<option value="image" ' + (rowModes[i] === "image" ? 'selected' : '') + '>' + text("画像", "Image") + '</option>' : '') + '</select></label><label>') +
            (!visible && rowModes[i] === "image" ? text("画像を選択", "Choose image") : text("値", "Value")) +
            result(i + 1) +
            '</label><button type="button" data-threshold-remove="' +
            i +
            '" aria-label="' +
            text("しきい値を削除", "Remove threshold") +
            " " +
            (i + 1) +
            '">×</button></div>',
        )
        .join("");
    if (field("property").value === "Data" && field("dataMode").value === "image")
      form.querySelector('[data-threshold-remove="0"]')?.remove();
    form.querySelectorAll<HTMLButtonElement>("[data-threshold-remove]").forEach(
      (button) =>
        (button.onclick = () => {
          captureSwitch();
          const index = Number(button.dataset.thresholdRemove);
          boundaries.splice(index, 1);
          outputs.splice(index + 1, 1);
          rowModes.splice(index, 1);
          renderSwitch();
        }),
    );
    form.querySelectorAll<HTMLSelectElement>("[name=caseMode]").forEach((control) => control.onchange = () => { captureSwitch(); renderSwitch(); });
  };
  const modes = field("dataMode") as HTMLSelectElement;
  for (const option of modes.options) {
    option.textContent =
      option.value === "number"
        ? text("現在値", "Current value")
        : option.value === "image"
          ? text("画像", "Image")
          : text("テキスト", "Text");
    option.disabled = false;
  }
  renderSwitch();
  form.querySelector<HTMLButtonElement>("#threshold-add")!.onclick = () => {
    captureSwitch();
    if (field("property").value === "Data" && field("dataMode").value === "number") return;
    const last = boundaries.at(-1);
    boundaries.push(
      last === undefined
        ? isBooleanSource(field("source").value)
          ? "0.5"
          : "10"
        : String(Number(last) + 10),
    );
    outputs.push(outputs.at(-1) ?? "");
    rowModes.push(dataType === "TEXTURE" ? "image" : "direct");
    renderSwitch();
    updateVisibility();
  };
  const updateOrbitSummary = () => {
    const summary = form.querySelector<HTMLElement>("#orbit-summary")!;
    summary.textContent = "";
    options.previewOrbit?.(null);
    if (!e || field("property").value !== "Orbit") return;
    const number = (name: string, fallback?: number) => {
      const value = field(name).value.trim();
      const result = value === "" ? fallback : Number(value);
      if (result === undefined || !Number.isFinite(result)) throw Error();
      return result;
    };
    const degrees = (value: number) => `${Number(value.toFixed(3))}°`;
    try {
      let detail: string;
      const draft = structuredClone(e);
      delete draft.motion;
      delete draft.bindings;
      const center: [number, number] = [number("centerX"), number("centerY")];
      if (field("source").value === "Motion") {
        const rate = number("rate"), initial = number("initial", 0);
        const hasRange = field("min").value.trim() !== "" || field("max").value.trim() !== "";
        const mode = field("mode").value as Motion["mode"];
        const m: Motion = { property: "Orbit", rate, initial, mode, center };
        if (hasRange) {
          m.min = number("min"); m.max = number("max");
          if (m.min >= m.max || initial < m.min || initial > m.max || !Number.isFinite(m.max - m.min) || (mode === "PingPong" && !Number.isFinite(2 * (m.max - m.min)))) throw Error();
        } else if (mode !== "Clamp") throw Error();
        const start = evaluateMotion(m, e, 0);
        draft.motion = [m];
        const range = hasRange
          ? text(`公転範囲：${degrees(m.min!)}〜${degrees(m.max!)}（${mode}）。`, `Orbit range: ${degrees(m.min!)} to ${degrees(m.max!)} (${mode}).`)
          : text("公転範囲：制限なし。", "Orbit range: unlimited.");
        detail = text(`開始時：${degrees(start)}。変化量：${degrees(rate)}/秒。`, `At start: ${degrees(start)}. Rate: ${degrees(rate)}/s.`) + range;
      } else {
        const min = number("outputMin"), max = number("outputMax");
        const boolean = isBooleanSource(field("source").value);
        if (!boolean && number("inputMin") >= number("inputMax")) throw Error();
        detail = boolean
          ? text(`false時：${degrees(min)}、true時：${degrees(max)}。`, `When false: ${degrees(min)}; when true: ${degrees(max)}.`)
          : text(`入力下限 ${number("inputMin")}：${degrees(min)}、入力上限 ${number("inputMax")}：${degrees(max)}。`, `At input minimum ${number("inputMin")}: ${degrees(min)}; at input maximum ${number("inputMax")}: ${degrees(max)}.`);
        detail += text(`出力範囲：${degrees(Math.min(min, max))}〜${degrees(Math.max(min, max))}（${field("bindingMode").value}）。`, `Output range: ${degrees(Math.min(min, max))} to ${degrees(Math.max(min, max))} (${field("bindingMode").value}).`);
        draft.bindings = [{ property: "Orbit", source: field("source").value as Binding["source"], blockName: field("blockName").value, center, outputMin: min, outputMax: max }];
      }
      const combine = field("source").value === "Motion"
        ? e.bindings?.find((b) => b.property === "Orbit")?.combine
        : field("combine").value;
      summary.textContent = text("基準位置からの公転角（正：時計回り、負：反時計回り）。", "Orbit offset from base position (positive: clockwise; negative: counterclockwise).") + detail
        + (combine ? text(` 表示値はこの動作単独。最終公転角はMotionとBindingを${combine}で合成。`, ` Values describe this behavior alone; final orbit combines Motion and Binding using ${combine}.`) : "")
        + (e.type === "TEXTURE" ? text(` 基準Angle：${degrees(e.angle ?? 0)}。Orbitによる向きの変化：0°。Angleの動作は別途適用。`, ` Base Angle: ${degrees(e.angle ?? 0)}. Orientation change from Orbit: 0°. Angle behaviors apply separately.`) : text(" 文字の向きは変更なし。", " Text orientation is unchanged."));
      summary.textContent += text(" 補助線：Orbit単独の基準位置。ループ・往復は下限／上限を表示。", " Guides show Orbit alone from the base position; Loop/PingPong show both bounds.");
      options.previewOrbit?.(draft);
    } catch {
      summary.textContent = text("公転角の算出不可：数値・範囲の設定を確認。", "Cannot calculate orbit angles: check numeric values and ranges.");
    }
  };
  const updateVisibility = () => {
    const source = field("source").value,
      timed = source === "Motion",
      boolean = isBooleanSource(source);
    const choices = (timed ? MOTION_PROPERTIES : BINDING_PROPERTIES).filter(
      (p) =>
        e?.type === "TEXT"
          ? !["Width", "Height", "Angle"].includes(p)
          : p !== "TextScale",
    );
    const current = field("property").value;
    field("property").innerHTML = choices
      .map(
        (p) =>
          `<option value="${p}" ${p === current ? "selected" : ""}>${p}</option>`,
      )
      .join("");
    const prop = field("property").value;
    captureSwitch();
    if (prop !== renderedProperty) {
      switchDrafts.set(renderedProperty, { boundaries: [...boundaries], outputs: [...outputs], rowModes: [...rowModes] });
      const draft = switchDrafts.get(prop);
      boundaries = [...(draft?.boundaries ?? [])];
      outputs = [...(draft?.outputs ?? [prop === "Visible" ? "true" : e?.data ?? ""])];
      rowModes = [...(draft?.rowModes ?? [])];
      renderedProperty = prop;
    }
    if (!timed && prop === "Data") {
      const nextType = field("dataMode").value === "image" ? "TEXTURE" : "TEXT";
      if (nextType !== dataType) {
        dataType = nextType;
        outputs = [nextType === "TEXTURE" ? "SquareSimple" : e?.data ?? ""];
      }
      rowModes = boundaries.map(() => nextType === "TEXTURE" ? "image" : "direct");
    }
    if (prop === "Data" && field("dataMode").value === "number" && boundaries.length) { boundaries = []; rowModes = []; outputs = []; }
    if (!timed && prop === "Data" && field("dataMode").value === "image" && !boundaries.length) {
      boundaries = [boolean ? "0.5" : "10"];
      outputs = [outputs[0] ?? e?.data ?? "SquareSimple", outputs[0] ?? e?.data ?? "SquareSimple"];
      rowModes = ["image"];
    }
    renderSwitch();
    d.querySelector("#thresholds-help")!.textContent =
      text(
        "＋：しきい値と結果を追加。しきい値は昇順。境界一致は以上の区間。",
        "+ adds a threshold and result. Thresholds must ascend; equality selects the upper interval.",
      ) +
      (boolean
        ? text(
            " falseは0、trueは1。二値の境界：0.5。",
            " False is 0, true is 1; use 0.5 to separate them.",
          )
        : "");
    d.querySelector("#cases-help")!.textContent =
      prop === "Visible"
        ? text("true＝表示、false＝非表示。", "true = shown, false = hidden.")
        : text(
            "画像を選択：要素全体を画像へ変更して登録（初期サイズ100×100px）。現在値・テキスト：要素全体を文字へ変更。既存動作と両立しない変更は登録不可。現在値としきい値の併用・文字と画像の混在は不可。",
            "Image converts the whole element to a texture when saved (initial size 100 x 100 px). Current value or Text converts it to text. Incompatible existing behaviors prevent saving. Current value cannot use thresholds; text and images cannot be mixed.",
          );

    field("property").setAttribute(
      "aria-describedby",
      "operation-help property-help",
    );
    field("mode").setAttribute("aria-describedby", "mode-help");
    d.querySelector("#operation-help")!.textContent =
      `${prop}: ${text(...(operationDescriptions[prop as keyof typeof operationDescriptions] ?? ["", ""]))}`;
    const modeHelp = d.querySelector<HTMLElement>("#mode-help")!;
    modeHelp.hidden = !timed;
    modeHelp.textContent = timed
      ? `${field("mode").value}: ${text(...modeDescriptions[field("mode").value as keyof typeof modeDescriptions])}`
      : "";
    for (const [selector, show] of [
      [
        ".binding-input-range",
        !timed && !boolean && !["Data", "Visible"].includes(prop),
      ],
      [".binding-mode", !timed && !["Data", "Visible"].includes(prop)],
      [
        ".binding-combine",
        !timed && (MOTION_PROPERTIES as readonly string[]).includes(prop),
      ],
      [".data-mode", !timed && prop === "Data"],
      [
        ".switch-fields",
        !timed &&
          ["Data", "Visible"].includes(prop),
      ],
      [".block-binding", !timed],
      [".motion-fields", timed],
      [
        ".numeric-binding",
        !timed && !["Data", "Visible", "Color"].includes(prop),
      ],
      [
        ".text-binding",
        !timed && prop === "Data" && field("dataMode").value === "number",
      ],
      [".color-binding", !timed && prop === "Color"],
      [
        ".anchor-fields",
        ["Width", "Height"].includes(prop) || (timed && prop === "Angle"),
      ],
      [".orbit-fields", prop === "Orbit"],
      [".binding-map", !timed && !["Data", "Visible"].includes(prop)],
      [
        ".boolean-inputs",
        !timed && boolean && !["Data", "Visible"].includes(prop),
      ],
    ] as const) {
      const box = form.querySelector<HTMLDivElement>(selector)!;
      box.hidden = !show;
      if (selector === ".binding-map") continue;
      box
        .querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("input,select,textarea")
        .forEach((i) => (i.disabled = !show));
    }
    if (!timed && prop === "Angle")
      d.querySelector("#operation-help")!.textContent += text(
        " 角度の変数連動は基準点指定不可。寸法の固定点を使用し、寸法未指定時の回転中心：図形の中心。",
        " PB does not accept an Anchor on Angle bindings. Uses the Width/Height anchor, or the center when dimensions are not driven.",
      );
    const unit =
      prop === "Angle" || prop === "Orbit"
        ? text("度", "degrees")
        : prop === "TextScale"
          ? text("倍率", "scale")
          : "px";
    for (const [name, lower] of [["outputMin", true], ["outputMax", false], ["minColor", true], ["maxColor", false]] as const) {
      const endpoint = boolean ? (lower ? "false (0)" : "true (1)") : text(lower ? "\u5165\u529b\u4e0b\u9650" : "\u5165\u529b\u4e0a\u9650", lower ? "input minimum" : "input maximum");
      const suffix = name.includes("Color") ? "RGBA" : unit;
      field(name).parentElement!.firstChild!.textContent = text(`${endpoint}\u306e\u3068\u304d\u306e\u51fa\u529b\uff08${suffix}\uff09`, `Output at ${endpoint} (${suffix})`);
    }
    d.querySelector("#source-help")!.textContent = timed
      ? text(
          "型：数値（時間変化）。時間は秒。初期値から毎秒の変化量を加算。",
          "Type: numeric (time driven) | Time: seconds. Changes from Initial at Rate per second.",
        )
      : `${text("型：", "Type: ")}${boolean ? text("真偽値｜単位なし。", "boolean | no unit. ") : text("数値｜単位：", "numeric | Unit: ") + SOURCE_UNITS[source as Binding["source"]] + ". "}${text(...descriptions[source as Binding["source"]])}`;
    d.querySelector("#property-help")!.textContent = timed
      ? text(
          `出力単位：${unit}。Rateは${unit}/秒。初期値空欄時は、移動・角度差分は0、寸法・文字倍率は基準値を使用。`,
          `Output: ${unit}; Rate: ${unit}/s. With Initial blank, movement and angle offsets start at 0; dimensions and text scale use base layout values.`,
        )
      : prop === "Visible" || (prop === "Data" && e?.type === "TEXTURE")
        ? text(
            "＋：しきい値と結果を追加。境界一致は上側区間。表示状態・画像はプルダウンから選択。",
            "+ adds a threshold and result. Equality selects the upper interval. Select visibility or images from the dropdown.",
          )
        : prop === "Color"
          ? text(
              "最小色と最大色のRGBAを補間（各成分0〜255の整数）。真偽入力は0/1。真偽入力の動作はClampのみ。",
              "Interpolates MinColor/MaxColor RGBA integers (0–255). Boolean inputs map to 0/1 and accept Clamp only.",
            )
          : prop === "Data"
            ? text(
                "テキスト：しきい値ごとに固定文字を切替。現在値：しきい値なしで小数桁・前後の文字を指定（真偽は0/1）。単位の自動換算なし。",
                "Direct input switches text at thresholds. Numeric value formats the raw number (booleans 0/1) with decimals, prefix and suffix. Units and % do not convert the value.",
              )
            : text(
                `入力範囲を出力範囲（${unit}）へ線形変換。動作はClamp・Loop・PingPongから選択。`,
                `Maps input bounds linearly to output bounds (${unit}); Mode selects Clamp, Loop or PingPong.`,
              );
    for (const name of ["min", "max"])
      field(name).required = timed && field("mode").value !== "Clamp";
  };
  form
    .querySelectorAll("select")
    .forEach((s) => s.addEventListener("change", updateVisibility));
  form.addEventListener("input", updateOrbitSummary);
  form.addEventListener("change", updateOrbitSummary);
  updateVisibility();
  updateOrbitSummary();
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    try {
      const f = new FormData(form),
        timed = f.get("source") === "Motion";
      let record: Motion | Binding;
      if (timed) {
        const m: Motion = {
          property: String(f.get("property")) as Motion["property"],
          rate: Number(f.get("rate")),
          mode: String(f.get("mode")) as Motion["mode"],
        };
        for (const name of ["initial", "min", "max"] as const)
          if (f.get(name) !== "") m[name] = Number(f.get(name));
        if (f.has("anchor"))
          m.anchor = String(f.get("anchor")) as Motion["anchor"];
        if (m.property === "Orbit")
          m.center = [Number(f.get("centerX")), Number(f.get("centerY"))];
        record = m;
      } else {
        const b: Binding = {
          property: String(f.get("property")) as Binding["property"],
          source: String(f.get("source")) as Binding["source"],
          blockName: String(f.get("blockName")),
        };
        if (b.property === "Color") {
          b.minColor = color(String(f.get("minColor")));
          b.maxColor = color(String(f.get("maxColor")));
        } else if (b.property === "Data" && f.get("dataMode") === "number") {
          b.decimals = Number(f.get("decimals"));
          b.prefix = String(f.get("prefix"));
          b.suffix = String(f.get("suffix"));
        } else if (!["Data", "Visible"].includes(b.property)) {
          for (const name of ["outputMin", "outputMax"] as const)
            b[name] = Number(f.get(name));
          if (f.has("anchor"))
            b.anchor = String(f.get("anchor")) as Binding["anchor"];
        }
        if (b.property === "Data" || b.property === "Visible") {
          if (b.property === "Visible" || f.get("dataMode") !== "number") {
            b.thresholds = f.getAll("threshold").map((v) => Number(v));
            if (!b.thresholds.length)
              throw Error(
                text(
                  "＋でしきい値と結果を追加。",
                  "Add a threshold and result using +.",
                ),
              );
            b.cases = f
              .getAll("case")
              .map((v) =>
                b.property === "Visible" ? v === "true" : String(v),
              );
            delete b.decimals;
            delete b.prefix;
            delete b.suffix;
          }
        } else {
          if (!isBooleanSource(b.source)) {
            b.inputMin = Number(f.get("inputMin"));
            b.inputMax = Number(f.get("inputMax"));
          }
          b.mode = String(f.get("bindingMode")) as Binding["mode"];
          if (f.get("combine"))
            b.combine = String(f.get("combine")) as Binding["combine"];
        }
        if (b.property === "Orbit")
          b.center = [Number(f.get("centerX")), Number(f.get("centerY"))];
        record = b;
      }
      commit((next) => {
        if (!timed && record.property === "Data" && dataType && next.type !== dataType) {
          next.type = dataType;
          if (dataType === "TEXTURE") {
            next.data = String(f.getAll("case")[0] ?? "SquareSimple");
            next.width = 100; next.height = 100; next.angle = 0;
            delete next.scale; delete next.font; delete next.alignment;
          } else {
            next.scale = 1; next.font = "Debug"; next.alignment = "CENTER";
            delete next.width; delete next.height; delete next.angle;
          }
        }
        if (editing) next[editing.kind]!.splice(editing.index, 1);
        const kind = timed ? "motion" : "bindings";
        const index =
          editing?.kind === kind ? editing.index : (next[kind]?.length ?? 0);
        if (timed) (next.motion ??= []).splice(index, 0, record as Motion);
        else (next.bindings ??= []).splice(index, 0, record as Binding);
        return { kind, index };
      });
    } catch (error) {
      report(error);
    }
  };
  d.querySelectorAll<HTMLButtonElement>(
    "[data-exchange],[data-output]",
  ).forEach(
    (b) =>
      (b.onclick = () => {
        d.close();
        options.exchange(
          (b.dataset.exchange ?? b.dataset.output) as "Motion" | "Binding",
          !!b.dataset.output,
        );
      }),
  );
  d.querySelector<HTMLButtonElement>("#dynamics-close")!.onclick = () =>
    d.close();
  d.onclose = () => options.previewOrbit?.();
  if (!d.open) d.showModal();
}
