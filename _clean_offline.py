"""精确清理离线版：删除第一个（旧的）app.js block"""
OFFLINE = r'D:\机械选型\index_完整离线版.html'
APPJS = r'D:\机械选型\app.js'

with open(APPJS, 'r', encoding='utf-8') as f:
    new_js = f.read()

with open(OFFLINE, 'r', encoding='utf-8') as f:
    content = f.read()

# 精确位置（从 PowerShell 验证得到）：
# 469015: </script>  (CRANE_DATA 结束，<开始)
# 469024: <script>   (旧 app.js 开始)
# 469032: <script>   (新 app.js 开始，内容同当前 app.js)
# 685811: </script>  (app.js 块结束，紧接着 </body></html>)
OLD_APPJS_START = 469024  # 旧 app.js <script> 开始（要删除）
BODY_END_POS = 685811      # body结束（</script></body></html>开始）

# 新内容：
# prefix = content[:OLD_APPJS_START]（到旧 <script> 之前，不含）
# new_block = new_js（无额外 <script> 包装，因为 app.js 本身没有开头的 <script>）
#   但离线版需要 <script>...</script> 包装！
#   所以: new_block = '<script>\n' + new_js + '\n</script>\n'
# suffix = content[BODY_END_POS:]（从 </script></body></html> 开始）

prefix = content[:OLD_APPJS_START]   # 到旧 <script> 之前
new_block = '<script>\n' + new_js + '\n</script>\n'
suffix = content[BODY_END_POS:]       # </body></html>

new_content = prefix + new_block + suffix

with open(OFFLINE, 'w', encoding='utf-8') as f:
    f.write(new_content)

# 验证
with open(OFFLINE, 'r', encoding='utf-8') as f:
    v = f.read()

occ = v.count("field === 'pos'")
has_fix = 'r.pos = val; });' in v
has_old_skip = 'if(r.is_other) { r.pos = val; return; }' in v
print("field===pos occurrences:", occ, "(should be 2)")
print("Has new fix:", has_fix)
print("Has old skip (should be False):", has_old_skip)
print("File size:", len(new_content))
print("Done!")
