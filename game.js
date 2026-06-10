var canvas = wx.createCanvas();
var ctx = canvas.getContext('2d');
var sys = wx.getSystemInfoSync();
var W = sys.windowWidth;
var H = sys.windowHeight;

// (Your cloud env ID goes here - will fill after setup)
var CLOUD_ENV = 'cloud1-d6gimfu7tb84572e1';

// Layout
var P = W * 0.032;
var TS = (W - P * 2 - 8 * 2 - 8 * 3) / 4;
var GX = P, GY = P + W * 0.20 + W * 0.10 + 10;
var GW = W - P * 2, CT = TS + 8;

var grid = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
var score = 0, best = 0, over = false, won = false, keep = false;
try { best = wx.getStorageSync('b') || 0; } catch(e) {}

// Cloud / Leaderboard
var openid = '';
var showLB = false;
var lbData = [];
var lbLoad = false;
var lbError = '';

function initCloud() {
  if (!CLOUD_ENV) return;
  try {
    wx.cloud.init({ env: CLOUD_ENV });
  } catch(e) {}
}

function getOpenid() {
  if (!CLOUD_ENV) return;
  wx.cloud.callFunction({
    name: 'login',
    success: function(r) {
      if (r.result && r.result.openid) openid = r.result.openid;
    },
    fail: function() {}
  });
}

function saveScore(s) {
  if (!CLOUD_ENV || !openid) return;
  // Check if we already have a higher score saved
  wx.cloud.callFunction({
    name: 'getRank',
    success: function(r) {
      if (r.result && r.result.myScore >= s) return; // not a new high
      // Save new high score
      var db = wx.cloud.database();
      var coll = db.collection('scores');
      // Upsert: try to find existing record, update or insert
      coll.where({ _openid: openid }).count().then(function(cnt) {
        if (cnt.total > 0) {
          coll.where({ _openid: openid }).get().then(function(existing) {
            if (existing.data.length > 0 && existing.data[0].score < s) {
              coll.doc(existing.data[0]._id).update({ data: { score: s } });
            }
          });
        } else {
          coll.add({ data: { score: s } });
        }
      });
    },
    fail: function() {}
  });
}

function loadRank() {
  if (!CLOUD_ENV) { lbError = 'Cloud not configured'; return; }
  lbLoad = true;
  lbError = '';
  draw();
  wx.cloud.callFunction({
    name: 'getRank',
    success: function(r) {
      if (r.result && r.result.list) {
        lbData = r.result.list;
        lbLoad = false;
        draw();
      } else {
        lbError = 'No data';
        lbLoad = false;
        draw();
      }
    },
    fail: function(e) {
      lbError = 'Load failed';
      lbLoad = false;
      draw();
    }
  });
}

// Game logic
function add() {
  var e = [];
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (grid[r][c] === 0) e.push({r:c,c:r});
  if (e.length === 0) return;
  var t = e[Math.floor(Math.random() * e.length)];
  grid[t.c][t.r] = Math.random() < 0.9 ? 2 : 4;
}

function slide(a) {
  var b = [];
  for (var i = 0; i < a.length; i++) if (a[i] !== 0) b.push(a[i]);
  var o = []; var g = 0; var i = 0;
  while (i < b.length) {
    if (i + 1 < b.length && b[i] === b[i+1]) { o.push(b[i]*2); g += b[i]*2; i += 2; }
    else { o.push(b[i]); i++; }
  }
  while (o.length < 4) o.push(0);
  return {r: o, g: g};
}

function mv(d) {
  if (over) return; if (won && !keep) return;
  var g = 0, m = false;
  if (d === 0) { for (var r = 0; r < 4; r++) { var s = slide(grid[r]); if (s.r.join() !== grid[r].join()) m = true; grid[r] = s.r; g += s.g; } }
  else if (d === 1) {
    for (var r = 0; r < 4; r++) { var a = []; for (var i = 3; i >= 0; i--) a.push(grid[r][i]); var s = slide(a); var n = []; for (var i = 3; i >= 0; i--) n.push(s.r[i]); if (n.join() !== grid[r].join()) m = true; grid[r] = n; g += s.g; }
  } else if (d === 2) {
    for (var c = 0; c < 4; c++) { var a = []; for (var r = 0; r < 4; r++) a.push(grid[r][c]); var s = slide(a); for (var r = 0; r < 4; r++) { if (grid[r][c] !== s.r[r]) m = true; grid[r][c] = s.r[r]; } g += s.g; }
  } else {
    for (var c = 0; c < 4; c++) { var a = []; for (var r = 3; r >= 0; r--) a.push(grid[r][c]); var s = slide(a); var n = []; for (var r = 3; r >= 0; r--) n.push(s.r[r]); for (var r = 0; r < 4; r++) { if (grid[r][c] !== n[r]) m = true; grid[r][c] = n[r]; } g += s.g; }
  }
  if (!m) return;
  score += g;
  if (score > best) { best = score; try { wx.setStorageSync('b', best); } catch(e) {} }
  add(); draw();
  if (!won && !keep) { for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if (grid[r][c] === 1024) { won = true; draw(); return; } }
  var done = true;
  for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) { if (grid[r][c] === 0) done = false; else if (c < 3 && grid[r][c] === grid[r][c+1]) done = false; else if (r < 3 && grid[r][c] === grid[r+1][c]) done = false; }
  if (done) { over = true; saveScore(score); draw(); }
}

function reset() {
  grid = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  score = 0; over = false; won = false; keep = false;
  add(); add(); draw();
}

function fR(x, y, w, h) {
  ctx.beginPath(); ctx.moveTo(x+6,y); ctx.lineTo(x+w-6,y); ctx.quadraticCurveTo(x+w,y,x+w,y+6);
  ctx.lineTo(x+w,y+h-6); ctx.quadraticCurveTo(x+w,y+h,x+w-6,y+h); ctx.lineTo(x+6,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-6); ctx.lineTo(x,y+6); ctx.quadraticCurveTo(x,y,x+6,y);
  ctx.closePath(); ctx.fill();
}

function sb(x,y,label,val) {
  ctx.fillStyle='#bbada0'; fR(x,y,76,50);
  ctx.fillStyle='#eee4da'; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.font='bold 10px sans-serif';
  ctx.fillText(label,x+38,y+5);
  ctx.fillStyle='#fff'; ctx.textBaseline='bottom'; ctx.font='bold 20px sans-serif';
  ctx.fillText(val,x+38,y+45);
}

function tc(v) {
  var m={2:['#eee4da','#776e65'],4:['#ede0c8','#776e65'],8:['#f2b179','#f9f6f2'],16:['#f59563','#f9f6f2'],32:['#f67c5f','#f9f6f2'],64:['#f65e3b','#f9f6f2'],128:['#edcf72','#f9f6f2'],256:['#edcc61','#f9f6f2'],512:['#edc850','#f9f6f2'],1024:['#edc53f','#f9f6f2']};
  var c=m[v]||['#edc53f','#f9f6f2']; return {bg:c[0],text:c[1]};
}

function draw() {
  ctx.fillStyle='#faf8ef'; ctx.fillRect(0,0,W,H);

  // Leaderboard button (below grid)
  var lbbW=W*0.5,lbbH=36,lbbY=GY+GW+12;
  ctx.fillStyle='#8f7a66'; fR(W/2-lbbW/2,lbbY,lbbW,lbbH);
  ctx.fillStyle='#f9f6f2'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='bold 16px sans-serif';
  ctx.fillText('Leaderboard',W/2,lbbY+lbbH/2+1);

  // Title
  ctx.textBaseline='top'; ctx.font='bold 44px sans-serif'; ctx.textAlign='left';
  ctx.fillStyle='#776e65'; ctx.fillText('1024',P,P*0.6);
  ctx.fillStyle='#edcf72'; ctx.font='bold 24px sans-serif'; ctx.fillText('棒棒糖',P+110,P*0.6+12);

  // Score boxes
  var bx=W-P-76,by=P*0.6; sb(bx,by,'SCORE',score); sb(bx-82,by,'BEST',best);

  // Hint + New Game button
  var sy=Math.round(P*0.6+W*0.18);
  ctx.fillStyle='#776e65'; ctx.font=Math.round(W*0.035)+'px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText('Join tiles, get to 1024!',P,sy);
  ctx.fillStyle='#8f7a66'; fR(W-P-80,sy,80,30);
  ctx.fillStyle='#f9f6f2'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='bold 14px sans-serif'; ctx.fillText('New Game',W-P-40,sy+15);

  // Grid bg
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

  if(won&&!keep) drawOverlay('You Win!',false);
  else if(over) drawOverlay('Game Over',true);

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
    ctx.lineTo(cx+bw/2,cy+bh-6);
    ctx.quadraticCurveTo(cx+bw/2,cy+bh,cx+bw/2-6,cy+bh);
    ctx.lineTo(cx-bw/2+6,cy+bh);
    ctx.quadraticCurveTo(cx-bw/2,cy+bh,cx-bw/2,cy+bh-6);
    ctx.lineTo(cx-bw/2,cy+6);
    ctx.quadraticCurveTo(cx-bw/2,cy,cx-bw/2+6,cy);
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle='#776e65'; ctx.font='bold 15px sans-serif';
    ctx.fillText('Keep Going',cx,cy+bh/2+1); cy+=bh+gap;
  }
  ctx.fillStyle='#8f7a66'; fR(cx-bw/2,cy,bw,bh);
  ctx.fillStyle='#f9f6f2'; ctx.font='bold 15px sans-serif';
  ctx.fillText(isLose?'Try Again':'New Game',cx,cy+bh/2+1);
}

// ===== LEADERBOARD DRAW =====
function drawLB() {
  ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fillRect(0,0,W,H);
  var lx=W*0.08, ly=H*0.08, lw=W*0.84, lh=H*0.84;
  ctx.fillStyle='#fff'; fR(lx,ly,lw,lh);

  ctx.fillStyle='#776e65'; ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.font='bold 28px sans-serif'; ctx.fillText('Leaderboard',lx+lw/2,ly+20);

  // Close X
  ctx.font='bold 24px sans-serif'; ctx.fillStyle='#776e65';
  ctx.textAlign='right'; ctx.fillText('X',lx+lw-15,ly+10);

  if(lbLoad) {
    ctx.textAlign='center'; ctx.font='16px sans-serif'; ctx.fillStyle='#999';
    ctx.fillText('Loading...',lx+lw/2,ly+lh/2);
    return;
  }
  if(lbError) {
    ctx.textAlign='center'; ctx.font='16px sans-serif'; ctx.fillStyle='#999';
    ctx.fillText(lbError,lx+lw/2,ly+lh/2);
    return;
  }
  if(lbData.length===0) {
    ctx.textAlign='center'; ctx.font='16px sans-serif'; ctx.fillStyle='#999';
    ctx.fillText('No scores yet. Play to be #1!',lx+lw/2,ly+lh/2);
    return;
  }

  var startY=ly+70, rowH=Math.min(40,(lh-100)/Math.min(lbData.length,10));
  ctx.font='15px sans-serif';
  for(var i=0;i<Math.min(lbData.length,10);i++) {
    var item=lbData[i];
    var ry=startY+i*rowH;
    if(i%2===0) { ctx.fillStyle='#f5f2ee'; ctx.fillRect(lx+10,ry,lw-20,rowH); }
    ctx.fillStyle='#776e65'; ctx.textAlign='left'; ctx.textBaseline='middle';
    var rank=(i+1)+'.';
    var uid='User '+(item._openid||'').substring(0,8);
    ctx.fillText(rank,lx+20,ry+rowH/2);
    ctx.fillText(uid,lx+55,ry+rowH/2);
    ctx.textAlign='right';
    ctx.font='bold 16px sans-serif';
    ctx.fillText(item.score,lx+lw-20,ry+rowH/2);
    ctx.font='15px sans-serif';
  }
}

// Input
var sx=0,sy=0;
wx.onTouchStart(function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY;});
wx.onTouchEnd(function(e){
  var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
  if(Math.abs(dx)<15&&Math.abs(dy)<15){tap(e.changedTouches[0].clientX,e.changedTouches[0].clientY);return;}
  if(Math.abs(dx)>Math.abs(dy)) mv(dx>0?1:0); else mv(dy>0?3:2);
});

function tap(x,y){
  // Leaderboard button (below grid)
  var lbbW=W*0.5,lbbH=36,lbbY=GY+GW+12;
  if(x>=W/2-lbbW/2&&x<=W/2+lbbW/2&&y>=lbbY&&y<=lbbY+lbbH){
    showLB=true; lbLoad=true; draw(); loadRank(); return;
  }
  // Close leaderboard (X button)
  if(showLB){
    var lx=W*0.08,ly=H*0.08,lw=W*0.84,lh=H*0.84;
    if(y>=ly+10&&y<=ly+40&&x>=lx+lw-40&&x<=lx+lw){showLB=false;draw();return;}
    // If tapping outside leaderboard, close it
    if(x<lx||x>lx+lw||y<ly||y>ly+lh){showLB=false;draw();return;}
    return;
  }
  // New Game button (moved left to make space for leaderboard btn)
  var sy=Math.round(P*0.6+W*0.18);
  if(x>=W-P-80&&x<=W-P&&y>=sy&&y<=sy+30){reset();return;}
  // Overlay buttons
  if(won&&!keep) ovTap(x,y,false); else if(over) ovTap(x,y,true);
}

function ovTap(x,y,isLose){
  var bw=140,bh=40,gap=14,cy=GY+GW/2+20;
  if(!isLose){
    if(x>=P+GW/2-bw/2&&x<=P+GW/2+bw/2&&y>=cy&&y<=cy+bh){keep=true;draw();return;}
    cy+=bh+gap;
  }
  if(x>=P+GW/2-bw/2&&x<=P+GW/2+bw/2&&y>=cy&&y<=cy+bh){saveScore(score);reset();}
}

wx.onShow(function(){draw();});
wx.onError(function(m){console.error(m);});

initCloud();
getOpenid();
reset();