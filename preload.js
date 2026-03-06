const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    runCode: (lang, content) => ipcRenderer.invoke("run-code", lang, content),
    onRunResult: (callback) => ipcRenderer.on("run-result", (event, data) => callback(data))
});