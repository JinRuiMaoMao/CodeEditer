const fs = require("fs");
const { exec } = require("child_process");
const CodeMirror = require("codemirror");

// -------------------- 编辑器初始化 --------------------
const editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
  lineNumbers: true,
  mode: "javascript",
  theme: "default"
});

const minimap = document.getElementById('minimap');
const editorContainer = document.getElementById('editor-container');
const output = document.getElementById('output');
const pluginSelector = document.getElementById("pluginSelector");
const currentLangLabel = document.getElementById("currentLang");

const initOverlay = document.getElementById('init-overlay');
const initStage = document.getElementById('init-stage');

let currentFile = "temp.py";

// -------------------- 小地图 --------------------
function updateMinimap() {
  const ctx = minimap.getContext('2d');
  minimap.width = minimap.clientWidth;
  minimap.height = minimap.clientHeight;
  ctx.clearRect(0,0,minimap.width,minimap.height);

  const lines = editor.getValue().split("\n");
  const lineHeight = minimap.height / Math.max(lines.length, 1);
  ctx.font = `${lineHeight}px monospace`;
  ctx.fillStyle="#d4d4d4";
  lines.forEach((line,i)=>{
    if(i*lineHeight>minimap.height) return;
    ctx.fillText(line.substring(0, Math.floor(minimap.width/8)),2,i*lineHeight);
  });
}
editor.on("change", updateMinimap);
window.addEventListener("resize", updateMinimap);
setInterval(updateMinimap,500);

// -------------------- 语言关键词表 --------------------
const languageKeywords = {
    python: ['def','import','class','print','for','in','self'],
    javascript: ['function','const','let','var','console','=>','return'],
    typescript: ['interface','type','enum','implements'],
    java: ['class','public','static','void','import','new'],
    cpp: ['#include','int','std::','cout','cin','class'],
    go: ['func','package','import','var','type'],
    rust: ['fn','let','mut','struct','impl','use'],
    ruby: ['def','end','class','puts'],
    php: ['<?php','echo','function','$'],
    kotlin: ['fun','val','var','class','object'],
    lua: ['function','end','local'],
    bash: ['#!/bin/bash','echo','if','fi','for','done'],
    dart: ['void','import','class','final','const'],
    r: ['<-','function','library','print'],
    swift: ['import','func','let','var','class','struct'],
    html: ['<html>','<body>','<div>','<script>','<head>']
};

// -------------------- 根据关键词检测语言 --------------------
function detectLanguageByKeywords(code){
    let scores = {};
    for(const lang in languageKeywords){
        const keywords = languageKeywords[lang];
        scores[lang] = 0;
        keywords.forEach(kw => {
            const regex = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b','g');
            scores[lang] += (code.match(regex) || []).length;
        });
    }
    let bestLang = null;
    let maxScore = 0;
    for(const lang in scores){
        if(scores[lang] > maxScore){
            maxScore = scores[lang];
            bestLang = lang;
        }
    }
    return bestLang; // 匹配失败返回 null
}

// -------------------- 更新右上角语言显示 --------------------
function updateCurrentLang(detectedLang=null){
    if(pluginSelector.value !== "auto"){
        currentLangLabel.style.display = "none"; // 手动选择语言隐藏
        return;
    }

    currentLangLabel.style.display = "inline";
    if(detectedLang){
        currentLangLabel.textContent = detectedLang.charAt(0).toUpperCase() + detectedLang.slice(1);
        currentLangLabel.style.color = "#569CD6"; // 蓝色
    } else {
        currentLangLabel.textContent = "检测失败";
        currentLangLabel.style.color = "red";
    }
}

// -------------------- 编辑器内容实时检测 --------------------
editor.on("change", () => {
    if(pluginSelector.value === "auto"){
        const code = editor.getValue();
        const detectedLang = detectLanguageByKeywords(code);
        updateCurrentLang(detectedLang);
    }
    updateMinimap();
});

// -------------------- 输出区上下可拉伸 --------------------
let isDragging = false;
output.style.cursor = "ns-resize";
output.addEventListener("mousedown", e=>{
    isDragging = true;
    document.body.style.userSelect = "none";
});
document.addEventListener("mousemove", e=>{
    if(!isDragging) return;
    let newHeight = window.innerHeight - e.clientY;
    if(newHeight < 80) newHeight = 80;
    if(newHeight > window.innerHeight*0.5) newHeight = window.innerHeight*0.5;
    output.style.height = `${newHeight}px`;
});
document.addEventListener("mouseup", ()=>{
    isDragging = false;
    document.body.style.userSelect = "auto";
});

// -------------------- 初始化覆盖层 --------------------
function showInitOverlay() { initOverlay.classList.remove('hidden'); }
function hideInitOverlay() { initOverlay.classList.add('hidden'); }

async function initializeEditor(lang){
    showInitOverlay();

    const code = editor.getValue();

    // 自动模式：用关键词检测语言
    if(pluginSelector.value === "auto"){
        const detectedLang = detectLanguageByKeywords(code);
        lang = detectedLang || 'text';
        updateCurrentLang(detectedLang);
    } else {
        updateCurrentLang(null); // 手动隐藏
    }

    try {
        initStage.textContent = "保存内容中...";
        const projectId = currentFile || 'default';
        localStorage.setItem('autosave_' + projectId, code);

        initStage.textContent = "重置高亮中...";
        editor.setOption('mode', lang);
        editor.refresh();

        initStage.textContent = "更新界面...";
        updateMinimap();
    } catch(e){
        console.error("初始化失败：", e);
    } finally {
        hideInitOverlay();
    }
}

// -------------------- 语言切换 --------------------
pluginSelector.addEventListener("change", () => {
    initializeEditor(pluginSelector.value === "auto" ? null : pluginSelector.value);
});

// -------------------- 运行代码 --------------------
function runCode(filename, content, lang){
    let cmd;
    fs.writeFileSync(filename, content,"utf-8");

    switch(lang){
        case "python": cmd=`python "${filename}"`; break;
        case "javascript": cmd=`node "${filename}"`; break;
        case "typescript": cmd=`tsc "${filename}" && node "${filename.replace(".ts",".js")}"`; break;
        case "java": cmd=`javac "${filename}" && java "${filename.replace(".java","")}"`; break;
        case "cpp": cmd=`g++ "${filename}" -o "${filename.replace(/\..+$/,"")}" && "${filename.replace(/\..+$/,"")}"`; break;
        case "go": cmd=`go run "${filename}"`; break;
        case "rust": cmd=`rustc "${filename}" -o "${filename.replace(".rs","")}" && "${filename.replace(".rs","")}"`; break;
        case "ruby": cmd=`ruby "${filename}"`; break;
        case "php": cmd=`php "${filename}"`; break;
        case "kotlin": cmd=`kotlinc "${filename}" -include-runtime -d temp.jar && java -jar temp.jar`; break;
        case "lua": cmd=`lua "${filename}"`; break;
        case "bash": cmd=`bash "${filename}"`; break;
        case "dart": cmd=`dart "${filename}"`; break;
        case "r": cmd=`Rscript "${filename}"`; break;
        case "swift": cmd=`swift "${filename}"`; break;
        case "html": cmd=`start "" "${filename}"`; break;
        default: output.textContent="不支持的语言"; return;
    }

    output.textContent="Running...";
    exec(cmd,(error,stdout,stderr)=>{
        if(error) output.textContent = stderr||error.message;
        else output.textContent = stdout;
    });
}

// -------------------- Run 按钮 --------------------
document.getElementById("runBtn").addEventListener("click",()=>{
    const code = editor.getValue();
    const lang = pluginSelector.value === "auto" ? detectLanguageByKeywords(code) : pluginSelector.value;
    updateCurrentLang(lang);
    runCode(currentFile, code, lang || 'text');
});

// -------------------- 首次初始化 --------------------
window.addEventListener("DOMContentLoaded", () => {
    const lang = pluginSelector.value === "auto" ? detectLanguageByKeywords(editor.getValue()) : pluginSelector.value;
    initializeEditor(lang);
});