const editorTextarea = document.getElementById("editor");
const minimap = document.getElementById("minimap");
const output = document.getElementById("output");
const langSelector = document.getElementById("langSelector");
const currentLangLabel = document.getElementById("currentLang");

const editor = CodeMirror.fromTextArea(editorTextarea,{
    lineNumbers:true,
    mode:"javascript",
    theme:"default"
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

    if(max < 2) return "未知";
    return best;
}

function updateLangLabel(){
    const code = editor.getValue();
    let lang = detectLanguage(code);
    currentLangLabel.textContent = lang;
    currentLangLabel.style.color = (lang !== "未知") ? "green" : "yellow";
}

// -------------------- 小地图 --------------------
function updateMinimap(){
    const ctx = minimap.getContext("2d");
    minimap.width = minimap.clientWidth;
    minimap.height = minimap.clientHeight;
    ctx.clearRect(0,0,minimap.width,minimap.height);
    const lines = editor.getValue().split("\n");
    const lineHeight = 5;
    ctx.fillStyle="#d4d4d4";
    lines.forEach((line,i)=>{
        if(i*lineHeight>minimap.height) return;
        ctx.fillText(line.substring(0, Math.floor(minimap.width/8)),2,i*lineHeight);
    });
}
editor.on("change", ()=>{
    updateMinimap();
    updateLangLabel();
});
setInterval(updateMinimap,500);
setInterval(updateLangLabel,3000);

// -------------------- 运行代码 --------------------
document.getElementById("runBtn").addEventListener("click", ()=>{
    const code = editor.getValue();
    const lang = detectLanguage(code);
    output.textContent="Running...";
    window.electronAPI.runCode(lang, code);
});
window.electronAPI.onRunResult((data)=>{
    output.textContent = data;
});

// -------------------- 自动括号补全 --------------------
editor.on("keypress",(cm,e)=>{
    const pairs = {"(":")","[":"]","{":"}","\"":"\"","'":"'"};
    if(pairs[e.key]){
        e.preventDefault();
        const doc = cm.getDoc();
        doc.replaceSelection(e.key+pairs[e.key]);
        doc.setCursor(doc.getCursor().line, doc.getCursor().ch-1);
    }
});

// -------------------- 终极 Tab 补全 v2 --------------------
let completionBox = document.createElement("div");
completionBox.style.position = "absolute";
completionBox.style.background = "#1e1e1e";
completionBox.style.color = "#d4d4d4";
completionBox.style.border = "1px solid #555";
completionBox.style.padding = "2px";
completionBox.style.display = "none";
completionBox.style.zIndex = "1000";
completionBox.style.maxHeight = "200px";
completionBox.style.overflowY = "auto";
completionBox.style.fontFamily = "monospace";
completionBox.style.fontSize = "12px";
completionBox.style.whiteSpace = "nowrap";
completionBox.style.minWidth = "50px";

// 挂到 CodeMirror wrapper 内，避免被 body overflow 截断
editor.getWrapperElement().appendChild(completionBox);

let currentCandidates = [];
let selectedIndex = 0;
let replaceRange = null;

// 渲染候选列表
function renderCompletionBox(){
    completionBox.innerHTML = "";
    currentCandidates.forEach((kw,i)=>{
        const item = document.createElement("div");
        item.textContent = kw;
        item.style.padding = "2px 5px";
        item.style.cursor = "pointer";
        if(i === selectedIndex) item.style.background = "#094771";
        item.addEventListener("mousedown", (e)=>{
            e.preventDefault();
            applyCompletion(i);
        });
        completionBox.appendChild(item);
    });
    completionBox.style.display = currentCandidates.length ? "block" : "none";
    const selected = completionBox.children[selectedIndex];
    if(selected) selected.scrollIntoView({block:"nearest"});
}

// 更新弹窗位置（相对编辑器 wrapper）
function updateCompletionBox(cm){
    const cursor = cm.getCursor();
    const coords = cm.cursorCoords(cursor, "local"); // 用 local 保证相对 wrapper
    completionBox.style.left = coords.left + "px";
    completionBox.style.top = coords.bottom + "px";
}

// 应用补全
function applyCompletion(index){
    const cm = editor;
    const kw = currentCandidates[index];
    if(replaceRange){
        cm.replaceRange(kw, replaceRange.from, replaceRange.to);
        cm.setCursor({line: replaceRange.from.line, ch: replaceRange.from.ch + kw.length});
    }
    hideCompletionBox();
}

// 隐藏弹窗
function hideCompletionBox(){
    completionBox.style.display = "none";
    currentCandidates = [];
    selectedIndex = 0;
    replaceRange = null;
}

// Tab 触发补全
editor.on("keydown", (cm, e)=>{
    if(e.key === "Tab"){
        e.preventDefault();
        const cursor = cm.getCursor();
        const line = cm.getLine(cursor.line);
        const startCh = line.slice(0,cursor.ch).search(/\S+$/);
        const prefix = line.slice(startCh,cursor.ch);
        if(!prefix) return hideCompletionBox();

        const lang = detectLanguage(cm.getValue());
        const keywords = languageKeywords[lang] || [];
        currentCandidates = keywords.filter(kw => kw.toLowerCase().startsWith(prefix.toLowerCase()));
        if(currentCandidates.length === 0) return hideCompletionBox();

        selectedIndex = 0;
        replaceRange = {from:{line:cursor.line,ch:startCh},to:cursor};
        renderCompletionBox();
        updateCompletionBox(cm);

    } else if(completionBox.style.display === "block"){
        if(e.key === "ArrowDown"){
            e.preventDefault();
            selectedIndex = (selectedIndex+1) % currentCandidates.length;
            renderCompletionBox();
        } else if(e.key === "ArrowUp"){
            e.preventDefault();
            selectedIndex = (selectedIndex-1+currentCandidates.length) % currentCandidates.length;
            renderCompletionBox();
        } else if(e.key === "Enter"){
            if(replaceRange){
                e.preventDefault();
                applyCompletion(selectedIndex);
            }
        } else if(e.key === "Escape"){
            hideCompletionBox();
        }
    }
});

// 点击编辑器空白隐藏补全
editor.getWrapperElement().addEventListener("mousedown", (e)=>{
    if(e.target !== completionBox) hideCompletionBox();
});

// 编辑器滚动时让弹窗跟随
editor.on("scroll", ()=>{
    if(completionBox.style.display === "block") updateCompletionBox(editor);
});