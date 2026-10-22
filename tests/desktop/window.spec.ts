import { existsSync } from "node:fs";
import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
const profiles = new Map<string, string>();
const closedApps = new WeakSet<ElectronApplication>();

async function launch(output: string) {
  const directory =
    profiles.get(output) ?? mkdtempSync(path.join(tmpdir(), "lcd-desktop-"));
  profiles.set(output, directory);
  mkdirSync(output, { recursive: true });
  mkdirSync(path.join(directory, "profile"), { recursive: true });
  const bootstrap = path.join(output, "launch.cjs");
  writeFileSync(
    bootstrap,
    `const { app } = require('electron'); app.setPath('userData', ${JSON.stringify(path.join(directory, "profile"))}); require(${JSON.stringify(path.resolve("electron/main.cjs"))});`,
  );
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) env[name] = value;
  }
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    args: [bootstrap],
    env,
  });
  app.on("close", () => closedApps.add(app));
  const page = await app.firstWindow();
  await expect(page.locator("header")).toBeVisible();
  return { app, page };
}
async function stop(app: ElectronApplication) {
  if (closedApps.has(app)) return;
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => {
    setTimeout(() => app.exit(0), 100);
  });
  await closed;
}
test.afterEach(() => {
  for (const directory of profiles.values()) {
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep),
    );
    assert.ok(path.basename(directory).startsWith("lcd-desktop-"));
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
  profiles.clear();
});
async function closeWindow(app: ElectronApplication) {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
}

test("native close uses the themed dialog, keeps edits on cancel and saves before exiting", async ({}, info) => {
  const { app, page } = await launch(info.outputPath("app"));
  try {
    await expect(page.locator(".titlebar")).toHaveCSS(
      "-webkit-app-region",
      "drag",
    );
    await page.getByRole("button", { name: "サンプルで始める" }).click();
    await page.locator('[data-element="1"]').click();
    await page.locator("[name=data]").fill("DESKTOP SAVE");
    await closeWindow(app);
    await expect(page.locator("#confirm-dialog")).toBeVisible();
    await expect(
      page.locator("#confirm-dialog button[value=cancel]"),
    ).toBeFocused();
    await closeWindow(app);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("#canvas [data-sprite] text")).toHaveText("DESKTOP SAVE");
    await closeWindow(app);
    await page.getByRole("button", { name: "編集に戻る" }).click();
    await page.locator("header [data-action=settings]").click();
    await page.locator("[name=theme]").selectOption("light");
    await page.locator("#settings-form button[type=submit]").click();
    await closeWindow(app);
    await expect(page.locator("#confirm-dialog")).toHaveCSS(
      "background-color",
      "rgb(244, 247, 250)",
    );
    await page.screenshot({ path: info.outputPath("exit-light.png") });
    await app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => ({ canceled: true, filePath: "" });
    });
    await page.getByRole("button", { name: "保存して終了" }).click();
    await expect(page.locator("#confirm-dialog")).not.toBeVisible();
    await expect(page.locator("#canvas [data-sprite] text")).toHaveText("DESKTOP SAVE");
    await expect(page.locator(".status")).toContainText("保存をキャンセル");
    await app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => {
        throw Error("SAVE FAILED");
      };
    });
    await closeWindow(app);
    await page.getByRole("button", { name: "保存して終了" }).click();
    await expect(page.locator(".status")).toContainText("SAVE FAILED");
    const destination = info.outputPath("saved.lcdproj");
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async (...args: [Electron.BaseWindow, Electron.SaveDialogOptions] | [Electron.SaveDialogOptions]) => {
        const options = args.length === 2 ? args[1] : args[0];
        if (options.defaultPath !== "lcd-project.lcdproj" ||
          options.filters?.[0].extensions.join(",") !== "lcdproj")
          throw Error("Invalid project save filter");
        return { canceled: false, filePath };
      };
    }, destination);
    await closeWindow(app);
    const closed = app.waitForEvent("close");
    await page.getByRole("button", { name: "保存して終了" }).click();
    await closed;
    expect(
      JSON.parse(readFileSync(destination, "utf8")).blocks[0].surfaces[0]
        .elements[1].data,
    ).toBe("DESKTOP SAVE");
  } finally {
    await stop(app);
  }
});

test("exit without file saving retains recovery and a clean project closes directly", async ({}, info) => {
  const output = info.outputPath("app");
  const first = await launch(output);
  try {
    await first.page.getByRole("button", { name: "サンプルで始める" }).click();
    await expect
      .poll(() =>
        first.page.evaluate(() => localStorage.getItem("lcd-editor-recovery")),
      )
      .toContain("READY");
    await closeWindow(first.app);
    const closed = first.app.waitForEvent("close");
    await first.page.getByRole("button", { name: "保存せず終了" }).click();
    await closed;
  } finally {
    await stop(first.app);
  }
  const second = await launch(output);
  try {
    expect(
      await second.app.evaluate(({ app }) => app.getPath("userData")),
    ).toBe(path.join(profiles.get(output)!, "profile"));
    expect(
      await second.page.evaluate(() =>
        localStorage.getItem("lcd-editor-recovery"),
      ),
    ).toContain("READY");
    await expect(second.page.locator(".recovery")).toContainText(
      "前回の未保存",
    );
    const closed = second.app.waitForEvent("close");
    await closeWindow(second.app);
    await closed;
  } finally {
    await stop(second.app);
  }
});

test("native Motion and Binding exports save the generated files", async ({}, info) => {
  const { app, page } = await launch(info.outputPath("app"));
  try {
    const files: Record<string, string> = {
      "motion.txt": info.outputPath("motion.txt"),
      "binding.txt": info.outputPath("binding.txt"),
    };
    await app.evaluate(({ dialog }, files) => {
      dialog.showSaveDialog = async (...args: unknown[]) => ({
        canceled: false,
        filePath: files[(args.at(-1) as { defaultPath: string }).defaultPath],
      });
    }, files);
    await page.getByRole("button", { name: "サンプルで始める" }).click();
    for (const [kind, value] of [
      ["Motion", "Element=background;Property=MoveX;Rate=10"],
      [
        "Binding",
        'Element=label;Property=Data;Source=Speed;BlockName="Cockpit"',
      ],
    ] as const) {
      await page.locator("[data-element]").first().click();
      await page.locator(".selected-preview [data-action=dynamics]").click();
      await page.locator(`[data-exchange=${kind}]`).click();
      await page.locator("#input").fill(value);
      await page.locator("dialog [data-action=apply]").click();
      await page.locator("[data-element]").first().click();
      await page.locator(".selected-preview [data-action=dynamics]").click();
      await page.locator(`[data-output=${kind}]`).click();
      await page.locator("dialog [data-action=file]").click();
      const file = files[kind.toLowerCase() + ".txt"];
      await expect
        .poll(() => (existsSync(file) ? readFileSync(file, "utf8") : ""))
        .toContain(value);
      await page.locator("dialog [data-action=close]").click();
    }
    await expect(
      page.evaluate(() =>
        window.desktop!.saveDocument("not-allowed.txt", "bad"),
      ),
    ).rejects.toThrow("Invalid save request");
  } finally {
    await stop(app);
  }
});

test("native game export saves a complete INI with the matching file filter", async ({}, info) => {
  const { app, page } = await launch(info.outputPath("app"));
  try {
    const file = info.outputPath("custom-data.ini");
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async (...args: unknown[]) => {
        const options = args.at(-1) as {
          defaultPath: string;
          filters: { extensions: string[] }[];
        };
        if (
          options.defaultPath !== "custom-data.ini" ||
          options.filters[0].extensions[0] !== "ini"
        )
          throw Error("Mismatched game export format");
        return { canceled: false, filePath: file };
      };
    }, file);
    const surfaceInfo = readFileSync(
      "tests/fixtures/surface-info.ini",
      "utf8",
    );
    const text = readFileSync(
      "tests/fixtures/static-custom-data.ini",
      "utf8",
    )
      .replace(/\r\n/g, "\n")
      .replace("\n---", `\n${surfaceInfo}\n---`);
    await page.locator('header [data-action="import"]').click();
    await page.locator("#input").fill(text);
    await page.locator('#dialog [data-action="apply"]').click();
    await page.locator('[data-action="export"]').click();
    await page.locator("#custom-current").fill(text);
    await page.locator("#custom-generate").click();
    const expected = await page.locator("#custom-result").inputValue();
    await page.locator("#custom-download").click();
    await expect
      .poll(() => (existsSync(file) ? readFileSync(file, "utf8") : ""))
      .toBe(expected);
    expect(expected).toContain("Value=keep");
    expect(expected).toContain("Other owner's tail.");
  } finally {
    await stop(app);
  }
});
