const fs = require("fs");
const { exec } = require("child_process");
const CodeMirror = require("codemirror");

const editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
  lineNumbers: true,
  mode: "javascript",
  theme: "default"
});

const minimap = document.getElementById('minimap');
const splitter = document.getElementById('splitter');
const editorContainer = document.getElementById('editor-container');
const output = document.getElementById('output');

let currentFile = "temp.js";

// ---------------- Minimap ----------------
function updateMinimap() {
  const ctx = minimap.getContext('2d');
  minimap.width = minimap.clientWidth;
  minimap.height = minimap.clientHeight;
  ctx.clearRect(0, 0, minimap.width, minimap.height);

  const lines = editor.getValue().split("\n");
  const lineHeight = 3;

  lines.forEach((line, i) => {
    if (i * lineHeight > minimap.height) return;
    ctx.fillStyle = "#d4d4d4";
    ctx.fillText(line.substring(0, Math.floor(minimap.width / 6)), 2, i * lineHeight);
  });
}

editor.on("change", updateMinimap);
updateMinimap();

// ------------- Splitter 拖拽 -------------
splitter.addEventListener('mousedown', e => {
  document.onmousemove = ev => {
    const newWidth = ev.clientX;
    editorContainer.style.width = `${newWidth}px`;
    updateMinimap();
  }
  document.onmouseup = () => { document.onmousemove = null; document.onmouseup = null; }
});

// --------- 语言检测 & 运行 ---------
function detectLanguage(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  switch(ext) {
    case "py": return "python";
    case "js": return "javascript";
    case "ts": return "typescript";
    case "java": return "java";
    case "c": case "cpp": return "cpp";
    case "go": return "go";
    case "rs": return "rust";
    default: return "text";
  }
}

function runCode(filename, content, outputElement) {
  const lang = detectLanguage(filename);
  let cmd;

  // 保存临时文件
  fs.writeFileSync(filename, content, "utf-8");

  switch(lang) {
    case "python":
      cmd = `python "${filename}"`; break;
    case "javascript":
      cmd = `node "${filename}"`; break;
    case "typescript":
      cmd = `tsc "${filename}" && node "${filename.replace('.ts','.js')}"`; break;
    case "java":
      cmd = `javac "${filename}" && java "${filename.replace('.java','')}"`; break;
    case "cpp":
      cmd = `g++ "${filename}" -o "${filename.replace(/\..+$/, '')}" && "${filename.replace(/\..+$/, '')}"`; break;
    case "go":
      cmd = `go run "${filename}"`; break;
    case "rust":
      cmd = `rustc "${filename}" -o "${filename.replace('.rs','')}" && "${filename.replace('.rs','')}"`; break;
    default:
      outputElement.textContent = "不支持的语言"; return;
  }

  outputElement.textContent = "Running...";
  exec(cmd, (error, stdout, stderr) => {
    if(error) outputElement.textContent = stderr || error.message;
    else outputElement.textContent = stdout;
  });
}

// ------------- Run 按钮 -------------
document.getElementById("runBtn").addEventListener("click", () => {
  runCode(currentFile, editor.getValue(), output);
});