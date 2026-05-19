/* ============================================================
   钢结构方案辅助工具 app.js  v2-20260709c
   新数据结构：crane.load_charts = {工况类型: {工况说明: {'配重|支腿': [行数据]}}}
   ============================================================ */

// ── 表单数据持久化（防止刷新丢失）────────────────────────────
var FORM_STORAGE_KEY = 'jg-lift-form-v1';

function saveFormData() {
  try {
    // 截面参数
    var sectionType = (document.getElementById('sec-main-type') || {value: 'HW'}).value;
    var sectionParams = {};
    var paramInputs = document.querySelectorAll('#secMainDims input[id^="sm_"]');
    for (var i = 0; i < paramInputs.length; i++) {
      var el = paramInputs[i];
      if (el.id) sectionParams[el.id] = el.value;
    }
    // 截面识别文字
    var secSmartInput = (document.getElementById('secSmartInput') || {value: ''}).value;
    // 分段/参数
    var liftSegPf   = (document.getElementById('lift-seg-pf') || {value: '1'}).value;
    var liftAmp     = (document.getElementById('lift-amp') || {value: ''}).value;
    var liftCrane   = (document.getElementById('lift-crane') || {value: ''}).value;
    var liftRadius  = (document.getElementById('lift-radius') || {value: ''}).value;
    var liftBoom    = (document.getElementById('lift-boom-sel') || {value: ''}).value;
    // 吊次参数
    var kWeather = (document.getElementById('diaoci-k-weather') || {value: ''}).value;
    var kUtil    = (document.getElementById('diaoci-k-util') || {value: ''}).value;
    var hours    = (document.getElementById('diaoci-hours') || {value: ''}).value;
    var kOther   = (document.getElementById('diaoci-k-other') || {value: ''}).value;

    var payload = {
      sectionType: sectionType,
      sectionParams: sectionParams,
      secSmartInput: secSmartInput,
      liftSegPf: liftSegPf,
      liftAmp: liftAmp,
      liftCrane: liftCrane,
      liftRadius: liftRadius,
      liftBoom: liftBoom,
      kWeather: kWeather,
      kUtil: kUtil,
      hours: hours,
      kOther: kOther,
      flData: window.FL_DATA ? JSON.parse(JSON.stringify(window.FL_DATA)) : [],
      diaociMachines: window._diaoci ? JSON.parse(JSON.stringify(window._diaoci.machines)) : [],
      diaociRows: window._diaoci ? JSON.parse(JSON.stringify(window._diaoci.rows)) : []
    };
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(payload));
  } catch(e) { /* ignore storage errors */ }
}

function restoreFormData() {
  try {
    var raw = localStorage.getItem(FORM_STORAGE_KEY);
    if (!raw) return;
    var d = JSON.parse(raw);
    var typeSel = document.getElementById('sec-main-type');

    // 1. 截面类型 + 参数（先重建字段再填值）
    if (typeSel && d.sectionType) {
      var oldOnchange = typeSel.onchange;
      typeSel.onchange = null;
      typeSel.value = d.sectionType;
      secMainTypeChange(d.sectionType);
      typeSel.onchange = oldOnchange;
      if (d.sectionParams) {
        Object.keys(d.sectionParams).forEach(function(k) {
          var el = document.getElementById(k);
          if (el) el.value = d.sectionParams[k];
        });
      }
      updateMainSectionCalc();
    }
    // 截面识别文字
    var siEl = document.getElementById('secSmartInput');
    if (siEl && d.secSmartInput) siEl.value = d.secSmartInput;

    // 2. 分段/节点放大
    var pfEl = document.getElementById('lift-seg-pf');
    if (pfEl && d.liftSegPf) { pfEl.value = d.liftSegPf; flSegPfUpdateUI(d.liftSegPf); }
    var ampEl = document.getElementById('lift-amp');
    if (ampEl && d.liftAmp) ampEl.value = d.liftAmp;

    // 3. 机械 + 半径（先选机械以加载臂长选项）
    var craneSel = document.getElementById('lift-crane');
    if (craneSel && d.liftCrane) {
      craneSel.value = d.liftCrane;
      liftOnCraneChange();
      var boomSel = document.getElementById('lift-boom-sel');
      if (boomSel && d.liftBoom) boomSel.value = d.liftBoom;
    }
    var rEl = document.getElementById('lift-radius');
    if (rEl && d.liftRadius) rEl.value = d.liftRadius;

    // 4. 层高表
    if (d.flData && d.flData.length) {
      window.FL_DATA = d.flData;
      flRenderTable();
    }

    // 5. 吊次参数
    var kwEl = document.getElementById('diaoci-k-weather');
    if (kwEl && d.kWeather) kwEl.value = d.kWeather;
    var kuEl = document.getElementById('diaoci-k-util');
    if (kuEl && d.kUtil) kuEl.value = d.kUtil;
    var hEl = document.getElementById('diaoci-hours');
    if (hEl && d.hours) hEl.value = d.hours;
    var koEl = document.getElementById('diaoci-k-other');
    if (koEl && d.kOther) koEl.value = d.kOther;

    // 6. 吊次机械 + 构件行
    if (window._diaoci) {
      if (d.diaociMachines && d.diaociMachines.length) _diaoci.machines = d.diaociMachines;
      if (d.diaociRows && d.diaociRows.length) _diaoci.rows = d.diaociRows;
      diaociRenderMachines();
      diaociRenderRows();
      diaociCalc();
    }
  } catch(e) { /* ignore restore errors */ }
}

// ── flSegPfUpdateUI：更新分段下拉文字显示 ──────────────────
function flSegPfUpdateUI(val) {
  var map = {1:'一层一段',2:'两层一段',3:'一层两段',4:'两层两段',5:'三层一段'};
  var textEl = document.getElementById('lift-seg-pf-text');
  var wrap = document.getElementById('lift-seg-pf-wrap');
  if (textEl) textEl.textContent = map[val] || '一层一段';
  if (wrap) wrap.classList.remove('open');
  var dropdown = document.getElementById('lift-seg-pf-dropdown');
  if (dropdown) dropdown.style.display = '';
}

// 全局错误捕获
window.addEventListener('error', function(e) {
  var el = document.getElementById('badge');
  if (el) el.textContent = 'JS错误: ' + (e.message || 'unknown') + ' @' + (e.filename||'').split('/').pop() + ':' + e.lineno;
});

// 立即显示加载状态，让用户知道JS在运行
(function() {
  var el = document.getElementById('badge');
  if (el) el.textContent = 'JS已加载，正在初始化…';
  console.log('[app.js] loaded, timestamp:', Date.now());
})();

var data = null, cur = null;
var _craneMap = {}, _mapBuilt = false;
var _libPage = 1, _libPageSize = 10, _selType = '';
var LS_KEY = 'crane_portable_user_cranes';
var _prevPage = 'home';  /* 记录上一页，用于详情页返回 */
var _sidebarCollapsed = false;

/* 当前详情页状态 */
var _dCurType = '';   /* 工况类型 key */
var _dCurCond = '';   /* 工况说明 */
var _dCurCg   = '';   /* 配重|支腿 组合 */

var TYPE_LABELS = {
  'main_boom':           '主臂工况',
  'super_lift':          '超起工况',
  'jib_boom':            '主副臂工况',
  'jib_superlift':       '主副臂+超起',
  'tower_jib_superlift': '塔式副臂+超起'
};

/* 主臂长度选项（性能表筛选） */
var _dCurBoomLen = '';
var _dCurJibLen  = '';
var TYPE_ORDER = ['main_boom','super_lift','jib_boom','jib_superlift','tower_jib_superlift'];

/* ── 工具函数 ────────────────────────────────────────────── */
function setText(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
function esc(s){if(s==null)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escHtml(s){return esc(s);}
function typeClass(t){return t==='汽车吊'?'b-truck':t==='履带吊'?'b-crawl':t==='塔吊'?'b-tower':t==='随车吊'?'b-truckm':'b-other';}
function effBadge(e){
  e=parseFloat(e);
  if(e<80)return '<span class="ebadge eb-g">合理 '+e.toFixed(1)+'%</span>';
  if(e<=90)return '<span class="ebadge eb-y">偏紧 '+e.toFixed(1)+'%</span>';
  return '<span class="ebadge eb-r">危险 '+e.toFixed(1)+'%</span>';
}
function toast(msg){
  var t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.style.display='block';t.style.opacity='1';
  setTimeout(function(){t.style.opacity='0';setTimeout(function(){t.style.display='none';},300);},2500);
}
function showImgLightbox(src,evt){
  evt.stopPropagation();
  var lb=document.getElementById('imgLightbox');
  var img=document.getElementById('lightboxImg');
  var cap=document.getElementById('lightboxCaption');
  if(!lb||!img)return;
  img.src=src;
  if(cap) cap.textContent=src.split('/').pop().replace(/\.[^.]+$/,'');
  lb.style.display='flex';
}
function closeImgLightbox(){
  var lb=document.getElementById('imgLightbox');
  if(lb)lb.style.display='none';
}
document.addEventListener('keydown',function(e){
  if(e.key==='Escape')closeImgLightbox();
});
var _debounceMap={};
function debounce(fn,key,delay){clearTimeout(_debounceMap[key]);_debounceMap[key]=setTimeout(fn,delay||120);}

/* ── 索引 ───────────────────────────────────────────────── */
function buildMap(){
  if(_mapBuilt)return;_mapBuilt=true;
  for(var i=0;i<data.cranes.length;i++) _craneMap[data.cranes[i].id]=data.cranes[i];
}

/* 从 crane.load_charts 获取扁平化数据点，可按三级过滤 */
function getCranePoints(crane,typeFilter,condFilter,cgFilter){
  if(!crane||!crane.load_charts)return[];
  var pts=[],lc=crane.load_charts;
  var types=typeFilter?[typeFilter]:Object.keys(lc);
  for(var ti=0;ti<types.length;ti++){
    var tKey=types[ti];if(!lc[tKey])continue;
    var conds=condFilter?[condFilter]:Object.keys(lc[tKey]);
    for(var ci=0;ci<conds.length;ci++){
      var cKey=conds[ci];if(!lc[tKey][cKey])continue;
      var cgs=cgFilter?[cgFilter]:Object.keys(lc[tKey][cKey]);
      for(var gi=0;gi<cgs.length;gi++){
        var rows=lc[tKey][cKey][cgs[gi]]||[];
        for(var ri=0;ri<rows.length;ri++) pts.push(rows[ri]);
      }
    }
  }
  return pts;
}

/* 二分线性插值：给定数据点池，估算半径 r 处的额定起重量 */
function interpFast(pool,r){
  if(!pool||!pool.length)return 0;
  var maxBoom=0;
  for(var i=0;i<pool.length;i++){var b=pool[i].boom_length||0;if(b>maxBoom)maxBoom=b;}
  var same=[];
  for(var i=0;i<pool.length;i++){if(Math.abs((pool[i].boom_length||0)-maxBoom)<0.5)same.push(pool[i]);}
  var arr=same.length>1?same:pool;
  arr.sort(function(a,b){return(a.radius||0)-(b.radius||0);});
  if(r<=arr[0].radius)return arr[0].rated_load||0;
  if(r>=arr[arr.length-1].radius)return 0;
  var lo=0,hi=arr.length-1;
  while(lo<hi-1){var m=(lo+hi)>>1;if(arr[m].radius<=r)lo=m;else hi=m;}
  var s=arr[lo],h=arr[hi];
  return(s.rated_load||0)+((h.rated_load||0)-(s.rated_load||0))*(r-s.radius)/(h.radius-s.radius);
}

function getCraneCapacity(crane,radius){
  if(!crane)return null;
  var pts=getCranePoints(crane,'main_boom',null,null);
  if(!pts.length)pts=getCranePoints(crane,null,null,null);
  if(!pts.length)return null;
  var cap=interpFast(pts,radius);
  return cap>0?cap:null;
}

/* 旧版 getCharts 兼容（钢柱吊装页使用） */
function getCharts(craneId){
  var crane=_craneMap[craneId];
  if(!crane)return[];
  return getCranePoints(crane,null,null,null);
}

/* ── 用户机型 ─────────────────────────────────────────── */
function getUserCranes(){try{return JSON.parse(localStorage.getItem(LS_KEY)||'[]');}catch(e){return[];}}
function saveUserCranes(list){localStorage.setItem(LS_KEY,JSON.stringify(list));}
function mergeUserCranes(){
  var userList=getUserCranes();if(!userList.length)return;
  userList.forEach(function(c){
    /* 兼容两种 load_charts 格式：
       1. 数组格式（手动录入）：[{boom_length, radius, rated_load}, ...]
       2. 嵌套对象格式（xlsx导入）：{main_boom: {'工况说明': {'配重|支腿': [...]}}}  */
    if(Array.isArray(c.load_charts)){
      c.load_charts={main_boom:{'主臂工况':{'用户录入|全伸':c.load_charts}}};
    }
    /* 如果同名机型已存在于内置数据中，用 userCranes 覆盖 */
    var existingIdx = -1;
    for(var i=0;i<data.cranes.length;i++){
      if(data.cranes[i].model === c.model && data.cranes[i].id === c.id){existingIdx=i;break;}
    }
    if(existingIdx>=0){
      data.cranes[existingIdx] = c;
    } else {
      data.cranes.push(c);
    }
    _craneMap[c.id]=c;
  });
  /* 去重（按 id） */
  var seen={};
  data.cranes = data.cranes.filter(function(c){
    if(seen[c.id]) return false;
    seen[c.id]=true; return true;
  });
  data.total=data.cranes.length;
}

/* ── 初始化 ────────────────────────────────────────────── */
function onData(){
  try{
    var _t0=Date.now();
    buildMap(); mergeUserCranes();
    var chartCount=0;
    for(var i=0;i<data.cranes.length;i++){
      var lc=data.cranes[i].load_charts||{};
      for(var t in lc)for(var c in lc[t])for(var g in lc[t][c]) chartCount+=(lc[t][c][g]||[]).length;
    }
    setText('badge',data.cranes.length+' 台机型 · '+chartCount+' 条载荷表');
    renderStats(); renderLib(1);
    var types={};data.cranes.forEach(function(c){if(c.type)types[c.type]=true;});
    var about=document.getElementById('bodyBadge');
    if(about){
      about.innerHTML='<h3>数据概况</h3>'+
        '<p>已收录机型：<strong style="color:var(--text)">'+data.cranes.length+'</strong> 台</p>'+
        '<p>载荷表记录：<strong style="color:var(--text)">'+chartCount+'</strong> 条</p>'+
        '<p>机械类型：<strong style="color:var(--text)">'+Object.keys(types).join('、')+'</strong></p>';
    }
    var sT=document.getElementById('sT');
    if(sT){
      sT.innerHTML='<option value="">全部</option>'+Object.keys(types).sort().map(function(t){
        return '<option value="'+t+'">'+t+'</option>';
      }).join('');
    }
    console.log('[onData] 完成，耗时',Date.now()-_t0,'ms');
  }catch(e){setText('badge','初始化失败: '+e.message);console.error('[onData]',e);}
}

/* ── 统计卡片 ─────────────────────────────────────────── */
function renderStats(){
  var el=document.getElementById('statsRow');if(!el)return;
  var byType={},total=data.cranes.length;
  data.cranes.forEach(function(c){var t=c.type||'其他';if(!byType[t])byType[t]=0;byType[t]++;});
  var withChart=0;
  for(var i=0;i<data.cranes.length;i++){var lc=data.cranes[i].load_charts||{};if(Object.keys(lc).length>0)withChart++;}
  var html='',ci=0,colors=['','green','purple','yellow','','green'];
  for(var t in byType){
    var color=colors[ci%colors.length]||'';
    html+='<div class="stat-card '+color+' clickable" onclick="goType(\''+t+'\')">'
      +'<div class="stat-v">'+byType[t]+'</div><div class="stat-l">'+t+'</div></div>'; ci++;
  }
  html+='<div class="stat-card"><div class="stat-v">'+total+'</div><div class="stat-l">总机型</div></div>';
  html+='<div class="stat-card green"><div class="stat-v">'+withChart+'</div><div class="stat-l">有载荷表</div></div>';
  el.innerHTML=html;
}

window.goType=function(t){
  sp('lib');
  setTimeout(function(){
    document.querySelectorAll('.tbtn').forEach(function(b){
      b.classList.remove('active');b.removeAttribute('data-selected');
      if(b.getAttribute('data-type')===t){b.classList.add('active');b.setAttribute('data-selected','y');}
    });
    renderLib(1,t);
  },50);
};
function filterType(t,btn){
  var isSel=btn&&btn.getAttribute('data-selected')==='y';var selType=isSel?'':t;
  document.querySelectorAll('.tbtn').forEach(function(b){b.classList.remove('active');b.removeAttribute('data-selected');});
  if(selType&&btn){btn.classList.add('active');btn.setAttribute('data-selected','y');}
  renderLib(1,selType);
}

/* ── 页面导航 ──────────────────────────────────────────── */
function sp(n){
  // 记录当前页（非详情页）为上一页
  var curActive = document.querySelector('.page.active');
  if(curActive && curActive.id !== 'page-detail'){
    _prevPage = curActive.id.replace('page-','');
  }
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  document.querySelectorAll('.app-nav-btn').forEach(function(b){b.classList.remove('active');});
  var pg=document.getElementById('page-'+n);if(pg)pg.classList.add('active');
  var navBtn=document.getElementById('nav-'+n);if(navBtn)navBtn.classList.add('active');
  if(n==='lib')renderLib(_libPage);
  if(n==='add')initAddPage();
  if(n==='lift')initLiftPage();
  if(n==='diaoci')initDiaoci();
  window.scrollTo(0,0);
}

/* ── 参数示意图展开/折叠 ────────────────────────────────── */
function toggleParamHelp(){
  var wrap=document.getElementById('paramDiagramWrap');
  var btn=document.getElementById('paramHelpBtn');
  if(!wrap||!btn)return;
  var isOpen=wrap.classList.toggle('open');
  btn.classList.toggle('active',isOpen);
  btn.setAttribute('aria-expanded',isOpen);
}

/* ── 侧边栏折叠/展开（CSS 接管布局，JS 只负责 class 切换）─── */
function toggleSidebar(){
  var sidebar=document.getElementById('appSidebar');
  var toggleBtn=document.getElementById('sidebarToggle');
  if(!sidebar)return;
  _sidebarCollapsed=!_sidebarCollapsed;
  if(_sidebarCollapsed){
    sidebar.classList.add('collapsed');
    if(toggleBtn)toggleBtn.textContent='›';
  }else{
    sidebar.classList.remove('collapsed');
    if(toggleBtn)toggleBtn.textContent='‹';
  }
  localStorage.setItem('sidebar_collapsed',_sidebarCollapsed?'true':'false');
}

/* ── 机型库（分页）───────────────────────────────────── */
function renderLib(p,t){
  var pg=typeof p==='number'?p:1;
  if(typeof t==='string')_selType=t;
  _libPage=pg;
  var q=(document.getElementById('libS')||{value:''}).value.trim().toLowerCase();
  var typ=_selType;
  var list=data.cranes.filter(function(c){
    if(typ&&c.type!==typ)return false;
    if(q&&!c.model.toLowerCase().includes(q)&&!(c.brand||'').toLowerCase().includes(q))return false;
    return true;
  }).sort(function(a,b){return (a.max_load_t||0)-(b.max_load_t||0);});
  var typeFilter=document.getElementById('typeFilter');
  if(typeFilter&&typeFilter.children.length===0){
    var allTypes={};data.cranes.forEach(function(c){if(c.type)allTypes[c.type]=true;});
    typeFilter.innerHTML=Object.keys(allTypes).sort().map(function(t){
      return '<button class="tbtn" data-type="'+t+'" onclick="filterType(\''+t+'\',this)">'+t+'</button>';
    }).join('');
  }
  var grid=document.getElementById('libGrid'),empty=document.getElementById('libEmpty'),pgn=document.getElementById('libPgn');
  var stat=document.getElementById('libStat');if(stat)stat.textContent='共 '+list.length+' 台';
  if(!list.length){if(grid)grid.innerHTML='';if(empty)empty.style.display='block';if(pgn)pgn.innerHTML='';return;}
  if(empty)empty.style.display='none';
  var total=list.length,pages=Math.ceil(total/_libPageSize),start=(pg-1)*_libPageSize;
  var page=list.slice(start,start+_libPageSize);
  if(grid){
    grid.className='lib-cards';
    var headerHtml='<table><thead><tr class="crd-list-header">'
      +'<th class="col-num">#</th>'
      +'<th class="col-img"></th>'
      +'<th class="col-model">型号</th>'
      +'<th class="col-brand">品牌</th>'
      +'<th class="col-type">类型</th>'
      +'<th class="col-metric">最大起重量</th>'
      +'<th class="col-metric">最大臂长</th>'
      +'<th class="col-metric">整机质量</th>'
      +'<th class="col-arrow"></th>'
      +'</tr></thead><tbody>';
    var rowsHtml=page.map(function(c,i){
    var imgPath = (c.images && c.images[0]) ? c.images[0] : '';
    var imgHtml = imgPath
      ? '<img src="'+imgPath+'" class="lib-tbl-img" onclick="showImgLightbox(this.src,event)" onerror="this.style.display=\'none\'">'
      : '<div class="lib-tbl-img lib-tbl-img-placeholder">🏗️</div>';
    return '<tr class="crd-row" onclick="openD('+c.id+')">'
      +'<td class="col-num">'+(start+i+1)+'</td>'
      +'<td class="col-img">'+imgHtml+'</td>'
      +'<td class="col-model lib-tbl-model">'+esc(c.model)+'</td>'
      +'<td class="col-brand">'+esc(c.brand||'')+'</td>'
      +'<td class="col-type"><span class="lib-badge '+typeClass(c.type)+'">'+esc(c.type||'')+'</span></td>'
      +'<td class="col-metric">'+(c.max_load_t?c.max_load_t+' <small>t</small>':'—')+'</td>'
      +'<td class="col-metric">'+(c.boom_max!=null?c.boom_max+' <small>m</small>':'—')+'</td>'
      +'<td class="col-metric">'+(c.total_weight_kg?(c.total_weight_kg/1000).toFixed(1)+' <small>t</small>':'—')+'</td>'
      +'<td class="lib-tbl-arrow">›</td>'
    +'</tr>';
  }).join('');
    grid.innerHTML=headerHtml+rowsHtml+'</tbody></table>';
  }
  if(pgn)pgn.innerHTML=(pg>1?'<button class="pgBtn" onclick="renderLib('+(pg-1)+')">← 上一页</button>':'')
    +'<span class="pgInfo">'+(start+1)+'–'+Math.min(start+_libPageSize,total)+' / '+total+' 台</span>'
    +(pg<pages?'<button class="pgBtn" onclick="renderLib('+(pg+1)+')">下一页 →</button>':'');
}

/* ── 快速选型（正确几何模型）───────────────────────────
   R = L1 × cos(α)          水平半径
   h = L1 × sin(α) + H_crane  吊钩高度
   L1_min = √(R² + (h_req - H_crane)²)
   ─────────────────────────────────────────────────── */

/* 场景切换：场景A=无建筑物（纯平面约束），场景B=有建筑物（碰撞检查） */
var _curScenario = 'A';
function toggleScenario(s){
  _curScenario = s;
  document.getElementById('sceneA').classList.toggle('active', s==='A');
  document.getElementById('sceneB').classList.toggle('active', s==='B');
  document.getElementById('sceneBFields').style.display = s==='B' ? '' : 'none';
  // 切换参数示意图 SVG
  document.getElementById('svgSceneA').style.display = s==='A' ? '' : 'none';
  document.getElementById('svgSceneB').style.display = s==='B' ? '' : 'none';
}

function doSelect(){
  var w=parseFloat((document.getElementById('sW')||{value:''}).value);
  var R=parseFloat((document.getElementById('sR')||{value:''}).value);
  var hInstall=parseFloat((document.getElementById('sH')||{value:''}).value)||0;  // 构件安装位置标高 Ha(m)
  var sf=parseFloat((document.getElementById('sS')||{value:'1.1'}).value)||1.1;

  // 碰撞参数（Hj/D）：场景A时强制归零，不做碰撞检查
  var hBuilding = 0, d = 0;
  if(_curScenario === 'B'){
    hBuilding = parseFloat((document.getElementById('sHt')||{value:''}).value)||0;
    d = parseFloat((document.getElementById('sD')||{value:''}).value)||0;
  }
  var Hc=parseFloat((document.getElementById('sHc')||{value:'1.5'}).value)||1.5; // 机械高度(m)
  var sortBy=(document.getElementById('sortBy')||{value:'eff'}).value;
  var typeFilter=(document.getElementById('sT')||{value:''}).value;
  if(!w||!R){toast('请输入构件重量和吊装半径');return;}
  buildMap();
  var req=w*sf;
  // 吊钩需达到的最小高度：构件安装位置 + 1m 安全净空
  var hRequired=hInstall>0?hInstall+1:0;

  // 显示几何分析提示
  var tipEl=document.getElementById('selectTipText');
  if(tipEl){
    var tipParts=['R='+R+'m'];
    if(hRequired>0)tipParts.push('吊钩≥'+hRequired.toFixed(1)+'m（安装'+hInstall.toFixed(1)+'m+1m净空）');
    if(d>0&&hBuilding>0){
      var alphaMin=Math.atan((hBuilding-Hc)/d)*180/Math.PI;
      tipParts.push('碰撞约束：建筑总高'+hBuilding+'m · d='+d+'m · α_min='+alphaMin.toFixed(1)+'°');
    }
    if(d>0&&hBuilding>0){
      tipEl.innerHTML='<strong>碰撞约束：</strong>'+tipParts.join(' · ');
    }else if(hRequired>0){
      tipEl.innerHTML='<strong>几何约束：</strong>'+tipParts.join(' · ');
    }else{
      tipEl.innerHTML='<strong>平面约束：</strong>仅考虑水平半径'+R+'m';
    }
  }

  var list=[];
  for(var i=0;i<data.cranes.length;i++){
    var c=data.cranes[i];
    if(typeFilter&&c.type!==typeFilter)continue;
    // 优先 main_boom 工况
    var pts=getCranePoints(c,'main_boom',null,null);
    if(!pts.length)pts=getCranePoints(c,null,null,null);
    var result=null;
    if(pts.length){
      result=findBestConfig(pts,c,R,hRequired,req,d,hBuilding,Hc,hInstall);
    }
    if(result){
      list.push({c:c,rated:result.rated,eff:w/result.rated*100,
        boomLen:result.mainBoom,boomNote:result.note,
        hMax:result.hMax,hReach:result.hReach,jibInfo:result.jibInfo,
        collision:result.collision||null});
    }else if(!pts.length&&c.max_load_t){
      // 无载荷表，用 max_load_t 估算
      var estRated=c.max_load_t*0.6;
      if(estRated>=req)list.push({c:c,rated:estRated,eff:w/estRated*100,
        boomLen:null,boomNote:'（载荷表无数据，仅估算）',hMax:null,hReach:null,jibInfo:''});
    }
  }

  var emptyEl=document.getElementById('emptyRes'),resEl=document.getElementById('results');
  if(!list.length){
    if(emptyEl)emptyEl.style.display='block';
    if(resEl)resEl.style.display='none';
    return;
  }
  if(emptyEl)emptyEl.style.display='none';

  // 排序
  if(sortBy==='eff')list.sort(function(a,b){return b.eff-a.eff;});
  else if(sortBy==='rated')list.sort(function(a,b){return b.rated-a.rated;});
  else if(sortBy==='boom')list.sort(function(a,b){return(a.boomLen||9999)-(b.boomLen||9999);});
  else list.sort(function(a,b){return(b.c.max_load_t||0)-(a.c.max_load_t||0);});

  var summary=document.getElementById('resultSummary');
  if(summary){
    var cond='R='+R+'m';
    if(hRequired>0)cond+=' · h≥'+hRequired.toFixed(1)+'m';
    cond+=' · 构件'+w+'t×'+sf+'='+req.toFixed(1)+'t';
    summary.innerHTML='<strong>'+list.length+' 台可选机械</strong><span>'+cond+'</span>';
  }
  var resultList=document.getElementById('resultList');if(!resultList)return;
  var rankLabels=['🥇','🥈','🥉'],rankClasses=['r1','r2','r3'],html='',count=Math.min(list.length,50);
  for(var j=0;j<count;j++){
    var item=list[j],eff=parseFloat(item.eff.toFixed(1));
    var rl=j<3?rankLabels[j]:'',rc=j<3?rankClasses[j]:'rn';
    var boomDesc=item.boomLen?
      '<div class="res-boom">主臂'+item.boomLen.toFixed(1)+'m'+esc(item.jibInfo||'')+'</div>':
      '<div class="res-boom res-boom-est">'+esc(item.boomNote||'')+'</div>';
    var heightNote='';
    if(item.hMax!==null&&hRequired>0){
      var hTag=item.hMax>=hRequired?'✓':'⚡';
      heightNote='<span class="h-note" title="最大吊高:'+item.hMax.toFixed(1)+'m 需求:'+hRequired.toFixed(1)+'m">'+hTag+'</span>';
    }
    // 碰撞标识
    var collisionNote='';
    var rowClass='';
    if(item.collision){
      if(item.collision.status==='danger'){
        collisionNote='<span class="col-badge col-danger" title="实际仰角'+item.collision.alpha_actual.toFixed(1)+'° &lt; 最小'+item.collision.alpha_min.toFixed(1)+'°">⚠碰撞</span>';
        rowClass=' res-danger';
      }else if(item.collision.status==='warn'){
        collisionNote='<span class="col-badge col-warn" title="实际仰角'+item.collision.alpha_actual.toFixed(1)+'° ≈ 最小'+item.collision.alpha_min.toFixed(1)+'°（偏紧）">⚠偏紧</span>';
        rowClass=' res-warn';
      }else{
        collisionNote='<span class="col-badge col-safe" title="实际仰角'+item.collision.alpha_actual.toFixed(1)+'° ≥ 最小'+item.collision.alpha_min.toFixed(1)+'°">✓安全</span>';
      }
    }
    html+='<div class="res'+rowClass+'" onclick="openD('+item.c.id+')">'
      +'<div class="rank '+rc+'">'+rl+'</div>'
      +'<div class="res-model">'+esc(item.c.model||'')+'</div>'
      +'<div class="res-brand">'+esc(item.c.brand||'')+'</div>'
      +'<div class="res-type"><span class="badge '+typeClass(item.c.type||'')+'">'+esc(item.c.type||'')+'</span></div>'
      +'<div class="res-boom">'+esc(item.boomNote||'')+heightNote+' '+collisionNote+'</div>'
      +'<div class="res-rated">'+item.rated.toFixed(1)+' t</div>'
      +'<div>'+effBadge(eff)+'</div>'
      +'<div class="res-max">'+(item.c.max_load_t||'—')+' t</div>'
      +'<div class="res-action"><button class="btn-detail" onclick="event.stopPropagation();openD('+item.c.id+')">详情</button></div>'
    +'</div>';
  }
  if(list.length>50)html+='<div style="text-align:center;padding:12px;color:var(--muted);font-size:13px">显示前 50 台</div>';
  resultList.innerHTML=html;resEl.style.display='block';

  // 公式区（碰撞校核时有意义，显示计算过程）
  var formulaEl=document.getElementById('resultFormula');
  if(formulaEl&&d>0&&hBuilding>0){
    var alphaMin=Math.atan((hBuilding-Hc)/d)*180/Math.PI;
    // 以列表第一个合格结果为例展示公式
    var ex=list[0];
    var L1_ex=ex&&ex.boomLen?ex.boomLen:null;
    var h_ex=ex&&ex.hMax?ex.hMax:null;
    var R_ex=R;
    var alphaExStr='',calcExStr='';
    if(L1_ex&&L1_ex>R_ex){
      var cosA=Math.min(1,R_ex/L1_ex);
      var alphaEx=Math.acos(cosA)*180/Math.PI;
      alphaExStr='α=arccos('+R_ex.toFixed(1)+'÷'+L1_ex.toFixed(1)+')='+alphaEx.toFixed(1)+'°';
      calcExStr='L₁=√('+R_ex.toFixed(1)+'²+('+h_ex.toFixed(1)+'−'+Hc+')²)='+L1_ex.toFixed(1)+'m';
    }
    formulaEl.innerHTML=
      '<div class="formula-block">'+
        '<div class="formula-title">📐 碰撞几何校核</div>'+
        '<div class="formula-row"><span class="fl">最小安全仰角</span><span class="fr">α_min = arctan((Hj−h)÷D) = arctan(('+hBuilding.toFixed(1)+'−'+Hc+')÷'+d.toFixed(1)+') = <strong>'+alphaMin.toFixed(1)+'°</strong></span></div>'+
        (L1_ex?('<div class="formula-row"><span class="fl">最短可行臂长</span><span class="fr">'+calcExStr+'</span></div>'+
        '<div class="formula-row"><span class="fl">实际臂架仰角</span><span class="fr">'+alphaExStr+' &nbsp;→&nbsp; <span class="'+(ex.collision&&ex.collision.status==='danger'?'fdanger':ex.collision&&ex.collision.status==='warn'?'fwarn':'fsafe')+'">'+
        (ex.collision&&ex.collision.status==='danger'?'⚠ 碰撞风险':ex.collision&&ex.collision.status==='warn'?'⚠ 净空偏紧':'✓ 净空安全')+'</span></span></div>'):'')+
      '</div>';
    formulaEl.style.display='';
  }else if(formulaEl){
    formulaEl.style.display='none';
  }

  setTimeout(function(){resEl.scrollIntoView({behavior:'smooth',block:'start'});},100);
}

/*
  找最优配置：给定半径R、所需吊钩高度hReq、所需载荷req
  对所有载荷点分组，计算几何可行解，再找载荷满足条件的
  可选碰撞校核：d=结构距离(m), H_b=结构高度(m)
  碰撞判定：α_min = arctan((H_b-H)/d), α_actual = arccos(R/L1)
            α_actual < α_min → 碰撞
  返回 {mainBoom, rated, note, hMax, hReach, jibInfo, collision:{status,alpha_min,alpha_actual,d,H_b}}
*/
function findBestConfig(pts,c,R,hReq,req,d,H_b,Hc,hInstall){
  // H_b: 建筑总高 Hj（碰撞计算用）；Hc: 机械高度 h；hInstall: 构件安装位置标高 Ha
  var H=Hc!=null&&Hc!==undefined?Hc:(c.hook_pivot_h||2.0);
  var collisionInput=null;

  // 若提供了碰撞参数，计算最小安全仰角
  if(d>0&&H_b>H){
    // α_min = arctan((H_b-H)/d)，高于此角度才能越过结构
    var alphaMin=Math.atan((H_b-H)/d)*180/Math.PI;
    collisionInput={d:d,H_b:H_b,alpha_min:alphaMin,H:H};
  }
  // 按(主臂长, 副臂长, 副臂角)分组
  var configs={};
  for(var i=0;i<pts.length;i++){
    var p=pts[i];
    if(p.boom_length==null||p.radius==null||p.rated_load==null)continue;
    var L1=parseFloat(p.boom_length);
    var Ljib=(p.jib_length!=null)?parseFloat(p.jib_length):0;
    var angJib=(p.jib_angle!=null)?parseFloat(p.jib_angle.replace('°','')):null;
    var key=L1+'|'+Ljib+'|'+(angJib||'');
    if(!configs[key])configs[key]={L1:L1,Ljib:Ljib,angJib:angJib,rows:[]};
    configs[key].rows.push(p);
  }

  var best=null;
  // 按主臂长升序（越短越经济）
  var keys=Object.keys(configs).sort(function(a,b){
    return parseFloat(a.split('|')[0])-parseFloat(b.split('|')[0]);
  });

  for(var ki=0;ki<keys.length;ki++){
    var cfg=configs[keys[ki]];
    var L1=cfg.L1,Ljib=cfg.Ljib,angJib=cfg.angJib;
    var rows=cfg.rows;

    // 该配置能达到的最大半径
    var maxR=Math.max.apply(null,rows.map(function(p){return p.radius||0;}));
    var minR=Math.min.apply(null,rows.map(function(p){return p.radius||0;}));
    if(R<minR||R>maxR)continue;  // 目标半径超出能力范围

    // 计算该臂长在此半径的理论最大吊钩高度
    // R = L1 × cos(α)  →  cos(α) = R/L1
    // h = L1 × sin(α) + H  →  sin(α) = √(1 - cos²α) = √(L1² - R²) / L1
    // h = √(L1² - R²) + H
    if(R>L1)continue;  // 臂长小于半径，物理上不可能
    var hAtR=Math.sqrt(Math.max(0,L1*L1-R*R))+H;

    // 如果有副臂，加上副臂贡献的高度
    var hMax=hAtR;
    var jibInfo='';
    if(Ljib>0&&angJib!==null&&angJib!==''){
      // jib角是相对于水平面的仰角（jib升起）
      // jib尖端高度贡献 = Ljib × sin(angJib)
      var angJ=angJib*Math.PI/180;
      var hJibAdd=Ljib*Math.sin(angJ);
      hMax=hAtR+hJibAdd;
      jibInfo=' + 副臂'+Ljib+'m ∠'+angJib+'°';
    }

    // 高度是否满足要求？
    if(hReq>0&&hMax<hReq)continue;  // 高度不够，跳过

    // 找该半径对应的额定载荷（取最大）
    var ratedAtR=0;
    for(var ri=0;ri<rows.length;ri++){
      var p=rows[ri];
      if(Math.abs((p.radius||0)-R)<0.5){
        ratedAtR=Math.max(ratedAtR,p.rated_load||0);
      }
    }
    if(ratedAtR<req)continue;  // 载荷不够

    // 满足所有条件，选最短主臂
    var note=[];
    if(hReq>0)note.push('h='+hMax.toFixed(1)+'m');

    // 碰撞校核：计算该配置的吊臂实际仰角
    var collision=null;
    if(collisionInput){
      // 实际仰角：α = arccos(R/L1)
      var cosA=Math.min(1,R/L1);  // 防止浮点误差
      var alphaActual=Math.acos(cosA)*180/Math.PI;
      var status=alphaActual>=collisionInput.alpha_min?'safe':
                  alphaActual>=collisionInput.alpha_min-2?'warn':'danger';
      collision={status:status,alpha_min:collisionInput.alpha_min,alpha_actual:alphaActual,
                 d:collisionInput.d,H_b:collisionInput.H_b};
    }

    best={mainBoom:L1,rated:ratedAtR,
          note:note.join(' · ')||(Ljib>0?'副臂'+Ljib+'m∠'+angJib+'°':'主臂'+L1+'m'),
          hMax:hMax,hReach:R,jibInfo:jibInfo,collision:collision};
    break;  // 已按主臂长升序，第一个就是最短的
  }
  return best;
}

/* ── 详情页（全屏）────────────────────────────────── */
function openD(id){
  buildMap();cur=_craneMap[id];window._selectedCraneId=id;
  if(!cur){toast('机型不存在');return;}
  _dCurType='';_dCurCond='';_dCurCg='';
  _dCurBoomLen='';_dCurJibLen='';
  // 隐藏所有 page，显示详情页
  var detailPage=document.getElementById('page-detail');
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
  detailPage.classList.add('active');
  detailPage.style.display='';
  document.getElementById('dModel').textContent=cur.model||'';
  document.getElementById('dBrand').textContent=cur.brand||'';
  var dImg=document.getElementById('dImg');
  if(dImg){
    var imgPath=cur.images&&cur.images[0]?cur.images[0]:'';
    if(imgPath){dImg.src=imgPath;dImg.style.display='';}else{dImg.style.display='none';}
  }
  var dB=document.getElementById('dBadge');
  dB.textContent=cur.type||'';dB.className='type-badge '+typeClass(cur.type||'');
  renderSpecTab();
  buildCondSelectors();
  updateQBoomSelect();
  initSpreadTab();
  switchTab('spec');
}

function closeDetail(){
  var detailPage=document.getElementById('page-detail');

  // 立即隐藏详情页
  detailPage.classList.remove('active');
  detailPage.style.display='none';

  // 强制重绘，同步 DOM 变更
  void detailPage.offsetHeight;

  // 恢复详情页 display（供下次打开）
  detailPage.style.display='';

  // 步骤5：智能返回：回到来源页
  var targetPage = _prevPage || 'lib';
  var pg = document.getElementById('page-'+targetPage);
  if(pg) pg.classList.add('active');
  var navBtn=document.getElementById('nav-'+targetPage);if(navBtn)navBtn.classList.add('active');

  cur=null;_dCurType='';_dCurCond='';_dCurCg='';_dCurBoomLen='';_dCurJibLen='';
  window.scrollTo(0,0);
}

function openCraneInLib(){
  closeDetail();
  setTimeout(function(){
    sp('lift');
    // 自动填入当前机型
    var craneSel=document.getElementById('lift-crane');
    if(craneSel&&cur){
      craneSel.value=cur.id;
      liftOnCraneChange();
    }
  },50);
}

/* ── 机械图册 ───────────────────────────────────────── */
var GALLERY_BASE = '';  // HTTP服务根 = crane-portable/

function getCraneImageFolder(crane){
  if(!crane)return null;
  var brand=(crane.brand||'').toUpperCase();
  var type=crane.type||'';
  var model=(crane.model||'').toUpperCase().replace(/\s/g,'');
  // 中联：zoomlion_images/{truck_crawler}/{model}/
  if(brand.includes('中联')||brand.includes('ZOOMLION')||brand.includes('ZLO')){
    var sub=type==='履带吊'?'crawler_crane':'truck_crane';
    return GALLERY_BASE+'zoomlion_images/'+sub+'/'+model+'/';
  }
  // 三一：stc160e_pages/（仅 STC160E 有现成数据）
  if(brand.includes('三一')||brand.includes('SANY')||brand.includes('SAC')){
    if(model.includes('STC160'))return GALLERY_BASE+'stc160e_pages/';
    // 其他三一暂无图片目录
    return null;
  }
  // 徐工：待补充
  if(brand.includes('徐工')||brand.includes('XCMG'))return null;
  return null;
}

function renderGalleryTab(){
  var mainEl=document.getElementById('galleryMain');
  var thumbsEl=document.getElementById('galleryThumbs');
  var infoEl=document.getElementById('galleryInfo');
  if(!mainEl||!thumbsEl)return;
  if(!cur){
    mainEl.innerHTML='<div class="gallery-placeholder">请先选择一个机型</div>';
    thumbsEl.innerHTML='';return;
  }

  // 优先级1：crane.images（机械基础信息中配置的图片URL数组）
  if(cur.images&&Array.isArray(cur.images)&&cur.images.length>0){
    var imgs=cur.images.filter(function(u){return u&&typeof u==='string';});
    if(imgs.length){
      if(infoEl)infoEl.textContent='📷 机械立面图（'+imgs.length+'张）';
      thumbsEl.innerHTML=imgs.map(function(src,i){
        return'<img class="gallery-thumb" src="'+escAttr(src)+'" onclick="gallerySelect('+i+',null,imgs)" title="图片 '+(i+1)+'/'+imgs.length+'">';
      }).join('');
      galleryShowImg(imgs[0],imgs);
      return;
    }
  }

  // 优先级2：从目录枚举
  var folder=getCraneImageFolder(cur);
  if(!folder){
    mainEl.innerHTML='<div class="gallery-placeholder">📷 暂无机械图册<br><small>在机械基础信息中配置 images 字段</small><br><small>或放入 crane_images/{品牌}/{型号}/ 目录</small></div>';
    thumbsEl.innerHTML='';
    if(infoEl)infoEl.textContent='无图册';
    return;
  }
  if(infoEl)infoEl.textContent='📂 '+folder;
  fetch(folder).then(function(r){return r.text();}).then(function(html){
    var parser=new DOMParser();
    var doc=parser.parseFromString(html,'text/html');
    var links=[].slice.call(doc.querySelectorAll('a')).map(function(a){return a.href;});
    var imgs=links.filter(function(h){return/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(h);});
    if(!imgs.length){
      mainEl.innerHTML='<div class="gallery-placeholder">📷 文件夹存在但未找到图片<br><small>'+folder+'</small></div>';
      thumbsEl.innerHTML='';return;
    }
    thumbsEl.innerHTML=imgs.map(function(src,i){
      return'<img class="gallery-thumb" src="'+escAttr(src)+'" onclick="gallerySelect('+i+',null,imgs)" title="图片 '+(i+1)+'/'+imgs.length+'">';
    }).join('');
    galleryShowImg(imgs[0],imgs);
  }).catch(function(){
    mainEl.innerHTML='<div class="gallery-placeholder">📷 无法加载图册<br><small>图片路径：'+folder+'</small></div>';
    thumbsEl.innerHTML='';
  });
}

function galleryShowImg(src,imgs){
  var mainEl=document.getElementById('galleryMain');
  if(!mainEl)return;
  mainEl.innerHTML='<img class="gallery-img" src="'+escAttr(src)+'" onclick="galleryToggleFullscreen(\''+escAttr(src)+'\')" title="点击全屏">';
}

function gallerySelect(idx,folder,imgs){
  if(!imgs||!imgs[idx])return;
  galleryShowImg(imgs[idx],imgs);
  document.querySelectorAll('.gallery-thumb').forEach(function(t,i){t.classList.toggle('active',i===idx);});
}

function galleryToggleFullscreen(src){
  var win=window.open(src,'_blank');
  if(win)win.focus();
}

function escAttr(s){return String(s).replace(/'/g,'%27').replace(/"/g,'%22');}

function dparam(v,unit,label){
  var val=v!=null?v+unit:'—';
  return '<div class="dparam"><div class="dparam-v">'+val+'</div><div class="dparam-l">'+label+'</div></div>';
}

function renderSpecTab(){
  var c=cur,html='';
  html+='<div class="spec-group"><div class="spec-group-title">基础性能</div>';
  html+=dparam(c.max_load_t,'t','最大起重量');
  html+=dparam(c.boom_min,'m','主臂最短');
  html+=dparam(c.boom_max,'m','主臂最长');
  html+=dparam(c.jib_standard,'m','标准副臂');
  html+=dparam(c.jib_optional,'m','选配副臂');
  if(c.jib_angle_range)html+=dparam(c.jib_angle_range,'','副臂角度范围');
  html+='</div>';
  html+='<div class="spec-group"><div class="spec-group-title">整机尺寸</div>';
  html+=dparam(c.overall_length!=null?c.overall_length.toFixed(2):null,'m','整车长度');
  html+=dparam(c.overall_width!=null?c.overall_width.toFixed(2):null,'m','整车宽度');
  html+=dparam(c.overall_height!=null?c.overall_height.toFixed(2):null,'m','整车高度');
  html+=dparam(c.total_weight_kg!=null?(c.total_weight_kg/1000).toFixed(1):null,'t','整机质量');
  html+='</div>';
  html+='<div class="spec-group"><div class="spec-group-title">通行与支腿</div>';
  html+=dparam(c.min_turn_radius,'m','最小转弯半径');
  html+=dparam(c.tail_radius,'m','尾部回转半径');
  html+=dparam(c.outrigger_span_h,'m','支腿跨距-横向');
  html+=dparam(c.outrigger_span_v,'m','支腿跨距-纵向');
  html+='</div>';
  html+='<div class="spec-group"><div class="spec-group-title">费用</div>';
  var rentMonthStr=c.rental_fee_month!=null?'¥'+c.rental_fee_month.toLocaleString()+' /月':'待补充';
  html+='<div class="dparam"><div class="dparam-v" style="'+(c.rental_fee_month!=null?'':'color:var(--muted)')+'">'+rentMonthStr+'</div><div class="dparam-l">租赁费/月</div></div>';
  var rentShiftStr=c.rental_fee_shift!=null?'¥'+c.rental_fee_shift.toLocaleString()+' /台班':'待补充';
  html+='<div class="dparam"><div class="dparam-v" style="'+(c.rental_fee_shift!=null?'':'color:var(--muted)')+'">'+rentShiftStr+'</div><div class="dparam-l">租赁费/台班</div></div>';
  var fuelStr=c.fuel_fee!=null?'¥'+c.fuel_fee.toLocaleString()+' /台班':'待补充';
  html+='<div class="dparam"><div class="dparam-v" style="'+(c.fuel_fee!=null?'':'color:var(--muted)')+'">'+fuelStr+'</div><div class="dparam-l">燃油费/台班</div></div>';
  html+='</div>';
  document.getElementById('dParams').innerHTML=html;
}

/* ── 性能表：三级工况选择器 ──────────────────────────── */
function buildCondSelectors(){
  var lc=cur.load_charts||{};
  var typeSel=document.getElementById('typeSelect');
  var condSel=document.getElementById('condSelect');
  var availTypes=TYPE_ORDER.filter(function(k){return!!lc[k];});
  Object.keys(lc).forEach(function(k){if(availTypes.indexOf(k)<0)availTypes.push(k);});
  typeSel.innerHTML='<option value="">全部类型</option>'+availTypes.map(function(k){
    return '<option value="'+k+'">'+(TYPE_LABELS[k]||k)+'</option>';
  }).join('');
  typeSel.style.display='inline-block';
  condSel.innerHTML='<option value="">全部工况</option>';
  condSel.style.display='none';
  var cgSel=document.getElementById('cgSelect');
  if(cgSel){cgSel.innerHTML='<option value="">全部配重/支腿</option>';cgSel.style.display='none';}
  updateCondSelect();
  renderPerfTable();
}
function updateCondSelect(){
  var lc=cur.load_charts||{},condSel=document.getElementById('condSelect');
  var condSet={},types=_dCurType?[_dCurType]:Object.keys(lc);
  for(var ti=0;ti<types.length;ti++){var t=types[ti];if(!lc[t])continue;Object.keys(lc[t]).forEach(function(c){condSet[c]=true;});}
  var conds=Object.keys(condSet);
  if(conds.length>1){
    condSel.innerHTML='<option value="">全部工况</option>'+conds.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('');
    condSel.style.display='inline-block';
  }else if(conds.length===1){
    condSel.innerHTML='<option value="'+esc(conds[0])+'">'+esc(conds[0])+'</option>';
    _dCurCond=conds[0];condSel.style.display='none';
  }else{condSel.innerHTML='<option value="">—</option>';condSel.style.display='none';}
  updateCgSelect();
}
function updateCgSelect(){
  var lc=cur.load_charts||{},cgSel=document.getElementById('cgSelect');if(!cgSel)return;
  var cgSet={},types=_dCurType?[_dCurType]:Object.keys(lc);
  for(var ti=0;ti<types.length;ti++){
    var tKey=types[ti];if(!lc[tKey])continue;
    var conds=_dCurCond?[_dCurCond]:Object.keys(lc[tKey]);
    for(var ci=0;ci<conds.length;ci++){var cKey=conds[ci];if(!lc[tKey][cKey])continue;Object.keys(lc[tKey][cKey]).forEach(function(g){cgSet[g]=true;});}
  }
  var cgs=Object.keys(cgSet).sort();
  if(cgs.length>1){
    cgSel.innerHTML='<option value="">全部（取最大值）</option>'+cgs.map(function(g){
      var parts=g.split('|');
      var label=(parts[0]?'配重: '+parts[0]:'')+(parts[1]?' | 支腿: '+parts[1]:'');
      return '<option value="'+esc(g)+'">'+esc(label||g)+'</option>';
    }).join('');
    cgSel.style.display='inline-block';
  }else if(cgs.length===1){
    var p=cgs[0].split('|'),lbl=(p[0]?'配重: '+p[0]:'')+(p[1]?' | 支腿: '+p[1]:'');
    cgSel.innerHTML='<option value="'+esc(cgs[0])+'">'+esc(lbl||cgs[0])+'</option>';
    _dCurCg=cgs[0];cgSel.style.display='none';
  }else{cgSel.innerHTML='<option value="">—</option>';cgSel.style.display='none';}
}
function onTypeChange(){
  var sel=document.getElementById('typeSelect');
  _dCurType=sel?sel.value:'';_dCurCond='';_dCurCg='';_dCurBoomLen='';_dCurJibLen='';
  updateCondSelect();renderPerfTable();
}
function onCondChange(){
  var sel=document.getElementById('condSelect');
  _dCurCond=sel?sel.value:'';_dCurCg='';_dCurBoomLen='';_dCurJibLen='';
  updateCgSelect();renderPerfTable();
}
function onCgChange(){
  var sel=document.getElementById('cgSelect');
  _dCurCg=sel?sel.value:'';renderPerfTable();
}

function onBoomLenChange(){
  var sel=document.getElementById('boomLenSelect');
  _dCurBoomLen=sel?sel.value:'';_dCurJibLen='';
  renderPerfTable();
}
function onJibLenChange(){
  var sel=document.getElementById('jibLenSelect');
  _dCurJibLen=sel?sel.value:'';renderPerfTable();
}

/* ── 性能表渲染（热力图 + 主臂长度筛选 + 副臂信息）──── */
function hasJibData(pts){
  for(var i=0;i<pts.length;i++){
    if(pts[i].jib_length!=null||pts[i].jib_angle!=null)return true;
  }
  return false;
}
function getJibInfoBadge(pts){
  var jibs={},angles={};
  for(var i=0;i<pts.length;i++){
    var p=pts[i];
    if(p.jib_length!=null)jibs[p.jib_length]=true;
    if(p.jib_angle!=null)angles[p.jib_angle]=true;
  }
  var jibLens=Object.keys(jibs).map(Number).sort(function(a,b){return a-b;});
  var jibAngs=Object.keys(angles).sort();
  var parts=[];
  if(jibLens.length>0){
    if(jibLens.length<=3)parts.push('副臂长度: '+jibLens.map(function(v){return v+'m';}).join(' / '));
    else parts.push('副臂长度: '+jibLens[0]+'~'+jibLens[jibLens.length-1]+'m');
  }
  if(jibAngs.length>0&&jibAngs[0])parts.push('副臂角: '+jibAngs.join(' / '));
  if(parts.length)return'<div class="jib-badge">'+parts.join(' &nbsp;·&nbsp; ')+'</div>';
  return'';
}

function renderPerfTable(){
  var el=document.getElementById('perfTableWrap');if(!el)return;
  if(!cur){el.innerHTML='<div style="color:var(--muted);text-align:center;padding:40px">请先选择机械</div>';return;}
  var pts=getCranePoints(cur,_dCurType||null,_dCurCond||null,_dCurCg||null);
  if(!pts.length){el.innerHTML='<div style="color:var(--muted);text-align:center;padding:40px">无载荷表数据</div>';updatePerfDataInfo(0,0);return;}

  var isJib=hasJibData(pts);
  var jibBadge=getJibInfoBadge(pts);

  // 收集所有臂长并更新 boomLenSelect
  var boomSet={};
  for(var i=0;i<pts.length;i++){
    var p=pts[i];if(p.boom_length!=null)boomSet[p.boom_length]=true;
  }
  var allBooms=Object.keys(boomSet).map(Number).sort(function(a,b){return a-b;});
  var boomSel=document.getElementById('boomLenSelect');
  if(boomSel){
    var curVal=_dCurBoomLen;
    var opts=allBooms.map(function(b){return'<option value="'+b+'"'+(String(curVal)===String(b)?' selected':'')+'>'+b+'m</option>';}).join('');
    boomSel.innerHTML='<option value="">全部臂长（'+allBooms.length+'种）</option>'+opts;
  }

  // 副臂长度分组（用于简化表）
  var jibLenSelectEl=document.getElementById('jibLenSelect');
  var jibLabel=document.getElementById('jibLabel');
  var jibLens={};
  for(var i=0;i<pts.length;i++){
    var p=pts[i];if(p.jib_length!=null)jibLens[p.jib_length]=true;
  }
  var allJibLens=Object.keys(jibLens).map(Number).sort(function(a,b){return a-b;});
  if(jibLenSelectEl){
    if(allJibLens.length>1){
      var curJL=_dCurJibLen||'';
      var opts2=allJibLens.map(function(j){return'<option value="'+j+'"'+(String(curJL)===String(j)?' selected':'')+'>'+j+'m</option>';}).join('');
      jibLenSelectEl.innerHTML='<option value="">全部副臂</option>'+opts2;
      jibLenSelectEl.style.display='inline-block';
      if(jibLabel)jibLabel.style.display='inline-block';
    }else{jibLenSelectEl.style.display='none';if(jibLabel)jibLabel.style.display='none';}
  }

  // 如果指定了臂长 → 简化表格
  if(_dCurBoomLen!==''){
    var filtered=pts.filter(function(p){return Math.abs((p.boom_length||0)-(_dCurBoomLen||0))<0.5;});
    if(_dCurJibLen!==''&&_dCurJibLen!=null){
      filtered=filtered.filter(function(p){return Math.abs((p.jib_length||0)-(_dCurJibLen||0))<0.5;});
    }
    filtered.sort(function(a,b){return(a.radius||0)-(b.radius||0);});
    if(!filtered.length){
      el.innerHTML='<div style="color:var(--muted);text-align:center;padding:40px">该组合无数据</div>';
      updatePerfDataInfo(0,allBooms.length);return;
    }
    var maxLoad=Math.max.apply(null,filtered.map(function(p){return p.rated_load||0;}));
    var hiT=maxLoad*0.60,loT=maxLoad*0.30;
    var rows=filtered.map(function(p){
      var q=p.rated_load||0;
      var cls=q>=hiT?'simp-cell hi':q>=loT?'simp-cell mid':q>0?'simp-cell lo':'simp-cell empty';
      var mainB=p.main_boom_length||p.boom_length||'—';
      var jibL=p.jib_length!=null?p.jib_length:'—';
      var jibA=p.jib_angle||'';
      var extraCols=isJib?'<td class="simp-jib">'+jibL+'m</td><td class="simp-jib">'+jibA+'</td>':'';
      return'<tr><td class="simp-r">'+p.radius+'</td>'+extraCols+'<td class="'+cls+'">'+(q>0?q.toFixed(1):'—')+'</td></tr>';
    }).join('');
    var thExtra=isJib?'<th>副臂长(m)</th><th>副臂角</th>':'';
    el.innerHTML=(jibBadge||'')
      +'<div class="perf-simp-wrap">'
      +'<table class="perf-simp-table"><thead><tr><th>吊装半径 (m)</th>'+thExtra+'<th>额定载荷 (t)</th></tr></thead><tbody>'+rows+'</tbody></table>'
      +'</div><div class="perf-legend">'
      +'<span class="pl-hi">■ 高载荷（≥60%）</span><span class="pl-mid">■ 中载荷（30-60%）</span><span class="pl-lo">■ 低载荷（&lt;30%）</span>'
      +'</div>';
    updatePerfDataInfo(filtered.length,allBooms.length);updateQBoomSelect();return;
  }

  // 全览热力图
  var radiusSet={},lookup={},globalMax=0;
  for(var i=0;i<pts.length;i++){
    var p=pts[i];if(p.boom_length==null||p.radius==null)continue;
    radiusSet[p.radius]=true;
    if(!lookup[p.boom_length])lookup[p.boom_length]={};
    var q=p.rated_load||0;
    if(!lookup[p.boom_length][p.radius]||q>lookup[p.boom_length][p.radius])lookup[p.boom_length][p.radius]=q;
    if(q>globalMax)globalMax=q;
  }
  var radii=Object.keys(radiusSet).map(Number).sort(function(a,b){return a-b;});
  if(!allBooms.length||!radii.length){el.innerHTML=(jibBadge||'')+'<div style="color:var(--muted);text-align:center;padding:40px">无有效数据</div>';updatePerfDataInfo(0,allBooms.length);return;}
  var hiThresh=globalMax*0.60,loThresh=globalMax*0.30;
  var thead='<tr><th class="perf-th-radius">幅度<br>(m)</th>'+allBooms.map(function(b){return'<th class="perf-th-boom">'+b+'m<br><span class="boom-sub">主臂</span></th>';}).join('')+'</tr>';
  var tbody='';
  for(var ri=0;ri<radii.length;ri++){
    var rr=radii[ri];
    tbody+='<tr><td class="perf-td-radius">'+rr+'</td>';
    for(var bi=0;bi<allBooms.length;bi++){
      var bb=allBooms[bi],q2=(lookup[bb]&&lookup[bb][rr])||0;
      var cls=q2>=hiThresh?'perf-cell hi':q2>=loThresh?'perf-cell mid':q2>0?'perf-cell lo':'perf-cell empty';
      tbody+='<td class="'+cls+'" title="'+bb+'m主臂 / '+rr+'m幅度">'+(q2>0?q2.toFixed(1):'—')+'</td>';
    }
    tbody+='</tr>';
  }
  el.innerHTML=(jibBadge||'')+'<div class="perf-scroll"><table class="perf-table"><thead>'+thead+'</thead><tbody>'+tbody+'</tbody></table></div>'
    +'<div class="perf-legend">'
    +'<span class="pl-hi">■ 高载荷（≥60%）</span><span class="pl-mid">■ 中载荷（30-60%）</span><span class="pl-lo">■ 低载荷（&lt;30%）</span>'
    +'</div>';
  updatePerfDataInfo(pts.length,allBooms.length);updateQBoomSelect();
}

function updatePerfDataInfo(ptCount,boomCount){
  var el=document.getElementById('perfDataInfo');
  if(el)el.textContent=(ptCount?ptCount+' 条数据 / ':'')+(boomCount?boomCount+' 种臂长':'');
}

window.perfExportCsv=function(){
  var pts=getCranePoints(cur,_dCurType||null,_dCurCond||null,_dCurCg||null);
  if(!pts||!pts.length){toast('无性能表数据');return;}
  var boomSet={},radiusSet={},lookup={};
  for(var i=0;i<pts.length;i++){
    var p=pts[i];if(p.boom_length==null||p.radius==null)continue;
    boomSet[p.boom_length]=true;radiusSet[p.radius]=true;
    if(!lookup[p.boom_length])lookup[p.boom_length]={};
    var q=p.rated_load||0;
    if(!lookup[p.boom_length][p.radius]||q>lookup[p.boom_length][p.radius])lookup[p.boom_length][p.radius]=q;
  }
  var booms=Object.keys(boomSet).map(Number).sort(function(a,b){return a-b;});
  var radii=Object.keys(radiusSet).map(Number).sort(function(a,b){return a-b;});
  var csv='\uFEFF幅度(m)'+booms.map(function(b){return','+b+'m';}).join('')+'\n';
  for(var ri=0;ri<radii.length;ri++){
    var r=radii[ri];
    csv+=r+booms.map(function(b){var q=lookup[b]&&lookup[b][r]?lookup[b][r]:0;return ','+(q>0?q.toFixed(1):'');}).join('')+'\n';
  }
  var name=cur?(cur.brand+' '+cur.model):'性能表';
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=name+'_性能表_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  toast('已导出 '+booms.length+'列×'+radii.length+'行');
};

/* ── 性能验算 ────────────────────────────────────────── */
function updateQBoomSelect(){
  var qBoom=document.getElementById('qBoom');if(!qBoom||!cur)return;
  var pts=getCranePoints(cur,_dCurType||null,_dCurCond||null,_dCurCg||null);
  var boomSet={};for(var i=0;i<pts.length;i++)if(pts[i].boom_length!=null)boomSet[pts[i].boom_length]=true;
  var booms=Object.keys(boomSet).map(Number).sort(function(a,b){return a-b;});
  qBoom.innerHTML=booms.map(function(b){return'<option value="'+b+'">'+b+'m</option>';}).join('');
}
function runQ(){
  var r=parseFloat((document.getElementById('qR')||{value:''}).value);
  var w=parseFloat((document.getElementById('qW')||{value:''}).value)||0;
  var b=parseFloat((document.getElementById('qBoom')||{value:''}).value)||0;
  if(!r){toast('请输入吊装半径');return;}
  if(!cur){toast('请先选择机械');return;}
  var pts=getCranePoints(cur,_dCurType||null,_dCurCond||null,_dCurCg||null);
  if(b)pts=pts.filter(function(p){return Math.abs((p.boom_length||0)-b)<0.5;});
  var rated=interpFast(pts,r);
  var el=document.getElementById('qResult');if(!el)return;
  var detail='Q = Q₁ + (Q₂−Q₁)×(R−R₁)/(R₂−R₁)  【线性差值法】';
  if(w){
    var eff=w/rated*100,label=eff<80?'合理，可以使用':eff<=90?'偏紧，注意安全':'危险，不建议使用';
    el.innerHTML='<div class="qrated">'+rated.toFixed(2)+' <span>t</span></div>'
      +'<div class="qdetail">'+detail+'</div>'
      +'<div class="qdetail">构件 '+w+'t → 效率 '+effBadge(eff)+' '+label+'</div>';
  }else{
    el.innerHTML='<div class="qrated">'+rated.toFixed(2)+' <span>t</span></div><div class="qdetail">'+detail+'</div>';
  }
}

/* ── 碰撞分析 ───────────────────────────────────────── */
function runCol(){
  var dist=parseFloat((document.getElementById('colDist')||{value:''}).value);
  var bh=parseFloat((document.getElementById('colBH')||{value:''}).value);
  var btY=parseFloat((document.getElementById('colBT')||{value:''}).value);
  var qBoom=document.getElementById('qBoom');var boom=parseFloat(qBoom?qBoom.value:'0')||0;
  if(!dist||!bh){toast('请输入站位距离和建筑高度');return;}
  document.getElementById('colSvg').innerHTML=buildCollisionSVG(dist,bh,btY||(boom*0.7)||45,boom);
}
function buildCollisionSVG(dist,bh,btAngle,boom){
  var W=580,H=300,ml=50,mb=40,mr=20;
  var scale=80,svg='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:100%;display:block">',gy=H-mb;
  svg+='<line x1="10" y1="'+gy+'" x2="'+(W-mr)+'" y2="'+gy+'" stroke="#388bfd" stroke-width="2" opacity="0.5"/>';
  svg+='<text x="16" y="'+(gy+16)+'" font-size="11" fill="#388bfd" opacity="0.7">地面 ±0.000</text>';
  var bx=ml+(dist/scale)*(W-ml-mr),bhPx=(bh/scale)*(H-mb-20);
  svg+='<rect x="'+bx+'" y="'+(gy-bhPx)+'" width="44" height="'+bhPx+'" fill="#21262d" stroke="#7d8590" stroke-width="1.5" rx="2"/>';
  svg+='<text x="'+(bx+22)+'" y="'+(gy-bhPx-8)+'" text-anchor="middle" font-size="11" fill="#7d8590">建筑 '+bh+'m</text>';
  var cx=ml+24,cy=gy;
  svg+='<rect x="'+(cx-28)+'" y="'+(cy-20)+'" width="56" height="20" fill="#21262d" stroke="#388bfd" stroke-width="1.5" rx="3"/>';
  svg+='<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" font-size="10" fill="#7d8590">'+(cur?esc(cur.model):'吊车')+'</text>';
  var angleRad=(Math.min(Math.max(btAngle,10),85))*Math.PI/180;
  var boomLen=boom||30,boomPx=Math.min((boomLen/scale)*(W-ml-mr),W*0.7);
  var ex=cx+Math.cos(angleRad)*boomPx,ey=cy-Math.sin(angleRad)*boomPx;
  svg+='<line x1="'+cx+'" y1="'+cy+'" x2="'+ex.toFixed(1)+'" y2="'+ey.toFixed(1)+'" stroke="#f0883e" stroke-width="3" stroke-linecap="round"/>';
  svg+='<circle cx="'+cx+'" cy="'+cy+'" r="5" fill="#f0883e"/>';
  var clearancePx=gy-ey-bhPx,status=clearancePx>20?'safe':clearancePx>0?'warn':'danger';
  var col=status==='safe'?'#3fb950':status==='warn'?'#d29922':'#f85149';
  var label=status==='safe'?'✓ 净空安全':status==='warn'?'⚠ 净空偏小':'✗ 可能碰撞';
  svg+='<line x1="'+ex.toFixed(1)+'" y1="'+ey.toFixed(1)+'" x2="'+bx+'" y2="'+ey.toFixed(1)+'" stroke="'+col+'" stroke-width="1.5" stroke-dasharray="5,3"/>';
  svg+='<text x="'+(((ex+bx)/2)).toFixed(1)+'" y="'+(ey-8).toFixed(1)+'" text-anchor="middle" font-size="12" fill="'+col+'" font-weight="bold">'+label+'</text></svg>';
  return svg;
}

/* ── Tab 切换 ───────────────────────────────────────── */
function switchTab(tab){
  document.querySelectorAll('.detail-tab-item').forEach(function(el){el.classList.remove('active');});
  document.querySelectorAll('.tab-panel').forEach(function(el){el.classList.remove('active');});
  var tEl=document.getElementById('tab-'+tab),pEl=document.getElementById('panel-'+tab);
  if(tEl)tEl.classList.add('active');if(pEl)pEl.classList.add('active');
  if(tab==='chart')renderPerfTable();
}

/* ── 吊具计算 ────────────────────────────────────────── */
var _curSpreadConfig = null;

function initSpreadTab(){
  var spEmpty=document.getElementById('spreadEmpty');
  var spContent=document.getElementById('spreadContent');
  var spResult=document.getElementById('spreadResult');
  var spRope=document.getElementById('spRope');
  var spCargo=document.getElementById('spCargo');
  var spTiersInfo=document.getElementById('spreadTiersInfo');

  // 重置
  if(spResult)spResult.style.display='none';
  if(spRope)spRope.value='0';
  if(spCargo)spCargo.value='';
  _curSpreadConfig=null;

  var sp=cur&&cur.spread_params;
  if(!sp||!sp.length){
    if(spEmpty)spEmpty.style.display='';
    if(spContent)spContent.style.display='none';
    return;
  }

  if(spEmpty)spEmpty.style.display='none';
  if(spContent)spContent.style.display='';

  // 显示档位说明
  if(spTiersInfo){
    // 按额定载荷升序排列，显示档位规则
    var sorted=[].concat(sp).sort(function(a,b){return a.rated_load-b.rated_load;});
    var parts=sorted.map(function(c){
      return'<span class="tier-chip">≤'+c.rated_load+'t → 吊钩'+c.hook_weight+'t</span>';
    });
    spTiersInfo.innerHTML='<div class="spread-tier-hint">📐 吊钩档位自动匹配规则：'+parts.join(' &nbsp;|&nbsp; ')+'</div>';
  }
}

function findSpreadConfig(componentWeight){
  // 找最小额定载荷 ≥ 构件重量的配置（即最小能吊起该构件的档位）
  var sp=cur&&cur.spread_params;
  if(!sp||!sp.length)return null;
  var best=null;
  for(var i=0;i<sp.length;i++){
    if(sp[i].rated_load>=componentWeight){
      if(!best||sp[i].rated_load<best.rated_load)best=sp[i];
    }
  }
  // 如果构件比所有档位都重（超载），用最大档位
  if(!best)best=sp[sp.length-1];
  return best;
}

function onSpreadCargoChange(){
  var spCargo=document.getElementById('spCargo');
  var spRope=document.getElementById('spRope');
  var w=parseFloat(spCargo&&spCargo.value)||0;
  _curSpreadConfig=findSpreadConfig(w);
  calcSpreadTotal();
}

function calcSpreadTotal(){
  var spResult=document.getElementById('spreadResult');
  var spTotalNum=document.getElementById('spreadTotalNum');
  var spFormula=document.getElementById('spreadFormula');
  var spHookLabel=document.getElementById('spHookLabel');
  var spCargoLabel=document.getElementById('spCargoLabel');
  var spRope=document.getElementById('spRope');

  var w=parseFloat((spCargo&&spCargo.value)||0)||0;
  var ropeWeight=parseFloat(spRope&&spRope.value)||0;
  var cfg=_curSpreadConfig;

  if(!cfg||w<=0){
    if(spResult)spResult.style.display='none';
    return;
  }

  var total=(w+cfg.hook_weight+ropeWeight).toFixed(3);
  var formula=w.toFixed(2)+' + '+cfg.hook_weight+' + '+ropeWeight.toFixed(2)+' = '+total+' t';

  if(spTotalNum)spTotalNum.textContent=total+' t';
  if(spFormula)spFormula.textContent='构件 '+w+'t + 吊钩 '+cfg.hook_weight+'t + 钢丝绳 '+ropeWeight.toFixed(2)+'t = 总计';
  if(spHookLabel)spHookLabel.textContent='吊钩  '+cfg.hook_weight+' t（第'+cfg.rated_load+'t档位自动匹配）';
  if(spResult)spResult.style.display='';
}
/* old closeDetail removed – now handled by full-page nav */

/* ── DOM Ready ──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',function(){
  var el=document.getElementById('badge');if(el)el.textContent='DOM就绪，正在加载数据…';
  try{
    var src=window.CRANE_DATA||null;
    if(src&&Array.isArray(src.cranes)&&src.cranes.length>0){data=src;onData();}
    else {toast('未找到数据，请刷新页面重试');if(el)el.textContent='数据加载失败';}
    document.addEventListener('dragover',function(e){e.preventDefault();});
    document.addEventListener('drop',function(e){
      e.preventDefault();var f=e.dataTransfer.files[0];
      if(f&&(f.name.endsWith('.js')||f.name.endsWith('.json'))){
        var reader=new FileReader();
        reader.onload=function(ev){
          try{
            var txt=ev.target.result;txt=txt.replace(/^var\s+CRANE_DATA\s*=\s*/,'').replace(/;$/,'');
            data=JSON.parse(txt);_mapBuilt=false;_craneMap={};
            onData();toast('数据加载成功：'+data.cranes.length+' 台');
          }catch(er){toast('加载失败，请检查文件格式');}
        };reader.readAsText(f);
      }
    });
    sp('home');
    // 恢复侧边栏折叠状态（CSS sibling selector 接管布局）
    if(localStorage.getItem('sidebar_collapsed')==='true'){
      _sidebarCollapsed=true;
      var sidebar=document.getElementById('appSidebar');
      var toggleBtn=document.getElementById('sidebarToggle');
      if(sidebar)sidebar.classList.add('collapsed');
      if(toggleBtn)toggleBtn.textContent='›';
    }
  }catch(e){if(el)el.textContent='初始化异常:'+e.message;console.error('[init]',e);}
});

/* ── 添加机型（用户自定义）─────────────────────────── */
function initAddPage(){refreshUserCraneUI();var rows=document.getElementById('chartRows');if(rows&&rows.children.length===0)addChartRow();}
function refreshUserCraneUI(){
  var list=getUserCranes();
  var countEl=document.getElementById('userCraneCount');if(countEl)countEl.textContent='已录入 '+list.length+' 台';
  var section=document.getElementById('userCranesSection'),listEl=document.getElementById('userCraneList'),countListEl=document.getElementById('userCraneListCount');
  if(!list.length){if(section)section.style.display='none';return;}
  if(section)section.style.display='';if(countListEl)countListEl.textContent='('+list.length+'台)';
  if(listEl){
    listEl.innerHTML=list.map(function(c,i){
      var lc=Array.isArray(c.load_charts)?c.load_charts.length:0;
      return '<div class="ucrane-card"><div class="ucrane-info">'
        +'<span class="ucrane-model">'+esc(c.brand)+' '+esc(c.model)+'</span>'
        +'<span class="ucrane-type">'+esc(c.type||'')+'</span>'
        +'<span class="ucrane-load">'+(c.max_load_t||'?')+'t</span>'
        +'<span class="ucrane-charts">'+lc+'载荷点</span></div>'
        +'<div class="ucrane-actions"><button class="btn-text" onclick="deleteUserCrane('+i+')">删除</button></div></div>';
    }).join('');
  }
}
function addChartRow(boomVal){
  var tbody=document.getElementById('chartRows');if(!tbody)return;
  var tr=document.createElement('tr');tr.className='chart-row';
  var bv=boomVal?' value="'+boomVal+'"':'';
  tr.innerHTML='<td><input type="number" class="ce-boom" placeholder="臂长" step="0.5" min="0"'+bv+'></td>'
    +'<td><input type="number" class="ce-radius" placeholder="半径" step="0.5" min="0"></td>'
    +'<td><input type="number" class="ce-load" placeholder="载荷" step="0.1" min="0"></td>'
    +'<td><input type="text" class="ce-note" placeholder="备注"></td>'
    +'<td><button class="btn-remove-row" onclick="removeChartRow(this)">✕</button></td>';
  tbody.appendChild(tr);
}
function addBoomGroup(){var boom=prompt('请输入新臂长（m）：');if(!boom||isNaN(+boom)||+boom<=0)return;addChartRow(boom);toast('已添加臂长 '+boom+'m');}
function removeChartRow(btn){var tbody=document.getElementById('chartRows');if(tbody&&tbody.children.length>1)btn.closest('tr').remove();else toast('至少保留一行');}
function collectChartRows(){
  var rows=document.querySelectorAll('#chartRows tr'),charts=[];
  for(var i=0;i<rows.length;i++){
    var boom=parseFloat(rows[i].querySelector('.ce-boom').value);
    var radius=parseFloat(rows[i].querySelector('.ce-radius').value);
    var load=parseFloat(rows[i].querySelector('.ce-load').value);
    if(isNaN(boom)||isNaN(radius)||isNaN(load))continue;
    if(boom<0||radius<0||load<0)continue;
    charts.push({boom_length:boom,radius:radius,rated_load:load});
  }
  return charts;
}
function submitCrane(){
  var brand=(document.getElementById('f-brand')||{value:''}).value.trim();
  var model=(document.getElementById('f-model')||{value:''}).value.trim();
  var type=(document.getElementById('f-type')||{value:''}).value.trim();
  var maxLoad=parseFloat((document.getElementById('f-max-load')||{value:''}).value);
  var errs=[];
  if(!brand)errs.push('品牌');if(!model)errs.push('型号');if(!type)errs.push('类型');
  if(!maxLoad||maxLoad<=0)errs.push('最大额定起重量');
  if(errs.length){toast('请填写：'+errs.join('、'));return;}
  var charts=collectChartRows();
  if(!charts.length){toast('请至少填写一行载荷数据');return;}
  var loadCharts={main_boom:{'主臂工况':{'用户录入|全伸':charts}}};
  var crane={
    id:Date.now(),brand:brand,model:model,type:type,max_load_t:maxLoad,
    load_charts:loadCharts,
    overall_length:parseFloat((document.getElementById('f-length')||{value:''}).value)||null,
    overall_width:parseFloat((document.getElementById('f-width')||{value:''}).value)||null,
    overall_height:parseFloat((document.getElementById('f-height')||{value:''}).value)||null,
    total_weight_kg:(parseFloat((document.getElementById('f-weight')||{value:''}).value)||0)*1000||null,
    boom_min:parseFloat((document.getElementById('f-boom-min')||{value:''}).value)||null,
    boom_max:parseFloat((document.getElementById('f-boom-max')||{value:''}).value)||null,
    rental_fee_month:parseFloat((document.getElementById('f-rental-month')||{value:''}).value)||null,
    rental_fee_shift:parseFloat((document.getElementById('f-rental-shift')||{value:''}).value)||null,
    fuel_fee:parseFloat((document.getElementById('f-fuel-fee')||{value:''}).value)||null,
    _user_added:true
  };
  var list=getUserCranes();list.push(Object.assign({},crane,{load_charts:charts}));saveUserCranes(list);
  if(data){
    data.cranes.push(crane);data.total=data.cranes.length;_craneMap[crane.id]=crane;
    renderStats();renderLib(1);
    var types={};data.cranes.forEach(function(c){if(c.type)types[c.type]=true;});
    var filterEl=document.getElementById('typeFilter');
    if(filterEl){filterEl.innerHTML=Object.keys(types).sort().map(function(t){return '<button class="tbtn" data-type="'+t+'" onclick="filterType(\''+t+'\',this)">'+t+'</button>';}).join('');}
    var sT=document.getElementById('sT');
    if(sT){sT.innerHTML='<option value="">全部</option>'+Object.keys(types).sort().map(function(t){return '<option value="'+t+'">'+t+'</option>';}).join('');}
  }
  ['f-brand','f-model','f-type','f-max-load','f-length','f-width','f-height','f-weight','f-boom-min','f-boom-max','f-jib','f-boom-sec','f-rental-month','f-rental-shift','f-fuel-fee'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  var tbody=document.getElementById('chartRows');if(tbody)tbody.innerHTML='';
  addChartRow();refreshUserCraneUI();
  toast('✓ '+brand+' '+model+' 已保存');
}
function deleteUserCrane(idx){
  var list=getUserCranes(),crane=list[idx];
  if(!crane||!confirm('确认删除 '+(crane.brand||'')+' '+(crane.model||'')+'？'))return;
  list.splice(idx,1);saveUserCranes(list);
  if(data){var cid=crane.id;data.cranes=data.cranes.filter(function(c){return c.id!==cid;});data.total=data.cranes.length;delete _craneMap[cid];renderStats();renderLib(1);}
  refreshUserCraneUI();toast('已删除');
}
function exportUserCranes(){
  var list=getUserCranes();if(!list.length){toast('暂无数据');return;}
  var blob=new Blob([JSON.stringify(list,null,2)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='my_cranes_'+new Date().toISOString().slice(0,10)+'.json';a.click();toast('已导出 '+list.length+' 台');
}
function importUserCranes(input){
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var imported=JSON.parse(e.target.result);
      if(!Array.isArray(imported))throw new Error('格式错误');
      var existing=getUserCranes(),existKeys={},added=0;
      existing.forEach(function(c){existKeys[(c.brand||'')+'|'+(c.model||'')]=true;});
      imported.forEach(function(c){var k=(c.brand||'')+'|'+(c.model||'');if(!existKeys[k]){existing.push(c);added++;existKeys[k]=true;}});
      saveUserCranes(existing);
      if(data){_mapBuilt=false;_craneMap={};buildMap();mergeUserCranes();renderStats();renderLib(1);}
      refreshUserCraneUI();toast('✓ 导入成功，新增 '+added+' 台');
    }catch(err){toast('导入失败：'+err.message);}
    input.value='';
  };reader.readAsText(file);
}

/* ── xlsx 批量导入 ──────────────────────────────────── */
var _xlsxParsed = null;   /* 暂存解析结果 */

/* Sheet 名 → 工况类型映射 */
var XLSX_SHEET_TYPE = {
  '机械基础信息':             '_base',
  '主臂工况性能表':           'main_boom',
  '超起工况性能表':           'super_lift',
  '主副臂工况性能表':         'jib_boom',
  '主副臂带超起工况性能表':   'jib_superlift',
  '塔式副臂带超起工况性能表': 'tower_jib_superlift'
};

/* 工况类型标签（用于预览显示） */
var XLSX_TYPE_LABELS = {
  main_boom:'主臂工况', super_lift:'超起工况',
  jib_boom:'主副臂工况', jib_superlift:'主副臂+超起',
  tower_jib_superlift:'塔式副臂+超起'
};

/* 从 xlsx 工作表提取 JSON 数组（跳过空行） */
function xlsxSheetToJson(wb, sheetName){
  var ws = wb.Sheets[sheetName];
  if(!ws) return [];
  return XLSX.utils.sheet_to_json(ws, {defval:''});
}

/* 数值安全转换 */
function xf(v){
  if(v==null||v==='') return null;
  var n = parseFloat(String(v).replace(/,/g,''));
  return isNaN(n)?null:n;
}

/* 解析 xlsx 文件，返回 {cranes:[], summary:{}} */
function parseXlsxImport(wb){
  var sheetNames = wb.SheetNames || [];

  /* 识别映射：遍历所有 sheet，找到对应的工况类型 */
  var typeMap = {};   /* sheetName → typeKey */
  var baseSheet = null;
  for(var i=0;i<sheetNames.length;i++){
    var sn = sheetNames[i];
    if(XLSX_SHEET_TYPE[sn] === '_base'){
      baseSheet = sn;
    } else if(XLSX_SHEET_TYPE[sn]){
      typeMap[sn] = XLSX_SHEET_TYPE[sn];
    }
  }

  /* 如果 sheet 名称不完全匹配，尝试模糊匹配 */
  if(!baseSheet){
    for(var i=0;i<sheetNames.length;i++){
      if(sheetNames[i].indexOf('基础')>=0 || sheetNames[i].indexOf('信息')>=0){
        baseSheet = sheetNames[i]; break;
      }
    }
  }
  /* 尝试模糊匹配工况 sheet */
  var typeFuzzy = [
    ['主臂','main_boom'],['超起','super_lift'],
    ['主副臂工况','jib_boom'],['主副臂带','jib_superlift'],
    ['塔式副臂','tower_jib_superlift']
  ];
  for(var i=0;i<sheetNames.length;i++){
    if(typeMap[sheetNames[i]]) continue;
    var sn2 = sheetNames[i];
    for(var j=0;j<typeFuzzy.length;j++){
      if(sn2.indexOf(typeFuzzy[j][0])>=0){
        typeMap[sn2] = typeFuzzy[j][1]; break;
      }
    }
  }

  /* 解析基础信息 */
  var cranesMap = {};   /* model → crane object */
  if(baseSheet){
    var rows = xlsxSheetToJson(wb, baseSheet);
    for(var i=0;i<rows.length;i++){
      var r = rows[i];
      var model = String(r['型号']||'').trim();
      if(!model) continue;
      var tw = xf(r['整机质量（t）']);
      var owH = xf(r['外形尺寸-高(mm)']);
      cranesMap[model] = {
        id: Date.now() + i,
        model: model,
        brand: String(r['品牌']||'').trim(),
        type: String(r['类型']||'汽车吊').trim(),
        max_load_t: xf(r['最大起重量（t）']),
        overall_length: xf(r['外形尺寸-长(mm)']),
        overall_width:  xf(r['外形尺寸-宽(mm)']),
        overall_height: xf(r['外形尺寸-高(mm)']),
        hook_pivot_h: owH ? Math.round(owH/1000*0.45*100)/100 : 2.0,
        total_weight_kg: tw ? Math.round(tw*1000) : null,
        min_turn_radius:   xf(r['最小转弯半径(m)']),
        tail_radius:       xf(r['转台尾部回转半径(m)']),
        outrigger_span_h:  xf(r['支腿跨距-横向(m)']),
        outrigger_span_v:  xf(r['支腿跨距-纵向(m)']),
        boom_min:          xf(r['主臂最小长度(m)']),
        boom_max:          xf(r['主臂最大长度(m)']),
        jib_standard:      xf(r['副臂标准长度(m)']),
        jib_optional:      xf(r['副臂选配长度(m)']),
        jib_angle_range:   String(r['副臂角度范围']||'').trim(),
        rental_fee_month:  xf(r['租赁费/月']),
        rental_fee_shift:  xf(r['租赁费/台班']),
        fuel_fee:          xf(r['燃油费']),
        load_charts: {},
        _chart_count: 0,
        _type_stats: {}
      };
    }
  }

  /* 解析载荷表 */
  var chartCount = 0;
  var sheetNames2 = Object.keys(typeMap);
  for(var si=0;si<sheetNames2.length;si++){
    var sn = sheetNames2[si];
    var ctype = typeMap[sn];
    var rows = xlsxSheetToJson(wb, sn);

    for(var i=0;i<rows.length;i++){
      var r = rows[i];
      var model = String(r['机械型号']||r['型号']||'').trim();
      if(!model) continue;

      /* 如果基础信息中没有该型号，自动创建 */
      if(!cranesMap[model]){
        cranesMap[model] = {
          id: Date.now() + 10000 + Object.keys(cranesMap).length,
          model: model,
          brand: '', type: '汽车吊',
          max_load_t: null,
          load_charts: {},
          _chart_count: 0,
          _type_stats: {}
        };
      }
      var crane = cranesMap[model];

      var condDesc = String(r['工况说明']||sn).trim();
      var cwRaw    = String(r['配重状态']||'').trim();
      var outRaw   = String(r['支腿状态']||'全伸').trim();
      if(!outRaw || outRaw==='nan') outRaw = '全伸';
      var cwKey = (cwRaw && cwRaw!=='nan') ? cwRaw : '';
      var condKey = condDesc;
      var cgKey   = cwKey + '|' + outRaw;

      /* 确保层级存在 */
      var lc = crane.load_charts;
      if(!lc[ctype]) lc[ctype] = {};
      if(!lc[ctype][condKey]) lc[ctype][condKey] = {};
      if(!lc[ctype][condKey][cgKey]) lc[ctype][condKey][cgKey] = [];

      /* 提取数据行 */
      var entry = {};
      if(ctype==='main_boom' || ctype==='super_lift'){
        entry = {
          boom_length: xf(r['臂长(m)']),
          radius:     xf(r['半径(m)']),
          rated_load: xf(r['起重量(t)'])
        };
      } else {
        var mainBL = xf(r['主臂长(m)']);
        entry = {
          boom_length:      mainBL,
          main_boom_length: mainBL,
          jib_length:       xf(r['副臂长(m)']),
          jib_angle:        String(r['副臂安装角(°)']||r['主臂安装角(°)']||'').trim(),
          radius:           xf(r['半径(m)']),
          rated_load:       xf(r['起重量(t)'])
        };
      }
      entry.counterweight = cwKey ? parseFloat(cwKey) : null;
      entry.outrigger     = outRaw;

      if(entry.boom_length!=null && entry.radius!=null && entry.rated_load!=null){
        lc[ctype][condKey][cgKey].push(entry);
        chartCount++;
        crane._chart_count++;
        crane._type_stats[ctype] = (crane._type_stats[ctype]||0)+1;
      }
    }
  }

  /* 转为数组，去掉内部统计字段 */
  var cranesArr = [];
  var models = Object.keys(cranesMap);
  for(var i=0;i<models.length;i++){
    var c = cranesMap[models[i]];
    /* 将 mm 单位的外形尺寸转为 m */
    if(c.overall_length) c.overall_length = Math.round(c.overall_length/10)/100;
    if(c.overall_width)  c.overall_width  = Math.round(c.overall_width/10)/100;
    if(c.overall_height) c.overall_height = Math.round(c.overall_height/10)/100;
    var cc = c._chart_count;
    var ts = JSON.parse(JSON.stringify(c._type_stats));
    delete c._chart_count;
    delete c._type_stats;
    c._user_added = true;
    cranesArr.push({_crane:c, _cc:cc, _ts:ts});
  }

  return {
    cranes: cranesArr,
    summary: {
      totalCranes: models.length,
      totalCharts: chartCount,
      sheetsFound: Object.keys(typeMap).length,
      baseSheet: !!baseSheet
    }
  };
}

/* 触发文件选择 → 读取 → 解析 → 预览 */
/* 按需加载SheetJS（懒加载） */
function ensureXlsx(callback) {
  if(typeof XLSX !== 'undefined') { callback(); return; }
  toast('正在加载xlsx解析库…');
  var s = document.createElement('script');
  s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  s.onload = function() { toast('xlsx库加载完成'); callback(); };
  s.onerror = function() { toast('xlsx库加载失败，请检查网络'); };
  document.head.appendChild(s);
}

function importXlsxFile(input){
  var file = input.files[0];
  if(!file) return;
  ensureXlsx(function(){
    toast('正在解析 ' + file.name + ' …');
    var reader = new FileReader();
    reader.onload = function(e){
      try {
        var data = new Uint8Array(e.target.result);
        var wb = XLSX.read(data, {type:'array'});
        var result = parseXlsxImport(wb);
        if(!result.cranes.length){
          toast('未识别到有效机型数据，请检查文件格式');
          input.value='';
          return;
        }
        _xlsxParsed = result;
        showXlsxPreview(result);
        toast('识别到 ' + result.summary.totalCranes + ' 台机型');
      } catch(err){
        toast('解析失败：' + err.message);
        console.error(err);
      }
      input.value='';
    };
    reader.readAsArrayBuffer(file);
  });
}

/* 显示预览面板 */
function showXlsxPreview(result){
  var el = document.getElementById('xlsxPreview');
  var title = document.getElementById('xlsxPreviewTitle');
  var body  = document.getElementById('xlsxPreviewBody');
  if(!el) return;

  el.style.display = '';
  title.textContent = '预览导入：' + result.summary.totalCranes + ' 台机型，' + result.summary.totalCharts + ' 条载荷数据';

  /* 检测重复 */
  var existing = (data && data.cranes) ? data.cranes : [];
  var existModels = {};
  for(var i=0;i<existing.length;i++) existModels[existing[i].model] = true;

  var dupes = 0;
  var html = '<div class="xlsx-pv-stats">'
    + '机型总数：<span>' + result.summary.totalCranes + '</span>'
    + ' | 载荷点：<span>' + result.summary.totalCharts + '</span>'
    + ' | 识别 Sheet：<span>' + result.summary.sheetsFound + '</span>';
  if(!result.summary.baseSheet) html += ' | <span style="color:#e74c3c">⚠ 未找到"机械基础信息"Sheet</span>';
  html += '</div>';

  for(var i=0;i<result.cranes.length;i++){
    var item = result.cranes[i];
    var c = item._crane;
    var isDup = existModels[c.model];
    if(isDup) dupes++;

    html += '<div class="xlsx-pv-crane">';
    html += '<div class="xlsx-pv-crane-head">';
    html += '<span class="xlsx-pv-crane-model">' + esc(c.brand) + ' ' + esc(c.model) + '</span>';
    html += '<span class="xlsx-pv-crane-badge">' + (isDup?'覆盖更新':'新增') + ' · ' + esc(c.type||'') + ' · ' + (c.max_load_t||'?') + 't</span>';
    html += '</div>';

    /* 规格参数 */
    html += '<div class="xlsx-pv-crane-specs">';
    if(c.overall_length) html += '<span>长 ' + c.overall_length + 'm</span>';
    if(c.overall_width)  html += '<span>宽 ' + c.overall_width + 'm</span>';
    if(c.overall_height) html += '<span>高 ' + c.overall_height + 'm</span>';
    if(c.total_weight_kg) html += '<span>重 ' + Math.round(c.total_weight_kg/10)/100 + 't</span>';
    if(c.boom_min) html += '<span>臂 ' + c.boom_min + '~' + (c.boom_max||'?') + 'm</span>';
    html += '</div>';

    /* 工况统计 */
    html += '<div class="xlsx-pv-chart-count">';
    var tsKeys = Object.keys(item._ts);
    for(var j=0;j<tsKeys.length;j++){
      html += (XLSX_TYPE_LABELS[tsKeys[j]]||tsKeys[j]) + ' ' + item._ts[tsKeys[j]] + '点　';
    }
    html += '</div>';
    html += '</div>';
  }

  if(dupes>0){
    html += '<div style="color:#e67e22;font-size:13px;margin-top:8px">⚠ 检测到 ' + dupes + ' 台与现有数据同型号，确认导入将覆盖更新这些机型。</div>';
  }

  body.innerHTML = html;
}

/* 确认导入 */
function confirmXlsxImport(){
  if(!_xlsxParsed || !_xlsxParsed.cranes.length) return;

  var existing = getUserCranes();
  /* 如果 data 存在，也把内置机型纳入去重判断 */
  var allModels = {};
  if(data && data.cranes){
    for(var i=0;i<data.cranes.length;i++){
      if(!data.cranes[i]._user_added) allModels[data.cranes[i].model] = true;
    }
  }
  for(var i=0;i<existing.length;i++) allModels[existing[i].model] = true;

  var added = 0, updated = 0;

  for(var i=0;i<_xlsxParsed.cranes.length;i++){
    var c = _xlsxParsed.cranes[i]._crane;
    var key = c.brand + '|' + c.model;
    var isDup = allModels[c.model];

    if(isDup){
      /* 更新已有数据：在 localStorage 中标记覆盖 */
      /* 先从 userCranes 中找到并替换 */
      var found = false;
      for(var j=0;j<existing.length;j++){
        if(existing[j].model === c.model){
          existing[j] = c;
          found = true; updated++; break;
        }
      }
      if(!found){
        /* 内置机型：存入 localStorage 覆盖 */
        existing.push(c);
        updated++;
      }
    } else {
      existing.push(c);
      added++;
      allModels[c.model] = true;
    }
  }

  saveUserCranes(existing);

  /* 合并到内存数据 */
  if(data){
    mergeUserCranes();
    _mapBuilt = false; _craneMap = {}; buildMap();
    renderStats(); renderLib(1);
  }

  _xlsxParsed = null;
  document.getElementById('xlsxPreview').style.display = 'none';
  refreshUserCraneUI();
  toast('✓ 导入完成：新增 ' + added + ' 台，更新 ' + updated + ' 台');
}

/* 取消导入 */
function cancelXlsxImport(){
  _xlsxParsed = null;
  document.getElementById('xlsxPreview').style.display = 'none';
}

/* 下载空白 xlsx 模板 */
function downloadXlsxTemplate(){
  var wb = XLSX.utils.book_new();

  /* 机械基础信息 Sheet */
  var baseHeader = ['型号','品牌','类型','最大起重量（t)','外形尺寸-长(mm)','外形尺寸-宽(mm)','外形尺寸-高(mm)',
    '整机质量（t）','最小转弯半径(m)','转台尾部回转半径(m)','支腿跨距-横向(m)','支腿跨距-纵向(m)',
    '主臂最小长度(m)','主臂最大长度(m)','副臂标准长度(m)','副臂选配长度(m)','副臂角度范围','租赁费/月','租赁费/台班','燃油费'];
  var baseExample = ['STC550T','三一','汽车吊',55,13800,3000,3950,41,8,4.8,7.9,8.4,11.5,43,9.5,'','','','待补充','待补充'];
  var ws1 = XLSX.utils.aoa_to_sheet([baseHeader, baseExample]);
  ws1['!cols'] = baseHeader.map(function(){return {wch:18};});
  XLSX.utils.book_append_sheet(wb, ws1, '机械基础信息');

  /* 主臂工况性能表 */
  var mainHeader = ['机械型号','工况说明','配重状态','臂长(m)','支腿状态','半径(m)','起重量(t)'];
  var mainExample = ['STC550T','基本臂','全配重',11.5,'全伸',3,55];
  var mainExample2 = ['STC550T','基本臂','全配重',11.5,'全伸',4,42];
  var mainExample3 = ['STC550T','基本臂','全配重',11.5,'全伸',5,32];
  var ws2 = XLSX.utils.aoa_to_sheet([mainHeader, mainExample, mainExample2, mainExample3]);
  ws2['!cols'] = mainHeader.map(function(){return {wch:16};});
  XLSX.utils.book_append_sheet(wb, ws2, '主臂工况性能表');

  /* 超起工况性能表 */
  var ws3 = XLSX.utils.aoa_to_sheet([mainHeader.slice(0,3).concat(['臂长(m)']).concat(mainHeader.slice(4))]);
  ws3['!cols'] = mainHeader.map(function(){return {wch:16};});
  XLSX.utils.book_append_sheet(wb, ws3, '超起工况性能表');

  /* 主副臂工况性能表 */
  var jibHeader = ['机械型号','工况说明','配重状态','支腿状态','副臂安装角(°)','主臂长(m)','副臂长(m)','半径(m)','起重量(t)'];
  var ws4 = XLSX.utils.aoa_to_sheet([jibHeader]);
  ws4['!cols'] = jibHeader.map(function(){return {wch:16};});
  XLSX.utils.book_append_sheet(wb, ws4, '主副臂工况性能表');

  /* 主副臂带超起工况性能表 */
  var jib2Header = ['机械型号','工况说明','配重状态','支腿状态','主臂长(m)','副臂安装角(°)','副臂长(m)','半径(m)','起重量(t)'];
  var ws5 = XLSX.utils.aoa_to_sheet([jib2Header]);
  ws5['!cols'] = jib2Header.map(function(){return {wch:16};});
  XLSX.utils.book_append_sheet(wb, ws5, '主副臂带超起工况性能表');

  /* 塔式副臂带超起工况性能表 */
  var towerHeader = ['机械型号','工况说明','配重状态','支腿状态','主臂安装角(°)','主臂长(m)','副臂长(m)','半径(m)','起重量(t)'];
  var ws6 = XLSX.utils.aoa_to_sheet([towerHeader]);
  ws6['!cols'] = towerHeader.map(function(){return {wch:16};});
  XLSX.utils.book_append_sheet(wb, ws6, '塔式副臂带超起工况性能表');

  XLSX.writeFile(wb, '吊机数据导入模板.xlsx');
  toast('✓ 模板已下载');
}


var STEEL_RHO = 7850;
var SECTION_DB = [
  // ── H型钢：HW 宽翼缘 ──────────────────────────────────────────
  {code:'HW100×100', type:'HW', H:100,  B:100,  tw:6,   tf:8},
  {code:'HW125×125', type:'HW', H:125,  B:125,  tw:6.5, tf:9},
  {code:'HW150×150', type:'HW', H:150,  B:150,  tw:7,   tf:10},
  {code:'HW175×175', type:'HW', H:175,  B:175,  tw:7.5, tf:11},
  {code:'HW200×200', type:'HW', H:200,  B:200,  tw:8,   tf:12},
  {code:'HW250×250', type:'HW', H:250,  B:250,  tw:9,   tf:14},
  {code:'HW300×300', type:'HW', H:300,  B:300,  tw:10,  tf:15},
  {code:'HW350×350', type:'HW', H:350,  B:350,  tw:12,  tf:19},
  {code:'HW400×400', type:'HW', H:400,  B:400,  tw:13,  tf:21},
  // HM 中翼缘
  {code:'HM144×74',  type:'HM', H:144,  B:74,   tw:6,   tf:8.5},
  {code:'HM194×150', type:'HM', H:194,  B:150,  tw:6,   tf:9},
  {code:'HM244×175', type:'HM', H:244,  B:175,  tw:7,   tf:11},
  {code:'HM294×200', type:'HM', H:294,  B:200,  tw:8,   tf:12},
  {code:'HM340×250', type:'HM', H:340,  B:250,  tw:9,   tf:14},
  {code:'HM390×300', type:'HM', H:390,  B:300,  tw:10,  tf:16},
  {code:'HM440×300', type:'HM', H:440,  B:300,  tw:11,  tf:18},
  {code:'HM482×300', type:'HM', H:482,  B:300,  tw:11,  tf:15},
  {code:'HM530×300', type:'HM', H:530,  B:300,  tw:12,  tf:15},
  // HN 窄翼缘
  {code:'HN100×50',  type:'HN', H:100,  B:50,   tw:5,   tf:7},
  {code:'HN125×60',  type:'HN', H:125,  B:60,   tw:6,   tf:8},
  {code:'HN150×75',  type:'HN', H:150,  B:75,   tw:5,   tf:7},
  {code:'HN175×90',  type:'HN', H:175,  B:90,   tw:5,   tf:8},
  {code:'HN198×99',  type:'HN', H:198,  B:99,   tw:4.5, tf:7},
  {code:'HN200×100', type:'HN', H:200,  B:100,  tw:5.5, tf:8},
  {code:'HN250×125', type:'HN', H:250,  B:125,  tw:6,   tf:9},
  {code:'HN300×150', type:'HN', H:300,  B:150,  tw:6.5, tf:10},
  {code:'HN350×175', type:'HN', H:350,  B:175,  tw:7,   tf:11},
  {code:'HN400×150', type:'HN', H:400,  B:150,  tw:8,   tf:13},
  {code:'HN400×200', type:'HN', H:400,  B:200,  tw:8,   tf:13},
  {code:'HN450×150', type:'HN', H:450,  B:150,  tw:9,   tf:14},
  {code:'HN450×200', type:'HN', H:450,  B:200,  tw:9,   tf:14},
  {code:'HN500×150', type:'HN', H:500,  B:150,  tw:10,  tf:16},
  {code:'HN500×200', type:'HN', H:500,  B:200,  tw:10,  tf:16},
  {code:'HN550×200', type:'HN', H:550,  B:200,  tw:10,  tf:16},
  {code:'HN600×200', type:'HN', H:600,  B:200,  tw:11,  tf:17},
  {code:'HN700×300', type:'HN', H:700,  B:300,  tw:13,  tf:20},
  {code:'HN800×300', type:'HN', H:800,  B:300,  tw:14,  tf:22},
  {code:'HN900×300', type:'HN', H:900,  B:300,  tw:16,  tf:24},
  // HP 桩基
  {code:'HP200×200', type:'HP', H:200,  B:204,  tw:12,  tf:12},
  {code:'HP250×250', type:'HP', H:250,  B:255,  tw:14,  tf:14},
  {code:'HP300×300', type:'HP', H:300,  B:301,  tw:14,  tf:14},
  {code:'HP350×350', type:'HP', H:350,  B:350,  tw:12,  tf:12},
  // 方管 □B×H×t
  {code:'□100×100×4', type:'BOX', H:100,  B:100,  t:4},
  {code:'□100×100×5', type:'BOX', H:100,  B:100,  t:5},
  {code:'□120×120×4', type:'BOX', H:120,  B:120,  t:4},
  {code:'□120×120×6', type:'BOX', H:120,  B:120,  t:6},
  {code:'□150×150×5', type:'BOX', H:150,  B:150,  t:5},
  {code:'□150×150×6', type:'BOX', H:150,  B:150,  t:6},
  {code:'□150×150×8', type:'BOX', H:150,  B:150,  t:8},
  {code:'□180×180×6', type:'BOX', H:180,  B:180,  t:6},
  {code:'□200×200×6', type:'BOX', H:200,  B:200,  t:6},
  {code:'□200×200×8', type:'BOX', H:200,  B:200,  t:8},
  {code:'□200×200×10',type:'BOX', H:200,  B:200,  t:10},
  {code:'□250×250×6', type:'BOX', H:250,  B:250,  t:6},
  {code:'□250×250×8', type:'BOX', H:250,  B:250,  t:8},
  {code:'□250×250×10',type:'BOX', H:250,  B:250,  t:10},
  {code:'□300×300×8', type:'BOX', H:300,  B:300,  t:8},
  {code:'□300×300×10',type:'BOX', H:300,  B:300,  t:10},
  {code:'□300×300×12',type:'BOX', H:300,  B:300,  t:12},
  {code:'□350×350×10',type:'BOX', H:350,  B:350,  t:10},
  {code:'□350×350×12',type:'BOX', H:350,  B:350,  t:12},
  {code:'□400×400×10',type:'BOX', H:400,  B:400,  t:10},
  {code:'□400×400×12',type:'BOX', H:400,  B:400,  t:12},
  {code:'□400×400×16',type:'BOX', H:400,  B:400,  t:16},
  {code:'□500×500×12',type:'BOX', H:500,  B:500,  t:12},
  {code:'□500×500×16',type:'BOX', H:500,  B:500,  t:16},
  // 矩形管 □B×H×t（统一归入 BOX 类型）
  {code:'□150×100×6', type:'BOX', H:150,  B:100,  t:6},
  {code:'□200×100×6', type:'BOX', H:200,  B:100,  t:6},
  {code:'□200×150×8', type:'BOX', H:200,  B:150,  t:8},
  {code:'□250×150×8', type:'BOX', H:250,  B:150,  t:8},
  {code:'□300×200×10',type:'BOX', H:300,  B:200,  t:10},
  {code:'□400×200×12',type:'BOX', H:400,  B:200,  t:12},
  // 圆管 ØD×t  (GB/T 8162 结构管)
  {code:'Ø89×4',     type:'CHS', D:89,   t:4},
  {code:'Ø108×4',    type:'CHS', D:108,  t:4},
  {code:'Ø114×4',    type:'CHS', D:114,  t:4},
  {code:'Ø133×5',    type:'CHS', D:133,  t:5},
  {code:'Ø140×4.5',  type:'CHS', D:140,  t:4.5},
  {code:'Ø159×5',    type:'CHS', D:159,  t:5},
  {code:'Ø159×6',    type:'CHS', D:159,  t:6},
  {code:'Ø180×6',    type:'CHS', D:180,  t:6},
  {code:'Ø180×8',    type:'CHS', D:180,  t:8},
  {code:'Ø194×6',    type:'CHS', D:194,  t:6},
  {code:'Ø203×6',    type:'CHS', D:203,  t:6},
  {code:'Ø203×8',    type:'CHS', D:203,  t:8},
  {code:'Ø219×6',    type:'CHS', D:219,  t:6},
  {code:'Ø219×8',    type:'CHS', D:219,  t:8},
  {code:'Ø245×8',    type:'CHS', D:245,  t:8},
  {code:'Ø273×8',    type:'CHS', D:273,  t:8},
  {code:'Ø273×10',   type:'CHS', D:273,  t:10},
  {code:'Ø299×8',    type:'CHS', D:299,  t:8},
  {code:'Ø325×8',    type:'CHS', D:325,  t:8},
  {code:'Ø325×10',   type:'CHS', D:325,  t:10},
  {code:'Ø351×10',   type:'CHS', D:351,  t:10},
  {code:'Ø377×10',   type:'CHS', D:377,  t:10},
  {code:'Ø400×10',   type:'CHS', D:400,  t:10},
  {code:'Ø400×12',   type:'CHS', D:400,  t:12},
  {code:'Ø426×10',   type:'CHS', D:426,  t:10},
  {code:'Ø426×12',   type:'CHS', D:426,  t:12},
  {code:'Ø480×12',   type:'CHS', D:480,  t:12},
  {code:'Ø500×12',   type:'CHS', D:500,  t:12},
  {code:'Ø530×12',   type:'CHS', D:530,  t:12},
  {code:'Ø560×14',   type:'CHS', D:560,  t:14},
  {code:'Ø600×14',   type:'CHS', D:600,  t:14},
  {code:'Ø630×14',   type:'CHS', D:630,  t:14},
  {code:'Ø700×16',   type:'CHS', D:700,  t:16},
  {code:'Ø800×16',   type:'CHS', D:800,  t:16},
  // 十字形 +HN…+HN… (两H型钢焊接)
  {code:'+HN150×75+HN150×75',     type:'CRU', h1:150,b1:75,tw1:5,tf1:7,  h2:150,b2:75,tw2:5,tf2:7},
  {code:'+HN198×99+HN198×99',     type:'CRU', h1:198,b1:99,tw1:4.5,tf1:7, h2:198,b2:99,tw2:4.5,tf2:7},
  {code:'+HN200×100+HN200×100',   type:'CRU', h1:200,b1:100,tw1:5.5,tf1:8, h2:200,b2:100,tw2:5.5,tf2:8},
  {code:'+HN250×125+HN250×125',   type:'CRU', h1:250,b1:125,tw1:6,tf1:9,  h2:250,b2:125,tw2:6,tf2:9},
  {code:'+HN300×150+HN300×150',   type:'CRU', h1:300,b1:150,tw1:6.5,tf1:10, h2:300,b2:150,tw2:6.5,tf2:10},
  {code:'+HN350×175+HN350×175',   type:'CRU', h1:350,b1:175,tw1:7,tf1:11, h2:350,b2:175,tw2:7,tf2:11},
  {code:'+HN400×200+HN400×200',   type:'CRU', h1:400,b1:200,tw1:8,tf1:13, h2:400,b2:200,tw2:8,tf2:13},
  {code:'+HN300×150+HN400×200',   type:'CRU', h1:300,b1:150,tw1:6.5,tf1:10, h2:400,b2:200,tw2:8,tf2:13},
  {code:'+HN250×125+HN350×175',   type:'CRU', h1:250,b1:125,tw1:6,tf1:9,   h2:350,b2:175,tw2:7,tf2:11},
  {code:'+HN200×100+HN300×150',   type:'CRU', h1:200,b1:100,tw1:5.5,tf1:8, h2:300,b2:150,tw2:6.5,tf2:10},
];
var H_BEAM_DB = SECTION_DB;

// ── 截面计算 ──────────────────────────────────────────────────
function secArea(s) {
  if (!s) return 0;
  var t = s.type;
  if (t === 'HW' || t === 'HM' || t === 'HN' || t === 'HP')
    return 2 * s.B * s.tf + (s.H - 2 * s.tf) * s.tw;
  if (t === 'BOX') {
    // 支持 t1（竖壁厚）/t2（横壁厚）不等厚，以及旧版单一 t 字段
    var tw = s.t1 || s.t || 0;   // 竖壁（左右）厚
    var tf = s.t2 || s.t || 0;   // 横壁（上下）厚
    return s.B * s.H - (s.B - 2 * tw) * (s.H - 2 * tf);
  }
  if (t === 'CHS') {
    var di = s.D - 2 * s.t;
    return Math.PI * (s.D * s.D - di * di) / 4;
  }
  if (t === 'CRU') {
    // ══════════════════════════════════════════════════════════════
    //  十字柱（CRU）截面积
    //  竖H（h1×b1×tw1×tf1）：h1/b1 为总高/总宽，腹板净高 = h1−2×tf1
    //  横H（h2×b2×tw2×tf2）：h2/b2 为总高/总宽，腹板净高 = h2−2×tf2
    //  正交焊接，中心重叠区 tw1×tw2 多算一次需减去
    //
    //  A = 竖H翼缘(2×b1×tf1) + 竖H腹板((h1−2tf1)×tw1)
    //    + 横H翼缘(2×b2×tf2) + 横H腹板((h2−2tf2)×tw2)
    //    - 重叠区(tw1×tw2)
    // ══════════════════════════════════════════════════════════════
    return 2 * s.b1 * (s.tf1||0)
         + (s.h1 - 2*(s.tf1||0)) * (s.tw1||0)
         + 2 * s.b2 * (s.tf2||0)
         + (s.h2 - 2*(s.tf2||0)) * (s.tw2||0)
         - (s.tw1||0) * (s.tw2||0);
  }
  if (t === 'CUSTOM') {
    // 异形截面：线重 w → 反推截面积 A
    // G(kg/m) = A(mm²) × 7850 / 1e6  →  A = G × 1e6 / 7850 = G / 0.00785
    return s.w ? s.w / 0.00785 : 0;
  }
  return 0;
}
function secWeight(s) {
  if (!s) return 0;
  if (s.type === 'CUSTOM') return s.w || 0; // 异形截面直接返回用户输入的线重
  return secArea(s) * STEEL_RHO / 1e6;      // kg/m：mm² × kg/m³ ÷ 1e6 = kg/m
}
function secW(s) { return secWeight(s); } // 兼容旧名

/* ═══════════════════════════════════════════════════════════════════════
 *  截面力学特性计算
 *  单位：mm⁴（Ix/Iy）、mm³（Wx/Wy）、mm（ix/iy）
 *  公式依据：材料力学 + GB/T 11263-2017《热轧H型钢和剖分T型钢》
 * ═══════════════════════════════════════════════════════════════════════ */

/* ── 各截面类型力学公式字符串（供 UI 显示）────────────────────────── */
function getMechFormulas(s, t, H, B, tw, tf, hw, A) {
  if (t === 'HW' || t === 'HM' || t === 'HN' || t === 'HP') {
    return {
      Ix:  '[B\u00D7H\u00B3 \u2212 (B\u2212t\u2081)\u00D7hw\u00B3]\u00F7 12',
      Iy:  '[2\u00D7t\u2082\u00D7B\u00B3 + hw\u00D7t\u2081\u00B3]\u00F7 12',
      Wx:  'Ix \u00F7 (H\u00F72)',
      Wy:  'Iy \u00F7 (B\u00F72)',
      ix:  '\u221A(Ix \u00F7 A)',
      iy:  '\u221A(Iy \u00F7 A)',
    };
  }
  if (t === 'BOX') {
    var t1 = s.t1 || s.t || 0, t2 = s.t2 || s.t || t1;
    var bi = B - 2*t1, hi = H - 2*t2;
    return {
      Ix:  '[B\u00D7H\u00B3 \u2212 b\u1D62\u00D7h\u1D62\u00B3]\u00F7 12',
      Iy:  '[H\u00D7B\u00B3 \u2212 h\u1D62\u00D7b\u1D62\u00B3]\u00F7 12',
      Wx:  'Ix \u00F7 (H\u00F72)',
      Wy:  'Iy \u00F7 (B\u00F72)',
      ix:  '\u221A(Ix \u00F7 A)',
      iy:  '\u221A(Iy \u00F7 A)',
    };
  }
  if (t === 'CHS') {
    var D = s.D, di = Math.max(0, D - 2*s.t);
    return {
      Ix:  '\u03C0\u00D7(D\u2074\u2212d\u1D62\u2074)\u00F7 64',
      Iy:  '\u03C0\u00D7(D\u2074\u2212d\u1D62\u2074)\u00F7 64  (=Ix)',
      Wx:  'Ix \u00F7 (D\u00F72)',
      Wy:  'Ix \u00F7 (D\u00F72)  (=Wx)',
      ix:  '\u221A(Ix \u00F7 A)',
      iy:  '\u221A(Iy \u00F7 A)  (=ix)',
    };
  }
  if (t === 'CRU') {
    var h1=s.h1||0, b1=s.b1||0, tw1=s.tw1||0, tf1=s.tf1||0;
    var h2=s.h2||0, b2=s.b2||0, tw2=s.tw2||0, tf2=s.tf2||0;
    // Ix 展开（竖H翼缘 + 竖H腹板 + 横H翼缘 + 横H腹板）
    // 竖H翼缘 at y=±h1/2: 2×[tf1×b1³/12 + b1×tf1×(h1/2)²]
    var s1 = '2\u00D7[tf\u2081\u00D7b\u2081\u00B3\u00F712 + b\u2081\u00D7tf\u2081\u00D7(h\u2081\u00F72)\u00B2]';
    // 竖H腹板 at y=0: tw1×(h1−2tf1)³/12
    var s2 = 'tw\u2081\u00D7(h\u2081\u22122\u00D7tf\u2081)\u00B3\u00F712';
    // 横H翼缘 at y=±h2/2: 2×[tf2×b2³/12 + b2×tf2×(h2/2)²]
    var s3 = '2\u00D7[tf\u2082\u00D7b\u2082\u00B3\u00F712 + b\u2082\u00D7tf\u2082\u00D7(h\u2082\u00F72)\u00B2]';
    // 横H腹板 at y=0: tw2×(h2−2tf2)³/12
    var s4 = 'tw\u2082\u00D7(h\u2082\u22122\u00D7tf\u2082)\u00B3\u00F712';
    // Iy 展开
    // 竖H翼缘 at x=±b1/2: 2×[tf1×b1³/12 + tf1×b1×(b1/2)²]（杠杆臂=b1/2）
    var t1 = '2\u00D7[tf\u2081\u00D7b\u2081\u00B3\u00F712 + tf\u2081\u00D7b\u2081\u00D7(b\u2081\u00F72)\u00B2]';
    // 竖H腹板 at x=0: tw1×(h1−2tf1)³/12
    var t2 = 'tw\u2081\u00D7(h\u2081\u22122\u00D7tf\u2081)\u00B3\u00F712';
    // 横H翼缘 at x=±h2/2: 2×[tf2×b2³/12 + tf2×b2×(h2/2)²]（杠杆臂=h2/2）
    var t3 = '2\u00D7[tf\u2082\u00D7b\u2082\u00B3\u00F712 + tf\u2082\u00D7b\u2082\u00D7(h\u2082\u00F72)\u00B2]';
    // 横H腹板 at x=0: tw2×h2³/12
    var t4 = 'tw\u2082\u00D7h\u2082\u00B3\u00F712';
    var Heff = Math.max(h1, b2), Beff = Math.max(h2, b1);
    return {
      Ix:  '['+s1+']+['+s2+']\n+['+s3+']+['+s4+']',
      Iy:  '['+t1+']+['+t2+']\n+['+t3+']+['+t4+']',
      Wx:  'Ix \u00F7 max(h\u2081,b\u2082)\u00F72',
      Wy:  'Iy \u00F7 max(h\u2082,b\u2081)\u00F72',
      ix:  '\u221A(Ix \u00F7 A)',
      iy:  '\u221A(Iy \u00F7 A)',
    };
  }
  if (t === 'CUSTOM') {
    return {
      Ix:  '\u2014\u2014',
      Iy:  '\u2014\u2014',
      Wx:  '\u2014\u2014',
      Wy:  '\u2014\u2014',
      ix:  '\u2014\u2014',
      iy:  '\u2014\u2014',
    };
  }
  return { Ix:'—', Iy:'—', Wx:'—', Wy:'—', ix:'—', iy:'—' };
}

function secProps(s) {
  if (!s) return null;
  var t = s.type;
  var A = secArea(s);
  var Ix = 0, Iy = 0;

  /* ════════════════════════════════════════════════════════════════
   *  H型钢（HW / HM / HN / HP）
   *
   *  ── 截面尺寸标注 ──────────────────────────────────────────────
   *
   *      ←────────── B ──────────→
   *      ┌───────────────────────┐  ┐
   *      │                       │  t₂  ↑ 翼缘厚度
   *      │       ┌─────────┐      │  t₁  ↑ 腹板厚度
   *      │       │         │      │  H   ↑ 截面总高度
   *      │       └─────────┘      │  hw  ↑ 腹板净高 = H - 2×t₂
   *      │                       │  t₂
   *      └───────────────────────┘  ┘
   *
   *  ── 符号定义 ─────────────────────────────────────────────────
   *    H   — 截面总高度（mm）
   *    B   — 翼缘宽度（mm）
   *    t₁  — 腹板厚度（mm）
   *    t₂  — 翼缘厚度（mm）
   *    hw  — 腹板净高 = H − 2×t₂（mm）
   *    x-x — 强轴（竖直弯曲主轴）
   *    y-y — 弱轴（水平弯曲主轴）
   *
   *  ── 截面积 A ─────────────────────────────────────────────────
   *    A = 2 × B × t₂  +  t₁ × (H − 2×t₂)
   *
   *  ── 强轴惯性矩 Ix ───────────────────────────────────────────
   *    Ix = [B×H³ − (B−t₁)×hw³] / 12
   *    推导（空心减法）：整截面 − 内腔
   *
   *  ── 弱轴惯性矩 Iy ───────────────────────────────────────────
   *    Iy = [2×t₂×B³ + (H−2×t₂)×t₁³] / 12
   *
   *  ── 截面模量 W ───────────────────────────────────────────────
   *    Wx = Ix / (H/2)
   *    Wy = Iy / (B/2)
   *
   *  ── 回转半径 i ───────────────────────────────────────────────
   *    ix = √(Ix / A)
   *    iy = √(Iy / A)
   *
   *  ── 理论线重量 G ────────────────────────────────────────────
   *    G = 0.00785 × A   （kg/m，ρ = 7850 kg/m³）
   *
   * ════════════════════════════════════════════════════════════════ */
  if (t === 'HW' || t === 'HM' || t === 'HN' || t === 'HP') {
    var H  = s.H,  B  = s.B;
    var t1 = s.tw || 0;   // t₁ 腹板厚度
    var t2 = s.tf || 0;   // t₂ 翼缘厚度
    var hw = H - 2 * t2;  // hw 腹板净高
    // 截面积
    A = 2 * B * t2 + t1 * hw;
    // Ix（强轴）
    Ix = (B * Math.pow(H,  3) - (B - t1) * Math.pow(hw, 3)) / 12;
    // Iy（弱轴）
    Iy = (2 * t2 * Math.pow(B, 3) + hw * Math.pow(t1, 3)) / 12;
  }

  /* ════════════════════════════════════════════════════════════════
   *  箱型截面（BOX）
   *
   *  ── 截面尺寸标注 ──────────────────────────────────────────────
   *
   *      ←──────── B ────────┼───── B ─────────→
   *      ┌─────────────────┼───────────────┐  ↑
   *      │                 │               │  t2（上下壁厚）
   *      │    ┌───────────┼───────────┐   │  ↓
   *      │    │  内腔尺寸  │           │   │
   *      │    │  bi × hi  │           │   ↑
   *      │    └───────────┼───────────┘   │  t2
   *      │                 │               │  ↓
   *      └─────────────────┼───────────────┘  ↑
   *
   *      ───────────────────────────────
   *              外框 B × H
   *      ───────────────────────────────
   *
   *  尺寸说明：
   *    H  — 截面总高
   *    B  — 截面总宽
   *    t1 — 竖壁厚（左右壁厚）
   *    t2 — 横壁厚（上下壁厚），t1/t2 可不等（不对称箱型）
   *    bi — 内腔宽 = B − 2×t1
   *    hi — 内腔高 = H − 2×t2
   *
   *  ── 截面积 A ─────────────────────────────────────────────────
   *    A = B × H  −  bi × hi
   *      = 外框面积 − 内腔面积
   *
   *  ── 强轴惯性矩 Ix ───────────────────────────────────────────
   *    Ix = (B × H³ − bi × hi³) / 12
   *
   *  ── 弱轴惯性矩 Iy ───────────────────────────────────────────
   *    Iy = (H × B³ − hi × bi³) / 12
   *
   * ════════════════════════════════════════════════════════════════ */
  else if (t === 'BOX') {
    var H  = s.H, B = s.B;
    var t1 = s.t1 || s.t || 0, t2 = s.t2 || s.t || t1;
    var bi = B - 2 * t1, hi = H - 2 * t2; // 内腔尺寸
    Ix = (B * Math.pow(H,  3) - bi * Math.pow(hi, 3)) / 12;
    Iy = (H * Math.pow(B,  3) - hi * Math.pow(bi, 3)) / 12;
  }

  /* ════════════════════════════════════════════════════════════════
   *  圆管截面（CHS）
   *
   *  ── 截面尺寸标注 ──────────────────────────────────────────────
   *    D  — 外径（outer diameter）
   *    t  — 壁厚（wall thickness）
   *    di — 内径 = D − 2×t
   *
   *  ── 截面积 A ─────────────────────────────────────────────────
   *    A = π × (D² − di²) / 4
   *
   *  ── 惯性矩 Ix = Iy（圆环关于任意直径轴）──────────────────────
   *    Ix = Iy = π × (D⁴ − di⁴) / 64
   *
   * ════════════════════════════════════════════════════════════════ */
  else if (t === 'CHS') {
    var D  = s.D, di = Math.max(0, D - 2 * s.t);
    Ix = Math.PI * (Math.pow(D,  4) - Math.pow(di, 4)) / 64;
    Iy = Ix;
  }

  /* ════════════════════════════════════════════════════════════════
   *  十字形截面（CRU）
   *
   *  ── 截面尺寸标注 ──────────────────────────────────────────────
   *
   *    竖H（h1 × b1 × tw1 × tf1）+ 横H（h2 × b2 × tw2 × tf2）焊接组合
   *    截面形心为原点 (0,0)，竖H与横H的几何中心均在此原点重合。
   *
   *      竖H翼缘 ─────────── b1 ───────────┐  ↑
   *      ┌─────────────────────────────────┐│  tf1（竖H翼缘厚）
   *      │  ┌─────────┬─────────┐         ││  ↓
   *      │  │ 横H腹板  │         │ h2      ││
   *      │  │  tw2×h2 │         │         ││
   *  ───┼──┤         ├─────────┤─────────┼──┤─ → x
   *      │  │         │         │         │  │
   *      │  │         │         │         │  │
   *      │  └─────────┴─────────┘         │  │
   *      │  ↑                              │  ↑
   *      │  h1                             │  tf1
   *      └─────────────────────────────────┘  ↓
   *      ──────────────── tw1 ────────────────
   *
   *  参数说明：
   *    h1  — 竖H总高度（含翼缘）
   *    b1  — 竖H翼缘宽度
   *    tw1 — 竖H腹板厚度
   *    tf1 — 竖H翼缘厚度
   *    h2  — 横H总高度（含翼缘）
   *    b2  — 横H翼缘宽度
   *    tw2 — 横H腹板厚度
   *    tf2 — 横H翼缘厚度
   *    腹板净高：hw1 = h1−2×tf1，hw2 = h2−2×tf2
   *    总高 Heff = max(h1, b2)，总宽 Beff = max(h2, b1)
   *
   *  ── 截面积 A ─────────────────────────────────────────────────
   *    A = 2×b1×tf1 + hw1×tw1        ← 竖H（hw1 = h1−2tf1）
   *      + 2×b2×tf2 + hw2×tw2        ← 横H（hw2 = h2−2tf2）
   *      − tw1×tw2                   ← 中心重叠区（多算一次，扣回）
   *
   *  ── Ix（强轴，关于 x 轴）─────────────────────────────────────
   *    竖H翼缘 at y=±h1/2：矩形(b1×tf1)×2块，d=h1/2
   *      Ix = 2×[tf1×b1³/12 + b1×tf1×(h1/2)²]
   *    竖H腹板 at y=0：矩形(tw1×hw1)
   *      Ix = tw1×hw1³/12
   *    横H翼缘 at y=±h2/2：矩形(b2×tf2)×2块，d=h2/2
   *      Ix = 2×[tf2×b2³/12 + b2×tf2×(h2/2)²]
   *    横H腹板 at y=0：矩形(tw2×hw2)
   *      Ix = tw2×hw2³/12
   *
   *  ── Iy（弱轴，关于 y 轴）─────────────────────────────────────
   *    竖H翼缘 at x=±b1/2：矩形(tf1×b1)×2块，d=b1/2；绕y轴自转=tf1×b1³/12，杠杆臂=h1/2
   *      Iy = 2×[tf1×b1³/12 + b1×tf1×(h1/2)²]
   *    竖H腹板 at x=0：矩形(tw1×hw1)
   *      Iy = tw1×hw1³/12
   *    横H翼缘 at x=±h2/2：矩形(tf2×b2)×2块，d=h2/2；绕y轴自转=tf2×b2³/12，杠杆臂=h2/2
   *      Iy = 2×[tf2×b2³/12 + tf2×b2×(h2/2)²]
   *    横H腹板 at x=0：矩形(tw2×h2)
   *      Iy = tw2×h2³/12
   *
   *  ── 截面模量与回转半径 ───────────────────────────────────────
   *    Wx = Ix / (Heff / 2)，其中 Heff = max(h1, b2)
   *    Wy = Iy / (Beff / 2)，其中 Beff = max(h2, b1)
   *    ix = √(Ix / A)，iy = √(Iy / A)
   *
   * ════════════════════════════════════════════════════════════════ */
  else if (t === 'CRU') {
    var h1=s.h1||0, b1=s.b1||0, tw1=s.tw1||0, tf1=s.tf1||0;
    var h2=s.h2||0, b2=s.b2||0, tw2=s.tw2||0, tf2=s.tf2||0;

    // 竖H腹板净高（不含翼缘）
    var hw1 = h1 - 2*tf1;
    var hw2 = h2 - 2*tf2;

    // Ix（强轴，关于 x 轴）
    // 竖H翼缘 at y=±h1/2：矩形(b1×tf1)×2块，d=h1/2
    var Ix_vH_fl  = 2 * (tf1 * Math.pow(b1, 3) / 12 + b1 * tf1 * Math.pow(h1/2, 2));
    // 竖H腹板 at y=0：矩形(tw1×hw1)
    var Ix_vH_web = tw1 * Math.pow(hw1, 3) / 12;
    // 横H翼缘 at y=±h2/2：矩形(b2×tf2)×2块，d=h2/2
    var Ix_hH_fl  = 2 * (tf2 * Math.pow(b2, 3) / 12 + b2 * tf2 * Math.pow(h2/2, 2));
    // 横H腹板 at y=0：矩形(tw2×hw2)
    var Ix_hH_web = tw2 * Math.pow(hw2, 3) / 12;
    Ix = Ix_vH_fl + Ix_vH_web + Ix_hH_fl + Ix_hH_web;

    // Iy（弱轴，关于 y 轴）
    // 竖H翼缘 at x=±b1/2：矩形(tf1×b1)×2块；绕y轴自转=tf1×b1³/12，杠杆臂=h1/2
    var Iy_vH_fl  = 2 * (tf1 * Math.pow(b1, 3) / 12 + tf1 * b1 * Math.pow(b1/2, 2));
    // 竖H腹板 at x=0：矩形(tw1×hw1)
    var Iy_vH_web = tw1 * Math.pow(hw1, 3) / 12;
    // 横H翼缘 at x=±h2/2：矩形(tf2×b2)×2块；绕y轴自转=tf2×b2³/12，杠杆臂=h2/2
    var Iy_hH_fl  = 2 * (tf2 * Math.pow(b2, 3) / 12 + tf2 * b2 * Math.pow(h2/2, 2));
    // 横H腹板 at y=0：矩形(tw2×h2)（绕y轴）
    var Iy_hH_web = tw2 * Math.pow(h2, 3) / 12;
    Iy = Iy_vH_fl + Iy_vH_web + Iy_hH_fl + Iy_hH_web;
  }

  if (!A || !Ix) return null;

  /* ── 共同后处理（适用于所有截面类型）───────────────────────────
   *
   *  ── 极端纤维距 Heff / Beff ───────────────────────────────────
   *    Heff = H        （H型钢 / 箱型 / 总高）
   *    Beff = B        （H型钢 / 箱型 / 总宽）
   *    Heff = D        （圆管：等效直径）
   *    CRU：  Heff = max(h₁, b₂)，Beff = max(h₂, b₁)
   *           b₂为横H翼缘总宽（单侧伸出b₂/2），b₁为竖H翼缘总宽
   *           当横H翼缘超出竖H腹板时（b₂>h₁），总高由b₂决定
   *
   *  ── 截面模量 Wx / Wy ─────────────────────────────────────────
   *    Wx = Ix / (Heff / 2)    ← 极端受拉纤维至中性轴距离 = Heff/2
   *    Wy = Iy / (Beff / 2)    ← 极端受拉纤维至中性轴距离 = Beff/2
   *    注：圆管 Ix = Iy，Wx = Wy = Ix / (D / 2)
   *
   *  ── 回转半径 ix / iy ──────────────────────────────────────────
   *    ix = √(Ix / A)
   *    iy = √(Iy / A)
   *    注：ix / iy 与截面高度/宽度无直接比例关系，由 Ix/Iy/A 共同决定
   *
   *  ── 线重量 w ─────────────────────────────────────────────────
   *    w = A × ρ / 10⁶   (mm² × 7850 kg/m³ ÷ 10⁶ = kg/m)
   *
   * ─────────────────────────────────────────────────────────────── */
  var Heff = s.H || s.D || 1;
  var Beff = s.B || s.D || 1;
  if (t === 'CRU') {
    // 总高 = max(竖H高度h₁, 横H翼缘总宽b₂)，总宽 = max(横H高度h₂, 竖H翼缘总宽b₁)
    Heff = Math.max(s.h1||0, s.b2||0);
    Beff = Math.max(s.h2||0, s.b1||0);
  }
  var Wx = Ix / (Heff / 2);
  var Wy = Iy / (Beff / 2);
  var ix = Math.sqrt(Ix / A);
  var iy = Math.sqrt(Iy / A);
  var w  = secWeight(s);

  return { A: A, Ix: Ix, Iy: Iy, Wx: Wx, Wy: Wy, ix: ix, iy: iy, w: w };
}


// ── 主截面输入区（始终可见）────────────────────────────────
var _mainSectionData = null; // 当前主截面数据

window.secMainTypeChange = function(prefillType) {
  var typeSel = document.getElementById('sec-main-type');
  var t = prefillType || (typeSel ? typeSel.value : 'HW');
  var grid = document.getElementById('secMainDims');
  if (!grid) return;

  var fields = {
    HW: [
      {id:'sm_H', label:'腹板高 H (mm)', placeholder:'800'},
      {id:'sm_B', label:'翼缘宽 B (mm)', placeholder:'400'},
      {id:'sm_tw', label:'腹板厚 tw (mm)', placeholder:'20'},
      {id:'sm_tf', label:'翼缘厚 tf (mm)', placeholder:'30'},
    ],
    BOX: [
      {id:'sm_H', label:'截面高 H (mm)', placeholder:'500'},
      {id:'sm_B', label:'截面宽 B (mm)', placeholder:'400'},
      {id:'sm_t1', label:'竖壁厚 t1 (mm)', placeholder:'20'},
      {id:'sm_t2', label:'横壁厚 t2 (mm)', placeholder:'12'},
    ],
    CHS: [
      {id:'sm_D', label:'外径 D (mm)', placeholder:'325'},
      {id:'sm_t', label:'壁厚 t (mm)', placeholder:'10'},
    ],
    CRU: [
      {id:'sm_h1', label:'竖H1 (mm)', placeholder:'400'},
      {id:'sm_b1', label:'竖B1 (mm)', placeholder:'200'},
      {id:'sm_tw1', label:'竖tw1 (mm)', placeholder:'13'},
      {id:'sm_tf1', label:'竖tf1 (mm)', placeholder:'21'},
      {id:'sm_h2', label:'横H2 (mm)', placeholder:'400'},
      {id:'sm_b2', label:'横B2 (mm)', placeholder:'200'},
      {id:'sm_tw2', label:'横tw2 (mm)', placeholder:'13'},
      {id:'sm_tf2', label:'横tf2 (mm)', placeholder:'21'},
    ],
    CUSTOM: [
      {id:'sm_name', label:'截面名称', placeholder:'如：异形柱-1'},
      {id:'sm_w',   label:'线重 w (kg/m)', placeholder:'如：156.3'},
      {id:'sm_H',   label:'截面高度 H (mm)', placeholder:'如：800'},
    ],
  };

  var flds = fields[t] || fields.HW;
  grid.innerHTML = flds.map(function(f) {
    return '<div class="form-group"><label>' + f.label + '</label>' +
      '<input type="number" id="' + f.id + '" placeholder="' + f.placeholder + '" step="1" min="1" oninput="updateMainSectionCalc()"></div>';
  }).join('');

  // 触发一次计算（显示空状态提示）
  updateMainSectionCalc();
};

window.updateMainSectionCalc = function() {
  var typeSel = document.getElementById('sec-main-type');
  var t = typeSel ? typeSel.value : 'HW';
  var g = function(id) {
    var el = document.getElementById(id);
    return el && el.value ? parseFloat(el.value) : 0;
  };

  var s = null;
  if (t === 'HW' || t === 'HM' || t === 'HN' || t === 'HP') {
    var H=g('sm_H'), B=g('sm_B'), tw=g('sm_tw'), tf=g('sm_tf');
    if (!H || !B || !tw || !tf) {
      showSecEmptyState(); return;
    }
    var typeLabel = {HW:'H型钢',HM:'H型钢',HN:'H型钢',HP:'H型钢'}[t] || 'H型钢';
    var labelStr = typeLabel + '  H:' + H + ' B:' + B + ' tw:' + tw + ' tf:' + tf;
    s = {type:t, H:H, B:B, tw:tw, tf:tf, _custom:true, code:t+H+'×'+B};
    s.label = labelStr;
    s.specRows = [
      {l:'腹板高 H', v: H+' mm'},
      {l:'翼缘宽 B', v: B+' mm'},
      {l:'腹板厚 tw', v: tw+' mm'},
      {l:'翼缘厚 tf', v: tf+' mm'},
    ];
  } else if (t === 'BOX') {
    var H=g('sm_H'), B=g('sm_B'), t1=g('sm_t1'), t2=g('sm_t2');
    if (!H || !B || !t1) { showSecEmptyState(); return; }
    if (!t2) t2 = t1; // 等壁厚默认
    var s = {type:'BOX', H:H, B:B, t1:t1, t2:t2, _custom:true};
    var sym = (H === B) ? '□方管' : '▭矩形管';
    s.label = sym + ' ' + H + '×' + B + ' t1:' + t1 + ' t2:' + t2;
    s.code = '□' + H + '×' + B + '×' + t1 + (t2 !== t1 ? '×' + t2 : '');
    s.specRows = [
      {l:'截面高 H', v: H+' mm'},
      {l:'截面宽 B', v: B+' mm'},
      {l:'竖壁厚 t1', v: t1+' mm'},
      {l:'横壁厚 t2', v: t2+' mm'},
    ];
  } else if (t === 'CHS') {
    var D=g('sm_D'), t3=g('sm_t');
    if (!D || !t3) { showSecEmptyState(); return; }
    s = {type:'CHS', D:D, t:t3, _custom:true, code:'Ø'+D+'×'+t3};
    s.label = '圆形钢管  D:' + D + ' t:' + t3;
    s.specRows = [
      {l:'外径 D',  v: D+' mm'},
      {l:'壁厚 t',  v: t3+' mm'},
      {l:'内径 di', v: (D-2*t3)+' mm'},
    ];
  } else if (t === 'CRU') {
    var h1=g('sm_h1'),b1=g('sm_b1'),tw1=g('sm_tw1'),tf1=g('sm_tf1');
    var h2=g('sm_h2'),b2=g('sm_b2'),tw2=g('sm_tw2'),tf2=g('sm_tf2');
    if (!h1 || !b1 || !h2 || !b2) { showSecEmptyState(); return; }
    s = {type:'CRU',h1:h1,b1:b1,tw1:tw1,tf1:tf1,h2:h2,b2:b2,tw2:tw2,tf2:tf2,_custom:true, code:'+HN'+h1+'×'+b1+'+HN'+h2+'×'+b2};
    // 总高 = max(竖H腹板高, 横H翼缘宽) = max(h1, b2)
    // 总宽 = max(横H腹板高, 竖H翼缘宽) = max(h2, b1)
    var Htotal = Math.max(h1, b2), Btotal = Math.max(h2, b1);
    s.label = '十字形组合  H:' + Htotal + ' B:' + Btotal;
    s.specRows = [
      {l:'总高', v: Htotal+' mm'},
      {l:'总宽', v: Btotal+' mm'},
      {l:'竖H(腹板'+h1+'×翼缘'+b1+'×2)', v: 'tw'+tw1+' tf'+tf1},
      {l:'横H(腹板'+h2+'×翼缘'+b2+'×2)', v: 'tw'+tw2+' tf'+tf2},
    ];
  } else if (t === 'CUSTOM') {
    var name = document.getElementById('sm_name') ? document.getElementById('sm_name').value.trim() : '';
    var w    = parseFloat(document.getElementById('sm_w')   ? document.getElementById('sm_w').value   : '') || 0;
    var H    = parseFloat(document.getElementById('sm_H')   ? document.getElementById('sm_H').value   : '') || 0;
    if (!name || !w || !H) { showSecEmptyState(); return; }
    s = {type:'CUSTOM', name:name, w:w, H:H, _custom:true, code:name};
    s.label = '异形 ' + name;
    s.specRows = [
      {l:'截面名称', v: name},
      {l:'线重 w',   v: w.toFixed(3) + ' kg/m'},
      {l:'截面高 H', v: H + ' mm'},
    ];
  }

  if (!s) { showSecEmptyState(); return; }

  // 渲染结果
  _mainSectionData = s;
  window._customSection = s;
  window._selectedSectionCode = null;

  var A = secArea(s);
  var w = secWeight(s);
  var props = secProps(s);  // 力学特性

  // 显示截面信息区
  _showSectionInfo();

  // 显示上下布局
  var emptyEl = document.getElementById('secEmptyState');
  var vizEl  = document.getElementById('secVizLayout');
  if (emptyEl) emptyEl.style.display = 'none';
  if (vizEl)  vizEl.style.display  = 'flex';

  // 类型标签
  var typeIconMap = {HW:'H',HM:'H',HN:'H',HP:'H',BOX:'▭',CHS:'○',CRU:'✚',CUSTOM:'◇'};
  var typeTextMap  = {HW:'H型钢',HM:'H型钢',HN:'H型钢',HP:'H型钢',BOX:'箱型截面',CHS:'圆管截面',CRU:'十字形截面',CUSTOM:'异形截面'};
  var iconEl = document.getElementById('secTypeIcon');
  var labelEl = document.getElementById('secTypeLabel');
  if (iconEl) iconEl.textContent = typeIconMap[t] || '?';
  if (labelEl) labelEl.textContent = typeTextMap[t] || t;

  // 截面名称
  document.getElementById('liftSecModel').textContent = s.label || s.code || '—';

  // 关键指标卡片：面积 + 延米重（三位小数）
  var aEl = document.getElementById('secMetA');
  var wEl = document.getElementById('secMetW');
  if (aEl) aEl.textContent = Math.round(A).toLocaleString();  // mm²，直接显示整数
  if (wEl) wEl.textContent = w.toFixed(3);

  // SVG 工程图纸
  var svgEl = document.getElementById('secSvg');
  if (svgEl) svgEl.innerHTML = drawSectionSVG(s);

  // 力学参数网格（对齐msteel格式）
  function fmtN(v, dec) {
    if (v == null || isNaN(v)) return '—';
    return v.toFixed(dec != null ? dec : 3);
  }
  var mechRows = '';
  if (props) {
    var H=s.H||1, B=s.B||1, tw=s.tw||0, tf=s.tf||0;
    var hw = H - 2*tf; // 腹板净高（仅H型钢用）
    var A = secArea(s);
    // 根据截面类型生成对应公式
    // CRU 截面：将完整s对象（含h1/b1/tw1/tf1/h2/b2/tw2/tf2）传入，使getMechFormulas能渲染具体分项公式
    var formulas = getMechFormulas(s, t, H, B, tw, tf, hw, A);
    var mechData = [
      ['Ix',  fmtN(props.Ix, 1) + ' mm\u2074',  formulas.Ix],
      ['Iy',  fmtN(props.Iy, 1) + ' mm\u2074',  formulas.Iy],
      ['Wx',  fmtN(props.Wx, 1) + ' mm\u00B3',  formulas.Wx],
      ['Wy',  fmtN(props.Wy, 1) + ' mm\u00B3',  formulas.Wy],
      ['ix',  fmtN(props.ix, 3) + ' mm',         formulas.ix],
      ['iy',  fmtN(props.iy, 3) + ' mm',         formulas.iy],
    ];
    mechRows = mechData.map(function(r) {
      return '<div class="sec-mech-item">' +
        '<div class="sec-param-row">' +
          '<span class="sec-param-l">'+r[0]+'</span>' +
          '<span class="sec-param-v">'+r[1]+'</span>' +
        '</div>' +
        '<div class="sec-mech-formula">'+r[2]+'</div>' +
      '</div>';
    }).join('');
  }

  // 几何参数行（原有specRows）
  var geomRows = (s.specRows || []).map(function(r) {
    return '<div class="sec-param-row"><span class="sec-param-l">'+r.l+'</span><span class="sec-param-v">'+r.v+'</span></div>';
  }).join('');

  // 分组：几何尺寸 + 力学特性（两个子标题）
  var allRows = '';
  if (geomRows) {
    allRows += '<div class="sec-param-group-title">几何尺寸</div>' + geomRows;
  }
  if (mechRows) {
    allRows += '<div class="sec-param-group-title">力学特性</div>' + mechRows;
  }
  document.getElementById('liftSpecRows').innerHTML = allRows;

  // 通知 liftCalc
  debounce(liftCalc, 'ls', 300);
  saveFormData();
};

function showSecEmptyState() {
  _mainSectionData = null;
  var infoEl = document.getElementById('liftSecInfo');
  if (infoEl) infoEl.style.display = 'none';
}

function _showSectionInfo() {
  var infoEl = document.getElementById('liftSecInfo');
  if (infoEl) infoEl.style.display = '';
}

// 旧版面板函数已由新版 secMainTypeChange / updateMainSectionCalc 替代，保留空函数防止HTML内联事件报错
window.openCustomSectionInput = function() {};
window.closeCustomInput = function() {};

// 截面参数行（用于 liftSecInfo 展示）
function secSpecRows(s) {
  if (!s) return [];
  var t = s.type;
  if (t === 'HW' || t === 'HM' || t === 'HN' || t === 'HP')
    return [
      {l:'腹板高 H', v: s.H+' mm'},
      {l:'翼缘宽 B', v: s.B+' mm'},
      {l:'腹板厚 tw', v: s.tw+' mm'},
      {l:'翼缘厚 tf', v: s.tf+' mm'},
    ];
  if (t === 'BOX')
    return [
      {l:'截面高 H', v: s.H+' mm'},
      {l:'截面宽 B', v: s.B+' mm'},
      {l:'竖壁厚 t1', v: (s.t1||s.t)+' mm'},
      {l:'横壁厚 t2', v: (s.t2||s.t||s.t1)+' mm'},
    ];
  if (t === 'CHS')
    return [
      {l:'外径 D',  v: s.D+' mm'},
      {l:'壁厚 t',  v: s.t+' mm'},
      {l:'内径 di', v: (s.D-2*s.t)+' mm'},
    ];
  if (t === 'CRU')
    return [
      {l:'总高',  v: s.h1+' mm'},
      {l:'总宽',  v: s.h2+' mm'},
      {l:'竖H1×B1', v: s.h1+'×'+s.b1+' tw'+s.tw1+' tf'+s.tf1},
      {l:'横H2×B2', v: s.h2+'×'+s.b2+' tw'+s.tw2+' tf'+s.tf2},
    ];
  return [];
}

// drawSectionSVG - 工程图纸风格增强版
// 配色：浅色格线背景 + 钢蓝斜纹填充 + 红尺标注 + 工程标注
// 文字全部置于截面外侧，避免与截面图形碰撞
function drawSectionSVG(s) {
  if (!s) return '';
  var t = s.type;
  var W = 340, H = 300;
  var cx = W/2, cy = H/2 - 8;

  // 工程图纸配色
  var paperBg   = '#f4f5f9';   // 工程图纸背景
  var gridColor = '#dde0e8';   // 格线
  var wallFill  = '#b8c5d8';   // 钢板填充（斜纹底色）
  var wallEdge  = '#2c4a7c';   // 钢板轮廓（深钢蓝）
  var webFill   = '#d0daea';   // 腹板（略浅）
  var holeFill  = '#f4f5f9';   // 孔洞（纸色）
  var dimColor  = '#c0392b';   // 标注线（工程红）
  var dimText   = '#2c4a7c';   // 标注文字（深钢蓝）
  var axisColor = '#e53e3e';   // 中心线（红色）
  var leaderClr = '#8b4513';   // 引线颜色（棕色）

  // SVG头 + 浅格纸背景
  var SVG_HDR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" style="display:block; width:100%; height:auto; max-width:100%;">';

  // 工程图纸格线背景
  var GRID = '<rect width="'+W+'" height="'+H+'" fill="'+paperBg+'"/>';
  for (var gx = 0; gx <= W; gx += 20) {
    GRID += '<line x1="'+gx+'" y1="0" x2="'+gx+'" y2="'+H+'" stroke="'+gridColor+'" stroke-width="'+(gx%40===0?'0.8':'0.4')+'"/>';
  }
  for (var gy = 0; gy <= H; gy += 20) {
    GRID += '<line x1="0" y1="'+gy+'" x2="'+W+'" y2="'+gy+'" stroke="'+gridColor+'" stroke-width="'+(gy%40===0?'0.8':'0.4')+'"/>';
  }

  // 钢斜纹图案（45度细斜线）
  var PATTERN = '<defs><pattern id="sHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#9fb4cc" stroke-width="1.2"/></pattern></defs>';

  // 水平标注（截面外侧，y为引伸线位置，x1-x2为起止）
  function dimH(y, x1, x2, label, above) {
    var dir = above ? -1 : 1;
    var arrowY = y;
    var lineY  = y + dir * 16;   // 尺寸线距截面边距16px
    var textY  = lineY + dir * 14;
    return '<line x1="'+x1+'" y1="'+arrowY+'" x2="'+x1+'" y2="'+lineY+'" stroke="'+dimColor+'" stroke-width="1.0" stroke-dasharray="3,2"/>'+
           '<line x1="'+x2+'" y1="'+arrowY+'" x2="'+x2+'" y2="'+lineY+'" stroke="'+dimColor+'" stroke-width="1.0" stroke-dasharray="3,2"/>'+
           '<line x1="'+(x1)+'" y1="'+lineY+'" x2="'+(x2)+'" y2="'+lineY+'" stroke="'+dimColor+'" stroke-width="1.2"/>'+
           '<polygon points="'+(x1+1)+','+lineY+' '+(x1+6)+','+(lineY-3.5)+' '+(x1+6)+','+(lineY+3.5)+'" fill="'+dimColor+'"/>'+
           '<polygon points="'+(x2-1)+','+lineY+' '+(x2-6)+','+(lineY-3.5)+' '+(x2-6)+','+(lineY+3.5)+'" fill="'+dimColor+'"/>'+
           '<text x="'+((x1+x2)/2)+'" y="'+textY+'" text-anchor="middle" fill="'+dimText+'" font-size="13" font-weight="700" font-family="system-ui,sans-serif">'+label+'</text>';
  }

  // 垂直标注（截面外侧）
  function dimV(x, y1, y2, label, right) {
    var dir = right ? 1 : -1;
    var lineX = x + dir * 16;
    var textX = lineX + dir * 16;
    return '<line x1="'+x+'" y1="'+y1+'" x2="'+lineX+'" y2="'+y1+'" stroke="'+dimColor+'" stroke-width="1.0" stroke-dasharray="3,2"/>'+
           '<line x1="'+x+'" y1="'+y2+'" x2="'+lineX+'" y2="'+y2+'" stroke="'+dimColor+'" stroke-width="1.0" stroke-dasharray="3,2"/>'+
           '<line x1="'+lineX+'" y1="'+y1+'" x2="'+lineX+'" y2="'+y2+'" stroke="'+dimColor+'" stroke-width="1.2"/>'+
           '<polygon points="'+lineX+','+(y1+1)+' '+(lineX-3.5)+','+(y1+6)+' '+(lineX+3.5)+','+(y1+6)+'" fill="'+dimColor+'"/>'+
           '<polygon points="'+lineX+','+(y2-1)+' '+(lineX-3.5)+','+(y2-6)+' '+(lineX+3.5)+','+(y2-6)+'" fill="'+dimColor+'"/>'+
           '<text x="'+textX+'" y="'+((y1+y2)/2)+'" text-anchor="'+(right?'start':'end')+'" fill="'+dimText+'" font-size="13" font-weight="700" font-family="system-ui,sans-serif" dominant-baseline="middle">'+label+'</text>';
  }

  // 引线标注（从截面边缘引出，文字完全在外）
  function leader(x1, y1, x2, y2, label, anchor) {
    anchor = anchor || 'start';
    var dx = (x2 - x1) * 0.6;
    var mx = x1 + dx;
    return '<line x1="'+x1+'" y1="'+y1+'" x2="'+mx+'" y2="'+y2+'" stroke="'+leaderClr+'" stroke-width="0.9"/>'+
           '<line x1="'+mx+'" y1="'+y2+'" x2="'+x2+'" y2="'+y2+'" stroke="'+leaderClr+'" stroke-width="0.9"/>'+
           '<text x="'+(x2+(anchor==='start'?3:-3))+'" y="'+(y2+1)+'" text-anchor="'+anchor+'" fill="'+leaderClr+'" font-size="12" font-weight="600" font-family="system-ui,sans-serif" dominant-baseline="middle">'+label+'</text>';
  }

  // 中心线（细虚线）
  function axisY(y1, y2) {
    return '<line x1="'+cx+'" y1="'+y1+'" x2="'+cx+'" y2="'+y2+'" stroke="'+axisColor+'" stroke-width="0.6" stroke-dasharray="4,3" opacity="0.6"/>';
  }
  function axisX(x1, x2) {
    return '<line x1="'+x1+'" y1="'+cy+'" x2="'+x2+'" y2="'+cy+'" stroke="'+axisColor+'" stroke-width="0.6" stroke-dasharray="4,3" opacity="0.6"/>';
  }

  // 标注线箭头（marker方案备用，现改为内联polygon）
  var ARROW = '';

  // 标题栏背景（CRU在内联构建自己的标题栏，其他类型使用此默认值）
  var titleBar = '<rect x="0" y="'+(H-26)+'" width="'+W+'" height="26" rx="0" fill="#e8edf5" opacity="0.9"/>'+
    '<text x="'+cx+'" y="'+(H-9)+'" text-anchor="middle" fill="#2c4a7c" font-size="12" font-weight="700" font-family="system-ui,sans-serif">'+s.code+'</text>';

  /* ── 十字形组合截面 (CRU) ─────────────────────
       几何模型：两个H型钢以截面形心为中心点正交焊接
       竖H: h₁×b₁×tw₁×tf₁, h₁=总高, b₁=翼缘总宽
       横H (旋转90°): h₂×b₂×tw₂×tf₂, h₂=总高(旋转后为宽), b₂=翼缘总宽(旋转后为高)
       十字截面总高 HB = h₁（竖H高度）
       十字截面总宽 BB = h₂（横H旋转后高度）
       交叉区（竖腹板∩横腹板）用深色独立绘制，不重复计算面积
  */
  if (t === 'CRU') {
    var h1=s.h1||0, b1=s.b1||0, tw1=s.tw1||6, tf1=s.tf1||8;
    var h2=s.h2||0, b2=s.b2||0, tw2=s.tw2||6, tf2=s.tf2||8;
    var Htot = h1, Btot = h2; // 总高=竖H高度，总宽=横H（旋转后）高度
    if (!h1||!b1||!h2||!b2) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'"><rect width="'+W+'" height="'+H+'" rx="8" fill="#f4f5f9"/><text x="'+cx+'" y="'+(cy+5)+'" text-anchor="middle" fill="#656d76" font-size="13">参数不全</text></svg>';

    // 动态画布：确保能容纳最极端标注（BB/HB引线每侧约60px，标题栏24px，网格线20px）
    var needW = Btot + 180, needH = Htot + 180;
    var cW = Math.max(480, needW), cH = Math.max(420, needH);
    var ccx = cW/2 - 10, ccy = cH/2 - 18;
    var margin = 72;
    var scale = Math.min((cW - margin*2 - 60) / Btot, (cH - margin*2 - 40) / Htot) * 0.80;

    var sTf1 = Math.max(3, tf1*scale), sTw1 = Math.max(2.5, tw1*scale);
    var sTf2 = Math.max(3, tf2*scale), sTw2 = Math.max(2.5, tw2*scale);
    var sH1  = h1*scale, sB1 = b1*scale;
    var sH2  = h2*scale, sB2 = b2*scale;
    // 文字放大：确保缩放后任意对话框宽度下字号 >= 10px
    var minFs = 10;
    var baseFs1 = Math.max(18, Math.ceil(minFs / scale)); // HB/BB 主标注
    var baseFs2 = Math.max(14, Math.ceil(minFs / scale)); // b1/h1 副标注
    var baseFs3 = Math.max(12, Math.ceil(minFs / scale)); // tf/tw 细节标注

    var vL  = ccx - sB1/2, vR  = ccx + sB1/2, vT  = ccy - sH1/2, vB  = ccy + sH1/2;
    var vwL = ccx - sTw1/2, vwR = ccx + sTw1/2;
    var hL  = ccx - sH2/2, hR  = ccx + sH2/2, hT  = ccy - sB2/2, hB  = ccy + sB2/2;
    var hwT = ccy - sTw2/2, hwB = ccy + sTw2/2;
    var xL = vwL, xR = vwR, xT = hwT, xB = hwB;

    var f2 = function(v){ return (+v).toFixed(1); };
    var SSTK = '#2c4a7c', HFIL = '#ffffff', HSTK = '#b0b8c8';
    var DC = '#c0392b', DT = '#2d3748', LC = '#5a3e8a', AC = '#e53e3e';

    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+cW+' '+cH+'" style="display:block; width:100%; height:auto; max-width:100%;">';
    svg += '<rect width="'+cW+'" height="'+cH+'" fill="#f6f7fa"/>';
    for (var gx2=0; gx2<=cW; gx2+=20) svg += '<line x1="'+gx2+'" y1="0" x2="'+gx2+'" y2="'+cH+'" stroke="#dde0e8" stroke-width="'+(gx2%40===0?'0.65':'0.3')+'"/>';
    for (var gy2=0; gy2<=cH; gy2+=20) svg += '<line x1="0" y1="'+gy2+'" x2="'+cW+'" y2="'+gy2+'" stroke="#dde0e8" stroke-width="'+(gy2%40===0?'0.65':'0.3')+'"/>';
    svg += '<defs>'+
      '<pattern id="pSteel2" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#8a9bb0" stroke-width="0.75"/></pattern>'+
      '<pattern id="pCross2" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#5a7090" stroke-width="1.2"/></pattern>'+
    '</defs>';

    // 四象限内腔
    svg += '<rect x="'+f2(vL)+'"  y="'+f2(vT)+'"  width="'+f2(vwL-vL)+'"  height="'+f2(hwT-vT)+'"  fill="'+HFIL+'" stroke="'+HSTK+'" stroke-width="0.5" stroke-dasharray="3,2"/>';
    svg += '<rect x="'+f2(vwR)+'" y="'+f2(vT)+'"  width="'+f2(vR-vwR)+'"  height="'+f2(hwT-vT)+'"  fill="'+HFIL+'" stroke="'+HSTK+'" stroke-width="0.5" stroke-dasharray="3,2"/>';
    svg += '<rect x="'+f2(vL)+'"  y="'+f2(hwB)+'" width="'+f2(vwL-vL)+'"  height="'+f2(vB-hwB)+'"  fill="'+HFIL+'" stroke="'+HSTK+'" stroke-width="0.5" stroke-dasharray="3,2"/>';
    svg += '<rect x="'+f2(vwR)+'" y="'+f2(hwB)+'" width="'+f2(vR-vwR)+'"  height="'+f2(vB-hwB)+'"  fill="'+HFIL+'" stroke="'+HSTK+'" stroke-width="0.5" stroke-dasharray="3,2"/>';

    // 竖H上下翼缘
    svg += '<rect x="'+f2(vL)+'" y="'+f2(vT)+'" width="'+f2(vR-vL)+'" height="'+f2(sTf1)+'" fill="url(#pSteel2)" stroke="'+SSTK+'" stroke-width="1.4"/>';
    svg += '<rect x="'+f2(vL)+'" y="'+f2(vB-sTf1)+'" width="'+f2(vR-vL)+'" height="'+f2(sTf1)+'" fill="url(#pSteel2)" stroke="'+SSTK+'" stroke-width="1.4"/>';
    // 竖腹板（不含交叉区：分上下两段）
    if (hwT > vT+sTf1) svg += '<rect x="'+f2(vwL)+'" y="'+f2(vT+sTf1)+'" width="'+f2(vwR-vwL)+'" height="'+f2(hwT-(vT+sTf1))+'" fill="url(#pSteel2)" stroke="'+SSTK+'" stroke-width="1.4"/>';
    if (vB-sTf1 > hwB) svg += '<rect x="'+f2(vwL)+'" y="'+f2(hwB)+'" width="'+f2(vwR-vwL)+'" height="'+f2((vB-sTf1)-hwB)+'" fill="url(#pSteel2)" stroke="'+SSTK+'" stroke-width="1.4"/>';
    // 横H左右翼缘
    svg += '<rect x="'+f2(hL)+'" y="'+f2(hT)+'" width="'+f2(sTf2)+'" height="'+f2(hB-hT)+'" fill="url(#pSteel2)" stroke="'+SSTK+'" stroke-width="1.4"/>';
    svg += '<rect x="'+f2(hR-sTf2)+'" y="'+f2(hT)+'" width="'+f2(sTf2)+'" height="'+f2(hB-hT)+'" fill="url(#pSteel2)" stroke="'+SSTK+'" stroke-width="1.4"/>';
    // 横腹板（不含交叉区：分左右两段）
    if (vwL > hL+sTf2) svg += '<rect x="'+f2(hL+sTf2)+'" y="'+f2(hwT)+'" width="'+f2(vwL-(hL+sTf2))+'" height="'+f2(hwB-hwT)+'" fill="url(#pSteel2)" stroke="'+SSTK+'" stroke-width="1.4"/>';
    if (hR-sTf2 > vwR) svg += '<rect x="'+f2(vwR)+'" y="'+f2(hwT)+'" width="'+f2((hR-sTf2)-vwR)+'" height="'+f2(hwB-hwT)+'" fill="url(#pSteel2)" stroke="'+SSTK+'" stroke-width="1.4"/>';
    // 交叉区（深色，独立，不重复计算）
    svg += '<rect x="'+f2(xL)+'" y="'+f2(xT)+'" width="'+f2(xR-xL)+'" height="'+f2(xB-xT)+'" fill="url(#pCross2)" stroke="'+SSTK+'" stroke-width="1.6"/>';
    svg += '<line x1="'+f2(xL)+'" y1="'+f2((xT+xB)/2)+'" x2="'+f2(xR)+'" y2="'+f2((xT+xB)/2)+'" stroke="#2c4a7c" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.6"/>';
    svg += '<line x1="'+f2((xL+xR)/2)+'" y1="'+f2(xT)+'" x2="'+f2((xL+xR)/2)+'" y2="'+f2(xB)+'" stroke="#2c4a7c" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.6"/>';

    // 中心轴线（截面上方留出标注空间）
    svg += '<line x1="'+f2(ccx)+'" y1="'+f2(Math.max(vT-18, 8))+'" x2="'+f2(ccx)+'" y2="'+f2(vB+10)+'" stroke="'+AC+'" stroke-width="0.7" stroke-dasharray="6,4" opacity="0.45"/>';
    svg += '<line x1="'+f2(hL-10)+'" y1="'+f2(ccy)+'" x2="'+f2(hR+10)+'" y2="'+f2(ccy)+'" stroke="'+AC+'" stroke-width="0.7" stroke-dasharray="6,4" opacity="0.45"/>';

    // ═══════════════════════════════════════════════════════════
    //  标注布局策略：
    //  BB（总宽）→ 截面下方最外层（红线）
    //  b1（竖翼缘宽）→ 截面下方内层，在 BB 上方（紫线）
    //  HB（总高）→ 截面右侧最外层（红线）
    //  h1（竖总高）→ 截面左侧（紫线，标注竖H上下翼缘之间的距离）
    //  tw1/tf1   → 截面左侧外引线（紫）
    //  tw2/tf2   → 截面右侧外引线（紫）
    //  b2（横翼缘宽）→ 截面左侧下方外（紫）
    // ═══════════════════════════════════════════════════════════

    // ── 计算截面实际外边界 ───────────────────────────
    // 底部外边界：竖H主导（h1>b2）时为 vB，否则为 hB
    var secBottom = Math.max(vB, hB);
    // 右侧外边界：横H主导（h2>b1）时为 hR，否则为 vR
    var secRight  = Math.max(hR, vR);
    // 顶部外边界
    var secTop    = Math.min(vT, hT);

    // ── 1. BB 总宽（红线，截面正下方，最外层）──
    var BB_Y  = secBottom + 40; // 总宽线：截面底部以下 40px
    var BB_x1 = ccx - Btot/2, BB_x2 = ccx + Btot/2;
    svg += '<line x1="'+f2(BB_x1)+'" y1="'+f2(BB_Y)+'" x2="'+f2(BB_x2)+'" y2="'+f2(BB_Y)+'" stroke="'+DC+'" stroke-width="1.3"/>'+
           '<line x1="'+f2(BB_x1)+'" y1="'+f2(BB_Y-5)+'" x2="'+f2(BB_x1)+'" y2="'+f2(BB_Y+5)+'" stroke="'+DC+'" stroke-width="1.3"/>'+
           '<line x1="'+f2(BB_x2)+'" y1="'+f2(BB_Y-5)+'" x2="'+f2(BB_x2)+'" y2="'+f2(BB_Y+5)+'" stroke="'+DC+'" stroke-width="1.3"/>'+
           '<text x="'+f2(ccx)+'" y="'+f2(BB_Y+14)+'" text-anchor="middle" fill="'+DC+'" font-size="'+baseFs1+'" font-weight="700" font-family="system-ui,sans-serif">BB = '+Btot+' mm</text>';

    // ── 2. b1 竖翼缘宽（紫线，截面下方内层，在 BB 上方）──
    // b1 标注范围：竖H的左右翼缘边界（vL 到 vR），在 BB 线内侧
    var b1_Y = BB_Y - 26; // 在 BB 线上方 26px
    svg += '<line x1="'+f2(vL)+'" y1="'+f2(b1_Y)+'" x2="'+f2(vR)+'" y2="'+f2(b1_Y)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(vL)+'" y1="'+f2(b1_Y-3)+'" x2="'+f2(vL)+'" y2="'+f2(b1_Y+3)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(vR)+'" y1="'+f2(b1_Y-3)+'" x2="'+f2(vR)+'" y2="'+f2(b1_Y+3)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<text x="'+f2((vL+vR)/2)+'" y="'+f2(b1_Y-7)+'" text-anchor="middle" fill="'+LC+'" font-size="'+baseFs2+'" font-weight="600" font-family="system-ui,sans-serif">b₁='+b1+' mm</text>';

    // ── 3. HB 总高（红线，截面右侧，最外层）──
    var HB_X  = secRight + 52; // 总高线：截面右侧以外 52px
    var HB_y1 = ccy - Htot/2, HB_y2 = ccy + Htot/2;
    svg += '<line x1="'+f2(HB_X)+'" y1="'+f2(HB_y1)+'" x2="'+f2(HB_X)+'" y2="'+f2(HB_y2)+'" stroke="'+DC+'" stroke-width="1.3"/>'+
           '<line x1="'+f2(HB_X-5)+'" y1="'+f2(HB_y1)+'" x2="'+f2(HB_X+5)+'" y2="'+f2(HB_y1)+'" stroke="'+DC+'" stroke-width="1.3"/>'+
           '<line x1="'+f2(HB_X-5)+'" y1="'+f2(HB_y2)+'" x2="'+f2(HB_X+5)+'" y2="'+f2(HB_y2)+'" stroke="'+DC+'" stroke-width="1.3"/>'+
           '<text x="'+f2(HB_X+16)+'" y="'+f2(ccy)+'" text-anchor="middle" fill="'+DC+'" font-size="'+baseFs1+'" font-weight="700" font-family="system-ui,sans-serif" dominant-baseline="middle" transform="rotate(90,'+f2(HB_X+16)+','+f2(ccy)+')">HB = '+Htot+' mm</text>';

    // ── 4. h1 竖H总高（紫线，截面左侧，标注竖H上下翼缘之间的距离）──
    // 标注位置：截面左侧，x = vL - 52，在 tf1/tw1 引线外侧
    var h1_X = vL - 52;
    svg += '<line x1="'+f2(h1_X)+'" y1="'+f2(vT)+'" x2="'+f2(h1_X)+'" y2="'+f2(vB)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(h1_X-3)+'" y1="'+f2(vT)+'" x2="'+f2(h1_X+3)+'" y2="'+f2(vT)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(h1_X-3)+'" y1="'+f2(vB)+'" x2="'+f2(h1_X+3)+'" y2="'+f2(vB)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<text x="'+f2(h1_X-7)+'" y="'+f2(ccy)+'" text-anchor="middle" fill="'+LC+'" font-size="'+baseFs2+'" font-weight="600" font-family="system-ui,sans-serif" dominant-baseline="middle" transform="rotate(-90,'+f2(h1_X-7)+','+f2(ccy)+')">h₁='+h1+' mm</text>';

    // ── 5. tf1 竖H上翼缘厚（紫，左侧引线，外侧超出 h1_X）──
    var tf1MidY = vT + sTf1/2;
    svg += '<line x1="'+f2(vL)+'" y1="'+f2(tf1MidY)+'" x2="'+f2(vL-18)+'" y2="'+f2(tf1MidY)+'" stroke="'+LC+'" stroke-width="0.8" stroke-dasharray="3,2"/>'+
           '<line x1="'+f2(vL-18)+'" y1="'+f2(tf1MidY)+'" x2="'+f2(h1_X-4)+'" y2="'+f2(tf1MidY)+'" stroke="'+LC+'" stroke-width="0.8" stroke-dasharray="3,2"/>'+
           '<circle cx="'+f2(vL)+'" cy="'+f2(tf1MidY)+'" r="1.8" fill="'+LC+'"/>'+
           '<text x="'+f2(h1_X-7)+'" y="'+f2(tf1MidY)+'" text-anchor="middle" fill="'+LC+'" font-size="'+baseFs3+'" font-weight="600" font-family="system-ui,sans-serif" dominant-baseline="middle" transform="rotate(-90,'+f2(h1_X-7)+','+f2(tf1MidY)+')">tf₁='+tf1+'</text>';

    // ── 6. tw1 竖腹板厚（紫，左侧，vwL/vwR 之间）──
    var tw1MidY = ccy;
    svg += '<line x1="'+f2(vwL)+'" y1="'+f2(tw1MidY)+'" x2="'+f2(vwR)+'" y2="'+f2(tw1MidY)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(vwL)+'" y1="'+f2(tw1MidY-3)+'" x2="'+f2(vwL)+'" y2="'+f2(tw1MidY+3)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(vwR)+'" y1="'+f2(tw1MidY-3)+'" x2="'+f2(vwR)+'" y2="'+f2(tw1MidY+3)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(vwL)+'" y1="'+f2(tw1MidY)+'" x2="'+f2(h1_X-4)+'" y2="'+f2(tw1MidY)+'" stroke="'+LC+'" stroke-width="0.8" stroke-dasharray="3,2"/>'+
           '<text x="'+f2(h1_X-7)+'" y="'+f2(tw1MidY)+'" text-anchor="middle" fill="'+LC+'" font-size="'+baseFs3+'" font-weight="600" font-family="system-ui,sans-serif" dominant-baseline="middle" transform="rotate(-90,'+f2(h1_X-7)+','+f2(tw1MidY)+')">tw₁='+tw1+'</text>';

    // ── 7. tf2 横H翼缘厚（紫，右侧上方外）──
    // 标注在截面右上方，在 HB 线下方留出空间
    var tf2MidX = hR + 24;
    svg += '<line x1="'+f2(hR)+'" y1="'+f2(hT)+'" x2="'+f2(tf2MidX)+'" y2="'+f2(hT)+'" stroke="'+LC+'" stroke-width="0.8" stroke-dasharray="3,2"/>'+
           '<line x1="'+f2(tf2MidX)+'" y1="'+f2(hT)+'" x2="'+f2(HB_X-4)+'" y2="'+f2(hT)+'" stroke="'+LC+'" stroke-width="0.8" stroke-dasharray="3,2"/>'+
           '<circle cx="'+f2(hR)+'" cy="'+f2(hT)+'" r="1.8" fill="'+LC+'"/>'+
           '<text x="'+f2((tf2MidX+HB_X-4)/2)+'" y="'+f2(hT-6)+'" text-anchor="middle" fill="'+LC+'" font-size="'+baseFs3+'" font-weight="600" font-family="system-ui,sans-serif">tf₂='+tf2+'</text>';

    // ── 8. tw2 横腹板厚（紫，右侧，从 hwT 到 hwB）──
    var tw2MidX = hR + 24;
    svg += '<line x1="'+f2(tw2MidX)+'" y1="'+f2(hwT)+'" x2="'+f2(tw2MidX)+'" y2="'+f2(hwB)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(tw2MidX-3)+'" y1="'+f2(hwT)+'" x2="'+f2(tw2MidX+3)+'" y2="'+f2(hwT)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(tw2MidX-3)+'" y1="'+f2(hwB)+'" x2="'+f2(tw2MidX+3)+'" y2="'+f2(hwB)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(hR)+'" y1="'+f2(hwT)+'" x2="'+f2(tw2MidX)+'" y2="'+f2(hwT)+'" stroke="'+LC+'" stroke-width="0.8" stroke-dasharray="3,2"/>'+
           '<line x1="'+f2(hR)+'" y1="'+f2(hwB)+'" x2="'+f2(tw2MidX)+'" y2="'+f2(hwB)+'" stroke="'+LC+'" stroke-width="0.8" stroke-dasharray="3,2"/>'+
           '<line x1="'+f2(tw2MidX)+'" y1="'+f2(hwT)+'" x2="'+f2(HB_X-4)+'" y2="'+f2(hwT)+'" stroke="'+LC+'" stroke-width="0.8" stroke-dasharray="3,2"/>'+
           '<line x1="'+f2(tw2MidX)+'" y1="'+f2(hwB)+'" x2="'+f2(HB_X-4)+'" y2="'+f2(hwB)+'" stroke="'+LC+'" stroke-width="0.8" stroke-dasharray="3,2"/>'+
           '<text x="'+f2(HB_X-16)+'" y="'+f2(ccy)+'" text-anchor="middle" fill="'+LC+'" font-size="'+baseFs3+'" font-weight="600" font-family="system-ui,sans-serif" dominant-baseline="middle" transform="rotate(90,'+f2(HB_X-16)+','+f2(ccy)+')">tw₂='+tw2+'</text>';

    // ── 9. b2 横H翼缘宽（紫，左侧，标注横H翼缘的竖向高度）──
    // 位置：左侧，b1标注下方（y > b1_Y），x = h1_X
    var b2DimX = h1_X;
    var b2Top = hT, b2Bot = hB;
    svg += '<line x1="'+f2(b2DimX)+'" y1="'+f2(b2Top)+'" x2="'+f2(b2DimX)+'" y2="'+f2(b2Bot)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(b2DimX-3)+'" y1="'+f2(b2Top)+'" x2="'+f2(b2DimX+3)+'" y2="'+f2(b2Top)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<line x1="'+f2(b2DimX-3)+'" y1="'+f2(b2Bot)+'" x2="'+f2(b2DimX+3)+'" y2="'+f2(b2Bot)+'" stroke="'+LC+'" stroke-width="0.9"/>'+
           '<text x="'+f2(b2DimX-7)+'" y="'+f2((b2Top+b2Bot)/2)+'" text-anchor="middle" fill="'+LC+'" font-size="'+baseFs2+'" font-weight="600" font-family="system-ui,sans-serif" dominant-baseline="middle" transform="rotate(-90,'+f2(b2DimX-7)+','+f2((b2Top+b2Bot)/2)+')">b₂='+b2+' mm</text>';

    // ── 标题栏（显示总高×总宽，以及各部件参数）──
    var cruTitle = '十 ' + Htot + ' × ' + Btot + ' mm  |  竖H ' + h1 + '×'+b1+'  tw₁='+tw1+' tf₁='+tf1+'  |  横H ' + h2 + '×'+b2+'  tw₂='+tw2+' tf₂='+tf2;
    svg += '<rect x="0" y="'+(cH-24)+'" width="'+cW+'" height="24" fill="#2c4a7c" rx="0"/>'+
           '<text x="'+f2(cW/2)+'" y="'+(cH-8)+'" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="600" font-family="system-ui,sans-serif">'+cruTitle+'</text>';

    svg += '</svg>';
    return svg;
  }
  if (t === 'HW' || t === 'HM' || t === 'HN' || t === 'HP') {
    var H_=s.H, B=s.B, tw=s.tw, tf=s.tf;
    // 留边：左右各50px给标注，上下各44px
    var scale = Math.min((W-120)/B, (H-110)/H_)*0.82;
    var sw=B*scale, sh=H_*scale, stw=Math.max(2,tw*scale), stf=Math.max(2,tf*scale);
    var ox=cx-sw/2, oy=cy-sh/2, x2=ox+sw, y2=oy+sh;
    var wx1=ox+(sw-stw)/2, wy1=oy+stf, wx2=ox+(sw+stw)/2, wy2=y2-stf;

    // tw引线：从腹板左边缘引出到左侧
    var twMidY = (wy1+wy2)/2;
    var twLeader = leader(wx1, twMidY, ox-6, twMidY, 'tw='+tw+'mm', 'end');

    // tf引线：从上翼缘中部引出到上方
    var tfMidX = ox + sw * 0.82;
    var tfTopY = oy + stf/2;
    var tfLeader = leader(tfMidX, oy, tfMidX, oy-22, 'tf='+tf+'mm', 'end');

    return SVG_HDR + PATTERN + ARROW + GRID +
      // 上翼缘（斜纹填充）
      '<rect x="'+ox+'" y="'+oy+'" width="'+sw+'" height="'+stf+'" fill="url(#sHatch)" stroke="'+wallEdge+'" stroke-width="1.8"/>'+
      // 下翼缘
      '<rect x="'+ox+'" y="'+(y2-stf)+'" width="'+sw+'" height="'+stf+'" fill="url(#sHatch)" stroke="'+wallEdge+'" stroke-width="1.8"/>'+
      // 腹板（略浅斜纹）
      '<rect x="'+wx1+'" y="'+wy1+'" width="'+(wx2-wx1)+'" height="'+(wy2-wy1)+'" fill="url(#sHatch)" stroke="'+wallEdge+'" stroke-width="1.5"/>'+
      // 中性轴线
      axisX(ox-10, x2+10) + axisY(oy-10, y2+10) +
      // 宽度标注（下方外侧）
      dimH(y2, ox, x2, 'B='+B+'mm', false) +
      // 高度标注（右侧外侧）
      dimV(x2, oy, y2, 'H='+H_+'mm', true) +
      // 腹板厚引线（左侧外）
      twLeader +
      // 翼缘厚引线（上方外）
      tfLeader +
      titleBar +
      '</svg>';
  }

  /* ── 箱型截面 ────────────────────────────────── */
  if (t === 'BOX') {
    var BH=s.H, BB=s.B, bt1=s.t1||s.t||0, bt2=s.t2||s.t||bt1||0;
    if (!BH||!BB||!bt1) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'"><rect width="'+W+'" height="'+H+'" rx="8" fill="#f4f5f9"/><text x="'+cx+'" y="'+(cy+5)+'" text-anchor="middle" fill="#656d76" font-size="13">参数不全</text></svg>';
    var scale = Math.min((W-120)/BB, (H-110)/BH)*0.78;
    var sw=BB*scale, sh=BH*scale, st1=Math.max(2,bt1*scale), st2=Math.max(2,bt2*scale);
    var ox=cx-sw/2, oy=cy-sh/2;
    var iw=sw-st1*2, ih=sh-st2*2;

    // t1竖壁引线（左侧壁厚，从外轮廓左边缘引到内腔左边缘，中点引出）
    var t1MidY = oy + sh * 0.35;
    var t1Leader = leader(ox, t1MidY, ox-8, t1MidY, 't₁='+bt1+'mm', 'end');
    // t2横壁引线（上壁厚，从外轮廓上边缘引到内腔上边缘）
    var t2MidX = ox + sw * 0.7;
    var t2Leader = leader(t2MidX, oy, t2MidX, oy-22, 't₂='+bt2+'mm', 'end');

    return SVG_HDR + PATTERN + ARROW + GRID +
      // 外轮廓
      '<rect x="'+ox+'" y="'+oy+'" width="'+sw+'" height="'+sh+'" fill="url(#sHatch)" stroke="'+wallEdge+'" stroke-width="1.8"/>'+
      // 内腔（纸色+虚线）
      '<rect x="'+(ox+st1)+'" y="'+(oy+st2)+'" width="'+iw+'" height="'+ih+'" fill="'+holeFill+'" stroke="'+dimColor+'" stroke-width="0.9" stroke-dasharray="5,3"/>'+
      axisX(ox-10, ox+sw+10) + axisY(oy-10, oy+sh+10) +
      dimH(oy+sh, ox, ox+sw, 'B='+BB+'mm', false) +
      dimV(ox+sw, oy, oy+sh, 'H='+BH+'mm', true) +
      t1Leader + t2Leader +
      titleBar +
      '</svg>';
  }

  /* ── 圆管截面 (CHS) ─────────────────────────── */
  if (t === 'CHS') {
    var D=s.D, bt=s.t||0, di=Math.max(0,(s.D||0)-2*(s.t||0));
    var r0 = Math.min(W-120, H-100) * 0.34;
    var scale = r0 / (D/2 || 1);
    var r=Math.max(2,D*scale/2), ri=Math.max(0,di*scale/2);
    // 把圆心稍微上移留出下方标注空间
    var ccx = cx, ccy = cy - 8;
    return SVG_HDR + PATTERN + ARROW + GRID +
      // 外圆（斜纹填充）
      '<circle cx="'+ccx+'" cy="'+ccy+'" r="'+r+'" fill="url(#sHatch)" stroke="'+wallEdge+'" stroke-width="1.8"/>'+
      // 内圆（纸色）
      '<circle cx="'+ccx+'" cy="'+ccy+'" r="'+ri+'" fill="'+holeFill+'" stroke="'+dimColor+'" stroke-width="1.0"/>'+
      // 水平直径线
      '<line x1="'+(ccx-r-10)+'" y1="'+ccy+'" x2="'+(ccx+r+10)+'" y2="'+ccy+'" stroke="'+axisColor+'" stroke-width="0.7" stroke-dasharray="5,3" opacity="0.5"/>'+
      // 垂直直径线
      '<line x1="'+ccx+'" y1="'+(ccy-r-10)+'" x2="'+ccx+'" y2="'+(ccy+r+10)+'" stroke="'+axisColor+'" stroke-width="0.7" stroke-dasharray="5,3" opacity="0.5"/>'+
      // 外径引线（右上方外）
      '<line x1="'+(ccx+r*0.7)+'" y1="'+(ccy-r*0.7)+'" x2="'+(ccx+r+22)+'" y2="'+(ccy-r+2)+'" stroke="'+dimColor+'" stroke-width="1.1"/>'+
      '<line x1="'+(ccx+r+22)+'" y1="'+(ccy-r+2)+'" x2="'+(ccx+r+50)+'" y2="'+(ccy-r+2)+'" stroke="'+dimColor+'" stroke-width="1.1"/>'+
      '<text x="'+(ccx+r+52)+'" y="'+(ccy-r+4)+'" fill="'+dimText+'" font-size="13" font-weight="700" font-family="system-ui,sans-serif" dominant-baseline="middle">D='+D+'mm</text>'+
      // 壁厚引线（右下方外）
      '<line x1="'+(ccx+ri)+'" y1="'+ccy+'" x2="'+(ccx+r)+'" y2="'+ccy+'" stroke="'+dimColor+'" stroke-width="1.5"/>'+
      '<line x1="'+(ccx+r)+'" y1="'+ccy+'" x2="'+(ccx+r+22)+'" y2="'+(ccy+r*0.6)+'" stroke="'+dimColor+'" stroke-width="1.0"/>'+
      '<line x1="'+(ccx+r+22)+'" y1="'+(ccy+r*0.6)+'" x2="'+(ccx+r+50)+'" y2="'+(ccy+r*0.6)+'" stroke="'+dimColor+'" stroke-width="1.0"/>'+
      '<text x="'+(ccx+r+52)+'" y="'+(ccy+r*0.6+1)+'" fill="'+dimText+'" font-size="13" font-weight="700" font-family="system-ui,sans-serif" dominant-baseline="middle">t='+bt+'mm</text>'+
      // 内径标注（圆心正下方 外）
      '<text x="'+ccx+'" y="'+(ccy+r+16)+'" text-anchor="middle" fill="'+dimText+'" font-size="12" font-weight="600" font-family="system-ui,sans-serif">di='+di+'mm</text>'+
      titleBar +
      '</svg>';
  }

  /* ── 异形截面（CUSTOM）─────────────────────────── */
  if (t === 'CUSTOM') {
    var name = s.name || s.code || '异形';
    var w    = s.w    ? s.w.toFixed(3) : '—';
    var Hh   = s.H    ? s.H + ' mm' : '—';
    return SVG_HDR + PATTERN + ARROW + GRID +
      '<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="#f4f5f9"/>'+
      // 虚线框表示异形
      '<rect x="24" y="24" width="'+(W-48)+'" height="'+(H-80)+'" rx="6" fill="none" stroke="#b0b8c8" stroke-width="1.5" stroke-dasharray="8,5"/>'+
      // 截面名称（大字）
      '<text x="'+cx+'" y="'+(cy-20)+'" text-anchor="middle" fill="#2c4a7c" font-size="16" font-weight="700" font-family="system-ui,sans-serif">'+name+'</text>'+
      // 异形说明
      '<text x="'+cx+'" y="'+(cy+6)+'" text-anchor="middle" fill="#656d76" font-size="13" font-family="system-ui,sans-serif">异形截面（用户提供参数）</text>'+
      // 线重和高度
      '<text x="'+cx+'" y="'+(cy+30)+'" text-anchor="middle" fill="#888" font-size="12" font-family="system-ui,sans-serif">w = '+w+' kg/m</text>'+
      '<text x="'+cx+'" y="'+(cy+50)+'" text-anchor="middle" fill="#888" font-size="12" font-family="system-ui,sans-serif">H = '+Hh+'</text>'+
      // 标题栏
      '<rect x="0" y="'+(H-26)+'" width="'+W+'" height="26" rx="0" fill="#e8edf5" opacity="0.9"/>'+
      '<text x="'+cx+'" y="'+(H-9)+'" text-anchor="middle" fill="#2c4a7c" font-size="12" font-weight="700" font-family="system-ui,sans-serif">'+(s.code||name)+'</text>'+
      '</svg>';
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'"><rect width="'+W+'" height="'+H+'" rx="8" fill="#f4f5f9"/><text x="'+cx+'" y="'+(cy+5)+'" text-anchor="middle" fill="#656d76" font-size="13">未知截面类型</text></svg>';
}


// 从载荷图查某半径的额定起重量（二分插值）
function getCraneCapacity(crane, radius, boomLen) {
  var charts = getCharts(crane.id);
  if (!charts || !charts.length) return null;
  var lo = 0, hi = charts.length - 1;
  var target = { boom_length: boomLen || 999, radius: radius || 999 };
  while (lo < hi - 1) {
    var m = (lo + hi) >> 1;
    var diff = (charts[m].boom_length - target.boom_length) * 1000 + (charts[m].radius - target.radius);
    if (diff <= 0) lo = m; else hi = m;
  }
  var c = charts[lo];
  if (!c) return null;
  if (c.radius <= 0 || c.rated_load <= 0) return null;
  // 线性插值（同boom_length，只差值radius）
  var sameBoom = [];
  for (var i = 0; i < charts.length; i++) {
    if (Math.abs(charts[i].boom_length - c.boom_length) < 0.5) sameBoom.push(charts[i]);
  }
  if (!sameBoom.length) return c.rated_load;
  sameBoom.sort(function(a, b){ return a.radius - b.radius; });
  var r = radius || 0;
  if (r <= sameBoom[0].radius) return sameBoom[0].rated_load || 0;
  if (r >= sameBoom[sameBoom.length-1].radius) return sameBoom[sameBoom.length-1].rated_load || 0;
  var rl = 0, rh = sameBoom.length - 1;
  while (rl < rh - 1) { var m2 = (rl + rh) >> 1; if (sameBoom[m2].radius <= r) rl = m2; else rh = m2; }
  var s = sameBoom[rl], h = sameBoom[rh];
  return (s.rated_load || 0) + ((h.rated_load||0) - (s.rated_load||0)) * (r - s.radius) / (h.radius - s.radius || 1);
}

// ================================================================
// 层高表 — 数据与函数
// ================================================================

// 层高表数据（运行时数组）
var FL_DATA = [];

// 预设层高表3：32层超高层办公楼（来源：D:\虾场\层高表3.dxf）
var FL_PRESET_3 = [
  {name:"-4F", elevation:-20.850, height:5.200, zone:"地下层"},
  {name:"-3F", elevation:-15.650, height:5.200, zone:"地下层"},
  {name:"-2F", elevation:-10.450, height:5.200, zone:"地下层"},
  {name:"-1F", elevation:-5.250,  height:5.100, zone:"地下一层"},
  {name:"1F",  elevation:0.000,   height:4.900, zone:"首层"},
  {name:"2F",  elevation:4.900,  height:4.500, zone:"标准层"},
  {name:"3F",  elevation:9.400,  height:4.500, zone:"标准层"},
  {name:"4F",  elevation:13.900, height:4.500, zone:"标准层"},
  {name:"5F",  elevation:18.400, height:4.500, zone:"标准层"},
  {name:"6F",  elevation:22.900, height:4.500, zone:"标准层"},
  {name:"7F",  elevation:27.400, height:4.500, zone:"标准层"},
  {name:"8F",  elevation:31.900, height:4.500, zone:"标准层"},
  {name:"9F",  elevation:36.400, height:4.500, zone:"标准层"},
  {name:"10F", elevation:40.900, height:4.500, zone:"标准层"},
  {name:"11F", elevation:45.400, height:4.500, zone:"避难层"},
  {name:"12F", elevation:49.900, height:4.500, zone:"标准层"},
  {name:"13F", elevation:54.400, height:4.500, zone:"标准层"},
  {name:"14F", elevation:58.900, height:4.500, zone:"标准层"},
  {name:"15F", elevation:63.400, height:4.500, zone:"标准层"},
  {name:"16F", elevation:67.900, height:4.500, zone:"标准层"},
  {name:"17F", elevation:72.400, height:4.500, zone:"标准层"},
  {name:"18F", elevation:76.900, height:4.500, zone:"标准层"},
  {name:"19F", elevation:81.400, height:4.500, zone:"标准层"},
  {name:"20F", elevation:85.900, height:4.500, zone:"标准层"},
  {name:"21F", elevation:90.400, height:4.500, zone:"标准层"},
  {name:"22F", elevation:94.900, height:4.500, zone:"标准层"},
  {name:"23F", elevation:99.400, height:4.500, zone:"避难层"},
  {name:"24F", elevation:103.900,height:4.500, zone:"标准层"},
  {name:"25F", elevation:108.400,height:4.500, zone:"标准层"},
  {name:"26F", elevation:112.900,height:4.500, zone:"标准层"},
  {name:"27F", elevation:117.400,height:4.500, zone:"标准层"},
  {name:"28F", elevation:121.900,height:4.500, zone:"标准层"},
  {name:"29F", elevation:126.400,height:4.500, zone:"标准层"},
  {name:"30F", elevation:130.900,height:4.500, zone:"标准层"},
  {name:"31F", elevation:135.400,height:4.900, zone:"顶层"},
  {name:"32F", elevation:140.300,height:6.500, zone:"顶层"},
  {name:"屋顶层",elevation:146.800,height:0,   zone:"屋面层"},
];

// zone → 显示颜色
var FL_ZONE_COLORS = {
  '地下层':  '#64748b',
  '地下一层':'#475569',
  '首层':    '#16a34a',
  '标准层':  '#2563eb',
  '避难层':  '#ea580c',
  '顶层':    '#7c3aed',
  '屋面层':  '#db2777',
  '机房层':  '#ca8a04',
};

// 从 UI 读取层高表
function flLoadFromUI() {
  var rows = document.querySelectorAll('#flTableBody tr');
  FL_DATA = [];
  for (var i = 0; i < rows.length; i++) {
    var name = (rows[i].querySelector('.fl-name') || {value: ''}).value.trim();
    var elev = parseFloat((rows[i].querySelector('.fl-elev') || {value: ''}).value) || 0;
    var h    = parseFloat((rows[i].querySelector('.fl-h')    || {value: ''}).value) || 0;
    var zone = (rows[i].querySelector('.fl-zone') || {value: ''}).value.trim();
    if (!name && h <= 0) continue;
    FL_DATA.push({ name: name, elevation: elev, height: h, zone: zone || '' });
  }
  saveFormData();
}

// 渲染层高表到 DOM（v3 — 紧凑行高 + 左侧分区边条 + 高度条加粗）
function flRenderTable() {
  var tbody = document.getElementById('flTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // 计算最大层高（用于高度条相对比例）
  var maxH = 1;
  for (var mi = 0; mi < FL_DATA.length; mi++) {
    if (FL_DATA[mi].height > maxH) maxH = FL_DATA[mi].height;
  }

  for (var i = 0; i < FL_DATA.length; i++) {
    var f = FL_DATA[i];
    var zoneColor = FL_ZONE_COLORS[f.zone] || '#94a3b8';
    var elevVal = f.elevation || 0;
    var elevBadgeCls = 'fl-elev';
    if (elevVal === 0) elevBadgeCls += ' ground';
    else if (elevVal < 0) elevBadgeCls += ' below';
    var hPct = maxH > 0 ? (f.height / maxH * 100).toFixed(1) : 0;
    var tr = document.createElement('tr');

    // 左侧分区边条（颜色条）
    var zoneBar = '<div class="fl-zone-bar" style="background:' + zoneColor + '"></div>';
    // 分区背景色块
    var zoneBg  = '<div class="fl-zone-cell-bg" style="background:' + zoneColor + '"></div>';

    tr.innerHTML =
      '<td class="fl-col-del"><button class="del-row-btn" onclick="flRemoveRow(this)">✕</button></td>' +
      '<td class="fl-col-num">' + (i + 1) + '</td>' +
      '<td class="fl-col-name">' + zoneBar + '<input type="text" class="fl-name" value="' + escHtml(f.name) + '" placeholder="楼层名" oninput="flOnRowChange(this)"></td>' +
      '<td class="fl-elev-cell"><input type="number" class="' + elevBadgeCls + '" value="' + elevVal + '" placeholder="—" step="0.01" oninput="flOnRowChangeElev(this)"></td>' +
      '<td class="fl-h-cell">' + zoneBg +
        '<div class="fl-h-bar-wrap"><div class="fl-h-bar" data-h="' + (f.height || 0) + '" style="width:' + hPct + '%"></div></div>' +
        '<input type="number" class="fl-h" value="' + (f.height || '') + '" placeholder="0" step="0.01" min="0" oninput="flOnRowChange(this)"></td>' +
      '<td class="fl-col-tag">' + zoneBg + '<input type="text" class="fl-zone" value="' + escHtml(f.zone) + '" placeholder="分区" list="flZoneList" oninput="flOnZoneChange(this)"></td>';
    tbody.appendChild(tr);
  }
  flUpdateStat();
}

// 标高自动递推（当层高变化时，后续楼层标高自动累加）
function flAutoElev(fromIdx) {
  var rows = document.querySelectorAll('#flTableBody tr');
  var curElev = fromIdx > 0
    ? (parseFloat((rows[fromIdx-1].querySelector('.fl-elev')||{value:0}).value) || 0) +
      (parseFloat((rows[fromIdx-1].querySelector('.fl-h')||{value:0}).value) || 0)
    : 0;
  for (var i = fromIdx; i < rows.length; i++) {
    var elevInp = rows[i].querySelector('.fl-elev');
    if (elevInp) {
      elevInp.value = Math.round(curElev * 100) / 100;
      // 更新标高徽章样式
      elevInp.classList.remove('ground', 'below');
      if (curElev === 0) elevInp.classList.add('ground');
      else if (curElev < 0) elevInp.classList.add('below');
    }
    curElev += parseFloat((rows[i].querySelector('.fl-h')||{value:0}).value) || 0;
  }
  flUpdateStat();
}

// 层高/楼层名变化 → 防抖400ms后一次性执行：读取+递推标高+统计+分段
function flOnRowChange(inp) {
  var row = inp.closest('tr');
  var rows = Array.prototype.slice.call(document.querySelectorAll('#flTableBody tr'));
  var idx = rows.indexOf(row);
  // 仅在用户停止输入后才执行，避免每个字符都重绘
  debounce(function() {
    flLoadFromUI();
    flAutoElev(idx);
    liftCalc();
  }, 'lc', 400);
}

// 标高手动输入 → 防抖300ms（数据已由flOnRowChange保存，只更新统计和表格）
function flOnRowChangeElev(inp) {
  debounce(function() { flUpdateStat(); liftCalc(); }, 'lc2', 300);
}

// 分区选择 → 防抖200ms后再处理
function flOnZoneChange(inp) {
  debounce(function() {
    flLoadFromUI();
    flRefreshBars(); // 更新分区边条颜色
    flUpdateStat();
    liftCalc();
  }, 'fz', 200);
}

// 更新底部统计栏（flLoadFromUI 由 caller 保证）
function flUpdateStat() {
  var n = FL_DATA.length;
  var totalH = 0;
  for (var i = 0; i < FL_DATA.length; i++) totalH += FL_DATA[i].height || 0;
  var el = document.getElementById('flStat');
  if (el) el.textContent = '共 ' + n + ' 层，总高 ' + totalH.toFixed(2) + ' m';
  flRefreshBars();
}

// 刷新高度条宽度 & 标高徽章状态 & 分区边条（当数据变化时调用）
function flRefreshBars() {
  var rows = document.querySelectorAll('#flTableBody tr');
  if (!rows.length) return;

  // 计算最大层高
  var maxH = 1;
  for (var mi = 0; mi < FL_DATA.length; mi++) {
    if ((FL_DATA[mi] || {}).height > maxH) maxH = FL_DATA[mi].height;
  }

  for (var i = 0; i < rows.length && i < FL_DATA.length; i++) {
    var row = rows[i];
    var f = FL_DATA[i];
    var zoneColor = FL_ZONE_COLORS[f.zone] || '#94a3b8';

    // ① 更新高度条
    var bar = row.querySelector('.fl-h-bar');
    if (bar) {
      var hPct = maxH > 0 ? ((f.height || 0) / maxH * 100).toFixed(1) : 0;
      bar.style.width = hPct + '%';
    }

    // ② 更新标高徽章样式
    var elevInp = row.querySelector('.fl-elev');
    if (elevInp) {
      var v = f.elevation || 0;
      elevInp.classList.remove('ground', 'below');
      if (v === 0) elevInp.classList.add('ground');
      else if (v < 0) elevInp.classList.add('below');
    }

    // ③ 更新分区边条颜色
    var zoneBar = row.querySelector('.fl-zone-bar');
    if (zoneBar) zoneBar.style.background = zoneColor;
    var zoneBg = row.querySelector('.fl-zone-cell-bg');
    if (zoneBg) zoneBg.style.background = zoneColor;
  }
}

// 加一行
function flAddRow() {
  flLoadFromUI();
  var lastH = FL_DATA.length ? FL_DATA[FL_DATA.length - 1].height : 4.5;
  FL_DATA.push({ name: '', elevation: 0, height: lastH, zone: '' });
  flRenderTable();
  // 滚动到底部
  var wrap = document.querySelector('.fl-table-wrap');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

// 删一行
function flRemoveRow(btn) {
  var rows = document.querySelectorAll('#flTableBody tr');
  if (rows.length <= 1) { toast('至少保留一行'); return; }
  var row = btn.closest('tr');
  var rowsArr = Array.prototype.slice.call(document.querySelectorAll('#flTableBody tr'));
  var idx = rowsArr.indexOf(row);
  row.remove();
  flLoadFromUI();
  // 重新编号
  var tbody = document.getElementById('flTableBody');
  var cells = tbody.querySelectorAll('.fl-col-num');
  for (var i = 0; i < cells.length; i++) cells[i].textContent = i + 1;
  flAutoElev(idx > 0 ? idx - 1 : 0);
  debounce(liftCalc, 'lc', 200);
}

// 清空
function flClearAll() {
  if (!confirm('确认清空层高表？')) return;
  FL_DATA = [{ name: '1F', elevation: 0, height: 4.5, zone: '' }];
  flRenderTable();
  debounce(liftCalc, 'lc', 200);
}

// 预设面板显示/隐藏
function flTogglePreset() {
  var panel = document.getElementById('flPresetPanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
}
// 点击外部关闭预设面板
document.addEventListener('click', function(e) {
  var panel = document.getElementById('flPresetPanel');
  if (panel && !panel.contains(e.target) && !e.target.closest('.fl-preset-wrap')) {
    panel.style.display = 'none';
  }
});

// 加载预设3（32层超高层）
function flLoadPreset3() {
  FL_DATA = FL_PRESET_3.filter(function(f){ return f.height !== '—'; }).map(function(f){
    return { name: f.name, elevation: f.elevation, height: f.height, zone: f.zone };
  });
  flRenderTable();
  debounce(liftCalc, 'lc', 300);
  document.getElementById('flPresetPanel').style.display = 'none';
}

// ── 层高表导入 ──

// 初始化导入网格（最多50行可编辑格）
function flInitImportGrid(prefillRows) {
  var tbody = document.getElementById('flImportGridBody');
  if (!tbody) return;
  var rows = prefillRows || [];
  var html = '';
  var maxRows = 50;
  for (var i = 0; i < maxRows; i++) {
    var r = rows[i] || { name: '', elev: '', h: '', zone: '' };
    var num = i + 1;
    var emptyName = !r.name && !r.elev && !r.h && !r.zone;
    html += '<tr>';
    html += '<td>' + num + '</td>';
    html += '<td class="fl-ig-name"><span class="fl-import-cell" contenteditable="true" data-empty="' + emptyName + '">' + escHtml(r.name) + '</span></td>';
    html += '<td><span class="fl-import-cell" contenteditable="true" data-empty="' + (!r.elev) + '">' + escHtml(r.elev) + '</span></td>';
    html += '<td><span class="fl-import-cell" contenteditable="true" data-empty="' + (!r.h) + '">' + escHtml(r.h) + '</span></td>';
    html += '<td><span class="fl-import-cell" contenteditable="true" data-empty="' + (!r.zone) + '">' + escHtml(r.zone) + '</span></td>';
    html += '</tr>';
  }
  tbody.innerHTML = html;
}

// 同步空占位符样式
function flSyncCellPlaceholders() {
  var cells = document.querySelectorAll('.fl-import-cell');
  cells.forEach(function(c) {
    c.setAttribute('data-empty', !c.textContent.trim() ? 'true' : 'false');
  });
}

// 显示/隐藏导入面板
function flImportCsv() {
  var area = document.getElementById('flImportArea');
  if (!area) return;
  area.style.display = area.style.display === 'none' ? 'block' : 'none';
  if (area.style.display !== 'none') {
    var prefill = FL_DATA.slice(0, 20).map(function(r) {
      return { name: r.name, elev: r.elevation || '', h: r.height || '', zone: r.zone || '' };
    });
    flInitImportGrid(prefill);
  }
}

function flCancelImport() {
  var area = document.getElementById('flImportArea');
  if (area) area.style.display = 'none';
}

function flClearGrid() {
  flInitImportGrid([]);
  toast('已清空');
}

// 从 xlsx 文件导入到网格
function flImportXlsxFile(input) {
  var file = input.files[0];
  if (!file) return;
  ensureXlsx(function() {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        var ws = wb.Sheets[wb.SheetNames[0]];
        var json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        var rows = [];
        for (var i = 0; i < json.length; i++) {
          var row = json[i];
          if (!row.length) continue;
          var name = String(row[0] || '').trim();
          if (!name && row.length < 2) continue;
          var elev = row[1] !== undefined && row[1] !== '' ? String(row[1]) : '';
          var h    = row[2] !== undefined && row[2] !== '' ? String(row[2]) : '';
          var zone = row[3] !== undefined ? String(row[3] || '').trim() : '';
          rows.push({ name: name, elev: elev, h: h, zone: zone });
          if (rows.length >= 50) break;
        }
        if (!rows.length) { toast('未识别到有效数据'); return; }
        flInitImportGrid(rows);
        toast('✓ 从 Excel 导入了 ' + rows.length + ' 行');
      } catch(err) {
        toast('解析失败：' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    input.value = '';
  });
}

// 下载 .xlsx 模版
function flDownloadTemplate() {
  ensureXlsx(function() {
    var data = [
      ['楼层名称', '标高(m)', '层高(m)', '分区'],
      ['地下1层',  '-3.500',  '3.500',   '地下层'],
      ['地下2层',  '-7.000',  '3.500',   '地下层'],
      ['1F',       '0.000',   '4.500',   '首层'],
      ['2F',       '4.500',   '3.900',   '标准层'],
      ['3F',       '8.400',   '3.900',   '标准层'],
      ['4F',       '12.300',  '3.900',   '标准层'],
      ['5F',       '16.200',  '3.900',   '标准层'],
      ['避难层',   '45.000',  '5.100',   '避难层'],
      ['顶层',     '148.800', '4.200',   '顶层'],
    ];
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '层高表模版');
    XLSX.writeFile(wb, '层高表_导入模版.xlsx');
    toast('✓ 模版已下载');
  });
}

// 全局粘贴事件：Excel 直接粘贴到网格
document.addEventListener('paste', function(e) {
  var grid = document.getElementById('flImportGrid');
  var area = grid ? document.getElementById('flImportArea') : null;
  if (!grid || !area || area.style.display === 'none') return;
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  if (!grid.contains(sel.anchorNode)) return;

  e.preventDefault();
  var text = (e.clipboardData || window.clipboardData).getData('text/plain');
  if (!text) return;

  var lines = text.split(/\r?\n/);
  var tbody = document.getElementById('flImportGridBody');
  var cells = tbody ? tbody.querySelectorAll('.fl-import-cell') : [];
  if (!cells.length) return;

  var colCount = 4;
  var pastedRows = 0;

  for (var li = 0; li < lines.length; li++) {
    var line = lines[li].trim();
    if (!line) { continue; }
    var parts = line.split(/[\t,]+/);
    for (var pi = 0; pi < Math.min(parts.length, colCount); pi++) {
      var idx = pastedRows * colCount + pi;
      if (idx >= cells.length) break;
      var val = parts[pi] ? parts[pi].trim() : '';
      cells[idx].textContent = val;
      cells[idx].setAttribute('data-empty', val ? 'false' : 'true');
    }
    pastedRows++;
    if (pastedRows * colCount >= cells.length) break;
  }
  flSyncCellPlaceholders();
  toast('✓ 粘贴 ' + Math.min(pastedRows, 50) + ' 行');
});

// 从网格读取并导入
function flDoImportFromGrid() {
  var tbody = document.getElementById('flImportGridBody');
  if (!tbody) return;
  var cells = tbody.querySelectorAll('.fl-import-cell');
  if (!cells.length) { toast('无导入数据'); return; }

  var imported = [];
  var colCount = 4;
  var rows = Math.floor(cells.length / colCount);
  var curElev = 0;

  for (var i = 0; i < rows; i++) {
    var name   = cells[i * colCount].textContent.trim();
    var elevS  = cells[i * colCount + 1].textContent.trim();
    var hS     = cells[i * colCount + 2].textContent.trim();
    var zone   = cells[i * colCount + 3].textContent.trim();
    if (!name && !elevS && !hS) continue;

    var elev = parseFloat(elevS) || 0;
    var h    = parseFloat(hS) || 0;

    if (elev > 0 && h <= 0) {
      h = elev; elev = curElev; curElev += h;
    } else if (elev > 0 && h > 0) {
      curElev = elev + h;
    } else {
      curElev += h;
      elev = curElev - h;
    }
    imported.push({
      name:     name || ('楼层' + (imported.length + 1)),
      elevation: Math.round(elev * 100) / 100,
      height:    Math.round(h * 100) / 100,
      zone:      zone || ''
    });
  }

  if (!imported.length) { toast('未能解析数据，请检查格式'); return; }
  FL_DATA = imported;
  flRenderTable();
  flUpdateStat();
  flCancelImport();
  debounce(liftCalc, 'lc', 300);
  toast('✓ 导入 ' + imported.length + ' 层');
  saveFormData();
}

// 旧 CSV 文件导入（兼容保留）
function flOnCsvFile(inp) {
  var file = inp.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result.trim();
    if (!text) return;
    var lines = text.split(/\r?\n/);
    var rows = [];
    for (var i = 0; i < lines.length && rows.length < 50; i++) {
      var parts = lines[i].split(/[\t,]+/).map(function(s){ return s.trim(); });
      if (parts.length < 2) continue;
      rows.push({ name: parts[0], elev: parts[1] || '', h: parts[2] || '', zone: parts[3] || '' });
    }
    flInitImportGrid(rows);
    var area = document.getElementById('flImportArea');
    if (area) area.style.display = 'block';
  };
  reader.readAsText(file);
  inp.value = '';
}

// datalist 供分区输入自动补全
function flInitZoneList() {
  var zones = Object.keys(FL_ZONE_COLORS);
  var datalist = document.createElement('datalist');
  datalist.id = 'flZoneList';
  zones.forEach(function(z){ var opt = document.createElement('option'); opt.value = z; datalist.appendChild(opt); });
  document.body.appendChild(datalist);
}

// 钢柱吊装 — 初始化页面
function initLiftPage() {
  // 初始化主截面输入区（始终可见）
  secMainTypeChange('HW');

  // 填充机械下拉（已有数据时）
  var sel = document.getElementById('lift-crane');
  if (!sel || !data) return;
  var opts = '<option value="">— 选择机械 —</option>';
  for (var i = 0; i < data.cranes.length; i++) {
    var c = data.cranes[i];
    if (c._user_added) continue;
    opts += '<option value="' + c.id + '">' + escHtml(c.brand) + ' ' + escHtml(c.model) + ' (' + (c.max_load_t||'?') + 't)</option>';
  }
  sel.innerHTML = opts;

  // 回填已选机型
  if (window._selectedCraneId) {
    sel.value = window._selectedCraneId;
    liftOnCraneChange();
  }

  // 层高表初始化
  flInitZoneList();
  if (!FL_DATA.length) {
    FL_DATA = [{ name: '1F', elevation: 0, height: 4.5, zone: '' }];
  }
  flRenderTable();
}

// 数据库搜索 → 联想下拉（仅显示，不主导主输入区）

// ── 分段方式自定义下拉 ──
function flSegPfToggle() {
  var wrap = document.getElementById('lift-seg-pf-wrap');
  if (!wrap) return;
  var dropdown = document.getElementById('lift-seg-pf-dropdown');
  var isOpen = dropdown && dropdown.classList.contains('open');
  // 关闭所有
  document.querySelectorAll('.fl-seg-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
  document.querySelectorAll('.fl-seg-select.open').forEach(function(s) { s.classList.remove('open'); });
  if (!isOpen) {
    dropdown.classList.add('open');
    wrap.classList.add('open');
  }
}
function flSegPfSelect(val, text) {
  var wrap = document.getElementById('lift-seg-pf-wrap');
  var dropdown = document.getElementById('lift-seg-pf-dropdown');
  var textEl = document.getElementById('lift-seg-pf-text');
  var hidden = document.getElementById('lift-seg-pf');
  if (textEl) textEl.textContent = text;
  if (hidden) hidden.value = val;
  // 更新选中态
  dropdown.querySelectorAll('.fl-seg-opt').forEach(function(o) { o.classList.remove('selected'); });
  var opt = dropdown.querySelector('[data-val="' + val + '"]');
  if (opt) opt.classList.add('selected');
  // 关闭
  dropdown.classList.remove('open');
  if (wrap) wrap.classList.remove('open');
  // 触发重新计算
  debounce(liftCalc, 'lc', 150);
  saveFormData();
}
// 点击外部关闭
document.addEventListener('click', function(e) {
  if (!e.target.closest('.fl-seg-select')) {
    document.querySelectorAll('.fl-seg-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
    document.querySelectorAll('.fl-seg-select.open').forEach(function(s) { s.classList.remove('open'); });
  }
});

// 机械切换 → 更新臂长选项 + 额定信息
function liftOnCraneChange() {
  var sel = document.getElementById('lift-crane');
  var craneId = sel ? parseInt(sel.value) : 0;
  var boomSel = document.getElementById('lift-boom-sel');
  var info = document.getElementById('liftCraneInfo');
  var rInput = document.getElementById('lift-radius');
  var radius = parseFloat((rInput||{value:'30'}).value) || 30;
  if (!craneId || !data) {
    if (info) info.style.display = 'none';
    if (boomSel) boomSel.innerHTML = '<option value="">— 自动 —</option>';
    // 清空表格中的机械列
    var tc = document.getElementById('liftTableBody');
    if (tc) {
      var rows = tc.querySelectorAll('tr');
      for (var ci = 0; ci < rows.length; ci++) {
        var cCell = rows[ci].querySelector('.crane-cell');
        var pCell = rows[ci].querySelector('[id^="lc_p"]');
        if (cCell) cCell.textContent = '—';
        if (pCell) pCell.textContent = '—';
      }
    }
    return;
  }
  var crane = _craneMap[craneId] || null;
  if (!crane) { if (info) info.style.display = 'none'; return; }
  info.style.display = '';
  document.getElementById('liftCraneModel').textContent = (crane.brand||'') + ' ' + (crane.model||'');
  document.getElementById('liftCraneRated').textContent = (crane.max_load_t||'?') + ' t';
  var cap = getCraneCapacity(crane, radius, null);
  document.getElementById('liftCraneAtR').textContent = cap ? cap.toFixed(1) + ' t' : '无数据';
  // 填充臂长选项
  var charts = getCharts(craneId);
  if (!charts || !charts.length) {
    if (boomSel) boomSel.innerHTML = '<option value="">— 无载荷表 —</option>';
    return;
  }
  var boomMap = {};
  for (var i = 0; i < charts.length; i++) {
    var bl = Math.round(charts[i].boom_length * 10) / 10;
    boomMap[bl] = true;
  }
  var booms = Object.keys(boomMap).map(Number).sort(function(a,b){return a-b;});
  if (boomSel) {
    boomSel.innerHTML = '<option value="">— 自动匹配 —</option>' +
      booms.map(function(b){ return '<option value="'+b+'">'+b+'m</option>'; }).join('');
  }
  // 只更新表格中的机械/性能列，不重建表格（保留用户输入的总吊重）
  updateLiftTableCrane();
}

// 更新表格中的机械/性能/效率列（不重建表格，保留用户输入）
function updateLiftTableCrane() {
  var craneId = parseInt((document.getElementById('lift-crane')||{value:''}).value) || 0;
  var radius  = parseFloat((document.getElementById('lift-radius')||{value:'30'}).value) || 30;
  var boomLen = parseFloat((document.getElementById('lift-boom-sel')||{value:''}).value) || 0;
  var crane = craneId && _craneMap[craneId] ? _craneMap[craneId] : null;
  var cap = crane ? getCraneCapacity(crane, radius, boomLen||null) : null;
  var tc = document.getElementById('liftTableBody');
  if (!tc) return;
  var rows = tc.querySelectorAll('tr');
  for (var i = 0; i < rows.length; i++) {
    var cCell = rows[i].querySelector('.crane-cell');
    var pCell = rows[i].querySelector('[id^="lc_p"]');
    var eCell = rows[i].querySelector('[id^="lc_e"]');
    if (cCell) cCell.textContent = crane ? escHtml((crane.brand||'') + ' ' + (crane.model||'')) : '—';
    if (pCell) pCell.textContent = cap ? cap.toFixed(1) : '—';
    // 重新算效率
    if (eCell) {
      var inp = rows[i].querySelector('.lift-w-input');
      var wt = inp ? (parseFloat(inp.value) || 0) : 0;
      if (!cap || !wt) { eCell.innerHTML = '<span class="eff-val">—</span>'; }
      else {
        var ratio = wt / cap;
        var cls = ratio > 0.90 ? 'eff-bad' : ratio > 0.75 ? 'eff-warn' : 'eff-ok';
        eCell.innerHTML = '<span class="eff-val ' + cls + '">' + (ratio * 100).toFixed(0) + '%</span>';
      }
    }
  }
  // 更新右上角额定信息
  var infoEl = document.getElementById('liftCraneAtR');
  if (infoEl) infoEl.textContent = cap ? cap.toFixed(1) + ' t' : '—';
}

// 计算分段
function liftCalc() {
  var secCode = '';
  var segPf  = parseInt((document.getElementById('lift-seg-pf')||{value:'3'}).value) || 3;
  var amp    = parseFloat((document.getElementById('lift-amp')||{value:'1.05'}).value) || 1.05;
  var rInput = document.getElementById('lift-radius');
  var radius = parseFloat((rInput||{value:'30'}).value) || 30;
  var craneId = parseInt((document.getElementById('lift-crane')||{value:''}).value) || 0;
  var boomLen = parseFloat((document.getElementById('lift-boom-sel')||{value:''}).value) || 0;

  var summaryEl = document.getElementById('liftCalcSummary');
  var tableEl = document.getElementById('liftTable');
  var emptyEl = document.getElementById('liftEmpty');
  var tbody = document.getElementById('liftTableBody');

  // 从层高表读取数据
  flLoadFromUI();
  var nFloors = FL_DATA.length;
  var colH = 0;
  for (var fi = 0; fi < FL_DATA.length; fi++) colH += FL_DATA[fi].height || 0;

  // 找截面：仅支持参数直接输入（_customSection）
  var sec = window._customSection || null;

  // 基础校验：无截面 → 友好提示，不报错
  if (!sec) {
    tableEl.style.display = 'none';
    emptyEl.style.display = '';
    return;
  }
  if (nFloors === 0 || colH <= 0) {
    summaryEl.className = 'lift-calc-summary error';
    summaryEl.innerHTML = '⚠ 请先填写层高表';
    return;
  }

  // 计算总段数 = ceil(楼层数 / 每组楼层数)
  // segPf=1: 一层一段 → n=nFloors段，每段≈colH/nFloors
  // segPf=2: 两层一段 → n=ceil(nFloors/2)段
  // segPf=3: 三层一段 → n=ceil(nFloors/3)段
  var n = Math.ceil(nFloors / segPf);
  var segLenBase = colH / nFloors * segPf; // 每段基准长度（按分组估算）

  // 校验段长限制
  if (segLenBase > 15) {
    summaryEl.className = 'lift-calc-summary error';
    summaryEl.innerHTML = '⚠ 估算段长' + segLenBase.toFixed(1) + 'm > 15m限制！请减少每组楼层数';
    return;
  }

  // 分段计算（按楼层分组）
  // segPf=1: 每段=1个楼层；segPf=2: 每段=2个楼层...
  var len = [];
  for (var si = 0; si < n; si++) {
    var floorStart = si * segPf;
    var floorEnd = Math.min(floorStart + segPf, nFloors); // 不超过总楼层
    var groupH = 0;
    for (var fi = floorStart; fi < floorEnd; fi++) {
      groupH += FL_DATA[fi] ? (FL_DATA[fi].height || 0) : 0;
    }
    if (si === 0)       len.push(groupH + 0.6);       // 首节：+0.6m
    else if (si === n-1) len.push(groupH - 0.6);      // 末节：-0.6m
    else                 len.push(groupH);               // 中间节：不变
  }

  var linearWt = secWeight(sec); // kg/m
  var crane = craneId && _craneMap[craneId] ? _craneMap[craneId] : null;

  // 汇总信息
  summaryEl.className = 'lift-calc-summary';
  var segLabel = {1:'一层一段', 2:'两层一段', 3:'三层一段'}[segPf] || segPf+'层一段';
  summaryEl.innerHTML =
    '共 <strong>' + nFloors + '</strong>层 / <strong>' + segLabel + '</strong> = <strong>' + n + '</strong>段　' +
    '　估算段长 <strong>' + segLenBase.toFixed(2) + '</strong>m　' +
    '　线重 <strong>' + linearWt.toFixed(2) + '</strong>kg/m　' +
    '　系数 <strong>' + amp.toFixed(2) + '</strong>';

  // 渲染表格
  tableEl.style.display = '';
  emptyEl.style.display = 'none';
  tbody.innerHTML = '';

  for (var j = 0; j < n; j++) {
    var segLen = Math.round(len[j] * 100) / 100;
    var selfWt = segLen * linearWt * amp; // 单段自重（t）
    var floorStart = j * segPf;
    var floorEnd = Math.min(floorStart + segPf, nFloors);
    var segFloorLabel = floorEnd - floorStart > 1
      ? '第' + (floorStart+1) + '~' + floorEnd + '段'
      : '第' + (floorStart+1) + '段';
    var row = document.createElement('tr');
    row.innerHTML =
      '<td>' + segFloorLabel + '</td>' +
      '<td>' + sec.code + '</td>' +
      '<td class="num">' + segLen.toFixed(2) + '</td>' +
      '<td class="num">' + selfWt.toFixed(3) + '</td>' +
      '<td><input type="number" class="lift-w-input" data-idx="' + j + '" value="' + selfWt.toFixed(3) + '" step="0.001" min="0" oninput="liftRecalcEff(this)"></td>' +
      '<td class="crane-cell" id="lc_c' + j + '">' + (crane ? escHtml(crane.brand) + ' ' + escHtml(crane.model) : '—') + '</td>' +
      '<td class="num">' + radius.toFixed(1) + '</td>' +
      '<td class="num" id="lc_p' + j + '">' + (crane ? (getCraneCapacity(crane, radius, boomLen||null)||'—').toFixed(1) : '—') + '</td>' +
      '<td class="num" id="lc_e' + j + '"><span class="eff-val">—</span></td>';
    tbody.appendChild(row);
  }

  // 更新机械列（只查一次 getCraneCapacity）
  if (crane) {
    var cap = getCraneCapacity(crane, radius, boomLen||null);
    for (var k = 0; k < n; k++) {
      var capEl = document.getElementById('lc_p' + k);
      if (capEl) capEl.textContent = cap ? cap.toFixed(1) : '—';
    }
  }

  // 效率在渲染时直接内联计算，不走 querySelectorAll + 循环
  for (var j2 = 0; j2 < n; j2++) {
    var inp2 = document.querySelector('.lift-w-input[data-idx="' + j2 + '"]');
    if (inp2) window.liftRecalcEff(inp2);
  }
}

// 重新计算某行效率
window.liftRecalcEff = function(inp) {
  var idx = parseInt(inp.getAttribute('data-idx'));
  var totalWt = parseFloat(inp.value) || 0;
  var capEl = document.getElementById('lc_p' + idx);
  var effEl = document.getElementById('lc_e' + idx);
  if (!capEl || !effEl) return;
  var cap = parseFloat(capEl.textContent) || 0;
  if (!cap) { effEl.innerHTML = '<span class="eff-val">—</span>'; return; }
  var ratio = totalWt / cap;
  var cls = ratio > 0.90 ? 'eff-bad' : ratio > 0.75 ? 'eff-warn' : 'eff-ok';
  effEl.innerHTML = '<span class="eff-val ' + cls + '">' + (ratio * 100).toFixed(0) + '%</span>';
};


// 导出 CSV（分段吊装表）
window.liftExportCsv = function() {
  var rows = document.querySelectorAll('#liftTable tbody tr');
  if (!rows.length) { toast('无数据可导出'); return; }
  var csv = '\uFEFF';
  csv += '分段名称，截面，段长(m)，单重(t)，总吊重(t)，吊装机械，半径(m)，性能(t)，效率\n';

  function q(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }

  for (var i = 0; i < rows.length; i++) {
    var tds = rows[i].querySelectorAll('td');
    var seg = tds[0].textContent.trim();
    var sec = tds[1].textContent.trim();
    var len = tds[2].textContent.trim();
    var wt  = tds[3].textContent.trim();
    var inp = tds[4].querySelector('input');
    var tot = inp ? inp.value.trim() : tds[4].textContent.trim();
    var crn = tds[5].textContent.trim();
    var rad = tds[6].textContent.trim();
    var cap = tds[7].textContent.trim();
    var effEl = tds[8].querySelector('.eff-val');
    var eff = effEl ? effEl.textContent.trim() : '';
    csv += q(seg) + ',' + q(sec) + ',' + q(len) + ',' + q(wt) + ',' + q(tot) + ',' + q(crn) + ',' + q(rad) + ',' + q(cap) + ',' + q(eff) + '\n';
  }
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = '钢柴分段吊装表_' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
  toast('已导出 ' + rows.length + ' 段');
};

/* ═══════════════════════════════════════════════════════════
   吊次分析模块
   ═══════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════
//  吊次分析：核心数据定义
//  两个正交维度：
//  ① 分段类型（seg_type）→ 分段系数（seg_coef）→ 总吊次
//  ② 柱类型（实腹式/垂直/倾斜）→ 效率表adj → 效率/台班（基准值已含adj）
// ══════════════════════════════════════════════════════════════════

// ── 分段列表（结构类型×构件 → 可选分段类型）────────────────
// ⚠️ 键 = comp_type（内部key，非下拉显示名）
// 框架结构/高层：柱分段【一层一段/一层两段/一层三段/两层一段/三层一段】；主梁/次梁【整根/分段/串吊】
var SEG_TYPE_LIST = {
  '框架结构': {
    '柱':   ['一层一段','一层两段','一层三段','两层一段','三层一段'],
    '主梁': ['整根吊装','分段吊装'],
    '次梁': ['整根吊装','分段吊装','串吊'],
    '钢筋桁架楼承板/压型钢板': ['整捆吊装（10块/捆）']
  },
  '高层、超高层': {
    '柱':   ['一层一段','一层两段','一层三段','两层一段','三层一段'],
    '主梁': ['整根吊装','分段吊装'],
    '次梁': ['整根吊装','分段吊装','串吊'],
    '支撑': ['整个吊装'],
    '伸臂、环桁架散件': ['整根吊装'],
    '钢筋桁架楼承板/压型钢板': ['整捆吊装（10块/捆）']
  },
  '空间网架、网壳结构': {
    // ⚠️ comp_type = '散件安装'（下拉显示"散件安装（杆件）/散件安装（檩条）/散件安装（马道）"）
    //    子构件类型（杆件/檩条/马道）由 col_type 记录；分段类型固定为"整根吊装"
    '散件安装':       ['整根吊装'],
    // ⚠️ comp_type = '分块吊装'（下拉显示"分块吊装"）
    '分块吊装':       ['整块吊装'],
    // ⚠️ comp_type = '补杆(分块吊装)'（下拉显示"补杆(分块吊装)"）
    '补杆(分块吊装)': ['整根吊装']
  },
  '空间桁架结构': {
    '地面(散件)拼装': ['整根吊装'],
    '高空(散件)拼装': ['整根吊装'],
    // ⚠️ comp_type = '分段吊装'（下拉显示"分段吊装（主桁架）/分段吊装（次桁架）"）
    //    子构件类型（主桁架/次桁架）由 col_type 记录；分段类型固定为"分段吊装"
    '分段吊装':        ['分段吊装']
  },
  '异形特殊结构': {
    '弯扭构件、大截面异型钢柱': ['整个吊装']
  },
  '支撑架': {
    '<5t/个，h<20m':  ['整个吊装'],
    '≥5t/个，h≥20m': ['整个吊装']
  }
};

// ── 分段类型 → 效率表字段键 ────────────────────────────────
// ⚠️ 键 = comp_type（内部key，非下拉显示名）
var SEG_TYPE_EFF_KEY = {
  '框架结构': {
    '柱':   {'一层一段':'垂直','一层两段':'垂直','一层三段':'垂直','两层一段':'垂直','三层一段':'垂直'},
    '主梁': {'整根吊装':'—','分段吊装':'—'},
    '次梁': {'整根吊装':'—','分段吊装':'—','串吊':'—'},
    '钢筋桁架楼承板/压型钢板': {'整捆吊装（10块/捆）':'—'}
  },
  '高层、超高层': {
    '柱':   {'一层一段':'垂直','一层两段':'垂直','一层三段':'垂直','两层一段':'垂直','三层一段':'垂直'},
    '主梁': {'整根吊装':'—','分段吊装':'—'},
    '次梁': {'整根吊装':'—','分段吊装':'—','串吊':'—'},
    '支撑': {'整个吊装':'—'},
    '伸臂、环桁架散件': {'整根吊装':'—'},
    '钢筋桁架楼承板/压型钢板': {'整捆吊装（10块/捆）':'—'}
  },
  '空间网架、网壳结构': {
    // ⚠️ seg_type 固定为"整根吊装"（由构件类型下拉的 col_type 区分杆件/檩条/马道）
    //    效率表键固定返回'—'，实际通过 row.col_type 在 diaociGetEffRow 中查表
    '散件安装':       {'整根吊装':'—'},
    '分块吊装':       {'整块吊装':'—'},
    '补杆(分块吊装)': {'整根吊装':'—'}
  },
  '空间桁架结构': {
    '地面(散件)拼装': {'整根吊装':'—'},
    '高空(散件)拼装': {'整根吊装':'—'},
    // ⚠️ seg_type 固定为"分段吊装"（由构件类型下拉的 col_type 区分主桁架/次桁架）
    //    效率表键固定返回'—'，实际通过 row.col_type 在 diaociGetEffRow 中查表
    '分段吊装':        {'分段吊装':'—'}
  },
  '异形特殊结构': {
    '弯扭构件、大截面异型钢柱': {'整个吊装':'—'}
  },
  '支撑架': {
    '<5t/个，h<20m':  {'整个吊装':'—'},
    '≥5t/个，h≥20m': {'整个吊装':'—'}
  }
};

// ── 分段系数（分段类型 → 分段系数）───────────────────────────
// ⚠️ 键 = comp_type（内部key，非下拉显示名）
// 分段系数用于计算总吊次：总吊次 = 数量 × 分段系数
// 柱：一层一段=1/一层两段=2/一层三段=3/两层一段=1/三层一段=3
// 主梁/次梁：整根吊装=1/分段吊装=2；次梁串吊=0.8
var SEG_TYPE_COEFF = {
  '框架结构': {
    '柱':   {'一层一段':1,'一层两段':2,'一层三段':3,'两层一段':1,'三层一段':3},
    '主梁': {'整根吊装':1,'分段吊装':2},
    '次梁': {'整根吊装':1,'分段吊装':2,'串吊':0.8},
    '钢筋桁架楼承板/压型钢板': {'整捆吊装（10块/捆）':1}
  },
  '高层、超高层': {
    '柱':   {'一层一段':1,'一层两段':2,'一层三段':3,'两层一段':1,'三层一段':3},
    '主梁': {'整根吊装':1,'分段吊装':2},
    '次梁': {'整根吊装':1,'分段吊装':2,'串吊':0.8},
    '支撑': {'整个吊装':1},
    '伸臂、环桁架散件': {'整根吊装':1},
    '钢筋桁架楼承板/压型钢板': {'整捆吊装（10块/捆）':1}
  },
  '空间网架、网壳结构': {
    // ⚠️ comp_type = '散件安装'
    '散件安装':        {'整根吊装':1},
    // ⚠️ comp_type = '分块吊装'
    '分块吊装':        {'整块吊装':1},
    // ⚠️ comp_type = '补杆(分块吊装)'
    '补杆(分块吊装)':  {'整根吊装':1}
  },
  '空间桁架结构': {
    '地面(散件)拼装': {'整根吊装':1},
    '高空(散件)拼装': {'整根吊装':1},
    // ⚠️ comp_type = '分段吊装'
    '分段吊装':        {'分段吊装':1}
  },
  '异形特殊结构': {
    '弯扭构件、大截面异型钢柱': {'整个吊装':1}
  },
  '支撑架': {
    '<5t/个，h<20m':  {'整个吊装':1},
    '≥5t/个，h≥20m': {'整个吊装':1}
  }
};

// ── 分段类型下拉选项生成 ────────────────────────────────────
function getSegTypeOptionsForComp(structureType, compType) {
  var stList = SEG_TYPE_LIST[structureType];
  if(!stList) return ['—'];
  var list = stList[compType];
  return list ? list.slice() : ['—'];
}

// ── 根据分段类型获取分段系数 ────────────────────────────────
function getSegCoeff(structureType, compType, segType) {
  var coeffMap = SEG_TYPE_COEFF[structureType] && SEG_TYPE_COEFF[structureType][compType];
  if(!coeffMap) return 1;
  return coeffMap[segType] !== undefined ? coeffMap[segType] : 1;
}

// ── 根据分段类型获取效率表键 ────────────────────────────────
function segTypeToEffKey(structureType, compType, segType) {
  if(!structureType || !compType || !segType) return '—';
  var stMap = SEG_TYPE_EFF_KEY[structureType];
  if(!stMap) return segType; // 直接用seg_type本身作为键
  var compMap = stMap[compType];
  if(!compMap) return segType;
  return compMap[segType] !== undefined ? compMap[segType] : '—';
}

// ── 构件类型下拉选项生成 ──────────────────────────────────
// 展开逻辑：
//  • 柱：展开为"柱（垂直）"/"柱（倾斜）"
//  • 其他构件：
//    - 多个子项（如散件安装有杆件/檩条/马道）→ "散件安装（杆件）"等
//    - 仅一个非'—'子项 → "分块吊装"（单子项直接显示，不加括号）
//    - 仅一个'—'子项 → "地面(散件)拼装"（直接显示）
// value = 内部 comp_type（如'散件安装'/'分段吊装'）
// label = 下拉显示名（如'散件安装（杆件）'）
// col_type = 效率表子键（如'杆件'/'主桁架'）
function buildCompTypeOptions(structureType) {
  // 从扁平化数组中提取某结构类型下的所有唯一构件+施工方法组合
  var compMap = {}; // comp → [{method, label, value}]
  for(var i=0; i<DIAOCI_EFF.length; i++) {
    var row = DIAOCI_EFF[i];
    if(row[DIAOCI_COLS.STYPE] !== structureType) continue;
    var comp = row[DIAOCI_COLS.COMP];
    var method = row[DIAOCI_COLS.METHOD];
    if(!compMap[comp]) compMap[comp] = [];
    compMap[comp].push(method);
  }
  var result = [];
  Object.keys(compMap).forEach(function(comp) {
    var methods = compMap[comp];
    if(methods.length === 0) return;
    var parsed = _parseEffComp(comp);
    if(methods.length === 1 && methods[0] === '—') {
      // 单一'—'方法：label 用完整 COMP（如'柱（垂直）'）
      // value 用 "base|sub" 格式（如'柱|垂直'），change 时可解析出 col_type
      result.push({ value: parsed.base + (parsed.sub ? '|' + parsed.sub : ''), label: comp, col_type: parsed.sub || '—' });
    } else {
      methods.forEach(function(method) {
        if(method === '—') {
          result.push({ value: parsed.base, label: comp, col_type: '—' });
        } else {
          result.push({ value: parsed.base + '|' + method, label: parsed.base + '（' + method + '）', col_type: method });
        }
      });
    }
  });
  return result;
}

// ── 解析构件类型显示值 → {comp_type, col_type} ────────────
// 支持格式：
//  • "柱（垂直）"/"柱（倾斜）"
//  • "散件安装（杆件）"/"散件安装（檩条）"/"散件安装（马道）"
//  • "分段吊装（主桁架）"/"分段吊装（次桁架）"
//  • 其他直接作为comp_type，col_type='—'
function parseCompSegDisp(displayVal) {
  // 匹配 "XXX（YYY）" 格式：提取XXX=comp_type，YYY=col_type
  var m = displayVal.match(/^(.+?)（(.+?)）$/);
  if(m) return { comp_type: m[1], col_type: m[2] };
  // 无括号：直接作为comp_type
  return { comp_type: displayVal, col_type: '—' };
}

// ── 解析 option value（格式："base|sub" 或直接 "base"）──────────
function parseCompValue(val) {
  // val 格式：'柱|倾斜' → {comp_type:'柱', col_type:'倾斜'}
  // val 格式：'柱'      → {comp_type:'柱', col_type:'垂直'}（默认垂直）
  // val 格式：'主梁'    → {comp_type:'主梁', col_type:'—'}
  var idx = val.indexOf('|');
  if(idx >= 0) {
    return { comp_type: val.substring(0, idx), col_type: val.substring(idx+1) };
  }
  // 无管道符：默认柱为'垂直'，其他为'—'
  return { comp_type: val, col_type: val === '柱' ? '垂直' : '—' };
}

// ── 解析构件类型值（兼容旧数据）────────────────────────────
// 旧格式："柱\x02实腹式" 或直接 "柱"
// 新格式：直接 "柱"（柱类型由col_type独立字段决定）
function parseCompSeg(val) {
  if(!val) return { comp_type: '柱', seg_type: '—' };
  if(val.indexOf('\x02') !== -1) {
    var parts = val.split('\x02');
    return { comp_type: parts[0], seg_type: parts[1] || '—' };
  }
  return { comp_type: val, seg_type: '—' };
}

// ── 根据柱类型获取效率表键（柱专用）─────────────────────────
// 对于柱，效率表键 = col_type（如'实腹式'/'垂直'/'倾斜'）
// 对于其他构件，效率表键由seg_type通过SEG_TYPE_EFF_KEY决定
function getEffKeyForRow(row) {
  if(row.comp_type === '柱') {
    // 柱：效率键 = 柱类型
    return row.col_type || '—';
  } else {
    // 非柱：效率键 = seg_type → SEG_TYPE_EFF_KEY
    return segTypeToEffKey(row.structure_type, row.comp_type, row.seg_type);
  }
}

// ── 吊装效率表数据（来源：原始Excel，2026-05-10OCR整理）──────────
// 数据结构：扁平化数组，去掉了基准效率和调整系数，直接存储Excel原始数值
// 每个记录：[结构类型, 构件类型, 施工方法,
//   汽车吊<120t, 汽车吊120~300t, 汽车吊≥300t,
//   履带吊50~130t, 履带吊150~300t, 履带吊>300常规, 履带吊>300超起,
//   塔吊<50m, 塔吊50~150m, 塔吊150~250m, 塔吊>250m]
// 数值：具体效率值，或 '/' 表示不适用，或 null 表示空白
var DIAOCI_EFF = [
  // 框架结构
  ["框架结构","柱（垂直）","—",   12, 9, 5,   13, 9, 7, 4,   16, 12, 10, 9],
  ["框架结构","柱（倾斜）","—",   9, 6.75, 3.75,  9.75, 6.75, 5.25, 3,  12, 9, 7.5, 6.75],
  ["框架结构","主梁","—",         14.4, 10.8, 6,  15.6, 10.8, 8.4, 4.8,  19.2, 14.4, 12, 10.8],
  ["框架结构","次梁","—",         21.6, 16.2, 9,  23.4, 16.2, 12.6, 7.2,  28.8, 21.6, 18, 16.2],
  ["框架结构","钢筋桁架楼承板/压型钢板","—",  30, 30, 30,  30, 30, 30, 30,  30, 30, 30, 30],
  // 高层、超高层
  ["高层、超高层","柱（垂直）","—",  12, 9, 5,   13, 9, 7, 4,   16, 12, 10, 9],
  ["高层、超高层","柱（倾斜）","—",  9, 6.75, 3.75,  9.75, 6.75, 5.25, 3,  12, 9, 7.5, 6.75],
  ["高层、超高层","主梁","—",        14.4, 10.8, 6,  15.6, 10.8, 8.4, 4.8,  19.2, 14.4, 12, 10.8],
  ["高层、超高层","次梁","—",        21.6, 16.2, 9,  23.4, 16.2, 12.6, 7.2,  28.8, 21.6, 18, 16.2],
  ["高层、超高层","支撑","—",        9, 6.75, 3.75,  9.75, 6.75, 5.25, 3,  12, 9, 7.5, 6.75],
  ["高层、超高层","伸臂、环桁架散件","—",  7.2, 5.4, 3,  7.8, 5.4, 4.2, 2.4,  9.6, 7.2, 6, 5.4],
  ["高层、超高层","钢筋桁架楼承板/压型钢板","—",  30, 30, 30,  30, 30, 30, 30,  30, 30, 30, 30],
  // 空间网架、网壳结构
  ["空间网架、网壳结构","散件安装（杆件）","—",  30, 22.5, "/",  32.5, "/", "/", "/",  40, 30, 25, "/"],
  ["空间网架、网壳结构","散件安装（檩条）","—",  42, 31.5, "/",  45.5, "/", "/", "/",  56, 42, 35, "/"],
  ["空间网架、网壳结构","散件安装（马道）","—",  3, 2.25, "/",  3.25, "/", "/", "/",  4, 3, 2.5, "/"],
  ["空间网架、网壳结构","分块吊装","—",         3, 2, 2,  2, 2, 2, 1,  3, "/", "/", "/"],
  ["空间网架、网壳结构","补杆(分块吊装)","—",   18, 13.5, 7.5,  19.5, 13.5, 10.5, 6,  24, 18, 15, "/"],
  // 空间桁架结构
  ["空间桁架结构","地面（散件）拼装","—",     24, 18, "/",  26, "/", "/", "/",  32, "/", "/", "/"],
  ["空间桁架结构","高空（散件）拼装","—",      18, 13.5, 7.5,  19.5, 13.5, 10.5, 6,  24, 18, 15, 13.5],
  ["空间桁架结构","分段吊装（主桁架）","—",    3.6, 2.7, 1.5,  3.9, 2.7, 2.1, 1.2,  4.8, 3.6, "/", "/"],
  ["空间桁架结构","分段吊装（次桁架）","—",    7.2, 5.4, 3,  7.8, 5.4, 4.2, 2.4,  9.6, 7.2, "/", "/"],
  // 异形特殊结构
  ["异形特殊结构","弯扭构件、大截面异型钢柱","—",  3.6, 2.7, 1.5,  3.9, 2.7, 2.1, 1.2,  4.8, 3.6, 3, 2.7],
  // 支撑架
  ["支撑架","＜5t/个，h＜20m","—",   9, 6.75, "/",  9.75, 6.75, "/", "/",  12, 9, 7.5, 6.75],
  ["支撑架","≥5t/个，h≥20米","—",   4.8, 3.6, "/",  5.2, 3.6, "/", "/",  6.4, 4.8, 4, 3.6],
];

// 辅助：列索引常量
var DIAOCI_COLS = {
  STYPE: 0, COMP: 1, METHOD: 2,
  TRUCK_120: 3, TRUCK_300: 4, TRUCK_ABOVE: 5,
  CRAW_130: 6, CRAW_300: 7, CRAW_REG: 8, CRAW_REG_S: 9,
  TOWER_50: 10, TOWER_150: 11, TOWER_250: 12, TOWER_ABOVE: 13
};

// 字段键名（用于编辑框 data-field）
var DIAOCI_FIELD_KEYS = [
  'stype','comp','method',
  'truck_120','truck_300','truck_above',
  'craw_130','craw_300','craw_reg','craw_reg_s',
  'tower_50','tower_150','tower_250','tower_above'
];

// 辅助：根据mtype和subkey获取列索引
function diaociColIndex(mtype, subkey) {
  var map = {
    '汽车吊': { '<120t':3, '120t(含)~300t':4, '≥300t':5 },
    '履带吊': { '50~130t':6, '150~300t':7, '>300t常规':8, '>300t超起':9 },
    '塔吊': { '50m以下':10, '50~150m':11, '150~250m':12, '>250m':13 }
  };
  return map[mtype] && map[mtype][subkey] != null ? map[mtype][subkey] : -1;
}


// ── 全局状态 ────────────────────────────────────────────────
// machines: [{type,crane_id,qty,manual_tonnage,manual_height}]
// - 汽车吊/履带吊：manual_tonnage（最大吊重/吨）替代crane_id选择
// - 塔吊：manual_height（吊机高度/米）替代tower_height选择
var _diaoci = {
  machines: [],   // [{type,crane_id,qty,manual_tonnage,manual_height}]
  rows: []        // [{structure_type,pos,comp_type,seg_type,qty,adj,diaoci,eff_d,days,total_days}]
};

// ── 工具 ──────────────────────────────────────────────────
function diaociGetCranes(type) {
  if(!window.data || !data.cranes) return [];
  return data.cranes.filter(function(c){ return c.type === type; });
}

// 扁平数组匹配辅助：提取 COMP 字段的"基准类型"和"子类型"
// "柱（垂直）" → { base:'柱', sub:'垂直' }
// "主梁"      → { base:'主梁', sub:'' }
function _parseEffComp(compField) {
  var m = compField.match(/^(.+?)（(.+?)）$/);
  if(m) return { base: m[1], sub: m[2] };
  return { base: compField, sub: '' };
}

function diaociGetEffRow(structure, comp, method) {
  // 遍历扁平化数组，匹配结构类型+构件+施工方法
  // COMP 字段格式可能是 "柱（垂直）"（含子类型）或 "主梁"（无子类型）
  for(var i=0; i<DIAOCI_EFF.length; i++) {
    var row = DIAOCI_EFF[i];
    if(row[DIAOCI_COLS.STYPE] !== structure) continue;
    var parsed = _parseEffComp(row[DIAOCI_COLS.COMP]);
    // 基准类型必须匹配
    if(parsed.base !== comp) continue;
    // METHOD 固定为 '—'，用 method（效率表子类型，如'垂直'）与 COMP 的子类型匹配
    if(row[DIAOCI_COLS.METHOD] !== '—') continue;
    if(parsed.sub) {
      // 有子类型（如'柱（垂直）'）：method 必须与子类型一致
      if(method && method === parsed.sub) return row;
    } else {
      // 无子类型（如'主梁'）：method 固定为 '—' 即可匹配
      if(!method || method === '—') return row;
    }
  }
  return null;
}

function diaociGetTowerHeightRange(craneOrMachine) {
  // 优先使用用户手动选择的高度范围（machine.tower_height）
  if(craneOrMachine && craneOrMachine.tower_height) return craneOrMachine.tower_height;
  // 根据 crane.boom_max 自动推算（塔吊臂长 ≈ 工作高度）
  var boomMax = craneOrMachine && craneOrMachine.boom_max;
  if(boomMax != null) {
    if(boomMax < 50)  return '50m以下';
    if(boomMax <= 150) return '50~150m';
    if(boomMax <= 250) return '150~250m';
    return '>250m';
  }
  return '50~150m'; // 默认
}

// 估算某台机械的效率（台班/d）
// 优先级：manual_tonnage/manual_height（手动输入） > crane_id（机械库选择） > crane.boom_max推算
function diaociGetEffForMachine(machine, rowData) {
  var crane = null;
  if(machine.crane_id != null) {
    crane = (data.cranes || []).find(function(c){ return c.id === machine.crane_id; });
  }
  var struct = rowData.structure_type;
  var comp   = rowData.comp_type;
  var method  = segTypeToEffKey(struct, comp, rowData.seg_type);
  var row = diaociGetEffRow(struct, comp, method);
  if(!row) return 0;

  if(machine.type === '塔吊') {
    var hrange = null;
    if(machine.manual_height != null && machine.manual_height > 0) {
      var h = machine.manual_height;
      if(h < 50)       hrange = '50m以下';
      else if(h <= 150) hrange = '50~150m';
      else if(h <= 250) hrange = '150~250m';
      else              hrange = '>250m';
    }
    if(!hrange && machine.tower_height) hrange = machine.tower_height;
    if(!hrange && crane) {
      var h = crane.boom_max;
      if(h < 50)       hrange = '50m以下';
      else if(h <= 150) hrange = '50~150m';
      else if(h <= 250) hrange = '150~250m';
      else              hrange = '>250m';
    }
    if(!hrange) hrange = '50~150m';
    var colIdx = diaociColIndex('塔吊', hrange);
    var v = colIdx >= 0 ? row[colIdx] : null;
    return (v === '/' || v === null) ? 0 : v;
  } else if(machine.type === '汽车吊') {
    var load = null;
    if(machine.manual_tonnage != null && machine.manual_tonnage > 0) {
      load = machine.manual_tonnage;
    } else if(crane) {
      load = crane.max_load_t || 0;
    }
    if(load === null || load <= 0) return 0;
    var colIdx;
    if(load < 120)            colIdx = diaociColIndex('汽车吊', '<120t');
    else if(load <= 300)     colIdx = diaociColIndex('汽车吊', '120t(含)~300t');
    else                      colIdx = diaociColIndex('汽车吊', '≥300t');
    var v = colIdx >= 0 ? row[colIdx] : null;
    return (v === '/' || v === null) ? 0 : v;
  } else if(machine.type === '履带吊') {
    var load = null;
    if(machine.manual_tonnage != null && machine.manual_tonnage > 0) {
      load = machine.manual_tonnage;
    } else if(crane) {
      load = crane.max_load_t || 0;
    }
    if(load === null || load <= 0) return 0;
    var colIdx;
    if(load >= 50 && load <= 130)       colIdx = diaociColIndex('履带吊', '50~130t');
    else if(load >= 150 && load <= 300) colIdx = diaociColIndex('履带吊', '150~300t');
    else if(load > 300) {
      // >300t 时根据工况选择
      if(machine.work_mode === '超起') {
        colIdx = diaociColIndex('履带吊', '>300t超起');
      } else {
        colIdx = diaociColIndex('履带吊', '>300t常规');
      }
    }
    else                                return 0;
    var v = colIdx >= 0 ? row[colIdx] : null;
    return (v === '/' || v === null) ? 0 : v;
  }
  return 0;
}

// ── 初始化 ─────────────────────────────────────────────────
function initDiaoci() {
  diaociLoadCustomEff(); // 加载本地自定义效率表覆盖内置数据
  // 默认汽车吊，manual_tonnage留空（用户手动输入吨位）
  _diaoci = { machines: [{type:'汽车吊',crane_id:null,qty:1,manual_tonnage:null,manual_height:null,tower_height:'',work_mode:''}], rows: [] };
  // 添加首行默认主行（框架结构-柱-一层一段）
  _diaoci.rows.push({structure_type:'框架结构',pos:'',comp_type:'柱',col_type:'垂直',seg_type:'一层一段',seg_coef:1,qty:0,adj:1,diaoci:0,eff_d:0,days:0,total_days:0});
  _addOtherRow(); // 追加"其他"自动计算行
  diaociRenderMachines();
  diaociRenderRows();
  diaociCalc();
  diaociRenderEffTable();
}

// ── Tab切换 ────────────────────────────────────────────────
function diaociSwitchTab(tab) {
  document.getElementById('diaoci-tab-table').classList.toggle('active', tab==='table');
  document.getElementById('diaoci-tab-eff').classList.toggle('active', tab==='eff');
  document.getElementById('diaoci-panel-table').style.display = tab==='table' ? '' : 'none';
  document.getElementById('diaoci-panel-eff').style.display  = tab==='eff'  ? '' : 'none';
  if(tab==='eff') diaociRenderEffTable();
  if(tab==='table') diaociRenderRows();
}

// ── 机械组合 ────────────────────────────────────────────────
function diaociAddMachine() {
  _diaoci.machines.push({type:'汽车吊',crane_id:null,qty:1,manual_tonnage:null,manual_height:null,tower_height:'',work_mode:''});
  diaociRenderMachines();
  diaociCalc();
}

function diaociRemoveMachine(idx) {
  if(_diaoci.machines.length <= 1) { toast('至少保留一台机械'); return; }
  _diaoci.machines.splice(idx,1);
  diaociRenderMachines();
  diaociCalc();
}

function diaociOnMachineTypeChange(idx, sel) {
  _diaoci.machines[idx].type = sel.value;
  _diaoci.machines[idx].crane_id = null;
  _diaoci.machines[idx].manual_tonnage = null;
  _diaoci.machines[idx].manual_height = null;
  _diaoci.machines[idx].tower_height = '';
  _diaoci.machines[idx].work_mode = '';
  // 重新渲染机械列表（显示/隐藏工况选择器）
  diaociRenderMachines();
  diaociCalc();
}

function diaociOnMachineCraneChange(idx, sel) {
  // 选机械库时清空手动吨位输入（互斥）
  _diaoci.machines[idx].crane_id = sel.value ? parseInt(sel.value) : null;
  if(_diaoci.machines[idx].crane_id) {
    _diaoci.machines[idx].manual_tonnage = null;
  }
  diaociCalc();
  diaociUpdateTierLabel(idx);
}

function diaociOnMachineQtyChange(idx, val) {
  _diaoci.machines[idx].qty = parseInt(val) || 1;
  diaociCalc();
}

function diaociOnMachineTowerHeight(idx, sel) {
  _diaoci.machines[idx].tower_height = sel.value;
  if(_diaoci.machines[idx].tower_height) {
    _diaoci.machines[idx].manual_height = null;
  }
  diaociCalc();
  diaociUpdateTierLabel(idx);
}

// 手动输入最大吊重（吨）—— 汽车吊/履带吊用
function diaociOnManualTonnageChange(idx, val) {
  _diaoci.machines[idx].manual_tonnage = val ? parseFloat(val) : null;
  if(_diaoci.machines[idx].manual_tonnage) {
    _diaoci.machines[idx].crane_id = null;
    // 履带吊 >300t 时重置工况选择
    if(_diaoci.machines[idx].type === '履带吊' && _diaoci.machines[idx].manual_tonnage <= 300) {
      _diaoci.machines[idx].work_mode = '';
    }
  }
  // 重新渲染机械列表（显示/隐藏工况选择器）
  diaociRenderMachines();
  diaociCalc();
  // 实时更新档位标签（轻量，不重建DOM）
  diaociUpdateTierLabel(idx);
}

// 手动输入吊机高度（米）—— 塔吊用
function diaociOnManualHeightChange(idx, val) {
  _diaoci.machines[idx].manual_height = val ? parseFloat(val) : null;
  if(_diaoci.machines[idx].manual_height) {
    _diaoci.machines[idx].tower_height = '';
  }
  diaociCalc();
  diaociUpdateTierLabel(idx);
}

// 工况选择变化 —— 履带吊 >300t 用
function diaociOnWorkModeChange(idx, sel) {
  _diaoci.machines[idx].work_mode = sel.value;
  diaociCalc();
  diaociUpdateTierLabel(idx);
}

// 动态更新匹配档位标签（不改DOM结构，只更新文字）
function diaociUpdateTierLabel(idx) {
  var tierEl = document.getElementById('diaoci-tier-'+idx);
  if(!tierEl) return;
  var m = _diaoci.machines[idx];
  if(!m) return;
  tierEl.innerHTML = diaociGetMatchedTierLabel(m);
}

// 根据当前输入状态，返回效率档位说明文字
function diaociGetMatchedTierLabel(m) {
  if(m.type === '塔吊') {
    var h = m.manual_height;
    if(h == null || h <= 0) {
      if(m.tower_height) return '档位: ' + m.tower_height;
      return '<span style="color:var(--text-muted)">请输入高度</span>';
    }
    var hrange;
    if(h < 50)        hrange = '50m以下';
    else if(h <= 150)  hrange = '50~150m';
    else if(h <= 250)  hrange = '150~250m';
    else               hrange = '>250m';
    return '匹配档位: <b style="color:var:var(--accent)">' + hrange + '</b>';
  } else {
    var t = m.manual_tonnage || (m.crane_id ? (_craneMap[m.crane_id]||{}).max_load_t : null);
    if(t == null || t <= 0) {
      return '<span style="color:var(--text-muted)">请输入吨位</span>';
    }
    // 履带吊 >300t 且未选择工况时提示
    if(m.type === '履带吊' && t > 300 && !m.work_mode) {
      return '<span style="color:var(--yellow)">⚠请选择工况</span>';
    }
    var tier;
    if(m.type === '汽车吊') {
      if(t < 120)      tier = '<120t';
      else if(t <= 300) tier = '120t(含)~300t';
      else               tier = '≥300t';
    } else { // 履带吊
      if(t >= 50 && t <= 130)        tier = '50~130t';
      else if(t >= 150 && t <= 300)  tier = '150~300t';
      else if(t > 300)               tier = (m.work_mode === '超起') ? '>300t超起' : '>300t常规';
      else                            tier = t + 't (无匹配)';
    }
    return '匹配档位: <b style="color:var(--accent)">' + tier + '</b>';
  }
}

function diaociRenderMachines() {
  var el = document.getElementById('diaoci-machines');
  if(!el) return;
  if(!_diaoci.machines.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:20px">请添加机械</div>';    
    return;
  }
  // 自动判断是否含塔吊，决定土建与钢结构使用占比是否可编辑
  var hasTower = _diaoci.machines.some(function(m){ return m.type === '塔吊'; });
  var kUtilEl = document.getElementById('diaoci-k-util');
  if(kUtilEl) {
    if(!hasTower) {
      kUtilEl.value = 1;
      kUtilEl.disabled = true;
      kUtilEl.style.opacity = '0.5';
    } else {
      kUtilEl.disabled = false;
      kUtilEl.style.opacity = '1';
    }
  }
  var TOWER_HEIGHTS = ['50m以下','50~150m','150~250m','>250m'];
  var inpStyle = 'padding:8px 10px;border:1px solid var(--border-subtle);border-radius:8px;font-size:13px;background:#fff;width:100%;text-align:center;transition:border-color 0.15s';
  var html = '';
  // 表头 - 统一6列布局：类型|参数|工况|档位|数量|删除
  html += '<div style="display:grid;grid-template-columns:90px 110px 110px 1fr 55px 32px;gap:8px;padding:0 10px 8px;font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:center;align-items:center">';
  html += '<div>类型</div><div>参数</div><div>工况</div><div>匹配档位</div><div>数量</div><div></div></div>';
  _diaoci.machines.forEach(function(m, i) {
    var cranes = diaociGetCranes(m.type);
    // 统一使用6列布局
    html += '<div class="diaoci-machine-card" style="display:grid;grid-template-columns:90px 110px 110px 1fr 55px 32px;gap:8px;align-items:center">';
    // 机械类型
    html += '<select onchange="diaociOnMachineTypeChange('+i+',this)" style="'+inpStyle+'">';
    ['汽车吊','履带吊','塔吊'].forEach(function(t){
      html += '<option value="'+t+'"'+(m.type===t?' selected':'')+'>'+t+'</option>';
    });
    html += '</select>';

    if(m.type === '塔吊') {
      // 塔吊：输入吊机高度（米）
      var hVal = m.manual_height != null ? m.manual_height : '';
      html += '<input type="number" id="diaoci-ton-'+i+'" value="'+hVal+'" placeholder="高度(m)" min="1" max="500" step="1" oninput="diaociOnManualHeightChange('+i+',this.value)" style="'+inpStyle+'">';
    } else {
      // 汽车吊/履带吊：输入最大吊重（吨）
      var tVal = m.manual_tonnage != null ? m.manual_tonnage : '';
      html += '<input type="number" id="diaoci-ton-'+i+'" value="'+tVal+'" placeholder="吊重(t)" min="1" max="2000" step="1" onchange="diaociOnManualTonnageChange('+i+',this.value)" style="'+inpStyle+'">';
    }

    // 工况列 - 履带吊>300t时显示选择器，否则显示"—"
    if(m.type === '履带吊' && m.manual_tonnage > 300) {
      var wmStyle = 'padding:7px 10px;border:1px solid var(--accent);border-radius:8px;font-size:13px;background:#fff;width:100%;color:var(--accent);font-weight:600;cursor:pointer';
      html += '<select onchange="diaociOnWorkModeChange('+i+',this)" style="'+wmStyle+'">';
      html += '<option value="">请选</option>';
      html += '<option value="常规"'+(m.work_mode==='常规'?' selected':'')+'>常规</option>';
      html += '<option value="超起"'+(m.work_mode==='超起'?' selected':'')+'>超起</option>';
      html += '</select>';
    } else {
      html += '<div style="text-align:center;color:var(--text-disabled);font-size:13px">—</div>';
    }

    // 匹配档位
    html += '<div id="diaoci-tier-'+i+'" style="font-size:12px;text-align:center;padding:0 4px;color:var(--accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + diaociGetMatchedTierLabel(m) + '</div>';

    // 数量
    html += '<input type="number" value="'+m.qty+'" min="1" onchange="diaociOnMachineQtyChange('+i+',this.value)" style="'+inpStyle+'">';
    // 删除
    html += '<button onclick="diaociRemoveMachine('+i+')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:4px;border-radius:4px;line-height:1;text-align:center;transition:all 0.15s">&#x2715;</button>';
    html += '</div>';
  });
  el.innerHTML = html;
}

// ── 表格行 ────────────────────────────────────────────────
function diaociAddRow() {
  // 参考上一行（或默认框架结构）创建新行
  var last = _diaoci.rows.filter(function(r){ return !r.is_other; }).slice(-1)[0];
  var newRow = last ? {
    structure_type: last.structure_type,
    pos: last.pos,
    comp_type: '柱',
    col_type: '垂直',
    seg_type: '一层一段',
    seg_coef: 1,
    qty: 0,
    adj: 1,
    diaoci: 0, eff_d: 0, days: 0, total_days: 0
  } : {
    structure_type:'框架结构',pos:'',comp_type:'柱',col_type:'垂直',seg_type:'一层一段',seg_coef:1,qty:0,adj:1,diaoci:0,eff_d:0,days:0,total_days:0
  };
  _diaoci.rows.push(newRow);
  // 追加"其他"自动计算行（始终在最后）
  _addOtherRow();
  diaociRenderRows();
  diaociCalc();
}

// 添加"其他"自动计算行（始终在末尾）
function _addOtherRow() {
  // 移除已有其他行
  _diaoci.rows = _diaoci.rows.filter(function(r){ return !r.is_other; });
  var mainRows = _diaoci.rows.filter(function(r){ return !r.is_other; });
  var lastMain = mainRows.slice(-1)[0];
  var sumDiaoci = mainRows.reduce(function(s,r){ return s + (r.diaoci||0); }, 0);
  var k_other = parseFloat((document.getElementById('diaoci-k-other')||{value:0.1}).value) || 0.1;
  var k_weather = parseFloat((document.getElementById('diaoci-k-weather')||{value:1.2}).value) || 1.2;
  var otherQty = sumDiaoci * k_other;
  _diaoci.rows.push({
    structure_type: lastMain ? lastMain.structure_type : '框架结构',
    pos: lastMain ? lastMain.pos : '—',
    comp_type: '其他',
    col_type: '—',
    seg_type: '整个吊装',
    seg_coef: 1,
    qty: otherQty,
    adj: 1,
    is_other: true,   // 标记为自动计算行（read-only）
    diaoci: otherQty, // 分段调整系数=1，故diaoci=qty
    eff_d: 30,
    days: otherQty > 0 ? (otherQty / 30 * k_weather) : 0,
    total_days: otherQty > 0 ? (otherQty / 30 * k_weather) : 0
  });
}

function diaociRemoveRow(idx) {
  var row = _diaoci.rows[idx];
  if(!row) return;
  if(row.is_other) { toast('其他行为自动汇总行，无法删除'); return; }
  if(!confirm('确认删除该行？')) return;
  _diaoci.rows.splice(idx,1);
  // 重建其他行
  _addOtherRow();
  diaociRenderRows();
  diaociCalc();
}

// ── 获取结构类型下可用的柱类型列表（用于col_type下拉）────────
function getAvailableColTypes(structureType) {
  var st = DIAOCI_EFF[structureType];
  if(!st || !st['柱']) return ['—'];
  return Object.keys(st['柱']).filter(function(k){ return k !== 'adj'; });
}

function diaociOnRowChange(idx, field, val) {
  var row = _diaoci.rows[idx];
  // "其他"行仅允许编辑效率字段
  if(row.is_other && field !== 'eff_d') return;
  var needFullRender = false; // 是否需要完整重建DOM

  if(field === 'structure_type') {
    // ── 全量同步：所有主行统一修改结构类型 ──────────────────
    var firstOpts = buildCompTypeOptions(val);
    var firstOpt = firstOpts[0];
    _diaoci.rows.forEach(function(r) {
      if(r.is_other) {
        r.structure_type = val;
        return;
      }
      r.structure_type = val;
      if(firstOpt) {
        var p = parseCompValue(firstOpt.value);
        r.comp_type  = p.comp_type;
        r.col_type   = p.col_type;
        var segOpts = getSegTypeOptionsForComp(val, r.comp_type);
        r.seg_type = segOpts.length > 0 ? segOpts[0] : '—';
        r.seg_coef = getSegCoeff(val, r.comp_type, r.seg_type);
        var effKey = r.comp_type === '柱' ? r.col_type : segTypeToEffKey(val, r.comp_type, r.seg_type);
        var effRec = diaociGetEffRow(val, r.comp_type, effKey);
        r.adj = (effRec && effRec.adj != null) ? effRec.adj : 1;
      }
      delete r._adjManual;
    });
    needFullRender = true;

  } else if(field === 'comp_type') {
    // 解析下拉选项值：val 格式为 '柱|倾斜' 或 '主梁'
    var parsed = parseCompValue(val);
    row.comp_type = parsed.comp_type;
    row.col_type  = parsed.col_type;
    // 重置分段类型
    var segOpts2 = getSegTypeOptionsForComp(row.structure_type, row.comp_type);
    row.seg_type = segOpts2.length > 0 ? segOpts2[0] : '—';
    row.seg_coef = getSegCoeff(row.structure_type, row.comp_type, row.seg_type);
    // 查adj
    var effKey2 = row.comp_type === '柱' ? row.col_type : segTypeToEffKey(row.structure_type, row.comp_type, row.seg_type);
    var effRec2 = diaociGetEffRow(row.structure_type, row.comp_type, effKey2);
    if(effRec2 && effRec2.adj !== undefined) {
      row.adj = effRec2.adj;
    }
    delete row._adjManual;
    needFullRender = true;

  } else if(field === 'col_type') {
    // 柱类型变化（仅柱类构件）：更新adj，seg_coef不变
    row.col_type = val;
    if(row.comp_type === '柱') {
      var effRec4 = diaociGetEffRow(row.structure_type, '柱', val);
      if(effRec4 && effRec4.adj !== undefined) {
        row.adj = effRec4.adj;
      }
    }
    delete row._adjManual;
    diaociCalc();
    diaociUpdateRowDisplay(idx); // 只更新数值，不重建DOM
    return;

  } else if(field === 'pos') {
    // 构件位置变化：标记手动编辑，后续行若未手动修改则联动跟随
    row.pos = val;
    if(val && val.trim()) {
      row._posManual = true; // 用户手动编辑了pos，不再自动跟随
    }
    // 联动后续未手动设置的行
    var prevPos = val;
    for(var _pi = idx + 1; _pi < _diaoci.rows.length; _pi++) {
      var _pr = _diaoci.rows[_pi];
      if(_pr.is_other) continue;
      if(!_pr._posManual) {
        _pr.pos = prevPos;
        diaociUpdateRowDisplay(_pi);
      }
    }
    diaociCalc();
    return;

  } else if(field === 'seg_type') {
    // 分段类型变化：更新seg_coef（用于总吊次计算），adj不变（adj由col_type决定）
    row.seg_type = val;
    row.seg_coef = getSegCoeff(row.structure_type, row.comp_type, val);
    delete row._adjManual;
    diaociCalc();
    diaociUpdateRowDisplay(idx); // 只更新数值，不重建DOM
    return;

  } else if(field === 'adj') {
    row.adj = parseFloat(val) || 1;
    row._adjManual = true; // 标记为用户手动设置
    diaociCalc();
    diaociUpdateRowDisplay(idx);
    return;

  } else if(field === 'eff_d') {
    // "其他"行效率手动编辑
    row.eff_d = parseFloat(val) || 30;
    diaociCalc();
    diaociUpdateRowDisplay(idx);
    return;

  } else if(field === 'pos') {
    // ── 全量同步：所有行（包括isOther行）统一修改构件位置 ────
    _diaoci.rows.forEach(function(r) { r.pos = val; });
    // 仅更新主行的位置格（isOther行下次重绘时自动同步）
    _updateAllPosCells(val);
    diaociCalc();
    return;
  } else if(field === 'qty') {
    row.qty = parseInt(val) || 0;
    diaociCalc();
    diaociUpdateRowDisplay(idx);
    return;
  }

  diaociCalc();
  if(needFullRender) diaociRenderRows();
}

// ── 仅更新某行的数值显示（精准局部更新，不重建DOM，保持输入焦点）─────────
function diaociUpdateRowDisplay(idx) {
  var el = document.getElementById('diaoci-rows');
  if(!el) return;
  var rows = el.querySelectorAll('tr');
  if(!rows[idx]) return;
  var row = _diaoci.rows[idx];
  var cells = rows[idx].querySelectorAll('td');
  // 列顺序：0结构类型 1构件位置 2构件类型 3分段类型 4构件数量 5分段调整系数 6吊次合计 7效率/台班 8单台机械时间 9删除
  if(cells[0]) {
    var sel = cells[0].querySelector('select');
    if(sel) sel.value = row.structure_type;
  }
  if(cells[1]) cells[1].querySelector('input').value = row.pos;
  if(cells[5]) cells[5].textContent = (row.seg_coef != null ? row.seg_coef : '—');
  if(cells[6]) cells[6].textContent = (row.diaoci > 0 ? row.diaoci : '—');
  if(cells[7]) cells[7].textContent = (row.eff_d > 0 ? row.eff_d : '—');
  if(cells[8]) cells[8].textContent = (row.days > 0 ? row.days.toFixed(1) : '—');
}

// ── 批量更新所有主行的构件位置格（不重建DOM）─────────────
function _updateAllPosCells(val) {
  var el = document.getElementById('diaoci-rows');
  if(!el) return;
  var trs = el.querySelectorAll('tr');
  _diaoci.rows.forEach(function(r, i) {
    if(r.is_other) return;
    var tr = trs[i];
    if(!tr) return;
    var cells = tr.querySelectorAll('td');
    if(cells[1]) {
      var inp = cells[1].querySelector('input');
      if(inp) inp.value = val;
    }
  });
}

function diaociRenderRows() {
  var el = document.getElementById('diaoci-rows');
  if(!el) return;
  if(!_diaoci.rows.length) {
    el.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">点击上方「+ 添加行」录入构件</td></tr>';
    return;
  }
  // 从扁平数组中提取唯一结构类型（保持顺序）
  var structureTypes = [];
  for(var i=0; i<DIAOCI_EFF.length; i++) {
    var st = DIAOCI_EFF[i][DIAOCI_COLS.STYPE];
    if(structureTypes.indexOf(st) === -1) structureTypes.push(st);
  }
  var html = '';
  _diaoci.rows.forEach(function(row, i) {
    var isOther = !!row.is_other;

    if(isOther) {
      // ── "其他"自动计算行 ─────────────────────────────────
      html += '<tr class="dc-row-other">';
      html += '<td>'+esc(row.structure_type)+'</td>';
      html += '<td>'+(row.pos ? esc(row.pos) : '—')+'</td>';
      html += '<td class="dc-comp-other">其他</td>';
      html += '<td class="dc-num">'+esc(row.seg_type)+'</td>';
      html += '<td class="dc-num dc-val">'+(row.qty>0?row.qty:'—')+'</td>';
      html += '<td class="dc-num dc-coef">'+(row.seg_coef!=null?row.seg_coef:'—')+'</td>';
      html += '<td class="dc-num dc-val dc-highlight">'+(row.diaoci>0?row.diaoci:'—')+'</td>';
      html += '<td class="dc-num"><input type="number" value="'+(row.eff_d>0?row.eff_d:30)+'" min="0" step="0.1" oninput="diaociOnRowChange('+i+',\'eff_d\',this.value)" class="dc-inline-input"></td>';
      html += '<td class="dc-num dc-days dc-highlight">'+(row.days>0?row.days.toFixed(1):'—')+'</td>';
      html += '<td></td>'; // 删除按钮列（其他行不显示按钮，保持列对齐）
      html += '</tr>';
      return;
    }

    // ── 普通主行 ────────────────────────────────────────
    var compOptions = buildCompTypeOptions(row.structure_type);
    var segOptions = getSegTypeOptionsForComp(row.structure_type, row.comp_type);

    html += '<tr>';
    // 结构类型
    html += '<td><select onchange="diaociOnRowChange('+i+',\'structure_type\',this.value)" class="dc-row-select">';
    structureTypes.forEach(function(s){
      html += '<option value="'+esc(s)+'"'+(row.structure_type===s?' selected':'')+'>'+esc(s)+'</option>';
    });
    html += '</select></td>';
    // 构件位置
    html += '<td><input type="text" value="'+esc(row.pos)+'" placeholder="如：屋面层" oninput="diaociOnRowChange('+i+',\'pos\',this.value)" class="dc-row-input"></td>';
    // 构件类型
    html += '<td><select onchange="diaociOnRowChange('+i+',\'comp_type\',this.value)" class="dc-row-select">';
    compOptions.forEach(function(opt){
      var optBase = String(opt.value).split('|')[0];
      var isColType = String(opt.value).indexOf('|') >= 0;
      var isSelected = optBase === row.comp_type && (!isColType || opt.col_type === row.col_type);
      html += '<option value="'+esc(opt.value)+'"'+(isSelected?' selected':'')+'>'+esc(opt.label)+'</option>';
    });
    html += '</select></td>';
    // 分段类型
    html += '<td><select onchange="diaociOnRowChange('+i+',\'seg_type\',this.value)" class="dc-row-select">';
    segOptions.forEach(function(opt){
      html += '<option value="'+esc(opt)+'"'+(row.seg_type===opt?' selected':'')+'>'+esc(opt)+'</option>';
    });
    html += '</select></td>';
    // 数量
    html += '<td class="dc-num"><input type="text" inputmode="numeric" value="'+row.qty+'" oninput="diaociOnRowChange('+i+',\'qty\',this.value)" class="dc-row-input dc-qty-input"></td>';
    // 分段调整系数
    html += '<td class="dc-num dc-coef">'+(row.seg_coef!=null?row.seg_coef:'—')+'</td>';
    // 吊次合计
    html += '<td class="dc-num dc-val dc-highlight">'+(row.diaoci>0?row.diaoci:'—')+'</td>';
    // 效率/台班
    html += '<td class="dc-num dc-eff dc-highlight">'+(row.eff_d>0?row.eff_d:'—')+'</td>';
    // 单台机械时间(d)
    html += '<td class="dc-num dc-days dc-highlight">'+(row.days>0?row.days.toFixed(1):'—')+'</td>';
    // 删除
    html += '<td><button onclick="diaociRemoveRow('+i+')" class="dc-del-btn" title="删除此行">×</button></td>';
    html += '</tr>';
  });
  el.innerHTML = html;
}

// ── 核心计算 ───────────────────────────────────────────────
// 两个维度完全正交：
//  ① 分段系数（seg_coef）× 数量 → 总吊次
//  ② 柱类型（col_type）或seg_type → 效率表adj → 效率/台班
function diaociCalc() {
  if(!_diaoci.rows.length) {
    document.getElementById('diaoci-total-diaoci').textContent = '0';
    document.getElementById('diaoci-total-days').textContent = '0';
    document.getElementById('diaoci-total-diaoci-day').textContent = '0';
    document.getElementById('diaoci-total-cranes').textContent = '0';
    return;
  }
  var k_weather = parseFloat((document.getElementById('diaoci-k-weather')||{value:1.2}).value) || 1.2;
  var k_util    = parseFloat((document.getElementById('diaoci-k-util')||{value:0.8}).value)    || 0.8;
  var hours     = parseFloat((document.getElementById('diaoci-hours')||{value:10}).value)     || 10;
  var k_other   = parseFloat((document.getElementById('diaoci-k-other')||{value:0.1}).value)   || 0.1;

  var totalDiaoci = 0;
  var maxDays = 0;

  // ── 主行计算 ───────────────────────────────────────────
  _diaoci.rows.forEach(function(row) {
    if(row.is_other) return; // 跳过"其他"行，下方专门处理

    // ① 总吊次 = 数量 × 分段系数
    var qty = row.qty || 0;
    var segCoeff = (row.seg_coef != null) ? row.seg_coef : 1;
    var diaoci = qty * segCoeff;
    row.diaoci = diaoci;
    totalDiaoci += diaoci;

    // ② 效率表查adj
    var effKey = getEffKeyForRow(row);
    var effRow = diaociGetEffRow(row.structure_type, row.comp_type, effKey);
    var adj = effRow ? effRow.adj : 1;
    if(row._adjManual && row.adj != null) { adj = row.adj; }
    row.adj = adj;

    var totalEff = 0;
    // 只有选择了具体机械（crane_id 非空）或手动输入了参数，才算有效机械
    var activeMachines = _diaoci.machines.filter(function(m){
      return m.qty > 0 && (m.crane_id != null || m.manual_tonnage != null || m.manual_height != null);
    });
    if(activeMachines.length === 0) { row.eff_d = 0; row.days = 0; row.total_days = 0; return; }

    var totalQty = activeMachines.reduce(function(s,m){ return s + m.qty; }, 0);
    activeMachines.forEach(function(m) {
      var eff = diaociGetEffForMachine(m, row);
      if(eff > 0) { totalEff += (m.qty / totalQty) * eff; }
    });
    row.eff_d = totalEff;

    if(totalEff > 0 && diaoci > 0) {
      // 效率按每日工作时长调整：eff_d 是基于10h的基准值
      var effAdj = totalEff * hours / 10;
      var days = diaoci / effAdj * k_weather;
      row.days = days;
      if(days > maxDays) maxDays = days;
    } else {
      row.days = 0;
    }
  });

  // ── 总时间统一计算：Σ(单台机械时间) × 土建与钢结构使用占比 / 总机械数量 ──
  var totalQty = _diaoci.machines.reduce(function(s,m){ return s + (m.qty||0); }, 0);
  var sumDays = _diaoci.rows.reduce(function(s,row){ return s + (row.days||0); }, 0);
  var totalDaysCalc = totalQty > 0 ? (sumDays * k_util / totalQty) : 0;

  // ── 先算加权总效率（用于其他行和汇总，已按工作时长调整）──
  var totalEffAll = _diaoci.rows.reduce(function(s,row){ return s + ((row.eff_d||0) * hours / 10); }, 0);

  // ── "其他"行计算（自动汇总，始终在最后）──────────────
  var otherRow = _diaoci.rows.find(function(r){ return r.is_other; });
  var mainRows = _diaoci.rows.filter(function(r){ return !r.is_other; });
  var lastMain = mainRows.length > 0 ? mainRows[mainRows.length - 1] : null;
  if(otherRow) {
    // 同步构件位置与最后一行一致
    otherRow.pos = lastMain ? (lastMain.pos || '—') : '—';
    var mainDiaociSum = mainRows.reduce(function(s,r){ return s + (r.diaoci||0); }, 0);
    var otherQty = mainDiaociSum * k_other;
    otherRow.qty = otherQty;
    otherRow.diaoci = otherQty;   // seg_coef=1
    // 其他行的效率由用户手动编辑，初始值为30，不再自动覆盖
    var otherEff = otherRow.eff_d || 30;
    // 效率按每日工作时长调整
    var otherEffAdj = otherEff * hours / 10;
    otherRow.days = otherQty > 0 && otherEffAdj > 0 ? (otherQty / otherEffAdj * k_weather) : 0;
    totalDiaoci += otherQty;
    if(otherRow.days > maxDays) maxDays = otherRow.days;
  }

  document.getElementById('diaoci-total-diaoci').textContent = Math.round(totalDiaoci);
  document.getElementById('diaoci-total-days').textContent    = totalDaysCalc > 0 ? totalDaysCalc.toFixed(1) : '—';
  document.getElementById('diaoci-total-diaoci-day').textContent = totalEffAll > 0 ? totalEffAll.toFixed(1) : '—';
  document.getElementById('diaoci-total-cranes').textContent  = totalQty;

  // 局部更新每行的数值列（避免重建DOM导致输入焦点丢失）
  // 列顺序：0结构类型 1构件位置 2构件类型 3分段类型 4构件数量 5分段调整系数 6吊次合计 7效率/台班 8单台机械时间 9删除
  var tbody = document.getElementById('diaoci-rows');
  if(tbody) {
    var trs = tbody.querySelectorAll('tr');
    _diaoci.rows.forEach(function(row, i) {
      var tr = trs[i];
      if(!tr) return;
      var tds = tr.querySelectorAll('td');
      // 索引6=吊次合计, 7=效率/台班, 8=单台机械时间
      if(tds[6]) tds[6].innerHTML = '<span style="font-weight:600;font-size:14px">'+(row.diaoci>0?row.diaoci:'—')+'</span>';
      if(tds[7]) {
        if(row.is_other) {
          // "其他"行效率列为input
          var inp = tds[7].querySelector('input');
          if(inp) inp.value = row.eff_d > 0 ? row.eff_d : 30;
        } else {
          tds[7].textContent = row.eff_d > 0 ? row.eff_d : '—';
        }
      }
      if(tds[8]) tds[8].textContent = row.days>0?row.days.toFixed(1):'—';
    });
  }
  saveFormData();
}

// ── 效率表渲染 ─────────────────────────────────────────────
function diaociRenderEffTable() {
  var filterType = (document.getElementById('diaoci-eff-filter')||{value:''}).value;
  var filterMtype = (document.getElementById('diaoci-eff-mtype')||{value:''}).value;
  var thead = document.getElementById('diaoci-eff-thead');
  var tbody = document.getElementById('diaoci-eff-tbody');
  if(!thead || !tbody) return;

  var editMode = _diaociEffEditMode;
  var showTruck = !filterMtype || filterMtype === '汽车吊';
  var showCrawl = !filterMtype || filterMtype === '履带吊';
  var showTower = !filterMtype || filterMtype === '塔吊';

  // 表头
  thead.innerHTML = '<tr>'+
    '<th style="min-width:100px">结构类型</th><th style="min-width:130px">构件类型</th>'+
    (showTruck ? '<th colspan="3" style="background:rgba(30,100,200,0.08);color:#1a56db">汽车吊</th>' : '')+
    (showCrawl ? '<th colspan="4" style="background:rgba(30,160,100,0.08);color:#166534">履带吊</th>' : '')+
    (showTower ? '<th colspan="4" style="background:rgba(160,80,30,0.08);color:#92400e">塔吊</th>' : '')+
    (editMode ? '<th style="width:36px"></th>' : '')+
    '</tr><tr class="tbl-sub-header">'+
    '<th></th><th></th>'+
    (showTruck ? '<th>&lt;120t</th><th>120(含)~300t</th><th>≥300t</th>' : '')+
    (showCrawl ? '<th>50~130t</th><th>150~300t</th><th>&gt;300t常规</th><th>&gt;300t超起</th>' : '')+
    (showTower ? '<th>&lt;50m</th><th>50~150m</th><th>150~250m</th><th>&gt;250m</th>' : '')+
    (editMode ? '<th></th>' : '')+
    '</tr>';

  var html = '';
  for(var i=0; i<DIAOCI_EFF.length; i++) {
    var row = DIAOCI_EFF[i];
    var stype = row[DIAOCI_COLS.STYPE];
    var comp = row[DIAOCI_COLS.COMP];
    var method = row[DIAOCI_COLS.METHOD];

    if(filterType && stype !== filterType) continue;

    // 筛选机械类型
    if(filterMtype === '汽车吊' && !showTruckF(row)) continue;
    if(filterMtype === '履带吊' && !hasCrawlData(row)) continue;
    if(filterMtype === '塔吊' && !hasTowerData(row)) continue;

    html += '<tr data-eff-idx="'+i+'">';
    html += '<td style="font-weight:600;font-size:14px">'+stype+'</td>';
    html += '<td>'+comp+'</td>';

    if(showTruck) {
      html += effCell(row, DIAOCI_COLS.TRUCK_120, editMode, i, 'truck_120');
      html += effCell(row, DIAOCI_COLS.TRUCK_300, editMode, i, 'truck_300');
      html += effCell(row, DIAOCI_COLS.TRUCK_ABOVE, editMode, i, 'truck_above');
    }
    if(showCrawl) {
      html += effCell(row, DIAOCI_COLS.CRAW_130, editMode, i, 'craw_130');
      html += effCell(row, DIAOCI_COLS.CRAW_300, editMode, i, 'craw_300');
      html += effCell(row, DIAOCI_COLS.CRAW_REG, editMode, i, 'craw_reg');
      html += effCell(row, DIAOCI_COLS.CRAW_REG_S, editMode, i, 'craw_reg_s');
    }
    if(showTower) {
      html += effCell(row, DIAOCI_COLS.TOWER_50, editMode, i, 'tower_50');
      html += effCell(row, DIAOCI_COLS.TOWER_150, editMode, i, 'tower_150');
      html += effCell(row, DIAOCI_COLS.TOWER_250, editMode, i, 'tower_250');
      html += effCell(row, DIAOCI_COLS.TOWER_ABOVE, editMode, i, 'tower_above');
    }
    if(editMode) {
      html += '<td><button onclick="diaociDelEffRow('+i+')" style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:16px;padding:2px 4px" title="删除">×</button></td>';
    }
    html += '</tr>';
  }

  var colCount = 2 + (showTruck?3:0) + (showCrawl?4:0) + (showTower?4:0) + (editMode?1:0);
  tbody.innerHTML = html || '<tr><td colspan="'+colCount+'" style="text-align:center;color:var(--text-muted);padding:20px">无匹配数据</td></tr>';
}

// 辅助：判断是否有汽车吊数据
function showTruckF(row) {
  return row[DIAOCI_COLS.TRUCK_120] !== '/' && row[DIAOCI_COLS.TRUCK_120] != null;
}
// 辅助：判断是否有履带吊数据
function hasCrawlData(row) {
  return row[DIAOCI_COLS.CRAW_130] !== '/' && row[DIAOCI_COLS.CRAW_130] != null;
}
// 辅助：判断是否有塔吊数据
function hasTowerData(row) {
  return row[DIAOCI_COLS.TOWER_50] !== '/' && row[DIAOCI_COLS.TOWER_50] != null;
}

// 生成单个效率单元格
function effCell(row, colIdx, editMode, rowIdx, fieldKey) {
  var v = row[colIdx];
  if(v === '/' || v === null || v === undefined) {
    // 空白或不适用
    if(!editMode) return '<td style="color:var(--text-muted);text-align:center">—</td>';
    return '<td class="eff-edit-cell"><input data-eff-idx="'+rowIdx+'" data-field="'+fieldKey+'" value="" type="text" placeholder="—" style="width:60px;padding:2px 4px;border:1px solid var(--border-standard);border-radius:3px;font-size:12px;text-align:right" title="输入数值或 / "></td>';
  } else {
    if(!editMode) return '<td style="text-align:center;font-variant-numeric:tabular-nums">'+v+'</td>';
    return '<td class="eff-edit-cell"><input data-eff-idx="'+rowIdx+'" data-field="'+fieldKey+'" value="'+v+'" type="text" style="width:60px;padding:2px 4px;border:1px solid var(--border-standard);border-radius:3px;font-size:12px;text-align:right" title="输入数值或 / "></td>';
  }
}

// ── 效率表导出 ───────────────────────────────────────────
function diaociExportEffTable() {
  var filterType = (document.getElementById('diaoci-eff-filter')||{value:''}).value;
  var filterMtype = (document.getElementById('diaoci-eff-mtype')||{value:''}).value;

  var showTruck = !filterMtype || filterMtype === '汽车吊';
  var showCrawl = !filterMtype || filterMtype === '履带吊';
  var showTower = !filterMtype || filterMtype === '塔吊';

  var cols = ['结构类型','构件类型'];
  if(showTruck) cols.push('汽车吊<120t','汽车吊120~300t','汽车吊≥300t');
  if(showCrawl) cols.push('履带吊50~130t','履带吊150~300t','履带吊>300常规','履带吊>300超起');
  if(showTower) cols.push('塔吊<50m','塔吊50~150m','塔吊150~250m','塔吊>250m');

  var bom = '\uFEFF';
  var lines = [];
  lines.push(cols.map(function(c){ return '"' + c.replace(/"/g,'""') + '"'; }).join(','));

  for(var i=0; i<DIAOCI_EFF.length; i++) {
    var row = DIAOCI_EFF[i];
    if(filterType && row[DIAOCI_COLS.STYPE] !== filterType) continue;
    var r = [row[DIAOCI_COLS.STYPE], row[DIAOCI_COLS.COMP]];
    if(showTruck) { r.push(val2csv(row[DIAOCI_COLS.TRUCK_120])); r.push(val2csv(row[DIAOCI_COLS.TRUCK_300])); r.push(val2csv(row[DIAOCI_COLS.TRUCK_ABOVE])); }
    if(showCrawl) { r.push(val2csv(row[DIAOCI_COLS.CRAW_130])); r.push(val2csv(row[DIAOCI_COLS.CRAW_300])); r.push(val2csv(row[DIAOCI_COLS.CRAW_REG])); r.push(val2csv(row[DIAOCI_COLS.CRAW_REG_S])); }
    if(showTower) { r.push(val2csv(row[DIAOCI_COLS.TOWER_50])); r.push(val2csv(row[DIAOCI_COLS.TOWER_150])); r.push(val2csv(row[DIAOCI_COLS.TOWER_250])); r.push(val2csv(row[DIAOCI_COLS.TOWER_ABOVE])); }
    lines.push(r.map(function(c){ return '"' + String(c).replace(/"/g,'""') + '"'; }).join(','));
  }

  function val2csv(v) { return (v === '/' || v == null) ? '' : v; }

  var csv = bom + lines.join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '吊装效率表_'+(filterType||'全部')+'.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('已导出效率表 CSV');
}

/* ── 效率表编辑模式 ──────────────────────────────────────── */
var _diaociEffEditMode = false;
var DIAOCI_EFF_LS_KEY = 'diaoci_eff_custom_v2'; // 新版本key，兼容旧数据

// 从localStorage读取自定义效率表，有则覆盖内置数据
function diaociLoadCustomEff() {
  try {
    var raw = localStorage.getItem(DIAOCI_EFF_LS_KEY);
    if(raw) {
      var custom = JSON.parse(raw);
      if(Array.isArray(custom)) {
        // 新版扁平数组格式：直接替换
        DIAOCI_EFF = custom;
      }
    }
  } catch(e) { console.warn('[diaociLoadCustomEff]', e); }
}

function diaociToggleEffEdit() {
  _diaociEffEditMode = !_diaociEffEditMode;
  var editBtn = document.getElementById('diaoci-eff-edit-btn');
  var addBtn  = document.getElementById('diaoci-eff-add-btn');
  var saveBtn = document.getElementById('diaoci-eff-save-btn');
  var resetBtn= document.getElementById('diaoci-eff-reset-btn');
  if(editBtn) editBtn.textContent = _diaociEffEditMode ? '👁 预览' : '✏️ 编辑';
  if(addBtn)  addBtn.style.display  = _diaociEffEditMode ? '' : 'none';
  if(saveBtn) saveBtn.style.display = _diaociEffEditMode ? '' : 'none';
  if(resetBtn)resetBtn.style.display= _diaociEffEditMode ? '' : 'none';
  diaociRenderEffTable();
}

// 弹出新增行对话框
function diaociAddEffRow() {
  var stype = prompt('请输入结构类型（如：框架结构 / 高层、超高层 / 空间桁架结构 等）：', '框架结构');
  if(!stype || !stype.trim()) return;
  var comp = prompt('请输入构件类型（如：柱 / 主梁 / 散件安装 等）：', '');
  if(!comp || !comp.trim()) return;
  var method = prompt('请输入施工方法（如：— / 杆件 / 主桁架 等）：', '—');
  if(method == null) method = '—';

  var newRow = [stype.trim(), comp.trim(), method.trim()];
  for(var i=3; i<14; i++) newRow.push(null); // 12个效率列默认null
  DIAOCI_EFF.push(newRow);
  diaociRenderEffTable();
  toast('已新增行：' + stype + ' > ' + comp + (method!=='—'?'（'+method+'）':''));
}

// 保存编辑后的效率表到localStorage
function diaociSaveEffEdit() {
  // 读取所有input的值并写回DIAOCI_EFF数组
  var inputs = document.querySelectorAll('#diaoci-eff-tbody input[data-eff-idx][data-field]');
  inputs.forEach(function(inp) {
    var idx = parseInt(inp.getAttribute('data-eff-idx'));
    var field = inp.getAttribute('data-field');
    var colIdx = DIAOCI_FIELD_KEYS.indexOf(field);
    if(colIdx < 0 || idx < 0 || idx >= DIAOCI_EFF.length) return;
    var v = inp.value.trim();
    if(v === '' || v === '—') {
      DIAOCI_EFF[idx][colIdx] = null;
    } else if(v === '/') {
      DIAOCI_EFF[idx][colIdx] = '/';
    } else {
      var n = parseFloat(v);
      DIAOCI_EFF[idx][colIdx] = isNaN(n) ? null : n;
    }
  });
  try {
    localStorage.setItem(DIAOCI_EFF_LS_KEY, JSON.stringify(DIAOCI_EFF));
    toast('✓ 效率表已保存');
  } catch(e) { toast('保存失败：' + e.message); }
  _diaociEffEditMode = false;
  diaociToggleEffEdit();
}

// ── 页面加载时恢复表单数据 ─────────────────────────────────
window.onload = function() {
  restoreFormData();
};

function diaociResetEff() {
  if(!confirm('确认重置效率表？自定义修改将丢失。')) return;
  localStorage.removeItem(DIAOCI_EFF_LS_KEY);
  location.reload();
}

// 删除指定索引的行
function diaociDelEffRow(idx) {
  if(!confirm('确认删除该行？')) return;
  DIAOCI_EFF.splice(idx, 1);
  diaociRenderEffTable();
  toast('已删除');
}


/* ════════════════════════════════════════════════════
   吊次分析 — 导出计算表（打印模板）
═══════════════════════════════════════════════════ */
function diaociExportTable() {
  var k_weather = parseFloat((document.getElementById('diaoci-k-weather')||{value:1.2}).value) || 1.2;
  var k_util    = parseFloat((document.getElementById('diaoci-k-util')||{value:0.8}).value)    || 0.8;
  var hours     = parseFloat((document.getElementById('diaoci-hours')||{value:10}).value)     || 10;
  var k_other   = parseFloat((document.getElementById('diaoci-k-other')||{value:0.1}).value)   || 0.1;

  // 机械组合描述
  var machDesc = _diaoci.machines.map(function(m) {
    var craneText = '';
    if(m.crane_id != null) {
      var found = (typeof CRANE_DATA !== 'undefined' ? CRANE_DATA.cranes || [] : []).find(function(c){ return c.id === m.crane_id; });
      if(found) craneText = ' (' + (found.brand||'') + ' ' + found.model + ')';
    }
    var heightText = m.type === '塔吊' && m.tower_height ? ' [' + m.tower_height + ']' : '';
    return m.qty + '台 ' + m.type + craneText + heightText;
  }).join(' + ');

  var totalDiaoci = parseInt(document.getElementById('diaoci-total-diaoci').textContent) || 0;
  var totalDays   = document.getElementById('diaoci-total-days').textContent;
  var totalEffDay = document.getElementById('diaoci-total-diaoci-day').textContent;
  var totalCranes = document.getElementById('diaoci-total-cranes').textContent;

  // 行数据
  var rowsHTML = '';
  _diaoci.rows.forEach(function(row, i) {
    rowsHTML += '<tr>' +
      '<td style="text-align:center">' + (i+1) + '</td>' +
      '<td>' + esc(row.structure_type) + '</td>' +
      '<td>' + esc(row.pos || '—') + '</td>' +
      '<td>' + esc(row.comp_type) + '</td>' +
      '<td>' + esc(row.seg_type === '—' ? '—' : row.seg_type) + '</td>' +
      '<td style="text-align:right">' + (row.qty || 0) + '</td>' +
      '<td style="text-align:right">' + (row.seg_coef != null ? row.seg_coef : '—') + '</td>' +
      '<td style="text-align:right;font-weight:600">' + (row.diaoci > 0 ? Math.round(row.diaoci) : '—') + '</td>' +
      '<td style="text-align:right">' + (row.eff_d > 0 ? row.eff_d.toFixed(1) : '—') + '</td>' +
      '<td style="text-align:right">' + (row.days > 0 ? row.days.toFixed(1) : '—') + '</td>' +
      '</tr>';
  });

  var now = new Date();
  var dateStr = now.getFullYear() + '年' + (now.getMonth()+1) + '月' + now.getDate() + '日';

  var html = '<!DOCTYPE html><html lang="zh"><head>' +
    '<meta charset="UTF-8">' +
    '<title>吊次分析计算表</title>' +
    '<style>' +
    '  * { box-sizing: border-box; margin: 0; padding: 0; }' +
    '  body { font-family: "Microsoft YaHei", "SimSun", Arial, sans-serif; font-size: 13px; color: #222; background: #fff; padding: 20px; }' +
    '  .report-header { text-align: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #1a5fb4; }' +
    '  .report-header h1 { font-size: 22px; font-weight: 700; color: #1a5fb4; margin-bottom: 6px; letter-spacing: 1px; }' +
    '  .report-header p { color: #666; font-size: 12px; }' +
    '  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; background: #f5f8ff; border: 1px solid #d0ddf5; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px; }' +
    '  .info-item { display: flex; align-items: baseline; gap: 6px; }' +
    '  .info-label { font-size: 12px; color: #555; white-space: nowrap; min-width: 100px; }' +
    '  .info-value { font-size: 13px; font-weight: 600; color: #222; }' +
    '  .section-title { font-size: 15px; font-weight: 700; color: #1a5fb4; margin: 20px 0 10px; padding-left: 8px; border-left: 4px solid #1a5fb4; }' +
    '  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }' +
    '  th { background: #1a5fb4; color: #fff; padding: 9px 8px; font-size: 12px; font-weight: 600; text-align: center; border: 1px solid #145099; white-space: nowrap; }' +
    '  td { padding: 8px 8px; font-size: 13px; border: 1px solid #d8e0ed; vertical-align: middle; }' +
    '  tr:nth-child(even) td { background: #f5f8ff; }' +
    '  tr:last-child td { font-weight: 600; }' +
    '  .summary-table td { font-size: 14px; padding: 10px 14px; }' +
    '  .summary-table .val { font-size: 20px; font-weight: 700; color: #1a5fb4; text-align: center; }' +
    '  .summary-table .lbl { font-size: 12px; color: #666; text-align: center; }' +
    '  .note-box { background: #fffbea; border: 1px solid #f0c040; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #555; line-height: 1.8; margin-bottom: 20px; }' +
    '  .formula-box { background: #f0f5ff; border: 1px solid #c0cdf5; border-radius: 6px; padding: 12px 16px; font-size: 12px; color: #333; line-height: 2.0; margin-bottom: 20px; }' +
    '  .footer { text-align: center; color: #999; font-size: 11px; margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; }' +
    '  @media print {' +
    '    body { padding: 10px; font-size: 12px; }' +
    '    .no-print { display: none; }' +
    '    table { page-break-inside: avoid; }' +
    '  }' +
    '</style>' +
    '</head><body>' +

    '<div class="no-print" style="margin-bottom:16px;display:flex;gap:10px">' +
    '  <button onclick="window.print()" style="padding:8px 20px;background:#1a5fb4;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-family:inherit">🖨️ 打印 / 另存为PDF</button>' +
    '  <button onclick="window.close()" style="padding:8px 16px;background:#f0f0f0;color:#333;border:1px solid #ccc;border-radius:6px;font-size:14px;cursor:pointer;font-family:inherit">✕ 关闭</button>' +
    '</div>' +

    '<div class="report-header">' +
    '  <h1>起重吊装 · 吊次分析计算表</h1>' +
    '  <p>编制日期：' + dateStr + '　　机械选型系统自动生成</p>' +
    '</div>' +

    '<div class="section-title">一、基本参数</div>' +
    '<div class="info-grid">' +
    '  <div class="info-item"><span class="info-label">机械组合：</span><span class="info-value">' + esc(machDesc || '—') + '</span></div>' +
    '  <div class="info-item"><span class="info-label">每日工作时长：</span><span class="info-value">' + hours + ' h</span></div>' +
    '  <div class="info-item"><span class="info-label">天气/工序系数：</span><span class="info-value">' + k_weather + '</span></div>' +
    '  <div class="info-item"><span class="info-label">土建与钢结构使用占比：</span><span class="info-value">' + k_util + '</span></div>' +
    '  <div class="info-item"><span class="info-label">其他吊装占比：</span><span class="info-value">' + k_other + '</span></div>' +
    '  <div class="info-item"><span class="info-label">机械数量合计：</span><span class="info-value">' + totalCranes + ' 台</span></div>' +
    '</div>' +

    '<div class="formula-box">' +
    '  <b>计算公式：</b><br>' +
    '  吊次合计 = 构件数量 × 分段调整系数<br>' +
    '  日有效吊次 = 效率(次/台班) × (工作时长/10h) × 土建与钢结构使用占比<br>' +
    '  构件工期 = 吊次合计 ÷ (日有效吊次 × 机械数量) × 天气/工序系数<br>' +
    '  其他行吊次 = 主行吊次合计 × 其他吊装占比' +
    '</div>' +

    '<div class="section-title">二、构件吊次明细</div>' +
    '<div style="overflow-x:auto">' +
    '<table>' +
    '<thead><tr>' +
    '<th style="width:40px">序号</th>' +
    '<th>结构类型</th>' +
    '<th>构件位置</th>' +
    '<th>构件类型</th>' +
    '<th>施工方法</th>' +
    '<th style="width:70px">构件<br>数量</th>' +
    '<th style="width:80px">分段<br>调整系数</th>' +
    '<th style="width:80px">吊次<br>合计</th>' +
    '<th style="width:90px">效率<br>(次/台班)</th>' +
    '<th style="width:90px">单台机械<br>时间(d)</th>' +
    '</tr></thead>' +
    '<tbody>' + rowsHTML + '</tbody>' +
    '</table>' +
    '</div>' +

    '<div class="section-title">三、汇总结果</div>' +
    '<table class="summary-table" style="max-width:600px">' +
    '<thead><tr><th>指标</th><th>数值</th><th>说明</th></tr></thead>' +
    '<tbody>' +
    '<tr><td>总吊次</td><td class="val">' + totalDiaoci + '</td><td>所有构件调整后吊次之和</td></tr>' +
    '<tr><td>综合日吊次</td><td class="val">' + totalEffDay + '</td><td>加权平均效率（次/台班）</td></tr>' +
    '<tr><td>机械数量</td><td class="val">' + totalCranes + ' 台</td><td>参与计算的机械总台数</td></tr>' +
    '<tr style="background:#e8f0fe"><td><b>预计总工期</b></td><td class="val" style="color:#c0392b;font-size:24px">' + totalDays + ' d</td><td>Σ(单台机械时间) × 土建与钢结构使用占比 / 总机械数量</td></tr>' +
    '</tbody></table>' +

    '<div class="note-box">' +
    '  <b>⚠ 注意事项：</b><br>' +
    '  ① 本表效率值来源于吊装效率基准表，已含调整系数（含辅助时间）；<br>' +
    '  ② 实际工期受场地条件、天气、交叉作业等影响，建议留15~20%余量；<br>' +
    '  ③ 其他吊装（气瓶吊笼、焊机等）吊次由"其他吊装占比"独立参数控制；<br>' +
    '  ④ 土建与钢结构使用占比：汽车吊/履带吊默认1（独立使用），塔吊需根据现场情况设置（如8:2取0.8、7:3取0.7）；<br>' +
    '  ⑤ 多机械组合取加权平均效率，若机械效率差异较大请分别计算后取控制工期。' +
    '</div>' +

    '<div class="footer">本表由起重机械智能选型系统自动生成 · ' + dateStr + '</div>' +
    '</body></html>';

  var win = window.open('', '_blank', 'width=1100,height=800,scrollbars=yes');
  if(!win) { toast('请允许弹出窗口以导出表格'); return; }
  win.document.write(html);
  win.document.close();
}

// ══════════════════════════════════════════════════════════════
//  截面选择器（截面库模态窗口）
// ══════════════════════════════════════════════════════════════
var _spFilter = 'ALL';       // 当前类型过滤：ALL | HW,HM,HN,HP | BOX | CHS | CRU
var _spSearch = '';         // 当前搜索词
var _spSelectedCode = null; // 当前选中截面 code

// 打开选择器
window.openSectionPicker = function() {
  _spFilter = 'ALL';
  _spSearch = '';
  _spSelectedCode = null;
  var overlay = document.getElementById('secPickerOverlay');
  if (!overlay) return;
  // 重置搜索框
  var si = document.getElementById('spSearchInput');
  if (si) si.value = '';
  // 重置过滤按钮
  document.querySelectorAll('.sp-filter-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.type === 'ALL');
  });
  // 重置确认按钮
  var cb = document.getElementById('spConfirmBtn');
  if (cb) cb.disabled = true;
  var hint = document.getElementById('spHint');
  if (hint) hint.textContent = '请从上方列表中选择一个截面';
  // 渲染网格
  spRenderGrid();
  // 显示
  overlay.style.display = 'flex';
  // 关闭按钮获焦
  setTimeout(function() { si && si.focus(); }, 100);
};

// 关闭选择器
window.closeSectionPicker = function() {
  var overlay = document.getElementById('secPickerOverlay');
  if (overlay) overlay.style.display = 'none';
};

// 搜索处理
window.spOnSearch = function() {
  var si = document.getElementById('spSearchInput');
  _spSearch = si ? si.value.trim().toLowerCase() : '';
  spRenderGrid();
};

// 设置类型过滤
window.spSetFilter = function(type) {
  _spFilter = type;
  document.querySelectorAll('.sp-filter-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.type === type);
  });
  spRenderGrid();
};

// 渲染截面卡片网格
function spRenderGrid() {
  var grid = document.getElementById('spGrid');
  if (!grid) return;

  var types = _spFilter === 'ALL' ? null : _spFilter.split(',');
  var keyword = _spSearch;

  var filtered = SECTION_DB.filter(function(sec) {
    if (types && types.indexOf(sec.type) === -1) return false;
    if (keyword) {
      var code = (sec.code || '').toLowerCase();
      // 解析 H400×200 格式中的数字用于搜索
      var dims = [];
      if (sec.H) dims.push(sec.H);
      if (sec.B) dims.push(sec.B);
      if (sec.D) dims.push(sec.D);
      var dimsStr = dims.join(' ').toLowerCase();
      if (code.indexOf(keyword) === -1 && dimsStr.indexOf(keyword) === -1) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="sp-empty">未找到匹配的截面<br><span style="font-size:12px;opacity:0.6">试试搜索 "HN400" 或 "400×200"</span></div>';
    return;
  }

  grid.innerHTML = filtered.map(function(sec) {
    return spCardHTML(sec);
  }).join('');
}

// 单个卡片 HTML
function spCardHTML(sec) {
  var code = sec.code || '';
  var type = sec.type || '';
  var badgeCls = type === 'BOX' ? 'sp-badge-box' : type === 'CHS' ? 'sp-badge-chs' : type === 'CRU' ? 'sp-badge-cru' : 'sp-badge-h';
  var typeLabel = {HW:'H',HM:'H',HN:'H',HP:'H',BOX:'□',CHS:'Ø',CRU:'+'}[type] || type;

  // 维度行文字
  var dims = spGetDimsText(sec);
  // 截面积
  var A = secArea(sec);
  var areaStr = A > 0 ? (A >= 1000 ? (A/1000).toFixed(1)+' ×10³ mm²' : A.toFixed(0)+' mm²') : '';

  var selClass = _spSelectedCode === code ? ' selected' : '';
  return '<div class="sp-card' + selClass + '" onclick="spSelectCard(\'' + code.replace(/'/g, "\\'") + '\')">' +
    '<div class="sp-card-top">' +
      '<span class="sp-badge ' + badgeCls + '">' + typeLabel + '</span>' +
      '<span class="sp-code">' + code + '</span>' +
    '</div>' +
    '<div class="sp-dims">' + dims + '</div>' +
    (areaStr ? '<div class="sp-area">A = ' + areaStr + '</div>' : '') +
  '</div>';
}

// 获取维度描述文字
function spGetDimsText(sec) {
  var t = sec.type;
  if (t === 'HW' || t === 'HM' || t === 'HN' || t === 'HP') {
    return '<strong>H</strong>=' + sec.H + ' <strong>B</strong>=' + sec.B + ' tw=' + sec.tw + ' tf=' + sec.tf;
  }
  if (t === 'BOX') {
    var t1v = sec.t1 || sec.t || 0;
    return '<strong>H</strong>=' + sec.H + ' <strong>B</strong>=' + sec.B + ' t=' + t1v;
  }
  if (t === 'CHS') {
    return '<strong>D</strong>=' + sec.D + ' t=' + sec.t;
  }
  if (t === 'CRU') {
    var Htot = Math.max(sec.h1 || 0, sec.b2 || 0);
    var Btot = Math.max(sec.h2 || 0, sec.b1 || 0);
    return '<strong>H</strong>=' + Htot + ' <strong>B</strong>=' + Btot + ' (竖' + sec.h1 + '×' + sec.b1 + ' + 横' + sec.h2 + '×' + sec.b2 + ')';
  }
  return '';
}

// 选中卡片
window.spSelectCard = function(code) {
  _spSelectedCode = code;
  // 更新选中状态（移除旧的，加上新的）
  document.querySelectorAll('.sp-card').forEach(function(c) {
    c.classList.remove('selected');
  });
  var cards = document.querySelectorAll('.sp-card');
  for (var i = 0; i < cards.length; i++) {
    var spCode = cards[i].querySelector('.sp-code');
    if (spCode && spCode.textContent === code) {
      cards[i].classList.add('selected');
      // 自动滚动到可视区
      if (cards[i].scrollIntoViewIfNeeded) {
        cards[i].scrollIntoViewIfNeeded({ behavior: 'smooth', block: 'nearest' });
      }
      break;
    }
  }
  // 更新提示
  var sec = null;
  for (var j = 0; j < SECTION_DB.length; j++) {
    if (SECTION_DB[j].code === code) { sec = SECTION_DB[j]; break; }
  }
  var hint = document.getElementById('spHint');
  if (hint) {
    hint.textContent = sec ? '已选择：' + code + '（' + spGetDimsText(sec) + '）' : '请从上方列表中选择一个截面';
  }
  // 启用确认按钮
  var cb = document.getElementById('spConfirmBtn');
  if (cb) cb.disabled = !code;
};

// 确认选用
window.spConfirm = function() {
  if (!_spSelectedCode) return;
  var sec = SECTION_DB.find(function(s) { return s.code === _spSelectedCode; });
  if (!sec) return;

  var type = sec.type;
  // 设置下拉类型
  var typeSel = document.getElementById('sec-main-type');
  if (typeSel) {
    // 特殊处理：HN/HM/HP → 显示为 HN 等
    var displayType = type;
    typeSel.value = displayType;
    secMainTypeChange(displayType);
  }

  // 根据类型填充参数
  if (type === 'HW' || type === 'HM' || type === 'HN' || type === 'HP') {
    setInput('sm_H', sec.H);
    setInput('sm_B', sec.B);
    setInput('sm_tw', sec.tw);
    setInput('sm_tf', sec.tf);
  } else if (type === 'BOX') {
    setInput('sm_H', sec.H);
    setInput('sm_B', sec.B);
    setInput('sm_t1', sec.t1 || sec.t);
    setInput('sm_t2', sec.t2 || sec.t);
  } else if (type === 'CHS') {
    setInput('sm_D', sec.D);
    setInput('sm_t', sec.t);
  } else if (type === 'CRU') {
    setInput('sm_h1', sec.h1);
    setInput('sm_b1', sec.b1);
    setInput('sm_tw1', sec.tw1);
    setInput('sm_tf1', sec.tf1);
    setInput('sm_h2', sec.h2);
    setInput('sm_b2', sec.b2);
    setInput('sm_tw2', sec.tw2);
    setInput('sm_tf2', sec.tf2);
  }

  // 触发计算
  updateMainSectionCalc();

  // 关闭
  closeSectionPicker();

  // 提示
  toast('已选用：' + _spSelectedCode);
}

// 辅助：设置 input 值（触发 input 事件以联动）
function setInput(id, val) {
  var el = document.getElementById(id);
  if (!el) return;
  el.value = val;
  // 触发一次 input 事件
  var evt = new Event('input', { bubbles: true });
  el.dispatchEvent(evt);
}

// ═══════════════════════════════════════════
//  截面智能识别
// ═══════════════════════════════════════════
window.secSmartParse = function() {
  var raw = (document.getElementById('secSmartInput') || { value: '' }).value.trim();
  if (!raw) return;
  var result = secSmartRecognize(raw);
  var preview = document.getElementById('secSmartPreview');
  var hint = document.getElementById('secSmartHint');
  if (!result) {
    hint.textContent = '⚠️ 无法识别该截面格式，请检查输入（如 HN400×200、B500×500×12、P273×8、十+HN200×100+HN200×100）';
    hint.style.color = '#ef4444';
    preview.style.display = 'none';
    return;
  }
  // 快捷入口提示结果（十/异单独输入时）
  if (result._hint) {
    hint.textContent = result._hint;
    hint.style.color = '#5c6bc0';
    hint.style.whiteSpace = 'pre-wrap';
    hint.style.fontSize = '12px';
    preview.style.display = 'none';
    window._secSmartResult = result;
    return;
  }
  hint.textContent = '支持：H型钢(H)、箱型(B)、圆管(P)、十字柱(十)、异形截面(异)';
  hint.style.color = '';
  hint.style.whiteSpace = '';
  hint.style.fontSize = '';
  preview.style.display = 'flex';
  document.getElementById('secSmartPreviewType').textContent = result.typeLabel;
  document.getElementById('secSmartPreviewName').textContent = result.name;
  document.getElementById('secSmartPreviewDims').textContent = result.dims;
  // 存储解析结果供 apply 使用
  window._secSmartResult = result;
};

window.secSmartApply = function() {
  var r = window._secSmartResult;
  if (!r) return;
  // 快捷入口类型：直接显示提示，不填表
  if (r.type === 'CRU_SHORTCUT' || r.type === 'SPECIAL_SHORTCUT') {
    var hint = document.getElementById('secSmartHint');
    if (hint) { hint.textContent = r._hint; hint.style.color = '#5c6bc0'; hint.style.whiteSpace = 'pre-wrap'; hint.style.fontSize = '12px'; }
    return;
  }
  // 1. 设置下拉类型并渲染表单字段（先渲染，再填值）
  var typeSel = document.getElementById('sec-main-type');
  if (typeSel) {
    var opt = Array.from(typeSel.options).find(function(o) { return o.value === r.type; });
    if (opt) {
      typeSel.value = r.type;
      // 仅重新渲染字段，不触发 updateMainSectionCalc（避免提前清零）
      secMainTypeChange(r.type);
    }
  }
  // 2. 渲染完毕后再填入参数（DOM 已就绪）
  if (r.type === 'HW' || r.type === 'HM' || r.type === 'HN' || r.type === 'HP') {
    setInput('sm_H', r.H);
    setInput('sm_B', r.B);
    setInput('sm_tw', r.tw);
    setInput('sm_tf', r.tf);
  } else if (r.type === 'BOX') {
    setInput('sm_B', r.B);
    setInput('sm_H', r.H);
    // B前缀格式：B800×400×20×30 → t1/t2 独立；□格式：t 单值 → 两边相同
    setInput('sm_t1', r.t1 !== undefined ? r.t1 : r.t);
    setInput('sm_t2', r.t2 !== undefined ? r.t2 : r.t);
  } else if (r.type === 'CHS') {
    setInput('sm_D', r.D);
    setInput('sm_t', r.t);
  } else if (r.type === 'CRU') {
    setInput('sm_h1', r.h1);
    setInput('sm_b1', r.b1);
    setInput('sm_tw1', r.tw1);
    setInput('sm_tf1', r.tf1);
    setInput('sm_h2', r.h2);
    setInput('sm_b2', r.b2);
    setInput('sm_tw2', r.tw2);
    setInput('sm_tf2', r.tf2);
  }
  updateMainSectionCalc();
  // 清空输入
  var inp = document.getElementById('secSmartInput');
  if (inp) inp.value = '';
  document.getElementById('secSmartPreview').style.display = 'none';
  // 回到底层显示
  var hint = document.getElementById('secSmartHint');
  if (hint) { hint.textContent = '支持：H型钢(H)、箱型(B)、圆管(P)、十字柱(十)、异形截面(异)'; hint.style.color = ''; }
  toast('已应用：' + r.name);
};

// 核心识别函数
function secSmartRecognize(raw) {
  raw = raw.replace(/[‐ ᐧ·]/g, '×').replace(/[xX×\*]/g, '×').trim();

  // ── 0. 快捷入口：十 / 异 ─────────────────────
  // 十 → 十字柱快捷入口，提示标准输入格式
  if (raw === '十' || raw === '十 ') {
    return {
      type: 'CRU_SHORTCUT', name: '十字柱（快捷入口）',
      typeLabel: '十', dims: '请输入如 十600×200×20×30+800×400×20×30',
      _hint: '十字柱标准格式：十竖向H×B×tw×tf+横向H×B×tw×tf\n例如：十600×200×20×30+800×400×20×30\n表示：竖H(600高×200宽，tw=20 tf=30) + 横H(800高×400宽，tw=20 tf=30)'
    };
  }
  // 异 → 异形截面快捷入口，提示标准输入格式
  if (raw === '异' || raw === '异 ') {
    return {
      type: 'SPECIAL_SHORTCUT', name: '异形截面（快捷入口）',
      typeLabel: '异', dims: '请输入具体异形截面规格',
      _hint: '异形截面：请输入具体参数组合\n目前系统支持通过直接查库方式匹配异形截面代码'
    };
  }

  // ── 1. 十字柱 十H×B×tw×tf+H×B×tw×tf ─────────
  var cruFull = raw.match(/^十(\d+)×(\d+)×(\d+)×(\d+)\+(\d+)×(\d+)×(\d+)×(\d+)$/i);
  if (cruFull) {
    var h1=+cruFull[1], b1=+cruFull[2], tw1=+cruFull[3], tf1=+cruFull[4];
    var h2=+cruFull[5], b2=+cruFull[6], tw2=+cruFull[7], tf2=+cruFull[8];
    var name = '十'+h1+'×'+b1+'×'+tw1+'×'+tf1+'+'+h2+'×'+b2+'×'+tw2+'×'+tf2;
    return {
      type:'CRU', name:name,
      typeLabel:'十', dims:'竖'+h1+'×'+b1+'×'+tw1+'×'+tf1+' / 横'+h2+'×'+b2+'×'+tw2+'×'+tf2,
      h1:h1,b1:b1,tw1:tw1,tf1:tf1, h2:h2,b2:b2,tw2:tw2,tf2:tf2
    };
  }
  // ── 2. 十字柱 +HN…+HN… ──────────────────────
  var cruMatch = raw.match(/^\+HN(\d+)×(\d+)(?:\+HN(\d+)×(\d+))?$/i);
  if (cruMatch) {
    var h1=+cruMatch[1], b1=+cruMatch[2];
    var h2=cruMatch[3]?+cruMatch[3]:h1, b2=cruMatch[4]?+cruMatch[4]:b1;
    var t1=Math.max(4,Math.round(h1/25)), f1=Math.max(6,Math.round(b1/12));
    var t2=Math.max(4,Math.round(h2/25)), f2=Math.max(6,Math.round(b2/12));
    var name = h1===h2&&b1===b2 ? '+HN'+h1+'×'+b1+'+HN'+h2+'×'+b2 : '+HN'+h1+'×'+b1+'+HN'+h2+'×'+b2;
    return {
      type:'CRU', name:name,
      typeLabel:'十', dims:'竖'+h1+'×'+b1+' / 横'+h2+'×'+b2,
      h1:h1,b1:b1,tw1:t1,tf1:f1, h2:h2,b2:b2,tw2:t2,tf2:f2
    };
  }
  // ── 3. 圆管 P609×16 / Ø273×8 / φ273×8 ───────
  var pipeMatch = raw.match(/^[PØφD](\d+)×(\d+\.?\d*)$/i);
  if (pipeMatch) {
    var D=+pipeMatch[1], t=+pipeMatch[2];
    return { type:'CHS', name:'Ø'+D+'×'+t, typeLabel:'P', dims:'D='+D+'  t='+t, D:D, t:t };
  }
  // ── 4. 箱型截面 □500×500×12 / 口500×500×12 ───
  var boxMatch = raw.match(/^[□□口](\d+)×(\d+)×?(\d*)$/);
  if (boxMatch) {
    var H=+boxMatch[1], B=+boxMatch[2], t=boxMatch[3]?+boxMatch[3]:8;
    return { type:'BOX', name:'□'+H+'×'+B+'×'+t, typeLabel:'B', dims:'H='+H+'  B='+B+'  t='+t, H:H, B:B, t:t };
  }
  // ── 5. 箱型 B前缀：B800×400×20×30 ──────────────
  var bBox = raw.match(/^B(\d+)×(\d+)×(\d+\.?\d*)×(\d+\.?\d*)$/i);
  if (bBox) {
    var BH=+bBox[1], BB=+bBox[2], bt1=+bBox[3], bt2=+bBox[4];
    return { type:'BOX', name:'B'+BH+'×'+BB+'×'+bt1+'×'+bt2, typeLabel:'B',
      dims:'H='+BH+'  B='+BB+'  t1='+bt1+'  t2='+bt2, H:BH, B:BB, t1:bt1, t2:bt2 };
  }
  // ── 6. H型钢 ─────────────────────────────────
  // 4参数：H500×200×10×14
  var h4 = raw.match(/^H(\d+)×(\d+)×(\d+\.?\d*)×(\d+\.?\d*)$/i);
  if (h4) {
    var H=+h4[1], B=+h4[2], tw=+h4[3], tf=+h4[4];
    return { type:'HW', name:'H'+H+'×'+B+'×'+tw+'×'+tf, typeLabel:'H', dims:'H='+H+'  B='+B+'  tw='+tw+'  tf='+tf, H:H, B:B, tw:tw, tf:tf };
  }
  // 2参数：查库或推算
  var h2 = raw.match(/^H([NMHW]?)(\d+)×(\d+)$/i);
  if (h2) {
    var prefix=(h2[1]||'').toUpperCase();
    var H=+h2[2], B=+h2[3];
    // 查库
    var matched = SECTION_DB.find(function(s){
      return s.H===H && s.B===B && (s.type===('H'+prefix)||(prefix==='HM'&&s.type==='HM')||(prefix==='HN'&&s.type==='HN')||(prefix==='HW'&&s.type==='HW')||(!prefix&&'HWNMHP'.indexOf(s.type)>=0));
    });
    if (matched) {
      return { type:matched.type, name:matched.code, typeLabel:'H',
        dims:'H='+H+'  B='+B+'  tw='+matched.tw+'  tf='+matched.tf,
        H:H, B:B, tw:matched.tw, tf:matched.tf };
    }
    // 无库时估算
    var tw=Math.max(6,Math.round(H/50));
    var tf=Math.max(8,Math.round(B/12));
    return { type:'HN', name:'HN'+H+'×'+B, typeLabel:'H', dims:'H='+H+'  B='+B+'  tw≈'+tw+'  tf≈'+tf, H:H, B:B, tw:tw, tf:tf };
  }
  // ── 7. HN/HW/HM/HP 直接查库 ─────────────────
  var dbMatch = raw.match(/^(HN|HW|HM|HP)(\d+)×(\d+)$/i);
  if (dbMatch) {
    var tp=dbMatch[1].toUpperCase(), H=+dbMatch[2], B=+dbMatch[3];
    var found = SECTION_DB.find(function(s){ return s.type===tp && s.H===H && s.B===B; });
    if (found) {
      return { type:tp, name:found.code, typeLabel:'H',
        dims:'H='+H+'  B='+B+'  tw='+found.tw+'  tf='+found.tf,
        H:H, B:B, tw:found.tw, tf:found.tf };
    }
  }
  // ── 8. 直接查库（code 完全匹配）───────────────
  var byCode = SECTION_DB.find(function(s){ return s.code===raw || s.code.toUpperCase()===raw.toUpperCase(); });
  if (byCode) {
    var t=byCode.type, label={HW:'H',HM:'H',HN:'H',HP:'H',BOX:'B',CHS:'P',CRU:'十'}[t]||'H';
    if (t==='HW'||t==='HM'||t==='HN'||t==='HP')
      return { type:t, name:byCode.code, typeLabel:label, dims:'H='+byCode.H+'  B='+byCode.B+'  tw='+byCode.tw+'  tf='+byCode.tf, H:byCode.H, B:byCode.B, tw:byCode.tw, tf:byCode.tf };
    if (t==='BOX')
      return { type:'BOX', name:byCode.code, typeLabel:'B', dims:'H='+byCode.H+'  B='+byCode.B+'  t='+byCode.t, H:byCode.H, B:byCode.B, t:byCode.t };
    if (t==='CHS')
      return { type:'CHS', name:byCode.code, typeLabel:'P', dims:'D='+byCode.D+'  t='+byCode.t, D:byCode.D, t:byCode.t };
    if (t==='CRU')
      return { type:'CRU', name:byCode.code, typeLabel:'十',
        dims:'竖'+byCode.h1+'×'+byCode.b1+' / 横'+byCode.h2+'×'+byCode.b2,
        h1:byCode.h1,b1:byCode.b1,tw1:byCode.tw1,tf1:byCode.tf1, h2:byCode.h2,b2:byCode.b2,tw2:byCode.tw2,tf2:byCode.tf2 };
  }
  return null;
}

// ── 卡片折叠/展开 ─────────────────────────────────────────────────
function toggleLiftCard(cardEl) {
  cardEl.classList.toggle('collapsed');
}

