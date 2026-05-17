"""精确修复离线版：删除旧app.js block，修复结尾"""
OFFLINE = r'D:\机械选型\index_完整离线版.html'
APPJS = r'D:\机械选型\app.js'

with open(APPJS, 'r', encoding='utf-8') as f:
    new_js = f.read()

with open(OFFLINE, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# 关键位置（从 _debug_file.py 验证得到）
# 469006: CRANE_DATA </script> 后的 \n
# 469007: 旧 app.js <script>
# 469016: 新 app.js <script>
# 685795: 新 app.js </script> (最后)
# 结尾损坏：</body></html> 被截断为 y></html>

# 截断点：旧 app.js 开始 = 469007
OLD_APPJS_START = 469007
# 新 app.js 结尾 = 685795 (最后 </script> 位置)
# 找 </body></html> 在内容中的位置
BODY_START = content.find('</body>')
if BODY_START < 0:
    BODY_START = content.find('<body')
print(f"OLD_APPJS_START: {OLD_APPJS_START}")
print(f"New app.js ends at: 685795 (last </script>)")
print(f" BODY_START: {BODY_START}")

# 新内容 = prefix(到469006) + 新app.js block + </body></html>
PREFIX_END = 469007  # 到 CRANE_DATA </script> 后的换行（含换行）

prefix = content[:PREFIX_END]   # 含 </script>，不含后续的 <script>
appjs_block = '\n<script>\n' + new_js + '\n</script>\n'
body_suffix = '\n</body></html>'

new_content = prefix + appjs_block + body_suffix

with open(OFFLINE, 'w', encoding='utf-8') as f:
    f.write(new_content)

# 验证
with open(OFFLINE, 'r', encoding='utf-8') as f:
    v = f.read()

occ = v.count("field === 'pos'")
has_fix = 'r.pos = val; });' in v
has_old_skip = 'if(r.is_other) { r.pos = val; return; }' in v
scripts = v.count('<script>')
closes = v.count('</script>')
ends_ok = v.rstrip().endswith('</html>')
print(f"\nfield===pos: {occ} (should be 2)")
print("Has fix:", has_fix)
print("Has old skip (should be False):", has_old_skip)
print(f"<script>: {scripts}, </script>: {closes}")
print("Ends with </html>:", ends_ok)
print("File size:", len(new_content))
print("\n✅ DONE!" if (has_fix and not has_old_skip and ends_ok) else "\n❌ CHECK FAILED")
