var canvas = wx.createCanvas();
var ctx = canvas.getContext('2d');
var sys = wx.getSystemInfoSync();
var W = sys.windowWidth, H = sys.windowHeight;
var CLOUD_ENV = 'cloud1-d6gimfu7tb84572e1';

// Layout
var P = W * 0.032, TS = (W - P * 2 - 8 * 2 - 8 * 3) / 4;
var GY = P + W * 0.24 + W * 0.10 + 10, GW = W - P * 2, CT = TS + 8;

// Game state
var grid = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
var score = 0, best = 0, over = false, won = false, keep = false;
var prevGrid = null, prevScore = 0;
try { best = wx.getStorageSync('b') || 0; } catch(e) {}

// Energy
var energy = 5, maxEnergy = 5;

// Items + coins
var items = { undo: 3, shuffle: 3, bomb: 3 };
var coins = 0;

// Leaderboard
var openid = '', showLB = false, lbData = [], lbLoad = false, lbError = '';

// Shop
var showShop = false;
var noEnergyMsg = false, noEnergyTimer = 0;
var shopMsg = '', shopMsgTimer = 0;

// Share reward flag (prevent spam)
var canShareReward = true;

// ==================== CLOUD ====================
function initCloud() { if (CLOUD_ENV) try { wx.cloud.init({ env: CLOUD_ENV, traceUser: true }); } catch(e) {} }

function getOpenid() {
  if (!CLOUD_ENV) return;
  wx.cloud.callFunction({ name: 'login', success: function(r) {
    if (r.result && r.result.openid) openid = r.result.openid;
    loadUserData();
  }, fail: function() { loadFromLocal(); } });
}

function loadUserData() {
  if (!openid || !CLOUD_ENV) { loadFromLocal(); return; }
  wx.cloud.callFunction({ name: 'getUserData', success: function(r) {
    if (r.result) {
      energy = r.result.energy || 5; maxEnergy = r.result.maxEnergy || 5;
      if (r.result.items) items = r.result.items;
      if (r.result.coins !== undefined) coins = r.result.coins;
      draw();
    }
  }, fail: function() { loadFromLocal(); } });
}

function loadFromLocal() {
  try {
    var e = wx.getStorageSync('eData');
    if (e) { var reg = Math.floor((Date.now() - e.ts)/600000); energy = Math.min(5, e.v + reg); }
    var it = wx.getStorageSync('items'); if (it) items = it;
    coins = wx.getStorageSync('coins') || 0;
  } catch(e) {}
  draw();
}

function saveToLocal(key, val) {
  try { wx.setStorageSync(key, val); } catch(e) {}
}

function syncEnergy(e) {
  saveToLocal('eData', { v: e, ts: Date.now() });
  if (openid && CLOUD_ENV) wx.cloud.callFunction({ name: 'updateUserData', data: { energy: e }, fail: function() {} });
}

function syncItems(it) {
  saveToLocal('items', it);
  if (openid && CLOUD_ENV) wx.cloud.callFunction({ name: 'updateUserData', data: { items: it }, fail: function() {} });
}

function syncCoins(c) {
  coins = c; saveToLocal('coins', c);
  if (openid && CLOUD_ENV) wx.cloud.callFunction({ name: 'updateUserData', data: { coins: c }, fail: function() {} });
}

function saveScoreToCloud(s) {
  if (!CLOUD_ENV || !openid) return;
  wx.cloud.callFunction({ name: 'getRank', success: function(r) {
    if (r.result && r.result.myScore >= s) return;
    var db = wx.cloud.database();
    db.collection('scores').where({ _openid: openid }).count().then(function(cnt) {
      if (cnt.total > 0) {
        db.collection('scores').where({ _openid: openid }).get().then(function(ex) {
          if (ex.data.length > 0 && ex.data[0].score < s) db.doc(ex.data[0]._id).update({ data: { score: s } });
        });
      } else { db.collection('scores').add({ data: { score: s } }); }
    });
  }, fail: function() {} });
}

function loadRank() {
  lbLoad = true; lbError = ''; draw();
  if (!CLOUD_ENV) { lbError = '云服务未就绪'; lbLoad = false; draw(); return; }
  wx.cloud.callFunction({ name: 'getRank', success: function(r) {
    lbLoad = false;
    if (r.result && r.result.list) { lbData = r.result.list; draw(); }
    else { lbError = '暂无数据'; draw(); }
  }, fail: function() { lbError = '加载失败'; lbLoad = false; draw(); } });
}

// ==================== GAME LOGIC ====================
function add() {
  var e = [];
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (grid[r][c] === 0) e.push({r:c,c:r});
  if (e.length === 0) return;
  var t = e[Math.floor(Math.random() * e.length)];
  grid[t.c][t.r] = Math.random() < 0.9 ? 2 : 4;
}

function slide(a) {
  var b = []; for (var i = 0; i < a.length; i++) if (a[i] !== 0) b.push(a[i]);
  var o = []; var g = 0; var i = 0;
  while (i < b.length) {
    if (i + 1 < b.length && b[i] === b[i+1]) { o.push(b[i]*2); g += b[i]*2; i += 2; }
    else { o.push(b[i]); i++; }
  }
  while (o.length < 4) o.push(0);
  return {r: o, g: g};
}

function savePrev() {
  prevGrid = []; for (var r = 0; r < 4; r++) prevGrid[r] = grid[r].slice();
  prevScore = score;
}

function mv(d) {
  if (over) return; if (won && !keep) return;
  savePrev();
  var g = 0, m = false;
  if (d === 0) { for (var r = 0; r < 4; r++) { var s = slide(grid[r]); if (s.r.join() !== grid[r].join()) m = true; grid[r] = s.r; g += s.g; } }
  else if (d === 1) { for (var r = 0; r < 4; r++) { var a = []; for (var i = 3; i >= 0; i--) a.push(grid[r][i]); var s = slide(a); var n = []; for (var i = 3; i >= 0; i--) n.push(s.r[i]); if (n.join() !== grid[r].join()) m = true; grid[r] = n; g += s.g; } }
  else if (d === 2) { for (var c = 0; c < 4; c++) { var a = []; for (var r = 0; r < 4; r++) a.push(grid[r][c]); var s = slide(a); for (var r = 0; r < 4; r++) { if (grid[r][c] !== s.r[r]) m = true; grid[r][c] = s.r[r]; } g += s.g; } }
  else { for (var c = 0; c < 4; c++) { var a = []; for (var r = 3; r >= 0; r--) a.push(grid[r][c]); var s = slide(a); var n = []; for (var r = 3; r >= 0; r--) n.push(s.r[r]); for (var r = 0; r < 4; r++) { if (grid[r][c] !== n[r]) m = true; grid[r][c] = n[r]; } g += s.g; } }
  if (!m) return;
  score += g;
  if (score > best) { best = score; saveToLocal('b', best); }
  add(); draw();
  if (!won && !keep) { for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (grid[r][c] === 1024) { won = true; draw(); return; } }
  var done = true;
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) { if (grid[r][c] === 0) done = false; else if (c < 3 && grid[r][c] === grid[r][c+1]) done = false; else if (r < 3 && grid[r][c] === grid[r+1][c]) done = false; }
  if (done) { over = true; earnCoins(); saveScoreToCloud(score); useEnergy(); draw(); }
}

function useEnergy() {
  if (energy > 0) { energy--; syncEnergy(energy); }
}

function earnCoins() {
  var earned = Math.floor(score / 10);
  if (earned > 0) syncCoins(coins + earned);
}

// ==================== ITEMS ====================
function doUndo() {
  if (!prevGrid || items.undo <= 0) return;
  items.undo--; syncItems(items);
  grid = []; for (var r = 0; r < 4; r++) grid[r] = prevGrid[r].slice();
  score = prevScore; over = false; won = false; keep = false;
  prevGrid = null; draw();
}

function doShuffle() {
  if (items.shuffle <= 0) return;
  items.shuffle--; syncItems(items);
  var vals = []; for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (grid[r][c] > 0) vals.push(grid[r][c]);
  var empty = 16 - vals.length; for (var i = 0; i < empty; i++) vals.push(0);
  for (var i = vals.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = vals[i]; vals[i] = vals[j]; vals[j] = t; }
  var idx = 0; for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) { grid[r][c] = vals[idx]; idx++; }
  prevGrid = null; draw();
}

function doBomb() {
  if (items.bomb <= 0) return;
  items.bomb--; syncItems(items);
  var maxV = 0, maxR = -1, maxC = -1;
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) { if (grid[r][c] > maxV) { maxV = grid[r][c]; maxR = r; maxC = c; } }
  if (maxR >= 0) grid[maxR][maxC] = 0;
  prevGrid = null; draw();
}

// ==================== SHARE ====================
function doShare() {
  if (!canShareReward) return;
  canShareReward = false;
  setTimeout(function() { canShareReward = true; }, 5000);
  try {
    wx.shareAppMessage({
      title: '1024棒棒糖 - 你能合并到1024吗？来挑战！',
      imageUrl: ''
    });
    // Reward after sharing (give 1 random item)
    var types = ['undo','shuffle','bomb'];
    var pick = types[Math.floor(Math.random() * 3)];
    items[pick]++; syncItems(items);
    showMsg('分享成功！获得' + (pick==='undo'?'撤回':pick==='shuffle'?'洗牌':'炸弹'));
  } catch(e) {}
}

// ==================== SHOP ====================
function buyItem(type, cost) {
  if (coins < cost) { showMsg('金币不够！'); return; }
  syncCoins(coins - cost);
  items[type]++; syncItems(items);
  showMsg('购买成功！');
  draw();
}

function showMsg(text) {
  shopMsg = text; shopMsgTimer = Date.now();
  draw();
  setTimeout(function() { shopMsg = ''; draw(); }, 2000);
}

// ==================== DRAWING HELPERS ====================
function fR(x, y, w, h) {
  ctx.beginPath(); ctx.moveTo(x+6,y); ctx.lineTo(x+w-6,y); ctx.quadraticCurveTo(x+w,y,x+w,y+6);
  ctx.lineTo(x+w,y+h-6); ctx.quadraticCurveTo(x+w,y+h,x+w-6,y+h); ctx.lineTo(x+6,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-6); ctx.lineTo(x,y+6); ctx.quadraticCurveTo(x,y,x+6,y); ctx.closePath(); ctx.fill();
}

function sb(x,y,label,val) {
  ctx.fillStyle='#bbada0'; fR(x,y,72,44);
  ctx.fillStyle='#eee4da'; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.font='bold 10px sans-serif'; ctx.fillText(label,x+36,y+4);
  ctx.fillStyle='#fff'; ctx.textBaseline='bottom'; ctx.font='bold 20px sans-serif'; ctx.fillText(val,x+36,y+40);
}

function tc(v) {
  var m={2:['#eee4da','#776e65'],4:['#ede0c8','#776e65'],8:['#f2b179','#f9f6f2'],16:['#f59563','#f9f6f2'],32:['#f67c5f','#f9f6f2'],64:['#f65e3b','#f9f6f2'],128:['#edcf72','#f9f6f2'],256:['#edcc61','#f9f6f2'],512:['#edc850','#f9f6f2'],1024:['#edc53f','#f9f6f2']};
  var c=m[v]||['#edc53f','#f9f6f2']; return {bg:c[0],text:c[1]};
}

// ==================== DRAW ====================
function draw() {
  ctx.fillStyle='#faf8ef'; ctx.fillRect(0,0,W,H);

  // Title
  ctx.textBaseline='top'; ctx.font='bold 44px sans-serif'; ctx.textAlign='left';
  ctx.fillStyle='#776e65'; ctx.fillText('1024',P,P*0.4);
  ctx.fillStyle='#edcf72'; ctx.font='bold 24px sans-serif'; ctx.fillText('棒棒糖',P+110,P*0.4+12);

  // Energy hearts + coins
  var hy = P*0.4 + 48;
  ctx.font = '16px sans-serif';
  for (var i = 0; i < maxEnergy; i++) { ctx.fillStyle = i < energy ? '#e74c3c' : '#ddd'; ctx.fillText('♥', P + i*22, hy); }
  ctx.fillStyle = '#f39c12'; ctx.textAlign='left'; ctx.font='14px sans-serif';
  ctx.fillText('✦ '+coins, P + maxEnergy*22 + 8, hy+2);

  // Score boxes
  var bx=W-P-72,by=P*0.4; sb(bx,by,'分数',score); sb(bx-78,by,'最高',best);

  // Hint + New Game
  var sy = hy + 24;
  ctx.fillStyle='#776e65'; ctx.font=Math.round(W*0.035)+'px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('合并方块，凑出1024！',P,sy);
  ctx.fillStyle='#8f7a66'; fR(W-P-80,sy,80,30);
  ctx.fillStyle='#f9f6f2'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='bold 14px sans-serif';
  ctx.fillText('新游戏',W-P-40,sy+15);

  // Grid
  ctx.fillStyle='#bbada0'; fR(P,GY,GW,GW);
  for(var r=0;r<4;r++) for(var c=0;c<4;c++) { ctx.fillStyle='rgba(238,228,218,0.35)'; fR(P+8+c*CT,GY+8+r*CT,TS,TS); }
  for(var r=0;r<4;r++) for(var c=0;c<4;c++) {
    var v=grid[r][c]; if(v===0) continue;
    var co=tc(v); ctx.fillStyle=co.bg; fR(P+8+c*CT,GY+8+r*CT,TS,TS);
    ctx.fillStyle=co.text; ctx.textAlign='center'; ctx.textBaseline='middle';
    var fs=TS*0.5; if(v>=1000) fs=TS*0.35; else if(v>=100) fs=TS*0.4;
    ctx.font='bold '+Math.round(fs)+'px sans-serif';
    ctx.fillText(v,P+8+c*CT+TS/2,GY+8+r*CT+TS/2+1);
  }

  // Bottom bar: items + shop + share + rank
  var iy = GY + GW + 8;
  var iw = (GW - 20) / 5;
  var iNames = ['撤回','洗牌','炸弹','排行','分享'];
  var iCounts = [items.undo, items.shuffle, items.bomb, 0, 0];
  var iCanUse = [items.undo>0, items.shuffle>0, items.bomb>0, true, true];
  for (var i = 0; i < 5; i++) {
    var ix = P + 4 + i * (iw + 3);
    ctx.fillStyle = iCanUse[i] ? '#8f7a66' : '#ccc';
    fR(ix, iy, iw, 36);
    ctx.fillStyle = '#f9f6f2'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font = 'bold 13px sans-serif'; ctx.fillText(iNames[i], ix + iw/2, iy + 12);
    if (i < 3) { ctx.font = '10px sans-serif'; ctx.fillText('x'+iCounts[i], ix + iw/2, iy + 27); }
  }

  // Shop button (small link below coins)
  var shopY = iy + 42;
  ctx.fillStyle = '#8f7a66'; ctx.textAlign='center'; ctx.font = '13px sans-serif';
  ctx.fillText('+ 点击道具数量购买更多', W/2, shopY);

  // Toast message
  if (shopMsg) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; fR(W/2-100, shopY+30, 200, 32);
    ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font = '14px sans-serif';
    ctx.fillText(shopMsg, W/2, shopY+46);
  }

  // Overlays
  if(won&&!keep) drawOverlay('你赢了！',false);
  else if(over) drawOverlay('游戏结束',true);

  // No energy
  if (noEnergyMsg) {
    var now = Date.now();
    if (now - noEnergyTimer > 2000) { noEnergyMsg = false; draw(); }
    else {
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.font='bold 18px sans-serif'; ctx.fillText('体力不足！', W/2, H/2 - 10);
      ctx.font='14px sans-serif'; ctx.fillText('等待体力恢复中...', W/2, H/2 + 20);
    }
  }

  if(showShop) drawShop();
  if(showLB) drawLB();
}

function drawOverlay(title,isLose) {
  var cx=P+GW/2;
  ctx.fillStyle='rgba(238,228,218,0.73)'; fR(P,GY,GW,GW);
  ctx.fillStyle='#776e65'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='bold 40px sans-serif'; ctx.fillText(title,cx,GY+GW/2-40);
  var bw=140,bh=40,gap=14,cy=GY+GW/2+20;
  if(!isLose) {
    ctx.strokeStyle='#8f7a66'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(cx-bw/2+6,cy); ctx.lineTo(cx+bw/2-6,cy);
    ctx.quadraticCurveTo(cx+bw/2,cy,cx+bw/2,cy+6);
    ctx.lineTo(cx+bw/2,cy+bh-6); ctx.quadraticCurveTo(cx+bw/2,cy+bh,cx+bw/2-6,cy+bh);
    ctx.lineTo(cx-bw/2+6,cy+bh); ctx.quadraticCurveTo(cx-bw/2,cy+bh,cx-bw/2,cy+bh-6);
    ctx.lineTo(cx-bw/2,cy+6); ctx.quadraticCurveTo(cx-bw/2,cy,cx-bw/2+6,cy);
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle='#776e65'; ctx.font='bold 15px sans-serif'; ctx.fillText('继续挑战',cx,cy+bh/2+1); cy+=bh+gap;
  }
  ctx.fillStyle='#8f7a66'; fR(cx-bw/2,cy,bw,bh);
  ctx.fillStyle='#f9f6f2'; ctx.font='bold 15px sans-serif';
  ctx.fillText(isLose?'再来一局':'新游戏',cx,cy+bh/2+1);
}

function drawShop() {
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(0,0,W,H);
  var sx=W*0.1, sy=H*0.2, sw=W*0.8, sh=H*0.55;
  ctx.fillStyle='#fff'; fR(sx,sy,sw,sh);
  ctx.fillStyle='#776e65'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.font='bold 24px sans-serif'; ctx.fillText('道具商店',sx+sw/2,sy+20);
  ctx.font='14px sans-serif'; ctx.fillText('✦ '+coins+' 金币',sx+sw/2,sy+50);
  ctx.font='bold 20px sans-serif'; ctx.fillStyle='#776e65'; ctx.textAlign='right'; ctx.fillText('X',sx+sw-15,sy+10);

  var itemsCfg = [
    { name:'撤回', key:'undo', price:100, icon:'↩' },
    { name:'洗牌', key:'shuffle', price:100, icon:'⟳' },
    { name:'炸弹', key:'bomb', price:100, icon:'💣' }
  ];
  var sy2 = sy + 80;
  for (var i = 0; i < 3; i++) {
    var ci = itemsCfg[i];
    ctx.fillStyle='#f5f2ee'; fR(sx+20,sy2+i*60,sw-40,50);
    ctx.fillStyle='#776e65'; ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.font='18px sans-serif'; ctx.fillText(ci.icon+' '+ci.name, sx+35, sy2+i*60+25);
    ctx.textAlign='right';
    ctx.fillText('x'+items[ci.key], sx+sw-130, sy2+i*60+25);
    // Buy button
    ctx.fillStyle = coins >= ci.price ? '#e67e22' : '#ccc';
    fR(sx+sw-100, sy2+i*60+10, 70, 30);
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 13px sans-serif';
    ctx.fillText('✦'+ci.price, sx+sw-65, sy2+i*60+25);
  }
}

function drawLB() {
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(0,0,W,H);
  var lx=W*0.08, ly=H*0.08, lw=W*0.84, lh=H*0.84;
  ctx.fillStyle='#fff'; fR(lx,ly,lw,lh);
  ctx.fillStyle='#776e65'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.font='bold 28px sans-serif'; ctx.fillText('排行榜',lx+lw/2,ly+20);
  ctx.font='bold 24px sans-serif'; ctx.textAlign='right'; ctx.fillText('X',lx+lw-15,ly+10);

  if(lbLoad) { ctx.textAlign='center'; ctx.font='16px sans-serif'; ctx.fillStyle='#999'; ctx.fillText('加载中...',lx+lw/2,ly+lh/2); return; }
  if(lbError) { ctx.textAlign='center'; ctx.font='16px sans-serif'; ctx.fillStyle='#999'; ctx.fillText(lbError,lx+lw/2,ly+lh/2); return; }
  if(lbData.length===0) { ctx.textAlign='center'; ctx.font='16px sans-serif'; ctx.fillStyle='#999'; ctx.fillText('暂无记录，快来挑战！',lx+lw/2,ly+lh/2); return; }

  var startY=ly+70, rowH=Math.min(38,(lh-100)/Math.min(lbData.length,10));
  for(var i=0;i<Math.min(lbData.length,10);i++) {
    var item=lbData[i], ry=startY+i*rowH;
    if(i%2===0) { ctx.fillStyle='#f5f2ee'; ctx.fillRect(lx+10,ry,lw-20,rowH); }
    ctx.fillStyle='#776e65'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.font='15px sans-serif';
    ctx.fillText((i+1)+'.',lx+20,ry+rowH/2);
    var uname = item.nickname || '用户' + (item._openid||'').substring(0,6);
    ctx.fillText(uname,lx+55,ry+rowH/2);
    ctx.textAlign='right'; ctx.font='bold 16px sans-serif';
    ctx.fillText(item.score,lx+lw-20,ry+rowH/2);
  }
}

// ==================== INPUT ====================
var sx=0,sy=0;
wx.onTouchStart(function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;});
wx.onTouchEnd(function(e){
  var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
  if(Math.abs(dx)<15&&Math.abs(dy)<15){tap(e.changedTouches[0].clientX,e.changedTouches[0].clientY);return;}
  if(Math.abs(dx)>Math.abs(dy)) mv(dx>0?1:0); else mv(dy>0?3:2);
});

function tap(x,y){
  // Close shop or LB
  if(showShop) { shopTap(x,y); return; }
  if(showLB) { lbTap(x,y); return; }

  // Bottom bar buttons
  var iy = GY + GW + 8;
  var iw = (GW - 20) / 5;
  for (var i = 0; i < 5; i++) {
    var ix = P + 4 + i * (iw + 3);
    if (x >= ix && x <= ix + iw && y >= iy && y <= iy + 36) {
      if (i === 0 && items.undo>0) doUndo();
      else if (i === 1 && items.shuffle>0) doShuffle();
      else if (i === 2 && items.bomb>0) doBomb();
      else if (i === 3) { showLB=true; lbLoad=true; draw(); loadRank(); }
      else if (i === 4) doShare();
      return;
    }
  }

  // Shop link (tap on item count text)
  var shopY = iy + 42;
  if (y >= shopY && y <= shopY + 30) { showShop = true; draw(); return; }

  // New Game button
  var eye = P*0.4+48+24;
  if(x>=W-P-80&&x<=W-P&&y>=eye&&y<=eye+30){
    if (energy <= 0) { noEnergyMsg = true; noEnergyTimer = Date.now(); draw(); }
    else { reset(); }
    return;
  }

  // Overlay
  if(won&&!keep) ovTap(x,y,false); else if(over) ovTap(x,y,true);
}

function shopTap(x,y) {
  var sx=W*0.1, sy=H*0.2, sw=W*0.8, sh=H*0.55;
  // Close (X or outside)
  if(x<sx||x>sx+sw||y<sy||y>sy+sh){ showShop=false; draw(); return; }
  if(y>=sy+10&&y<=sy+40&&x>=sx+sw-40&&x<=sx+sw){ showShop=false; draw(); return; }
  // Buy buttons
  var sy2 = sy + 80;
  var itemsCfg = [
    { key:'undo', price:100 },
    { key:'shuffle', price:100 },
    { key:'bomb', price:100 }
  ];
  for (var i = 0; i < 3; i++) {
    var ci = itemsCfg[i];
    var bx = sx+sw-100, by = sy2+i*60+10;
    if (x >= bx && x <= bx+70 && y >= by && y <= by+30) {
      buyItem(ci.key, ci.price);
      return;
    }
  }
}

function lbTap(x,y) {
  var lx=W*0.08, ly=H*0.08, lw=W*0.84, lh=H*0.84;
  if(y>=ly+10&&y<=ly+40&&x>=lx+lw-40&&x<=lx+lw){ showLB=false; draw(); return; }
  if(x<lx||x>lx+lw||y<ly||y>ly+lh){ showLB=false; draw(); return; }
}

function ovTap(x,y,isLose){
  var bw=140,bh=40,gap=14,cy=GY+GW/2+20;
  if(!isLose){
    if(x>=P+GW/2-bw/2&&x<=P+GW/2+bw/2&&y>=cy&&y<=cy+bh){ keep=true; draw(); return; }
    cy+=bh+gap;
  }
  if(x>=P+GW/2-bw/2&&x<=P+GW/2+bw/2&&y>=cy&&y<=cy+bh){ saveScoreToCloud(score); reset(); }
}

// ==================== RESET ====================
function reset() {
  grid = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  score = 0; over = false; won = false; keep = false; prevGrid = null;
  add(); add(); draw();
}

// ==================== LIFECYCLE ====================
wx.onShow(function(){draw();});
wx.onError(function(m){console.error(m);});

initCloud();
getOpenid();
add(); add(); draw();