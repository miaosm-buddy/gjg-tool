/**
 * 诊断脚本：检查三一品牌消失的根本原因
 *
 * 使用方法：
 * 1. 在浏览器中打开 机械选型 应用（http://localhost:5001 或离线版 index_完整离线版.html）
 * 2. 按 F12 打开开发者工具 → Console（控制台）
 * 3. 粘贴以下代码并回车：
 *
 *    // 方式1：检查 localStorage 中是否有覆盖三一型号的数据
 *    (function(){
 *      var uc = JSON.parse(localStorage.getItem('crane_portable_user_cranes') || '[]');
 *      var conflicting = uc.filter(function(c){ return c.brand === '三一' && c.type !== '汽车吊'; });
 *      console.log('=== localStorage 三一非汽车吊条目 ===');
 *      if(conflicting.length === 0){
 *        console.log('✓ localStorage 中无三一非汽车吊数据，localStorage 不是问题根源');
 *      } else {
 *        console.log('⚠ 发现', conflicting.length, '条三一非汽车吊数据：');
 *        conflicting.forEach(function(c){ console.log('  ID:', c.id, '型号:', c.model, '类型:', c.type); });
 *      }
 *    })();
 *
 *    // 方式2：直接检查 data.cranes 中三一汽车吊的状态
 *    (function(){
 *      if(typeof data === 'undefined' || !data.cranes){
 *        console.log('data 尚未加载，请等待页面完全加载后再试');
 *        return;
 *      }
 *      var sany_cars = data.cranes.filter(function(c){
 *        return c.brand === '三一' && c.type === '汽车吊';
 *      });
 *      var sany_user = sany_cars.filter(function(c){ return c._user_added === true; });
 *      console.log('=== data.cranes 中三一汽车吊状态 ===');
 *      console.log('三一汽车吊总数:', sany_cars.length);
 *      console.log('标记为 _user_added 的数量:', sany_user.length);
 *      console.log('问题:', sany_user.length > 0 ? '⚠ 三一汽车吊被标记为用户录入，会被下拉框过滤！' : '✓ 三一汽车吊正常（内置数据）');
 *    })();
 *
 * 4. 把控制台输出发给我
 */
console.log('=== 诊断脚本已加载 ===');
console.log('请复制上方 // 方式1 和 // 方式2 两个代码块到控制台运行');
