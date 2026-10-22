const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { writeFile } = require("node:fs/promises");
const entry = path.join(__dirname, "../dist/index.html");
function trusted(event) {
  return (
    event.senderFrame === event.sender.mainFrame &&
    event.senderFrame.url === pathToFileURL(entry).href
  );
}
const confirmedClose = new WeakSet();
ipcMain.on("close-window", (event) => {
  if (!trusted(event)) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.webContents.session.flushStorageData();
  confirmedClose.add(win);
  win.close();
});
ipcMain.on("window-theme", (event, theme) => {
  if (!trusted(event) || !["dark", "light"].includes(theme)) return;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && process.platform === "win32")
    win.setTitleBarOverlay({
      color: theme === "light" ? "#f4f7fa" : "#18232e",
      symbolColor: theme === "light" ? "#1c3042" : "#dbe5ec",
      height: 36,
    });
});
ipcMain.handle("save-document", async (event, name, text) => {
  if (
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame.url !== pathToFileURL(entry).href ||
    ![
      "lcd-project.lcdproj",
      "layout.txt",
      "motion.txt",
      "binding.txt",
      "custom-data.ini",
    ].includes(name) ||
    typeof text !== "string" ||
    text.length > 10_000_000
  ) {
    throw new Error("Invalid save request");
  }
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    defaultPath: name,
    filters: [
      {
        name: name.endsWith("lcdproj") ? "LCD Sprite Drawer Project" : "Text",
        extensions: [path.extname(name).slice(1)],
      },
    ],
  });
  if (result.canceled || !result.filePath) return false;
  await writeFile(result.filePath, text, "utf8");
  return true;
});
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1050,
    minHeight: 700,
    backgroundColor: "#111923",
    titleBarStyle: "hidden",
    ...(process.platform === "win32"
      ? {
          titleBarOverlay: {
            color: "#18232e",
            symbolColor: "#dbe5ec",
            height: 36,
          },
        }
      : {}),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.setMenuBarVisibility(false);
  let loaded = false;
  win.webContents.once("did-finish-load", () => {
    loaded = true;
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.on("close", (event) => {
    if (confirmedClose.has(win) || !loaded || win.webContents.isCrashed())
      return;
    event.preventDefault();
    win.webContents.send("request-close");
  });
  win.loadFile(entry);
}
app.whenReady().then(() => {
  const { session } = require("electron");
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
