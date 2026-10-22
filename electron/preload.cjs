const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  saveDocument: (name, text) => ipcRenderer.invoke("save-document", name, text),
  closeWindow: () => ipcRenderer.send("close-window"),
  setTheme: (theme) => ipcRenderer.send("window-theme", theme),
  onCloseRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("request-close", listener);
    return () => ipcRenderer.removeListener("request-close", listener);
  },
});
