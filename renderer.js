// -------------------- 初始化 --------------------
const editorTextarea = document.getElementById("editor");
const minimap = document.getElementById("minimap");
const output = document.getElementById("output");
const langSelector = document.getElementById("langSelector");
const currentLangLabel = document.getElementById("currentLang");

const editor = CodeMirror.fromTextArea(editorTextarea, {
    lineNumbers: true,
    mode: "javascript",
    theme: "default"
});

// -------------------- 语言关键字 --------------------
let languageKeywords = {
    python: ['def','self','lambda','yield','import','class','print','for','in'],
    javascript: ['function','const','let','var','console','=>','return'],
    typescript: ['interface','type','enum','implements','class'],
    java: ['public','static','void','new','class','import'],
    cpp: ['#include','std::','cout','cin','class','int'],
    go: ['func','package','import','var','type'],
    rust: ['fn','let','mut','struct','impl','use'],
    ruby: ['def','end','puts','class'],
    php: ['<?php','echo','function','$'],
    kotlin: ['fun','val','object','var','class'],
    lua: ['function','end','local'],
    bash: ['#!/bin/bash','echo','if','fi','for','done'],
    dart: ['void','final','import','class','const'],
    r: ['<-','function','library','print'],
    swift: ['func','struct','import','let','var','class'],
    html: ['<html>','<body>','<div>','<script>','<head>']
};

// -------------------- 语言检测 --------------------
function detectLanguage(code){
    if(langSelector.value !== "auto") return langSelector.value;

    let scores = {};
    for(let lang in languageKeywords){
        scores[lang] = 0;
        languageKeywords[lang].forEach(kw => {
            let re;
            if(/^[a-zA-Z0-9_]+$/.test(kw)){
                re = new RegExp('\\b'+kw+'\\b','g');
            } else {
                re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g');
            }
            scores[lang] += (code.match(re) || []).length;
        });
    }

    let best = null, max = 0;
    for(let l in scores){
        if(scores[l] > max){
            max = scores[l];
            best = l;
        }
    }

    if(max < 1) return "未知";
    return best;
}

function updateLangLabel(){
    const code = editor.getValue();
    let lang = detectLanguage(code);
    currentLangLabel.textContent = lang;
    currentLangLabel.style.color = (lang !== "未知") ? "green" : "yellow";
}

// -------------------- 小地图 --------------------
minimap.style.position = "absolute";
minimap.style.top = "5px";
minimap.style.right = "5px";
minimap.style.width = "200px";
minimap.style.background = "rgba(0,0,0,0.1)";
minimap.style.border = "1px solid rgba(150,150,150,0.3)";
minimap.style.zIndex = "998";
minimap.style.cursor = "pointer";
minimap.style.userSelect = "none";

const LINE_HEIGHT = 10;  // 小地图文字高度
const SLIDER_HEIGHT = 30; // 滑块高度
let isDragging = false;
let dragOffset = 0;

// 绘制小地图
function updateMinimap() {
    const ctx = minimap.getContext("2d");
    const lines = editor.getValue().split("\n");
    const contentHeight = lines.length * LINE_HEIGHT;

    // 小地图高度随内容增加，但不超过屏幕
    minimap.height = Math.min(contentHeight, window.innerHeight);

    ctx.clearRect(0, 0, minimap.width, minimap.height);
    ctx.font = LINE_HEIGHT + "px monospace";
    ctx.fillStyle = "rgba(212,212,212,0.7)";

    // 计算可显示的起止行
    const visibleLines = Math.ceil(minimap.height / LINE_HEIGHT);
    const scrollInfo = editor.getScrollInfo();
    const maxScrollTop = scrollInfo.height - scrollInfo.clientHeight;
    const firstLine = Math.floor(scrollInfo.top / scrollInfo.height * lines.length);

    for (let i = firstLine; i < Math.min(lines.length, firstLine + visibleLines); i++) {
        const y = (i - firstLine) * LINE_HEIGHT + LINE_HEIGHT;
        ctx.fillText(lines[i].slice(0, Math.floor(minimap.width / 8)), 2, y);
    }

    // 绘制滑块
    const sliderTop = scrollInfo.top / scrollInfo.height * minimap.height;
    ctx.fillStyle = "rgba(9,71,113,0.5)";
    ctx.fillRect(0, sliderTop, minimap.width, SLIDER_HEIGHT);
}

// -------------------- 鼠标操作 --------------------
function scrollEditorByMouse(e, offset = 0) {
    const rect = minimap.getBoundingClientRect();
    let y = e.clientY - rect.top - offset;

    if (y < 0) y = 0;
    if (y > minimap.height - SLIDER_HEIGHT) y = minimap.height - SLIDER_HEIGHT;

    const scrollInfo = editor.getScrollInfo();
    const maxScrollTop = scrollInfo.height - scrollInfo.clientHeight;
    const targetScrollTop = y / (minimap.height - SLIDER_HEIGHT) * maxScrollTop;

    editor.scrollTo(null, targetScrollTop);
}

// 点击小地图
minimap.addEventListener("mousedown", e => {
    const rect = minimap.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const scrollInfo = editor.getScrollInfo();
    const sliderTop = scrollInfo.top / scrollInfo.height * minimap.height;

    if (y >= sliderTop && y <= sliderTop + SLIDER_HEIGHT) {
        isDragging = true;
        dragOffset = y - sliderTop;
    } else {
        scrollEditorByMouse(e, SLIDER_HEIGHT / 2);
    }
});

minimap.addEventListener("mousemove", e => {
    if (isDragging) scrollEditorByMouse(e, dragOffset);
});

document.addEventListener("mouseup", () => isDragging = false);

editor.on("change", updateMinimap);
editor.on("scroll", updateMinimap);
setInterval(updateMinimap, 200);

// -------------------- 运行代码 --------------------
document.getElementById("runBtn").addEventListener("click", ()=>{
    const code = editor.getValue();
    const lang = detectLanguage(code);
    output.textContent="Running...";
    window.electronAPI.runCode(lang, code);
});
window.electronAPI.onRunResult((data)=>{ output.textContent = data; });

// -------------------- 自动括号补全 --------------------
editor.on("keypress",(cm,e)=>{
    const pairs = {"(":")","[":"]","{":"}","\"":"\"","'":"'"};
    if(pairs[e.key]){
        e.preventDefault();
        const doc = cm.getDoc();
        doc.replaceSelection(e.key+pairs[e.key]);
        doc.setCursor(cm.getCursor().line, cm.getCursor().ch-1);
    }
});

// -------------------- 智能补全 --------------------
let completionBox = document.createElement("div");
completionBox.style.position = "absolute";
completionBox.style.background = "rgba(30,30,30,0.8)";
completionBox.style.color = "#d4d4d4";
completionBox.style.border = "1px solid rgba(85,85,85,0.8)";
completionBox.style.fontFamily = "monospace";
completionBox.style.fontSize = "12px";
completionBox.style.maxHeight = "200px";
completionBox.style.overflowY = "auto";
completionBox.style.display = "block"; // 一直显示
completionBox.style.zIndex = "9999";
completionBox.style.pointerEvents = "auto";
completionBox.style.borderRadius = "4px";

editor.getWrapperElement().appendChild(completionBox);

let candidates = [], selectedIndex = 0, replaceRange = null;

function getCurrentWord(cm){
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const match = line.slice(0,cursor.ch).match(/[a-zA-Z_]+$/);
    if(!match) return { word:"", start: cursor.ch, end: cursor.ch };
    return { word: match[0], start: cursor.ch - match[0].length, end: cursor.ch };
}

function updateCompletion(){
    const cm = editor;
    const info = getCurrentWord(cm);
    const prefix = info.word;

    let lang = langSelector.value;
    if(lang==="auto") lang = detectLanguage(cm.getValue());
    const keywords = languageKeywords[lang] || [];

    candidates = keywords.filter(k=>k.toLowerCase().startsWith(prefix.toLowerCase()));
    if(candidates.length===0){
        replaceRange=null; selectedIndex=0;
    } else {
        replaceRange={ from:{line:cm.getCursor().line,ch:info.start}, to:{line:cm.getCursor().line,ch:info.end} };
        selectedIndex=0;
    }
    renderCompletion();
    moveCompletionBox();
}

function renderCompletion(){
    completionBox.innerHTML="";
    candidates.forEach((kw,i)=>{
        const item=document.createElement("div");
        item.textContent=kw;
        item.style.padding="3px 8px";
        item.style.cursor="pointer";
        if(i===selectedIndex) item.style.background="#094771";
        item.addEventListener("mousedown", e=>{ e.preventDefault(); applyCompletion(i); });
        completionBox.appendChild(item);
    });
    completionBox.style.display="block";
}

function moveCompletionBox(){
    const cursor = editor.getCursor();
    const coords = editor.cursorCoords(cursor,"page");
    completionBox.style.left=coords.left+"px";
    completionBox.style.top=coords.bottom+"px";
}

function applyCompletion(index){
    if(!candidates[index] || !replaceRange) return;
    const kw = candidates[index];
    editor.replaceRange(kw, replaceRange.from, replaceRange.to);
    editor.setCursor({line:replaceRange.from.line,ch:replaceRange.from.ch+kw.length});
    replaceRange=null;
}

// 输入或移动光标更新补全和语言检测
editor.on("inputRead",(cm,change)=>{
    if(change.origin==="+delete") return;
    updateCompletion();
    updateLangLabel();
});
editor.on("cursorActivity",()=>{
    moveCompletionBox();
    updateCompletion();
});

// 键盘控制补全
editor.on("keydown",(cm,e)=>{
    if(candidates.length===0) return;

    if(e.key==="ArrowDown"){ e.preventDefault(); selectedIndex=(selectedIndex+1)%candidates.length; renderCompletion(); return; }
    if(e.key==="ArrowUp"){ e.preventDefault(); selectedIndex=(selectedIndex-1+candidates.length)%candidates.length; renderCompletion(); return; }
    if((e.key==="Enter"||e.key==="Tab")&&!e.shiftKey){ e.preventDefault(); applyCompletion(selectedIndex); return; }
    if(e.key==="Escape"){ candidates=[]; replaceRange=null; completionBox.style.display="block"; }
});