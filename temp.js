import tkinter as tk
from tkinter import ttk, filedialog, simpledialog, scrolledtext
import keyword, subprocess, re, os, tempfile, threading

root = tk.Tk()
root.title("Mini IDE v3 - 优化版")
root.geometry("1400x800")

keywords = keyword.kwlist
font_size = 12
alt_pressed = False

# ------------------------
# 最外层水平分割：文件树 | 编辑器+输出 | MiniMap
# ------------------------
h_pane = tk.PanedWindow(root, orient=tk.HORIZONTAL, sashcursor="sb_h_double_arrow")
h_pane.pack(fill="both", expand=True)

# 文件树
file_tree_frame = tk.Frame(h_pane, bg="#2b2b2b")
h_pane.add(file_tree_frame, minsize=150)
tree = ttk.Treeview(file_tree_frame)
tree.pack(fill="both", expand=True)

def populate_tree(path="."):
    tree.delete(*tree.get_children())
    for f in os.listdir(path):
        tree.insert("", "end", text=f)

populate_tree()

# 编辑器 + 输出窗口
editor_output_frame = tk.Frame(h_pane, bg="#1e1e1e")
h_pane.add(editor_output_frame, minsize=600)

# 上半部分：编辑器标签页
editor_frame = tk.Frame(editor_output_frame, bg="#1e1e1e")
editor_frame.pack(fill="both", expand=True)

tab_control = ttk.Notebook(editor_frame)
tab_control.pack(fill="both", expand=True)

tabs = {}

# 下半部分：Output 窗口
output_text = scrolledtext.ScrolledText(editor_output_frame, height=10, bg="black", fg="white", font=("Consolas", 12))
output_text.pack(fill="x", side="bottom")

# MiniMap
minimap_frame = tk.Frame(h_pane, bg="#252526")
h_pane.add(minimap_frame, minsize=200)

minimap_canvas = tk.Canvas(minimap_frame, bg="#252526", highlightthickness=0)
minimap_canvas.pack(side="left", fill="both", expand=True)
minimap_scroll = tk.Scrollbar(minimap_frame, orient="vertical", command=minimap_canvas.yview)
minimap_scroll.pack(side="right", fill="y")
minimap_canvas.config(yscrollcommand=minimap_scroll.set)

# ------------------------
# 滚动同步
# ------------------------
def sync_scroll(text, ln, *args):
    text.yview(*args)
    ln.yview(*args)
    update_minimap_view(text)

def sync_xscroll(text, *args):
    text.xview(*args)

def mouse_scroll(event, text, ln, *args):
    global alt_pressed
    speed = 5 if alt_pressed else 1
    units = int(-1 * (event.delta / 120) * speed)
    text.yview_scroll(units, "units")
    ln.yview_scroll(units, "units")
    update_minimap_view(text)
    return "break"

def alt_press(event):
    global alt_pressed
    alt_pressed = True

def alt_release(event):
    global alt_pressed
    alt_pressed = False

# ------------------------
# 行号 + 高亮（优化：延迟高亮）
# ------------------------
highlight_scheduled = False
def update_tab(text, ln, *_):
    lines = text.index("end-1c").split(".")[0]
    ln.config(state="normal")
    ln.delete("1.0", "end")
    for i in range(1, int(lines)+1):
        ln.insert("end", f"{i}\n")
    ln.config(state="disabled")
    schedule_highlight(text)
    update_status(text)
    update_minimap_view(text)

def schedule_highlight(text):
    global highlight_scheduled
    if highlight_scheduled:
        return
    highlight_scheduled = True
    root.after(100, lambda: highlight_now(text))

def highlight_now(text):
    global highlight_scheduled
    highlight_scheduled = False
    content = text.get("1.0","end")
    for tag in ["keyword","string","comment","number"]:
        text.tag_remove(tag,"1.0","end")
    text.tag_config("keyword", foreground="#569CD6")
    text.tag_config("string", foreground="#CE9178")
    text.tag_config("comment", foreground="#6A9955")
    text.tag_config("number", foreground="#B5CEA8")
    for word in keywords:
        for m in re.finditer(rf"\b{word}\b", content):
            start = f"1.0+{m.start()}c"
            end = f"1.0+{m.end()}c"
            text.tag_add("keyword", start, end)
    for m in re.finditer(r'".*?"|\'.*?\'', content):
        start = f"1.0+{m.start()}c"
        end = f"1.0+{m.end()}c"
        text.tag_add("string", start, end)
    for m in re.finditer(r"#.*", content):
        start = f"1.0+{m.start()}c"
        end = f"1.0+{m.end()}c"
        text.tag_add("comment", start, end)
    for m in re.finditer(r"\b\d+\b", content):
        start = f"1.0+{m.start()}c"
        end = f"1.0+{m.end()}c"
        text.tag_add("number", start, end)

# ------------------------
# 自动括号和缩进
# ------------------------
def auto_brackets(event, text):
    pairs = {"(":")","[":"]","{":"}","\"":"\"","'":"'"}
    if event.char in pairs:
        text.insert("insert", pairs[event.char])
        text.mark_set("insert", "insert-1c")

def auto_indent(event, text):
    line = text.get("insert linestart", "insert")
    indent = re.match(r"\s*", line).group(0)
    if line.rstrip().endswith(":"):
        indent += "    "
    text.insert("insert", "\n" + indent)
    return "break"

# ------------------------
# Ctrl+滚轮缩放字体
# ------------------------
def zoom(event, text):
    global font_size
    if event.delta > 0:
        font_size += 1
        if font_size > 72: font_size = 72
    else:
        font_size -= 1
        if font_size < 6: font_size = 6
    text.config(font=("Consolas", font_size))
    update_minimap_view(text)

# ------------------------
# 状态栏
# ------------------------
status_bar = tk.Label(root, text="Ln 1, Col 1 | Untitled", anchor="w", bg="#2b2b2b", fg="white")
status_bar.pack(side="bottom", fill="x")

def update_status(text):
    idx = text.index("insert").split(".")
    line, col = idx[0], int(idx[1])+1
    tab_name = tab_control.tab(tab_control.select(), "text")
    status_bar.config(text=f"Ln {line}, Col {col} | {tab_name}")

# ------------------------
# MiniMap（字体大，每隔几行显示）
# ------------------------
def update_minimap_view(text):
    minimap_canvas.delete("all")
    content = text.get("1.0", "end").splitlines()
    width = minimap_canvas.winfo_width()
    line_h = 12
    char_w = 8
    step = 3  # 每隔几行画一次

    for i, line in enumerate(content):
        if i % step != 0:
            continue
        display = line[:int(width/char_w)]
        for j, c in enumerate(display):
            minimap_canvas.create_text(j*char_w, i*line_h, text=c, anchor="nw", fill="#d4d4d4", font=("Consolas", 8))

    first = int(text.index("@0,0").split(".")[0])
    last = int(text.index(f"@0,{text.winfo_height()}").split(".")[0])
    minimap_canvas.create_rectangle(0, first*line_h, width, last*line_h, outline="yellow")
    minimap_canvas.config(scrollregion=minimap_canvas.bbox("all"))

# ------------------------
# 绑定事件（编辑器 <-> MiniMap 双向滚动）
# ------------------------
def bind_events(text, ln):
    text.bind("<KeyRelease>", lambda e: update_tab(text, ln))
    text.bind("<MouseWheel>", lambda e: mouse_scroll(e, text, ln))
    text.bind("<Control-MouseWheel>", lambda e: zoom(e, text))
    text.bind("<Button-1>", lambda e: update_tab(text, ln))
    root.bind_all("<Alt_L>", alt_press)
    root.bind_all("<KeyRelease-Alt_L>", alt_release)
    for c in ["(", "[", "{", '"', "'"]:
        text.bind(c, lambda e, ch=c: auto_brackets(e, text))
    text.bind("<Return>", lambda e: auto_indent(e, text))

    # 编辑器滚动同步小地图
    def editor_scroll(*args):
        text.yview(*args)
        ln.yview(*args)
        update_minimap_view(text)
        minimap_canvas.yview_moveto(text.yview()[0])

    text.config(yscrollcommand=editor_scroll)
    ln.config(yscrollcommand=editor_scroll)

    # MiniMap 拖动同步编辑器
    def drag(event):
        if minimap_canvas.winfo_height() == 0:
            return
        fraction = event.y / minimap_canvas.winfo_height()
        text.yview_moveto(fraction)
        ln.yview_moveto(fraction)
        update_minimap_view(text)

    minimap_canvas.bind("<B1-Motion>", drag)

# ------------------------
# 创建标签页
# ------------------------
def new_tab(filename="Untitled"):
    frame = tk.Frame(tab_control)
    text = tk.Text(frame, wrap="none", undo=True, bg="#1e1e1e", fg="#d4d4d4", insertbackground="white", font=("Consolas", font_size))
    text.pack(fill="both", expand=True, side="left")
    ln = tk.Text(frame, width=5, bg="#2b2b2b", fg="gray", state="disabled")
    ln.pack(side="left", fill="y")
    vsb = tk.Scrollbar(frame, command=lambda *args: sync_scroll(text, ln, *args))
    vsb.pack(side="left", fill="y")
    hsb = tk.Scrollbar(frame, orient="horizontal", command=lambda *args: sync_xscroll(text, *args))
    hsb.pack(side="bottom", fill="x")
    text.config(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
    tabs[frame] = {"text": text, "ln": ln, "vsb": vsb, "hsb": hsb, "file": None}
    tab_control.add(frame, text=filename)
    bind_events(text, ln)
    update_tab(text, ln)

new_tab()

# ------------------------
# 当前标签页
# ------------------------
def get_current_tab():
    frame = tab_control.nametowidget(tab_control.select())
    return tabs[frame]

# ------------------------
# 文件操作
# ------------------------
def open_file_dialog():
    tab = get_current_tab()
    file = filedialog.askopenfilename()
    if file:
        with open(file,"r",encoding="utf-8") as f:
            tab["text"].delete("1.0","end")
            tab["text"].insert("1.0", f.read())
        tab["file"] = file
        tab_control.tab(tab_control.select(), text=os.path.basename(file))
        update_tab(tab["text"], tab["ln"])

def save_file():
    tab = get_current_tab()
    if not tab["file"]:
        file = filedialog.asksaveasfilename(defaultextension=".py")
        if file:
            tab["file"] = file
    if tab["file"]:
        with open(tab["file"], "w", encoding="utf-8") as f:
            f.write(tab["text"].get("1.0","end"))

# ------------------------
# 运行 Python (异步输出)
# ------------------------
def run_python():
    tab = get_current_tab()
    content = tab["text"].get("1.0", "end-1c")
    output_text.delete("1.0", "end")

    if tab["file"]:
        path = tab["file"]
    else:
        tmp_path = os.path.join(tempfile.gettempdir(), "tmp_code.py")
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(content)
        path = tmp_path

    def run_in_thread():
        proc = subprocess.Popen(
            ["python", path],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        for line in proc.stdout:
            output_text.insert("end", line)
            output_text.see("end")
        proc.wait()

    threading.Thread(target=run_in_thread, daemon=True).start()

# ------------------------
# 搜索
# ------------------------
def search():
    tab = get_current_tab()
    s = simpledialog.askstring("Search", "Enter text to find:")
    if s:
        tab["text"].tag_remove("search","1.0","end")
        idx = "1.0"
        while True:
            idx = tab["text"].search(s, idx, nocase=1, stopindex="end")
            if not idx:
                break
            lastidx = f"{idx}+{len(s)}c"
            tab["text"].tag_add("search", idx, lastidx)
            idx = lastidx
        tab["text"].tag_config("search", background="yellow", foreground="black")

root.bind("<Control-f>", lambda e: search())

# ------------------------
# 菜单
# ------------------------
menu = tk.Menu(root)
root.config(menu=menu)

file_menu = tk.Menu(menu, tearoff=0)
menu.add_cascade(label="File", menu=file_menu)
file_menu.add_command(label="New Tab", command=new_tab)
file_menu.add_command(label="Open", command=open_file_dialog)
file_menu.add_command(label="Save", command=save_file)

run_menu = tk.Menu(menu, tearoff=0)
menu.add_cascade(label="Run", menu=run_menu)
run_menu.add_command(label="Run Python", command=run_python)

root.mainloop()