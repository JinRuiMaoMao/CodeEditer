const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(createWindow);

ipcMain.handle("run-code", async (event, lang, content) => {
  return new Promise((resolve) => {
    let tmpFile;
    if(lang === "python") tmpFile = path.join(app.getPath("temp"), "tmp.py");
    else if(lang === "javascript") tmpFile = path.join(app.getPath("temp"), "tmp.js");
    else return resolve(`不支持语言: ${lang}`);
    fs.writeFileSync(tmpFile, content, "utf8");

    let cmd, args;
    if(lang === "python") { cmd="python"; args=[tmpFile]; }
    else if(lang === "javascript") { cmd="node"; args=[tmpFile]; }

    const proc = spawn(cmd, args);
    let output = "";
    proc.stdout.on("data", data => { output += data.toString(); mainWindow.webContents.send("run-result", output); });
    proc.stderr.on("data", data => { output += data.toString(); mainWindow.webContents.send("run-result", output); });
    proc.on("close", () => resolve(output));
  });
});