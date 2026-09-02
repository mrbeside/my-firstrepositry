// game.js — working implementation with click effects (ripple, particles, floating text, vibration, click sound)
// Restores full game logic and initializes UI handlers.

const CONFIG = {
  initialClickPower: 1,
  shop: [
    { key: 'spatula', emoji: '🥄', name: '丈夫な木べら', description: '生地をこねて、1回のタップでたくさん作りやすくします。', basePrice: 12, growth: 1.15, clickBonus: 1, autoBonus: 0, multiplierBonus: 1, effectLabel: '1個につき +1 タップ生産数' },
    { key: 'apprentice', emoji: '👩‍🍳', name: '見習い職人', description: '少しずつ丁寧に焼き上げて、毎秒お菓子を増やします。', basePrice: 35, growth: 1.18, clickBonus: 0, autoBonus: 1, multiplierBonus: 1, effectLabel: '1個につき +1 /秒' },
    { key: 'veteran', emoji: '🧑‍🍳', name: 'ベテラン職人', description: '手早く焼きながら、安定した生産量を作ります。', basePrice: 140, growth: 1.22, clickBonus: 0, autoBonus: 7, multiplierBonus: 1, effectLabel: '1個につき +7 /秒' },
    { key: 'oven', emoji: '🔥', name: '魔法のオーブン', description: '一気に焼き上げて、たくさんの菓子を作ります。', basePrice: 500, growth: 1.25, clickBonus: 0, autoBonus: 24, multiplierBonus: 1, effectLabel: '1個につき +24 /秒' },
    { key: 'dreamFactory', emoji: '🏭', name: '夢のお菓子工房', description: '工房全体の生産量を大きく伸ばす夢の設備です。', basePrice: 1800, growth: 1.28, clickBonus: 0, autoBonus: 0, multiplierBonus: 1.3, effectLabel: '1個につき +30% の自動生産ボーナス' }
  ],
  dreamFactoryBonus: 0.3,
  saveIntervalMs: 10000,
  achievementDefinitions: [
    { key: 'first-bake', title: 'はじめてのひと焼き', description: '初めてお菓子をタップして作る' },
    { key: 'hundred-bakes', title: 'お菓子100個', description: '累計100個のお菓子を作る' },
    { key: 'busy-kitchen', title: 'にぎやかな工房', description: '職人を合計5人雇う' },
    { key: 'bakery-pro', title: 'お菓子職人', description: '累計1,000個のお菓子を作る' },
    { key: 'dream-factory', title: '夢の工房', description: '夢のお菓子工房を購入する' }
  ]
};

const STORAGE_KEY = 'manmaru-bakery-save-v1';

const state = {
  points: 0,
  totalPoints: 0,
  totalClicks: 0,
  owned: {},
  achievements: {},
  lastSavedAt: Date.now()
};

const refs = {};
let lastClickPos = null;
let audioCtx = null;

function defaultOwnedState() {
  return { spatula: 0, apprentice: 0, veteran: 0, oven: 0, dreamFactory: 0 };
}

function formatNumber(v) { return Math.floor(v).toLocaleString('ja-JP'); }
function getItemByKey(k) { return CONFIG.shop.find(i => i.key === k); }

function getClickPower() {
  const spatulaItem = getItemByKey('spatula');
  return CONFIG.initialClickPower + (state.owned.spatula || 0) * spatulaItem.clickBonus;
}

function getAutoPowerFromOwned(o) {
  const owned = o || state.owned;
  const apprenticePower = (owned.apprentice || 0) * getItemByKey('apprentice').autoBonus;
  const veteranPower = (owned.veteran || 0) * getItemByKey('veteran').autoBonus;
  const ovenPower = (owned.oven || 0) * getItemByKey('oven').autoBonus;
  const base = apprenticePower + veteranPower + ovenPower;
  const dream = (owned.dreamFactory || 0);
  return base * (1 + dream * CONFIG.dreamFactoryBonus);
}

function getAutoPower() { return getAutoPowerFromOwned(state.owned); }

function getItemPrice(key) {
  const it = getItemByKey(key);
  const ownedCount = state.owned[key] || 0;
  return Math.floor(it.basePrice * Math.pow(it.growth, ownedCount));
}

function addPoints(amount, source='click') {
  const a = Math.max(0, amount);
  state.points += a;
  state.totalPoints += a;
  if (source === 'click') state.totalClicks += 1;

  if (source === 'click') {
    const x = lastClickPos ? lastClickPos.x : null;
    const y = lastClickPos ? lastClickPos.y : null;
    spawnFloatingText('+' + formatNumber(a), x, y);
    lastClickPos = null;
  }

  updateAchievements();
  renderStatus();
  renderShop();
}

function spawnFloatingText(text, clientX=null, clientY=null) {
  const el = document.createElement('div');
  el.className = 'floating-point';
  el.textContent = text;
  const root = document.getElementById('effects-root') || document.body;
  if (typeof clientX === 'number' && typeof clientY === 'number') {
    el.style.left = clientX + 'px';
    el.style.top = clientY + 'px';
  } else {
    el.style.left = '50%'; el.style.top = '50%';
  }
  root.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function createRipple(container, clientX, clientY) {
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const r = document.createElement('span');
  r.className = 'ripple';
  r.style.left = x + 'px'; r.style.top = y + 'px';
  container.appendChild(r);
  setTimeout(() => r.remove(), 700);
}

function spawnParticles(clientX, clientY, count=5) {
  const root = document.getElementById('effects-root') || document.body;
  for (let i=0;i<count;i++){
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = (clientX + (Math.random()-0.5)*24) + 'px';
    p.style.top = (clientY + (Math.random()-0.5)*12) + 'px';
    root.appendChild(p);
    const dx = (Math.random()-0.5)*120; const dy = -(Math.random()*140 + 40);
    const dur = 600 + Math.random()*300;
    p.animate([{ transform: 'translate(0,0)', opacity:1 }, { transform: `translate(${dx}px, ${dy}px)`, opacity:0 }], { duration: dur, easing: 'cubic-bezier(.2,.8,.2,1)' });
    setTimeout(()=>p.remove(), dur+50);
  }
}

function playClickSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type='sine'; o.frequency.value = 720 + Math.random()*240; g.gain.value = 0.06;
    o.connect(g); g.connect(audioCtx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    o.stop(audioCtx.currentTime + 0.06);
  } catch(e) { /* ignore */ }
}

function tryVibrate() {
  try { if (navigator.vibrate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(20); } catch(e){}
}

function showToast(msg) {
  refs.toast.textContent = msg; refs.toast.classList.add('show');
  clearTimeout(showToast.tid); showToast.tid = setTimeout(()=>refs.toast.classList.remove('show'), 1400);
}

function renderStatus(){
  refs.pointsDisplay.textContent = formatNumber(state.points);
  refs.clickPowerDisplay.textContent = formatNumber(getClickPower());
  refs.autoPowerDisplay.textContent = formatNumber(getAutoPower());
  refs.totalPointsDisplay.textContent = formatNumber(state.totalPoints);
}

function renderShop(){
  refs.shopList.innerHTML = CONFIG.shop.map(item=>{
    const owned = state.owned[item.key]||0; const price = getItemPrice(item.key); const canAfford = state.points>=price;
    return `
      <div class="shop-item">
        <div class="shop-header">
          <div class="shop-icon">${item.emoji}</div>
          <div><h3>${item.name}</h3><p>${item.description}</p></div>
        </div>
        <div class="shop-stats"><span>価格: ${formatNumber(price)}</span><span>所持: ${owned}</span><span>効果: ${item.effectLabel}</span></div>
        <button type="button" class="shop-buy ${canAfford? '':'disabled'}" data-item-key="${item.key}" ${canAfford?'':'disabled'}>${canAfford? '購入する':'お菓子不足'}</button>
      </div>`;
  }).join('');
}

function renderAchievements(){
  refs.announcement = refs.announcement; // noop to avoid unused-ref lint
  refs.achievementList.innerHTML = CONFIG.achievementDefinitions.map(a=>{
    const unlocked = !!state.achievements[a.key];
    return `<li class="achievement-item ${unlocked? 'unlocked':''}"><div class="achievement-text"><span class="achievement-name">${a.title}</span><span class="achievement-desc">${a.description}</span></div><span class="achievement-state">${unlocked? '達成':'未達成'}</span></li>`;
  }).join('');
}

function updateAchievements(){
  const totalStaff = (state.owned.apprentice||0)+(state.owned.veteran||0)+(state.owned.oven||0);
  const checks = { 'first-bake': state.totalClicks>0, 'hundred-bakes': state.totalPoints>=100, 'busy-kitchen': totalStaff>=5, 'bakery-pro': state.totalPoints>=1000, 'dream-factory': (state.owned.dreamFactory||0)>0 };
  Object.entries(checks).forEach(([k,c])=>{ if(c && !state.achievements[k]){ state.achievements[k]=true; showToast('実績達成: '+ (CONFIG.achievementDefinitions.find(x=>x.key===k)||{}).title || k); } });
  renderAchievements();
}

function buyItem(key){ const item=getItemByKey(key); const price=getItemPrice(key); if(state.points<price) return; state.points-=price; state.owned[key]=(state.owned[key]||0)+1; saveGame(); updateAchievements(); renderStatus(); renderShop(); showToast(`${item.name} を購入しました`); }

function saveGame(){ try{ const data = { points: state.points, totalPoints: state.totalPoints, totalClicks: state.totalClicks, owned: state.owned, achievements: state.achievements, lastSavedAt: Date.now() }; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }catch(e){} }
function loadGame(){ try{ const raw = localStorage.getItem(STORAGE_KEY); if(!raw) return; const parsed = JSON.parse(raw); state.points = Number(parsed.points||0); state.totalPoints = Number(parsed.totalPoints||0); state.totalClicks = Number(parsed.totalClicks||0); state.owned = Object.assign(defaultOwnedState(), parsed.owned||{}); state.achievements = parsed.achievements||{}; }catch(e){} }

function attachHandlers(){
  refs.bakeryButton.addEventListener('pointerdown', (ev)=>{
    lastClickPos = { x: ev.clientX, y: ev.clientY };
    createRipple(refs.bakeryButton, ev.clientX, ev.clientY);
    spawnParticles(ev.clientX, ev.clientY, 5);
    playClickSound();
    tryVibrate();
    addPoints(getClickPower(), 'click');
  });

  refs.shopList.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('.shop-buy'); if(!btn) return; const key = btn.dataset.itemKey; buyItem(key);
  });

  refs.resetButton.addEventListener('click', ()=>{ refs.resetModal.classList.remove('hidden'); refs.resetModal.setAttribute('aria-hidden','false'); });
  refs.cancelReset.addEventListener('click', ()=>{ refs.resetModal.classList.add('hidden'); refs.resetModal.setAttribute('aria-hidden','true'); });
  refs.confirmReset.addEventListener('click', ()=>{ localStorage.removeItem(STORAGE_KEY); location.reload(); });
}

function init(){
  refs.pointsDisplay = document.getElementById('pointsDisplay');
  refs.clickPowerDisplay = document.getElementById('clickPowerDisplay');
  refs.autoPowerDisplay = document.getElementById('autoPowerDisplay');
  refs.totalPointsDisplay = document.getElementById('totalPointsDisplay');
  refs.bakeryButton = document.getElementById('bakeryButton');
  refs.shopList = document.getElementById('shopList');
  refs.achievementList = document.getElementById('achievementList');
  refs.toast = document.getElementById('toast');
  refs.resetButton = document.getElementById('resetButton');
  refs.resetModal = document.getElementById('resetModal');
  refs.confirmReset = document.getElementById('confirmReset');
  refs.cancelReset = document.getElementById('cancelReset');

  loadGame();
  if(!state.owned || Object.keys(state.owned).length===0) state.owned = defaultOwnedState();

  renderStatus(); renderShop(); renderAchievements();
  attachHandlers();

  setInterval(()=>{ const ap = getAutoPower(); if(ap>0){ addPoints(ap, 'auto'); saveGame(); } }, 1000);
  setInterval(()=>saveGame(), CONFIG.saveIntervalMs);
}

window.addEventListener('DOMContentLoaded', init);
