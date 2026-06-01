const SIZE = 4;
const TARGET = 1024;
let board = [];
let score = 0;
let best = localStorage.getItem('best')||0;
const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const messageEl = document.getElementById('message');
const newBtn = document.getElementById('newGame');

function init() {
  board = Array(SIZE).fill(0).map(()=>Array(SIZE).fill(0));
  score = 0;
  scoreEl.textContent = score;
  bestEl.textContent = best;
  renderGrid();
  addRandom(); addRandom();
  renderTiles();
}

function renderGrid(){
  boardEl.innerHTML = '';
  for(let i=0;i<SIZE*SIZE;i++){
    const cell = document.createElement('div');
    cell.className = 'cell';
    boardEl.appendChild(cell);
  }
}

function addRandom(){
  const empties = [];
  for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(board[r][c]===0)empties.push([r,c]);
  if(!empties.length) return false;
  const [r,c] = empties[Math.floor(Math.random()*empties.length)];
  board[r][c] = Math.random()<0.9?2:4;
  return true;
}

function renderTiles(){
  const cells = boardEl.children;
  for(let i=0;i<SIZE*SIZE;i++){ cells[i].innerHTML = ''; }
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      const v = board[r][c];
      if(v!==0){
        const tile = document.createElement('div');
        tile.className = 'tile tile-'+v;
        tile.textContent = v;
        const idx = r*SIZE+c;
        cells[idx].appendChild(tile);
      }
    }
  }
  scoreEl.textContent = score;
  bestEl.textContent = best;
}

function rotateLeft(mat){
  const n = SIZE; const res = Array(n).fill(0).map(()=>Array(n).fill(0));
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)res[n-1-c][r]=mat[r][c];
  return res;
}

function moveLeft(){
  let moved=false;
  for(let r=0;r<SIZE;r++){
    let row = board[r].filter(x=>x!==0);
    for(let i=0;i<row.length-1;i++){
      if(row[i]===row[i+1]){ row[i]*=2; score+=row[i]; row.splice(i+1,1); }
    }
    while(row.length<SIZE) row.push(0);
    for(let c=0;c<SIZE;c++){
      if(board[r][c]!==row[c]){ moved=true; board[r][c]=row[c]; }
    }
  }
  return moved;
}

function move(dir){ // 0:left,1:up,2:right,3:down
  let rotated = false; let moved=false;
  let t = board;
  if(dir===1){ t = rotateLeft(board); rotated=true; }
  else if(dir===2){ t = rotateLeft(rotateLeft(board)); }
  else if(dir===3){ t = rotateLeft(rotateLeft(rotateLeft(board))); rotated=true; }
  // operate on t as if left
  const old = JSON.stringify(t);
  // convert t into boardTemp and run moveLeft logic on rows
  let n = SIZE; let temp = JSON.parse(JSON.stringify(t));
  for(let r=0;r<n;r++){
    let row = temp[r].filter(x=>x!==0);
    for(let i=0;i<row.length-1;i++){
      if(row[i]===row[i+1]){ row[i]*=2; score+=row[i]; row.splice(i+1,1); }
    }
    while(row.length<n) row.push(0);
    temp[r]=row;
  }
  if(JSON.stringify(temp)!==old){ moved=true; }
  // rotate back to original orientation
  let result = temp;
  if(dir===1){ result = rotateLeft(rotateLeft(rotateLeft(temp))); }
  else if(dir===2){ result = rotateLeft(rotateLeft(temp)); }
  else if(dir===3){ result = rotateLeft(temp); }
  board = result;
  if(moved){ if(!addRandom()){ /* no space */ } }
  if(score>best){ best = score; localStorage.setItem('best',best); }
  return moved;
}

function checkWin(){ for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(board[r][c]>=TARGET)return true; return false; }
function hasMoves(){ for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){ if(board[r][c]===0) return true; if(c<SIZE-1 && board[r][c]===board[r][c+1]) return true; if(r<SIZE-1 && board[r][c]===board[r+1][c]) return true; } return false; }

function handleMove(dir){ if(move(dir)){ renderTiles(); if(checkWin()){ showMessage('You win! 🎉'); } else if(!hasMoves()){ showMessage('Game Over'); } }
}

function showMessage(text){ messageEl.textContent = text; messageEl.classList.remove('hidden'); }
function hideMessage(){ messageEl.classList.add('hidden'); }

document.addEventListener('keydown',e=>{
  hideMessage();
  if(e.key==='ArrowLeft') handleMove(0);
  else if(e.key==='ArrowUp') handleMove(1);
  else if(e.key==='ArrowRight') handleMove(2);
  else if(e.key==='ArrowDown') handleMove(3);
});

let touchStartX=0,touchStartY=0;
boardEl.addEventListener('touchstart',e=>{ const t=e.touches[0]; touchStartX=t.clientX; touchStartY=t.clientY; });
boardEl.addEventListener('touchend',e=>{
  const t=e.changedTouches[0]; const dx=t.clientX-touchStartX, dy=t.clientY-touchStartY;
  if(Math.abs(dx)>30 || Math.abs(dy)>30){ hideMessage(); if(Math.abs(dx)>Math.abs(dy)) dx>0?handleMove(2):handleMove(0); else dy>0?handleMove(3):handleMove(1); }
});

newBtn.addEventListener('click',()=>{ hideMessage(); init(); });

init();
