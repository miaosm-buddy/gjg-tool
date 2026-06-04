# -*- coding: utf-8 -*-
"""
37台新塔吊导入脚本 v4
"""
import openpyxl
import re

EXCEL_PATH = r'C:\Users\JG\Desktop\塔吊数据库 .xlsx'
DATA_JS_PATH = r'D:\机械选型\data.js'
OUTPUT_LOG = r'C:\Users\JG\WorkBuddy\Claw\import_log.txt'

# ============================================================
# Step 1: 读取 Excel
# ============================================================
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws_info = wb['机械基础信息']
ws_perf = wb['性能表']

# ============================================================
# Step 2: 读取 data.js 已有塔吊
# ============================================================
with open(DATA_JS_PATH, 'rb') as f:
    raw = f.read()

all_model_matches = re.findall(rb'"model": "([^"]+)"', raw)
all_datajs_models = set()
for m in all_model_matches:
    try:
        all_datajs_models.add(m.decode('utf-8'))
    except:
        pass

excel_models_set = set()
for row in ws_perf.iter_rows(min_row=2, values_only=True):
    if row[0] and not str(row[0]).startswith('='):
        excel_models_set.add(str(row[0]).strip())

existing_tower_models = set()
for model in excel_models_set:
    pos = raw.find(model.encode('utf-8'))
    if pos >= 0:
        tlc_pos = raw.find(b'tower_load_charts', pos, min(pos + 5000, len(raw)))
        if tlc_pos >= 0:
            existing_tower_models.add(model)

new_models = sorted(excel_models_set - existing_tower_models)
print("已有塔吊:", sorted(existing_tower_models))
print("新增塔吊:", new_models)

# ============================================================
# Step 3: 读取基础信息表
# ============================================================
info_by_model = {}
for row in ws_info.iter_rows(min_row=2, values_only=True):
    if not row[0]:
        continue
    model = str(row[0]).strip()
    if not model or model.startswith('='):
        continue
    info_by_model[model] = {
        'max_load_t': row[4],
        'max_arm_length': row[5],
        'min_radius': row[6],
        'max_freestand_h': row[7],
        'max_attached_h': row[8],
        'rental_fee_month': row[10],
        'entry_fee': row[11],
        'fuel_fee': row[12],
        'remark': str(row[14]) if row[14] else None,
    }

# ============================================================
# Step 4: 读取性能表
# ============================================================
perf_by_model = {}
for row in ws_perf.iter_rows(min_row=2, values_only=True):
    if not row[0] or str(row[0]).startswith('='):
        continue
    model = str(row[0]).strip()
    arm, mult, radius, load = row[1], row[2], row[3], row[4]
    if None in (arm, mult, radius, load):
        continue
    if model not in perf_by_model:
        perf_by_model[model] = {}
    if arm not in perf_by_model[model]:
        perf_by_model[model][arm] = {}
    if mult not in perf_by_model[model][arm]:
        perf_by_model[model][arm][mult] = []
    perf_by_model[model][arm][mult].append((float(radius), float(load)))

for model in perf_by_model:
    for arm in perf_by_model[model]:
        for mult in perf_by_model[model][arm]:
            perf_by_model[model][arm][mult].sort(key=lambda x: x[0])

# ============================================================
# Step 5: 推断类型
# ============================================================
def infer_crane_type(model):
    if model.startswith('M') or model.startswith('ZSL'):
        return 'tower_luffing'
    return 'tower'

def infer_sub_type(model, crane_type):
    if crane_type == 'tower_luffing':
        return '\u52a8\u81c2'   # 动臂
    return '\u5e73\u81c2'       # 平臂

def infer_brand(model):
    if model.startswith('XGT'):
        return '\u5f90\u5de5'   # 徐工
    return '\u4e2d\u8054'       # 中联

# ============================================================
# Step 6: 生成新条目
# ============================================================
new_id_start = 63
new_entries = []

for i, model in enumerate(new_models):
    crane_id = new_id_start + i
    info = info_by_model.get(model, {})
    perf = perf_by_model.get(model, {})
    crane_type = infer_crane_type(model)
    sub_type = infer_sub_type(model, crane_type)
    brand = infer_brand(model)

    # tower_load_charts
    tlc = {}
    for arm, mult_dict in perf.items():
        arm_key = str(int(arm))
        tlc[arm_key] = {}
        for mult, data_pts in mult_dict.items():
            mult_key = str(int(mult))
            tlc[arm_key][mult_key] = [{'radius': r, 'rated_load': l} for r, l in data_pts]

    entry = {
        'id': crane_id,
        'model': model,
        'brand': brand,
        'type': None,
        'crane_type': crane_type,
        'sub_type': sub_type,
        'max_load_t': info.get('max_load_t'),
        'max_arm_length': info.get('max_arm_length'),
        'min_radius': info.get('min_radius'),
        'overall_length': None,
        'overall_width': None,
        'overall_height': None,
        'total_weight_kg': None,
        'max_freestand_h': info.get('max_freestand_h'),
        'max_attached_h': info.get('max_attached_h'),
        'rental_fee_month': info.get('rental_fee_month'),
        'rental_fee_shift': None,
        'fuel_fee': info.get('fuel_fee'),
        'entry_fee': info.get('entry_fee'),
        'foundation_fee': None,
        'image': None,
        'images': [],
        'remark': info.get('remark'),
        'tower_load_charts': tlc,
    }
    new_entries.append(entry)
    print(f"  ID={crane_id} {model} ({crane_type}/{sub_type}/{brand})")

print(f"共 {len(new_entries)} 个新条目")

# ============================================================
# Step 7: 格式化 JS
# ============================================================
def fmt(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, str):
        s = v.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r')
        return f'"{s}"'
    if isinstance(v, list):
        if not v:
            return '[]'
        items = []
        for item in v:
            if isinstance(item, dict):
                pairs = ','.join(f'"{kk}": {fmt(vv)}' for kk, vv in item.items())
                items.append(f'{{{pairs}}}')
            else:
                items.append(fmt(item))
        return f'[{", ".join(items)}]'
    if isinstance(v, dict):
        if not v:
            return '{}'
        pairs = ','.join(f'"{k}": {fmt(val)}' for k, val in v.items())
        return f'{{{pairs}}}'
    if isinstance(v, (int, float)):
        return str(v)
    return f'"{v}"'

def entry_to_js_block(entry):
    lines = ['    {']
    for key in ['id', 'model', 'brand', 'type', 'crane_type', 'sub_type',
                'max_load_t', 'max_arm_length', 'min_radius',
                'overall_length', 'overall_width', 'overall_height', 'total_weight_kg',
                'max_freestand_h', 'max_attached_h',
                'rental_fee_month', 'rental_fee_shift', 'fuel_fee', 'entry_fee', 'foundation_fee',
                'image', 'images', 'remark', 'tower_load_charts']:
        v = entry.get(key)
        lines.append(f'        "{key}": {fmt(v)}')
    lines.append('    }')
    return '\n'.join(lines)

js_blocks = [entry_to_js_block(e) for e in new_entries]
new_entries_js = ',\n\n'.join(js_blocks) + '\n'

# ============================================================
# Step 8: 定位插入点（字节级精确）
# ============================================================
# 末尾结构: ...\r\n    }\r\n  ]\r\n};\r\n
# 用 rfind 找到模式 '    }\r\n  ]\r\n};' 的起始位置
# 模式中的 '    }' = 4空格 + '}'，'}' 在 idx + 4 处
idx = raw.rfind(b'    }\r\n  ]\r\n};')
last_crane_close_brace = idx + 4  # 字节位置 = 7196982
before_end = last_crane_close_brace + 1  # = 7196983

before = raw[:before_end]           # 字节 0~7196982，含 '    }'
after = raw[before_end:]            # 字节 7196983~末尾，b'\r\n  ]\r\n};\r\n'

print(f"\n文件大小: {len(raw):,} bytes")
print(f"模式起始: {idx}")
print(f"last_crane_close_brace: {last_crane_close_brace}")
print(f"before_end: {before_end}")
print(f"before 末尾10字节: {repr(before[-10:])}")
print(f"after 起始12字节: {repr(after[:12])}")

# ============================================================
# Step 9: 构建新文件
# ============================================================
# before 末尾为 '    }\r\n'（含 CRLF），替换为 '    },\n'（4空格+}+逗号+LF）
new_before_end = before[:-2] + b',\n'  # 把 '\r\n' 换成 ',\n'

# 拼接: before(含逗号换行) + LF + 新条目 + LF + after
new_file = new_before_end + b'\n' + new_entries_js.encode('utf-8') + b'\n' + after

# ============================================================
# Step 10: 保存备份（到 workspace 目录）
# ============================================================
import shutil, os
WORKSPACE = r'C:\Users\JG\WorkBuddy\2026-06-03-09-04-51'
backup_path = os.path.join(WORKSPACE, 'data.js.backup_before_import.js')
shutil.copy2(DATA_JS_PATH, backup_path)
print(f"\n备份已保存: {backup_path}")

# ============================================================
# Step 11: 写入新文件（到 workspace，由用户手动替换原文件）
# ============================================================
new_file_path = os.path.join(WORKSPACE, 'data.js.new.js')
with open(new_file_path, 'wb') as f:
    f.write(new_file)
print(f"新 data.js 已写入: {new_file_path}")

# ============================================================
# Step 12: 更新 total 字段（直接在内存 content 上操作）
# ============================================================
content = new_file.decode('utf-8', errors='replace')

old_total = 62
new_total = old_total + len(new_entries)  # 99
if f'"total": {old_total}' in content:
    content = content.replace(f'"total": {old_total}', f'"total": {new_total}', 1)
    print(f"更新 total: {old_total} -> {new_total}")
else:
    all_totals = re.findall(r'"total":\s*(\d+)', content)
    print(f"所有 total 字段: {all_totals}")

# 重新写入更新后的内容
with open(new_file_path, 'w', encoding='utf-8') as f:
    f.write(content)

# ============================================================
# Step 13: 验证
# ============================================================
with open(new_file_path, 'rb') as f:
    new_raw = f.read()

print(f"\n原始文件: {len(raw):,} bytes")
print(f"新文件: {len(new_raw):,} bytes")
print(f"新增: {len(new_raw) - len(raw):,} bytes")

success = 0
for entry in new_entries:
    if entry['model'].encode('utf-8') in new_raw:
        success += 1
    else:
        print(f"  警告: {entry['model']} 未找到!")

tlc_new = new_raw.count(b'tower_load_charts')
tlc_old = raw.count(b'tower_load_charts')
print(f"验证: {success}/{len(new_entries)} 个新条目已插入")
print(f"tower_load_charts: 旧={tlc_old}, 新={tlc_new}, 新增={tlc_new - tlc_old}")

# ============================================================
# Step 14: 写日志
# ============================================================
log_path = os.path.join(WORKSPACE, 'tower_import_log.txt')
log_lines = [f"导入时间: 2026-06-03", f"新增塔吊数量: {len(new_entries)}", f"新增塔吊型号:"]
for entry in new_entries:
    perf = perf_by_model.get(entry['model'], {})
    arms = sorted(perf.keys())
    log_lines.append(f"  ID={entry['id']} {entry['model']} ({entry['crane_type']}/{entry['sub_type']}/{entry['brand']}) arm_lengths={arms}")

with open(log_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(log_lines))
print(f"\n日志已写入: {log_path}")
print("\n=== 导入完成 ===")
print(f"\n请将 {new_file_path} 手动复制为 {DATA_JS_PATH} 以完成更新")
