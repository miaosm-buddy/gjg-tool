"""
构建 index_完整离线版.html
将 index.html + style.css + app.js + data.js 合并为单一自包含文件
"""
import re, os

APP_DIR = r"D:\机械选型"
INDEX  = os.path.join(APP_DIR, "index.html")
CSS    = os.path.join(APP_DIR, "style.css")
APP    = os.path.join(APP_DIR, "app.js")
DATA   = os.path.join(APP_DIR, "data.js")
OUT    = os.path.join(APP_DIR, "index_完整离线版.html")

# ── 读取源文件 ────────────────────────────────────────────────
with open(CSS,  "r", encoding="utf-8") as f: css = f.read()
with open(APP,  "r", encoding="utf-8") as f: app = f.read()
with open(DATA, "r", encoding="utf-8") as f: data = f.read()
with open(INDEX,"r", encoding="utf-8") as f: html = f.read()

print(f"index.html : {len(html):>10,} 字符")
print(f"style.css  : {len(css):>10,} 字符")
print(f"app.js     : {len(app):>10,} 字符")
print(f"data.js    : {len(data):>10,} 字符")

# ── 提取 <head> 内容（到 </head> 前）──────────────────────────
head_end = html.index("</head>")
html_head = html[:head_end]

# ── 提取 <body> 内容 ─────────────────────────────────────────
body_start = html.index("<body")
# 找 </body> 开始
body_end_match = re.search(r'</body>', html)
body_end = body_end_match.start()

html_body = html[body_start:body_end]
print(f"\nhtml_body  : {len(html_body):>10,} 字符")

# ── 在 <style> 标签里插入 css ────────────────────────────────
# 找 <style>...</style> 并替换
def replace_style(content, new_css):
    m = re.search(r'<style[^>]*>(.*?)</style>', content, re.DOTALL)
    if m:
        tag = content[m.start():m.end()]
        tag_new = re.sub(r'<style[^>]*>', '<style>', tag)
        return content[:m.start()] + tag_new.replace('</style>', new_css + '\n</style>') + content[m.end():]
    return content

html_head = replace_style(html_head, css)
print(f"合并后 head: {len(html_head):>10,} 字符")

# ── 构造输出 ─────────────────────────────────────────────────
# 策略：
#   <!DOCTYPE...><html><head>...</head><body>HTML内容
#   <script>CRANE_DATA</script>
#   <script>app.js</script>
#   </body></html>

# 找到 body 中的 script 标签（加载 app.js 和 data.js 的）
# 先去掉现有的 <script src=...> 引用
html_body = re.sub(r'<script[^>]+src=[^>]+></script>', '', html_body)

# 也去掉 inline 的初始 script 块（如果有）
# 保留 body 本身的 HTML 内容

output = (
    html_head + "\n" +
    html_body + "\n" +
    "<script>\n" + data + "\n</script>\n" +
    "<script>\n" + app + "\n</script>\n" +
    "</body>\n</html>\n"
)

print(f"\n最终输出  : {len(output):>10,} 字符 ({len(output)//1024}KB)")

with open(OUT, "w", encoding="utf-8") as f:
    f.write(output)

print(f"\n✅ 已写入: {OUT}")

# ── 验证 ──────────────────────────────────────────────────────
with open(OUT, "r", encoding="utf-8") as f:
    v = f.read()

ss = [x.start() for x in re.finditer(r'<script', v)]
se = [x.start() for x in re.finditer(r'</script>', v)]
print(f"\n结构: <script×{len(ss)}, </script>×{len(se)}")

for i,(s,e) in enumerate(zip(ss, se)):
    gt = v.index('>', s)
    inner = v[gt+1:e]
    print(f"  Script {i}: {len(inner):>10,} 字符 | {repr(inner[:80])}")

checks = [
    ("CRANE_DATA",     "var CRANE_DATA"),
    ("secProps",       "function secProps"),
    ("getMechFormulas","function getMechFormulas"),
    ("drawSectionSVG", "function drawSectionSVG"),
    ("diaociCalc",     "function diaociCalc"),
]
ok = all(p in v for _,p in checks)
print(f"\n{'✅ 全部通过' if ok else '❌ 有失败'}")
for name, pat in checks:
    print(f"  {'✅' if pat in v else '❌'} {name}")

# 体积
print(f"\n大小: {len(output):,} 字符 ({len(output)//1024}KB)")
