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
# 找最后一个 </body>（在 </html> 之前），兼容 SVG 路径含 </body> 字符串的情况
html_end = html.index("</html>")
body_end = html.rfind("</body>", 0, html_end)

html_body = html[body_start:body_end]
print(f"\nhtml_body  : {len(html_body):>10,} 字符")

# ── 在 head 里插入 css ─────────────────────────────────────────
# index.html 用 <link rel=stylesheet href=style.css>
# 需要替换为 <style>inline_css</style>
def replace_style(content, new_css):
    # 情况1: 有内联 <style>...</style>
    m = re.search(r'<style[^>]*>(.*?)</style>', content, re.DOTALL)
    if m:
        tag = content[m.start():m.end()]
        tag_new = re.sub(r'<style[^>]*>', '<style>', tag)
        return content[:m.start()] + tag_new.replace('</style>', new_css + '\n</style>') + content[m.end():]
    # 情况2: 只有 <link rel=stylesheet href=...>
    m2 = re.search(r'<link[^>]+rel=["\']stylesheet["\'][^>]*>', content)
    if m2:
        tag_new = f'<style>\n{new_css}\n</style>'
        return content[:m2.start()] + tag_new + content[m2.end():]
    return content

html_head = replace_style(html_head, css)
print(f"合并后 head: {len(html_head):>10,} 字符")

# ── 构造输出 ─────────────────────────────────────────────────
# 策略：
#   <!DOCTYPE...><html><head>...</head><body>HTML内容
#   <script>CRANE_DATA</script>
#   <script>app.js</script>
#   </body></html>

# 去掉 body 中的 <script src=...> 引用
html_body = re.sub(r'<script[^>]+src=[^>]+></script>', '', html_body)

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

# app.js 内含内联 SVG <script>，HTML 解析器会把它们拆成独立 script 块，
# 正则无法正确配对。改用体积完整性验证。
data_len = len(data)
app_len  = len(app)
html_body_len = body_end - body_start

expected_min = len(html_head) + html_body_len + data_len + app_len
print(f"\n文件大小验证:")
print(f"  head (含内联css): {len(html_head):,} 字符")
print(f"  body             : {html_body_len:,} 字符")
print(f"  data.js          : {data_len:,} 字符")
print(f"  app.js           : {app_len:,} 字符")
print(f"  预计最小体积      : {expected_min:,} 字符")
print(f"  实际体积          : {len(v):,} 字符")
diff = len(v) - expected_min
print(f"  差值             : {diff:+,} 字符 ({'✅ 正常' if abs(diff) < 1000 else '⚠️ 检查'})")

# 关键函数存在性验证
checks = [
    ("CRANE_DATA",           "var CRANE_DATA"),
    ("secProps",             "function secProps"),
    ("getMechFormulas",      "function getMechFormulas"),
    ("drawSectionSVG",       "function drawSectionSVG"),
    ("diaociCalc",           "function diaociCalc"),
    ("findBestConfig",       "function findBestConfig"),
    ("updateMainSectionCalc","updateMainSectionCalc = function"),
]
ok = all(p in v for _,p in checks)
print(f"\n{'✅ 全部通过' if ok else '❌ 有失败'}")
for name, pat in checks:
    print(f"  {'✅' if pat in v else '❌'} {name}")

print(f"\n大小: {len(output):,} 字符 ({len(output)//1024}KB)")
