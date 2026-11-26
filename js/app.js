/* ======================== CORE APP & STATE ======================== */
const SESSION_KEY = 'cauca_session_v3';
const LEGACY_KEY  = 'cauca_trieutam_v1';

let session = null; // { mode: 'admin' | 'guest' | 'user', username, displayName }
let authTab = 'login';
let cloudSyncTimer = null;
let lbSort = 'total_earned';
let adminGodMode = false;
let bagSortDesc = true;
let dexMapFilter = 'all';

// Combo & Fever Mode
let catchStreak = 0;
let feverTimeLeft = 0;

function sbHeaders(extra = {}) {
  const h = { apikey: SUPABASE_KEY, ...extra };
  if (SUPABASE_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SUPABASE_KEY}`;
  return h;
}

function defaultState() {
  return {
    gold: 200,
    gems: 25,
    keys: 2,
    level: 1,
    xp: 0,
    mapId: 'pond',
    mapsUnlocked: ['pond'],
    rodId: 'bamboo',
    rodsOwned: ['bamboo'],
    rodStars: {},
    baitId: 'worm',
    baitCounts: { worm: 999999, bran: 5 },
    upgrades: { bag: 0, speed: 0, price: 0, auto: 0 },
    bag: [],
    dex: {},
    bossLog: {},
    claimedQuests: [],
    redeemedCodes: [],
    dailyStreak: 0,
    lastDailyDate: '',
    gachaPity: 0,
    stats: {
      totalCaught: 0,
      totalEarned: 0,
      rareCaught: 0,
      legendCaught: 0,
      bossesKilled: 0,
      gachaPulls: 0,
      bestStreak: 0
    },
    sound: true,
    vibrate: true,
    autoFish: false,
    autoSellLow: false
  };
}

// Dữ liệu Full Max cho Tài khoản Admin Offline (Không cần Supabase)
function createAdminState() {
  const allRods = RODS.map(r => r.id);
  const allStars = {};
  RODS.forEach(r => { allStars[r.id] = 5; });

  const allBaits = { worm: 999999 };
  BAITS.forEach(b => { if (!b.infinite) allBaits[b.id] = 99999; });

  const maxUpgrades = {};
  UPGRADES.forEach(u => { maxUpgrades[u.id] = u.maxLv; });

  const fullDex = {};
  FISH_DB.forEach(f => { fullDex[f.id] = { count: 99, maxW: f.maxW }; });

  return {
    ...defaultState(),
    gold: 999999999,
    gems: 999999,
    keys: 9999,
    level: 99,
    xp: 0,
    mapId: 'trench',
    mapsUnlocked: MAPS.map(m => m.id),
    rodId: 'g_dragon',
    rodsOwned: allRods,
    rodStars: allStars,
    baitId: 'mystic',
    baitCounts: allBaits,
    upgrades: maxUpgrades,
    dex: fullDex,
    stats: {
      totalCaught: 999,
      totalEarned: 999999999,
      rareCaught: 500,
      legendCaught: 100,
      bossesKilled: 50,
      gachaPulls: 100,
      bestStreak: 99
    }
  };
}

let state = defaultState();

function normalizeState(raw) {
  const def = defaultState();
  const p = raw || {};
  return {
    ...def,
    ...p,
    upgrades: { ...def.upgrades, ...(p.upgrades || {}) },
    stats: { ...def.stats, ...(p.stats || {}) },
    baitCounts: { ...def.baitCounts, ...(p.baitCounts || {}) },
    rodStars: { ...(p.rodStars || {}) },
    bossLog: { ...(p.bossLog || {}) },
    bag: Array.isArray(p.bag) ? p.bag : [],
    claimedQuests: Array.isArray(p.claimedQuests) ? p.claimedQuests : [],
    redeemedCodes: Array.isArray(p.redeemedCodes) ? p.redeemedCodes : [],
    mapsUnlocked: Array.isArray(p.mapsUnlocked) && p.mapsUnlocked.length ? p.mapsUnlocked : ['pond'],
    rodsOwned: Array.isArray(p.rodsOwned) && p.rodsOwned.length ? p.rodsOwned : ['bamboo']
  };
}

function getSaveKey(sess = session) {
  if (!sess || sess.mode === 'guest') return 'cauca_save_guest';
  if (sess.mode === 'admin') return 'cauca_save_admin_offline';
  return 'cauca_save_user_' + sess.username;
}

async function hashPassword(password, salt) {
  const text = `cauca_salt_${salt}_${password}`;
  if (window.crypto && window.crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'fb_' + (h >>> 0).toString(16);
}

// Base64 UTF-8 an toàn cho mã sao lưu
function encodeSaveB64(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function decodeSaveB64(str) {
  const bin = atob(str.trim());
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/* ======================== SUPABASE CLOUD HELPERS ======================== */
async function parseSupabaseError(res) {
  try {
    const j = await res.json();
    if (j?.code === '42P01' || j?.code === 'PGRST205') {
      return 'Chưa tạo bảng fishing_accounts trên Supabase. Hãy chạy đoạn SQL tạo bảng trước.';
    }
    return j?.message || `Lỗi máy chủ (${res.status})`;
  } catch {
    return `Lỗi kết nối (${res.status})`;
  }
}

async function cloudFetchAccount(username) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/fishing_accounts?username=eq.${encodeURIComponent(username)}&select=username,display_name,pass_hash,save_data`,
    { headers: sbHeaders() }
  );
  if (!res.ok) throw new Error(await parseSupabaseError(res));
  const rows = await res.json();
  return rows[0] || null;
}

async function cloudCreateAccount(username, displayName, passHash, saveData) {
  const rod = RODS.find(r => r.id === saveData.rodId) || RODS[0];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/fishing_accounts`, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({
      username,
      display_name: displayName,
      pass_hash: passHash,
      level: saveData.level || 1,
      total_earned: Math.floor(saveData.stats?.totalEarned || 0),
      bosses_killed: saveData.stats?.bossesKilled || 0,
      rod_icon: rod.icon,
      save_data: saveData,
      updated_at: new Date().toISOString()
    })
  });
  if (!res.ok) throw new Error(await parseSupabaseError(res));
}

async function cloudSaveState(immediate = false) {
  if (!CLOUD_ENABLED || !session || session.mode !== 'user') return;
  const run = async () => {
    try {
      const rod = RODS.find(r => r.id === state.rodId) || RODS[0];
      await fetch(`${SUPABASE_URL}/rest/v1/fishing_accounts?username=eq.${encodeURIComponent(session.username)}`, {
        method: 'PATCH',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({
          display_name: session.displayName,
          level: state.level || 1,
          total_earned: Math.floor(state.stats?.totalEarned || 0),
          bosses_killed: state.stats?.bossesKilled || 0,
          rod_icon: rod.icon,
          save_data: state,
          updated_at: new Date().toISOString()
        })
      });
    } catch {}
  };
  if (immediate) {
    clearTimeout(cloudSyncTimer);
    return run();
  }
  clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(run, 1600);
}

async function cloudFetchLeaderboard(sortBy = 'total_earned') {
  const allowed = ['total_earned', 'level', 'bosses_killed'];
  const col = allowed.includes(sortBy) ? sortBy : 'total_earned';
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/fishing_accounts?select=username,display_name,level,total_earned,bosses_killed,rod_icon&order=${col}.desc,level.desc&limit=30`,
    { headers: sbHeaders() }
  );
  if (!res.ok) throw new Error(await parseSupabaseError(res));
  return res.json();
}

function loadStateForSession(sess) {
  if (sess.mode === 'admin') {
    try {
      const raw = localStorage.getItem(getSaveKey(sess));
      return raw ? normalizeState(JSON.parse(raw)) : createAdminState();
    } catch {
      return createAdminState();
    }
  }
  if (sess.mode === 'guest' && !localStorage.getItem('cauca_save_guest') && localStorage.getItem(LEGACY_KEY)) {
    localStorage.setItem('cauca_save_guest', localStorage.getItem(LEGACY_KEY));
  }
  try {
    const raw = localStorage.getItem(getSaveKey(sess));
    return raw ? normalizeState(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState(syncNow = false) {
  if (!session) return;
  try {
    localStorage.setItem(getSaveKey(session), JSON.stringify(state));
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
  if (session.mode === 'user') cloudSaveState(syncNow);
}

/* ======================== AUTH HANDLERS ======================== */
function setAuthError(msg) {
  const el = document.getElementById('authError');
  if (!el) return;
  if (!msg) { el.style.display = 'none'; el.textContent = ''; return; }
  el.style.display = 'block';
  el.textContent = msg;
}

function switchAuthTab(tab) {
  authTab = tab;
  setAuthError('');
  document.getElementById('tabLoginBtn').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegBtn').classList.toggle('active', tab === 'register');
  document.getElementById('authDisplayWrap').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('authConfirmWrap').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('authSubmitBtn').textContent = tab === 'register' ? '✨ TẠO TÀI KHOẢN & CHƠI' : '🚀 ĐĂNG NHẬP';
}

function validateUsername(u) { return /^[a-z0-9_]{3,20}$/.test(u); }

async function submitAuthForm(e) {
  e.preventDefault();
  setAuthError('');
  const username = document.getElementById('authUser').value.trim().toLowerCase();
  const displayName = (document.getElementById('authDisplay').value.trim() || username).slice(0, 20);
  const pass = document.getElementById('authPass').value;
  const confirmPass = document.getElementById('authConfirm').value;

  // Đăng nhập Tài khoản Admin Offline (Bỏ qua Supabase hoàn toàn)
  if (authTab === 'login' && username === BUILTIN_ADMIN.username) {
    if (pass !== BUILTIN_ADMIN.password) {
      return setAuthError('Sai mật khẩu tài khoản Admin.');
    }
    session = { mode: 'admin', username: BUILTIN_ADMIN.username, displayName: BUILTIN_ADMIN.displayName };
    state = loadStateForSession(session);
    saveState();
    return finishAuthEnter('👑 Đã đăng nhập Tài Khoản ADMIN Full Đồ (Offline)!');
  }

  if (authTab === 'register' && username === BUILTIN_ADMIN.username) {
    return setAuthError('Tên đăng nhập "admin" đã được dành riêng cho hệ thống.');
  }
  if (!validateUsername(username)) {
    return setAuthError('Tên đăng nhập chỉ gồm chữ thường, số, dấu gạch dưới (3-20 ký tự).');
  }
  if (pass.length < 4) {
    return setAuthError('Mật khẩu phải có ít nhất 4 ký tự.');
  }

  const btn = document.getElementById('authSubmitBtn');
  const oldLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Đang kết nối máy chủ...';

  try {
    const passHash = await hashPassword(pass, username);
    if (authTab === 'register') {
      if (pass !== confirmPass) { setAuthError('Mật khẩu nhập lại không khớp.'); return; }
      const exists = await cloudFetchAccount(username);
      if (exists) { setAuthError('Tên đăng nhập này đã tồn tại, hãy chọn tên khác.'); return; }
      const initialSave = defaultState();
      await cloudCreateAccount(username, displayName, passHash, initialSave);
      session = { mode: 'user', username, displayName };
      state = initialSave;
      saveState(true);
      finishAuthEnter(`🎉 Tạo tài khoản ${displayName} thành công!`);
    } else {
      const row = await cloudFetchAccount(username);
      if (!row || row.pass_hash !== passHash) {
        setAuthError('Sai tên đăng nhập hoặc mật khẩu.');
        return;
      }
      session = { mode: 'user', username: row.username, displayName: row.display_name || row.username };
      state = normalizeState(row.save_data);
      saveState();
      finishAuthEnter(`👋 Chào mừng trở lại, ${session.displayName}!`);
    }
  } catch (err) {
    setAuthError(err.message || 'Không thể kết nối Supabase.');
  } finally {
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
}

function enterGuestMode() {
  session = { mode: 'guest', username: 'guest', displayName: 'Khách' };
  state = loadStateForSession(session);
  saveState();
  finishAuthEnter('👤 Đang chơi ở Chế Độ Khách!');
}

function finishAuthEnter(msg) {
  document.getElementById('authOverlay').classList.remove('show');
  document.getElementById('authPass').value = '';
  document.getElementById('authConfirm').value = '';
  activeBoss = null;
  nextBossCountdown = 40;
  phase = 'IDLE';
  currentBossFight = false;
  catchStreak = 0;
  feverTimeLeft = 0;
  clearBiteAlert();
  Scene3D.setMap(getMap());
  updateHud();
  updateBossUI();
  updateActionBtn();
  showToast(msg, '#10b981');
}

function logoutToAuth(targetTab = 'login') {
  saveState(true);
  localStorage.removeItem(SESSION_KEY);
  session = null;
  adminGodMode = false;
  activeBoss = null;
  currentBossFight = false;
  phase = 'IDLE';
  isHolding = false;
  catchStreak = 0;
  feverTimeLeft = 0;
  clearBiteAlert();
  document.getElementById('minigameBox').classList.remove('show', 'boss-mode');
  closeCatchCard();
  closeDrawer();
  switchAuthTab(targetTab);
  document.getElementById('authOverlay').classList.add('show');
}

async function upgradeGuestToAccount(e) {
  e.preventDefault();
  const username = document.getElementById('upUser').value.trim().toLowerCase();
  const displayName = (document.getElementById('upDisplay').value.trim() || username).slice(0, 20);
  const pass = document.getElementById('upPass').value;

  if (username === BUILTIN_ADMIN.username) return showToast('Không thể dùng tên admin!', '#f43f5e');
  if (!validateUsername(username)) return showToast('Tên đăng nhập 3-20 ký tự (a-z, 0-9, _)!', '#f43f5e');
  if (pass.length < 4) return showToast('Mật khẩu phải từ 4 ký tự trở lên!', '#f43f5e');

  try {
    const passHash = await hashPassword(pass, username);
    const exists = await cloudFetchAccount(username);
    if (exists) return showToast('Tên đăng nhập đã có người dùng!', '#f43f5e');
    await cloudCreateAccount(username, displayName, passHash, state);
    session = { mode: 'user', username, displayName };
    saveState(true);
    updateHud();
    renderDrawer();
    sfx.catch();
    showToast(`✅ Đã đồng bộ tài khoản @${username} lên Cloud!`, '#10b981');
  } catch (err) {
    showToast(`❌ ${err.message || 'Lỗi tạo tài khoản!'}`, '#f43f5e');
  }
}

async function updateDisplayName() {
  if (!session || session.mode !== 'user') return;
  const newName = document.getElementById('editDisplayName').value.trim().slice(0, 20);
  if (!newName) return showToast('Tên hiển thị không được trống!', '#f43f5e');
  session.displayName = newName;
  saveState(true);
  updateHud();
  renderDrawer();
  showToast('✅ Đã đổi tên hiển thị lên Cloud!', '#10b981');
}

async function changePassword() {
  if (!session || session.mode !== 'user') return;
  const newPass = document.getElementById('editNewPass').value;
  if (newPass.length < 4) return showToast('Mật khẩu mới tối thiểu 4 ký tự!', '#f43f5e');
  try {
    const passHash = await hashPassword(newPass, session.username);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/fishing_accounts?username=eq.${encodeURIComponent(session.username)}`, {
      method: 'PATCH',
      headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ pass_hash: passHash, updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error(await parseSupabaseError(res));
    document.getElementById('editNewPass').value = '';
    showToast('🔒 Đã cập nhật mật khẩu thành công!', '#10b981');
  } catch (err) {
    showToast(`❌ ${err.message}`, '#f43f5e');
  }
}

/* ======================== AUDIO & HAPTICS ======================== */
let audioCtx = null;
function ensureAudio() {
  if (!state.sound) return null;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, dur = 0.12, type = 'sine', vol = 0.12, slideTo = null) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

function vibrateDevice(pattern) {
  if (state.vibrate && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch {}
  }
}

const sfx = {
  cast: () => playTone(520, 0.22, 'triangle', 0.12, 180),
  splash: () => playTone(210, 0.18, 'sawtooth', 0.08, 90),
  bite: () => {
    vibrateDevice([45, 35, 65]);
    playTone(880, 0.1, 'square', 0.11);
    setTimeout(() => playTone(1174, 0.16, 'square', 0.11), 90);
  },
  catch: () => {
    vibrateDevice(40);
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 0.16, 'triangle', 0.13), i * 65));
  },
  fever: () => {
    vibrateDevice([40, 30, 80]);
    [659, 784, 987, 1318, 1568].forEach((f, i) => setTimeout(() => playTone(f, 0.16, 'sine', 0.14), i * 55));
  },
  fail: () => playTone(280, 0.22, 'sawtooth', 0.1, 110),
  coin: () => {
    playTone(987, 0.08, 'sine', 0.1);
    setTimeout(() => playTone(1318, 0.14, 'sine', 0.1), 65);
  },
  bossAlert: () => {
    vibrateDevice([90, 50, 90, 50, 120]);
    [220, 185, 220, 146].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sawtooth', 0.12), i * 140));
  },
  bossWin: () => {
    vibrateDevice([60, 40, 120]);
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => playTone(f, 0.22, 'triangle', 0.15), i * 85));
  },
  gachaSpin: () => {
    [330, 440, 554, 659, 880].forEach((f, i) => setTimeout(() => playTone(f, 0.09, 'sine', 0.1), i * 75));
  },
  gachaEpic: () => {
    vibrateDevice([50, 30, 100]);
    [587, 880, 1174, 1760].forEach((f, i) => setTimeout(() => playTone(f, 0.22, 'triangle', 0.15), i * 80));
  }
};

/* ======================== HELPERS & 2D FX OVERLAY ======================== */
const fmt = n => Math.floor(n || 0).toLocaleString('vi-VN');
const getBait = () => BAITS.find(b => b.id === state.baitId) || BAITS[0];
const getMap = () => MAPS.find(m => m.id === state.mapId) || MAPS[0];
const getBagCap = () => 15 + state.upgrades.bag * 5;
const xpNeeded = lv => Math.floor(80 * Math.pow(1.38, lv - 1));
const todayKey = () => new Date().toISOString().slice(0, 10);

function getRodStats(rodId = state.rodId) {
  const base = RODS.find(r => r.id === rodId) || RODS[0];
  const stars = state.rodStars[base.id] || 0;
  return {
    ...base,
    stars,
    luck: Math.round(base.luck * (1 + stars * 0.15) + stars * 6),
    power: +(base.power * (1 + stars * 0.18)).toFixed(2),
    bossDmg: +(base.bossDmg * (1 + stars * 0.20)).toFixed(2),
    barWidth: Math.min(56, base.barWidth + stars * 1.5)
  };
}

function showToast(msg, borderColor = '#00f3ff') {
  const box = document.getElementById('toastBox');
  if (!box) return;
  while (box.children.length >= 3) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.style.borderColor = borderColor;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 2900);
}

function spawnFloatText(wx, wy, wz, text, color = '#fbbf24', size = '18px') {
  const pt = Scene3D.projectToScreen(wx, wy, wz);
  const el = document.createElement('div');
  el.className = 'fx-float';
  el.style.left = pt.x + 'px';
  el.style.top = pt.y + 'px';
  el.style.color = color;
  el.style.fontSize = size;
  el.textContent = text;
  document.getElementById('fxLayer').appendChild(el);
  setTimeout(() => el.remove(), 860);
}

let biteAlertEl = null;
function showBiteAlert(wx, wz) {
  clearBiteAlert();
  const pt = Scene3D.projectToScreen(wx, 1.15, wz);
  biteAlertEl = document.createElement('div');
  biteAlertEl.className = 'fx-bite-alert';
  biteAlertEl.style.left = pt.x + 'px';
  biteAlertEl.style.top = pt.y + 'px';
  biteAlertEl.textContent = '❗';
  document.getElementById('fxLayer').appendChild(biteAlertEl);
}

function syncBiteAlertPosition() {
  if (!biteAlertEl || phase !== 'BITING') return;
  const pt = Scene3D.projectToScreen(bobberX, 1.15, bobberZ);
  biteAlertEl.style.left = pt.x + 'px';
  biteAlertEl.style.top = pt.y + 'px';
}

function clearBiteAlert() {
  if (biteAlertEl) { biteAlertEl.remove(); biteAlertEl = null; }
}

function addXp(amount) {
  state.xp += amount;
  let leveledUp = false;
  while (state.xp >= xpNeeded(state.level)) {
    state.xp -= xpNeeded(state.level);
    state.level++;
    state.gems += 5;
    leveledUp = true;
    showToast(`🎉 Lên cấp ${state.level}! Thưởng +5 💎`, '#fbbf24');
  }
  if (leveledUp) sfx.catch();
}

/* ======================== BOSS EVENT SYSTEM ======================== */
let activeBoss = null; // { data, hp, maxHp, timeLeft, wx, wz }
let nextBossCountdown = 40;
let dmgPopupAccum = 0;

function spawnBoss(specificBossId = null) {
  if (activeBoss || !session) return;
  let picked = specificBossId ? BOSS_DB.find(b => b.id === specificBossId) : null;
  if (!picked) {
    const eligible = BOSS_DB.filter(b => b.minLv <= state.level + 2);
    picked = eligible[Math.floor(Math.random() * eligible.length)] || BOSS_DB[0];
  }
  const scale = 1 + Math.max(0, state.level - picked.minLv) * 0.06;
  const maxHp = Math.round(picked.hp * scale);

  activeBoss = { data: picked, hp: maxHp, maxHp, timeLeft: 65, wx: 7.2, wz: -0.6 };
  Scene3D.triggerLightning();
  Scene3D.spawnSplash(7.2, -0.6, 18);
  sfx.bossAlert();
  showToast(`🚨 CẢNH BÁO 3D: ${picked.emoji} ${picked.name} vừa trồi lên mặt nước!`, '#f43f5e');
  updateBossUI();
  updateActionBtn();
}

function summonBossWithGems() {
  if (activeBoss) return showToast('Đang có Boss Thủy Quái xuất hiện rồi!', '#fbbf24');
  if (state.gems < 5) return showToast('Cần 5 💎 để triệu hồi Thủy Quái!', '#f43f5e');
  state.gems -= 5;
  saveState(true);
  closeDrawer();
  spawnBoss();
  updateHud();
}

function engageBoss() {
  if (!activeBoss) return;
  if (phase === 'REELING' && currentBossFight) return;
  closeCatchCard();
  clearBiteAlert();
  currentBossFight = true;
  currentFish = null;
  dmgPopupAccum = 0;

  const rod = getRodStats();
  phase = 'REELING';
  bobberX = activeBoss.wx;
  bobberZ = activeBoss.wz;
  mg.barWidth = Math.min(56, rod.barWidth);
  mg.barPos = 50 - mg.barWidth / 2;
  mg.barVel = 0;
  mg.fishPos = 50;
  mg.fishTarget = 20 + Math.random() * 60;
  mg.fishMoveTimer = 0.35;
  mg.progress = 58;

  const mgBox = document.getElementById('minigameBox');
  mgBox.classList.add('show', 'boss-mode');
  document.getElementById('mgFish').textContent = activeBoss.data.emoji;
  document.getElementById('mgHint').textContent = '⚔️ GIỮ BOSS TRONG VÙNG XANH ĐỂ GÂY SÁT THƯƠNG!';
  Scene3D.spawnSplash(bobberX, bobberZ, 16);
  sfx.splash();
  updateActionBtn();
}

function defeatBoss() {
  if (!activeBoss) return;
  const b = activeBoss.data;
  const bx = activeBoss.wx;
  const bz = activeBoss.wz;

  document.getElementById('minigameBox').classList.remove('show', 'boss-mode');
  isHolding = false;
  currentBossFight = false;
  phase = 'IDLE';

  const feverBoost = feverTimeLeft > 0 ? 1.3 : 1;
  const earnedGold = Math.round(b.rewardGold * (1 + getRodStats().goldBonus) * feverBoost);
  state.gold += earnedGold;
  state.gems += b.rewardGems;
  state.keys += b.rewardKeys;
  state.stats.totalEarned += earnedGold;
  state.stats.bossesKilled++;
  state.bossLog[b.id] = (state.bossLog[b.id] || 0) + 1;
  addXp(b.xp);

  Scene3D.spawnSplash(bx, bz, 28);
  spawnFloatText(bx, 2.2, bz, `🏆 +${fmt(earnedGold)}🪙 +${b.rewardKeys}🔑`, '#fbbf24', '20px');
  activeBoss = null;
  nextBossCountdown = 65 + Math.floor(Math.random() * 45);
  sfx.bossWin();
  saveState(true);
  updateBossUI();
  updateHud();
  updateActionBtn();

  const card = document.getElementById('catchCard');
  const tag = document.getElementById('ccRarity');
  tag.textContent = '🏆 HẠ GỤC BOSS THỦY QUÁI';
  tag.className = 'rarity-tag bg-' + b.rarity;
  card.style.borderColor = '#f43f5e';
  document.getElementById('ccEmoji').textContent = b.emoji;
  document.getElementById('ccName').textContent = b.name;
  document.getElementById('ccMeta').innerHTML = `🪙 +${fmt(earnedGold)} Vàng &nbsp;•&nbsp; 💎 +${b.rewardGems} Kim Cương<br>🔑 +${b.rewardKeys} Chìa Khóa Rương &nbsp;•&nbsp; ⭐ +${b.xp} XP`;
  document.getElementById('ccNewBadge').style.display = 'block';
  document.getElementById('ccNewBadge').textContent = '🎁 Vào mục GACHA để mở Rương Cần Câu ngay!';
  card.classList.add('show');
}

function updateBossUI() {
  const banner = document.getElementById('bossBanner');
  const engageBtn = document.getElementById('bossEngageBtn');
  const radar = document.getElementById('btnBossRadar');

  if (activeBoss) {
    banner.classList.add('show');
    document.getElementById('bossName').textContent = `${activeBoss.data.emoji} ${activeBoss.data.name}`;
    document.getElementById('bossTimer').textContent = `⏱️ ${Math.ceil(activeBoss.timeLeft)}s`;
    const pct = Math.max(0, (activeBoss.hp / activeBoss.maxHp) * 100);
    document.getElementById('bossHpFill').style.width = pct + '%';
    document.getElementById('bossHpText').textContent = `${Math.ceil(activeBoss.hp)} / ${activeBoss.maxHp} HP`;
    engageBtn.classList.toggle('show', !(phase === 'REELING' && currentBossFight));
    radar.textContent = '🔥 BOSS!';
    radar.classList.add('boss-live');
  } else {
    banner.classList.remove('show');
    engageBtn.classList.remove('show');
    radar.textContent = `📡 ${Math.ceil(nextBossCountdown)}s`;
    radar.classList.remove('boss-live');
  }
}

/* ======================== FISHING ENGINE ======================== */
let phase = 'IDLE'; // IDLE | CASTING | WAITING | BITING | REELING
let phaseTimer = 0;
let castProgress = 0;
let currentBossFight = false;
let bobberX = 5.5, bobberZ = 0.5;
let currentFish = null;
let isHolding = false;
let mg = { barPos: 35, barVel: 0, barWidth: 26, fishPos: 50, fishTarget: 50, fishMoveTimer: 0, progress: 30 };

function rollFish() {
  const mapFish = FISH_DB.filter(f => f.maps.includes(state.mapId));
  if (adminGodMode) {
    const high = mapFish.filter(f => ['legendary', 'mythical', 'epic'].includes(f.rarity));
    if (high.length) return high[Math.floor(Math.random() * high.length)];
  }
  const feverLuck = feverTimeLeft > 0 ? 25 : 0;
  const totalLuck = getRodStats().luck + getBait().luck + feverLuck;
  const pool = mapFish.map(f => {
    const r = RARITIES[f.rarity];
    let w = r.weight;
    if (f.rarity === 'uncommon')  w *= (1 + totalLuck * 0.008);
    if (f.rarity === 'rare')      w *= (1 + totalLuck * 0.018);
    if (f.rarity === 'epic')      w *= (1 + totalLuck * 0.032);
    if (f.rarity === 'legendary') w *= (1 + totalLuck * 0.050);
    if (f.rarity === 'mythical')  w *= (1 + totalLuck * 0.075);
    return { fish: f, w };
  });
  const sum = pool.reduce((a, b) => a + b.w, 0);
  let roll = Math.random() * sum;
  for (const item of pool) {
    roll -= item.w;
    if (roll <= 0) return item.fish;
  }
  return pool[0].fish;
}

function startCast() {
  if (phase !== 'IDLE' || !session) return;

  // Nếu túi đầy và đang bật Tự bán cá thường/hiếm khi Auto-Fish -> tự dọn túi
  if (state.bag.length >= getBagCap()) {
    if (state.autoFish && state.autoSellLow) {
      const soldCount = sellLowTierFish(true);
      if (soldCount === 0 || state.bag.length >= getBagCap()) {
        showToast('🎒 Túi đầy cá quý! Hãy vào Túi để bán hoặc mở rộng túi.', '#f43f5e');
        toggleAutoFish(false);
        return;
      }
    } else {
      showToast('🎒 Túi cá đã đầy! Hãy bán bớt cá hoặc nâng cấp túi.', '#f43f5e');
      if (state.autoFish) toggleAutoFish(false);
      return;
    }
  }

  const bait = getBait();
  if (!bait.infinite) {
    if ((state.baitCounts[bait.id] || 0) <= 0) {
      state.baitId = 'worm';
      showToast('Hết mồi đặc biệt, đã chuyển về Giun Đất!', '#fbbf24');
      updateHud();
    } else {
      state.baitCounts[bait.id]--;
      updateHud();
    }
  }

  closeCatchCard();
  clearBiteAlert();
  currentBossFight = false;
  phase = 'CASTING';
  castProgress = 0;
  bobberX = 3.2 + Math.random() * 6.2;
  bobberZ = -3.0 + Math.random() * 5.2;
  sfx.cast();
  updateActionBtn();
}

function hookFish() {
  if (phase !== 'BITING') return;
  clearBiteAlert();
  currentFish = rollFish();
  currentBossFight = false;
  const rod = getRodStats();
  phase = 'REELING';
  mg.barWidth = Math.min(56, rod.barWidth);
  mg.barPos = 50 - mg.barWidth / 2;
  mg.barVel = 0;
  mg.fishPos = 50;
  mg.fishTarget = 20 + Math.random() * 60;
  mg.fishMoveTimer = 0.4;
  mg.progress = 34;

  const mgBox = document.getElementById('minigameBox');
  mgBox.classList.remove('boss-mode');
  mgBox.classList.add('show');
  document.getElementById('mgFish').textContent = currentFish.emoji;
  document.getElementById('mgHint').textContent = 'Giữ nút KÉO CẦN (hoặc Space) giữ cá trong vùng xanh!';
  Scene3D.spawnSplash(bobberX, bobberZ, 14);
  sfx.splash();
  updateActionBtn();
}

function finishCatch(success) {
  document.getElementById('minigameBox').classList.remove('show', 'boss-mode');
  isHolding = false;
  phase = 'IDLE';
  clearBiteAlert();

  if (currentBossFight) {
    currentBossFight = false;
    sfx.fail();
    showToast('⚡ Đứt dây! Boss vẫn còn máu, hãy bấm SĂN BOSS đánh tiếp!', '#fbbf24');
    updateActionBtn();
    updateBossUI();
    return;
  }

  if (!success) {
    catchStreak = 0;
    sfx.fail();
    showToast('💨 Cá đã tuột mất! Chuỗi Combo bị ngắt.', '#f43f5e');
    updateHud();
    updateActionBtn();
    if (state.autoFish) setTimeout(startCast, 1000);
    return;
  }

  const f = currentFish;
  const rInfo = RARITIES[f.rarity];
  const rod = getRodStats();

  // Combo & Fever trigger
  catchStreak++;
  if (catchStreak > (state.stats.bestStreak || 0)) state.stats.bestStreak = catchStreak;
  if (catchStreak > 0 && catchStreak % 5 === 0) {
    feverTimeLeft = 30;
    sfx.fever();
    showToast(`🔥 HƯNG PHẤN (Combo x${catchStreak})! +30% Vàng & +25% May Mắn trong 30s!`, '#ff00ea');
  }

  const weight = +(f.minW + Math.random() * (f.maxW - f.minW)).toFixed(2);
  const weightBonus = 0.8 + (weight / f.maxW) * 0.6;
  const feverMult = feverTimeLeft > 0 ? 1.3 : 1.0;
  const priceBoost = (1 + state.upgrades.price * 0.12 + rod.goldBonus) * feverMult;
  const price = Math.max(5, Math.round(f.basePrice * weightBonus * priceBoost));

  state.bag.unshift({
    uid: Date.now() + Math.random(),
    fishId: f.id,
    weight,
    price,
    locked: ['legendary', 'mythical'].includes(f.rarity)
  });

  state.stats.totalCaught++;
  if (['rare', 'epic', 'legendary', 'mythical'].includes(f.rarity)) state.stats.rareCaught++;
  if (['legendary', 'mythical'].includes(f.rarity)) state.stats.legendCaught++;

  let isNew = false;
  if (!state.dex[f.id]) {
    state.dex[f.id] = { count: 1, maxW: weight };
    state.gems += 5;
    isNew = true;
  } else {
    state.dex[f.id].count++;
    if (weight > state.dex[f.id].maxW) state.dex[f.id].maxW = weight;
  }

  // 9% tỉ lệ câu trúng Chìa Khóa Gacha
  if (Math.random() < 0.09) {
    state.keys++;
    showToast('🔑 Câu trúng Chìa Khóa Rương Gacha +1!', '#f472b6');
  }

  Scene3D.spawnSplash(bobberX, bobberZ, 18);
  spawnFloatText(bobberX, 1.6, bobberZ, `${f.emoji} +${fmt(price)}🪙`, rInfo.color, '16px');
  addXp(rInfo.xp);
  sfx.catch();
  saveState(isNew || ['legendary', 'mythical'].includes(f.rarity));
  updateHud();
  updateActionBtn();

  if (!activeBoss && nextBossCountdown < 55 && Math.random() < 0.16) {
    setTimeout(() => spawnBoss(), 600);
  }

  if (state.autoFish) {
    showToast(`🎣 ${f.emoji} ${f.name} (${weight}kg • ${fmt(price)}🪙) • Combo x${catchStreak}`, rInfo.color);
    setTimeout(() => { if (state.autoFish && phase === 'IDLE') startCast(); }, 900);
  } else {
    showCatchCard(f, weight, price, isNew);
  }
}

function showCatchCard(f, weight, price, isNew) {
  const rInfo = RARITIES[f.rarity];
  const card = document.getElementById('catchCard');
  const tag = document.getElementById('ccRarity');
  tag.textContent = rInfo.name + (feverTimeLeft > 0 ? ' • 🔥 FEVER' : '');
  tag.className = 'rarity-tag bg-' + f.rarity;
  card.style.borderColor = rInfo.color;
  document.getElementById('ccEmoji').textContent = f.emoji;
  document.getElementById('ccName').textContent = f.name;
  document.getElementById('ccMeta').textContent = `⚖️ ${weight} kg  •  💰 ${fmt(price)} Vàng  •  ⭐ +${rInfo.xp} XP`;
  document.getElementById('ccNewBadge').textContent = '✨ Khám phá loài mới! +5 💎';
  document.getElementById('ccNewBadge').style.display = isNew ? 'block' : 'none';
  card.classList.add('show');
}

function closeCatchCard() { document.getElementById('catchCard').classList.remove('show'); }

function toggleAutoFish(forceVal = null) {
  if (!state.upgrades.auto) {
    showToast('🔒 Mua "Máy Câu Tự Động" trong Cửa hàng để mở khóa!', '#fbbf24');
    openDrawer('shop', 'upgrades');
    return;
  }
  state.autoFish = forceVal !== null ? forceVal : !state.autoFish;
  saveState();
  updateHud();
  if (state.autoFish && phase === 'IDLE') startCast();
}

/* ======================== GACHA CHEST SYSTEM ======================== */
let activeChestId = 'pirate';
let isSpinningGacha = false;
let lastGachaResults = [];

function rollSingleGacha(chest) {
  state.stats.gachaPulls++;
  state.gachaPity++;
  const isPity = state.gachaPity >= 15;
  let rarity = 'bonus';

  if (isPity) {
    rarity = Math.random() < 0.38 ? 'mythical' : 'legendary';
    state.gachaPity = 0;
  } else {
    const r = Math.random() * 100;
    const t1 = chest.rates.mythical;
    const t2 = t1 + chest.rates.legendary;
    const t3 = t2 + chest.rates.epic;
    const t4 = t3 + chest.rates.rare;
    if (r < t1) { rarity = 'mythical'; state.gachaPity = 0; }
    else if (r < t2) { rarity = 'legendary'; state.gachaPity = 0; }
    else if (r < t3) rarity = 'epic';
    else if (r < t4) rarity = 'rare';
    else rarity = 'bonus';
  }

  if (rarity === 'bonus') {
    const roll = Math.random();
    if (roll < 0.45) {
      const goldWin = 260 + state.level * 95;
      state.gold += goldWin;
      state.stats.totalEarned += goldWin;
      return { type: 'gold', icon: '🪙', name: `+${fmt(goldWin)} Vàng`, rarity: 'uncommon', note: 'Kho báu hải tặc' };
    } else if (roll < 0.8) {
      const baitId = chest.id === 'divine' ? 'glow' : 'shrimp';
      const b = BAITS.find(x => x.id === baitId);
      state.baitCounts[baitId] = (state.baitCounts[baitId] || 0) + 6;
      return { type: 'bait', icon: b.icon, name: `6x ${b.name}`, rarity: 'uncommon', note: 'Mồi cao cấp' };
    } else {
      const gemsWin = chest.id === 'divine' ? 18 : 8;
      state.gems += gemsWin;
      return { type: 'gem', icon: '💎', name: `+${gemsWin} Kim Cương`, rarity: 'rare', note: 'Hoàn trả may mắn' };
    }
  }

  let candidates = RODS.filter(x => x.gachaOnly && x.rarity === rarity);
  if (!candidates.length) candidates = RODS.filter(x => x.rarity === rarity);
  const rod = candidates[Math.floor(Math.random() * candidates.length)];

  let note = '✨ CẦN MỚI!';
  if (state.rodsOwned.includes(rod.id)) {
    const curStar = state.rodStars[rod.id] || 0;
    if (curStar < 5) {
      state.rodStars[rod.id] = curStar + 1;
      note = `⭐ ĐỘT PHÁ ${curStar + 1}★!`;
    } else {
      const refund = rarity === 'mythical' ? 40 : (rarity === 'legendary' ? 25 : 12);
      state.gems += refund;
      note = `Max 5★ → +${refund}💎`;
    }
  } else {
    state.rodsOwned.push(rod.id);
  }

  return { type: 'rod', rodId: rod.id, icon: rod.icon, name: rod.name, rarity: rod.rarity, note };
}

function openGacha(count, payWith) {
  if (isSpinningGacha) return;
  const chest = CHESTS[activeChestId];
  if (payWith === 'key') {
    const need = chest.keyCost * count;
    if (state.keys < need) return showToast(`Cần ${need} 🔑 (hiện có ${state.keys} 🔑)!`, '#f43f5e');
    state.keys -= need;
  } else {
    const need = count === 10 ? chest.gemCost10 : chest.gemCost;
    if (state.gems < need) return showToast(`Cần ${need} 💎 (hiện có ${state.gems} 💎)!`, '#f43f5e');
    state.gems -= need;
  }

  isSpinningGacha = true;
  lastGachaResults = [];
  const chestEl = document.getElementById('gachaChestVisual');
  if (chestEl) chestEl.classList.add('shaking');
  sfx.gachaSpin();
  updateHud();

  setTimeout(() => {
    const pulls = [];
    let highHit = false;
    for (let i = 0; i < count; i++) {
      const res = rollSingleGacha(chest);
      if (['legendary', 'mythical'].includes(res.rarity)) highHit = true;
      pulls.push(res);
    }
    lastGachaResults = pulls;
    isSpinningGacha = false;
    if (highHit) sfx.gachaEpic(); else sfx.catch();
    saveState(true);
    updateHud();
    if (currentDrawer === 'gacha') renderDrawer();
  }, 650);
}

/* ======================== MAIN LOOP ======================== */
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const t = now / 1000;

  if (session) updateGameplay(dt, t);

  const rod = getRodStats();
  Scene3D.update(dt, t, {
    phase,
    castProgress,
    bobberX,
    bobberZ,
    activeBoss,
    currentBossFight,
    rodColor: rod.color,
    rodGlow: rod.gachaOnly || rod.rarity === 'mythical' || feverTimeLeft > 0
  });

  syncBiteAlertPosition();
  requestAnimationFrame(loop);
}

function updateGameplay(dt, t) {
  // Fever countdown
  if (feverTimeLeft > 0) {
    feverTimeLeft = Math.max(0, feverTimeLeft - dt);
    if (feverTimeLeft === 0) updateHud();
  }

  // Boss timer & motion
  if (activeBoss) {
    activeBoss.timeLeft -= dt;
    activeBoss.wx = 7.0 + Math.sin(t * 0.9) * 1.4;
    activeBoss.wz = -0.6 + Math.cos(t * 1.3) * 1.1;
    if (Math.random() < dt * 0.35) Scene3D.triggerLightning();
    if (Math.random() < dt * 1.8) Scene3D.spawnSplash(activeBoss.wx, activeBoss.wz, 4);

    if (activeBoss.timeLeft <= 0) {
      const bName = activeBoss.data.name;
      activeBoss = null;
      nextBossCountdown = 70 + Math.floor(Math.random() * 45);
      if (currentBossFight) {
        document.getElementById('minigameBox').classList.remove('show', 'boss-mode');
        currentBossFight = false;
        phase = 'IDLE';
        isHolding = false;
        updateActionBtn();
      }
      showToast(`🌊 ${bName} đã lặn xuống vực thẳm!`, '#94a3b8');
    }
    updateBossUI();
  } else {
    nextBossCountdown -= dt;
    if (nextBossCountdown <= 0) {
      spawnBoss();
    } else {
      const radar = document.getElementById('btnBossRadar');
      if (radar) radar.textContent = `📡 ${Math.ceil(nextBossCountdown)}s`;
    }
  }

  // Fishing phases
  if (phase === 'CASTING') {
    castProgress += dt * 2.5;
    if (castProgress >= 1) {
      castProgress = 1;
      Scene3D.spawnSplash(bobberX, bobberZ, 12);
      sfx.splash();
      phase = 'WAITING';
      const feverCut = feverTimeLeft > 0 ? 0.2 : 0;
      const speedCut = 1 - Math.min(0.75, state.upgrades.speed * 0.1 + getBait().speed + feverCut);
      phaseTimer = (1.4 + Math.random() * 2.4) * speedCut;
      updateActionBtn();
    }
  } else if (phase === 'WAITING') {
    phaseTimer -= dt;
    if (phaseTimer <= 0) {
      phase = 'BITING';
      phaseTimer = 2.6;
      Scene3D.spawnSplash(bobberX, bobberZ, 14);
      showBiteAlert(bobberX, bobberZ);
      sfx.bite();
      updateActionBtn();
      if (state.autoFish) setTimeout(() => { if (phase === 'BITING') hookFish(); }, 340);
    }
  } else if (phase === 'BITING') {
    phaseTimer -= dt;
    if (Math.random() < dt * 6) Scene3D.spawnSplash(bobberX, bobberZ, 2);
    if (phaseTimer <= 0) {
      phase = 'IDLE';
      catchStreak = 0;
      clearBiteAlert();
      sfx.fail();
      showToast('⏳ Chậm tay quá! Cá ăn mồi rồi chạy mất.', '#fbbf24');
      updateHud();
      updateActionBtn();
    }
  } else if (phase === 'REELING') {
    const rod = getRodStats();
    const targetInfo = currentBossFight ? activeBoss.data : RARITIES[currentFish.rarity];
    const effSpeed = targetInfo.speed * (1 - (rod.slow || 0));

    mg.fishMoveTimer -= dt;
    if (mg.fishMoveTimer <= 0) {
      mg.fishTarget = 8 + Math.random() * 84;
      mg.fishMoveTimer = targetInfo.erratic * (0.65 + Math.random() * 0.65);
    }
    const diff = mg.fishTarget - mg.fishPos;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), effSpeed * dt);
    mg.fishPos = Math.max(4, Math.min(96, mg.fishPos + step));

    let pullActive = isHolding;
    if ((state.autoFish && !isHolding && !currentBossFight) || adminGodMode) {
      pullActive = mg.fishPos > (mg.barPos + mg.barWidth / 2) - 2;
    }

    mg.barVel += (pullActive ? 185 : -165) * dt;
    mg.barVel *= 0.92;
    mg.barPos += mg.barVel * dt;
    if (mg.barPos < 0) { mg.barPos = 0; mg.barVel = Math.max(0, mg.barVel * -0.2); }
    if (mg.barPos > 100 - mg.barWidth) { mg.barPos = 100 - mg.barWidth; mg.barVel = Math.min(0, mg.barVel * -0.2); }

    const inside = mg.fishPos >= mg.barPos - 2 && mg.fishPos <= mg.barPos + mg.barWidth + 2;

    if (currentBossFight && activeBoss) {
      bobberX = activeBoss.wx;
      bobberZ = activeBoss.wz;
      if (inside) {
        const mult = (adminGodMode ? 10 : 1) * (feverTimeLeft > 0 ? 1.35 : 1);
        const dmg = (44 * rod.power * rod.bossDmg * mult) * dt;
        activeBoss.hp -= dmg;
        mg.progress = Math.min(100, mg.progress + 18 * dt);
        dmgPopupAccum += dmg;
        if (dmgPopupAccum >= 26) {
          spawnFloatText(activeBoss.wx, 2.2, activeBoss.wz, `-${Math.round(dmgPopupAccum)}!`, '#fbbf24', '20px');
          dmgPopupAccum = 0;
          Scene3D.spawnSplash(activeBoss.wx, activeBoss.wz, 5);
        }
      } else {
        mg.progress -= targetInfo.drain * dt;
      }
      updateBossUI();
      if (activeBoss.hp <= 0) { defeatBoss(); return; }
      if (mg.progress <= 0) { finishCatch(false); return; }
    } else {
      if (inside) {
        mg.progress += (25 * rod.power * (adminGodMode ? 3 : 1)) * dt;
        if (Math.random() < dt * 5) Scene3D.spawnSplash(bobberX, bobberZ, 2);
      } else {
        mg.progress -= targetInfo.drain * dt;
      }
      if (mg.progress >= 100) { finishCatch(true); return; }
      if (mg.progress <= 0)   { finishCatch(false); return; }
    }

    document.getElementById('mgZone').style.left = mg.barPos + '%';
    document.getElementById('mgZone').style.width = mg.barWidth + '%';
    document.getElementById('mgFish').style.left = mg.fishPos + '%';
    document.getElementById('mgProgress').style.width = Math.max(0, Math.min(100, mg.progress)) + '%';
    document.getElementById('mgPercent').textContent = currentBossFight
      ? `Dây: ${Math.max(0, Math.round(mg.progress))}%`
      : `${Math.max(0, Math.min(100, Math.round(mg.progress)))}%`;
  }
}

/* ======================== CONTROLS ======================== */
const mainBtn = document.getElementById('mainActionBtn');

function updateActionBtn() {
  mainBtn.className = 'main-btn';
  if (phase === 'IDLE') mainBtn.textContent = feverTimeLeft > 0 ? '🔥 THẢ CẦN (FEVER x1.3)' : '🎣 THẢ CẦN CÂU';
  else if (phase === 'CASTING' || phase === 'WAITING') { mainBtn.textContent = '⏳ Đang chờ cá cắn...'; mainBtn.classList.add('waiting'); }
  else if (phase === 'BITING') { mainBtn.textContent = '⚡ CÁ CẮN! GIẬT NGAY!'; mainBtn.classList.add('bite'); }
  else if (phase === 'REELING') {
    mainBtn.textContent = currentBossFight ? '⚔️ GIỮ ĐỂ GÂY SÁT THƯƠNG BOSS!' : '🔥 GIỮ ĐỂ KÉO CẦN 🔥';
    mainBtn.classList.add(currentBossFight ? 'boss-btn' : 'reeling');
  }
}

function handlePrimaryDown(e) {
  if (e) e.preventDefault();
  if (!session) return;
  ensureAudio();
  if (phase === 'IDLE') startCast();
  else if (phase === 'BITING') hookFish();
  else if (phase === 'REELING') isHolding = true;
}
function handlePrimaryUp() { isHolding = false; }

mainBtn.addEventListener('pointerdown', handlePrimaryDown);
window.addEventListener('pointerup', handlePrimaryUp);
window.addEventListener('pointercancel', handlePrimaryUp);
window.addEventListener('blur', handlePrimaryUp);
document.getElementById('scene3dContainer').addEventListener('pointerdown', handlePrimaryDown);

document.getElementById('bossEngageBtn').addEventListener('pointerdown', e => {
  e.preventDefault(); ensureAudio(); engageBoss();
});
document.getElementById('btnBossRadar').onclick = () => openDrawer('boss');
document.getElementById('btnCamToggle').onclick = () => {
  const name = Scene3D.cycleCamera();
  document.getElementById('btnCamToggle').textContent = name;
};
document.getElementById('btnSound').onclick = () => { state.sound = !state.sound; saveState(); updateHud(); };
document.getElementById('btnAutoFish').onclick = () => toggleAutoFish();
document.getElementById('btnSettings').onclick = () => openDrawer('settings');

window.addEventListener('keydown', e => {
  const tag = (document.activeElement?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.code === 'Space' && session && !document.getElementById('drawer').classList.contains('open')) {
    e.preventDefault();
    if (!e.repeat) handlePrimaryDown();
  }
});
window.addEventListener('keyup', e => { if (e.code === 'Space') handlePrimaryUp(); });

/* ======================== HUD & DRAWER UI ======================== */
function updateHud() {
  const m = getMap();
  const rod = getRodStats();
  const bait = getBait();

  const acctBtn = document.getElementById('uiAccountBtn');
  const isGuest = !session || session.mode === 'guest';
  const isAdmin = session && session.mode === 'admin';
  acctBtn.classList.toggle('is-guest', isGuest);
  acctBtn.classList.toggle('is-admin', isAdmin);
  document.getElementById('uiAccountIcon').textContent = isAdmin ? '👑' : (isGuest ? '👤' : '☁️');
  document.getElementById('uiAccountName').textContent = session ? session.displayName : 'Khách';
  document.getElementById('btnAdminPanel').style.display = isAdmin ? 'grid' : 'none';

  document.getElementById('uiLevel').textContent = `Lv. ${state.level}`;
  document.getElementById('uiMapName').textContent = `${m.icon} ${m.name}`;
  document.getElementById('uiXpFill').style.width = Math.min(100, (state.xp / xpNeeded(state.level)) * 100) + '%';
  document.getElementById('uiGold').textContent = fmt(state.gold);
  document.getElementById('uiGems').textContent = fmt(state.gems);
  document.getElementById('uiKeys').textContent = fmt(state.keys);
  document.getElementById('btnSound').textContent = state.sound ? '🔊' : '🔇';

  const starTxt = rod.stars > 0 ? ` ${rod.stars}★` : '';
  const baitQty = bait.infinite ? '∞' : fmt(state.baitCounts[bait.id] || 0);
  const comboTxt = feverTimeLeft > 0
    ? ` • 🔥FEVER ${Math.ceil(feverTimeLeft)}s`
    : (catchStreak >= 2 ? ` • ⚡x${catchStreak}` : '');
  document.getElementById('uiGearInfo').textContent = `${rod.icon} ${rod.name}${starTxt} • ${bait.icon}(${baitQty})${comboTxt}`;

  const autoEl = document.getElementById('btnAutoFish');
  autoEl.textContent = state.upgrades.auto ? `🤖 Auto: ${state.autoFish ? 'BẬT' : 'TẮT'}` : '🤖 Auto: KHÓA';
  autoEl.classList.toggle('active', state.autoFish && state.upgrades.auto);

  document.getElementById('navBagText').textContent = `Túi (${state.bag.length})`;

  const gachaDot = document.getElementById('gachaDot');
  gachaDot.style.display = state.keys > 0 ? 'block' : 'none';
  gachaDot.textContent = state.keys > 99 ? '99+' : state.keys;

  const claimableQ = QUESTS.filter(q => !state.claimedQuests.includes(q.id) && q.check(state) >= q.target).length;
  const canDaily = state.lastDailyDate !== todayKey() ? 1 : 0;
  const qDot = document.getElementById('questDot');
  qDot.style.display = (claimableQ + canDaily) > 0 ? 'block' : 'none';
  qDot.textContent = claimableQ + canDaily;
}

let currentDrawer = null;
let currentSubTab = 'rods';

function openDrawer(type, subTab = null) {
  if (!session) return;
  currentDrawer = type;
  if (subTab) currentSubTab = subTab;
  else if (type === 'events' && !['quests', 'daily', 'giftcode'].includes(currentSubTab)) currentSubTab = 'quests';
  else if (type === 'shop' && !['rods', 'baits', 'upgrades'].includes(currentSubTab)) currentSubTab = 'rods';
  document.getElementById('drawer').classList.add('open');
  renderDrawer();
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  currentDrawer = null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadLeaderboardUI(sortBy) {
  lbSort = sortBy;
  const body = document.getElementById('drawerBody');
  if (currentDrawer !== 'leaderboard') return;
  body.innerHTML = `<div style="text-align:center;padding:28px;color:#94a3b8;">⏳ Đang tải Bảng Xếp Hạng Online từ Supabase...</div>`;
  try {
    if (session && session.mode === 'user') await cloudSaveState(true);
    const rows = await cloudFetchLeaderboard(sortBy);
    if (currentDrawer !== 'leaderboard') return;

    if (!rows.length) {
      body.innerHTML = `<div style="text-align:center;padding:28px;color:#94a3b8;">Chưa có cần thủ nào trên BXH. Hãy tạo tài khoản Cloud để lên Top 1! 👑</div>`;
      return;
    }

    let html = '';
    rows.forEach((r, idx) => {
      const isMe = session && session.mode === 'user' && session.username === r.username;
      const rankClass = idx === 0 ? 'rank-1' : (idx === 1 ? 'rank-2' : (idx === 2 ? 'rank-3' : ''));
      const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : (idx + 1)));
      const metric = sortBy === 'total_earned'
        ? `🪙 ${fmt(r.total_earned)}`
        : (sortBy === 'level' ? `⭐ Lv.${r.level}` : `⚔️ ${fmt(r.bosses_killed)} Boss`);

      html += `
        <div class="card-item ${isMe ? 'rank-me' : ''}">
          <div class="card-left">
            <div class="rank-num ${rankClass}">${medal}</div>
            <div class="item-ico" style="font-size:24px;">${r.rod_icon || '🎣'}</div>
            <div class="item-meta">
              <div class="item-name">${escapeHtml(r.display_name || r.username)} ${isMe ? '<span class="rarity-tag bg-rare">Bạn</span>' : ''}</div>
              <div class="item-desc">Lv.${r.level || 1} • ⚔️ ${fmt(r.bosses_killed)} Boss • 🪙 ${fmt(r.total_earned)}</div>
            </div>
          </div>
          <div style="font-weight:800;font-size:13px;color:#fbbf24;white-space:nowrap;">${metric}</div>
        </div>
      `;
    });
    body.innerHTML = html;
  } catch (err) {
    if (currentDrawer === 'leaderboard') {
      body.innerHTML = `<div class="auth-err" style="display:block;">❌ ${escapeHtml(err.message)}</div>`;
    }
  }
}

function renderDrawer() {
  const title = document.getElementById('drawerTitle');
  const tabs = document.getElementById('drawerTabs');
  const body = document.getElementById('drawerBody');
  tabs.style.display = 'none';
  tabs.innerHTML = '';
  body.innerHTML = '';

  if (currentDrawer === 'admin' && session.mode === 'admin') {
    title.textContent = '🛠️ Bảng Điều Khiển ADMIN (Offline)';
    body.innerHTML = `
      <div class="bag-actions" style="border-color:#ff00ea;background:rgba(255,0,234,0.12);">
        <div>
          <div style="font-size:13.5px;font-weight:800;color:#f5d0fe;">👑 Chế độ Siêu Nhân Admin: ${adminGodMode ? 'ĐANG BẬT' : 'TẮT'}</div>
          <div style="font-size:11.5px;color:#cbd5e1;">Tự bám cá + Sát thương Boss x10 + 100% cá Sử Thi/Huyền Thoại/Thần Thoại</div>
        </div>
        <button class="btn-sm ${adminGodMode ? 'btn-danger' : 'btn-purple'}" onclick="adminGodMode=!adminGodMode;renderDrawer();showToast('⚡ Siêu Nhân Admin: '+(adminGodMode?'BẬT':'TẮT'),'#ff00ea')">
          ${adminGodMode ? 'Tắt' : 'Bật ngay'}
        </button>
      </div>

      <div class="card-col">
        <div style="font-size:13px;font-weight:700;color:#fbbf24;">💎 Bơm tài nguyên & hiệu ứng nhanh:</div>
        <div class="admin-grid">
          <button class="btn-sm btn-buy" onclick="adminAdd('gold',10000000)">+10 Triệu 🪙</button>
          <button class="btn-sm btn-gem" onclick="adminAdd('gems',50000)">+50.000 💎</button>
          <button class="btn-sm btn-pink" onclick="adminAdd('keys',500)">+500 🔑</button>
          <button class="btn-sm btn-purple" onclick="feverTimeLeft=60;updateHud();updateActionBtn();showToast('🔥 Bật Fever 60 giây!','#ff00ea')">🔥 Bật Fever 60s</button>
          <button class="btn-sm btn-equip" onclick="adminAddLevel(10)">⭐ +10 Cấp Độ</button>
          <button class="btn-sm btn-equip" onclick="adminRestoreMax()">♻️ Full Max Đồ</button>
        </div>
      </div>

      <div class="card-col">
        <div style="font-size:13px;font-weight:700;color:#fda4af;">⚔️ Triệu hồi nhanh Boss Thủy Quái 3D:</div>
        <div class="admin-grid">
          ${BOSS_DB.map(b => `<button class="btn-sm btn-danger" onclick="activeBoss=null;closeDrawer();spawnBoss('${b.id}')">${b.emoji} ${b.name.split(' ').slice(0, 3).join(' ')}</button>`).join('')}
        </div>
      </div>
    `;
  }

  else if (currentDrawer === 'leaderboard') {
    title.textContent = '👑 Bảng Xếp Hạng Online (Top 30)';
    tabs.style.display = 'flex';
    tabs.innerHTML = `
      <button class="sub-tab ${lbSort === 'total_earned' ? 'active' : ''}" onclick="lbSort='total_earned';renderDrawer()">🪙 Phú Hộ</button>
      <button class="sub-tab ${lbSort === 'level' ? 'active' : ''}" onclick="lbSort='level';renderDrawer()">⭐ Cấp Độ</button>
      <button class="sub-tab ${lbSort === 'bosses_killed' ? 'active' : ''}" onclick="lbSort='bosses_killed';renderDrawer()">⚔️ Săn Boss</button>
    `;
    loadLeaderboardUI(lbSort);
  }

  else if (currentDrawer === 'account') {
    if (session.mode === 'admin') {
      title.textContent = '👑 Tài Khoản ADMIN (Offline)';
      body.innerHTML = `
        <div class="bag-actions" style="border-color:#ff00ea;background:rgba(255,0,234,0.12);">
          <div>
            <div style="font-size:14px;font-weight:800;color:#f5d0fe;">${session.displayName}</div>
            <div style="font-size:11.5px;color:#cbd5e1;margin-top:3px;">Hoạt động hoàn toàn Offline (không đồng bộ lên BXH Supabase), Full 100% cần 5★, mồi, bản đồ 3D.</div>
          </div>
          <button class="btn-sm btn-purple" onclick="openDrawer('admin')">🛠️ Panel</button>
        </div>
        <button class="btn-sm btn-danger" style="padding:10px;" onclick="logoutToAuth('login')">🚪 Đăng xuất khỏi Admin</button>
      `;
    } else if (session.mode === 'guest') {
      title.textContent = '👤 Tài Khoản (Chế Độ Khách)';
      body.innerHTML = `
        <div class="bag-actions" style="border-color:rgba(251,191,36,0.55);background:rgba(251,191,36,0.1);">
          <div>
            <div style="font-size:13.5px;font-weight:800;color:#fde68a;">Bạn đang chơi ở Chế Độ Khách</div>
            <div style="font-size:11.5px;color:#cbd5e1;margin-top:3px;">Tạo tài khoản Cloud bên dưới để <b>lên BXH & giữ 100% tiến trình</b> trên mọi thiết bị!</div>
          </div>
        </div>
        <form class="card-col" onsubmit="upgradeGuestToAccount(event)">
          <div style="font-size:13.5px;font-weight:800;color:#00f3ff;">✨ Liên kết Tài Khoản Cloud</div>
          <div class="form-group"><label>Tên đăng nhập (a-z, 0-9, _)</label><input class="form-input" id="upUser" type="text" placeholder="vd: canthu99" required /></div>
          <div class="form-group"><label>Tên hiển thị</label><input class="form-input" id="upDisplay" type="text" maxlength="20" placeholder="vd: Đại Gia Câu Cá" /></div>
          <div class="form-group"><label>Mật khẩu (4+ ký tự)</label><input class="form-input" id="upPass" type="password" placeholder="••••••" required /></div>
          <button class="btn-sm btn-equip" type="submit" style="padding:10px;">☁️ Tạo Tài Khoản & Đồng Bộ Ngay</button>
        </form>
        <div class="card-item">
          <div class="item-meta">
            <div class="item-name">Đã có tài khoản từ trước?</div>
            <div class="item-desc">Đăng nhập vào tài khoản Cloud hoặc tài khoản Admin.</div>
          </div>
          <button class="btn-sm btn-gem" onclick="logoutToAuth('login')">Đăng nhập</button>
        </div>
      `;
    } else {
      title.textContent = `☁️ Hồ Sơ Cloud: ${session.displayName}`;
      body.innerHTML = `
        <div class="bag-actions">
          <div>
            <div style="font-size:14px;font-weight:800;color:#6ee7b7;">${escapeHtml(session.displayName)} <span style="font-size:12px;color:#94a3b8;">(@${escapeHtml(session.username)})</span></div>
            <div style="font-size:11.5px;color:#cbd5e1;margin-top:2px;">☁️ Tự động đồng bộ Supabase Cloud</div>
          </div>
          <button class="btn-sm btn-gem" onclick="cloudSaveState(true).then(()=>showToast('☁️ Đã đồng bộ lên Cloud!','#10b981'))">☁️ Lưu ngay</button>
        </div>
        <div class="card-col">
          <div style="font-size:13px;font-weight:700;color:#38bdf8;">✏️ Đổi tên hiển thị</div>
          <div style="display:flex;gap:8px;">
            <input class="form-input" id="editDisplayName" value="${escapeHtml(session.displayName)}" maxlength="20" />
            <button class="btn-sm btn-equip" onclick="updateDisplayName()">Lưu</button>
          </div>
        </div>
        <div class="card-col">
          <div style="font-size:13px;font-weight:700;color:#fbbf24;">🔑 Đổi mật khẩu</div>
          <div style="display:flex;gap:8px;">
            <input class="form-input" id="editNewPass" type="password" placeholder="Mật khẩu mới (4+ ký tự)" />
            <button class="btn-sm btn-buy" onclick="changePassword()">Cập nhật</button>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
          <button class="btn-sm btn-gem" style="flex:1;padding:10px;" onclick="logoutToAuth('login')">🔄 Chuyển tài khoản</button>
          <button class="btn-sm btn-danger" style="flex:1;padding:10px;" onclick="logoutToAuth('login')">🚪 Đăng xuất</button>
        </div>
      `;
    }
  }

  else if (currentDrawer === 'bag') {
    title.textContent = `🎒 Túi Cá (${state.bag.length}/${getBagCap()})`;
    const unlockedTotal = state.bag.filter(x => !x.locked).reduce((a, b) => a + b.price, 0);
    body.innerHTML = `
      <div class="bag-actions" style="flex-wrap:wrap;">
        <div>
          <div style="font-size:12px;color:#94a3b8;">Giá trị cá chưa khóa</div>
          <div style="font-size:16px;font-weight:800;color:#fbbf24;">🪙 ${fmt(unlockedTotal)} Vàng</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn-sm btn-muted" onclick="sortBagByPrice()">${bagSortDesc ? '⬇️ Giá cao' : '⬆️ Mới nhất'}</button>
          <button class="btn-sm btn-gem" onclick="sellLowTierFish(false)">Bán Thường/Hiếm</button>
          <button class="btn-sm btn-buy" onclick="sellAllFish()">Bán tất cả</button>
        </div>
      </div>
    `;
    if (!state.bag.length) {
      body.innerHTML += `<div style="text-align:center;padding:30px;color:#94a3b8;">Túi đang trống. Hãy thả cần câu cá nhé! 🎣</div>`;
      return;
    }
    state.bag.forEach((item, idx) => {
      const f = FISH_DB.find(x => x.id === item.fishId);
      if (!f) return;
      const r = RARITIES[f.rarity];
      body.innerHTML += `
        <div class="card-item r-${f.rarity}">
          <div class="card-left">
            <div class="item-ico">${f.emoji}</div>
            <div class="item-meta">
              <div class="item-name">${f.name} <span class="rarity-tag bg-${f.rarity}">${r.name}</span></div>
              <div class="item-desc">⚖️ ${item.weight} kg • 🪙 ${fmt(item.price)} Vàng</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-sm btn-muted" title="Khóa/Mở khóa" onclick="toggleLockFish(${idx})">${item.locked ? '🔒' : '🔓'}</button>
            <button class="btn-sm btn-buy" ${item.locked ? 'disabled style="opacity:0.4"' : ''} onclick="sellSingleFish(${idx})">Bán</button>
          </div>
        </div>
      `;
    });
  }

  else if (currentDrawer === 'shop') {
    title.textContent = '🛒 Kho Cần & Cửa Hàng';
    tabs.style.display = 'flex';
    tabs.innerHTML = `
      <button class="sub-tab ${currentSubTab === 'rods' ? 'active' : ''}" onclick="openDrawer('shop','rods')">🎣 Cần Câu (${RODS.length})</button>
      <button class="sub-tab ${currentSubTab === 'baits' ? 'active' : ''}" onclick="openDrawer('shop','baits')">🪱 Mồi Câu</button>
      <button class="sub-tab ${currentSubTab === 'upgrades' ? 'active' : ''}" onclick="openDrawer('shop','upgrades')">⚡ Nâng Cấp</button>
    `;

    if (currentSubTab === 'rods') {
      RODS.forEach(baseRod => {
        const owned = state.rodsOwned.includes(baseRod.id);
        const r = getRodStats(baseRod.id);
        const equipped = state.rodId === r.id;
        const starBadge = r.stars > 0 ? `<span style="color:#fbbf24;">${'★'.repeat(r.stars)}</span>` : '';
        let btn = '';
        if (equipped) btn = `<button class="btn-sm btn-equipped">Đang dùng</button>`;
        else if (owned) btn = `<button class="btn-sm btn-equip" onclick="equipRod('${r.id}')">Trang bị</button>`;
        else if (r.gachaOnly) btn = `<button class="btn-sm btn-pink" onclick="openDrawer('gacha')">Mở Rương</button>`;
        else btn = `<button class="btn-sm btn-buy" onclick="buyRod('${r.id}')">🪙 ${fmt(r.cost)}</button>`;

        body.innerHTML += `
          <div class="card-item r-${r.rarity}">
            <div class="card-left">
              <div class="item-ico">${r.icon}</div>
              <div class="item-meta">
                <div class="item-name">${r.name} ${starBadge} <span class="rarity-tag bg-${r.rarity}">${RARITIES[r.rarity].name}</span></div>
                <div class="item-desc">${r.desc}<br>🍀 May mắn +${r.luck}% • 💪 Lực ${r.power}x • ⚔️ Boss ${r.bossDmg}x</div>
              </div>
            </div>
            ${btn}
          </div>
        `;
      });
    } else if (currentSubTab === 'baits') {
      BAITS.forEach(b => {
        const qty = b.infinite ? '∞' : fmt(state.baitCounts[b.id] || 0);
        const equipped = state.baitId === b.id;
        body.innerHTML += `
          <div class="card-item">
            <div class="card-left">
              <div class="item-ico">${b.icon}</div>
              <div class="item-meta">
                <div class="item-name">${b.name} <span style="font-size:12px;color:#38bdf8;">(Có: ${qty})</span></div>
                <div class="item-desc">${b.desc}</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              ${!b.infinite ? `<button class="btn-sm btn-buy" onclick="buyBait('${b.id}')">+${b.pack} (🪙${fmt(b.cost)})</button>` : ''}
              ${equipped ? `<button class="btn-sm btn-equipped">Đang gắn</button>` : `<button class="btn-sm btn-equip" onclick="equipBait('${b.id}')">Dùng</button>`}
            </div>
          </div>
        `;
      });
    } else {
      UPGRADES.forEach(u => {
        const lv = state.upgrades[u.id] || 0;
        const maxed = lv >= u.maxLv;
        const cost = Math.round(u.baseCost * Math.pow(u.mult, lv));
        body.innerHTML += `
          <div class="card-item">
            <div class="card-left">
              <div class="item-ico">${u.icon}</div>
              <div class="item-meta">
                <div class="item-name">${u.name} <span style="font-size:12px;color:#10b981;">(Cấp ${lv}/${u.maxLv})</span></div>
                <div class="item-desc">${u.desc}</div>
              </div>
            </div>
            ${maxed ? `<button class="btn-sm btn-equipped">Tối đa</button>` : `<button class="btn-sm btn-buy" onclick="buyUpgrade('${u.id}')">🪙 ${fmt(cost)}</button>`}
          </div>
        `;
      });
    }
  }

  else if (currentDrawer === 'gacha') {
    title.textContent = '🎁 Gacha Rương Cần Câu';
    tabs.style.display = 'flex';
    tabs.innerHTML = `
      <button class="sub-tab ${activeChestId === 'pirate' ? 'active' : ''}" onclick="activeChestId='pirate';lastGachaResults=[];renderDrawer()">🧰 Rương Hải Tặc</button>
      <button class="sub-tab ${activeChestId === 'divine' ? 'active' : ''}" onclick="activeChestId='divine';lastGachaResults=[];renderDrawer()">👑 Rương Thần Biển VIP</button>
    `;
    const c = CHESTS[activeChestId];
    const pityPct = Math.min(100, (state.gachaPity / 15) * 100);

    let html = `
      <div class="gacha-hero">
        <div style="font-size:13px;color:#e2e8f0;font-weight:700;">${c.name}</div>
        <div class="chest-box" id="gachaChestVisual">${c.icon}</div>
        <div style="font-size:12px;color:#cbd5e1;margin-bottom:6px;">${c.desc}</div>
        <div style="font-size:11px;color:#94a3b8;">
          Tỉ lệ: Thần Thoại ${c.rates.mythical}% • Huyền Thoại ${c.rates.legendary}% • Sử Thi ${c.rates.epic}% • Quý ${c.rates.rare}%
        </div>
        <div class="pity-bar-wrap">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#fbbf24;font-weight:700;">
            <span>🔥 Bảo hiểm Huyền Thoại/Thần Thoại</span>
            <span>${state.gachaPity} / 15</span>
          </div>
          <div class="pity-bar"><div class="pity-fill" style="width:${pityPct}%"></div></div>
        </div>
        <div class="gacha-btn-row">
          <button class="btn-sm btn-pink" onclick="openGacha(1,'key')">🔑 Quay x1 (${c.keyCost} Chìa)</button>
          <button class="btn-sm btn-gem" onclick="openGacha(1,'gem')">💎 Quay x1 (${c.gemCost}💎)</button>
          <button class="btn-sm btn-buy" onclick="openGacha(10,'gem')">✨ Quay x10 (${c.gemCost10}💎)</button>
        </div>
      </div>
    `;

    if (lastGachaResults.length > 0) {
      html += `<div style="font-size:13px;font-weight:700;color:#fbbf24;margin-top:4px;">🎉 Kết quả mở rương:</div><div class="gacha-results-grid">`;
      lastGachaResults.forEach((res, idx) => {
        html += `
          <div class="gacha-pull-card r-${res.rarity}" style="animation-delay:${idx * 0.04}s">
            <div style="font-size:30px;">${res.icon}</div>
            <div style="font-weight:700;font-size:12px;margin:4px 0;">${escapeHtml(res.name)}</div>
            <span class="rarity-tag bg-${res.rarity}">${RARITIES[res.rarity].name}</span>
            <div style="font-size:11px;color:#fbbf24;margin-top:5px;font-weight:700;">${res.note}</div>
            ${res.type === 'rod' ? `<button class="btn-sm btn-equip" style="margin-top:6px;padding:4px 8px;font-size:11px;" onclick="equipRod('${res.rodId}', true)">Trang bị</button>` : ''}
          </div>
        `;
      });
      html += `</div>`;
    } else {
      html += `<div style="font-size:12.5px;font-weight:700;color:#38bdf8;margin-top:4px;">✨ Danh sách Cần Câu Độc Quyền trong Rương:</div>`;
      RODS.filter(x => x.gachaOnly).forEach(r => {
        const owned = state.rodsOwned.includes(r.id);
        const stars = state.rodStars[r.id] || 0;
        html += `
          <div class="card-item r-${r.rarity}">
            <div class="card-left">
              <div class="item-ico">${r.icon}</div>
              <div class="item-meta">
                <div class="item-name">${r.name} ${stars > 0 ? `<span style="color:#fbbf24;">${'★'.repeat(stars)}</span>` : ''} <span class="rarity-tag bg-${r.rarity}">${RARITIES[r.rarity].name}</span></div>
                <div class="item-desc">${r.desc}</div>
              </div>
            </div>
            ${owned ? `<span style="font-size:11px;color:#4ade80;font-weight:700;">Đã có ✓</span>` : `<span style="font-size:11px;color:#94a3b8;">Chưa có</span>`}
          </div>
        `;
      });
    }
    body.innerHTML = html;
  }

  else if (currentDrawer === 'boss') {
    title.textContent = '⚔️ Sự Kiện Săn Boss Thủy Quái 3D';
    body.innerHTML = `
      <div class="bag-actions" style="border-color:rgba(244,63,94,0.5);background:rgba(244,63,94,0.1);">
        <div>
          <div style="font-size:13px;font-weight:800;color:#fda4af;">
            ${activeBoss ? `🔥 Đang xuất hiện: ${activeBoss.data.emoji} ${activeBoss.data.name}` : `📡 Boss tiếp theo sau: ${Math.ceil(nextBossCountdown)} giây`}
          </div>
          <div style="font-size:11.5px;color:#cbd5e1;margin-top:3px;">Hạ Boss 3D để nhận lượng lớn Vàng, Kim Cương 💎 và Chìa Khóa Rương 🔑!</div>
        </div>
        ${activeBoss
          ? `<button class="btn-sm btn-pink" onclick="closeDrawer();engageBoss()">⚔️ Chiến ngay</button>`
          : `<button class="btn-sm btn-gem" onclick="summonBossWithGems()">⚡ Triệu hồi (5💎)</button>`}
      </div>
    `;
    BOSS_DB.forEach(b => {
      const kills = state.bossLog[b.id] || 0;
      body.innerHTML += `
        <div class="card-item r-${b.rarity}">
          <div class="card-left">
            <div class="item-ico">${b.emoji}</div>
            <div class="item-meta">
              <div class="item-name">${b.name} <span class="rarity-tag bg-${b.rarity}">${RARITIES[b.rarity].name}</span></div>
              <div class="item-desc">❤️ HP cơ bản: ${b.hp} • Thưởng: 🪙${fmt(b.rewardGold)} + 💎${b.rewardGems} + 🔑${b.rewardKeys}</div>
            </div>
          </div>
          <div style="font-size:11.5px;color:#fbbf24;font-weight:700;white-space:nowrap;">Đã hạ: ${kills}</div>
        </div>
      `;
    });
  }

  else if (currentDrawer === 'maps') {
    title.textContent = `🗺️ Bản Đồ 3D (${state.mapsUnlocked.length}/${MAPS.length})`;
    MAPS.forEach(m => {
      const unlocked = state.mapsUnlocked.includes(m.id);
      const active = state.mapId === m.id;
      const fishCount = FISH_DB.filter(f => f.maps.includes(m.id)).length;
      let btn = '';
      if (active) btn = `<button class="btn-sm btn-equipped">Đang ở đây</button>`;
      else if (unlocked) btn = `<button class="btn-sm btn-equip" onclick="selectMap('${m.id}')">Di chuyển</button>`;
      else if (state.level < m.reqLv) btn = `<button class="btn-sm btn-muted">Cần Lv.${m.reqLv}</button>`;
      else btn = `<button class="btn-sm btn-buy" onclick="unlockMap('${m.id}')">Mở (🪙${fmt(m.cost)})</button>`;

      body.innerHTML += `
        <div class="card-item">
          <div class="card-left">
            <div class="map-swatch" style="background:${m.swatch}">${m.icon}</div>
            <div class="item-meta">
              <div class="item-name">${m.name} <span style="font-size:11px;color:#94a3b8;">(Lv.${m.reqLv}+ • ${fishCount} loài)</span></div>
              <div class="item-desc">${m.desc}</div>
            </div>
          </div>
          ${btn}
        </div>
      `;
    });
  }

  else if (currentDrawer === 'dex') {
    const discovered = Object.keys(state.dex).length;
    title.textContent = `📖 Bộ Sưu Tập Cá (${discovered}/${FISH_DB.length})`;
    const list = dexMapFilter === 'all'
      ? FISH_DB
      : FISH_DB.filter(f => f.maps.includes(dexMapFilter));

    let filterHtml = `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;">
      <button class="btn-sm ${dexMapFilter === 'all' ? 'btn-gem' : 'btn-muted'}" onclick="dexMapFilter='all';renderDrawer()">Tất cả</button>
      ${MAPS.map(m => `<button class="btn-sm ${dexMapFilter === m.id ? 'btn-gem' : 'btn-muted'}" onclick="dexMapFilter='${m.id}';renderDrawer()">${m.icon} ${m.name.split(' ')[0]}</button>`).join('')}
    </div>`;

    let html = filterHtml + '<div class="grid-dex">';
    list.forEach(f => {
      const rec = state.dex[f.id];
      const r = RARITIES[f.rarity];
      html += `
        <div class="dex-card ${rec ? 'r-' + f.rarity : 'locked'}">
          <div style="font-size:32px;">${rec ? f.emoji : '❓'}</div>
          <div style="font-weight:700;font-size:12.5px;margin:4px 0;">${rec ? f.name : 'Chưa khám phá'}</div>
          <span class="rarity-tag bg-${f.rarity}">${r.name}</span>
          <div style="font-size:11px;color:#94a3b8;margin-top:5px;">
            ${rec ? `Đã câu: ${rec.count} • Max: ${rec.maxW}kg` : `Giá cơ bản: ~${fmt(f.basePrice)}🪙`}
          </div>
        </div>
      `;
    });
    html += '</div>';
    body.innerHTML = html;
  }

  else if (currentDrawer === 'events') {
    title.textContent = '🏆 Sự Kiện, Điểm Danh & Giftcode';
    tabs.style.display = 'flex';
    tabs.innerHTML = `
      <button class="sub-tab ${currentSubTab === 'quests' ? 'active' : ''}" onclick="openDrawer('events','quests')">🏆 Nhiệm Vụ</button>
      <button class="sub-tab ${currentSubTab === 'daily' ? 'active' : ''}" onclick="openDrawer('events','daily')">📅 Điểm Danh</button>
      <button class="sub-tab ${currentSubTab === 'giftcode' ? 'active' : ''}" onclick="openDrawer('events','giftcode')">🎟️ Giftcode</button>
    `;

    if (currentSubTab === 'quests') {
      QUESTS.forEach(q => {
        const cur = Math.min(q.target, q.check(state));
        const done = cur >= q.target;
        const claimed = state.claimedQuests.includes(q.id);
        let btn = `<button class="btn-sm btn-muted">${fmt(cur)}/${fmt(q.target)}</button>`;
        if (claimed) btn = `<button class="btn-sm btn-equipped">Đã nhận</button>`;
        else if (done) btn = `<button class="btn-sm btn-buy" onclick="claimQuest('${q.id}')">Nhận thưởng</button>`;

        body.innerHTML += `
          <div class="card-item">
            <div class="card-left">
              <div class="item-ico">${claimed ? '✅' : (done ? '🎁' : '📌')}</div>
              <div class="item-meta">
                <div class="item-name">${q.title}</div>
                <div class="item-desc">${q.desc}<br>Thưởng: 🪙${fmt(q.rewardGold)} + 💎${q.rewardGems} + 🔑${q.rewardKeys}</div>
              </div>
            </div>
            ${btn}
          </div>
        `;
      });
    } else if (currentSubTab === 'daily') {
      const claimedToday = state.lastDailyDate === todayKey();
      const nextDayIdx = state.dailyStreak % 7;
      let html = `
        <div class="bag-actions">
          <div>
            <div style="font-size:13.5px;font-weight:800;color:#fbbf24;">📅 Điểm danh nhận quà mỗi ngày</div>
            <div style="font-size:11.5px;color:#cbd5e1;">Chuỗi hiện tại: ${state.dailyStreak} ngày</div>
          </div>
          ${claimedToday
            ? `<button class="btn-sm btn-equipped">Đã nhận hôm nay ✓</button>`
            : `<button class="btn-sm btn-buy" onclick="claimDailyReward()">🎁 Điểm danh ngay</button>`}
        </div>
        <div class="daily-grid">
      `;
      DAILY_REWARDS.forEach((d, idx) => {
        const isClaimed = idx < nextDayIdx || (claimedToday && idx === (state.dailyStreak - 1) % 7);
        const isToday = !claimedToday && idx === nextDayIdx;
        html += `
          <div class="daily-card ${isToday ? 'today' : ''} ${isClaimed ? 'claimed' : ''}">
            <div style="font-size:11px;font-weight:800;color:#38bdf8;">NGÀY ${d.day}</div>
            <div style="font-size:28px;">${d.icon}</div>
            <div style="font-size:12px;font-weight:700;">${d.label}</div>
            <div style="font-size:10.5px;color:#94a3b8;">🪙${fmt(d.gold)} • 💎${d.gems}${d.keys ? ' • 🔑' + d.keys : ''}</div>
          </div>
        `;
      });
      html += `</div>`;
      body.innerHTML = html;
    } else {
      body.innerHTML = `
        <div class="card-col">
          <div style="font-size:13.5px;font-weight:800;color:#00f3ff;">🎟️ Nhập Mã Quà Tặng (Giftcode)</div>
          <div style="display:flex;gap:8px;">
            <input class="form-input" id="giftcodeInput" type="text" placeholder="Nhập mã (vd: TANTHU, TRIEUTAM...)" style="text-transform:uppercase;" />
            <button class="btn-sm btn-buy" onclick="redeemGiftcode()">Nhận quà</button>
          </div>
          <div style="font-size:11.5px;color:#94a3b8;line-height:1.5;">
            Gợi ý mã đang hoạt động: <b style="color:#fbbf24;">TANTHU</b>, <b style="color:#fbbf24;">TRIEUTAM</b>, <b style="color:#fbbf24;">SANBOSS</b>, <b style="color:#fbbf24;">GACHA99</b>, <b style="color:#fbbf24;">VIP2026</b>
          </div>
        </div>
        <div class="card-item">
          <div class="item-meta">
            <div class="item-name">📜 Mã đã sử dụng (${state.redeemedCodes.length})</div>
            <div class="item-desc">${state.redeemedCodes.length ? state.redeemedCodes.join(', ') : 'Chưa nhập mã nào.'}</div>
          </div>
        </div>
      `;
    }
  }

  else if (currentDrawer === 'settings') {
    title.textContent = '⚙️ Cài Đặt & Sao Lưu';
    const code = encodeSaveB64(state);
    body.innerHTML = `
      <div class="card-item">
        <div class="item-meta">
          <div class="item-name">📊 Thống kê cần thủ (${escapeHtml(session.displayName)})</div>
          <div class="item-desc">
            Tổng cá đã câu: ${fmt(state.stats.totalCaught)} • Boss đã hạ: ${fmt(state.stats.bossesKilled)}<br>
            Lượt quay Gacha: ${fmt(state.stats.gachaPulls)} • Combo kỷ lục: x${fmt(state.stats.bestStreak || 0)}<br>
            Tổng vàng kiếm được: ${fmt(state.stats.totalEarned)}
          </div>
        </div>
        <button class="btn-sm btn-gem" onclick="openDrawer('account')">👤 Tài khoản</button>
      </div>

      <div class="card-item">
        <div class="item-meta">
          <div class="item-name">🤖 Tự bán cá Thường/Hiếm khi đầy túi (Auto-Fish)</div>
          <div class="item-desc">Giúp treo Auto-Fish liên tục không bị dừng giữa chừng.</div>
        </div>
        <button class="btn-sm ${state.autoSellLow ? 'btn-equip' : 'btn-muted'}" onclick="state.autoSellLow=!state.autoSellLow;saveState();renderDrawer()">
          ${state.autoSellLow ? 'ĐANG BẬT' : 'ĐANG TẮT'}
        </button>
      </div>

      <div class="card-item">
        <div class="item-meta">
          <div class="item-name">📳 Rung phản hồi trên điện thoại</div>
          <div class="item-desc">Rung nhẹ khi cá cắn mồi hoặc Boss xuất hiện.</div>
        </div>
        <button class="btn-sm ${state.vibrate ? 'btn-equip' : 'btn-muted'}" onclick="state.vibrate=!state.vibrate;saveState();renderDrawer()">
          ${state.vibrate ? 'BẬT' : 'TẮT'}
        </button>
      </div>

      <div style="font-size:12.5px;font-weight:700;color:#38bdf8;">Sao lưu / Chuyển dữ liệu thủ công (Mã lưu):</div>
      <textarea class="save-box" id="saveCodeBox">${code}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-sm btn-equip" onclick="copySaveCode()">📋 Sao chép mã</button>
        <button class="btn-sm btn-gem" onclick="importSaveCode()">📥 Nhập mã lưu</button>
        <button class="btn-sm btn-danger" onclick="resetGame()">🗑️ Đặt lại dữ liệu</button>
      </div>
    `;
  }
}

/* ======================== ACTIONS ======================== */
function adminAdd(field, amount) {
  if (!session || session.mode !== 'admin') return;
  state[field] = (state[field] || 0) + amount;
  saveState(); updateHud(); sfx.coin();
  showToast(`👑 Admin đã bơm +${fmt(amount)} ${field}!`, '#ff00ea');
}

function adminAddLevel(delta) {
  if (!session || session.mode !== 'admin') return;
  state.level += delta;
  saveState(); updateHud(); sfx.catch();
  showToast(`👑 Admin đã tăng lên Lv.${state.level}!`, '#ff00ea');
}

function adminRestoreMax() {
  if (!session || session.mode !== 'admin') return;
  state = createAdminState();
  saveState(); Scene3D.setMap(getMap()); updateHud(); renderDrawer(); sfx.catch();
  showToast('👑 Đã khôi phục Full 100% Đồ Admin!', '#ff00ea');
}

function claimDailyReward() {
  if (state.lastDailyDate === todayKey()) return;
  const idx = state.dailyStreak % 7;
  const r = DAILY_REWARDS[idx];
  state.gold += r.gold;
  state.gems += r.gems;
  state.keys += r.keys;
  state.stats.totalEarned += r.gold;
  if (r.bait) state.baitCounts[r.bait.id] = (state.baitCounts[r.bait.id] || 0) + r.bait.qty;
  state.dailyStreak++;
  state.lastDailyDate = todayKey();
  sfx.catch(); saveState(true); updateHud(); renderDrawer();
  showToast(`🎁 Điểm danh Ngày ${r.day}: Nhận ${r.label}!`, '#fbbf24');
}

function redeemGiftcode() {
  const input = document.getElementById('giftcodeInput');
  const code = (input?.value || '').trim().toUpperCase();
  if (!code) return showToast('Vui lòng nhập mã Giftcode!', '#fbbf24');
  const reward = GIFTCODES[code];
  if (!reward) return showToast('❌ Mã Giftcode không tồn tại!', '#f43f5e');
  if (state.redeemedCodes.includes(code)) return showToast('⚠️ Bạn đã nhận mã này rồi!', '#fbbf24');

  state.redeemedCodes.push(code);
  state.gold += reward.gold || 0;
  state.gems += reward.gems || 0;
  state.keys += reward.keys || 0;
  state.stats.totalEarned += reward.gold || 0;
  if (reward.bait) state.baitCounts[reward.bait.id] = (state.baitCounts[reward.bait.id] || 0) + reward.bait.qty;
  sfx.gachaEpic(); saveState(true); updateHud(); renderDrawer();
  showToast(`🎉 Nhập mã ${code} thành công! +${fmt(reward.gold)}🪙 +${reward.gems}💎 +${reward.keys}🔑`, '#10b981');
}

function sortBagByPrice() {
  if (bagSortDesc) {
    state.bag.sort((a, b) => b.price - a.price);
  } else {
    state.bag.sort((a, b) => b.uid - a.uid);
  }
  bagSortDesc = !bagSortDesc;
  saveState();
  renderDrawer();
}

function toggleLockFish(idx) {
  state.bag[idx].locked = !state.bag[idx].locked;
  saveState();
  renderDrawer();
}

function sellSingleFish(idx) {
  if (state.bag[idx].locked) return;
  const p = state.bag[idx].price;
  state.bag.splice(idx, 1);
  state.gold += p;
  state.stats.totalEarned += p;
  sfx.coin(); saveState(); updateHud(); renderDrawer();
}

function sellLowTierFish(silent = false) {
  const keep = [];
  let earned = 0, sold = 0;
  for (const item of state.bag) {
    const f = FISH_DB.find(x => x.id === item.fishId);
    const isLow = f && (f.rarity === 'common' || f.rarity === 'uncommon');
    if (!item.locked && isLow) {
      earned += item.price;
      sold++;
    } else {
      keep.push(item);
    }
  }
  if (sold === 0) {
    if (!silent) showToast('Không có cá Thường/Hiếm chưa khóa để bán!', '#fbbf24');
    return 0;
  }
  state.bag = keep;
  state.gold += earned;
  state.stats.totalEarned += earned;
  sfx.coin(); saveState(); updateHud();
  if (currentDrawer === 'bag') renderDrawer();
  showToast(`💰 Đã bán nhanh ${sold} cá Thường/Hiếm (+${fmt(earned)} 🪙)!`, '#10b981');
  return sold;
}

function sellAllFish() {
  const keep = [];
  let earned = 0, sold = 0;
  for (const item of state.bag) {
    if (item.locked) keep.push(item);
    else { earned += item.price; sold++; }
  }
  if (sold === 0) return showToast('Không có cá chưa khóa để bán!', '#fbbf24');
  state.bag = keep;
  state.gold += earned;
  state.stats.totalEarned += earned;
  sfx.coin(); saveState(true); updateHud(); renderDrawer();
  showToast(`💰 Đã bán ${sold} con cá, thu về +${fmt(earned)} Vàng!`, '#10b981');
}

function buyRod(id) {
  const r = RODS.find(x => x.id === id);
  if (state.gold < r.cost) return showToast('Không đủ Vàng!', '#f43f5e');
  state.gold -= r.cost;
  state.rodsOwned.push(id);
  state.rodId = id;
  sfx.coin(); saveState(true); updateHud(); renderDrawer();
  showToast(`🎣 Đã mua & trang bị ${r.name}!`, '#10b981');
}

function equipRod(id, notify = false) {
  if (!state.rodsOwned.includes(id)) return;
  state.rodId = id;
  const r = RODS.find(x => x.id === id);
  saveState(true); updateHud(); renderDrawer();
  if (notify && r) showToast(`🎣 Đã trang bị ${r.name}!`, '#10b981');
}

function buyBait(id) {
  const b = BAITS.find(x => x.id === id);
  if (state.gold < b.cost) return showToast('Không đủ Vàng!', '#f43f5e');
  state.gold -= b.cost;
  state.baitCounts[id] = (state.baitCounts[id] || 0) + b.pack;
  state.baitId = id;
  sfx.coin(); saveState(); updateHud(); renderDrawer();
  showToast(`🪱 Đã mua +${b.pack} ${b.name}!`, '#10b981');
}

function equipBait(id) {
  const b = BAITS.find(x => x.id === id);
  if (!b.infinite && (state.baitCounts[id] || 0) <= 0) return showToast('Bạn chưa có loại mồi này!', '#f43f5e');
  state.baitId = id;
  saveState(); updateHud(); renderDrawer();
}

function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id);
  const lv = state.upgrades[id] || 0;
  const cost = Math.round(u.baseCost * Math.pow(u.mult, lv));
  if (lv >= u.maxLv) return;
  if (state.gold < cost) return showToast('Không đủ Vàng!', '#f43f5e');
  state.gold -= cost;
  state.upgrades[id] = lv + 1;
  sfx.coin(); saveState(true); updateHud(); renderDrawer();
  showToast(`⚡ Nâng cấp ${u.name} thành công!`, '#10b981');
}

function unlockMap(id) {
  const m = MAPS.find(x => x.id === id);
  if (state.level < m.reqLv) return showToast(`Cần đạt cấp ${m.reqLv}!`, '#f43f5e');
  if (state.gold < m.cost) return showToast('Không đủ Vàng!', '#f43f5e');
  state.gold -= m.cost;
  state.mapsUnlocked.push(id);
  state.mapId = id;
  Scene3D.setMap(m);
  sfx.catch(); saveState(true); updateHud(); renderDrawer();
  showToast(`🗺️ Đã mở khóa & tới bản đồ 3D ${m.name}!`, '#38bdf8');
}

function selectMap(id) {
  if (phase !== 'IDLE') return showToast('Hãy hoàn tất lượt câu trước khi chuyển bản đồ!', '#fbbf24');
  state.mapId = id;
  Scene3D.setMap(getMap());
  saveState(); updateHud(); closeDrawer();
  showToast(`⛵ Đã tới bản đồ 3D ${getMap().name}!`, '#38bdf8');
}

function claimQuest(id) {
  const q = QUESTS.find(x => x.id === id);
  if (state.claimedQuests.includes(id) || q.check(state) < q.target) return;
  state.claimedQuests.push(id);
  state.gold += q.rewardGold;
  state.gems += q.rewardGems;
  state.keys += q.rewardKeys;
  state.stats.totalEarned += q.rewardGold;
  sfx.catch(); saveState(true); updateHud(); renderDrawer();
  showToast(`🎁 Nhận +${fmt(q.rewardGold)}🪙, +${q.rewardGems}💎, +${q.rewardKeys}🔑!`, '#fbbf24');
}

function copySaveCode() {
  const box = document.getElementById('saveCodeBox');
  if (!box) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(box.value).then(() => showToast('📋 Đã sao chép mã lưu!', '#10b981'));
  } else {
    box.select();
    document.execCommand('copy');
    showToast('📋 Đã sao chép mã lưu!', '#10b981');
  }
}

function importSaveCode() {
  try {
    const txt = document.getElementById('saveCodeBox').value.trim();
    const decoded = decodeSaveB64(txt);
    if (typeof decoded.gold !== 'number') throw new Error();
    state = normalizeState(decoded);
    Scene3D.setMap(getMap());
    saveState(true); updateHud(); closeDrawer();
    showToast('✅ Đã khôi phục dữ liệu thành công!', '#10b981');
  } catch {
    showToast('❌ Mã lưu không hợp lệ!', '#f43f5e');
  }
}

function resetGame() {
  if (!confirm('Xóa toàn bộ tiến trình của tài khoản hiện tại và chơi lại từ đầu?')) return;
  state = session.mode === 'admin' ? createAdminState() : defaultState();
  activeBoss = null;
  nextBossCountdown = 40;
  catchStreak = 0;
  feverTimeLeft = 0;
  Scene3D.setMap(getMap());
  saveState(true); updateHud(); updateBossUI(); closeDrawer();
  showToast('🔄 Đã đặt lại tiến trình!', '#fbbf24');
}

/* ======================== BOOTSTRAP ======================== */
function initApp() {
  Scene3D.init(document.getElementById('scene3dContainer'));
  Scene3D.setMap(MAPS[0]);

  try {
    const savedSess = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (savedSess && ['admin', 'guest', 'user'].includes(savedSess.mode)) {
      session = savedSess;
      state = loadStateForSession(session);
      Scene3D.setMap(getMap());

      if (CLOUD_ENABLED && session.mode === 'user') {
        cloudFetchAccount(session.username).then(row => {
          if (row && row.save_data) {
            state = normalizeState(row.save_data);
            if (row.display_name) session.displayName = row.display_name;
            localStorage.setItem(getSaveKey(session), JSON.stringify(state));
            Scene3D.setMap(getMap());
            updateHud();
          }
        }).catch(() => {});
      }
      updateHud();
      updateBossUI();
      updateActionBtn();
    } else {
      document.getElementById('authOverlay').classList.add('show');
    }
  } catch {
    document.getElementById('authOverlay').classList.add('show');
  }

  window.addEventListener('beforeunload', () => {
    if (session && session.mode === 'user') cloudSaveState(true);
  });

  requestAnimationFrame(loop);
}

initApp();
