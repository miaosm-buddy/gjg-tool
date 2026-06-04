/* ============================================================
   Midas MGT 3D 查看器 — 独立模块（无命名冲突）
   集成到 钢结构方案辅助工具
   所有全局变量/函数均以 midas_ 前缀隔离
   ============================================================ */

/* ---- 全局状态 ---- */
let midas_elements = [];
let midas_nodeMap = {};
let midas_nodes = [];
let midas_sectionNames = {};
let midas_groupNames = {};
let midas_hasWeight = false;
let midas_resizeTimer = null;
let midas_roInstance = null;
let midas_weightUnit = 'kg';   // 'kg' 或 't'
let midas_totalWeight = 0;     // 缓存总重量供单位切换用
let midas_highlightedGroupId = null;  // 当前高亮的组ID（null=无高亮）

/* ---- 颜色板 ---- */
const midas_palette = [
  '#4a90d9','#e8853a','#48bb78','#fc5c65','#8855d9',
  '#d953a0','#2db5c4','#d4a017','#26a69a','#e74c3c',
  '#5c6bc0','#7cb342','#f5a623','#2e9ad0','#ab47bc',
  '#00897b','#ef6c00','#78909c','#c43ba8','#4db6ac'
];

/* ============================================================
   1. 截面库对接接口 — 联动 app.bundled.js 中的 SECTION_DB
   ============================================================
   优先级：
     ① 精确匹配 code（如 "H300×200×8×12"）
     ② 标准化后再精确匹配（忽略全/半角、空格）
     ③ 模糊匹配：从截面名称中提取 H×B×tw×tf 参数后与 DB 对比
     ④ 均无法匹配时返回 null（保持原有 "待接截面库" 显示）
   线重计算：复用 secWeight() / secArea() 函数（来自 app.bundled.js）
   ============================================================ */

/**
 * 规范化截面名称，统一分隔符为 ×，去除多余空格及装饰符号
 * 例：H300x200x8x12 → H300×200×8×12
 *     ◆◆450x28 → 450×28
 */
function midas_normSecName(name) {
  if (!name) return '';
  return name.trim()
    .replace(/\s+/g, '')                        // 去空格
    .replace(/[xX＊✕]/g, '×')                  // 统一乘号（含小写x）
    .replace(/[×]{2,}/g, '×')                  // 去重复
    .replace(/（/g, '(').replace(/）/g, ')')   // 全角括号
    .replace(/。/g, '.').replace(/，/g, ',')    // 全角标点
    .replace(/^[◆◇◊◈ΦφØ●○◉◎]+/, '')          // 剥离Midas装饰符号前缀（菱形、圆形等）
    .replace(/^[PpCc](\d)/, '$1');              // 剥离P/C圆管前缀（保留数字），如 P114×6 → 114×6
}

/**
 * 从截面名称中尝试解析 H×B×tw×tf 数值（适用 H型钢）
 * 支持：H300×200×8×12 / H-300×200×8×12 / 300×200×8×12 等格式
 */
function midas_parseHSecParams(name) {
  if (!name) return null;
  var n = midas_normSecName(name).replace(/^[HhWwNnMmPp\-]+/, ''); // 去前缀
  var parts = n.split('×').map(parseFloat).filter(function(v){ return !isNaN(v); });
  if (parts.length === 4) {
    return { H: parts[0], B: parts[1], tw: parts[2], tf: parts[3] };
  }
  return null;
}

/**
 * 从截面名称中尝试解析 □B×H×t（箱型）
 */
function midas_parseBoxSecParams(name) {
  if (!name) return null;
  var n = midas_normSecName(name).replace(/^[□▢Bb]+/, '');
  var parts = n.split('×').map(parseFloat).filter(function(v){ return !isNaN(v); });
  if (parts.length >= 3) {
    return { B: parts[0], H: parts[1], t1: parts[2], t2: parts[3] || parts[2] };
  }
  return null;
}

/**
 * 从截面名称中尝试解析 Φ/φ D×t（圆管）
 * 支持多种前缀符号：Φ φ Ø ◆◇◊◈ 等，以及小写 x 分隔符
 */
function midas_parseCHSSecParams(name) {
  if (!name) return null;
  // 先标准化：统一乘号、去掉圆管类前缀符号（含 Midas 输出的 ◆◇◊◈ 等）
  var n = midas_normSecName(name)
    .replace(/^[ΦφØPpCc\-]+/, '')   // 去掉 Φ/φ/Ø/P/C 前缀
    .replace(/^[◆◇◊◈]+/, '');       // 去掉 Midas 输出的装饰符号前缀
  var parts = n.split(/[×\-]/).map(parseFloat).filter(function(v){ return !isNaN(v); });
  if (parts.length >= 2) {
    return { D: parts[0], t: parts[1] };
  }
  // 只有一个数字：可能是外径，壁厚未知
  return null;
}

/**
 * 核心接口：根据截面名称在 SECTION_DB（+用户库）中查找线重 (kg/m)
 * @param {number}  sectionId    - MGT 中截面编号（备用）
 * @param {string}  sectionName  - MGT 中截面名称，如 "H300×200×8×12"
 * @returns {number|null}        - 线重 kg/m；无法匹配时返回 null
 */
function midas_connectToSectionLib(sectionId, sectionName) {
  // ── 前置检查：依赖函数是否已加载 ──
  if (typeof secWeight !== 'function' || typeof spLibGetAll !== 'function') {
    return null;
  }

  var name = (sectionName || '').trim();
  if (!name) return null;

  var all = spLibGetAll(); // SECTION_DB + 用户自定义截面

  // ① 精确匹配 code
  for (var i = 0; i < all.length; i++) {
    if (all[i].code === name) {
      return secWeight(all[i]);
    }
  }

  // ② 标准化后精确匹配
  var normName = midas_normSecName(name);
  for (var i = 0; i < all.length; i++) {
    if (midas_normSecName(all[i].code) === normName) {
      return secWeight(all[i]);
    }
  }

  // ②-b 截面名称进一步剥离后精确匹配（针对Midas特殊符号）
  // 截面库中 Ø450×28 经 normSecName 后为 "450×28"
  // Midas输出 ◆◆450x28 经 normSecName 后也为 "450×28" — 二者已可直接匹配
  // 但为防仍有未剥离干净的前缀，再做一次兜底
  var strippedName = normName.replace(/^[◆◇◊◈ΦφØ●○◉◎PpCc\-]+/, '').replace(/^(\d)/, '$1');
  if (strippedName !== normName) {
    for (var i = 0; i < all.length; i++) {
      if (midas_normSecName(all[i].code) === strippedName) {
        return secWeight(all[i]);
      }
    }
  }

  // ③ H型钢模糊匹配（允许 HW/HM/HN/HP 混淆，按 H×B×tw×tf 参数匹配）
  if (/^[HhWwNnMmPp]/i.test(name) || /^\d{2,4}×\d{2,4}/.test(normName)) {
    var p = midas_parseHSecParams(name);
    if (p) {
      var bestSec = null;
      for (var i = 0; i < all.length; i++) {
        var s = all[i];
        if ((s.type==='HW'||s.type==='HM'||s.type==='HN'||s.type==='HP') &&
            s.H === p.H && s.B === p.B && s.tw === p.tw && s.tf === p.tf) {
          bestSec = s;
          break;
        }
      }
      if (bestSec) return secWeight(bestSec);

      // ③-b H×B 容差匹配（tw/tf 不同，H+B 相同 → 取最接近的）
      var bestDiff = Infinity, bestSec2 = null;
      for (var i = 0; i < all.length; i++) {
        var s = all[i];
        if ((s.type==='HW'||s.type==='HM'||s.type==='HN'||s.type==='HP') &&
            s.H === p.H && s.B === p.B) {
          var diff = Math.abs(s.tw - p.tw) + Math.abs(s.tf - p.tf);
          if (diff < bestDiff) { bestDiff = diff; bestSec2 = s; }
        }
      }
      if (bestSec2 && bestDiff <= 4) return secWeight(bestSec2);

      // ③-c 仅靠参数构造虚拟截面计算线重（DB 中无该型号但参数完整）
      if (p.H > 0 && p.B > 0 && p.tw > 0 && p.tf > 0) {
        var virtualSec = { type:'HN', H:p.H, B:p.B, tw:p.tw, tf:p.tf };
        return secWeight(virtualSec);
      }
    }
  }

  // ④ 箱型截面模糊匹配
  if (/^[□▢Bb]/i.test(name) || /^□/.test(name)) {
    var p = midas_parseBoxSecParams(name);
    if (p && p.H > 0 && p.B > 0 && p.t1 > 0) {
      // 先查 DB
      for (var i = 0; i < all.length; i++) {
        var s = all[i];
        if (s.type==='BOX' && s.H===p.H && s.B===p.B &&
           (s.t1===p.t1 || s.t===p.t1)) {
          return secWeight(s);
        }
      }
      // 直接用参数计算
      var virtualSec = { type:'BOX', H:p.H, B:p.B, t1:p.t1, t2:p.t2, t:p.t1 };
      return secWeight(virtualSec);
    }
  }

  // ⑤ 圆管截面模糊匹配
  // 扩展正则：支持 Φ/φ/Ø/◆/◇/◊/◈ 前缀，以及纯数字格式
  if (/^[ΦφØPpCc◆◇◊◈]/i.test(name) || /^\d{2,4}[×\-]\d{1,3}$/.test(normName)) {
    var p = midas_parseCHSSecParams(name);
    if (p && p.D > 0 && p.t > 0) {
      for (var i = 0; i < all.length; i++) {
        var s = all[i];
        if (s.type==='CHS' && s.D===p.D && s.t===p.t) {
          return secWeight(s);
        }
      }
      var virtualSec = { type:'CHS', D:p.D, t:p.t };
      return secWeight(virtualSec);
    }
  }

  // 无法匹配
  return null;
}

/* ============================================================
   1-b. MGT 编码智能检测与解码
   MGT 文件通常由 Midas Gen (韩国/中国版) 导出，编码为 GBK/GB2312/EUC-KR。
   浏览器 FileReader 默认 UTF-8 会导致中文乱码（组名、截面名前缀符号等）。
   ============================================================ */
function midas_decodeMGT(buffer, fileName) {
  // 尝试顺序：GBK → GB2312 → EUC-KR → UTF-8 → Latin-1（兜底）
  var encodings = ['gbk', 'gb2312', 'euc-kr', 'utf-8', 'windows-1252'];
  var bestText = '';
  var bestScore = -1;

  for (var i = 0; i < encodings.length; i++) {
    try {
      var decoder = new TextDecoder(encodings[i], { fatal: false });
      var text = decoder.decode(buffer);

      // 评分：检查中文字符密度、关键标识符完整性
      var score = midas_scoreEncoding(text);

      if (score > bestScore) {
        bestScore = score;
        bestText = text;
      }

      // 如果评分已经很高（>90），不再尝试更多编码
      if (score > 90) break;
    } catch(e) {
      // TextDecoder 不支持的编码（如老旧浏览器无 GBK），跳过
      continue;
    }
  }

  // 如果所有编码都失败，用最基本的 Latin-1 兜底
  if (!bestText) {
    try {
      bestText = new TextDecoder('windows-1252').decode(buffer);
    } catch(e2) {
      bestText = new TextDecoder('utf-8').decode(buffer);
    }
  }

  console.log('🔤 MGT 编码检测 | 文件名: ' + fileName +
    ' | 评分: ' + bestScore +
    ' | 大小: ' + (buffer.byteLength/1024).toFixed(1) + ' KB');
  return bestText;
}

/** 评分函数：检测文本中有效中文/韩文内容的密度 */
function midas_scoreEncoding(text) {
  var score = 0;
  // 1. 关键数据块标识完整性（MGT 必须有 *NODE, *ELEMENT, *SECTION 等）
  var markers = ['*NODE', '*ELEMENT', '*SECTION', '*MATERIAL'];
  for (var i = 0; i < markers.length; i++) {
    if (text.indexOf(markers[i]) !== -1) score += 20;
  }

  // 2. 中文字符密度（GBK/GB2312 解码正确时会有大量中文）
  var chineseCount = 0;
  var totalChars = Math.min(text.length, 5000); // 采样前5000字符
  for (var j = 0; j < totalChars; j++) {
    var code = text.charCodeAt(j);
    // 中文字符范围：CJK统一表意文字 (0x4E00-0x9FFF)、扩展A (0x3400-0x4DBF)
    if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF)) {
      chineseCount++;
    }
  }
  var chineseRatio = chineseCount / Math.max(totalChars, 1);
  // 中文占比合理区间：2%-20%（太多或太少都可能是乱码）
  if (chineseRatio >= 0.02 && chineseRatio <= 0.30) {
    score += 15;
  } else if (chineseRatio > 0) {
    score += 5;
  }

  // 3. 特殊字符检测：过多乱码符号（如连续 � □ 等）会扣分
  var replacementChars = (text.match(/\uFFFD/g) || []).length; // � U+FFFD
  if (replacementChars > 0) score -= replacementChars * 3;

  // 4. 检测 *GROUP 块的组名是否为有效中文（而非乱码 □□□）
  var groupIdx = text.indexOf('*GROUP');
  if (groupIdx !== -1) {
    var groupSection = text.substring(groupIdx, Math.min(groupIdx + 2000, text.length));
    // 如果组名区域有连续3个以上相同字符（乱码特征），扣分
    if (/(.)\1{4,}/.test(groupSection)) score -= 10;
    if (/\u25A1{2,}/.test(groupSection)) score -= 10; // □ 连续出现
  }

  return Math.max(score, 0);
}
function midas_parseMGT(text) {
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');

  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const u = lines[i].trim().toUpperCase();
    if (!u.startsWith('*') || u.startsWith('**')) continue;
    blocks.push({ line: i, name: u });
  }

  function getBlock(name) {
    for (let b = 0; b < blocks.length; b++) {
      const bn = blocks[b].name;
      if (bn === name || (bn.startsWith(name) && (bn.length === name.length || bn[name.length] !== '_'))) {
        const s = blocks[b].line + 1;
        const e = (b + 1 < blocks.length) ? blocks[b + 1].line : lines.length;
        return { start: s, end: e };
      }
    }
    return null;
  }

  const nodeBlk = getBlock('*NODE');
  const elemBlk = getBlock('*ELEMENT');
  const sectBlk = getBlock('*SECTION');
  const groupBlk = getBlock('*GROUP');           // 组名称定义
  const groupAsgnBlk = getBlock('*GROUP_ASSIGN'); // 杆件→组映射
  const elemGroupBlk = getBlock('*ELEMENT_GROUP');// 备选：杆件→组映射

  /* 截面名称 */
  const sectionNames = {};
  if (sectBlk) {
    for (let i = sectBlk.start; i < sectBlk.end; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) continue;
      const cp = line.split(',').map(p => p.trim());
      if (cp.length >= 3) {
        const sid = parseInt(cp[0], 10);
        let nm = (cp[2] || '').replace(/^['"]|['"]$/g, '');
        if (!isNaN(sid) && nm) sectionNames[sid] = nm;
      }
    }
  }

  /* 组名称 */
  const groupNames = {};
  if (groupBlk) {
    for (let i = groupBlk.start; i < groupBlk.end; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) continue;
      const cp = line.split(',').map(p => p.trim());
      if (cp.length >= 2) {
        const gid = parseInt(cp[0], 10);
        let gname = (cp[1] || '').replace(/^['"]|['"]$/g, '');
        if (!isNaN(gid) && gname) groupNames[gid] = gname;
      }
    }
  }

  /* 杆件→组映射（支持多种块名） */
  const elemGroupMap = {};
  const asgnBlk = groupAsgnBlk || elemGroupBlk;
  if (asgnBlk) {
    for (let i = asgnBlk.start; i < asgnBlk.end; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) continue;
      // 格式：杆件号,组号 或 组号,杆件号
      const cp = line.split(',').map(p => p.trim());
      if (cp.length >= 2) {
        const a = parseInt(cp[0], 10);
        const b = parseInt(cp[1], 10);
        if (!isNaN(a) && !isNaN(b)) {
          // 判断方向：如果a在groupNames中存在则为"组号,杆件号"
          // 否则为"杆件号,组号"
          if (groupNames[a] !== undefined) {
            elemGroupMap[b] = a;
          } else {
            elemGroupMap[a] = b;
          }
        }
      }
    }
  }

  /* 节点 */
  const nodes = [];
  const nodeMap = {};
  if (nodeBlk) {
    for (let i = nodeBlk.start; i < nodeBlk.end; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) continue;
      const parts = line.split(/[,\s]+/).filter(Boolean);
      if (parts.length >= 4) {
        const nid = parseInt(parts[0], 10);
        const x = parseFloat(parts[1]), y = parseFloat(parts[2]), z = parseFloat(parts[3]);
        if (!isNaN(nid) && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
          nodes.push({ id:nid, x, y, z });
          nodeMap[nid] = { x, y, z };
        }
      }
    }
  }

  /* 杆件 */
  const elements = [];
  const rawSections = [];
  if (elemBlk) {
    for (let i = elemBlk.start; i < elemBlk.end; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) continue;

      const cp = line.split(',').map(p => p.trim());
      if (cp.length >= 6) {
        const id = parseInt(cp[0], 10);
        if (!isNaN(id)) {
          const sec = parseInt(cp[3], 10);
          const n1  = parseInt(cp[4], 10);
          const n2  = parseInt(cp[5], 10);
          if (!isNaN(sec) && !isNaN(n1) && !isNaN(n2)) {
            // 尝试读取第7列（可能是组ID/材料号）
            var grpId = null;
            if (cp.length >= 7) {
              var maybeGid = parseInt(cp[6], 10);
              if (!isNaN(maybeGid) && maybeGid > 0) grpId = maybeGid;
            }
            // 如果ELEMENT行没有组ID，尝试从GROUP_ASSIGN获取
            if (grpId === null && elemGroupMap[id] !== undefined) {
              grpId = elemGroupMap[id];
            }
            elements.push({ id, type: cp[1]||'?', section: sec, n1, n2, groupId: grpId });
            rawSections.push(sec);
            continue;
          }
        }
      }

      const parts = line.split(/[,\s]+/).filter(Boolean);
      if (parts.length >= 6) {
        const id = parseInt(parts[0], 10);
        if (!isNaN(id)) {
          const sec = parseInt(parts[3], 10);
          const n1  = parseInt(parts[4], 10);
          const n2  = parseInt(parts[5], 10);
          if (!isNaN(sec) && !isNaN(n1) && !isNaN(n2)) {
            var grpId2 = null;
            if (parts.length >= 7) {
              var maybeGid2 = parseInt(parts[6], 10);
              if (!isNaN(maybeGid2) && maybeGid2 > 0) grpId2 = maybeGid2;
            }
            if (grpId2 === null && elemGroupMap[id] !== undefined) {
              grpId2 = elemGroupMap[id];
            }
            elements.push({ id, type: parts[1]||'?', section: sec, n1, n2, groupId: grpId2 });
            rawSections.push(sec);
          }
        }
      }
    }
  }

  return { nodes, nodeMap, elements, rawSections, sectionNames, groupNames };
}

/* ============================================================
   3. 几何计算 & 重量反算
   ============================================================ */
function midas_dist3d(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

function midas_enrich(elements, nodeMap, sectionNames, groupNames) {
  const out = [];
  let totalLen = 0, totalWt = 0;
  let hasWeight = false;
  for (const el of elements) {
    const n1 = nodeMap[el.n1], n2 = nodeMap[el.n2];
    // MGT 坐标单位为 mm，转换为 m
    const lenMm = (n1 && n2) ? midas_dist3d(n1, n2) : 0;
    const len = lenMm / 1000;
    totalLen += len;
    const sname = sectionNames[el.section] || '';
    const lw = midas_connectToSectionLib(el.section, sname);
    // lw 单位 kg/m，len 单位 m → weight 单位 kg
    const wt = (lw !== null) ? len * lw : null;
    if (wt !== null) { totalWt += wt; hasWeight = true; }
    // 组名称
    var gname = '';
    if (el.groupId !== null && el.groupId !== undefined && groupNames[el.groupId]) {
      gname = groupNames[el.groupId];
    }
    out.push({
      id:el.id, type:el.type, section:el.section, sectionName:sname,
      n1:el.n1, n2:el.n2, length:len, lineWeight:lw, weight:wt,
      groupId: el.groupId, groupName: gname
    });
  }
  return { enriched: out, totalLength: totalLen, totalWeight: totalWt, hasWeight };
}

/* ============================================================
   4. 3D 渲染（Plotly.js）
   ============================================================ */
function midas_render3D(nodes, elements, nodeMap) {
  // 如果有高亮组，使用带高亮的渲染
  if (midas_highlightedGroupId !== null) {
    midas_render3DWithHighlight();
    return;
  }
  const plotEl = document.getElementById('midas-plot3d');
  if (!plotEl || typeof Plotly === 'undefined') return;

  const groups = {};
  for (const el of elements) {
    const s = el.section;
    if (!groups[s]) groups[s] = { xs:[], ys:[], zs:[] };
    const a = nodeMap[el.n1], b = nodeMap[el.n2];
    if (!a || !b) continue;
    groups[s].xs.push(a.x, b.x, null);
    groups[s].ys.push(a.y, b.y, null);
    groups[s].zs.push(a.z, b.z, null);
  }
  const secs = Object.keys(groups).map(Number).sort((a,b)=>a-b);
  const traces = [];

  for (let i = 0; i < secs.length; i++) {
    const g = groups[secs[i]];
    traces.push({
      type:'scatter3d', mode:'lines',
      x:g.xs, y:g.ys, z:g.zs,
      line:{ color:midas_palette[i%midas_palette.length], width:2.2 },
      name:'截面 '+secs[i], legendgroup:'s'+secs[i],
      showlegend:(secs.length<=40), hoverinfo:'skip'
    });
  }

  if (nodes.length) {
    traces.push({
      type:'scatter3d', mode:'markers',
      x:nodes.map(n=>n.x), y:nodes.map(n=>n.y), z:nodes.map(n=>n.z),
      marker:{ size:2, color:'#e53e3e', symbol:'circle' },
      name:'节点 ('+nodes.length+')', showlegend:true, hoverinfo:'skip'
    });
  }

  Plotly.react('midas-plot3d', traces, {
    paper_bgcolor:'#fafcfd', plot_bgcolor:'#fafcfd',
    scene:{
      xaxis:{ title:'X', color:'#a0aec0', gridcolor:'rgba(0,0,0,0.05)', zerolinecolor:'rgba(0,0,0,0.07)' },
      yaxis:{ title:'Y', color:'#a0aec0', gridcolor:'rgba(0,0,0,0.05)', zerolinecolor:'rgba(0,0,0,0.07)' },
      zaxis:{ title:'Z', color:'#a0aec0', gridcolor:'rgba(0,0,0,0.05)', zerolinecolor:'rgba(0,0,0,0.07)' },
      aspectmode:'data', bgcolor:'#fafcfd'
    },
    margin:{ l:0, r:0, t:0, b:0 },
    legend:{ yanchor:'top', y:0.99, xanchor:'left', x:0.01,
      font:{ color:'#4a5568', size:9 },
      bgcolor:'rgba(255,255,255,0.88)', bordercolor:'#dde4ee', borderwidth:1
    },
    showlegend:(secs.length>0 && secs.length<=40)
  }, {
    displayModeBar:true,
    modeBarButtonsToRemove:['sendDataToCloud','autoScale2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'],
    displaylogo:false, responsive:true
  });
}

/* ============================================================
   5. UI 更新
   ============================================================ */

/* 重量单位切换 */
function midas_toggleWeightUnit() {
  midas_weightUnit = (midas_weightUnit === 'kg') ? 't' : 'kg';
  midas_refreshWeightDisplay();

  // 同步更新明细表里的总重量列标题和内容
  const th = document.getElementById('midas-wtColHead');
  if (th) th.textContent = midas_weightUnit === 'kg' ? '总重量(KG)' : '总重量(T)';

  // 重新渲染明细行（重量列）
  const rows = document.querySelectorAll('#midas-detailTbody tr');
  rows.forEach((tr, idx) => {
    const el = midas_elements[idx];
    if (!el) return;
    const td = tr.querySelectorAll('td')[8]; // 第9列=总重量
    if (!td) return;
    if (el.weight != null) {
      const v = midas_weightUnit === 'kg' ? el.weight : el.weight / 1000;
      td.textContent = v.toFixed(midas_weightUnit === 'kg' ? 2 : 4);
    }
  });

  // 同步组面板重量显示
  midas_updateGroupPanel(midas_elements, midas_hasWeight);

  // 同步切换按钮文字
  const btn = document.getElementById('midas-unitToggleBtn');
  if (btn) btn.textContent = midas_weightUnit === 'kg' ? '切换为 t' : '切换为 kg';
}

/* 刷新统计行中总重量显示 */
function midas_refreshWeightDisplay() {
  const chips = document.querySelectorAll('#midas-statsRow .midas-stat-val');
  if (chips.length < 5) return;
  if (!midas_hasWeight) {
    chips[4].textContent = '-';
    return;
  }
  if (midas_weightUnit === 'kg') {
    chips[4].textContent = midas_totalWeight.toFixed(1);
  } else {
    chips[4].textContent = (midas_totalWeight / 1000).toFixed(3);
  }
  // 更新标签
  const lbls = document.querySelectorAll('#midas-statsRow .midas-stat-lbl');
  if (lbls.length >= 5) {
    lbls[4].innerHTML = `预估总重 <span id="midas-unitToggleBtn" onclick="midas_toggleWeightUnit()"
      style="cursor:pointer;background:#e8f4ff;color:#2b7de9;border:1px solid #b3d4ff;border-radius:4px;
      padding:1px 7px;font-size:11px;font-weight:600;margin-left:4px;user-select:none;">
      ${midas_weightUnit === 'kg' ? '切换为 t' : '切换为 kg'}</span>`;
  }
}

function midas_updateAll(nodes, enriched, totalLength, totalWeight, hasWeight) {
  const secCounts = {};
  for (const el of enriched) { secCounts[el.section] = (secCounts[el.section]||0)+1; }
  const uniqueSecs = Object.keys(secCounts).map(Number).sort((a,b)=>a-b);
  const totalN = enriched.length;

  // 缓存总重，供单位切换使用
  midas_totalWeight = totalWeight;
  midas_hasWeight = hasWeight;

  midas_refreshWeightDisplay();

  const chips = document.querySelectorAll('#midas-statsRow .midas-stat-val');
  if (chips.length >= 5) {
    chips[0].textContent = nodes.length;
    chips[1].textContent = totalN;
    chips[2].textContent = uniqueSecs.length;
    chips[3].textContent = totalLength.toFixed(3);
    // chips[4] 由 midas_refreshWeightDisplay 负责更新
  }

  /* 截面分布表 — 含线重 & 匹配状态 */
  const secLwMap = {};
  for (const el of enriched) {
    if (el.lineWeight !== null && !(el.section in secLwMap)) {
      secLwMap[el.section] = el.lineWeight;
    }
  }
  let rows = '';
  for (const sec of uniqueSecs) {
    const cnt = secCounts[sec];
    const pct = (cnt / Math.max(totalN,1) * 100).toFixed(1);
    const nm = midas_sectionNames[sec] || '';
    const dn = nm.length > 26 ? nm.substring(0,24)+'…' : nm;
    const lw = secLwMap[sec];
    const lwStr = lw != null
      ? `<span style="color:#38a169;font-weight:600;">${lw.toFixed(2)}</span>`
      : `<span style="color:#e0854a;">-</span>`;
    const matched = lw != null;
    rows += `<tr>
      <td>${sec}</td><td>${cnt}</td><td>${pct}%</td>
      <td><div class="midas-bar-wrap"><div class="midas-bar-bg"><div class="midas-bar-fill" style="width:${Math.max(pct,1.5)}%"></div></div><span class="midas-sec-name-cell" title="${nm}">${dn||'-'}</span></div></td>
      <td class="midas-num">${lwStr}</td>
      <td>${matched ? '<span class="midas-tag midas-tag-green">✓</span>' : '<span class="midas-tag midas-tag-yellow">未匹配</span>'}</td>
    </tr>`;
  }
  const secTbody = document.querySelector('#midas-sectionStatsTable tbody');
  if (secTbody) secTbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:#a0aec0;padding:14px;">无数据</td></tr>';

  /* 明细表 — 按重量递减排序 */
  const sorted = [...enriched].sort((a,b)=>{
    const wa=a.weight, wb=b.weight;
    if(wa!=null&&wb!=null) return wb-wa;
    if(wa!=null) return -1; if(wb!=null) return 1;
    return b.length-a.length;
  });
  let drows = '';
  for (const el of sorted) {
    const st = (el.lineWeight !== null)
      ? '<span class="midas-tag midas-tag-green">已匹配</span>'
      : '<span class="midas-tag midas-tag-yellow">待接截面库</span>';
    const rc = (el.weight === null) ? ' class="midas-warn-row"' : '';
    const wtVal = el.weight != null
      ? (midas_weightUnit === 'kg' ? el.weight.toFixed(2) : (el.weight/1000).toFixed(4))
      : '-';
    drows += `<tr${rc}>
      <td>${el.id}</td>
      <td><span class="midas-tag midas-tag-blue">${el.type}</span></td>
      <td>${el.section}</td>
      <td class="midas-col-secname">${el.sectionName||'-'}</td>
      <td>${el.n1}</td>
      <td>${el.n2}</td>
      <td style="font-weight:600;">${el.length.toFixed(3)}</td>
      <td>${el.lineWeight!=null ? el.lineWeight.toFixed(2) : '-'}</td>
      <td style="font-weight:600;">${wtVal}</td>
      <td>${st}</td>
    </tr>`;
  }
  const tbody = document.getElementById('midas-detailTbody');
  if (tbody) tbody.innerHTML = drows || '<tr><td colspan="10" style="text-align:center;color:#a0aec0;padding:20px;">无数据</td></tr>';

  const rcEl = document.getElementById('midas-rowCount');
  if (rcEl) rcEl.textContent = '共 '+totalN+' 根杆件';

  const expBtn = document.getElementById('midas-exportBtn');
  if (expBtn) expBtn.disabled = (totalN === 0);
  const bExpBtn = document.getElementById('midas-bottomExportBtn');
  if (bExpBtn) bExpBtn.disabled = (totalN === 0);

  const emptyState = document.getElementById('midas-emptyState');
  if (emptyState) emptyState.style.display = 'none';

  // 替换 Top5 为组信息面板
  midas_updateGroupPanel(enriched, hasWeight);
}

/* ============================================================
   组信息面板 — 替换原 Top5
   ============================================================ */
function midas_updateGroupPanel(enriched, hasWeight) {
  const box = document.getElementById('midas-groupPanelBody');
  if (!box) return;

  if (enriched.length === 0) {
    box.innerHTML = '<div style="text-align:center;color:#a0aec0;padding:14px;font-size:12px;">无杆件数据</div>';
    return;
  }

  // 按组统计 — 组名严格使用 Midas 原文
  const groupStats = {};
  let hasAnyGroup = false;
  for (const el of enriched) {
    const gid = (el.groupId !== null && el.groupId !== undefined) ? el.groupId : '__nogroup__';
    const gname = el.groupName || (gid === '__nogroup__' ? '未分组' : ('组' + gid));
    if (gid !== '__nogroup__') hasAnyGroup = true;
    if (!groupStats[gid]) {
      groupStats[gid] = { name: gname, count: 0, totalWeight: 0, hasWeight: false, elemIds: [] };
    }
    groupStats[gid].count++;
    groupStats[gid].elemIds.push(el.id);
    if (el.weight !== null) {
      groupStats[gid].totalWeight += el.weight;
      groupStats[gid].hasWeight = true;
    }
  }

  // 按总重量排序
  const gids = Object.keys(groupStats).sort((a,b)=>{
    return groupStats[b].totalWeight - groupStats[a].totalWeight;
  });

  // 构建卡片 — 简洁风格：仅组名 + 数量 + 总重量
  var h = '';
  if (!hasAnyGroup) {
    h = '<div style="text-align:center;color:#a0aec0;padding:14px;font-size:12px;">模型未定义结构组<br><span style="font-size:10px;">在Midas中通过"树形菜单 → 组"定义结构组后重新导出</span></div>';
  }

  for (var i = 0; i < gids.length; i++) {
    var g = groupStats[gids[i]];
    if (gids[i] === '__nogroup__') continue;  // 跳过未分组
    var wtStr = g.hasWeight
      ? (midas_weightUnit === 'kg' ? g.totalWeight.toFixed(1) + ' KG' : (g.totalWeight/1000).toFixed(3) + ' T')
      : '待入库';
    var gidSafe = gids[i].toString().replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
    var activeClass = (midas_highlightedGroupId === gids[i]) ? ' midas-group-active' : '';
    h += '<div class="midas-group-card' + activeClass + '" id="midas-gcard-' + gidSafe + '" onclick="midas_toggleGroupHighlight(\'' + gids[i] + '\')" title="点击高亮该组杆件">';
    h += '  <div class="midas-group-body">';
    h += '    <div class="midas-group-name">' + g.name + '</div>';
    h += '    <div class="midas-group-meta">';
    h += '      <span class="midas-group-count">' + g.count + ' 根</span>';
    h += '      <span class="midas-group-weight">' + wtStr + '</span>';
    h += '    </div>';
    h += '  </div>';
    h += '</div>';
  }

  box.innerHTML = h || '<div style="text-align:center;color:#a0aec0;padding:14px;font-size:12px;">无分组数据</div>';
}

/* 切换组高亮 */
function midas_toggleGroupHighlight(groupId) {
  if (midas_highlightedGroupId === groupId) {
    // 取消高亮
    midas_highlightedGroupId = null;
  } else {
    midas_highlightedGroupId = groupId;
  }

  // 更新组面板中的active状态
  var cards = document.querySelectorAll('.midas-group-card');
  cards.forEach(function(card) {
    card.classList.remove('midas-group-active');
  });
  if (midas_highlightedGroupId !== null) {
    var gidSafe = midas_highlightedGroupId.toString().replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
    var activeCard = document.getElementById('midas-gcard-' + gidSafe);
    if (activeCard) activeCard.classList.add('midas-group-active');
  }

  // 重绘3D模型（带高亮）
  midas_render3DWithHighlight();
}

/* 带组高亮的3D渲染 */
function midas_render3DWithHighlight() {
  var plotEl = document.getElementById('midas-plot3d');
  if (!plotEl || typeof Plotly === 'undefined') return;
  if (!midas_elements.length) return;

  var hlGroupId = midas_highlightedGroupId;
  var highlightedElemIds = null;
  if (hlGroupId !== null) {
    highlightedElemIds = new Set();
    for (var i = 0; i < midas_elements.length; i++) {
      if (midas_elements[i].groupId === hlGroupId || 
          (hlGroupId === '__nogroup__' && (midas_elements[i].groupId === null || midas_elements[i].groupId === undefined))) {
        highlightedElemIds.add(midas_elements[i].id);
      }
    }
  }

  // 按截面分组构建 traces
  var groups = {};
  for (var i = 0; i < midas_elements.length; i++) {
    var el = midas_elements[i];
    var s = el.section;
    if (!groups[s]) groups[s] = { xs:[], ys:[], zs:[], hl_xs:[], hl_ys:[], hl_zs:[] };
    var a = midas_nodeMap[el.n1], b = midas_nodeMap[el.n2];
    if (!a || !b) continue;

    if (highlightedElemIds && highlightedElemIds.has(el.id)) {
      // 高亮杆件 — 放入单独的数组
      groups[s].hl_xs.push(a.x, b.x, null);
      groups[s].hl_ys.push(a.y, b.y, null);
      groups[s].hl_zs.push(a.z, b.z, null);
    } else {
      groups[s].xs.push(a.x, b.x, null);
      groups[s].ys.push(a.y, b.y, null);
      groups[s].zs.push(a.z, b.z, null);
    }
  }

  var secs = Object.keys(groups).map(Number).sort(function(a,b){return a-b;});
  var traces = [];

  for (var i = 0; i < secs.length; i++) {
    var g = groups[secs[i]];
    var color = midas_palette[i % midas_palette.length];

    // 普通杆件（如果非高亮模式则正常显示，高亮模式下变半透明）
    if (g.xs.length > 0) {
      var opacity = highlightedElemIds ? 0.12 : 1.0;
      var lineWidth = highlightedElemIds ? 0.8 : 2.2;
      traces.push({
        type:'scatter3d', mode:'lines',
        x:g.xs, y:g.ys, z:g.zs,
        line:{ color: color, width: lineWidth },
        opacity: opacity,
        name:'截面 '+secs[i], legendgroup:'s'+secs[i],
        showlegend:(secs.length<=40), hoverinfo:'skip'
      });
    }

    // 高亮杆件
    if (g.hl_xs.length > 0) {
      traces.push({
        type:'scatter3d', mode:'lines',
        x:g.hl_xs, y:g.hl_ys, z:g.hl_zs,
        line:{ color: '#ff6b35', width: 5 },
        opacity: 1.0,
        name:'★ 截面 '+secs[i]+' (高亮)', legendgroup:'s'+secs[i]+'_hl',
        showlegend:(secs.length<=40), hoverinfo:'skip'
      });
    }
  }

  if (midas_nodes.length) {
    var nodeOpacity = highlightedElemIds ? 0.15 : 1.0;
    traces.push({
      type:'scatter3d', mode:'markers',
      x:midas_nodes.map(function(n){return n.x;}),
      y:midas_nodes.map(function(n){return n.y;}),
      z:midas_nodes.map(function(n){return n.z;}),
      marker:{ size:2, color:'#e53e3e', symbol:'circle', opacity: nodeOpacity },
      name:'节点 ('+midas_nodes.length+')', showlegend:true, hoverinfo:'skip'
    });
  }

  Plotly.react('midas-plot3d', traces, {
    paper_bgcolor:'#fafcfd', plot_bgcolor:'#fafcfd',
    scene:{
      xaxis:{ title:'X', color:'#a0aec0', gridcolor:'rgba(0,0,0,0.05)', zerolinecolor:'rgba(0,0,0,0.07)' },
      yaxis:{ title:'Y', color:'#a0aec0', gridcolor:'rgba(0,0,0,0.05)', zerolinecolor:'rgba(0,0,0,0.07)' },
      zaxis:{ title:'Z', color:'#a0aec0', gridcolor:'rgba(0,0,0,0.05)', zerolinecolor:'rgba(0,0,0,0.07)' },
      aspectmode:'data', bgcolor:'#fafcfd'
    },
    margin:{ l:0, r:0, t:0, b:0 },
    legend:{ yanchor:'top', y:0.99, xanchor:'left', x:0.01,
      font:{ color:'#4a5568', size:9 },
      bgcolor:'rgba(255,255,255,0.88)', bordercolor:'#dde4ee', borderwidth:1
    },
    showlegend:(secs.length>0 && secs.length<=40)
  }, {
    displayModeBar:true,
    modeBarButtonsToRemove:['sendDataToCloud','autoScale2d','hoverClosestCartesian','hoverCompareCartesian','toggleSpikelines'],
    displaylogo:false, responsive:true
  });
}

/* ============================================================
   6. 导出 Excel
   ============================================================ */
function midas_exportToExcel() {
  if (!midas_elements.length) { alert('暂无数据'); return; }
  if (typeof XLSX === 'undefined') { alert('XLSX库未加载，请稍后重试'); return; }
  const wtLabel = midas_weightUnit === 'kg' ? '总重量(KG)' : '总重量(T)';
  const rows = [['编号','类型','截面ID','截面名称','节点I','节点J','长度(M)','线重(KG/M)',wtLabel,'匹配状态']];
  // 按重量递减排序后导出
  const sorted = [...midas_elements].sort((a,b)=>{
    const wa=a.weight, wb=b.weight;
    if(wa!=null&&wb!=null) return wb-wa;
    if(wa!=null) return -1; if(wb!=null) return 1;
    return b.length-a.length;
  });
  for (const el of sorted) {
    const wtVal = el.weight != null
      ? parseFloat((midas_weightUnit === 'kg' ? el.weight : el.weight/1000).toFixed(midas_weightUnit === 'kg' ? 2 : 4))
      : '-';
    rows.push([el.id, el.type, el.section, el.sectionName||'', el.n1, el.n2,
      parseFloat(el.length.toFixed(3)),
      el.lineWeight!=null?parseFloat(el.lineWeight.toFixed(2)):'-',
      wtVal,
      el.lineWeight!=null?'已匹配':'待接截面库']);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:8},{wch:12},{wch:8},{wch:24},{wch:8},{wch:8},{wch:10},{wch:12},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, ws, '构件明细清单');
  const d = new Date();
  const ts = ''+d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2)
    +'_'+('0'+d.getHours()).slice(-2)+('0'+d.getMinutes()).slice(-2)+('0'+d.getSeconds()).slice(-2);
  XLSX.writeFile(wb, '构件明细清单_'+ts+'.xlsx');
}

/* ============================================================
   7. 文件导入入口
   支持 .mgt（纯前端文本解析）和 .mgb（发送至后端 /api/parse_mgb 转换）
   ============================================================ */

/**
 * 拿到 MGT 文本后统一走此处 —— 解析 → 富化 → 渲染
 * 所有入口（.mgt 直读、.mgb 转换后）都汇聚于此，确保功能完全复用
 */
function midas_processMGTText(mgtText, fileName) {
  const fn = document.getElementById('midas-fileName');
  const t0 = performance.now();
  const data = midas_parseMGT(mgtText);
  const t1 = performance.now();

  midas_nodes       = data.nodes;
  midas_nodeMap     = data.nodeMap;
  midas_sectionNames = data.sectionNames;
  midas_groupNames   = data.groupNames || {};

  const { enriched, totalLength, totalWeight, hasWeight } =
    midas_enrich(data.elements, data.nodeMap, data.sectionNames, data.groupNames);
  midas_elements = enriched;
  midas_hasWeight = hasWeight;
  const t2 = performance.now();

  if (fn) fn.textContent = fileName + ' ✅';
  midas_updateAll(data.nodes, enriched, totalLength, totalWeight, hasWeight);
  if (data.nodes.length && data.elements.length)
    midas_render3D(data.nodes, data.elements, data.nodeMap);

  const t3 = performance.now();
  console.log(
    '✅ Midas | 解析:' + (t1-t0).toFixed(0) + 'ms' +
    ' 计算:' + (t2-t1).toFixed(0) + 'ms' +
    ' 渲染:' + (t3-t2).toFixed(0) + 'ms | ' +
    '节点:' + data.nodes.length +
    ' 杆件:' + data.elements.length +
    ' 截面:' + Object.keys(data.sectionNames).length +
    ' 组:' + Object.keys(data.groupNames || {}).length
  );
}

/**
 * 处理 .mgb 文件 — 上传到后端 /api/parse_mgb，取回 MGT 文本后复用解析流程
 */
function midas_handleMGB(file) {
  const fn = document.getElementById('midas-fileName');
  const sd = document.getElementById('midas-statusDot');
  const loadBar = document.getElementById('midas-mgbLoadBar');

  if (fn) fn.textContent = '⏳ 上传解析中: ' + file.name;
  if (sd) sd.style.display = 'inline-block';
  if (loadBar) loadBar.style.display = 'block';

  const fd = new FormData();
  fd.append('file', file);

  fetch('/api/parse_mgb', { method: 'POST', body: fd })
    .then(function(resp) {
      // 422 = 转换失败（有详细错误信息）；其他非2xx = 服务器错误
      return resp.json().then(function(j) {
        if (!resp.ok) {
          var e = new Error(j.error || ('服务器返回 ' + resp.status));
          e.meta = j.meta || null;
          throw e;
        }
        return j;
      }).catch(function(e) {
        if (e.meta !== undefined) throw e;  // 已处理的错误，直接重抛
        throw new Error('服务器返回 ' + resp.status + '，请确认后端服务已启动（python server.py）');
      });
    })
    .then(function(json) {
      if (!json.mgt_content) throw new Error('后端返回数据为空，请检查 .mgb 文件格式');
      if (loadBar) loadBar.style.display = 'none';
      midas_processMGTText(json.mgt_content, file.name);
    })
    .catch(function(err) {
      if (loadBar) loadBar.style.display = 'none';
      if (sd) sd.style.display = 'none';
      if (fn) fn.textContent = '❌ MGB 解析失败';
      // 在页面上显示友好错误提示
      var errBox = document.getElementById('midas-mgbError');
      if (errBox) {
        // 将换行符转为 <br>，保留格式
        var msg = err.message || '未知错误';
        errBox.innerHTML = msg.replace(/\n/g, '<br>');
        errBox.style.display = 'block';
        // MGB解析失败提示不自动消失（需要用户阅读指引）
      } else {
        alert('MGB 解析失败：\n' + (err.message || '未知错误'));
      }
      console.error('MGB 解析失败:', err);
    });
}

/**
 * 文件选择入口 — 根据后缀分流
 */
function midas_handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // 重置 input，允许重复选同一文件
  event.target.value = '';

  const fn = document.getElementById('midas-fileName');
  const sd = document.getElementById('midas-statusDot');
  const errBox = document.getElementById('midas-mgbError');
  if (errBox) errBox.style.display = 'none';

  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'mgb') {
    // ── .mgb：二进制，转发后端解析 ──
    midas_handleMGB(file);
  } else if (ext === 'mgt') {
    // ── .mgt：纯文本，前端直解 ──
    if (fn) fn.textContent = '⏳ 解析中: ' + file.name;
    if (sd) sd.style.display = 'inline-block';
    const reader = new FileReader();
    reader.onload = function(e) {
      // 使用 ArrayBuffer 读取原始字节，尝试多种编码解码
      var buffer = e.target.result;
      var text = midas_decodeMGT(buffer, file.name);
      midas_processMGTText(text, file.name);
    };
    reader.onerror = function() {
      if (fn) fn.textContent = '❌ 文件读取失败: ' + file.name;
      if (sd) sd.style.display = 'none';
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert('仅支持 .mgt 和 .mgb 格式的 Midas 模型文件');
  }
}

/* ============================================================
   8. 拖拽手柄（水平：调整底部清单高度；竖直：调整左右宽度）
   ============================================================ */
let midas_barDragging = false, midas_barStartY, midas_barStartBasis;
let midas_vDragging = false, midas_vStartX, midas_vStartBasis;

function midas_initDragHandles() {
  const resizeBar   = document.getElementById('midas-resizeBar');
  const bottomPanel = document.getElementById('midas-bottomPanel');
  const vResizeBar  = document.getElementById('midas-vResizeBar');
  const rightPanel  = document.getElementById('midas-rightPanel');

  if (resizeBar && bottomPanel) {
    resizeBar.addEventListener('mousedown', function(e) {
      midas_barDragging = true;
      midas_barStartY     = e.clientY;
      midas_barStartBasis = bottomPanel.offsetHeight;
      document.body.style.cursor    = 'row-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
  }

  if (vResizeBar && rightPanel) {
    vResizeBar.addEventListener('mousedown', function(e) {
      midas_vDragging   = true;
      midas_vStartX     = e.clientX;
      midas_vStartBasis = rightPanel.offsetWidth;
      document.body.style.cursor    = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
  }

  document.addEventListener('mousemove', function(e) {
    if (!midas_barDragging && !midas_vDragging) return;
    if (midas_barDragging) {
      const dy = midas_barStartY - e.clientY;
      const minH = 140, maxH = window.innerHeight * 0.75;
      const newH = Math.min(maxH, Math.max(minH, midas_barStartBasis + dy));
      if (bottomPanel) bottomPanel.style.flexBasis = newH + 'px';
    }
    if (midas_vDragging) {
      const dx = e.clientX - midas_vStartX;
      const minW = 220, maxW = window.innerWidth * 0.7;
      const newW = Math.min(maxW, Math.max(minW, midas_vStartBasis + dx));
      if (rightPanel) rightPanel.style.flexBasis = newW + 'px';
    }
  });

  document.addEventListener('mouseup', function() {
    if (midas_barDragging || midas_vDragging) {
      midas_barDragging = false;
      midas_vDragging   = false;
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
      const plotEl = document.getElementById('midas-plot3d');
      if (plotEl && typeof Plotly !== 'undefined') {
        setTimeout(() => Plotly.Plots.resize(plotEl), 80);
      }
    }
  });
}

/* ============================================================
   9. 初始化（被 sp('midas') 调用）
   ============================================================ */
function initMidasPage() {
  // 已初始化：仅 resize
  const plotEl = document.getElementById('midas-plot3d');
  if (!plotEl) return;

  if (typeof Plotly === 'undefined') {
    console.warn('Plotly 未加载，Midas 3D 渲染不可用');
    return;
  }

  // 首次初始化空场景
  if (!plotEl._midasInited) {
    plotEl._midasInited = true;

    Plotly.newPlot('midas-plot3d', [], {
      paper_bgcolor:'#fafcfd',
      scene:{ xaxis:{visible:false}, yaxis:{visible:false}, zaxis:{visible:false}, bgcolor:'#fafcfd' },
      margin:{ l:0, r:0, t:0, b:0 },
      annotations:[{ text:'导入 .mgt 文件', showarrow:false, font:{ color:'#a0aec0', size:14 }, xref:'paper', yref:'paper', x:0.5, y:0.5 }]
    }, { displayModeBar:false, responsive:true });

    midas_initDragHandles();

    // ResizeObserver 监听视口变化
    const viewportWrap = document.getElementById('midas-viewportWrap');
    if (viewportWrap && !midas_roInstance) {
      midas_roInstance = new ResizeObserver(() => {
        clearTimeout(midas_resizeTimer);
        midas_resizeTimer = setTimeout(() => {
          const el = document.getElementById('midas-plot3d');
          if (el && typeof Plotly !== 'undefined') Plotly.Plots.resize(el);
        }, 100);
      });
      midas_roInstance.observe(viewportWrap);
    }

    console.log('✅ Midas MGT 3D 查看器初始化完成');
  } else {
    // 已存在则仅 resize
    setTimeout(() => {
      if (typeof Plotly !== 'undefined') Plotly.Plots.resize(plotEl);
    }, 100);
  }
}
