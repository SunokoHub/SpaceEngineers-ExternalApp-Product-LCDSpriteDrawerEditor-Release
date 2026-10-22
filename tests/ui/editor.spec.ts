import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { emptyProject, parseSurfaceInfo, parseLayout } from "../../src/model";
import { importCustomData } from "../../src/custom-data";

for (const format of ["project", "custom-data"] as const) {
  test(`placement import from ${format} keeps destination metadata and supports cancel, validation and undo`, async ({ page }) => {
    const info = readFileSync("tests/fixtures/surface-info.ini", "utf8");
    const destination = emptyProject();
    destination.blocks.push(parseSurfaceInfo(info));
    destination.blocks[0].surfaces[0].size = [128, 96];
    destination.blocks[0].surfaces[0].elements = parseLayout('Id=old;Type=TEXT;Data="OLD"');
    let text: string;
    if (format === "project") {
      const source = emptyProject();
      source.blocks.push(parseSurfaceInfo(info));
      const b = source.blocks[0];
      b.id = "999";
      const other = structuredClone(b.surfaces[0]);
      other.index = 1;
      other.size = [1024, 1024];
      other.elements = parseLayout('Id=transferred;Type=TEXTURE;Data="CustomAsset";Position=500,600;Size=80,40');
      Object.assign(other.elements[0], {
        group: "copied", hidden: true, locked: true,
        motion: [{ property: "Orbit", rate: 30, center: [70, 90] }],
        bindings: [{ property: "MoveX", source: "Speed", blockName: "Original cockpit", inputMin: 0, inputMax: 100, outputMin: 0, outputMax: 50 }],
      });
      b.surfaces.push(other);
      text = JSON.stringify(source);
    } else {
      text = readFileSync("tests/fixtures/static-custom-data.ini", "utf8")
        .replace(/\r\n/g, "\n").replace("\n---", `\n${info}\n---`)
        .replace("BlockId=123456", "BlockId=999")
        .replace("SurfaceSize=512,512", "SurfaceSize=1024,1024")
        .replace("Position=0,0", "Position=500,600");
    }
    const expected = format === "project" ? JSON.parse(text).blocks[0].surfaces[1].elements : importCustomData(text).surfaces[0].elements;
    await page.goto("/");
    await page.setViewportSize({ width: 1050, height: 700 });
    const chooser = page.waitForEvent("filechooser");
    await page.locator('header [data-action=open]').click();
    await (await chooser).setFiles({ name: "target.lcdproj", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(destination)) });
    const open = async () => {
      await page.locator('header [data-action=placement-import]').click();
    };
    await open();
    await expect(page.locator('.placement-import h3, #placement-cancel')).toHaveCount(0);
    await expect(page.locator('#placement-apply')).toHaveText('インポート');
    await expect(page.locator('#placement-source')).toHaveAttribute('size', '4');
    await page.locator('#placement-input').fill('invalid');
    await expect(page.locator('#placement-error')).not.toHaveText('');
    await expect(page.locator('#placement-apply')).toBeDisabled();
    const file = page.waitForEvent('filechooser');
    await page.locator('#placement-file').click();
    await (await file).setFiles({ name: format === "project" ? "source.lcdproj" : "source.ini", mimeType: "text/plain", buffer: Buffer.from(text) });
    await expect(page.locator('#placement-source')).toBeEnabled();
    await expect(page.locator('#placement-apply')).toBeDisabled();
    await page.locator('#placement-source').selectOption(format === "project" ? '1' : '0');
    await expect(page.locator('#placement-info')).toContainText(`要素: ${expected.length}`);
    await page.locator('#placement-close').click();
    await expect(page.locator('.dirty-indicator')).toHaveText('');
    await open();
    await page.locator('#placement-input').fill(text);
    await expect(page.locator('#placement-apply')).toBeDisabled();
    await page.locator('#placement-source').selectOption(format === "project" ? '1' : '0');
    await page.locator('#placement-input').fill('');
    await expect(page.locator('#placement-source')).toBeDisabled();
    await expect(page.locator('#placement-apply')).toBeDisabled();
    await page.locator('#placement-input').fill(text);
    await page.locator('#placement-source').selectOption(format === "project" ? '1' : '0');
    const confirmBox = (await page.locator('#placement-apply').boundingBox())!;
    const sourceBox = (await page.locator('#placement-source').boundingBox())!;
    expect(confirmBox.y).toBeGreaterThan(sourceBox.y + sourceBox.height);
    expect((await page.locator('#placement-input').boundingBox())!.height).toBeGreaterThanOrEqual(160);
    expect(confirmBox.y + confirmBox.height).toBeLessThanOrEqual(700);
    await page.screenshot({ path: `test-results/placement-${format}.png` });
    await page.locator('#placement-apply').click();
    const download = page.waitForEvent('download');
    await page.locator('header [data-action=save]').click();
    const saved = JSON.parse(readFileSync((await (await download).path())!, "utf8"));
    expect(saved.blocks[0]).toEqual({ ...destination.blocks[0], surfaces: [{ ...destination.blocks[0].surfaces[0], elements: expected }] });
    await page.locator('[data-action=undo]').click();
    await expect(page.locator('#canvas [data-sprite] text')).toHaveText('OLD');
    await page.locator('[data-action=redo]').click();
    const again = page.waitForEvent('download');
    await page.locator('header [data-action=save]').click();
    expect(JSON.parse(readFileSync((await (await again).path())!, "utf8"))).toEqual(saved);
  });
}

test("help toggles preserve canvas position and scroll limits at every zoom and scroll edge", async ({ page }) => {
  const project = emptyProject();
  project.blocks.push(parseSurfaceInfo(readFileSync("tests/fixtures/surface-info.ini", "utf8")));
  project.blocks[0].surfaces[0].size = [256, 153.6];
  project.blocks[0].surfaces[0].elements = parseLayout('Id=center;Type=TEXTURE;Data="SquareSimple";Position=0,0;Size=30,30');
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.locator('header [data-action="open"]').click();
  await (await chooser).setFiles({ name: "help-position.lcdproj", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  const geometry = () => page.locator('.viewport').evaluate((viewport) => {
    const svg = viewport.querySelector<SVGSVGElement>('#canvas')!;
    const origin = new DOMPoint(0, 0).matrixTransform(svg.getScreenCTM()!);
    return { x: origin.x, y: origin.y, left: viewport.scrollLeft, top: viewport.scrollTop, width: viewport.scrollWidth, height: viewport.scrollHeight };
  });
  for (const percent of [25, 100, 200, 800]) {
    await page.locator('#zoom').fill(String(percent));
    for (const fraction of [0, 0.5, 1]) {
      await page.locator('.viewport').evaluate((viewport, fraction) => {
        viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) * fraction;
        viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) * fraction;
      }, fraction);
      const before = await geometry();
      await page.locator('#show-help').check();
      await expect(page.locator('#coordinate-guide')).toHaveCount(1);
      expect(await geometry()).toEqual(before);
      await page.locator('#show-help').uncheck();
      await expect(page.locator('#coordinate-guide')).toHaveCount(0);
      expect(await geometry()).toEqual(before);
    }
  }
  await expect(page.locator('.dirty-indicator')).toHaveText('');
  await expect(page.locator('[data-action=undo]')).toBeDisabled();
});

test("selection briefly suppresses snapping while repeated fine drags start immediately", async ({ page }) => {
  const project = emptyProject();
  project.blocks.push(parseSurfaceInfo(readFileSync("tests/fixtures/surface-info.ini", "utf8")));
  project.blocks[0].surfaces[0].elements = parseLayout('Id=moving;Type=TEXTURE;Data="SquareSimple";Position=0,0;Size=40,40\nId=target;Type=TEXTURE;Data="SquareSimple";Position=43,0;Size=40,40');
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.locator('header [data-action="open"]').click();
  await (await chooser).setFiles({ name: "selection.lcdproj", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.locator('#snap').uncheck();
  await page.locator('#object-snap').check();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const start = await page.locator('#canvas').evaluate((svg: SVGSVGElement) => {
    const p = new DOMPoint(0, 0).matrixTransform(svg.getScreenCTM()!);
    return { x: p.x, y: p.y };
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 1, start.y);
  await expect(page.locator('#properties [name=x]')).toHaveValue('0');
  await page.mouse.up();
  await expect(page.locator('.dirty-indicator')).toHaveText('');
  await expect(page.locator('[data-action=undo]')).toBeDisabled();
  // The next press on the selected image must accept even a one-pixel drag.
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 1, start.y);
  await expect(page.locator('#properties [name=x]')).toHaveValue('3');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('#properties [name=x]')).toHaveValue('0');
  await page.locator('#object-snap').uncheck();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 1, start.y);
  await expect(page.locator('#properties [name=x]')).toHaveValue('1');
  await page.mouse.up();
  await page.locator('[data-action=undo]').click();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 1, start.y);
  await expect(page.locator('#properties [name=x]')).toHaveValue('0');
  await page.clock.runFor(160);
  await page.mouse.move(start.x + 2, start.y);
  await expect(page.locator('#properties [name=x]')).toHaveValue('2');
  await page.mouse.up();
});

test("coordinate reference follows the surface with fixed screen size and leaves editing unobstructed", async ({ page }) => {
  const project = emptyProject();
  project.blocks.push(parseSurfaceInfo(readFileSync("tests/fixtures/surface-info.ini", "utf8")));
  project.blocks[0].surfaces[0].size = [256, 153.6];
  project.blocks[0].surfaces[0].elements = parseLayout('Id=center;Type=TEXTURE;Data="SquareSimple";Position=0,0;Size=30,30');
  await page.goto("/");
  await expect(page.locator('#show-help')).not.toBeChecked();
  await expect(page.locator('#coordinate-guide')).toHaveCount(0);
  const chooser = page.waitForEvent("filechooser");
  await page.locator('header [data-action="open"]').click();
  await (await chooser).setFiles({ name: "coordinates.lcdproj", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.locator('#show-help').check();
  await expect(page.locator('#coordinate-corner text').first()).toHaveText('(-128, -76.8)');
  await expect(page.locator('#coordinate-corner-end text').first()).toHaveText('(128, 76.8)');
  await expect(page.locator('#coordinate-corner-end text')).toHaveText(['(128, 76.8)', '−X', '−Y']);
  await expect(page.locator('#coordinate-origin')).toHaveText('原点 (0, 0)');
  let textWidth = 0;
  for (const percent of [25, 100, 800]) {
    await page.locator('#zoom').fill(String(percent));
    const geometry = await page.locator('#canvas').evaluate((svg: SVGSVGElement) => {
      const corner = svg.querySelector<SVGGElement>('#coordinate-corner')!;
      const p = new DOMPoint(0, 0).matrixTransform(corner.getScreenCTM()!);
      const surface = svg.querySelector('#preview-fill')!.getBoundingClientRect();
      const arrows = corner.querySelector('path')!.getBoundingClientRect();
      const text = corner.querySelector('text')!.getBoundingClientRect();
      const end = svg.querySelector<SVGGElement>('#coordinate-corner-end')!;
      const endPoint = new DOMPoint(0, 0).matrixTransform(end.getScreenCTM()!);
      const endArrows = end.querySelector('path')!.getBoundingClientRect();
      return { dx: p.x - surface.left, dy: p.y - surface.top, width: arrows.width, height: arrows.height, textWidth: text.width, endDx: endPoint.x - surface.right, endDy: endPoint.y - surface.bottom, endWidth: endArrows.width, endHeight: endArrows.height };
    });
    expect(geometry.dx).toBeCloseTo(0);
    expect(geometry.dy).toBeCloseTo(0);
    expect(geometry.width).toBeCloseTo(64);
    expect(geometry.height).toBeCloseTo(50);
    expect(geometry.endDx).toBeCloseTo(0);
    expect(geometry.endDy).toBeCloseTo(0);
    expect(geometry.endWidth).toBeCloseTo(64);
    expect(geometry.endHeight).toBeCloseTo(50);
    if (textWidth) expect(geometry.textWidth).toBeCloseTo(textWidth);
    textWidth = geometry.textWidth;
  }
  await page.locator('#zoom').fill('100');
  await page.locator('#coordinate-origin').scrollIntoViewIfNeeded();
  const origin = await page.locator('#canvas').evaluate((svg: SVGSVGElement) => {
    const p = new DOMPoint(0, 0).matrixTransform(svg.getScreenCTM()!);
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(origin.x, origin.y);
  await expect(page.locator('#properties [name=id]')).toHaveValue('center');
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#coordinate-origin')).toHaveText('Origin (0, 0)');
  await expect(page.locator('.dirty-indicator')).toHaveText('');
  await page.reload();
  await expect(page.locator('#show-help')).toBeChecked();
  await page.locator('[data-action=sample]').click();
  await expect(page.locator('#coordinate-guide')).toHaveCount(1);
  await page.locator('#show-help').uncheck();
  await expect(page.locator('#coordinate-guide')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#show-help')).not.toBeChecked();
});

test("off-surface shapes stay dimmed and their controls remain reachable beyond every texture edge", async ({ page }) => {
  const project = emptyProject();
  project.blocks.push(parseSurfaceInfo(readFileSync("tests/fixtures/surface-info.ini", "utf8")));
  const surface = project.blocks[0].surfaces[0];
  surface.size = [300, 200];
  surface.elements = parseLayout('Id=outside;Type=TEXTURE;Data="SquareSimple";Position=150,0;Size=120,80;AngleDegrees=30;Color=255,255,255,255');
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.locator('header [data-action="open"]').click();
  await (await chooser).setFiles({ name: "outside.lcdproj", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.locator('[data-element="0"]').click();
  const alpha = await page.locator('#canvas').evaluate(async (original: SVGSVGElement) => {
    const svg = original.cloneNode(true) as SVGSVGElement;
    svg.removeAttribute('style');
    svg.setAttribute('width', '512');
    svg.setAttribute('height', '512');
    for (const child of [...svg.children]) if (child.tagName !== 'defs' && !child.hasAttribute('data-sprite')) child.remove();
    const sprite = svg.querySelector('[data-sprite]')!;
    for (const child of [...sprite.children]) if (!child.classList.contains('sprite-content')) child.remove();
    const image = new Image();
    image.src = 'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    return [ctx.getImageData(386, 256, 1, 1).data[3], ctx.getImageData(436, 256, 1, 1).data[3]];
  });
  expect(alpha[0]).toBe(255);
  expect(alpha[1]).toBeGreaterThanOrEqual(63);
  expect(alpha[1]).toBeLessThanOrEqual(65);
  await page.locator('#properties [name=angle]').fill('0');
  for (const [x, y] of [[600, 0], [-600, 0], [0, 600], [0, -600]]) {
    await page.locator('#properties [name=x]').fill(String(x));
    await page.locator('#properties [name=y]').fill(String(y));
    const handle = page.locator('[data-handle=resize][data-dx="1"][data-dy="0"]');
    await handle.scrollIntoViewIfNeeded();
    const box = (await handle.boundingBox())!;
    const hit = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.getAttribute('data-handle'), { x: box.x + 5, y: box.y + 5 });
    expect(hit).toBe('resize');
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + 25, box.y + 5);
    await page.mouse.up();
    await expect(page.locator('#properties [name=width]')).toHaveValue('140');
    await page.locator('[data-action=undo]').click();
    await page.locator('[data-element="0"]').click();
    await expect(page.locator('#properties [name=width]')).toHaveValue('120');
  }
});

test("lcdproj opens validated JSON and invalid projects preserve unsaved edits and undo", async ({ page }) => {
  const project = emptyProject();
  project.blocks.push(parseSurfaceInfo(readFileSync("tests/fixtures/surface-info.ini", "utf8")));
  project.blocks[0].surfaces[0].elements = parseLayout('Id=a;Type=TEXT;Data="FILE"');
  await page.goto("/");
  let chooser = page.waitForEvent("filechooser");
  await page.locator('header [data-action="open"]').click();
  const input = await chooser;
  expect(await input.element().getAttribute("accept")).toContain(".lcdproj");
  await input.setFiles({ name: "valid.lcdproj", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("FILE");
  await page.locator('[data-element="0"]').click();
  await page.locator("[name=data]").fill("EDITED");
  project.blocks[0].surfaces[0].elements.push(structuredClone(project.blocks[0].surfaces[0].elements[0]));
  chooser = page.waitForEvent("filechooser");
  await page.locator('header [data-action="open"]').click();
  await (await chooser).setFiles({ name: "invalid.lcdproj", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator(".status")).toContainText("重複ID");
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("EDITED");
  await expect(page.locator("#confirm-dialog")).not.toBeVisible();
  await page.locator('[data-action="undo"]').click();
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("FILE");
});
test("CustomData import and final replacement use the latest document", async ({
  page,
}) => {
  const info = readFileSync(
    "tests/fixtures/surface-info.ini",
    "utf8",
  );
  const source = readFileSync(
    "tests/fixtures/static-custom-data.ini",
    "utf8",
  )
    .replace(/\r\n/g, "\n")
    .replace("\n---", `\n${info}\n---`);
  await page.goto("/");
  await expect(
    page
      .getByRole("button", { name: "ゲームから読み込む", exact: true })
      .first(),
  ).toBeVisible();
  await expect(page.locator('header [data-action="layout"]')).toHaveCount(0);
  await page.locator('header [data-action="import"]').click();
  await page.locator("#input").fill(source);
  await page.locator('#dialog [data-action="apply"]').click();
  await page.locator('[data-element="1"]').click();
  await page.locator('[name="data"]').fill("NEW READY");
  await page.locator('[data-action="export"]').click();
  await expect(
    page.getByRole("heading", { name: "ゲームへ書き出す", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#custom-current")).toBeVisible();
  await expect(page.locator("#drawing-export")).not.toBeVisible();

  await expect(page.locator("#custom-current")).toHaveValue("");
  await page
    .locator("#custom-current")
    .fill(source.replace("Value=keep", "Value=latest"));
  await page.locator("#custom-generate").click();
  await expect(page.locator("#custom-result")).toHaveValue(/Value=latest/);
  await expect(page.locator("#custom-result")).toHaveValue(/NEW READY/);
  const generated = await page.locator("#custom-result").inputValue();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new DOMException("Denied", "NotAllowedError"));
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("dialog[open]")!);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
  });
  await page.locator("#custom-copy").click();
  await expect.poll(() => page.evaluate(async () =>
    (await navigator.clipboard.readText()).replace(/\r\n/g, "\n"),
  )).toBe(generated);
  await expect(page.locator("#custom-error")).toHaveText("");
  await page.evaluate(() => { document.execCommand = () => false; });
  await page.locator("#custom-copy").click();
  await expect(page.locator("#custom-error")).toContainText("Ctrl+C");
  await expect(page.locator("#custom-result")).toBeFocused();
  expect(await page.locator("#custom-result").evaluate((node: HTMLTextAreaElement) =>
    node.value.slice(node.selectionStart, node.selectionEnd),
  )).toBe(generated);
  await page
    .locator("#custom-current")
    .fill(source.replace("BlockId=123456", "BlockId=99"));
  await expect(page.locator("#custom-download")).toBeDisabled();
  await page.locator("#custom-generate").click();
  await expect(page.locator("#custom-error")).toHaveText("");
  await expect(page.locator("#custom-result")).toHaveValue(/BlockId=99/);
  await expect(page.locator("#custom-result")).toHaveValue(/NEW READY/);
  await page.locator("#custom-current").fill(source.replace("BlockId=123456", "BlockId=99").replace("SurfaceSize=512,512", "SurfaceSize=256,256"));
  await page.locator("#custom-generate").click();
  await expect(page.locator("#custom-error")).toContainText("全表示面");
  await expect(page.locator("#custom-result")).toHaveValue("");
});
test("sample → edit → undo/redo → bilingual export → save and reopen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await expect(page.locator("#canvas")).toBeVisible();
  await page.locator('[data-element="1"]').click();
  await page.locator("[name=data]").fill("HELLO 日本語");
  await page.locator("[name=x]").fill("40");
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("HELLO 日本語");
  await page.locator("[data-action=undo]").click();
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("HELLO 日本語");
  await page.locator("[data-action=undo]").click();
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("READY");
  await page.locator("[data-action=redo]").click();
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("HELLO 日本語");
  await page.locator("#language").selectOption("en");
  await openDrawingExport(page);
  await expect(page.locator("#input")).toContainText("HELLO 日本語");
  await page.locator("#format").selectOption("ini");
  await expect(page.locator("#input")).toHaveValue(/^Layout=\n\|Id=/);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("lcd-project.lcdproj");
  const path = await file.path();
  expect(path).toBeTruthy();
  const saved = readFileSync(path!, "utf8");
  expect(JSON.parse(saved).blocks[0].surfaces[0].elements[1].data).toBe(
    "HELLO 日本語",
  );
  await page.getByRole("button", { name: "New", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(saved),
  });
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("HELLO 日本語");
  expect(errors).toEqual([]);
});
test("invalid and unsupported Layout stays in input; approximate asset preserves name", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDrawingImport(page);
  const raw = 'Id=a;Type=TEXTURE;Data="UnknownGameAsset";Size=100,50;Unknown=1';
  await page.locator("#input").fill(raw);
  await page.locator("dialog [data-action=apply]").click();
  await expect(page.locator("#diagnostic")).toContainText("Unknown");
  await expect(page.locator("#input")).toHaveValue(raw);
  await page.locator("#input").fill(raw.replace(";Unknown=1", ""));
  await page.locator("dialog [data-action=apply]").click();
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("UnknownGameAsset");
  await openDrawingExport(page);
  await expect(page.locator("#input")).toContainText('Data="UnknownGameAsset"');
});
test("surface info import keeps non-square visible area and large ID", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("header [data-action=import]").click();
  const info = readFileSync(
    "tests/fixtures/surface-info.ini",
    "utf8",
  )
    .replace("123456", "9223372036854775807")
    .replace("SurfaceSize=512,512", "SurfaceSize=300,200");
  await page.locator("#input").fill(info);
  await page.locator("dialog [data-action=apply]").click();
  await expect(page.locator(".block-name")).toContainText(
    "9223372036854775807",
  );
  await expect(page.locator(".dimensions")).toContainText("300 × 200");
  await expect(page.locator("#canvas")).toHaveAttribute(
    "viewBox",
    "-256 -256 512 512",
  );
});

test("canceling native save preserves unsaved state", async ({ page }) => {
  await page.addInitScript(() => {
    window.desktop = { saveDocument: async () => false };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await expect(page.locator(".dirty-indicator")).toContainText("●");
  await page.locator("header [data-action=save]").click();
  await expect(page.locator(".dirty-indicator")).toContainText("●");
});

test("grouped texture choices apply immediately and preserve imported identifiers", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  const choice = page.locator("select[name=data]");
  await expect(choice.locator("option")).toHaveCount(378);
  for (const removed of ["Background08", "Background09", "Background10", "IconTemperature", "OutOfOrder"])
    await expect(choice.locator('option[value="' + removed + '"]')).toHaveCount(0);
  await expect(choice.locator("optgroup").first()).toHaveAttribute(
    "label",
    "基本図形",
  );
  await expect(choice.locator("option").first()).toHaveValue("SquareSimple");
  await expect(choice).toHaveValue("SquareSimple");
  await expect(page.locator("#custom-texture")).toHaveCount(0);
  await expect(page.locator("#properties button[type=submit]")).toHaveCount(0);
  const name = "Textures\\FactionLogo\\PirateIcon.dds";
  await choice.selectOption(name);
  await openDrawingExport(page);
  await expect(page.locator("#input")).toContainText(
    'Data="Textures\\\\FactionLogo\\\\PirateIcon.dds"',
  );
  await page.locator("dialog [data-action=close]").click();
  await openDrawingImport(page);
  await page
    .locator("#input")
    .fill('Id=unknown;Type=TEXTURE;Data="Mod/CustomSprite";Size=100,50');
  await page.locator("dialog [data-action=apply]").click();
  await page.locator('[data-element="0"]').click();
  await expect(choice).toHaveValue("Mod/CustomSprite");
  await page.locator("[name=x]").fill("20");
  await openDrawingExport(page);
  await expect(page.locator("#input")).toContainText('Data="Mod/CustomSprite"');
  await page.locator("dialog [data-action=close]").click();
  await page.locator("[data-action=shape]").click();
  await expect(choice).toHaveValue("SquareSimple");
  await page.locator("#language").selectOption("en");
  await expect(choice.locator("optgroup").first()).toHaveAttribute(
    "label",
    "Basic shapes",
  );
});

test("editor tools preserve output while changing preview and sprite type", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("header [data-action=import]").click();
  await expect(page.locator("dialog .row button")).toHaveText([
    "適用",
    "ファイルから",
  ]);
  await page.locator("dialog [data-action=close]").click();
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await expect(
    page.locator('[data-layer-row="0"] [data-action=duplicate]'),
  ).toBeVisible();
  const left = await page.locator(".inspector").boundingBox();
  const right = await page.locator(".layers").boundingBox();
  expect(left!.x).toBeLessThan(right!.x);
  await page.locator("#sprite-type").check();
  await expect(page.locator("textarea[name=data]")).toHaveValue("SquareSimple");
  await page.locator("#sprite-type").uncheck();
  await expect(page.locator("[name=width]")).toHaveValue("200");
  await page.locator('[data-channel="0"]').fill("125");
  await expect(page.locator("[name=color]")).toHaveValue("125,40,60,255");
  await openDrawingExport(page);
  const before = await page.locator("#input").inputValue();
  expect(before).toContain("Color=125,40,60,255");
  await page.locator("dialog [data-action=close]").click();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("header [data-action=save]").click();
  const original = readFileSync((await (await downloadEvent).path())!, "utf8");
  await page.locator('[data-background="0"]').fill("255");
  await page.locator('[data-background="2"]').fill("136");
  await expect(page.locator("#preview-fill")).toHaveAttribute(
    "fill",
    "rgba(255,0,136,1)",
  );
  await expect(page.locator(".dirty-indicator")).not.toContainText("●");
  await openDrawingExport(page);
  await expect(page.locator("#input")).toHaveValue(before);
  await page.locator("dialog [data-action=close]").click();
  const nextDownload = page.waitForEvent("download");
  await page.locator("header [data-action=save]").click();
  expect(readFileSync((await (await nextDownload).path())!, "utf8")).toBe(
    original,
  );
  await page.locator("[data-action=reset-background]").click();
  await expect(page.locator("#preview-fill")).toHaveAttribute(
    "fill",
    "rgba(0,0,0,1)",
  );
});

test("canvas resize and rotation support zoom, snapping and undo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await page.locator("#zoom").fill("75");
  const resize = await page
    .locator('[data-handle=resize][data-dx="1"][data-dy="1"]')
    .boundingBox();
  await page.mouse.move(
    resize!.x + resize!.width / 2,
    resize!.y + resize!.height / 2,
  );
  await page.keyboard.down("Control");
  await page.mouse.down();
  await page.mouse.move(
    resize!.x + resize!.width / 2 + 30,
    resize!.y + resize!.height / 2 + 15,
    { steps: 4 },
  );
  await expect(page.locator("[name=width]")).toHaveValue("280");
  await expect(page.locator("[name=height]")).toHaveValue("140");
  await page.mouse.up();
  await page.keyboard.up("Control");
  await expect(page.locator("[name=width]")).toHaveValue("280");
  await expect(page.locator("[name=height]")).toHaveValue("140");
  const canvas = await page.locator("#canvas").boundingBox();
  const rotate = await page.locator("[data-handle=rotate]").boundingBox();
  await page.mouse.move(
    rotate!.x + rotate!.width / 2,
    rotate!.y + rotate!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas!.x + canvas!.width / 2 + 100,
    canvas!.y + canvas!.height / 2,
    { steps: 4 },
  );
  await expect(page.locator("[name=angle]")).toHaveValue("90");
  await page.mouse.up();
  await expect(page.locator("[name=angle]")).toHaveValue("90");
  await page.locator("[data-action=undo]").click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("[name=angle]")).toHaveValue("0");
  await expect(page.locator("[name=width]")).toHaveValue("280");
  await page.locator("[data-action=undo]").click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("[name=width]")).toHaveValue("200");
  await page.locator("[data-action=redo]").click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("[name=width]")).toHaveValue("280");
});

test("all resize handles respect their axes at a rotated angle", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("[data-handle=resize]")).toHaveCount(8);
  await page.locator("[name=angle]").fill("30");
  await page.locator("#snap").uncheck();
  await page.keyboard.down("Control");
  for (const [dx, dy] of [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ]) {
    const target = page.locator(
      `[data-handle=resize][data-dx="${dx}"][data-dy="${dy}"]`,
    );
    await target.scrollIntoViewIfNeeded();
    const handle = await target.boundingBox();
    await expect(target).toBeVisible();
    expect(
      await target.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return document
          .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
          ?.getAttribute("data-handle");
      }),
    ).toBe("resize");
    const x = handle!.x + handle!.width / 2,
      y = handle!.y + handle!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    const angle = Math.PI / 6;
    await page.mouse.move(
      x + 10 * dx * Math.cos(angle) - 10 * dy * Math.sin(angle),
      y + 10 * dx * Math.sin(angle) + 10 * dy * Math.cos(angle),
      { steps: 3 },
    );
    await page.mouse.up();
    await expect(page.locator("[name=width]")).toHaveValue(
      String(200 + (dx ? 20 : 0)),
    );
    await expect(page.locator("[name=height]")).toHaveValue(
      String(100 + (dy ? 20 : 0)),
    );
    await expect(page.locator("[name=x]")).toHaveValue("0");
    await expect(page.locator("[name=y]")).toHaveValue("0");
    await page.locator("[data-action=undo]").click();
    await page.locator('[data-element="0"]').click();
  }
  await page.keyboard.up("Control");
});

test("Ctrl wheel zoom and palettes do not alter preview-only project data", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-channel="3"]').fill("100");
  await page.locator("[name=color]").fill("255,0,0,100");
  await page.locator('[data-palette-slot="0"]').click();
  await page.locator("[name=color]").fill("255,0,0,100");
  await expect(page.locator("[name=color]")).toHaveValue("255,0,0,100");
  await expect(
    page.locator('#canvas [data-sprite="0"] rect').first(),
  ).toHaveAttribute("fill", "rgba(255,0,0,0.39215686274509803)");
  await page.locator("[name=width]").fill("");
  await expect(page.locator("[name=width]")).toHaveValue("");
  await openDrawingExport(page);
  await expect(page.locator("#input")).toContainText("Size=200,100");
  await page.locator("dialog [data-action=close]").click();
  await page.locator("[name=width]").fill("220");
  await page.locator("[name=data]").selectOption("Circle");
  await expect(page.locator("#canvas [data-sprite] ellipse")).toHaveCount(1);
  await openDrawingExport(page);
  const before = await page.locator("#input").inputValue();
  await page.locator("dialog [data-action=close]").click();
  await page.locator('[data-background="1"]').fill("255");
  await page.locator('[data-background="2"]').fill("255");
  await expect(page.locator("#preview-fill")).toHaveAttribute(
    "fill",
    "rgba(0,255,255,1)",
  );
  const wheel = (deltaY: number, ctrlKey: boolean) =>
    page.locator(".viewport").dispatchEvent("wheel", { deltaY, ctrlKey });
  await wheel(-100, false);
  await expect(page.locator("#zoom")).toHaveValue("100");
  await wheel(-100, true);
  await expect(page.locator("#zoom")).toHaveValue("110");
  for (let i = 0; i < 80; i++) await wheel(-100, true);
  await expect(page.locator("#zoom")).toHaveValue("800");
  for (let i = 0; i < 80; i++) await wheel(100, true);
  await expect(page.locator("#zoom")).toHaveValue("25");
  await openDrawingExport(page);
  await expect(page.locator("#input")).toHaveValue(before);
});

test("eight sample palette colors apply, update while selected and reset on restart", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("[data-palette-slot]")).toHaveCount(8);
  await expect(page.locator(".preview-controls .palette")).toHaveCount(0);
  const initialColors = await page
    .locator("[data-palette-slot]")
    .evaluateAll((slots) => slots.map((slot) => slot.getAttribute("title")));
  expect(new Set(initialColors).size).toBe(8);
  expect(initialColors.every((color) => /^\d+,\d+,\d+,255$/.test(color!))).toBe(
    true,
  );
  const slot = page.locator('[data-palette-slot="0"]');
  await slot.click();
  await expect(slot).toHaveAttribute("title", "255,255,255,255");
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-channel="0"]').fill("125");
  await page.locator('[data-channel="3"]').fill("90");
  await expect(slot).toHaveAttribute("title", "125,255,255,90");
  await slot.click();
  await page.locator("[name=color]").fill("1,2,3,4");
  await expect(slot).toHaveAttribute("title", "125,255,255,90");
  await page.locator('[data-palette-slot="1"]').click();
  await expect(page.locator('[data-palette-slot="1"]')).toHaveAttribute(
    "title",
    "0,0,0,255",
  );
  await page.locator('[data-element="1"]').click();
  await slot.click();
  await expect(page.locator("[name=color]")).toHaveValue("125,255,255,90");
  await page.locator("[name=color]").fill("9,8,7,6");
  await expect(slot).toHaveAttribute("title", "9,8,7,6");
  await openDrawingExport(page);
  const layout = await page.locator("#input").inputValue();
  expect(layout).toContain("Color=9,8,7,6");
  await page.locator("dialog [data-action=close]").click();
  const download = page.waitForEvent("download");
  await page.locator("header [data-action=save]").click();
  const saved = readFileSync((await (await download).path())!, "utf8");
  expect(saved).not.toContain("palette");
  await page.reload();
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await expect(slot).toHaveAttribute("title", "255,255,255,255");
});

test("eyedropper copies source RGBA and preview background without selecting or moving the source", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="1"]').click();
  await page.locator("[name=color]").fill("11,22,33,44");
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-palette-slot="0"]').click();
  await page.locator("[data-action=eyedropper]").click();
  await page.locator('#canvas [data-sprite="1"] text').click();
  await expect(page.locator("[name=id]")).toHaveValue("background");
  await expect(page.locator("[name=color]")).toHaveValue("11,22,33,44");
  await expect(page.locator('[data-palette-slot="0"]')).toHaveAttribute(
    "title",
    "11,22,33,44",
  );
  await page.locator("[data-action=undo]").click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("[name=color]")).toHaveValue("255,255,255,255");
  await page.locator('[data-background="0"]').fill("150");
  await page.locator("[data-action=eyedropper]").click();
  await page.locator("#canvas").click({ position: { x: 30, y: 30 } });
  await expect(page.locator("[name=color]")).toHaveValue("150,0,0,255");
  await page.locator("[data-action=eyedropper]").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#canvas")).not.toHaveClass(/picking-color/);
});

test("resize modifiers change during a drag and Escape cancels a gesture", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await page.locator("#snap").uncheck();
  const handle = page.locator('[data-handle=resize][data-dx="1"][data-dy="0"]');
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, {
    steps: 3,
  });
  const rect = page.locator('#canvas [data-sprite="0"] rect').first();
  const sprite = page.locator('#canvas [data-sprite="0"]');
  await expect(rect).toHaveAttribute("width", "220");
  await expect(sprite).toHaveAttribute(
    "transform",
    "translate(10 0) rotate(0)",
  );
  await page.keyboard.down("Control");
  await expect(rect).toHaveAttribute("width", "240");
  await expect(sprite).toHaveAttribute("transform", "translate(0 0) rotate(0)");
  await page.keyboard.down("Shift");
  await expect(rect).toHaveAttribute("height", "120");
  await page.keyboard.up("Control");
  expect(Number(await rect.getAttribute("height"))).toBeCloseTo(110);
  await page.keyboard.up("Shift");
  await expect(rect).toHaveAttribute("height", "100");
  await page.mouse.up();
  await expect(page.locator("[name=x]")).toHaveValue("10");
  await page.locator("[data-action=undo]").click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("[name=width]")).toHaveValue("200");
  const again = (await handle.boundingBox())!;
  await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    again.x + again.width / 2 + 25,
    again.y + again.height / 2,
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("[name=width]")).toHaveValue("200");
  await page.locator("[data-action=redo]").click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("[name=width]")).toHaveValue("220");
});

test("resizing at 200% preserves both viewport scroll positions after pointer release", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await page.locator("#zoom").fill("200");
  const handle = page.locator('[data-handle=resize][data-dx="1"][data-dy="1"]');
  await handle.scrollIntoViewIfNeeded();
  const before = await page
    .locator(".viewport")
    .evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));
  expect(before.top).toBeGreaterThan(0);
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 20,
    box.y + box.height / 2 + 20,
    { steps: 3 },
  );
  await page.mouse.up();
  await expect(page.locator("[name=width]")).toHaveValue("210");
  await expect(page.locator("[name=height]")).toHaveValue("110");
  const after = await page
    .locator(".viewport")
    .evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop }));
  expect(after).toEqual(before);
});

async function importLayout(
  page: import("@playwright/test").Page,
  text: string,
) {
  await openDrawingImport(page);
  await page.locator("#input").fill(text);
  await page.locator("dialog [data-action=apply]").click();
}
async function exportLayout(page: import("@playwright/test").Page) {
  await openDrawingExport(page);
  const text = await page.locator("#input").inputValue();
  await page.locator("dialog [data-action=close]").click();
  return text;
}
test("multiple selection moves as a group, aligns and distributes with one Undo per action", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await importLayout(
    page,
    [-100, 0, 150]
      .map(
        (x, i) =>
          `Id=a${i};Type=TEXTURE;Data="SquareSimple";Position=${x},${-50 + i * 50};Size=20,20`,
      )
      .join("\n"),
  );
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-element="1"]').click({ modifiers: ["Shift"] });
  await page.locator('[data-element="2"]').click({ modifiers: ["Control"] });
  await expect(page.locator(".elements button.active")).toHaveCount(3);
  await page.locator("#snap").uncheck();
  await page.locator("#object-snap").uncheck();
  const box = (await page
    .locator('#canvas [data-sprite="1"] rect')
    .first()
    .boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 10,
    box.y + box.height / 2 + 10,
    { steps: 3 },
  );
  await page.mouse.up();
  let raw = await exportLayout(page);
  expect(raw).toContain("Position=-90,-40");
  expect(raw).toContain("Position=160,60");
  await page.locator("[data-action=top]").click();
  await page.locator("[data-action=distribute-x]").click();
  raw = await exportLayout(page);
  expect(raw).toContain("Position=35,-40");
  await page.locator("[data-action=undo]").click();
  raw = await exportLayout(page);
  expect(raw).toContain("Position=10,-40");
});
test("hidden and locked flags survive property changes and save, and remain editor-only", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-lock="0"]').click();
  await expect(page.locator("[name=x]")).toBeDisabled();
  await page.keyboard.press("ArrowRight");
  expect(await exportLayout(page)).toContain("Position=0,0");
  await page.locator('[data-visibility="0"]').click();
  await expect(page.locator('#canvas [data-sprite="0"]')).toHaveCount(0);
  expect(await exportLayout(page)).toContain("Id=background");
  await page.locator('[data-element="1"]').click();
  await page.locator("[name=x]").fill("30");
  const download = page.waitForEvent("download");
  await page.locator("header [data-action=save]").click();
  const saved = JSON.parse(
    readFileSync((await (await download).path())!, "utf8"),
  );
  expect(saved.version).toBe(5);
  expect(saved.blocks[0].surfaces[0].elements[0]).toMatchObject({
    hidden: true,
    locked: true,
    x: 0,
  });
  await page.locator('[data-visibility="0"]').click();
  await page.locator('[data-lock="0"]').click();
  await page.locator('[data-element="0"]').click();
  await page.locator("[name=x]").fill("12");
  await expect(page.locator("[name=x]")).toHaveValue("12");
});
test("text preview starts at the specified top and preserves exported position", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await importLayout(
    page,
    'Id=label;Type=TEXT;Data="ABC\\nDEF";Position=10,20;TextScale=2',
  );
  const text = page.locator('#canvas [data-sprite="0"] text');
  const box = await text.evaluate((node) => {
    const b = (node as SVGGraphicsElement).getBBox();
    return { y: b.y, height: b.height };
  });
  expect(box.y).toBeCloseTo(0, 0);
  expect(box.height).toBeGreaterThan(100);
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("[name=y]")).toHaveValue("20");
  expect(await exportLayout(page)).toContain("Position=10,20");
});

test("font dropdown preserves unknown FontIds and palette re-click deselects without a button", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await importLayout(page, 'Id=label;Type=TEXT;Data="ABC";FontId="CustomFont"');
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("select[name=font]")).toHaveValue("CustomFont");
  await page.locator("[name=x]").fill("1");
  expect(await exportLayout(page)).toContain('FontId="CustomFont"');
  await page.locator("[name=font]").selectOption("Monospace");
  expect(await exportLayout(page)).toContain('FontId="Monospace"');
  const slot = page.locator('[data-palette-slot="0"]');
  await slot.click();
  const color = await slot.getAttribute("title");
  await slot.click();
  await expect(slot).toHaveAttribute("aria-pressed", "false");
  await page.locator("#inherit-color").uncheck();
  await page.locator("[name=color]").fill("1,2,3,4");
  await expect(slot).toHaveAttribute("title", color!);
  await expect(page.locator("[data-action=unlink-palette]")).toHaveCount(0);
});
test("Space and middle-button pan without editing, and zoom preserves the point under the mouse", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator("#zoom").fill("150");
  await page.locator(".viewport").evaluate((el) => {
    el.scrollLeft = 250;
    el.scrollTop = 250;
  });
  const vp = (await page.locator(".viewport").boundingBox())!,
    x = vp.x + 150,
    y = vp.y + 150;
  const coord = () =>
    page.locator("#canvas").evaluate(
      (el, p) => {
        const r = el.getBoundingClientRect();
        return {
          x: (p.x - r.x) / (r.width / 512),
          y: (p.y - r.y) / (r.height / 512),
        };
      },
      { x, y },
    );
  const before = await coord();
  await page.mouse.move(x, y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await expect(page.locator("#zoom")).toHaveValue("160");
  const after = await coord();
  expect(after.x).toBeCloseTo(before.x, 0);
  expect(after.y).toBeCloseTo(before.y, 0);
  const raw = await exportLayout(page);
  await page.locator(".viewport").evaluate((el) => {
    el.scrollLeft = 250;
    el.scrollTop = 250;
  });
  await page.locator("#canvas").focus();
  await page.keyboard.down("Space");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 35, y + 25, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  expect(await page.locator(".viewport").evaluate((el) => el.scrollTop)).toBe(
    225,
  );
  await page.mouse.move(x, y);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(x + 15, y + 10, { steps: 3 });
  await page.mouse.up({ button: "middle" });
  expect(await page.locator(".viewport").evaluate((el) => el.scrollTop)).toBe(
    215,
  );
  expect(await exportLayout(page)).toBe(raw);
});
test("object snapping displays alignment guides while dragging", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await importLayout(
    page,
    'Id=a;Type=TEXTURE;Data="SquareSimple";Position=0,0;Size=20,20\nId=b;Type=TEXTURE;Data="SquareSimple";Position=100,0;Size=20,20',
  );
  await page.locator('[data-element="0"]').click();
  await page.locator("#snap").uncheck();
  const box = (await page
    .locator('#canvas [data-sprite="0"] rect')
    .first()
    .boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 77, box.y + box.height / 2, {
    steps: 4,
  });
  await expect(page.locator(".alignment-guides path")).not.toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator("[name=x]")).toHaveValue("80");
});
test("unsaved project is offered for recovery and invalid recovery is preserved until discarded", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="1"]').click();
  await page.locator("[name=data]").fill("RECOVER ME");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("lcd-editor-recovery")),
    )
    .toContain("RECOVER ME");
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(page.locator(".recovery")).toContainText("前回の未保存");
  await page.locator("[data-action=restore-recovery]").click();
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("RECOVER ME");
  await page.locator("[data-action=save]").click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("lcd-editor-recovery")),
    )
    .toBeNull();
});
test("invalid recovery remains untouched until explicit discard", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("lcd-editor-recovery", '{"version":999}'),
  );
  await page.goto("/");
  await expect(page.locator("[data-action=restore-recovery]")).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem("lcd-editor-recovery")),
  ).toBe('{"version":999}');
  await page.locator("[data-action=discard-recovery]").click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("lcd-editor-recovery")),
    )
    .toBeNull();
  await expect(
    page.getByRole("button", { name: "サンプルで始める" }),
  ).toBeEnabled();
});

async function openSettings(page: import("@playwright/test").Page) {
  await page.locator("header [data-action=settings]").click();
}
async function saveSettings(page: import("@playwright/test").Page) {
  await page.locator("#settings-form button[type=submit]").click();
}
test("settings persist theme and snap preferences without modifying a project", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  const before = await exportLayout(page);
  const file = page.waitForEvent("download");
  await page.locator("header [data-action=save]").click();
  await file;
  await page.locator(".snap-settings [name=moveStep]").fill("20");
  await page.locator(".snap-settings [name=sizeStep]").fill("5");
  await page.locator(".snap-settings [name=angleStep]").fill("30");
  await page.locator(".snap-settings [name=objectDistance]").fill("12");
  await openSettings(page);
  await page.locator("#settings-form [name=theme]").selectOption("light");
  await saveSettings(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page
      .locator("header")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(244, 247, 250)");
  await expect(page.locator(".dirty-indicator")).not.toContainText("●");
  expect(await exportLayout(page)).toBe(before);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("[name=moveStep]")).toHaveValue("20");
  await openSettings(page);
  await page.locator("[name=theme]").selectOption("dark");
  await saveSettings(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("header snap inputs validate drafts and settings cancellation preserves preferences", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  const before = await exportLayout(page);
  const input = page.locator(".snap-settings [name=moveStep]");
  await input.fill("0");
  expect(
    await input.evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow),
  ).toBe(true);
  await expect(page.locator("#gridpattern")).toHaveAttribute("width", "10");
  await input.fill("");
  await expect(page.locator("#gridpattern")).toHaveAttribute("width", "10");
  await input.blur();
  await expect(input).toHaveValue("10");
  await input.fill("25");
  await expect(page.locator("#gridpattern")).toHaveAttribute("width", "10");
  await openSettings(page);
  await expect(page.locator("#settings-form input[type=number]")).toHaveCount(
    3,
  );
  await page.locator("[name=theme]").selectOption("light");
  await page.locator("#settings-cancel").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(input).toHaveValue("25");
  expect(await exportLayout(page)).toBe(before);
  await openSettings(page);
  await page.locator("#settings-defaults").click();
  await saveSettings(page);
  await expect(input).toHaveValue("25");
});
test("custom move, resize and rotation increments control canvas operations", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await page.locator("[name=moveStep]").fill("20");
  await page.locator("[name=sizeStep]").fill("5");
  await page.locator("[name=angleStep]").fill("30");
  await page.locator("#object-snap").uncheck();
  await expect(page.locator("#gridpattern")).toHaveAttribute("width", "10");
  // Resize independently of the move increment; normal resize fixes the opposite edge.
  const handle = page.locator('[data-handle=resize][data-dx="1"][data-dy="0"]');
  await handle.scrollIntoViewIfNeeded();
  let box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 16, box.y + box.height / 2, {
    steps: 3,
  });
  await page.mouse.up();
  await expect(page.locator("[name=width]")).toHaveValue("215");
  await page.locator("[data-action=undo]").click();
  await page.locator('[data-element="0"]').click();
  box = (await page
    .locator('#canvas [data-sprite="0"] rect')
    .first()
    .boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 33, box.y + 20, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator("[name=x]")).toHaveValue("20");
  const circle = page.locator("[data-handle=rotate]");
  await circle.scrollIntoViewIfNeeded();
  box = (await circle.boundingBox())!;
  const canvas = (await page.locator("#canvas").boundingBox())!;
  const cx = canvas.x + canvas.width / 2 + 20,
    cy = canvas.y + canvas.height / 2;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const angle = (-40 * Math.PI) / 180;
  await page.mouse.move(cx + 80 * Math.cos(angle), cy + 80 * Math.sin(angle), {
    steps: 3,
  });
  await page.mouse.up();
  await expect(page.locator("[name=angle]")).toHaveValue("60");
});
test("layer drag and drop changes export order and is undoable, with locked sources disabled", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  const original = await exportLayout(page);
  await page
    .locator('[data-layer-drag="0"]')
    .dragTo(page.locator('[data-layer-row="1"]'), {
      targetPosition: { x: 80, y: 40 },
    });
  const reordered = await exportLayout(page);
  expect(reordered.indexOf("Id=label")).toBeLessThan(
    reordered.indexOf("Id=background"),
  );
  await expect(page.locator("[name=id]")).toHaveValue("background");
  await page.locator("[data-action=undo]").click();
  expect(await exportLayout(page)).toBe(original);
  await page.locator("[data-action=redo]").click();
  expect(await exportLayout(page)).toBe(reordered);
  await page.locator('[data-lock="0"]').click();
  await expect(page.locator('[data-layer-drag="0"]')).toBeDisabled();
});
test("RGBA number fields update sliders, output and selected palette while rejecting invalid drafts", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  for (const index of [0, 1]) {
    await page.locator(`[data-element="${index}"]`).click();
    await page.locator('[data-palette-slot="0"]').click();
    await page.locator('[data-channel-number="0"]').fill("123");
    await page.locator('[data-channel-number="3"]').fill("64");
    await expect(page.locator('[data-channel="0"]')).toHaveValue("123");
    await expect(page.locator('[data-channel="3"]')).toHaveValue("64");
    expect(await exportLayout(page)).toContain("Color=123,");
    await page.locator('[data-channel-number="0"]').fill("999");
    expect(await exportLayout(page)).not.toContain("Color=999,");
    await page.locator('[data-channel-number="0"]').fill("");
    expect(await exportLayout(page)).not.toContain("Color=999,");
    await page.locator('[data-channel-number="0"]').fill("124");
    await page.locator('[data-channel="1"]').fill("82");
    await expect(page.locator('[data-channel-number="1"]')).toHaveValue("82");
    await page.locator("[name=color]").fill("1,2,3,4");
    await expect(page.locator('[data-channel-number="0"]')).toHaveValue("1");
    // Deselect the palette so the next element can start its own edit.
    const slot = page.locator('[data-palette-slot="0"]');
    if ((await slot.getAttribute("aria-pressed")) === "true") {
      await expect(slot).toHaveAttribute("title", "1,2,3,4");
      await slot.click();
    }
  }
});

test("layer insertion line stays inside the list without moving rows, including the first and last gaps", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await importLayout(
    page,
    Array.from(
      { length: 4 },
      (_, i) =>
        `Id=a${i};Type=TEXTURE;Data="SquareSimple";Position=${i * 30},0;Size=20,20`,
    ).join("\n"),
  );
  const rows = page.locator("#app [data-layer-row]");
  const positions = () =>
    rows.evaluateAll((rows) =>
      rows.map((row) => {
        const r = row.getBoundingClientRect();
        return { top: r.top, height: r.height, width: r.width };
      }),
    );
  const start = async (index: number) => {
    const box = (await page
      .locator(`#app [data-layer-drag="${index}"]`)
      .boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 8,
      box.y + box.height / 2 + 8,
      { steps: 3 },
    );
  };
  const hover = async (x: number, y: number) => {
    await page.mouse.move(x, y, { steps: 3 });
    await page.mouse.move(x + 1, y);
  };
  const original = await positions();
  await start(0);
  let target = (await rows.nth(3).boundingBox())!;
  await hover(target.x + 80, target.y + 3);
  const line = page.locator("#app .layer-drop-indicator");
  await expect(line).toBeVisible();
  expect(await positions()).toEqual(original);
  expect(
    Math.abs((await line.boundingBox())!.y - target.y),
  ).toBeLessThanOrEqual(2);
  await page.mouse.up();
  let raw = await exportLayout(page);
  expect(raw.split("\n").map((l) => l.match(/^Id=([^;]+)/)![1])).toEqual([
    "a1",
    "a2",
    "a0",
    "a3",
  ]);
  await page.locator("[data-action=undo]").click();
  await start(3);
  const list = (await page.locator("#app .elements").boundingBox())!;
  await hover(list.x + 80, list.y + 1);
  await expect(line).toBeVisible();
  const firstLine = (await line.boundingBox())!;
  expect(firstLine.y).toBeGreaterThanOrEqual(list.y);
  expect(firstLine.y + firstLine.height).toBeLessThan(list.y + 8);
  expect(await positions()).toEqual(original);
  await page.mouse.up();
  raw = await exportLayout(page);
  expect(raw.split("\n")[0]).toMatch(/^Id=a3;/);
  await start(0);
  target = (await rows.last().boundingBox())!;
  await hover(target.x + 80, target.y + target.height + 2);
  await expect(line).toBeVisible();
  await page.mouse.up();
  raw = await exportLayout(page);
  expect(raw.split("\n").at(-1)).toMatch(/^Id=a3;/);
  await expect(page.locator(".layer-drag-preview")).toHaveCount(0);
  await expect(page.locator("#app .layer-dragging")).toHaveCount(0);
});

test("texture and text use a checkbox for unspecified color and preserve it through save and reopen", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  for (const index of [0, 1]) {
    await page.locator(`[data-element="${index}"]`).click();
    await page.locator("[name=color]").fill("1,2,3,0");
    // Clearing a draft no longer changes the color's specified/unspecified state.
    await page.locator('[data-channel-number="0"]').fill("");
    await expect(page.locator("#inherit-color")).not.toBeChecked();
    expect(await exportLayout(page)).toContain("Color=1,2,3,0");
    await page
      .getByRole("checkbox", {
        name: "ゲーム内の色を使う",
        exact: true,
      })
      .check();
    await expect(page.locator("[name=color]")).toBeDisabled();
    await expect(page.locator("[name=color]")).toHaveValue("1,2,3,0");
    for (let i = 0; i < 4; i++) {
      await expect(page.locator(`[data-channel-number="${i}"]`)).toBeDisabled();
      await expect(page.locator(`[data-channel="${i}"]`)).toBeDisabled();
    }
    await page.locator("[name=x]").fill("42");
    // A full render and selecting another element must keep each element's color.
    await page.locator(`[data-element="${1 - index}"]`).click();
    await page.locator(`[data-element="${index}"]`).click();
    await page.locator("[name=id]").fill(`preserved${index}`);
    await page.locator("#language").selectOption("en");
    await page.locator("#inherit-color").uncheck();
    await expect(page.locator("[name=color]")).toHaveValue("1,2,3,0");
    for (let i = 0; i < 4; i++) {
      const value = String([1, 2, 3, 0][i]);
      await expect(page.locator(`[data-channel-number="${i}"]`)).toHaveValue(
        value,
      );
      await expect(page.locator(`[data-channel="${i}"]`)).toHaveValue(value);
    }
    expect(await exportLayout(page)).toContain(`Id=preserved${index};`);
    expect(await exportLayout(page)).toContain("Color=1,2,3,0");
    await page.locator("#language").selectOption("ja");
    await expect(page.locator('[data-channel-number="0"]')).toBeEnabled();
    await page.locator('[data-channel-number="0"]').fill("12");
    await page.locator("[name=color]").fill("");
    await expect(page.locator("#inherit-color")).not.toBeChecked();
    await page.locator("#inherit-color").check();
    await page.locator("[data-action=undo]").click();
    await page.locator(`[data-element="${index}"]`).click();
    await expect(page.locator("#inherit-color")).not.toBeChecked();
    await page.locator("[data-action=redo]").click();
    await page.locator(`[data-element="${index}"]`).click();
    await expect(page.locator("#inherit-color")).toBeChecked();
  }
  expect(await exportLayout(page)).not.toContain("Color=");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const saved = readFileSync((await (await download).path())!, "utf8");
  for (const element of JSON.parse(saved).blocks[0].surfaces[0].elements)
    expect(element).not.toHaveProperty("color");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "開く", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(saved),
  });
  expect(await exportLayout(page)).not.toContain("Color=");
});

test("background RGB numbers synchronize sliders, reject invalid drafts and remain preview-only", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  const before = await exportLayout(page);
  const save = async () => {
    const download = page.waitForEvent("download");
    await page.locator("header [data-action=save]").click();
    return readFileSync((await (await download).path())!, "utf8");
  };
  const saved = await save();
  for (const [i, value] of [12, 34, 56].entries()) {
    await page
      .getByRole("spinbutton", {
        name: `Background ${["R", "G", "B"][i]} 数値`,
        exact: true,
      })
      .fill(String(value));
    await expect(page.locator(`[data-background="${i}"]`)).toHaveValue(
      String(value),
    );
  }
  await expect(page.locator("#preview-fill")).toHaveAttribute(
    "fill",
    "rgba(12,34,56,1)",
  );
  for (const value of ["999", "-1", "1.5", ""]) {
    await page.locator('[data-background-number="0"]').fill(value);
    await expect(page.locator("#preview-fill")).toHaveAttribute(
      "fill",
      "rgba(12,34,56,1)",
    );
  }
  await page.locator('[data-background="0"]').fill("78");
  await expect(page.locator('[data-background-number="0"]')).toHaveValue("78");
  expect(await exportLayout(page)).toBe(before);
  expect(await save()).toBe(saved);
  await expect(page.locator(".dirty-indicator")).not.toContainText("●");
  await page.locator("[data-action=reset-background]").click();
  for (let i = 0; i < 3; i++)
    await expect(page.locator(`[data-background-number="${i}"]`)).toHaveValue(
      "0",
    );
  await expect(page.locator("#preview-fill")).toHaveAttribute(
    "fill",
    "rgba(0,0,0,1)",
  );
  await page.locator("#language").selectOption("en");
  await expect(
    page.getByRole("spinbutton", { name: "Background R value", exact: true }),
  ).toBeVisible();
});

test("recovery notice is centered, can be deferred and never disables editing", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="1"]').click();
  await page.locator("[name=data]").fill("PREVIOUS PROJECT");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("lcd-editor-recovery")),
    )
    .toContain("PREVIOUS PROJECT");
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  const original = await page.evaluate(() =>
    localStorage.getItem("lcd-editor-recovery"),
  );
  const card = page.locator(".recovery");
  const bounds = (await card.boundingBox())!;
  expect(
    Math.abs(bounds.x + bounds.width / 2 - page.viewportSize()!.width / 2),
  ).toBeLessThan(2);
  await expect(page.locator("[inert]")).toHaveCount(0);
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="1"]').click();
  await page.locator("[name=data]").fill("CURRENT PROJECT");
  expect(
    await page.evaluate(() => localStorage.getItem("lcd-editor-recovery")),
  ).toBe(original);
  await page.locator("[data-action=defer-recovery]").click();
  await expect(card).toHaveCount(0);
  await page.locator("header [data-action=settings]").click();
  await page.locator("#settings-cancel").click();
  await page.locator("[data-action=review-recovery]").click();
  await page.locator("[data-action=restore-recovery]").click();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await page.locator("#confirm-dialog button[value=cancel]").click();
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("CURRENT PROJECT");
  expect(
    await page.evaluate(() => localStorage.getItem("lcd-editor-recovery")),
  ).toBe(original);
  await page.locator("[data-action=restore-recovery]").click();
  await page.locator("#confirm-dialog button[value=discard]").click();
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("PREVIOUS PROJECT");
  await expect(card).toHaveCount(0);
});

test("invalid recovery permits new work and keeps its bytes through file saving", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("lcd-editor-recovery", '{"version":999}'),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator("header [data-action=save]").click();
  expect(
    await page.evaluate(() => localStorage.getItem("lcd-editor-recovery")),
  ).toBe('{"version":999}');
  await expect(page.locator("[data-action=restore-recovery]")).toBeDisabled();
  await page.locator("[data-action=discard-recovery]").click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("lcd-editor-recovery")),
    )
    .toBeNull();
});

test("replacement confirmation is themed, cancelable by Escape and protects edits", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator("header [data-action=new]").click();
  await expect(page.locator("#confirm-dialog")).toBeVisible();
  await expect(
    page.locator("#confirm-dialog button[value=cancel]"),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("READY");
  await page.locator("header [data-action=new]").click();
  await page.locator("#confirm-dialog button[value=discard]").click();
  await expect(page.locator("#canvas")).toHaveCount(0);
});

test("grouped controls fit the minimum window in both languages and themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1050, height: 700 });
  await page.goto("/");
  for (const language of ["ja", "en"]) {
    await page.locator("#language").selectOption(language);
    await page.locator("header [data-action=settings]").click();
    await page
      .locator("[name=theme]")
      .selectOption(language === "ja" ? "dark" : "light");
    await page.locator("#settings-form button[type=submit]").click();
    await expect(page.locator(".titlebar")).toHaveText(
      "▧ LCD Sprite Drawer Editor",
    );
    await expect(page.locator("header strong")).toHaveCount(0);
    await expect(page.locator("header")).not.toContainText("設定エディター");
    await expect(page.locator("header")).not.toContainText("Settings editor");
    const snapBox = (await page.locator(".snap-settings").boundingBox())!;
    const projectBox = (await page
      .locator("header .action-group")
      .first()
      .boundingBox())!;
    expect(projectBox.x).toBeLessThanOrEqual(16);
    const saveBox = (await page.locator('header [data-action=save]').boundingBox())!;
    const importButton = page.locator('header [data-action=placement-import]');
    const importBox = (await importButton.boundingBox())!;
    expect(importBox.x).toBeGreaterThanOrEqual(saveBox.x + saveBox.width);
    expect(importBox.y).toBe(saveBox.y);
    await expect(importButton).toHaveText(language === "ja" ? "インポート" : "Import");
    await expect(importButton).toBeDisabled();
    expect(snapBox.x).toBeGreaterThan(projectBox.x + projectBox.width);
    const exchangeBox = (await page
      .locator("header .action-group")
      .last()
      .boundingBox())!;
    expect(snapBox.x).toBeGreaterThan(exchangeBox.x + exchangeBox.width);
    const preferencesBox = (await page
      .locator(".app-preferences")
      .boundingBox())!;
    expect(preferencesBox.x).toBeGreaterThanOrEqual(snapBox.x + snapBox.width);
    expect(preferencesBox.x - snapBox.x - snapBox.width).toBeLessThanOrEqual(
      13,
    );
    await expect(page.locator(".toolbar .snap-settings")).toHaveCount(0);
    await expect(page.locator(".toolbar-label")).toHaveCount(0);
    const toolbar = (await page.locator(".toolbar").boundingBox())!;
    const grid = (await page.locator("#grid").boundingBox())!;
    const zoom = (await page.locator("#zoom").boundingBox())!;
    const redo = (await page.locator("[data-action=redo]").boundingBox())!;
    expect(zoom.x + zoom.width).toBeGreaterThan(toolbar.x + toolbar.width - 20);
    expect(grid.x).toBeGreaterThan(redo.x + redo.width + 20);
    expect(
      Math.abs(grid.y + grid.height / 2 - zoom.y - zoom.height / 2),
    ).toBeLessThanOrEqual(1);

    const firstToggle = (await page.locator("#snap").boundingBox())!;
    const secondToggle = (await page.locator("#object-snap").boundingBox())!;
    const moveInput = (await page.locator("[name=moveStep]").boundingBox())!;
    const distanceInput = (await page
      .locator("[name=objectDistance]")
      .boundingBox())!;
    expect(Math.abs(firstToggle.x - secondToggle.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(moveInput.x - distanceInput.x)).toBeLessThanOrEqual(1);
    expect(moveInput.height).toBe(distanceInput.height);
    expect(
      Math.abs(
        secondToggle.y - firstToggle.y - (distanceInput.y - moveInput.y),
      ),
    ).toBeLessThanOrEqual(1);

    expect(
      (await page.locator("header").boundingBox())!.height,
    ).toBeLessThanOrEqual(86);
    expect(
      await page.evaluate(() => document.body.scrollWidth),
    ).toBeLessThanOrEqual(1050);
    const footer = (await page.locator(".status").boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(700);
    const buttons = await page.locator("header button").all();
    for (const button of buttons) {
      const box = (await button.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1050);
    }
  }
  await page.screenshot({ path: "test-results/layout-light.png" });
});

async function openDynamicsEditor(page: import("@playwright/test").Page) {
  if (!(await page.locator(".selected-preview [data-action=dynamics]").count()))
    await page.locator("[data-element]").first().click();
  await page.locator(".selected-preview [data-action=dynamics]").click();
}
async function exchangeTracks(
  page: import("@playwright/test").Page,
  kind: "Motion" | "Binding",
  value?: string,
) {
  await openDynamicsEditor(page);
  await page
    .locator(
      value === undefined ? `[data-output=${kind}]` : `[data-exchange=${kind}]`,
    )
    .click();
  if (value !== undefined) {
    await page.locator("#input").fill(value);
    await page.locator("dialog [data-action=apply]").click();
  }
}

test("structured Motion and Binding edit, export, simulate and save without changing the base layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDynamicsEditor(page);
  await page.locator("#binding-form [name=property]").selectOption("Width");
  await page.locator("#binding-form [name=rate]").fill("20");
  await page.locator("#binding-form [name=anchor]").selectOption("CenterLeft");
  await page.locator("#binding-form button[type=submit]").click();
  await expect(page.locator(".dynamic-records").first()).toContainText("Width");
  await page.locator("#dynamic-new").click();
  await page.locator("#binding-form [name=source]").selectOption("Enabled");
  await page.locator("#binding-form [name=blockName]").fill("Light");
  await page.locator("#binding-form [name=property]").selectOption("Color");
  await page.locator("#binding-form [name=minColor]").fill("1,2,3,0");
  await page.locator("#binding-form button[type=submit]").click();
  await page.locator("#dynamics-close").click();
  await page.locator('[data-element="1"]').click();
  await openDynamicsEditor(page);
  await page.locator("#binding-form [name=source]").selectOption("Speed");
  await page.locator("#binding-form [name=property]").selectOption("Data");
  await page.locator("#binding-form [name=blockName]").fill("Cockpit");
  await page.locator("#binding-form [name=prefix]").fill("SPD ");
  await page.locator("#binding-form [name=suffix]").fill(" m/s");
  await page.locator("#binding-form button[type=submit]").click();
  await page.screenshot({ path: "test-results/dynamics-editor.png" });
  await page.locator("#dynamics-close").click();
  await exchangeTracks(page, "Motion");
  await expect(page.locator("#input")).toHaveValue(
    /Element=background;Property=Width;Rate=20/,
  );
  await page.locator("#format").selectOption("ini");
  await expect(page.locator("#input")).toHaveValue(
    /^Motion=\n\|Element=background;/,
  );
  await page.locator("dialog [data-action=close]").click();
  await exchangeTracks(page, "Binding");
  await expect(page.locator("#input")).toHaveValue(
    /Source=Enabled;BlockName="Light"/,
  );
  await page.locator("#format").selectOption("ini");
  await expect(page.locator("#input")).toHaveValue(
    /^Binding=\n\|Element=background;/,
  );
  await page.locator("dialog [data-action=close]").click();
  const baseline = await exportLayout(page);
  await page.locator("[data-action=preview]").click();
  await page.locator("#global-time-number").fill("2");
  await page.locator('[data-preview-speed="1"]').fill("50");
  await page.locator('[data-preview-enabled="0"]').uncheck();
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("SPD 50.0 m/s");
  await expect(
    page.locator('#canvas [data-sprite="0"] rect').first(),
  ).toHaveAttribute("width", "240");
  await expect(page.locator('#canvas [data-sprite="0"]')).toHaveAttribute(
    "transform",
    "translate(20 0) rotate(0)",
  );
  await expect(
    page.locator('#canvas [data-sprite="0"] rect').first(),
  ).toHaveAttribute("fill", "rgba(1,2,3,0)");
  await page.screenshot({ path: "test-results/dynamics-preview.png" });
  expect(await exportLayout(page)).toBe(baseline);
  const download = page.waitForEvent("download");
  await page.locator("header [data-action=save]").click();
  const saved = readFileSync((await (await download).path())!, "utf8");
  const project = JSON.parse(saved);
  expect(project.version).toBe(5);
  expect(project.blocks[0].surfaces[0].elements[0]).toMatchObject({
    width: 200,
    x: 0,
    motion: [{ property: "Width", rate: 20 }],
    bindings: [{ source: "Enabled", blockName: "Light" }],
  });
  expect(saved).not.toContain("previewTime");
  await page.locator("[data-action=preview]").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("header [data-action=open]").click();
  await (
    await chooser
  ).setFiles({
    name: "animation.json",
    mimeType: "application/json",
    buffer: Buffer.from(saved),
  });
  await expect(
    page.locator(".selected-preview [data-action=dynamics]"),
  ).toHaveCount(0);
  await exchangeTracks(page, "Motion");
  await expect(page.locator("#input")).toHaveValue(/Rate=20/);
  await page.locator("dialog [data-action=close]").click();
  expect(await exportLayout(page)).toBe(baseline);
});

test("track imports keep invalid drafts and enforce conflicts without overwriting valid data", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await exchangeTracks(
    page,
    "Motion",
    "Element=background;Property=Angle;Rate=15",
  );
  await exchangeTracks(
    page,
    "Motion",
    "Element=missing;Property=Angle;Rate=15",
  );
  await expect(page.locator("#diagnostic")).toContainText("参照先");
  await expect(page.locator("#input")).toHaveValue(/Element=missing/);
  await page.locator("dialog [data-action=close]").click();
  await exchangeTracks(
    page,
    "Binding",
    'Element=background;Property=Angle;Source=Speed;BlockName="C";InputMin=0;InputMax=100;OutputMin=0;OutputMax=90',
  );
  await expect(page.locator("#diagnostic")).toContainText("MotionとBinding");
  await page.locator("dialog [data-action=close]").click();
  await exchangeTracks(page, "Motion");
  await expect(page.locator("#input")).toHaveValue(/Property=Angle;Rate=15/);
  await page.locator("dialog [data-action=close]").click();
  await openDrawingImport(page);
  await page.locator("#input").fill('Id=label;Type=TEXT;Data="ONLY"');
  await page.locator("dialog [data-action=apply]").click();
  await expect(page.locator("#diagnostic")).toContainText("先に削除");
  await page.locator("dialog [data-action=close]").click();
  await page.locator('[data-element="0"]').click();
  await page.locator("#sprite-type").click();
  await expect(page.locator(".status")).toContainText("文字には寸法・自転");
  await expect(page.locator("#sprite-type")).not.toBeChecked();
});

test("renaming, duplication, undo and deletion keep tracks bound to their element", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await exchangeTracks(
    page,
    "Motion",
    "Element=background;Property=MoveX;Rate=10",
  );
  await page.locator('[data-element="0"]').click();
  await page.locator("[name=id]").fill("renamed");
  await page.locator('[data-layer-row="0"] [data-action=duplicate]').click();
  await exchangeTracks(page, "Motion");
  let raw = await page.locator("#input").inputValue();
  expect(raw.split("\n")).toHaveLength(2);
  expect(raw).toContain("Element=renamed;");
  await page.locator("dialog [data-action=close]").click();
  await page.locator("[data-action=undo]").click();
  await exchangeTracks(page, "Motion");
  expect((await page.locator("#input").inputValue()).split("\n")).toHaveLength(
    1,
  );
  await page.locator("dialog [data-action=close]").click();
  await page.locator("[data-action=redo]").click();
  await page.locator('[data-element="2"]').click();
  await page.locator('[data-layer-row="2"] [data-action=delete]').click();
  await exchangeTracks(page, "Motion");
  await expect(page.locator("#input")).toHaveValue(
    "Element=renamed;Property=MoveX;Rate=10",
  );
});

test("preview playback and faults retain the last valid frame and never rewrite saved tracks", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await exchangeTracks(
    page,
    "Motion",
    "Element=label;Property=TextScale;Rate=-1",
  );
  const baseline = await exportLayout(page);
  await page.locator("[data-action=preview]").click();
  await page.locator("#global-time-number").fill("0.5");
  await expect(page.locator("#canvas [data-sprite] text")).toHaveAttribute("font-size", "14");
  await page.locator("#global-time-number").fill("1");
  await expect(page.locator("#preview-error")).toContainText("正");
  await expect(page.locator("#canvas [data-sprite] text")).toHaveAttribute("font-size", "14");
  await page.locator("[data-action=reset-preview]").click();
  await page.locator("[data-action=play-preview]").click();
  await expect
    .poll(async () =>
      Number(await page.locator("#global-time-number").inputValue()),
    )
    .toBeGreaterThan(0);
  await page.locator("[data-action=play-preview]").click();
  await page.locator("[data-action=preview]").click();
  expect(await exportLayout(page)).toBe(baseline);
  await expect(page.locator("#canvas [data-sprite] text")).toHaveAttribute("font-size", "28");
});

test("structured tracks can be edited and removed, while malformed color drafts stay intact", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDynamicsEditor(page);
  await page.locator("#binding-form button[type=submit]").click();
  await page.locator("[data-edit=motion]").click();
  await page.locator("#binding-form [name=rate]").fill("25");
  await page.locator("#binding-form button[type=submit]").click();
  await expect(page.locator(".dynamic-records").first()).toContainText("25");
  await page.locator("#dynamic-new").click();
  await page.locator("#binding-form [name=source]").selectOption("Enabled");
  await page.locator("#binding-form [name=blockName]").fill("Light");
  await page.locator("#binding-form [name=property]").selectOption("Color");
  await page.locator("#binding-form [name=minColor]").fill("1,,3,0");
  await page.locator("#binding-form button[type=submit]").click();
  await expect(page.locator("#dynamic-error")).toContainText("不正な数値");
  await expect(page.locator("#binding-form [name=minColor]")).toHaveValue(
    "1,,3,0",
  );
  await page.locator("#binding-form [name=minColor]").fill("1,2,3,0");
  await page.locator("#binding-form button[type=submit]").click();
  await page.locator("[data-edit=bindings]").click();
  await page.locator("#binding-form [name=blockName]").fill("Other Light");
  await page.locator("#binding-form button[type=submit]").click();
  await expect(page.locator(".dynamic-records")).toContainText("Other Light");
  await page.locator("[data-remove=bindings]").click();
  await expect(
    page.locator(".dynamic-records [data-remove=bindings]"),
  ).toHaveCount(0);
  await page.locator("[data-remove=motion]").click();
  await page.locator("#dynamics-close").click();
  await exchangeTracks(page, "Motion");
  await expect(page.locator("#input")).toHaveValue("");
  await page.locator("dialog [data-action=close]").click();
  await page.locator("[data-action=undo]").click();
  await exchangeTracks(page, "Motion");
  await expect(page.locator("#input")).toHaveValue(/Rate=25/);
});

test("extended Sources expose independent simulated inputs and preserve base output", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDynamicsEditor(page);
  await expect(page.locator("#binding-form [name=source] option")).toHaveCount(
    31,
  );
  await page.locator("#binding-form [name=source]").selectOption("IsWorking");
  await expect(page.locator("#binding-form [name=property]")).toHaveValue(
    "MoveX",
  );
  await page.locator("#dynamics-close").click();
  await exchangeTracks(
    page,
    "Binding",
    'Element=background;Property=Color;Source=Enabled;BlockName="Battery";MinColor=1,2,3,0;MaxColor=4,5,6,255\nElement=label;Property=Color;Source=IsWorking;BlockName="Battery";MinColor=7,8,9,0;MaxColor=10,11,12,255\nElement=label;Property=Data;Source=BatteryChargeRatio;BlockName="Battery";Decimals=3;Suffix="%"',
  );
  const baseline = await exportLayout(page);
  await page.locator("[data-action=preview]").click();
  await page.locator("[data-source=BatteryChargeRatio]").fill("0.5");
  await page.locator("[data-source=IsWorking]").uncheck();
  await expect(page.locator("#canvas [data-sprite] text")).toHaveText("0.500%");
  await expect(page.locator("[data-source=Enabled]")).toBeChecked();
  expect(await exportLayout(page)).toBe(baseline);
});

test("one variable form shows only applicable fields with type, units and descriptions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDynamicsEditor(page);
  const form = page.locator("#binding-form");
  const source = form.locator("[name=source]");
  const prop = form.locator("[name=property]");
  await expect(page.locator("dialog form")).toHaveCount(1);
  await expect(source).toHaveValue("Motion");
  await expect(page.locator("#source-help")).toContainText("時間は秒");
  await expect(form.locator("[name=rate]")).toBeVisible();
  await expect(form.locator("[name=blockName]")).toBeHidden();
  await expect(form.locator("[name=inputMin]")).toBeDisabled();
  await prop.selectOption("Orbit");
  await expect(form.locator("[name=centerX]")).toBeVisible();
  await expect(form.locator("[name=anchor]")).toBeHidden();
  await expect(page.locator("#property-help")).toContainText("度/秒");
  await form.locator("[name=mode]").selectOption("Loop");
  await expect(form.locator("[name=min]")).toHaveAttribute("required", "");
  await source.selectOption("RotorAngle");
  await expect(page.locator("#source-help")).toContainText("数値｜単位：rad");
  await expect(page.locator("#source-help")).toContainText("出力は度");
  await expect(form.locator("[name=centerX]")).toBeVisible();
  await expect(form.locator("[name=rate]")).toBeHidden();
  await expect(form.locator("[name=inputMin]")).toBeVisible();
  await expect(form.locator("[name=property] option[value=Orbit]")).toHaveCount(
    1,
  );
  await source.selectOption("Enabled");
  await expect(prop).toHaveValue("Orbit");
  await prop.selectOption("Color");
  await expect(page.locator("#source-help")).toContainText("真偽値｜単位なし");
  await expect(form.locator("[name=minColor]")).toBeVisible();
  await expect(form.locator("[name=inputMin]")).toBeDisabled();
  await source.selectOption("BatteryChargeRatio");
  await expect(page.locator("#source-help")).toContainText("0〜1");
  await expect(form.locator("[name=minColor]")).toBeEnabled();
  await page.locator("#dynamics-close").click();
  await page.locator('[data-element="1"]').click();
  await openDynamicsEditor(page);
  await source.selectOption("BatteryStoredPower");
  await prop.selectOption("Data");
  await expect(page.locator("#source-help")).toContainText("MWh");
  await expect(form.locator("[name=decimals]")).toBeVisible();
  await expect(form.locator("[name=inputMin]")).toBeHidden();
  await expect(page.locator("#property-help")).toContainText("数値換算なし");
  await source.selectOption("Motion");
  await expect(form.locator("[name=property] option[value=Width]")).toHaveCount(
    0,
  );
  await expect(form.locator("[name=property] option[value=Data]")).toHaveCount(
    0,
  );
  await page.screenshot({ path: "test-results/unified-dynamics.png" });
});

test("editing can convert Motion and block input atomically with undo and unchanged exchange formats", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDynamicsEditor(page);
  const form = page.locator("#binding-form");
  await form.locator("[name=property]").selectOption("Width");
  await form.locator("[name=rate]").fill("25");
  await form.locator("button[type=submit]").click();
  await page.locator("[data-edit=motion]").click();
  await expect(form.locator("[name=source]")).toHaveValue("Motion");
  await form.locator("[name=source]").selectOption("BatteryChargeRatio");
  await form.locator("[name=blockName]").fill("Battery A");
  await form.locator("[name=inputMax]").fill("0");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#dynamic-error")).not.toBeEmpty();
  await expect(page.locator("[data-edit=motion]")).toHaveCount(1);
  await expect(form.locator("[name=inputMax]")).toHaveValue("0");
  await form.locator("[name=inputMax]").fill("1");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("[data-edit=motion]")).toHaveCount(0);
  await expect(page.locator("[data-edit=bindings]")).toHaveCount(1);
  await page.locator("#dynamics-close").click();
  await exchangeTracks(page, "Binding");
  await expect(page.locator("#input")).toHaveValue(
    /Source=BatteryChargeRatio;BlockName="Battery A"/,
  );
  await page.locator("dialog [data-action=close]").click();
  await page.locator("[data-action=undo]").click();
  await openDynamicsEditor(page);
  await expect(page.locator("[data-edit=motion]")).toHaveCount(1);
  await expect(page.locator("[data-edit=bindings]")).toHaveCount(0);
  await page.locator("#dynamics-close").click();
  await page.locator("[data-action=redo]").click();
  await openDynamicsEditor(page);
  await page.locator("[data-edit=bindings]").click();
  await expect(form.locator("[name=source]")).toHaveValue("BatteryChargeRatio");
  await form.locator("[name=source]").selectOption("Motion");
  await form.locator("[name=rate]").fill("30");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("[data-edit=motion]")).toHaveCount(1);
  await expect(page.locator("[data-edit=bindings]")).toHaveCount(0);
  await page.locator("#dynamics-close").click();
  await exchangeTracks(page, "Motion");
  await expect(page.locator("#input")).toHaveValue(/Property=Width;Rate=30/);
});

test("input variables are grouped by compatible block type in both languages", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDynamicsEditor(page);
  const source = page.locator("#binding-form [name=source]");
  await expect(
    source.locator('optgroup[label="バッテリー"] option'),
  ).toHaveCount(6);
  await expect(
    source.locator('optgroup[label="船舶コントローラー"] option[value=Speed]'),
  ).toHaveCount(1);
  await expect(
    source.locator(
      'optgroup[label="ローター・ヒンジ"] option[value=RotorAngle]',
    ),
  ).toHaveCount(1);
  await expect(source.locator("option")).toHaveCount(31);
  await source.selectOption("BatteryStoredPower");
  await expect(page.locator("#source-help")).toContainText("MWh");
  await page.locator("#dynamics-close").click();
  await page.locator("#language").selectOption("en");
  await openDynamicsEditor(page);
  await expect(source.locator('optgroup[label="Battery"] option')).toHaveCount(
    6,
  );
  await expect(
    source.locator('optgroup[label="Ship controller"] option[value=Speed]'),
  ).toHaveCount(1);
});

test("selected element and shared time sliders simulate independently without changing layout or undo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await exchangeTracks(
    page,
    "Motion",
    "Element=background;Property=MoveX;Rate=10\nElement=label;Property=MoveY;Rate=20",
  );
  const baseline = await exportLayout(page);
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("#selected-time-range")).toBeVisible();
  await page.locator("#selected-time-range").fill("2");
  await expect(page.locator("#selected-time-number")).toHaveValue("2");
  await expect(page.locator('#canvas [data-sprite="0"]')).toHaveAttribute(
    "transform",
    "translate(20 0) rotate(0)",
  );
  await expect(page.locator('#canvas [data-sprite="1"]')).toHaveAttribute(
    "transform",
    "translate(0 0) rotate(0)",
  );
  await page.locator("#global-time-range").fill("3");
  await expect(page.locator("#global-time-number")).toHaveValue("3");
  await expect(page.locator('#canvas [data-sprite="0"]')).toHaveAttribute(
    "transform",
    "translate(30 0) rotate(0)",
  );
  await expect(page.locator('#canvas [data-sprite="1"]')).toHaveAttribute(
    "transform",
    "translate(0 60) rotate(0)",
  );
  await page.locator("#timeline-duration").fill("120");
  await expect(page.locator("#global-time-range")).toHaveAttribute(
    "max",
    "120",
  );
  await page
    .locator('#canvas [data-sprite="1"]')
    .dispatchEvent("pointerdown", { button: 0 });
  await expect(page.locator("#global-time-number")).toHaveValue("3");
  await page.locator("#selected-time-range").fill("1");
  await expect(page.locator('#canvas [data-sprite="0"]')).toHaveAttribute(
    "transform",
    "translate(0 0) rotate(0)",
  );
  await expect(page.locator('#canvas [data-sprite="1"]')).toHaveAttribute(
    "transform",
    "translate(0 20) rotate(0)",
  );
  await page.locator(".selected-preview [data-action=reset-scrub]").click();
  await expect(page.locator('#canvas [data-sprite="1"]')).toHaveAttribute(
    "transform",
    "translate(0 0) rotate(0)",
  );
  expect(await exportLayout(page)).toBe(baseline);
  await page.locator("[data-action=undo]").click();
  await exchangeTracks(page, "Motion");
  await expect(page.locator("#input")).toHaveValue("");
});

test("selected Source sliders and invalid motion previews retain base data and the last valid frame", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await exchangeTracks(
    page,
    "Binding",
    'Element=background;Property=Width;Source=BatteryChargeRatio;BlockName="Battery";InputMin=0;InputMax=1;OutputMin=0;OutputMax=200\nElement=background;Property=Color;Source=IsWorking;BlockName="Battery";MinColor=1,2,3,0;MaxColor=4,5,6,255',
  );
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-scrub-binding="0"]').fill("0.5");
  await expect(
    page.locator('#canvas [data-sprite="0"] rect').first(),
  ).toHaveAttribute("width", "100");
  await page.locator('[data-scrub-binding="1"]').fill("0");
  await expect(
    page.locator('#canvas [data-sprite="0"] rect').first(),
  ).toHaveAttribute("fill", "rgba(1,2,3,0)");
  await expect(page.locator('[data-scrub-value="1"]')).toHaveText("false");
  await page.locator(".selected-preview [data-action=reset-scrub]").click();
  await expect(
    page.locator('#canvas [data-sprite="0"] rect').first(),
  ).toHaveAttribute("width", "200");
  await exchangeTracks(
    page,
    "Motion",
    "Element=label;Property=TextScale;Rate=-1",
  );
  await page.locator('[data-element="1"]').click();
  await page.locator("#selected-time-range").fill("0.5");
  await expect(page.locator("#canvas [data-sprite] text")).toHaveAttribute("font-size", "14");
  await page.locator("#selected-time-range").fill("1");
  await expect(page.locator("#selected-preview-error")).toContainText("正");
  await expect(page.locator("#canvas [data-sprite] text")).toHaveAttribute("font-size", "14");
  await page.screenshot({ path: "test-results/element-animation-sliders.png" });
});

test("playback uses frame timestamps without negative time on start or resume", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await exchangeTracks(
    page,
    "Motion",
    "Element=background;Property=MoveX;Rate=10",
  );
  await page.locator("[data-action=preview]").click();
  await page.evaluate(() => {
    const frameWindow = window as typeof window & {
      stepPreviewFrame(time: number): void;
    };
    const nativeRequest = window.requestAnimationFrame.bind(window),
      nativeCancel = window.cancelAnimationFrame.bind(window);
    let id = 1000000;
    const callbacks = new Map<number, FrameRequestCallback>();
    window.requestAnimationFrame = (callback) => {
      if (callback.name !== "tick") return nativeRequest(callback);
      callbacks.set(++id, callback);
      return id;
    };
    window.cancelAnimationFrame = (frame) => {
      if (!callbacks.delete(frame)) nativeCancel(frame);
    };
    frameWindow.stepPreviewFrame = (time) => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(time));
    };
  });
  const step = (time: number) =>
    page.evaluate(
      (value) =>
        (
          window as typeof window & { stepPreviewFrame(time: number): void }
        ).stepPreviewFrame(value),
      time,
    );
  await page.locator("[data-action=play-preview]").click();
  await step(0);
  await expect(page.locator("#global-time-number")).toHaveValue("0");
  await expect(page.locator("#preview-error")).toBeEmpty();
  await step(16);
  await expect(page.locator("#global-time-number")).toHaveValue("0.016");
  await step(8);
  await expect(page.locator("#global-time-number")).toHaveValue("0.016");
  await step(32);
  await expect(page.locator("#global-time-number")).toHaveValue("0.032");
  await page.locator("[data-action=play-preview]").click();
  await page.locator("[data-action=play-preview]").click();
  await step(1000);
  await expect(page.locator("#global-time-number")).toHaveValue("0.032");
  await step(1016);
  await expect(page.locator("#global-time-number")).toHaveValue("0.048");
  await expect(page.locator("#preview-error")).toBeEmpty();
});

test("compact side controls leave the canvas tall and keep eight palette slots and color inheritance on one line", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1050, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await exchangeTracks(
    page,
    "Motion",
    "Element=background;Property=MoveX;Rate=10",
  );
  await page.locator('[data-element="0"]').click();
  for (const lang of ["ja", "en"]) {
    await page.locator("#language").selectOption(lang);
    await expect(
      page.locator(
        ".workspace .preview-controls, .workspace .animation-preview",
      ),
    ).toHaveCount(0);
    const viewport = (await page.locator(".viewport").boundingBox())!;
    expect(viewport.height).toBeGreaterThan(350);
    expect(
      viewport.height /
        (await page.locator(".workspace").boundingBox())!.height,
    ).toBeGreaterThan(0.65);
    expect(
      (await page.locator(".right-panel").boundingBox())!.x,
    ).toBeGreaterThanOrEqual(viewport.x + viewport.width - 1);
    const slots = await page
      .locator("[data-palette-slot]")
      .evaluateAll((elements) =>
        elements.map((el) => ({
          top: el.getBoundingClientRect().top,
          right: el.getBoundingClientRect().right,
        })),
      );
    expect(new Set(slots.map((slot) => Math.round(slot.top))).size).toBe(1);
    expect(slots[7].right).toBeLessThanOrEqual(
      (await page.locator(".inspector").boundingBox())!.width + 1,
    );
    const inherit = page.locator(".inherit-color");
    expect((await inherit.boundingBox())!.height).toBeLessThan(24);
    expect(
      await inherit.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  await page.locator("[data-action=preview]").click();
  await expect(page.locator("#global-time-range")).toBeEnabled();
  await page.locator("#global-time-number").fill("2");
  await expect(page.locator('#canvas [data-sprite="0"]')).toHaveAttribute(
    "transform",
    "translate(20 0) rotate(0)",
  );
  await page.locator('[data-background-number="0"]').fill("32");
  await expect(page.locator("#preview-fill")).toHaveAttribute(
    "fill",
    "rgba(32,0,0,1)",
  );
  await page.screenshot({ path: "test-results/compact-preview-sidebar.png" });
});

test("animation property and time mode descriptions follow every selection in Japanese and English", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  for (const lang of ["ja", "en"]) {
    await page.locator("#language").selectOption(lang);
    await page.locator('[data-element="0"]').click();
    await openDynamicsEditor(page);
    const property = page.locator("#binding-form [name=property]");
    const source = page.locator("#binding-form [name=source]");
    for (const [value, ja, en] of [
      ["MoveX", "正は右", "positive right"],
      ["MoveY", "正は下", "positive down"],
      ["Width", "最終的な幅", "final texture width"],
      ["Height", "最終的な高さ", "final texture height"],
      ["Angle", "時計回り", "clockwise"],
      ["Orbit", "図形の向き：", "Orientation is controlled independently"],
    ]) {
      await property.selectOption(value);
      await expect(page.locator("#operation-help")).toContainText(
        lang === "ja" ? ja : en,
      );
    }
    const mode = page.locator("#binding-form [name=mode]");
    for (const [value, ja, en] of [
      ["Clamp", "範囲制限なし", "unbounded"],
      ["Loop", "下端へ戻り", "wrapping"],
      ["PingPong", "端に到達すると進行方向を反転", "reversing at each end"],
    ]) {
      await mode.selectOption(value);
      await expect(page.locator("#mode-help")).toContainText(
        lang === "ja" ? ja : en,
      );
      await expect(page.locator("#mode-help")).toContainText(value);
    }
    await expect(mode).toHaveAttribute("aria-describedby", "mode-help");
    await source.selectOption("Enabled");
    await expect(page.locator("#mode-help")).toBeHidden();
    await property.selectOption("Color");
    await expect(page.locator("#operation-help")).toContainText("RGBA");
    await page.locator("#dynamics-close").click();
    await page.locator('[data-element="1"]').click();
    await openDynamicsEditor(page);
    await property.selectOption("TextScale");
    await expect(page.locator("#operation-help")).toContainText(
      lang === "ja" ? "正の有限値" : "positive and finite",
    );
    await source.selectOption("Speed");
    await property.selectOption("Data");
    await expect(page.locator("#operation-help")).toContainText(
      lang === "ja" ? "元の文字列を参照値へ置き換え" : "Replaces the base text",
    );
    await expect(page.locator("#mode-help")).toBeHidden();
    await page.locator("#dynamics-close").click();
  }
});

test("row actions target the clicked layer, preserve grouped operations and protect locked or hidden layers", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  const row = (index: number) => page.locator(`[data-layer-row="${index}"]`);
  const sizes = await row(0)
    .locator(".layer-flags button, .layer-row-actions button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const { width, height } = button.getBoundingClientRect();
        return [width, height];
      }),
    );
  expect(sizes).toEqual(Array.from({ length: 4 }, () => [24, 24]));

  await expect(page.locator(".layer-actions, .sprite-actions")).toHaveCount(0);
  await expect(
    page.locator(".inspector [data-action=up], .inspector [data-action=down]"),
  ).toHaveCount(0);
  // Clicking a row action also works when that row was not selected.
  await row(0).locator("[data-action=duplicate]").click();
  await expect(page.locator("[data-layer-row]")).toHaveCount(3);
  await page.locator("[data-action=undo]").click();
  await expect(page.locator("[data-layer-row]")).toHaveCount(2);
  await page.locator("[data-action=redo]").click();
  await row(2).locator("[data-action=delete]").click();
  await expect(page.locator("[data-layer-row]")).toHaveCount(2);
  await page.locator("[data-action=undo]").click();
  await expect(page.locator("[data-layer-row]")).toHaveCount(3);
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-element="1"]').click({ modifiers: ["Control"] });
  await row(1).locator("[data-action=duplicate]").click();
  await expect(page.locator("[data-layer-row]")).toHaveCount(5);
  await page.locator("[data-action=undo]").click();
  await page.locator('[data-lock="0"]').click();
  await expect(row(0).locator("[data-action=duplicate]")).toBeDisabled();
  await expect(row(0).locator("[data-action=delete]")).toBeDisabled();
  await page.locator('[data-visibility="1"]').click();
  await expect(row(1).locator("[data-action=duplicate]")).toBeDisabled();
  await expect(row(1).locator("[data-action=delete]")).toBeDisabled();
});

test("geometric preview gallery preserves all material IDs in export", async ({
  page,
}) => {
  const { PREVIEW_SPRITE_NAMES } = await import("../../src/sprite-preview");
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDrawingImport(page);
  await page
    .locator("#input")
    .fill(
      PREVIEW_SPRITE_NAMES.map(
        (name, i) =>
          `Id=s${i};Type=TEXTURE;Data="${name}";Position=${(i % 5) * 95 - 190},${Math.floor(i / 5) * 90 - 180};Size=${i % 2 ? "70,40" : "45,70"};AngleDegrees=15;Color=100,200,255,180`,
      ).join("\n"),
    );
  await page.locator("dialog [data-action=apply]").click();
  await expect(
    page.locator("#canvas [data-sprite] [data-preview]"),
  ).toHaveCount(PREVIEW_SPRITE_NAMES.length);
  await expect(page.locator("#canvas [data-sprite] text")).toHaveCount(0);
  await page.screenshot({ path: "test-results/sprite-gallery.png" });
  await openDrawingExport(page);
  const output = await page.locator("#input").inputValue();
  for (const name of PREVIEW_SPRITE_NAMES)
    expect(output).toContain(`Data="${name}"`);
});

test("basic shape proportions match the game comparison without changing layout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  const names = ["SquareTapered", "SemiCircle", "Triangle"];
  await importLayout(
    page,
    names
      .map(
        (name, i) =>
          `Id=s${i};Type=TEXTURE;Data="${name}";Position=${(i - 1) * 150},0;Size=100,100`,
      )
      .join("\n"),
  );
  const boxes = await page
    .locator("#canvas [data-preview]")
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = (node as SVGGraphicsElement).getBBox();
        return {
          width: box.width,
          height: box.height,
          bottom: box.y + box.height,
        };
      }),
    );
  expect(boxes[0].width).toBeCloseTo(100);
  expect(boxes[0].height).toBeCloseTo(100);
  expect(boxes[1].height).toBeCloseTo(50);
  expect(boxes[1].bottom).toBeCloseTo(0);
  expect(boxes[2].height).toBeCloseTo((100 * Math.sqrt(3)) / 2);
  expect(boxes[2].bottom).toBeCloseTo(50);
  const output = await exportLayout(page);
  for (const name of names) expect(output).toContain(`Data="${name}"`);
  expect(output.match(/Size=100,100/g)).toHaveLength(3);
});

test("empty canvas clears multiple selection without changing elements or pan selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-element="1"]').click({ modifiers: ["Control"] });
  await expect(page.locator(".arrange-tools")).toBeVisible();
  await page.keyboard.down("Space");
  await page.locator("#canvas").click({ position: { x: 15, y: 15 } });
  await page.keyboard.up("Space");
  await expect(page.locator(".arrange-tools")).toBeVisible();
  await page.locator("#canvas").click({ position: { x: 15, y: 15 } });
  await expect(page.locator(".arrange-tools")).toHaveCount(0);
  await expect(page.locator("#properties")).toHaveCount(0);
  await expect(page.locator("#canvas [data-sprite]")).toHaveCount(2);
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("select[name=data]")).toHaveValue("SquareSimple");
});

test("layer locks use monochrome SVG and retain accessible state labels", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  const lock = page.locator('[data-lock="0"]');
  await expect(lock).toHaveAttribute("aria-label", "ロック");
  await expect(lock.locator("svg")).toHaveAttribute("stroke", "currentColor");
  const open = await lock.locator("path").first().getAttribute("d");
  await lock.click();
  await expect(lock).toHaveAttribute("aria-label", "ロック解除");
  expect(await lock.locator("path").first().getAttribute("d")).not.toBe(open);
  await lock.click();
  await expect(lock).toHaveAttribute("aria-label", "ロック");
});

test("marquee contains rotated bounds, adds with Shift, cancels and excludes locked/hidden elements", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDrawingImport(page);
  await page
    .locator("#input")
    .fill(
      [0, 1, 2, 3]
        .map(
          (i) =>
            `Id=a${i};Type=TEXTURE;Data="SquareSimple";Position=${-100 + i * 70},0;Size=30,30;AngleDegrees=30`,
        )
        .join("\n"),
    );
  await page.locator("dialog [data-action=apply]").click();
  await page.locator('[data-lock="2"]').click();
  await page.locator('[data-visibility="3"]').click();
  const box = (await page.locator("#canvas").boundingBox())!;
  const marquee = async (end: number, cancel = false) => {
    await page.mouse.move(box.x + 80, box.y + 210);
    await page.mouse.down();
    await page.mouse.move(box.x + end, box.y + 300, { steps: 5 });
    if (cancel) await page.keyboard.press("Escape");
    await page.mouse.up();
  };
  await marquee(260);
  await expect(page.locator("[data-element].active")).toHaveCount(2);
  await expect(page.locator(".arrange-tools")).toBeVisible();
  await marquee(450, true);
  await expect(page.locator("[data-element].active")).toHaveCount(2);
  await page.locator('[data-element="0"]').click();
  await page.keyboard.down("Shift");
  await marquee(450);
  await page.keyboard.up("Shift");
  await expect(page.locator("[data-element].active")).toHaveCount(2);
});

test("multiple selection has no bulk form and property edits affect only the active element", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-element="1"]').click({ modifiers: ["Control"] });
  await expect(page.locator('.elements button.active')).toHaveCount(2);
  await expect(page.locator('#bulk-properties, .bulk-settings')).toHaveCount(0);
  await expect(page.locator('.arrange-tools')).toBeVisible();
  const first = await page.locator('[data-sprite="0"]').getAttribute('transform');
  await page.locator('#properties [name="x"]').fill('123');
  await page.locator('#properties [name="x"]').press('Tab');
  await expect(page.locator('[data-sprite="0"]')).toHaveAttribute('transform',first!);
  await expect(page.locator('[data-sprite="1"]')).toHaveAttribute('transform',/translate\(123 /);
  await page.locator('#language').selectOption('en');
  await expect(page.locator('#bulk-properties, .bulk-settings')).toHaveCount(0);
  await expect(page.locator('footer')).toContainText('Drag: move');
  await page.locator('#language').selectOption('ja');
  await expect(page.locator('footer')).toContainText('ドラッグ：移動');
});

test("grid appearance and preview status persist separately from projects and fine movement", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("#preview-support")).toContainText("近似図形");
  await page.locator("[data-action=settings]").click();
  const form = page.locator("#settings-form");
  await form.locator("[name=gridColor]").fill("#ff0000");
  await form.locator("[name=gridOpacity]").fill("0.5");
  await form.locator("[name=gridStep]").fill("25");
  await form.locator("[name=gridOnShapes]").check();
  await form.locator("[name=showPreviewStatus]").uncheck();
  await form.locator("[name=fineStep]").fill("0.25");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#gridpattern")).toHaveAttribute("width", "25");
  await expect(page.locator("#gridpattern path")).toHaveAttribute(
    "stroke",
    "#ff0000",
  );
  await expect(page.locator("#grid-overlay")).not.toHaveAttribute("mask");
  await expect(page.locator("#preview-support")).toHaveCount(0);
  const x = Number(await page.locator("[name=x]").inputValue());
  await page.locator("#canvas").focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.locator("[name=x]")).toHaveValue(String(x + 0.25));
  await page.reload();
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await expect(page.locator("#gridpattern")).toHaveAttribute("width", "25");
  await page.locator("[data-action=settings]").click();
  await page.locator("#settings-form [name=gridOnShapes]").uncheck();
  await page.locator("#settings-form button[type=submit]").click();
  await expect(page.locator("#grid-overlay")).toHaveAttribute(
    "mask",
    "url(#grid-mask)",
  );
  await expect(page.locator("#grid-mask [data-preview]")).toHaveAttribute(
    "fill",
    "black",
  );
});

test("selected preview bounds, Angle pivot and consolidated dialog controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator("header [data-action=dynamics]")).toHaveCount(0);
  await expect(page.locator("[data-action=dynamics]")).toHaveCount(1);
  await openDynamicsEditor(page);
  await page.locator("[name=property]").selectOption("Angle");
  await expect(page.locator("[name=anchor]")).toBeVisible();
  await page.locator("[name=anchor]").selectOption("TopLeft");
  await page.locator("#binding-form button[type=submit]").click();
  await page.locator("#dynamics-close").click();
  await page.locator("#selected-time-number").fill("2");
  const frame = await page.locator("#canvas").innerHTML();
  await page.locator("#selected-time-number").fill("999999");
  expect(await page.locator("#canvas").innerHTML()).toBe(frame);
  await exchangeTracks(page, "Motion");
  await expect(page.locator("#input")).toHaveValue(
    /Property=Angle;.*Anchor=TopLeft/,
  );
  await page.locator("dialog [data-action=close]").click();
  await exchangeTracks(
    page,
    "Binding",
    'Element=background;Property=Width;Source=Speed;BlockName="Cockpit";InputMin=0;InputMax=100;OutputMin=0;OutputMax=200',
  );
  await page.locator('[data-scrub-number="0"]').fill("50");
  await expect(page.locator('[data-scrub-binding="0"]')).toHaveValue("50");
  const valid = await page.locator("#canvas").innerHTML();
  await page.locator('[data-scrub-number="0"]').fill("101");
  expect(await page.locator("#canvas").innerHTML()).toBe(valid);
  await page.locator('[data-scrub-number="0"]').fill("-1");
  expect(await page.locator("#canvas").innerHTML()).toBe(valid);
  await page.locator('[data-scrub-binding="0"]').focus();
  await expect(page.locator('[data-scrub-number="0"]')).toHaveValue("50");
  await expect(
    page.locator(".snap-group").first().locator("#snap"),
  ).toHaveCount(1);
  await expect(
    page.locator(".snap-group").first().locator("[name=moveStep]"),
  ).toHaveCount(1);
  await expect(
    page.locator(".snap-group").last().locator("#object-snap"),
  ).toHaveCount(1);
  await openDynamicsEditor(page);
  await page.locator("[name=source]").selectOption("Speed");
  await page.locator("[name=property]").selectOption("Angle");
  await expect(page.locator("#operation-help")).toContainText(
    "角度の変数連動は基準点指定不可",
  );
  await expect(page.locator("#dynamics-close")).toHaveText("×");
});

test("dragging updates selected geometry before release and Escape restores it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator("#snap").uncheck();
  await page.locator("#object-snap").uncheck();
  await page.locator('[data-element="1"]').click();
  const undoWasDisabled = await page.locator("[data-action=undo]").isDisabled();
  const box = (await page.locator('#canvas [data-sprite="0"]').boundingBox())!;
  const start = { x: box.x + 20, y: box.y + 20 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.waitForTimeout(160);
  await page.mouse.move(start.x + 40, start.y + 30, { steps: 4 });
  await expect(page.locator("#properties [name=id]")).toHaveValue("background");
  await expect(page.locator("#properties [name=x]")).toHaveValue("40");
  await expect(page.locator("#properties [name=y]")).toHaveValue("30");
  await page.mouse.move(start.x + 60, start.y + 50, { steps: 2 });
  await expect(page.locator("#properties [name=x]")).toHaveValue("60");
  await expect(page.locator("#properties [name=y]")).toHaveValue("50");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator("#properties [name=x]")).toHaveValue("0");
  await expect(page.locator("#properties [name=y]")).toHaveValue("0");
  expect(await page.locator("[data-action=undo]").isDisabled()).toBe(
    undoWasDisabled,
  );
});

test("basic preview ink stays within dimensions used for edge snapping", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="0"]').click();
  await page.locator("#properties [name=width]").fill("40");
  await page.locator("#properties [name=height]").fill("24");
  for (const name of [
    "SquareSimple",
    "SquareHollow",
    "Circle",
    "CircleHollow",
  ]) {
    await page.locator("#properties [name=data]").selectOption(name);
    const result = await page
      .locator("#canvas [data-preview]")
      .first()
      .evaluate(async (el) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="-32 -32 64 64">${el.outerHTML}</svg>`;
        const image = new Image();
        image.src = "data:image/svg+xml," + encodeURIComponent(svg);
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, 64, 64).data;
        let outside = 0,
          inside = 0;
        for (let y = 0; y < 64; y++)
          for (let x = 0; x < 64; x++) {
            const alpha = pixels[(y * 64 + x) * 4 + 3];
            if (x < 12 || x >= 52 || y < 20 || y >= 44) outside += alpha;
            else inside += alpha;
          }
        return { outside, inside };
      });
    expect(result.outside, name).toBe(0);
    expect(result.inside, name).toBeGreaterThan(0);
  }
});

test("current PB bindings edit switching, boolean geometry and explicit Motion composition", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDynamicsEditor(page);
  const form = page.locator("#binding-form");
  await form.locator("[name=property]").selectOption("Angle");
  await form.locator("[name=rate]").fill("10");
  await form.locator("button[type=submit]").click();
  await page.locator("#dynamic-new").click();
  await form.locator("[name=source]").selectOption("Enabled");
  await form.locator("[name=property]").selectOption("Angle");
  await form.locator("[name=blockName]").fill("Ref");
  await form.locator("[name=outputMin]").fill("0");
  await form.locator("[name=outputMax]").fill("90");
  await form.locator("[name=combine]").selectOption("Add");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#dynamic-error")).toBeEmpty();
  await page.locator("#dynamic-new").click();
  await form.locator("[name=source]").selectOption("Enabled");
  await form.locator("[name=property]").selectOption("Visible");
  await form.locator("[name=blockName]").fill("Ref");
  await form.locator("#threshold-add").click();
  await form.locator("[name=threshold]").fill("0.5");
  await form.locator("[name=case]").nth(0).selectOption("false");
  await form.locator("[name=case]").nth(1).selectOption("true");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#dynamic-error")).toBeEmpty();
  await page.locator("#dynamic-new").click();
  await form.locator("[name=source]").selectOption("Speed");
  await form.locator("[name=property]").selectOption("Data");
  await form.locator("[name=blockName]").fill("Ref");
  await form.locator("[name=threshold]").fill("10");
  await form.locator("[name=case]").nth(0).selectOption("SquareSimple");
  await form.locator("[name=case]").nth(1).selectOption("Circle");
  await form.locator("button[type=submit]").click();
  await expect(page.locator("#dynamic-error")).toBeEmpty();
  await expect(page.locator(".dynamic-records").first()).toContainText(
    "Visible",
  );
  await page.locator("#dynamics-close").click();
  await exchangeTracks(page, "Binding");
  await expect(page.locator("#input")).toHaveValue(
    /Property=Angle;.*Combine=Add/,
  );
  await expect(page.locator("#input")).toHaveValue(
    /Thresholds=0.5;Case0=false;Case1=true/,
  );
  await expect(page.locator("#input")).toHaveValue(
    /Case0="SquareSimple";Case1="Circle"/,
  );
});

test("output checkboxes enable an unmanaged screen without editing game INI", async ({
  page,
}) => {
  const info = readFileSync(
    "tests/fixtures/surface-info.ini",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const extra = info
    .slice(info.indexOf("[SurfaceInfo.Surface.0]"))
    .replace("SurfaceInfo.Surface.0", "SurfaceInfo.Surface.1");
  const source = readFileSync(
    "tests/fixtures/static-custom-data.ini",
    "utf8",
  )
    .replace(/\r\n/g, "\n")
    .replace(
      "\n---",
      `\n${info.replace("SurfaceCount=1", "SurfaceCount=2")}\n${extra}\n---`,
    );
  await page.goto("/");
  await page.locator('header [data-action="import"]').click();
  await page.locator("#input").fill(source);
  await page.locator('#dialog [data-action="apply"]').click();
  await page.locator('[data-surface="1"]').click();
  await page.locator('[data-action="text"]').click();
  await page.locator('[data-action="export"]').click();

  await expect(page.locator('[data-output-surface="1"]')).toBeChecked();
  await expect(page.locator('[data-output-surface="0"]')).not.toBeChecked();
  await page.locator("#custom-current").fill(source);
  await page.locator("#custom-generate").click();
  await expect(page.locator("#custom-result")).toHaveValue(/Surfaces=0,1/);
  await expect(page.locator("#custom-result")).toHaveValue(/Data="READY"/);
  await page.locator('[data-output-surface="1"]').uncheck();
  await expect(page.locator("#custom-result")).toHaveValue("");
  await expect(page.locator("#custom-download")).toBeDisabled();
  await page.locator("#custom-generate").click();
  await expect(page.locator("#custom-error")).toContainText("出力する面");
  await page.locator('[data-output-surface="0"]').check();
  await page.locator('[data-output-surface="1"]').check();
  await page.locator("#custom-generate").click();
  await expect(page.locator("#custom-error")).toBeEmpty();
  await expect(page.locator("#custom-result")).toHaveValue(
    /Settings.LCDSpriteDrawer.Surface.1/,
  );
});

async function openDrawingExport(page: import("@playwright/test").Page) {
  await page.locator("header [data-action=export]").click();
  await page.locator("#exchange-alternatives summary").click();
  await page.locator("#drawing-export").click();
}
async function openDrawingImport(page: import("@playwright/test").Page) {
  await page.locator("header [data-action=import]").click();
  await page.locator("#dialog details summary").click();
  await page.locator("#drawing-import").click();
}

test("game import replaces old screens, preserves canceled input and accepts the same LCD again", async ({
  page,
}) => {
  const info = readFileSync(
    "tests/fixtures/surface-info.ini",
    "utf8",
  );
  const source = readFileSync(
    "tests/fixtures/static-custom-data.ini",
    "utf8",
  )
    .replace(/\r\n/g, "\n")
    .replace("\n---", `\n${info}\n---`)
    .replace("BlockId=123456", "BlockId=987654")
    .replace("BlockName=Bridge LCD", "BlockName=Replacement LCD");
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('header [data-action="import"]').click();
  await page.locator("#input").fill("invalid");
  await page.locator('#dialog [data-action="apply"]').click();
  await expect(page.locator("#diagnostic")).not.toBeEmpty();
  await expect(page.locator(".surface-list .block-name")).toHaveCount(1);
  await page.locator("#input").fill(source);
  await page.locator('#dialog [data-action="apply"]').click();
  await page.locator('#confirm-dialog button[value="cancel"]').click();
  await expect(page.locator("#input")).toHaveValue(source);
  await expect(page.locator(".surface-list .block-name")).toHaveCount(1);
  await page.locator('#dialog [data-action="apply"]').click();
  await page.locator('#confirm-dialog button[value="discard"]').click();
  await expect(page.locator(".surface-list .block-name")).toHaveCount(1);
  await expect(page.locator(".surface-list [data-surface]")).toHaveCount(1);
  await expect(page.locator(".block-name")).toContainText("Replacement LCD");
  await page.locator('[data-element="1"]').click();
  await page.locator('[name="data"]').fill("LOCAL EDIT");
  await page.locator('header [data-action="import"]').click();
  await page.locator("#input").fill(source);
  await page.locator('#dialog [data-action="apply"]').click();
  await page.locator('#confirm-dialog button[value="discard"]').click();
  await expect(page.locator(".surface-list [data-surface]")).toHaveCount(1);
  await page.locator('[data-element="1"]').click();
  await expect(page.locator('[name="data"]')).toHaveValue("READY");
});

test("redoing a one-screen import after viewing an older second screen keeps the editor usable", async ({
  page,
}) => {
  const info = readFileSync(
    "tests/fixtures/surface-info.ini",
    "utf8",
  ).replace(/\r\n/g, "\n");
  const extra = info
    .slice(info.indexOf("[SurfaceInfo.Surface.0]"))
    .replace("SurfaceInfo.Surface.0", "SurfaceInfo.Surface.1");
  await page.goto("/");
  await page.locator('header [data-action="import"]').click();
  await page
    .locator("#input")
    .fill(info.replace("SurfaceCount=1", "SurfaceCount=2") + "\n" + extra);
  await page.locator('#dialog [data-action="apply"]').click();
  await page.locator('header [data-action="import"]').click();
  await page.locator("#input").fill(info);
  await page.locator('#dialog [data-action="apply"]').click();
  await page.locator('#confirm-dialog button[value="discard"]').click();
  await page.locator('[data-action="undo"]').click();
  await page.locator('[data-surface="1"]').click();
  await page.locator('[data-action="redo"]').click();
  await expect(page.locator("#canvas")).toBeVisible();
  await expect(page.locator('[data-action="export"]')).toBeEnabled();
  await expect(page.locator(".surface.active")).toHaveAttribute(
    "data-surface",
    "0",
  );
});

test("behavior dialog fixes its target, selects the first record and edits by row click", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-element="1"]').click();
  await exchangeTracks(
    page,
    "Motion",
    "Element=label;Property=MoveX;Rate=11\nElement=label;Property=MoveY;Rate=22",
  );
  await openDynamicsEditor(page);
  await expect(page.locator("#dynamic-element")).toHaveCount(0);
  await expect(page.locator("#dynamic-target")).toContainText("label");
  await expect(
    page.getByRole("button", { name: "編集", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-edit="motion"][data-index="0"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('#binding-form [name="rate"]')).toHaveValue("11");
  await page.locator('[data-edit="motion"][data-index="1"]').click();
  await expect(page.locator('#binding-form [name="rate"]')).toHaveValue("22");
  await page.locator('#binding-form [name="rate"]').fill("33");
  await page.locator('#binding-form button[type="submit"]').click();
  await expect(
    page.locator('[data-edit="motion"][data-index="1"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-remove="motion"]').first()).toHaveText("×");
  await page.locator('[data-remove="motion"][data-index="1"]').click();
  await expect(page.locator('[data-edit="motion"]')).toHaveCount(1);
  await expect(page.locator('#binding-form [name="rate"]')).toHaveValue("11");
  await page.locator("#dynamic-new").click();
  await expect(
    page.locator('[data-edit="motion"][aria-pressed="true"]'),
  ).toHaveCount(0);
  await expect(page.locator('#binding-form button[type="submit"]')).toHaveText(
    "動作を追加",
  );
  await page.locator("#dynamics-close").click();
  await page.locator('[data-element="0"]').click();
  await openDynamicsEditor(page);
  await expect(page.locator("#dynamic-target")).toContainText("background");
  await expect(page.locator("[data-edit]")).toHaveCount(0);
});

test("selected Motion slider spans one traversal and play toggles at the configured speed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await exchangeTracks(
    page,
    "Motion",
    "Element=background;Property=Angle;Rate=180",
  );
  await expect(page.locator("#selected-time-range")).toHaveAttribute(
    "max",
    "2",
  );
  await page.locator("#selected-time-range").fill("1");
  await expect(page.locator('#canvas [data-sprite="0"]')).toHaveAttribute(
    "transform",
    "translate(0 0) rotate(180)",
  );
  await exchangeTracks(
    page,
    "Motion",
    "Element=background;Property=Angle;Rate=90",
  );
  await expect(page.locator("#selected-time-range")).toHaveAttribute(
    "max",
    "4",
  );
  await page.locator("#selected-time-range").fill("2");
  await expect(page.locator('#canvas [data-sprite="0"]')).toHaveAttribute(
    "transform",
    "translate(0 0) rotate(180)",
  );
  await exchangeTracks(
    page,
    "Motion",
    "Element=background;Property=MoveX;Rate=20;Mode=Loop;Min=0;Max=100",
  );
  await expect(page.locator("#selected-time-range")).toHaveAttribute(
    "max",
    "5",
  );
  await page.locator("#selected-time-range").fill("0");
  await page.evaluate(() => {
    const nativeRequest = window.requestAnimationFrame.bind(window),
      nativeCancel = window.cancelAnimationFrame.bind(window);
    let id = 1000000;
    const callbacks = new Map<number, FrameRequestCallback>();
    window.requestAnimationFrame = (callback) => {
      if (callback.name !== "tick") return nativeRequest(callback);
      callbacks.set(++id, callback);
      return id;
    };
    window.cancelAnimationFrame = (frame) => {
      if (!callbacks.delete(frame)) nativeCancel(frame);
    };
    (
      window as typeof window & { advanceMotion(time: number): void }
    ).advanceMotion = (time) => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(time));
    };
  });
  const step = (time: number) =>
    page.evaluate(
      (value) =>
        (
          window as typeof window & { advanceMotion(time: number): void }
        ).advanceMotion(value),
      time,
    );
  await page.locator("#selected-play").click();
  await expect(page.locator("#selected-play")).toHaveText("停止");
  await step(0);
  await step(1000);
  await expect(page.locator("#selected-time-number")).toHaveValue("1");
  await expect(page.locator('#canvas [data-sprite="0"]')).toHaveAttribute(
    "transform",
    "translate(20 0) rotate(0)",
  );
  await page.locator("#selected-play").click();
  await step(2000);
  await expect(page.locator("#selected-time-number")).toHaveValue("1");
  await page.locator("#selected-play").click();
  await step(3000);
  await step(3500);
  await expect(page.locator("#selected-time-number")).toHaveValue("1.5");
  await step(10000);
  await expect(page.locator("#selected-play")).toHaveText("再生");
  await expect(page.locator("#selected-time-number")).toHaveValue("5");
  expect(await exportLayout(page)).toContain("Position=0,0");
});

test("circle and radial tools apply positions and angles with Undo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await importLayout(page, [0,1,2].map((i) => `Id=r${i};Type=TEXTURE;Data="Arrow";Position=${i*30},0;Size=20,20`).join("\n"));
  await page.locator('[data-element="0"]').click();
  await expect(page.locator('[data-action="circle-arrange"]')).toBeDisabled();
  await page.locator('[data-element="1"]').click({ modifiers: ["Shift"] });
  await page.locator('[data-element="2"]').click({ modifiers: ["Shift"] });
  await page.locator('[data-action="circle-arrange"]').click();
  const form = page.locator('#circular-form');

  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('.arrange-tools #circular-form')).toBeVisible();
  await expect(page.locator('#circular-center')).toBeVisible();
  await page.locator('#zoom').evaluate((el: HTMLInputElement) => { el.value = '150'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const handle = page.locator('#circular-center');
  await handle.scrollIntoViewIfNeeded();
  const originalX = Number(await form.locator('[name="cx"]').inputValue());
  const originalY = Number(await form.locator('[name="cy"]').inputValue());
  let handleBox = (await handle.boundingBox())!;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 30, handleBox.y + handleBox.height / 2 + 15, { steps: 3 });
  await page.mouse.up();
  await expect(form.locator('[name="cx"]')).toHaveValue(String(originalX + 20));
  await expect(form.locator('[name="cy"]')).toHaveValue(String(originalY + 10));
  await expect(page.locator('.elements button.active')).toHaveCount(3);
  handleBox = (await handle.boundingBox())!;
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 30, handleBox.y + handleBox.height / 2);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(form.locator('[name="cx"]')).toHaveValue(String(originalX + 20));
  await form.locator('[name="cx"]').fill('0');
  await form.locator('[name="cy"]').fill('0');
  await expect(handle).toHaveAttribute('transform', 'translate(0 0)');
  await form.locator('[name="radius"]').fill('100');
  await form.locator('[name="start"]').fill('0');
  await form.locator('[name="sweep"]').fill('180');
  await form.locator('button[type="submit"]').click();
  let raw = await exportLayout(page);
  expect(raw).toContain('Position=100,0');
  expect(raw).toContain('Position=-100,');
  await page.locator('[data-action="radial-arrange"]').click();
  await form.locator('[name="cx"]').fill('0');
  await form.locator('[name="cy"]').fill('0');
  await form.locator('[name="offset"]').fill('90');
  await expect(page.locator('[data-circular-preview]').first()).toHaveAttribute('transform', /rotate\(90\)/);
  const radialGrip = page.locator('[data-circular-handle="offset"]').first();
  await radialGrip.scrollIntoViewIfNeeded();
  const radialBox = (await radialGrip.boundingBox())!;
  const radialEnd = await page.locator('#canvas').evaluate((svg: SVGSVGElement) => {
    const p = new DOMPoint(0,100).matrixTransform(svg.getScreenCTM()!); return {x:p.x,y:p.y};
  });
  await page.mouse.move(radialBox.x+radialBox.width/2,radialBox.y+radialBox.height/2);
  await page.mouse.down();
  await page.mouse.move(radialEnd.x,radialEnd.y,{steps:6});
  await page.mouse.up();
  await expect(form.locator('[name="offset"]')).toHaveValue('180');
  await form.locator('[name="offset"]').fill('90');
  await form.locator('button[type="submit"]').click();
  raw = await exportLayout(page);
  expect(raw).toContain('AngleDegrees=90');
  expect(raw).toContain('AngleDegrees=180');
  expect(raw).toContain('AngleDegrees=270');
  await page.locator('[data-action="undo"]').click();
  raw = await exportLayout(page);
  expect(raw).not.toContain('AngleDegrees=90');
  await page.locator('[data-action="undo"]').click();
  raw = await exportLayout(page);
  expect(raw).toContain('Position=30,0');
  await expect(form).toHaveCount(0);
  await expect(handle).toHaveCount(0);
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-action="radial-arrange"]').click();
  await page.locator('#circular-close').click();
  await expect(form).toHaveCount(0);
  await expect(handle).toHaveCount(0);
});

test("circular guides preview live and drag radius, sweep, start and planned positions", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプルで始める' }).click();
  await importLayout(page, [0,1,2].map((i) => `Id=g${i};Type=TEXTURE;Data="Arrow";Position=${i*30},0;Size=20,20`).join('\n'));
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-element="1"]').click({ modifiers: ['Shift'] });
  await page.locator('[data-element="2"]').click({ modifiers: ['Shift'] });
  await page.locator('[data-action="circle-arrange"]').click();
  const form = page.locator('#circular-form');
  const field = (name: string) => form.locator(`[name="${name}"]`);
  for (const [name,value] of Object.entries({cx:'0',cy:'0',radius:'100',start:'0',sweep:'180'})) await field(name).fill(value);
  await expect(page.locator('[data-circular-preview]')).toHaveCount(3);
  await expect(page.locator('.circular-track')).toHaveAttribute('r','100');
  const original = await page.locator('#canvas [data-sprite="1"]').getAttribute('transform');
  const dragTo = async (selector: string, x: number, y: number, cancel = false) => {
    const grip = page.locator(selector);
    await grip.scrollIntoViewIfNeeded();
    const box = (await grip.boundingBox())!;
    const destination = await page.locator('#canvas').evaluate((svg: SVGSVGElement, p) => {
      const v = new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM()!); return {x:v.x,y:v.y};
    }, {x,y});
    await page.mouse.move(box.x+box.width/2, box.y+box.height/2);
    await page.mouse.down();
    await page.mouse.move(destination.x,destination.y,{steps:8});
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up();
  };
  await dragTo('[data-circular-handle="radius"]',0,140);
  await expect(field('radius')).toHaveValue('140');
  await expect(page.locator('.circular-track')).toHaveAttribute('r','140');
  await dragTo('[data-circular-handle="start"]',0,162);
  await expect(field('start')).toHaveValue('90');
  await dragTo('[data-circular-handle="sweep"]',184,0);
  await expect(field('sweep')).toHaveValue('270');
  await dragTo('[data-circular-handle="point"][data-index="0"]',0,180);
  await expect(field('radius')).toHaveValue('180');
  await dragTo('[data-circular-handle="radius"]',-100,-100,true);
  await expect(field('radius')).toHaveValue('180');
  await expect(page.locator('#canvas [data-sprite="1"]')).toHaveAttribute('transform',original!);
  await field('rotate').check();
  await field('offset').fill('90');
  const ghost = page.locator('[data-circular-preview]').first();
  await expect(ghost).toHaveAttribute('transform', /rotate\(180\)/);
  await page.screenshot({ path: 'test-results/circular-guides.png' });
  await field('radius').fill('-1');
  await expect(page.locator('#circular-overlay')).toHaveCount(0);
  await field('radius').fill('180');
  await expect(page.locator('[data-circular-preview]')).toHaveCount(3);
  await page.locator('#circular-close').click();
  await expect(page.locator('#circular-overlay')).toHaveCount(0);
  await expect(page.locator('#canvas [data-sprite="1"]')).toHaveAttribute('transform',original!);
});

test("layer Shift ranges keep an anchor, Ctrl toggles, and Ctrl+A respects text editing", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプルで始める' }).click();
  await importLayout(page, [0,1,2,3,4].map((i) => `Id=s${i};Type=TEXTURE;Data="SquareSimple";Position=${i*40},0;Size=20,20`).join('\n'));
  const row = (i: number) => page.locator(`[data-element="${i}"]`);
  const active = page.locator('.elements button.active');
  await row(1).click();
  await row(4).click({modifiers:['Shift']});
  await expect(active).toHaveCount(4);
  await expect(row(0)).not.toHaveClass('active');
  await row(2).click({modifiers:['Shift']});
  await expect(active).toHaveCount(2);
  await expect(row(1)).toHaveClass('active');
  await row(0).click({modifiers:['Control']});
  await expect(active).toHaveCount(3);
  await row(2).click({modifiers:['Control']});
  await expect(active).toHaveCount(2);
  await page.locator('[data-lock="3"]').click();
  await page.locator('[data-visibility="4"]').click();
  await row(2).click();
  await row(0).click({modifiers:['Shift']});
  await expect(active).toHaveCount(3);
  await page.keyboard.press('Control+a');
  await expect(active).toHaveCount(3);
  await expect(row(3)).not.toHaveClass('active');
  await expect(row(4)).not.toHaveClass('active');
  await row(1).click();
  const text = page.locator('#properties [name="id"]');
  await text.fill('sample_id');
  await text.focus();
  await page.keyboard.press('Control+a');
  await expect(active).toHaveCount(1);
  expect(await text.evaluate((el: HTMLInputElement) => el.selectionStart === 0 && el.selectionEnd === el.value.length)).toBeTruthy();
  await text.press('Tab');
  await page.locator('#canvas').focus();
  await page.keyboard.press('Control+a');
  await expect(active).toHaveCount(3);
});

test("inspector restores its scroll after deselection and circular help uses diagrams", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプルで始める' }).click();
  await page.locator('[data-element="0"]').click();
  const inspector = page.locator('.inspector');
  const before = await inspector.evaluate((el) => { el.scrollTop = 320; return el.scrollTop; });
  expect(before).toBeGreaterThan(0);
  await page.locator('#canvas').click({position:{x:4,y:4}});
  await expect(page.locator('#properties')).toHaveCount(0);
  await page.locator('#grid').uncheck();
  await page.locator('[data-element="0"]').click();
  expect(await inspector.evaluate((el) => el.scrollTop)).toBe(before);
  await page.locator('[data-element="1"]').click({modifiers:['Control']});
  await page.locator('[data-action="circle-arrange"]').click();
  await expect(page.locator('.circular-help svg')).toHaveCount(5);
  await expect(page.locator('.circular-notes')).not.toHaveAttribute('open','');
  await expect(page.locator('.angle-compass')).toContainText('0°');
  await page.locator('#language').selectOption('en');
  await expect(page.locator('.circular-help')).toContainText('Center: move layout');
  await expect(page.locator('.circular-notes summary')).toHaveText('Placement rules');
});

test("persistent groups select, transform, edit members, duplicate independently and ungroup", async ({ page }) => {
  const errors: string[] = []; page.on('pageerror',(e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', {name:'サンプルで始める'}).click();
  await page.locator('[data-element="0"]').click();
  await page.locator('[data-element="1"]').click({modifiers:['Control']});
  await expect(page.locator('.inspector .group-tools')).toHaveCount(0);
  const groupButton = page.locator('.layers [data-action="group"]');
  expect((await groupButton.boundingBox())!.height).toBeLessThanOrEqual(26);
  await groupButton.click();
  await expect(page.locator('.group-row')).toHaveCount(1);
  await expect(page.locator('[data-element="0"]')).toBeHidden();
  await expect(page.locator('.group-toggle')).toHaveAttribute('aria-expanded','false');
  await page.locator('.group-toggle').click();
  await expect(page.locator('[data-element="0"]')).toBeVisible();
  await expect(page.locator('.group-toggle')).toHaveAttribute('aria-expanded','true');
  await page.locator('.group-toggle').click();
  await expect(page.locator('[data-element="0"]')).toBeHidden();
  const form = page.locator('#group-properties');
  await expect(form).toBeVisible();
  await expect(page.locator('#group-selection')).toBeVisible();
  await expect(form.locator('[name="x"]')).toHaveAttribute('readonly','');
  await expect(form.locator('[name="y"]')).toHaveAttribute('readonly','');
  const initialCenterX = await form.locator('[name="x"]').inputValue();
  await form.locator('[name="x"]').focus(); await page.keyboard.press('Control+a'); await page.keyboard.type('999');
  await expect(form.locator('[name="x"]')).toHaveValue(initialCenterX);
  await expect(page.locator('#group-center-marker')).toBeVisible();

  await page.locator('.group-properties').screenshot({path:'test-results/group-properties.png'});
  await expect(page.locator('#properties')).toHaveCount(0);
  await form.locator('[name="name"]').fill('Panel');
  await form.locator('[name="scale"]').fill('2');
  await form.locator('[name="rotation"]').fill('90');
  await form.locator('[name="color"]').fill('10,20,30,128');
  await expect(form.locator('button[type="submit"]')).toHaveCount(0);
  await expect(page.locator('[data-group-select="0"]')).toContainText('Panel');
  await expect(page.locator('[data-sprite="0"]')).toHaveAttribute('transform',/rotate\(90\)/);
  await expect(page.locator('[data-sprite="1"] text')).toHaveAttribute('font-size','56');
  const output = await exportLayout(page); expect(output).not.toContain('Panel'); expect(output).toContain('Color=10,20,30,128');
  await page.locator('.group-toggle').click();
  await page.locator('[data-element="1"]').click({modifiers:['Alt']});
  await expect(page.locator('.elements button.active')).toHaveCount(1);
  await expect(page.locator('#properties')).toBeVisible();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator('.elements button.active')).toHaveCount(2);
  await expect(form).toBeVisible();
  await page.locator('#snap').uncheck(); await page.locator('#object-snap').uncheck();
  const before = Number(await form.locator('[name="x"]').inputValue());
  await page.locator('#canvas').focus(); await page.keyboard.press('ArrowRight');
  expect(Number(await form.locator('[name="x"]').inputValue())).toBeCloseTo(before+1);
  const groupBeforeDrag = Number(await form.locator('[name="x"]').inputValue());
  const body = (await page.locator('[data-sprite="0"]').boundingBox())!;
  await page.mouse.move(body.x+body.width/2,body.y+body.height/2);
  await page.mouse.down(); await page.mouse.move(body.x+body.width/2+20,body.y+body.height/2+10,{steps:4}); await page.mouse.up();
  expect(Number(await form.locator('[name="x"]').inputValue())).toBeCloseTo(groupBeforeDrag+20);
  const centerPosition = await page.locator('#group-center-marker').getAttribute('transform');
  expect(centerPosition).toContain(String(groupBeforeDrag+20));
  await page.locator('#zoom').evaluate((el: HTMLInputElement) => { el.value='150'; el.dispatchEvent(new Event('input',{bubbles:true})); });
  await expect(page.locator('#group-center-marker > g')).toHaveAttribute('transform','scale(0.6666666666666666)');

  const pending = page.waitForEvent('download'); await page.locator('header [data-action="save"]').click();
  const file = await pending; const saved = readFileSync((await file.path())!,'utf8');
  const parsed = JSON.parse(saved); expect(parsed.version).toBe(5); expect(parsed.blocks[0].surfaces[0].elements.map((e:any) => e.group)).toEqual(['Panel','Panel']);
  const chooser = page.waitForEvent('filechooser'); await page.locator('header [data-action="open"]').click();
  await (await chooser).setFiles({name:'group.json',mimeType:'application/json',buffer:Buffer.from(saved)});
  await page.locator('[data-group-select="0"]').click(); await expect(page.locator('.elements button.active')).toHaveCount(2);
  await page.locator('.group-row [data-layer-index="0"][data-action="duplicate"]').click();
  await expect(page.locator('.elements button.active')).toHaveCount(2);
  await expect(page.locator('[data-group-select="2"]')).toContainText('Panel (1)');
  await page.locator('[data-group-select="0"]').click(); await expect(page.locator('.elements button.active')).toHaveCount(2);
  await page.locator('[data-action="ungroup"]').click(); await expect(form).toHaveCount(0);
  await page.locator('[data-element="0"]').click(); await expect(page.locator('.elements button.active')).toHaveCount(1);
  await page.locator('[data-action="undo"]').click(); await page.locator('[data-group-select="0"]').click();
  await expect(page.locator('.elements button.active')).toHaveCount(2);
  await page.locator('[data-group-toggle="Panel"]').click();
  await page.locator('[data-lock="1"]').click(); await expect(form.locator('[name="x"]')).toBeDisabled();
  const lockedPosition = await page.locator('[data-sprite="0"]').getAttribute('transform');
  await page.locator('#canvas').focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-sprite="0"]')).toHaveAttribute('transform',lockedPosition!);
  expect(errors).toEqual([]);
});

test("collapsed group rows preserve draw order and reorder whole groups", async ({ page }) => {
  await page.goto('/'); await page.getByRole('button',{name:'サンプルで始める'}).click();
  await importLayout(page,['a','b','c'].map((id,i) => `Id=${id};Type=TEXTURE;Data="SquareSimple";Position=${i*30},0;Size=20,20`).join('\n'));
  const original = await exportLayout(page);
  await page.locator('[data-element="0"]').click(); await page.locator('[data-element="1"]').click({modifiers:['Control']});
  await page.locator('.layers [data-action="group"]').click();
  await expect(page.locator('.elements > li:not([hidden])')).toHaveCount(2);
  expect(await exportLayout(page)).toBe(original);
  await page.locator('.group-toggle').click(); await expect(page.locator('.group-child:visible')).toHaveCount(2);
  await page.locator('.group-toggle').click(); expect(await exportLayout(page)).toBe(original);
  const target = page.locator('[data-layer-row="2"]'); const box = (await target.boundingBox())!;
  await page.locator('.group-row [data-layer-drag]').dragTo(target,{targetPosition:{x:70,y:box.height-3}});
  const moved = await exportLayout(page); expect(moved.indexOf('Id=c')).toBeLessThan(moved.indexOf('Id=a')); expect(moved.indexOf('Id=a')).toBeLessThan(moved.indexOf('Id=b'));
  const header = page.locator('.group-row'); const headerBox = (await header.boundingBox())!;
  await page.locator('li:not(.group-row) > [data-layer-drag="0"]').dragTo(header,{targetPosition:{x:70,y:headerBox.height-3}});
  expect(await exportLayout(page)).toBe(original);
  await page.locator('#language').selectOption('en'); await expect(page.locator('.group-toggle')).toHaveAttribute('aria-label','Expand group');
  await page.locator('.layers').screenshot({path:'test-results/collapsed-groups.png'});
});

test("group row visibility and lock toggle all members, show mixed states and persist flags", async ({ page }) => {
  await page.goto('/'); await page.getByRole('button',{name:'サンプルで始める'}).click();
  await importLayout(page,['a','b','outside'].map((id,i) => `Id=${id};Type=TEXTURE;Data="SquareSimple";Position=${i*30},0;Size=20,20`).join('\n'));
  const original = await exportLayout(page);
  await page.locator('[data-element="0"]').click(); await page.locator('[data-element="1"]').click({modifiers:['Control']});
  await page.locator('[data-action="group"]').click();
  const visibility = page.locator('.group-row [data-group-visibility]'), lock = page.locator('.group-row [data-group-lock]');
  await expect(visibility).toHaveAttribute('aria-pressed','false');
  await visibility.click(); await expect(visibility).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-sprite="0"], [data-sprite="1"]')).toHaveCount(0);
  await expect(page.locator('[data-sprite="2"]')).toBeVisible();
  expect(await exportLayout(page)).toBe(original);
  await lock.click(); await expect(lock).toHaveAttribute('aria-pressed','true');
  const pending = page.waitForEvent('download'); await page.locator('header [data-action="save"]').click();
  const file = await pending; const saved = JSON.parse(readFileSync((await file.path())!,'utf8'));
  expect(saved.blocks[0].surfaces[0].elements.slice(0,2).map((e:any) => [e.hidden,e.locked])).toEqual([[true,true],[true,true]]);
  expect(saved.blocks[0].surfaces[0].elements[2].hidden).toBeUndefined();
  expect(saved.blocks[0].surfaces[0].elements[2].locked).toBeUndefined();
  await page.locator('[data-action="undo"]').click(); await expect(lock).toHaveAttribute('aria-pressed','false');
  await expect(visibility).toHaveAttribute('aria-pressed','true');
  await visibility.click(); await page.locator('.group-toggle').click();
  await page.locator('[data-visibility="0"]').click(); await expect(visibility).toHaveAttribute('aria-pressed','mixed');
  await page.locator('[data-lock="0"]').click(); await expect(lock).toHaveAttribute('aria-pressed','mixed');
  await visibility.click(); await expect(visibility).toHaveAttribute('aria-pressed','true');
  await visibility.click(); await expect(visibility).toHaveAttribute('aria-pressed','false');
  await lock.click(); await expect(lock).toHaveAttribute('aria-pressed','true');
  await lock.click(); await expect(lock).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#canvas [data-sprite]')).toHaveCount(3);
  await page.locator('#language').selectOption('en'); await expect(lock).toHaveAttribute('aria-label','Lock group');
  await page.locator('.group-toggle').click(); await page.locator('.layers').screenshot({path:'test-results/group-flags.png'});
});

test("group numeric controls apply immediately without compounding and share RGBA and palette operations", async ({ page }) => {
  const errors: string[]=[]; page.on('pageerror',(e) => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button',{name:'サンプルで始める'}).click();
  await importLayout(page,[-20,20].map((x,i) => `Id=n${i};Type=TEXTURE;Data="SquareSimple";Position=${x},0;Size=20,20;Color=${10+i},20,30,255`).join('\n'));
  await page.locator('[data-element="0"]').click(); await page.locator('[data-element="1"]').click({modifiers:['Control']}); await page.locator('[data-action="group"]').click();
  const form=page.locator('#group-properties');
  const scale=form.locator('[name="scale"]'), rotation=form.locator('[name="rotation"]');
  await scale.fill('2'); await scale.fill('3');
  let raw=await exportLayout(page); expect(raw.match(/Size=60,60/g)).toHaveLength(2);
  await rotation.fill('90'); await rotation.fill('180');
  raw=await exportLayout(page); expect(raw.match(/AngleDegrees=180/g)).toHaveLength(2);
  await scale.fill('0'); await expect(form.locator('#group-error')).not.toBeEmpty();
  expect(await exportLayout(page)).toBe(raw);
  await scale.fill('1'); await expect(form.locator('#group-error')).toBeEmpty();
  await form.locator('[data-group-channel-number="0"]').fill('200');
  await expect(form.locator('[data-group-channel="0"]')).toHaveValue('200');
  raw=await exportLayout(page); expect(raw.match(/Color=200,20,30,255/g)).toHaveLength(2);
  await form.locator('[data-group-channel-number="3"]').fill('300');
  expect(await exportLayout(page)).toBe(raw);
  await form.locator('[data-group-channel-number="3"]').fill('128');
  await form.locator('[data-palette-slot="0"]').click();
  raw=await exportLayout(page); expect(raw.match(/Color=255,255,255,255/g)).toHaveLength(2);
  await form.locator('#group-inherit').check(); raw=await exportLayout(page); expect(raw).not.toContain('Color=');
  await form.locator('#group-inherit').uncheck(); raw=await exportLayout(page); expect(raw.match(/Color=255,255,255,255/g)).toHaveLength(2);
  await expect(form.locator('button[type="submit"]')).toHaveCount(0);
  await page.locator('[data-action="undo"]').click(); raw=await exportLayout(page); expect(raw).not.toContain('Color=');
  expect(errors).toEqual([]);
});

test("group canvas handles scale and rotate together and Escape cancels a transform", async ({ page }) => {
  const errors: string[]=[]; page.on('pageerror',(e) => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button',{name:'サンプルで始める'}).click();
  await importLayout(page,[-20,20].map((x,i) => `Id=h${i};Type=TEXTURE;Data="SquareSimple";Position=${x},0;Size=20,20`).join('\n'));
  await page.locator('[data-element="0"]').click(); await page.locator('[data-element="1"]').click({modifiers:['Control']}); await page.locator('[data-action="group"]').click();
  await page.locator('#snap').uncheck(); await page.locator('#object-snap').uncheck();
  const drag=async (kind:string, cancel=false) => {
    const handle=page.locator(`[data-group-transform="${kind}"]`).first(); await handle.scrollIntoViewIfNeeded();
    const box=(await handle.boundingBox())!; const x=box.x+box.width/2, y=box.y+box.height/2;
    const center=await page.locator('#canvas').evaluate((svg:SVGSVGElement) => {const p=new DOMPoint(0,0).matrixTransform(svg.getScreenCTM()!); return {x:p.x,y:p.y};});
    const target=kind==='scale'? {x:center.x+(x-center.x)*2,y:center.y+(y-center.y)*2} : {x:center.x+Math.hypot(x-center.x,y-center.y),y:center.y};
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(target.x,target.y,{steps:8});
    if(cancel) await page.keyboard.press('Escape'); await page.mouse.up();
  };
  await expect(page.locator('[data-group-transform="scale"]')).toHaveCount(4);
  await drag('scale'); let raw=await exportLayout(page); expect(raw.match(/Size=40,40/g)).toHaveLength(2);
  await drag('rotate'); raw=await exportLayout(page); expect(raw.match(/AngleDegrees=90/g)).toHaveLength(2);
  await drag('scale',true); expect(await exportLayout(page)).toBe(raw);
  await page.locator('[data-action="undo"]').click(); raw=await exportLayout(page); expect(raw).not.toContain('AngleDegrees=90'); expect(raw.match(/Size=40,40/g)).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("read-only group coordinates accept wheel movement with snap and fine steps without losing other edits", async ({ page }) => {
  const errors:string[]=[];page.on('pageerror',(e)=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'サンプルで始める'}).click();
  await importLayout(page,[-20,20,100].map((x,i)=>`Id=w${i};Type=TEXTURE;Data="SquareSimple";Position=${x},0;Size=20,20`).join('\n'));
  await page.locator('[data-element="0"]').click();await page.locator('[data-element="1"]').click({modifiers:['Control']});await page.locator('[data-action="group"]').click();
  const form=page.locator('#group-properties'), x=form.locator('[name="x"]'),y=form.locator('[name="y"]');
  await expect(x).toHaveAttribute('readonly','');await expect(y).toHaveAttribute('readonly','');
  await x.hover();const scroll=await page.locator('.inspector').evaluate((el)=>el.scrollTop);
  await page.mouse.wheel(0,-100);await expect(x).toHaveValue('10');
  expect(await page.locator('.inspector').evaluate((el)=>el.scrollTop)).toBe(scroll);
  await x.dispatchEvent('wheel',{deltaY:-100,shiftKey:true});await expect(x).toHaveValue('10.1');
  await y.dispatchEvent('wheel',{deltaY:100});await expect(y).toHaveValue('-10');
  await page.locator('#snap').uncheck();await x.dispatchEvent('wheel',{deltaY:100});await expect(x).toHaveValue('9.1');
  await form.locator('[name="scale"]').fill('2');await x.dispatchEvent('wheel',{deltaY:-100});await expect(x).toHaveValue('10.1');
  await form.locator('[name="rotation"]').fill('90');await expect(x).toHaveValue('10.1');
  const raw=await exportLayout(page);expect(raw.match(/Size=40,40/g)).toHaveLength(2);expect(raw).toContain('Position=100,0;Size=20,20');
  await form.locator('[name="scale"]').fill('0');await x.dispatchEvent('wheel',{deltaY:-100});await expect(x).toHaveValue('10.1');
  await form.locator('[name="scale"]').fill('1');await expect(x).toHaveValue('10.1');
  await x.dispatchEvent('wheel',{deltaY:-100,ctrlKey:true});await expect(x).toHaveValue('10.1');
  await x.dispatchEvent('wheel',{deltaY:0,deltaX:100});await expect(x).toHaveValue('10.1');
  await x.focus();await page.keyboard.press('Control+a');await page.keyboard.type('999');await expect(x).toHaveValue('10.1');
  await expect(page.locator('#group-center-marker')).toHaveAttribute('transform',/translate\(10\.1/);
  await page.locator('[data-group-lock]').click();await expect(x).toBeDisabled();
  const locked=await exportLayout(page);await x.dispatchEvent('wheel',{deltaY:-100});expect(await exportLayout(page)).toBe(locked);
  expect(errors).toEqual([]);
});

test("coordinate wheel bursts have one Undo and pauses start another history entry", async ({ page }) => {
  await page.goto('/');await page.getByRole('button',{name:'サンプルで始める'}).click();
  await page.locator('[data-element="0"]').click();await page.locator('[data-element="1"]').click({modifiers:['Control']});await page.locator('[data-action="group"]').click();
  const x=page.locator('#group-properties [name="x"]');
  await x.evaluate((el)=>{el.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}));el.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}));});
  await expect(x).toHaveValue('20');await page.locator('[data-action="undo"]').click();await page.locator('[data-group-select="0"]').click();await expect(x).toHaveValue('0');
  await x.dispatchEvent('wheel',{deltaY:-100});await page.waitForTimeout(450);await x.dispatchEvent('wheel',{deltaY:-100});await expect(x).toHaveValue('20');
  await page.locator('[data-action="undo"]').click();await page.locator('[data-group-select="0"]').click();await expect(x).toHaveValue('10');
  await page.locator('[data-action="redo"]').click();await page.locator('[data-group-select="0"]').click();await expect(x).toHaveValue('20');
});


test("zoom reaches 800 percent while resize and rotation handles keep screen size", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await page.locator('[data-visibility="1"]').click();
  await page.locator('[data-element="0"]').click();
  await page.locator('#properties [name=width]').fill("20");
  await page.locator('#properties [name=height]').fill("20");
  const resize = page.locator('[data-handle=resize][data-dx="1"][data-dy="1"]');
  for (const percent of [25, 100, 200, 800]) {
    await page.locator('#zoom').fill(String(percent));
    const box = await resize.boundingBox();
    const rotate = await page.locator('[data-handle=rotate]').boundingBox();
    expect(box!.width).toBeCloseTo(10);
    expect(box!.height).toBeCloseTo(10);
    expect(rotate!.width).toBeCloseTo(12);
    expect(rotate!.height).toBeCloseTo(12);
    const controls = await page.locator('[data-handle=resize]').evaluateAll((nodes) => nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    }));
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j];
      expect(a.right + 5 <= b.x || b.right + 5 <= a.x || a.bottom + 5 <= b.y || b.bottom + 5 <= a.y).toBeTruthy();
    }
    const frame = await page.locator('[data-sprite="0"] > rect[pointer-events="none"]').boundingBox();
    expect(frame!.y - (rotate!.y + rotate!.height)).toBeGreaterThan(10);
    await expect(page.locator('[data-sprite="0"] > rect[pointer-events="none"]')).toHaveAttribute('vector-effect', 'non-scaling-stroke');

  }
  await resize.scrollIntoViewIfNeeded();
  const box = await resize.boundingBox();
  await page.mouse.move(box!.x + 5, box!.y + 5);
  await page.mouse.down();
  await page.mouse.move(box!.x + 85, box!.y + 5);
  await page.mouse.up();
  await expect(page.locator('#properties [name=width]')).toHaveValue("30");
  await expect(page.locator('#zoom')).toHaveValue("800");
});

test("Visible thresholds add paired output dropdowns and preserve edits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDynamicsEditor(page);
  const form = page.locator("#binding-form");
  await form.locator('[name=source]').selectOption("Speed");
  await form.locator('[name=property]').selectOption("Visible");
  await expect(form.locator('[name=threshold]')).toHaveCount(0);
  await form.locator('#threshold-add').click();
  await form.locator('[name=threshold]').fill("10");
  await form.locator('[name=case]').nth(0).selectOption("false");
  await form.locator('#threshold-add').click();
  await expect(form.locator('[name=threshold]')).toHaveCount(2);
  await expect(form.locator('[name=case]')).toHaveCount(3);
  await expect(form.locator('[name=case]').nth(0)).toHaveValue("false");
  await form.locator('[data-threshold-remove="1"]').click();
  await form.locator('[name=blockName]').fill("Cockpit");
  await form.locator('[name=case]').nth(1).selectOption("true");
  await page.screenshot({ path: "test-results/visible-fields.png" });
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#dynamic-error')).toBeEmpty();
  await expect(form.locator('[name=threshold]')).toHaveValue("10");
  await expect(form.locator('[name=case]').nth(0)).toHaveValue("false");
  await form.locator('[name=source]').selectOption("Enabled");
  await expect(page.locator('#thresholds-help')).toContainText("0.5");
});

test("Data modes preserve numeric formatting and direct threshold text", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await importLayout(page, 'Id=label;Type=TEXT;Data="BASE"');
  await openDynamicsEditor(page);
  const form = page.locator("#binding-form");
  await form.locator('[name=source]').selectOption("Speed");
  await form.locator('[name=property]').selectOption("Data");
  await form.locator('[name=blockName]').fill("Ref");
  await expect(form.locator('[name=dataMode]')).toHaveValue("number");
  await expect(form.getByRole('status', { name: 'デフォルト値の内容' })).toHaveText("参照変数の現在値を表示");
  await expect(form.locator('#threshold-add')).toBeDisabled();
  await form.locator('[name=prefix]').fill("v=");
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#dynamic-error')).toBeEmpty();
  await expect(form.locator('[name=prefix]')).toHaveValue("v=");
  await form.locator('[name=dataMode]').selectOption("direct");
  await form.locator('#threshold-add').click();
  await form.locator('[name=case]').nth(0).fill("LOW");
  await expect(form.locator('[name=caseMode]')).toHaveValue("direct");
  await form.locator('[name=case]').nth(1).fill("HIGH");
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#dynamic-error')).toBeEmpty();
  await expect(form.locator('[name=dataMode]')).toHaveValue("direct");
  await expect(form.locator('[name=case]').nth(0)).toHaveValue("LOW");
  await expect(form.locator('[name=case]').nth(1)).toHaveValue("HIGH");
});

test("text Visible adds thresholds independently of the current-value Data mode", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await importLayout(page, 'Id=label;Type=TEXT;Data="BASE"');
  await openDynamicsEditor(page);
  const form = page.locator('#binding-form');
  await form.locator('[name=source]').selectOption('Speed');
  await form.locator('[name=property]').selectOption('Visible');
  await form.locator('[name=blockName]').fill('Ref');
  await form.locator('[name=case]').selectOption('false');
  await form.locator('#threshold-add').click();
  await expect(form.locator('[name=threshold]')).toHaveCount(1);
  await expect(form.locator('[name=case]').first()).toHaveValue('false');
  await form.locator('[name=case]').nth(1).selectOption('true');
  await form.locator('#threshold-add').click();
  await expect(form.locator('[name=threshold]')).toHaveCount(2);
  await expect(form.locator('[name=case]')).toHaveCount(3);
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#dynamic-error')).toBeEmpty();
  await expect(form.locator('[name=threshold]')).toHaveCount(2);
  await expect(form.locator('[name=case]').first()).toHaveValue('false');
});

test("image selection automatically adds its first threshold and preserves selected images", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプルで始める' }).click();
  await openDynamicsEditor(page);
  const form = page.locator('#binding-form');
  await form.locator('[name=source]').selectOption('Speed');
  await form.locator('[name=property]').selectOption('Data');
  await expect(form.locator('[name=dataMode]')).toHaveValue('image');
  await expect(form.locator('[name=threshold]')).toHaveCount(1);
  await expect(form.locator('[name=threshold]')).toHaveValue('10');
  await form.locator('[name=case]').first().selectOption('Circle');
  await expect(form.locator('[data-threshold-remove="0"]')).toHaveCount(0);
  await form.locator('#threshold-add').click();
  await expect(form.locator('[data-threshold-remove="1"]')).toBeVisible();
  const rows = form.locator('.switch-row');
  for (let column = 0; column < 3; column++) {
    const first = await rows.nth(0).locator(':scope > label').nth(column).boundingBox();
    const second = await rows.nth(1).locator(':scope > label').nth(column).boundingBox();
    expect(Math.abs(first!.x - second!.x)).toBeLessThan(1);
    expect(Math.abs(first!.width - second!.width)).toBeLessThan(1);
  }
  await form.locator('[data-threshold-remove="1"]').click();
  await expect(form.locator('[name=threshold]')).toHaveCount(1);
  await expect(form.locator('[data-threshold-remove="0"]')).toHaveCount(0);
  await expect(form.locator('[name=case]').first()).toHaveValue('Circle');
  await form.locator('[name=case]').nth(1).selectOption('Triangle');
  await form.locator('[name=blockName]').fill('Ref');
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#dynamic-error')).toBeEmpty();
  await expect(form.locator('[name=case]').first()).toHaveValue('Circle');
  await expect(form.locator('[name=case]').nth(1)).toHaveValue('Triangle');
});

test("text Data can select images directly, cancel conversion and undo a saved conversion", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプルで始める' }).click();
  await importLayout(page, 'Id=label;Type=TEXT;Data="BASE";Position=12,34;TextScale=2');
  await openDynamicsEditor(page);
  const form = page.locator('#binding-form');
  const chooseImage = async () => {
    await form.locator('[name=source]').selectOption('Speed');
    await form.locator('[name=property]').selectOption('Data');
    await expect(form.locator('[name=dataMode] option[value=image]')).toBeEnabled();
    await form.locator('[name=dataMode]').selectOption('image');
    await expect(form.locator('[name=threshold]')).toHaveValue('10');
    await form.locator('[name=case]').first().selectOption('Circle');
    await form.locator('[name=case]').nth(1).selectOption('Triangle');
    await form.locator('[name=blockName]').fill('Ref');
  };
  await chooseImage();
  await page.locator('#dynamics-close').click();
  await expect(page.locator('#sprite-type')).toBeChecked();
  await expect(page.locator('#properties [name=data]')).toHaveValue('BASE');
  await openDynamicsEditor(page);
  await chooseImage();
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#dynamic-error')).toBeEmpty();
  await expect(form.locator('[name=dataMode]')).toHaveValue('image');
  await expect(form.locator('[name=case]').first()).toHaveValue('Circle');
  await page.locator('#dynamics-close').click();
  await expect(page.locator('#sprite-type')).not.toBeChecked();
  await expect(page.locator('#properties [name=width]')).toHaveValue('100');
  await expect(page.locator('#properties [name=x]')).toHaveValue('12');
  await page.locator('[data-action=undo]').click();
  await page.locator('[data-layer-row="0"]').click();
  await expect(page.locator('#sprite-type')).toBeChecked();
  await expect(page.locator('#properties [name=data]')).toHaveValue('BASE');
  await expect(page.locator('#properties [name=scale]')).toHaveValue('2');
});

test("image conversion rejects incompatible text motion without changing the element", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプルで始める' }).click();
  await importLayout(page, 'Id=label;Type=TEXT;Data="BASE"');
  await openDynamicsEditor(page);
  const form = page.locator('#binding-form');
  await form.locator('[name=property]').selectOption('TextScale');
  await form.locator('button[type=submit]').click();
  await page.locator('#dynamic-new').click();
  await form.locator('[name=source]').selectOption('Speed');
  await form.locator('[name=property]').selectOption('Data');
  await form.locator('[name=dataMode]').selectOption('image');
  await form.locator('[name=blockName]').fill('Ref');
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#dynamic-error')).not.toBeEmpty();
  await page.locator('#dynamics-close').click();
  await expect(page.locator('#sprite-type')).toBeChecked();
  await expect(page.locator('#properties [name=data]')).toHaveValue('BASE');
});

test("Visible and image Data keep separate values and dropdowns across property changes", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'サンプルで始める' }).click();
  await openDynamicsEditor(page);
  const form = page.locator('#binding-form');
  await form.locator('[name=source]').selectOption('Speed');
  await form.locator('[name=property]').selectOption('Visible');
  await form.locator('[name=blockName]').fill('Ref');
  await form.locator('[name=case]').selectOption('false');
  await form.locator('#threshold-add').click();
  await form.locator('[name=case]').nth(1).selectOption('true');
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#dynamic-error')).toBeEmpty();
  await form.locator('[name=property]').selectOption('Data');
  await expect(form.locator('select[name=case]')).toHaveCount(2);
  await expect(form.locator('input[name=case]')).toHaveCount(0);
  await expect(form.locator('[name=case]').first()).toHaveValue('SquareSimple');
  await expect(form.locator('[name=case] option[value=true]')).toHaveCount(0);
  await expect(form.locator('[name=case] option[value=false]')).toHaveCount(0);
  await form.locator('[name=case]').first().selectOption('Circle');
  await form.locator('[name=case]').nth(1).selectOption('Triangle');
  await form.locator('#threshold-add').click();
  await form.locator('[name=case]').nth(2).selectOption('SquareHollow');
  await form.locator('[name=property]').selectOption('Visible');
  await expect(form.locator('[name=threshold]')).toHaveCount(1);
  await expect(form.locator('[name=case]').first()).toHaveValue('false');
  await expect(form.locator('[name=case]').nth(1)).toHaveValue('true');
  await form.locator('[name=property]').selectOption('Data');
  await expect(form.locator('select[name=case]')).toHaveCount(3);
  await expect(form.locator('input[name=case]')).toHaveCount(0);
  await expect(form.locator('[name=case]').first()).toHaveValue('Circle');
  await expect(form.locator('[name=case]').nth(1)).toHaveValue('Triangle');
  await expect(form.locator('[name=case]').nth(2)).toHaveValue('SquareHollow');
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#dynamic-error')).toBeEmpty();
  await expect(form.locator('select[name=case]')).toHaveCount(3);
});

test("binding endpoints pair each input with its output and distinguish boolean values", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDynamicsEditor(page);
  const form = page.locator("#binding-form");
  await form.locator('[name=source]').selectOption("Speed");
  await form.locator('[name=property]').selectOption("Angle");
  await form.locator('[name=inputMax]').fill("100");
  await form.locator('[name=outputMax]').fill("50");
  await expect(form.getByLabel("入力上限のときの出力（度）", { exact: true })).toHaveValue("50");
  for (const [left, right] of [["inputMin", "outputMin"], ["inputMax", "outputMax"]]) {
    const a = await form.locator(`[name=${left}]`).boundingBox();
    const b = await form.locator(`[name=${right}]`).boundingBox();
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
    expect(b!.x).toBeGreaterThan(a!.x + a!.width);
  }
  await form.locator('[name=source]').selectOption("Enabled");
  await expect(form.locator('[name=inputMin]')).toBeDisabled();
  await expect(form.getByLabel("false (0)のときの出力（度）", { exact: true })).toBeVisible();
  await expect(form.getByLabel("true (1)のときの出力（度）", { exact: true })).toHaveValue("50");
  await form.locator('[name=property]').selectOption("Color");
  await expect(form.getByLabel("false (0)のときの出力（RGBA）", { exact: true })).toBeVisible();
  await form.locator('[name=source]').selectOption("Motion");
  await expect(form.locator(".binding-map")).toBeHidden();
  await expect(form.locator('[name=outputMin]')).toBeDisabled();
});

test("Orbit and linear movement guides stay visible while scrubbing selected and shared time", async ({ page }) => {
  const project = emptyProject();
  project.blocks.push(parseSurfaceInfo(readFileSync("tests/fixtures/surface-info.ini", "utf8")));
  project.blocks[0].surfaces[0].elements = parseLayout('Id=a;Type=TEXTURE;Data="SquareSimple";Position=80,40;Size=40,40');
  project.blocks[0].surfaces[0].elements[0].motion = [
    { property: "Orbit", rate: 45, min: 0, max: 90, center: [0, 0] },
    { property: "MoveX", rate: 10, min: 0, max: 100 },
    { property: "MoveY", rate: -10, min: -50, max: 0 },
  ];
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.locator('header [data-action="open"]').click();
  await (await chooser).setFiles({ name: "guides.lcdproj", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.locator('[data-element="0"]').click();
  const guides = page.locator('[data-orbit-guide]');
  await page.locator('#selected-time-range').focus();
  await expect(guides).toHaveCount(6);
  await page.locator('#selected-time-number').fill("1");
  await expect(guides).toHaveCount(6);
  await expect(page.locator('[data-orbit-center]')).toHaveCount(0);
  await expect(page.locator('[data-motion-property="MoveX"]').last().locator('path')).toHaveAttribute('d', 'M 80 40 L 180 40');
  await expect(page.locator('[data-motion-property="MoveY"]').last().locator('path')).toHaveAttribute('d', 'M 80 40 L 80 -10');
  await expect(page.locator('[data-motion-property="MoveX"]').last().locator('text')).toContainText('100px');
  await expect(page.locator('[data-motion-property="MoveY"]').last().locator('text')).toContainText('-50px');
  await page.locator('#global-time-number').fill("2");
  await expect(guides).toHaveCount(6);
  await page.locator('[data-action="reset-scrub"]').first().click();
  await expect(guides).toHaveCount(6);
  await expect(page.locator('#properties [name=x]')).toHaveValue("80");
  await expect(page.locator('#properties [name=y]')).toHaveValue("40");
});

test("Orbit settings show live angles and canvas start/end guides without saving drafts", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "サンプルで始める" }).click();
  await openDynamicsEditor(page);
  const form = page.locator("#binding-form");
  await form.locator('[name=property]').selectOption("Orbit");
  await form.locator('[name=rate]').fill("-30");
  await form.locator('[name=initial]').fill("45");
  await form.locator('[name=min]').fill("-90");
  await form.locator('[name=max]').fill("90");
  await form.locator('[name=centerX]').fill("10");
  await form.locator('[name=centerY]').fill("20");
  const summary = page.locator("#orbit-summary");
  await expect(summary).toContainText("開始時：45°");
  await expect(summary).toContainText("変化量：-30°/秒");
  await expect(summary).toContainText("Orbitによる向きの変化：0°");
  const guides = page.locator("[data-orbit-guide]");
  await expect(guides).toHaveCount(2);
  await expect(guides.nth(0)).toHaveAttribute("data-orbit-degrees", "45");
  await expect(guides.nth(1)).toHaveAttribute("data-orbit-degrees", "-90");
  const endpoint = await guides.nth(1).locator("path").getAttribute("d");
  const coordinates = endpoint!.match(/[-\d.e+]+/g)!.map(Number);
  expect(coordinates[0]).toBe(10);
  expect(coordinates[1]).toBe(20);
  expect(coordinates[2]).toBeCloseTo(-10);
  expect(coordinates[3]).toBeCloseTo(30);
  await form.locator('[name=mode]').selectOption("Loop");
  await form.locator('[name=initial]').fill("225");
  await expect(summary).toContainText("算出不可");
  await expect(guides).toHaveCount(0);
  await form.locator('[name=initial]').fill("45");
  await expect(summary).toContainText("開始時：45°");
  await expect(guides).toHaveCount(3);
  await form.locator('[name=max]').fill("");
  await expect(summary).toContainText("算出不可");
  await expect(guides).toHaveCount(0);
  await form.locator('[name=source]').selectOption("Speed");
  await form.locator('[name=inputMin]').fill("0");
  await form.locator('[name=inputMax]').fill("100");
  await form.locator('[name=outputMin]').fill("90");
  await form.locator('[name=outputMax]').fill("-90");
  await expect(summary).toContainText("入力下限 0：90°、入力上限 100：-90°");
  await expect(guides).toHaveCount(2);
  await expect(guides.nth(0)).toHaveAttribute("data-orbit-degrees", "90");
  await expect(guides.nth(1)).toHaveAttribute("data-orbit-degrees", "-90");
  await page.locator("#dynamics-close").click();
  await expect(guides).toHaveCount(0);
  await openDynamicsEditor(page);
  await expect(page.locator(".dynamic-record")).toHaveCount(0);
});

test("Orbit center drag changes center only and supports undo and cancel", async ({ page }) => {
  const project = emptyProject();
  project.blocks.push(parseSurfaceInfo(readFileSync("tests/fixtures/surface-info.ini", "utf8")));
  project.blocks[0].surfaces[0].elements = parseLayout('Id=a;Type=TEXTURE;Data="SquareSimple";Position=80,40;Size=40,40');
  project.blocks[0].surfaces[0].elements[0].motion = [{ property: "Orbit", rate: 30, center: [0, 0] }];
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.locator('header [data-action="open"]').click();
  await (await chooser).setFiles({ name: "orbit.lcdproj", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.locator('[data-element="0"]').click();
  const marker = page.locator('[data-orbit-center="motion"]');
  await expect(marker.locator('[data-handle="orbit"]')).toHaveAttribute("fill", "transparent");
  await expect(marker).toHaveAttribute("transform", "translate(0 0)");
  const handle = await marker.locator('[data-handle="orbit"]').boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle!.x + handle!.width / 2 + 40, handle!.y + handle!.height / 2 + 20);
  await page.mouse.up();
  await expect(marker).toHaveAttribute("transform", "translate(40 20)");
  await expect(page.locator('#properties [name=x]')).toHaveValue("80");
  await page.locator('[data-action="undo"]').click();
  await page.locator('[data-element="0"]').click();
  await expect(marker).toHaveAttribute("transform", "translate(0 0)");
  await page.locator('[data-action="redo"]').click();
  await page.locator('[data-element="0"]').click();
  await expect(marker).toHaveAttribute("transform", "translate(40 20)");
  const again = await marker.locator('[data-handle="orbit"]').boundingBox();
  await page.mouse.move(again!.x + 10, again!.y + 10);
  await page.mouse.down();
  await page.mouse.move(again!.x + 50, again!.y + 30);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(marker).toHaveAttribute("transform", "translate(40 20)");

  const together = await marker.locator('[data-handle="orbit-move"]').boundingBox();
  await page.mouse.move(together!.x + 5, together!.y + 5);
  await page.mouse.down();
  await page.mouse.move(together!.x + 45, together!.y + 25);
  await page.mouse.up();
  await expect(marker).toHaveAttribute("transform", "translate(80 40)");
  await expect(page.locator('#properties [name=x]')).toHaveValue("120");
  await expect(page.locator('#properties [name=y]')).toHaveValue("60");
  const origin = await marker.locator('[data-handle="orbit"]').boundingBox();
  const centerX = origin!.x + origin!.width / 2, centerY = origin!.y + origin!.height / 2;
  await page.mouse.move(centerX + 24, centerY + 12);
  await page.mouse.down();
  await page.mouse.move(centerX - 12, centerY + 24);
  await page.mouse.up();
  await expect(marker).toHaveAttribute("transform", "translate(80 40)");
  await expect(page.locator('#properties [name=x]')).toHaveValue("60");
  await expect(page.locator('#properties [name=y]')).toHaveValue("80");
  await expect(page.locator('#properties [name=angle]')).toHaveValue("90");
  await page.locator('[data-action="undo"]').click();
  await page.locator('[data-element="0"]').click();
  await expect(page.locator('#properties [name=x]')).toHaveValue("120");
});
