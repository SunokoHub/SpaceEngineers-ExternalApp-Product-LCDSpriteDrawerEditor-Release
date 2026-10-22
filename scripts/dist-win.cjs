// Use the archive implementation shipped with electron-builder to keep ZIP behavior
// consistent on Windows and Linux, including its bundled compression tool.
const { build, Platform, Arch } = require("electron-builder");
const { archive } = require("app-builder-lib/out/targets/archive");
const fs = require("node:fs/promises");
const path = require("node:path");
const { constants } = require("node:fs");
const { createHash } = require("node:crypto");
const pkg = require("../package.json");
async function main() {
  const output = path.resolve(__dirname, "../release");
  const product = pkg.build.productName;
  const filename = `${product}-${pkg.version}-win.zip`;
  const destination = path.join(output, filename);
  await fs.mkdir(output, { recursive: true });
  try {
    await fs.lstat(destination);
    throw Error(
      `ZIP already exists; preserve it and review the version: ${destination}`,
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const stage = await fs.mkdtemp(path.join(output, ".zip-stage-"));
  try {
    const executable = `${product}.exe`;
    const artifacts = path.join(stage, "build");
    await build({
      targets: Platform.WINDOWS.createTarget("portable", Arch.x64),
      publish: "never",
      config: {
        directories: { output: artifacts },
        portable: { artifactName: "${productName}.exe" },
      },
    });
    const root = path.join(stage, "contents");
    const versionRoot = path.join(root, product, pkg.version);
    await fs.mkdir(versionRoot, { recursive: true });
    await fs.copyFile(path.join(artifacts, executable), path.join(versionRoot, executable));
    await fs.writeFile(
      path.join(versionRoot, "README.txt"),
      `LCD Sprite Drawer Editor ${pkg.version}

ZIPをすべて展開し、同じフォルダーの ${executable} を起動してください。
Windows x64向けです。Node.jsの導入やインストール操作は不要です。
実行環境と依存ファイルはポータブルEXEに内包されています。起動時に一時展開するため、初回起動には時間がかかることがあります。
プロジェクトは「保存」でJSONファイルに保存してください。設定と復旧データは利用者のアプリデータ領域に保持します。
ゲーム内アセットは同梱しておらず、プレビューは代替表示です。

Extract the entire ZIP and run ${executable}.
Windows x64. No Node.js installation or installer is needed.
The portable EXE contains the runtime and dependencies. Startup extracts temporary files and may take a moment.
Use Save to keep your project as a JSON file. Settings and recovery data use the user's application data directory.
Game assets are not included; the preview uses substitutes.
`,
      "utf8",
    );
    const temporary = path.join(stage, filename);
    await archive("zip", temporary, root, {
      withoutDir: true,
      compression: "normal",
    });
    // COPYFILE_EXCL also protects against another build finishing concurrently.
    await fs.copyFile(temporary, destination, constants.COPYFILE_EXCL);
    const hash = createHash("sha256")
      .update(await fs.readFile(destination))
      .digest("hex");
    console.log(`${destination}\nSHA-256: ${hash}`);
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
