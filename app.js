// Meet at the Park — Multi-level platformer
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const bg = document.getElementById('bg');
const sJump = document.getElementById('sJump');
const sWin = document.getElementById('sWin');
const sHit = document.getElementById('sHit');
const muteBtn = document.getElementById('mute');
const startBtn = document.getElementById('startBtn');
const charSelect = document.getElementById('charSelect');
const levelNumEl = document.getElementById('levelNum');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');

let muted=false; muteBtn.onclick = ()=> { muted=!muted; [bg,sJump,sWin,sHit].forEach(a=>a.muted=muted); muteBtn.textContent = muted ? '🔇' : '🔊'; };

const GRAV = 1500;
const PLAYER_SPEED = 220;
const JUMP_V = -520;
const TILE = 40;
const WIDTH = canvas.width, HEIGHT = canvas.height;

let playerChar = 'boy';
let levelIndex = 0;
let levels = [];
let player, target, obstacles, platforms, spikes, lives, score, running;

// Define levels — each level increases obstacle count and complexity
function createLevels(){
  // Each level: width in tiles, platform definitions, moving obstacles, spikes
  levels = [
    // Level 1: simple ground and a platform, target on right
    {w:22, platforms:[{x:0,y:10,w:22,h:2},{x:14,y:7,w:4,h:1}], spikes:[], movers:[]},
    // Level 2: more platforms, one moving obstacle
    {w:24, platforms:[{x:0,y:10,w:24,h:2},{x:6,y:8,w:4,h:1},{x:12,y:6,w:4,h:1}], spikes:[{x:9,y:9,w:1}], movers:[{x:16,y:8,w:1,h:1,dir:-1,range:3,speed:1}]},
    // Level 3: gaps and multiple spikes
    {w:26, platforms:[{x:0,y:10,w:6,h:2},{x:8,y:9,w:4,h:1},{x:14,y:7,w:4,h:1},{x:20,y:9,w:6,h:1}], spikes:[{x:6,y:11,w:2},{x:18,y:11,w:1}], movers:[{x:11,y:8,w:1,h:1,dir:1,range:4,speed:1.2}]},
    // Level 4: moving platforms + faster movers
    {w:28, platforms:[{x:0,y:10,w:4,h:2},{x:6,y:8,w:4,h:1},{x:12,y:6,w:4,h:1},{x:18,y:8,w:4,h:1},{x:24,y:9,w:4,h:1}], spikes:[{x:4,y:11,w:1},{x:22,y:11,w:2}], movers:[{x:9,y:7,w:1,h:1,dir:1,range:6,speed:1.6},{x:20,y:7,w:1,h:1,dir:-1,range:5,speed:1.4}]},
    // Level 5: denser obstacles — ultimate challenge
    {w:30, platforms:[{x:0,y:10,w:3,h:2},{x:4,y:9,w:3,h:1},{x:8,y:8,w:3,h:1},{x:12,y:7,w:3,h:1},{x:16,y:8,w:3,h:1},{x:20,y:9,w:3,h:1},{x:24,y:8,w:3,h:1},{x:27,y:9,w:3,h:1}], spikes:[{x:3,y:11,w:1},{x:11,y:11,w:2},{x:19,y:11,w:1},{x:25,y:11,w:1}], movers:[{x:6,y:7,w:1,h:1,dir:1,range:7,speed:1.8},{x:14,y:6,w:1,h:1,dir:-1,range:6,speed:1.6},{x:22,y:7,w:1,h:1,dir:1,range:5,speed:1.4}]}
  ];
}

createLevels();

function startLevel(idx){
  levelIndex = idx;
  const L = levels[levelIndex];
  // world units
  const worldW = L.w * TILE;
  // create player and target positions
  player = {x: TILE*1.5, y: HEIGHT - TILE*3, w:32, h:48, vx:0, vy:0, onGround:false};
  target = {x: worldW - TILE*2, y: HEIGHT - TILE*3, w:32, h:48};
  // build platforms and spikes in pixel coords
  platforms = [];
  spikes = [];
  for (let p of L.platforms){
    platforms.push({x:p.x*TILE, y: p.y*TILE, w: p.w*TILE, h: p.h*TILE});
  }
  for (let s of (L.spikes||[])){
    spikes.push({x:s.x*TILE, y:s.y*TILE, w:s.w*TILE, h:TILE/2});
  }
  // movers are simple horizontal obstacles
  obstacles = [];
  for (let m of (L.movers||[])){
    obstacles.push({x:m.x*TILE, y:m.y*TILE, w:m.w*TILE, h:m.h*TILE, dir:m.dir, range:m.range*TILE, baseX:m.x*TILE, speed:m.speed});
  }
  lives = 3;
  score = 0;
  running = true;
  levelNumEl.textContent = levelIndex+1;
  document.getElementById('score').textContent = score;
  document.getElementById('lives').textContent = lives;
  // start music
  try{ bg.play().catch(()=>{});}catch{}
}

// simple camera follow, clamp to world
function worldToScreen(x){ return x; }

// input
const keys = {};
window.addEventListener('keydown', e=> keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e=> keys[e.key.toLowerCase()] = false);
document.getElementById('startBtn').addEventListener('click', ()=> { playerChar = charSelect.value; startLevel(0); });

function update(dt){
  if (!running) return;
  // controls: left/right/jump
  player.vx = 0;
  if (keys['a'] || keys['arrowleft']) player.vx = -PLAYER_SPEED;
  if (keys['d'] || keys['arrowright']) player.vx = PLAYER_SPEED;
  if ((keys['w'] || keys['arrowup'] || keys[' ']) && player.onGround){ player.vy = JUMP_V; player.onGround=false; sJump.currentTime=0; try{sJump.play().catch(()=>{})}catch{}; }
  // apply physics
  player.vy += GRAV * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  // simple collision with platforms
  player.onGround = false;
  for (let p of platforms){
    if (rectsOverlap(player, p)){
      // collide from top?
      if (player.vy > 0 && (player.y + player.h) - p.y < 40){
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      } else if (player.vy < 0 && p.y + p.h - player.y < 40){
        player.y = p.y + p.h; player.vy = 0;
      }
    }
  }
  // world floor fallback
  if (player.y + player.h > HEIGHT){ player.y = HEIGHT - player.h; player.vy = 0; player.onGround = true; }
  // update obstacles (movers)
  for (let o of obstacles){
    o.baseX += 0; // base static
    o.x += o.dir * o.speed * TILE * dt;
    if (Math.abs(o.x - o.baseX) > o.range){ o.dir *= -1; }
  }
  // collisions with spikes or obstacles
  for (let s of spikes){
    if (rectsOverlap(player, s)){ loseLife(); return; }
  }
  for (let o of obstacles){
    if (rectsOverlap(player, o)){ loseLife(); return; }
  }
  // check if reached target (simple proximity)
  if (player.x + player.w > target.x){
    levelWin();
  }
}

function loseLife(){
  lives -= 1; document.getElementById('lives').textContent = lives;
  sHit.currentTime = 0; try{sHit.play().catch(()=>{})}catch{};
  if (lives <= 0){
    running = false;
    alert('You lost all lives. Restarting level.');
    startLevel(levelIndex);
  } else {
    // reset player to start
    player.x = TILE*1.5; player.y = HEIGHT - TILE*3;
    player.vx = player.vy = 0;
  }
}

function levelWin(){
  sWin.currentTime = 0; try{sWin.play().catch(()=>{})}catch{};
  score += 100 * (levelIndex+1);
  document.getElementById('score').textContent = score;
  // advance level or show complete
  if (levelIndex < levels.length - 1){
    setTimeout(()=> startLevel(levelIndex+1), 800);
  } else {
    running = false;
    alert('All levels complete — you reunited!');
  }
}

function rectsOverlap(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function draw(){
  // clear
  ctx.clearRect(0,0,canvas.width, canvas.height);
  // draw background park
  // sky gradient drawn via CSS background of canvas; draw ground
  ctx.fillStyle = '#a3d39c';
  ctx.fillRect(0, HEIGHT - TILE*2, canvas.width, TILE*2);
  // draw platforms
  ctx.fillStyle = '#6b3e2e';
  for (let p of platforms){
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // draw spikes
  ctx.fillStyle = '#222';
  for (let s of spikes){
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }
  // draw movers (red boxes)
  ctx.fillStyle = '#b33';
  for (let o of obstacles){
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }
  // draw target (other character) — stylized
  drawCharacter(target.x, target.y, 'other');
  // draw player
  drawCharacter(player.x, player.y, playerChar);
}

function drawCharacter(x,y,type){
  const cx = x + 16, cy = y + 24;
  // head
  ctx.fillStyle = (type==='boy')? '#ffdcb3' : (type==='girl')? '#ffd0e1' : '#fff2c8';
  ctx.beginPath(); ctx.ellipse(cx, cy-18, 12, 12, 0, 0, Math.PI*2); ctx.fill();
  // body
  ctx.fillStyle = (type==='boy')? '#4aa3e0' : (type==='girl')? '#d86aa6' : '#8ec6ff';
  ctx.fillRect(x+6, y+6, 28, 36);
  // simple eyes/mouth
  ctx.fillStyle = '#000'; ctx.fillRect(cx-4, cy-22, 3,3); ctx.fillRect(cx+2, cy-22, 3,3);
  ctx.fillRect(cx-3, cy-12, 6,2);
}

// game loop
let last = performance.now();
function loop(t){
  const now = t || performance.now();
  const dt = Math.min(0.05, (now - last)/1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// service: allow starting at specific level via UI
// start at level 0 by default
startLevel(0);