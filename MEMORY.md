# 机械选型 App — 项目知识库

> 缪书名 行业：钢结构工程，广州，投标方案+项目技术支持
> 最后更新：2026-06-04

---

## 一、项目概览

| 项目 | 路径 | 状态 | 说明 |
|------|------|------|------|
| 机械选型App | `D:\机械选型\` | ✅ 主力工具 | 钢结构吊装选型Web应用 |

**服务部署：**
- 服务端：`D:\机械选型\server.py`（Flask，端口5001）
- 启动（PowerShell）：`Start-Process python -ArgumentList "server.py" -WorkingDirectory "D:\机械选型" -WindowStyle Hidden`
- 访问：`http://localhost:5001`
- 主页：`index.html`（源文件，与 `index_完整离线版.html` 同步）
- 完整离线版：`index_完整离线版.html`（3.4MB，100%自包含）
- 静态资源：`style.css`、`app.js`、`app.bundled.js`、`data.js`、`crane_images/`
- **重要路由**：`/app.bundled.js` — 缺失会导致 badge 永远卡在"加载中…"（2026-07-21 修复）

---

## 二、数据文件结构

### data.js
- **变量名**：`var CRANE_DATA = ...`
- **前缀**：`var CRANE_DATA =`（`=` 后直接换行，再跟 `{`）
- **行结尾**：CRLF（`\r\n`）
- **规模**：约 7,600,502 字节，242,407 行
- **格式**：JSON，通过 `var` 声明为 JS 变量

### 机械数据规模
- **汽车吊**：44台三一汽车吊（SAC/STC系列），数据版本v2-20260430
- **塔吊**：15台（XGT/W系列），含内嵌图片
- **履带吊**：数据完整
- **租金数据**：0/44已填，全部为null待补充

### 载荷表结构
- **汽车吊/履带吊**：`load_charts[工况类型][工况说明][配重|支腿]`，三级嵌套
- **塔吊**：`tower_load_charts[臂长][倍率] = [{radius, rated_load}]`
  - 例如 XGT7020-12：`{"70":{"2":[{radius, rated_load}],"4":[{radius, rated_load}]}}`
- **5种工况**：main_boom(主臂)/super_lift(超起)/jib_boom(主副臂)/jib_superlift/jib_superlift塔式

---

## 三、核心代码文件

### app.js（源文件）
- 机械库标签切换逻辑
- 吊装选型核心算法
- 截面库面板
- 载荷表渲染

### app.bundled.js（bundle版）
- `app.js` 的打包版本，与源文件同步
- Flask 路由 `/app.bundled.js` 必须存在

### style.css
- 全局样式
- 表格列宽定义
- 塔吊表格CSS（`.tower-perf-table` / `.tower-cell` 等）
- 截面库CSS（`.sec-lib-*` 系列）

### server.py
- Flask 路由定义
- 静态文件服务
- 无缓存响应头配置

---

## 四、钢柱吊装核心算法

### 几何选型模型（`findBestConfig`）
- R = L1×cos(α)，h = L1×sin(α) + Hcrane
- L1_min = √(R² + (h_req - Hcrane)²)
- 按主臂长升序筛选，找载荷满足+高度满足的最优配置
- 效率 = 构件重量/额定载荷×100%

### 关键函数
`getCranePoints()`, `interpFast()`, `findBestConfig()`, `doSelect()`, `liftCalc()`, `autoSegment()`

### 自动分段（Phase 2，2026-07-25）
- 分段形式：`"floors-segs"`格式 → `1-1`/`1-2`/`1-3`/`2-1`/`3-1`/`auto`
- `parseSegForm(key)`：解析分段key，`isAuto`标志
- `_buildSegsByForm(formKey, FL_DATA, 1.2)`：按分段形式+楼面偏移1.2m构建所有段，超17.5m返回null
- `SEG_FORM_ORDER = ['3-1','2-1','1-1','1-2','1-3']`（少分段优先）
- `_buildSegsOptimalDP`：优先单形式贯穿全楼，全部失败才走DP混合策略
- `showAutoSegModal`：渲染分析模态框（含分段表格+摘要+应用/取消按钮）

---

## 五、塔吊性能表

### 数据结构
- `tower_load_charts[臂长][倍率] = [{radius, rated_load}]`

### Phase 1（逻辑层，2026-07-10）
- `getCraneCapacity`（~line 3755）：塔吊分支遍历所有倍率，返回最大起重量
- `renderLiftLoadChart`（~line 4648）：塔吊分支显示"70m × 2倍率/4倍率"行，默认选最大倍率
- `updateLiftTableCrane`（~line 4779）：臂长下拉框改用`tower_load_charts` keys
- 验证：70m+2倍率+28.6m→6.0t ✓，70m+4倍率+28.6m→6.5t ✓

### Phase 2（UI层，2026-07-12 新格式）
- `renderPerfTable`（~line 1349-1487）：塔吊走独立分支
- **表格格式**：行=臂长×倍率组合（臂长降序），列=各吊装半径；第一列"最大臂长(m)"，第二列"倍率"
- **不同臂长之间**加 `tower-row-sep` 分隔线
- **不外插数据**：线性插值仅在有数据的半径区间内
- **热力图颜色**：高载荷≥70%（红），中载荷35-70%（黄），低载荷<35%（蓝）
- **关键状态**：`_dCurTowerArm`（选中的臂长key），`_dCurTowerMult`（选中的倍率key）

---

## 六、截面库

### 合并（2026-06-21）
- 钢柱吊装"截面信息"卡片新增双标签：「📝 参数输入」+「📚 截面库」
- SECTION_DB全部截面（H型钢/箱型/圆管/十字柱）按分类分组卡片网格
- 每卡片含迷你SVG缩略图+名称+分类+截面积
- 点击卡片 → 详情模态（含`drawSectionSVG`工程图纸+力学参数表）
- "选用此截面" → 自动填入参数表单 + 触发updateMainSectionCalc

### 验证修复（2026-07-09）
- 问题：HM(9个)/HN(20个)/HP(4个) 共33个截面在 SECTION_DB 中定义了 type，但 `drawSectionSVG`/`updateMainSectionCalc`/`secArea` 均不支持
- 修复：HM/HN/HP → HW（几何参数完全兼容）
- 验证脚本：`_verify_section_db.py`（正则解析 app.js 的 SECTION_DB + 三个函数）
- 结果：116个截面全部通过，三个函数全覆盖

---

## 七、截面力学参数（mm单位，2026-06-22）

**app.js 显示单位：**
- Ix/Iy：`v.toLocaleString() + ' mm⁴'`
- Wx/Wy：`v.toLocaleString() + ' mm³'`
- ix/iy：`v.toFixed(2) + ' mm'`
- A：`A.toLocaleString() + ' mm²'`

**CRU十字形组合截面（两H模型）：**
- 总高 H = max(h1, b2)
- 总宽 B = max(h2, b1)
- 截面积：`h1×tw1 + 2×b1×h1 + h2×tw2 + 2×b2×h2 - tw1×tw2`
- CRU标注：红色粗虚线 H=/B=，紫色副尺寸 h1/h2/b1/b2/tf/tw

---

## 八、钢柱吊装 UI

### 行排改造（2026-07-21）
- 载荷性能表：列排→**行排**（两行：臂长配置行 + 额定起重量行）
- 吊具参数：列排→**行排**（额载行 + 吊钩重量行）
- CSS类：`.lc-row` / `.lc-row-label` / `.lc-data-item` / `.lc-data-active`

### 列宽加宽（2026-07-25）
- 截面(2列)：min→100px / max→200px
- 机械(6列)：min→110px / max→220px
- 总吊重(5列)：min→100px / max→130px
- 输入框宽：72px→88px

### 工况信息行（2026-07-25）
- 载荷性能表汽车吊/履带吊分支：新增**工况信息行**（第一行）
- 浅蓝底 + 左侧accent边框

---

## 九、塔吊图片

- Excel DISPIMG 公式存储在 `xl/cellimages.xml`，图片在 `xl/media/image{N}.png`
- 映射：`xl/_rels/cellimages.xml.rels`（rId → media）+ `xl/cellimages.xml`（DISPIMG ID → rId）
- Excel N2~N16 列 = 基础信息表图片列，对应15个塔吊型号（行2~16）
- **修正**：T7535-20HA → `image10.png`，W6513-6B → `image11.png`，W6513-8B → `image12.png`
- XGT600-25S 在 Excel 中无内嵌图片（14/15 有图片）
- 图片命名：`tower_{型号}.png`
- 路径：`D:\机械选型\crane_images\`

---

## 十、构建与部署脚本

| 脚本 | 用途 |
|------|------|
| `_build_offline.py` | 构建完整离线版 index_完整离线版.html |
| `_bundle_data.py` | 打包 data.js 为 app.bundled.js |
| `_rebuild_tower_v3.py` | 从 Excel 重建塔吊数据到 data.js |
| `_verify_section_db.py` | 验证 SECTION_DB 截面数据完整性 |
| `server.py` | Flask 服务端（端口5001）|
| `start_server.bat` | Windows 批处理快速启动 |

---

## 十一、吊装效率表核心（diaoci模块）

- `DIAOCI_EFF`：结构类型→构件类型→效率表字段键→机械类型→吨位档位→效率值
- `SEG_TYPE_EFF_KEY`：业务分段名→效率表键映射
- `segTypeToEffKey(structureType, compType, segType)`：将业务分段名转换为效率表键
  - 优先查 SEG_TYPE_EFF_KEY 映射表，找不到时回退返回 seg_type 本身
- `diaociGetEffRow(structure, comp, method)`：查找效率记录，支持 fallback 到"—"键
- **关键**：seg_type 存储的是效率表字段键（如"实腹式"/"倾斜"/"垂直"/"—"），而非业务分段名

### 效率匹配对应关系（2026-01-14）
| 结构 | 构件 | 分段选项 | 效率键 | adj |
|------|------|---------|--------|-----|
| 框架结构 | 柱（实腹式）| 一层一段/两层一段/一层两段 | →实腹式 | 1.0 |
| 框架结构 | 柱（倾斜）| 一层一段/两层一段/一层两段 | →倾斜 | 0.75 |
| 高层超高层 | 柱（垂直）| 一层一段/两层一段/一层两段 | →垂直 | 1.0 |
| 高层超高层 | 柱（倾斜）| 一层一段/两层一段/一层两段 | →倾斜 | 0.75 |
| 所有 | 主梁/次梁等 | — | →— | 各自adj |

---

## 十二、Midas模型查看器（2026-06 新增）

### 路由
- `/midas-viewer.js` → `midas-viewer.js`

### API
- `POST /api/parse_mgb` → MGB/MGT文件解析，返回 `{ members, groups, beams }`

### 功能
- 导入 `.mgt` / `.mgb` 文件 → 三维可视化（Plotly）
- 截面分布统计（自动匹配截面库）
- 构件明细清单（杆件编号/截面/长度/重量）
- 结构组高亮（点击组名高亮3D模型）
- 导出 Excel

### 解析脚本
- `_analyze_mgb2.py` ~ `_analyze_mgb9.py`（9个版本）
- `_analyze_mgb_format.py`（格式解析）
- `midas-viewer.js`（前端3D查看器，1203行）

---

## 十三、文件铁律

**直接读写原文件，禁止"新建→复制覆盖"两步流程。**

| 场景 | 正确做法 | 错误做法 |
|------|---------|---------|
| 修改现有JS | 直接Edit/Write原文件 | 先写临时文件再复制替换 |
| 修改data.js JSON | 二进制模式`rb`/`wb`，字节级精确修改 | 文本模式覆盖 |
| 构建离线版 | `_build_offline.py` 直接输出 | 中间文件覆盖 |
| 修改服务端 | 重启Flask进程 | 修改后不重启 |

**Flask文件锁定**：Flask服务运行时会持有 `data.js` 文件句柄，修改前需停止服务（PowerShell `Stop-Process python -Force`）。
