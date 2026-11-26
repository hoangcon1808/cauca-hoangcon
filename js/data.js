/* ======================== GAME CONFIG & STATIC DATA ======================== */
const SUPABASE_URL = 'https://exftrdnscvpipfioiwkg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xfTc4V6N3avkR8STSl6IrQ_nnxZ3_k7';
const CLOUD_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY);

// Tài khoản Admin có sẵn (Offline hoàn toàn, không cần Supabase)
const BUILTIN_ADMIN = {
  username: 'admin',
  password: 'admin123',
  displayName: '👑 ADMIN TỐI THƯỢNG'
};

const RARITIES = {
  common:    { name: 'Thường',     color: '#cbd5e1', xp: 12,  speed: 24, erratic: 1.75, drain: 14, weight: 52 },
  uncommon:  { name: 'Hiếm',       color: '#4ade80', xp: 24,  speed: 34, erratic: 1.40, drain: 17, weight: 25 },
  rare:      { name: 'Quý',        color: '#38bdf8', xp: 48,  speed: 46, erratic: 1.10, drain: 21, weight: 13 },
  epic:      { name: 'Sử Thi',     color: '#c084fc', xp: 95,  speed: 58, erratic: 0.88, drain: 25, weight: 6.5 },
  legendary: { name: 'Huyền Thoại',color: '#fbbf24', xp: 200, speed: 72, erratic: 0.68, drain: 29, weight: 2.8 },
  mythical:  { name: 'Thần Thoại', color: '#fb7185', xp: 450, speed: 88, erratic: 0.52, drain: 33, weight: 0.7 }
};

// 7 BẢN ĐỒ 3D VỚI BIOME & HIỆU ỨNG RIÊNG
const MAPS = [
  {
    id: 'pond', name: 'Hồ Làng Quê', icon: '🏞️', reqLv: 1, cost: 0, biome: 'pond',
    skyHex: 0x3898d8, fogHex: 0x7dd3fc, waterHex: 0x0e8aa8, deepHex: 0x064e63, sunHex: 0xfff3b0,
    swatch: 'linear-gradient(135deg,#38bdf8,#10b981)',
    desc: 'Đồi xanh, lá sen nổi & trời trong lành cho cần thủ mới.'
  },
  {
    id: 'river', name: 'Sông Mê Kông', icon: '🌾', reqLv: 3, cost: 450, biome: 'river',
    skyHex: 0xc25951, fogHex: 0xe88d67, waterHex: 0x1b6b68, deepHex: 0x0a383a, sunHex: 0xff9e5e,
    swatch: 'linear-gradient(135deg,#fb923c,#9a3412)',
    desc: 'Hoàng hôn đỏ rực, rặng dừa ven sông phù sa đầy cá lớn.'
  },
  {
    id: 'bay', name: 'Vịnh San Hô', icon: '🏝️', reqLv: 6, cost: 2200, biome: 'bay',
    skyHex: 0x0ea5e9, fogHex: 0x38bdf8, waterHex: 0x06b6d4, deepHex: 0x0e7490, sunHex: 0xfef08a,
    swatch: 'linear-gradient(135deg,#06b6d4,#0284c7)',
    desc: 'Đảo cát trắng, san hô rực rỡ dưới làn nước ngọc bích.'
  },
  {
    id: 'ocean', name: 'Biển Đông Sâu', icon: '🌊', reqLv: 10, cost: 8500, biome: 'ocean',
    skyHex: 0x0b1536, fogHex: 0x172554, waterHex: 0x0c3469, deepHex: 0x04122b, sunHex: 0xe2e8f0,
    swatch: 'linear-gradient(135deg,#1e3a8a,#020617)',
    desc: 'Biển đêm đầy sao, ngọn hải đăng xoay & sóng lớn.'
  },
  {
    id: 'arctic', name: 'Biển Băng Bắc Cực', icon: '❄️', reqLv: 14, cost: 18000, biome: 'arctic',
    skyHex: 0x0c2440, fogHex: 0x1e4068, waterHex: 0x155e75, deepHex: 0x082f49, sunHex: 0x67e8f9,
    swatch: 'linear-gradient(135deg,#67e8f9,#1e3a8a)',
    desc: 'Tảng băng trôi 3D, cực quang xanh ngọc & tuyết rơi trắng xóa.'
  },
  {
    id: 'volcano', name: 'Đảo Núi Lửa Dung Nham', icon: '🌋', reqLv: 18, cost: 42000, biome: 'volcano',
    skyHex: 0x2a0808, fogHex: 0x5c1414, waterHex: 0x6b1c1c, deepHex: 0x290707, sunHex: 0xff5722,
    swatch: 'linear-gradient(135deg,#ef4444,#450a0a)',
    desc: 'Núi lửa phun tàn tro phát sáng, nơi ẩn náu của quái vật hỏa diệm.'
  },
  {
    id: 'trench', name: 'Rãnh Mariana Huyền Bí', icon: '🌌', reqLv: 22, cost: 85000, biome: 'trench',
    skyHex: 0x120428, fogHex: 0x2e1065, waterHex: 0x1e1b4b, deepHex: 0x050214, sunHex: 0xc084fc,
    swatch: 'linear-gradient(135deg,#9333ea,#090314)',
    desc: 'Tinh thể phát quang neon & vực thẳm của các sinh vật Thần Thoại.'
  }
];

// 35 LOÀI CÁ TRẢI ĐỀU 7 BẢN ĐỒ
const FISH_DB = [
  // Hồ Làng Quê
  { id: 'f1',  name: 'Cá Rô Phi',             emoji: '🐟', rarity: 'common',    maps: ['pond','river'], minW: 0.3, maxW: 1.5, basePrice: 18 },
  { id: 'f2',  name: 'Cá Diếc Bạc',           emoji: '🐠', rarity: 'common',    maps: ['pond'],         minW: 0.2, maxW: 1.0, basePrice: 15 },
  { id: 'f3',  name: 'Cá Chép Vàng',          emoji: '🎏', rarity: 'uncommon',  maps: ['pond','river'], minW: 1.0, maxW: 4.5, basePrice: 42 },
  { id: 'f4',  name: 'Cá Trê Đồng',           emoji: '🐡', rarity: 'uncommon',  maps: ['pond','river'], minW: 0.8, maxW: 3.8, basePrice: 46 },
  { id: 'f5',  name: 'Cá Lóc Bông',           emoji: '🐊', rarity: 'rare',      maps: ['pond','river'], minW: 2.0, maxW: 8.0, basePrice: 110 },
  { id: 'f6',  name: 'Cá Koi Tam Sắc',        emoji: '🏮', rarity: 'epic',      maps: ['pond'],         minW: 3.0, maxW: 9.0, basePrice: 260 },

  // Sông Mê Kông
  { id: 'f7',  name: 'Cá Linh Non',           emoji: '🐟', rarity: 'common',    maps: ['river'],        minW: 0.2, maxW: 0.8, basePrice: 28 },
  { id: 'f8',  name: 'Tôm Càng Xanh',         emoji: '🦐', rarity: 'uncommon',  maps: ['river','bay'],  minW: 0.3, maxW: 1.2, basePrice: 75 },
  { id: 'f9',  name: 'Cá Hô Khổng Lồ',        emoji: '🐋', rarity: 'rare',      maps: ['river'],        minW: 12,  maxW: 45,  basePrice: 185 },
  { id: 'f10', name: 'Cá Tra Dầu',            emoji: '🦈', rarity: 'epic',      maps: ['river'],        minW: 25,  maxW: 90,  basePrice: 420 },
  { id: 'f11', name: 'Cá Rồng Huyết Long',    emoji: '🐉', rarity: 'legendary', maps: ['river','pond'], minW: 4.0, maxW: 14,  basePrice: 980 },

  // Vịnh San Hô
  { id: 'f12', name: 'Cá Hề Nemo',            emoji: '🐠', rarity: 'common',    maps: ['bay'],          minW: 0.2, maxW: 0.6, basePrice: 55 },
  { id: 'f13', name: 'Cua Hoàng Đế',          emoji: '🦀', rarity: 'uncommon',  maps: ['bay','ocean'],  minW: 1.5, maxW: 6.0, basePrice: 135 },
  { id: 'f14', name: 'Mực Ống Ánh Kim',       emoji: '🦑', rarity: 'rare',      maps: ['bay','ocean'],  minW: 1.0, maxW: 5.5, basePrice: 270 },
  { id: 'f15', name: 'Tôm Hùm Alaska',        emoji: '🦞', rarity: 'epic',      maps: ['bay','arctic'], minW: 2.0, maxW: 8.5, basePrice: 590 },
  { id: 'f16', name: 'Rùa Biển Ngọc',         emoji: '🐢', rarity: 'legendary', maps: ['bay'],          minW: 18,  maxW: 65,  basePrice: 1450 },

  // Biển Đông Sâu
  { id: 'f17', name: 'Cá Thu Đại Dương',      emoji: '🐟', rarity: 'common',    maps: ['ocean'],        minW: 3.0, maxW: 12,  basePrice: 115 },
  { id: 'f18', name: 'Cá Ngừ Vây Xanh',       emoji: '🐬', rarity: 'uncommon',  maps: ['ocean'],        minW: 15,  maxW: 80,  basePrice: 280 },
  { id: 'f19', name: 'Cá Kiếm Bạc',           emoji: '🗡️', rarity: 'rare',      maps: ['ocean'],        minW: 20,  maxW: 110, basePrice: 540 },
  { id: 'f20', name: 'Cá Mập Trắng',          emoji: '🦈', rarity: 'epic',      maps: ['ocean','trench'],minW: 80, maxW: 320, basePrice: 1150 },
  { id: 'f21', name: 'Cá Voi Xanh',           emoji: '🐳', rarity: 'legendary', maps: ['ocean','arctic'],minW: 250,maxW: 900, basePrice: 2800 },

  // Biển Băng Bắc Cực
  { id: 'f26', name: 'Cá Tuyết Bắc Cực',      emoji: '🐟', rarity: 'common',    maps: ['arctic'],       minW: 2.0, maxW: 9.0, basePrice: 195 },
  { id: 'f27', name: 'Cá Hồi Băng Giá',       emoji: '🐠', rarity: 'uncommon',  maps: ['arctic'],       minW: 3.0, maxW: 14,  basePrice: 420 },
  { id: 'f28', name: 'Kỳ Lân Biển Narwhal',   emoji: '🦄', rarity: 'rare',      maps: ['arctic'],       minW: 60,  maxW: 240, basePrice: 920 },
  { id: 'f29', name: 'Cá Voi Sát Thủ Orca',   emoji: '🐋', rarity: 'epic',      maps: ['arctic'],       minW: 180, maxW: 620, basePrice: 1950 },
  { id: 'f30', name: 'Băng Long Cực Quang',   emoji: '❄️', rarity: 'legendary', maps: ['arctic'],       minW: 140, maxW: 480, basePrice: 4200 },

  // Đảo Núi Lửa Dung Nham
  { id: 'f31', name: 'Cá Tro Hỏa Diệm',       emoji: '🐟', rarity: 'common',    maps: ['volcano'],      minW: 2.5, maxW: 10,  basePrice: 310 },
  { id: 'f32', name: 'Cua Nham Thạch',        emoji: '🦀', rarity: 'uncommon',  maps: ['volcano'],      minW: 4.0, maxW: 16,  basePrice: 680 },
  { id: 'f33', name: 'Lươn Lửa Địa Ngục',     emoji: '🐍', rarity: 'rare',      maps: ['volcano'],      minW: 12,  maxW: 48,  basePrice: 1450 },
  { id: 'f34', name: 'Cá Mập Magma',          emoji: '🦈', rarity: 'epic',      maps: ['volcano'],      minW: 95,  maxW: 380, basePrice: 3100 },
  { id: 'f35', name: 'Phượng Hoàng Dung Nham',emoji: '🔥', rarity: 'mythical',  maps: ['volcano'],      minW: 160, maxW: 777, basePrice: 12500 },

  // Rãnh Mariana Huyền Bí
  { id: 'f22', name: 'Cá Đèn Lồng Vực Thẳm',  emoji: '🏮', rarity: 'uncommon',  maps: ['trench'],       minW: 1.5, maxW: 6.5, basePrice: 720 },
  { id: 'f23', name: 'Bạch Tuộc Ma Neon',     emoji: '🐙', rarity: 'rare',      maps: ['trench'],       minW: 8.0, maxW: 35,  basePrice: 1650 },
  { id: 'f24', name: 'Thủy Quái Kraken',      emoji: '🦑', rarity: 'legendary', maps: ['trench'],       minW: 120, maxW: 500, basePrice: 5600 },
  { id: 'f25', name: 'Rồng Biển Đông Tối Thượng', emoji: '🐲', rarity: 'mythical', maps: ['trench','ocean'], minW: 200, maxW: 999, basePrice: 14800 }
];

// 14 CẦN CÂU (7 SHOP + 7 GACHA ĐỘC QUYỀN)
const RODS = [
  { id: 'bamboo',   name: 'Cần Tre Làng',            icon: '🎋', rarity: 'common',    gachaOnly: false, cost: 0,      luck: 0,   barWidth: 25, power: 1.0,  bossDmg: 1.0,  slow: 0,    goldBonus: 0,    color: '#d6d3d1', desc: 'Cần khởi đầu, nhẹ và dễ làm quen.' },
  { id: 'fiber',    name: 'Cần Thủy Tinh',           icon: '🎣', rarity: 'uncommon',  gachaOnly: false, cost: 320,    luck: 12,  barWidth: 28, power: 1.2,  bossDmg: 1.15, slow: 0,    goldBonus: 0,    color: '#4ade80', desc: '+12% May mắn, thanh kéo rộng hơn.' },
  { id: 'carbon',   name: 'Cần Carbon Pro',          icon: '⚡', rarity: 'rare',      gachaOnly: false, cost: 1600,   luck: 28,  barWidth: 32, power: 1.45, bossDmg: 1.3,  slow: 0,    goldBonus: 0,    color: '#38bdf8', desc: '+28% May mắn, +30% Sát thương Boss.' },
  { id: 'titanium', name: 'Cần Titan Hoàng Kim',     icon: '👑', rarity: 'epic',      gachaOnly: false, cost: 6500,   luck: 50,  barWidth: 36, power: 1.75, bossDmg: 1.5,  slow: 0.05, goldBonus: 0.05, color: '#c084fc', desc: '+50% May mắn, +50% Sát thương Boss.' },
  { id: 'lunar',    name: 'Cần Ánh Trăng',           icon: '🌙', rarity: 'legendary', gachaOnly: false, cost: 22000,  luck: 80,  barWidth: 40, power: 2.1,  bossDmg: 1.8,  slow: 0.10, goldBonus: 0.10, color: '#fbbf24', desc: '+80% May mắn, làm chậm cá 10%.' },
  { id: 'poseidon', name: 'Đinh Ba Poseidon',        icon: '🔱', rarity: 'mythical',  gachaOnly: false, cost: 68000,  luck: 130, barWidth: 44, power: 2.55, bossDmg: 2.2,  slow: 0.15, goldBonus: 0.15, color: '#fb7185', desc: 'Thần khí biển cả, chuyên săn Thần Thoại.' },
  { id: 'obsidian', name: 'Cần Hắc Diện Thạch',      icon: '🌋', rarity: 'mythical',  gachaOnly: false, cost: 165000, luck: 170, barWidth: 46, power: 2.85, bossDmg: 2.6,  slow: 0.20, goldBonus: 0.22, color: '#f97316', desc: 'Rèn từ lõi núi lửa, chuyên trị cá vùng Dung Nham.' },

  { id: 'g_coral',  name: 'Cần San Hô Đỏ',           icon: '🪸', rarity: 'rare',      gachaOnly: true,  cost: 0, luck: 40,  barWidth: 34, power: 1.55, bossDmg: 1.45, slow: 0.08, goldBonus: 0.08, color: '#38bdf8', desc: '[GACHA] +40% May mắn, +45% Sát thương Boss.' },
  { id: 'g_frost',  name: 'Cần Băng Bắc Cực',        icon: '❄️', rarity: 'epic',      gachaOnly: true,  cost: 0, luck: 75,  barWidth: 38, power: 1.85, bossDmg: 1.65, slow: 0.24, goldBonus: 0.10, color: '#67e8f9', desc: '[GACHA] Đóng băng làm chậm cá 24% cực dễ kéo!' },
  { id: 'g_zeus',   name: 'Cần Sấm Sét Zeus',        icon: '🌩️', rarity: 'epic',      gachaOnly: true,  cost: 0, luck: 90,  barWidth: 38, power: 2.0,  bossDmg: 2.25, slow: 0.12, goldBonus: 0.12, color: '#c084fc', desc: '[GACHA] Chuyên diệt Thủy Quái: +125% Sát thương Boss!' },
  { id: 'g_aurora', name: 'Cần Cực Quang Đêm',       icon: '🌠', rarity: 'legendary', gachaOnly: true,  cost: 0, luck: 140, barWidth: 43, power: 2.4,  bossDmg: 2.4,  slow: 0.22, goldBonus: 0.25, color: '#34d399', desc: '[GACHA] Ánh sáng cực quang hút cá Quý & Huyền Thoại.' },
  { id: 'g_phoenix',name: 'Cần Phượng Hoàng Lửa',    icon: '🔥', rarity: 'legendary', gachaOnly: true,  cost: 0, luck: 150, barWidth: 44, power: 2.5,  bossDmg: 2.6,  slow: 0.18, goldBonus: 0.35, color: '#fbbf24', desc: '[GACHA] +35% Vàng bán cá, +160% Sát thương Boss.' },
  { id: 'g_galaxy', name: 'Cần Ngân Hà Vô Cực',      icon: '🌌', rarity: 'mythical',  gachaOnly: true,  cost: 0, luck: 220, barWidth: 48, power: 3.0,  bossDmg: 3.0,  slow: 0.28, goldBonus: 0.40, color: '#a855f7', desc: '[GACHA] Làm chậm cá 28%, +220% May mắn!' },
  { id: 'g_dragon', name: 'Cần Long Thần Triệu Tâm', icon: '🐉', rarity: 'mythical',  gachaOnly: true,  cost: 0, luck: 280, barWidth: 52, power: 3.5,  bossDmg: 3.8,  slow: 0.35, goldBonus: 0.50, color: '#ff00ea', desc: '[GACHA TỐI THƯỢNG] Thần khí mạnh nhất đại dương!' }
];

const BAITS = [
  { id: 'worm',   name: 'Giun Đất',      icon: '🪱', cost: 0,    pack: 1,  luck: 0,   speed: 0,    infinite: true,  desc: 'Mồi miễn phí vô hạn.' },
  { id: 'bran',   name: 'Cám Thơm',      icon: '🌾', cost: 80,   pack: 10, luck: 15,  speed: 0.15, infinite: false, desc: '10 mồi • +15% May mắn, cắn nhanh 15%.' },
  { id: 'shrimp', name: 'Tôm Tươi',      icon: '🦐', cost: 260,  pack: 10, luck: 35,  speed: 0.28, infinite: false, desc: '10 mồi • +35% May mắn, cắn nhanh 28%.' },
  { id: 'glow',   name: 'Mồi Phát Sáng', icon: '✨', cost: 850,  pack: 10, luck: 70,  speed: 0.42, infinite: false, desc: '10 mồi • +70% May mắn, hút cá biển sâu.' },
  { id: 'mystic', name: 'Ngọc Mồi Thần', icon: '🔮', cost: 2500, pack: 8,  luck: 150, speed: 0.58, infinite: false, desc: '8 mồi • +150% May mắn săn Thần Thoại!' }
];

const UPGRADES = [
  { id: 'bag',   name: 'Mở Rộng Túi Cá',  icon: '🎒', maxLv: 10, baseCost: 200,  mult: 1.85, desc: '+5 sức chứa túi mỗi cấp.' },
  { id: 'speed', name: 'Kỹ Thuật Nhử Mồi',icon: '⏱️', maxLv: 6,  baseCost: 300,  mult: 2.1,  desc: 'Giảm 10% thời gian chờ cá cắn.' },
  { id: 'price', name: 'Thương Lái VIP',  icon: '💰', maxLv: 8,  baseCost: 450,  mult: 2.15, desc: '+12% giá bán tất cả các loại cá.' },
  { id: 'auto',  name: 'Máy Câu Tự Động', icon: '🤖', maxLv: 1,  baseCost: 1200, mult: 1.0,  desc: 'Mở khóa chế độ Auto-Fish rảnh tay!' }
];

// 5 BOSS THỦY QUÁI 3D
const BOSS_DB = [
  { id: 'b1', name: 'Cua Khổng Lồ Thiết Giáp', emoji: '🦀', colorHex: 0xef4444, rarity: 'epic',      hp: 340,  speed: 54, erratic: 0.95, drain: 19, rewardGold: 1200,  rewardGems: 12, rewardKeys: 1, xp: 180,  minLv: 1 },
  { id: 'b2', name: 'Mãng Xà Biển Đen',        emoji: '🐍', colorHex: 0x10b981, rarity: 'epic',      hp: 580,  speed: 64, erratic: 0.80, drain: 22, rewardGold: 2800,  rewardGems: 20, rewardKeys: 2, xp: 320,  minLv: 3 },
  { id: 'b3', name: 'Hải Vương Kraken Cổ Đại', emoji: '🦑', colorHex: 0xa855f7, rarity: 'legendary', hp: 920,  speed: 74, erratic: 0.68, drain: 25, rewardGold: 6200,  rewardGems: 35, rewardKeys: 3, xp: 600,  minLv: 6 },
  { id: 'b4', name: 'Rồng Dung Nham Hắc Ám',   emoji: '🔥', colorHex: 0xf97316, rarity: 'mythical',  hp: 1350, speed: 80, erratic: 0.60, drain: 27, rewardGold: 11500, rewardGems: 48, rewardKeys: 4, xp: 950,  minLv: 10 },
  { id: 'b5', name: 'Long Vương Hủy Diệt',     emoji: '🐉', colorHex: 0xff00ea, rarity: 'mythical',  hp: 1850, speed: 86, erratic: 0.55, drain: 29, rewardGold: 18000, rewardGems: 65, rewardKeys: 6, xp: 1500, minLv: 14 }
];

const CHESTS = {
  pirate: {
    id: 'pirate', name: 'Rương Hải Tặc', icon: '🧰',
    gemCost: 15, gemCost10: 135, keyCost: 1,
    desc: 'Tỉ lệ ra Cần Quý/Sử Thi/Huyền Thoại + Gói Mồi & Vàng.',
    rates: { mythical: 1.8, legendary: 6.2, epic: 17, rare: 32, bonus: 43 }
  },
  divine: {
    id: 'divine', name: 'Rương Thần Biển VIP', icon: '👑',
    gemCost: 45, gemCost10: 400, keyCost: 3,
    desc: 'Tỉ lệ CỰC CAO ra Cần Sử Thi, Huyền Thoại & Thần Thoại!',
    rates: { mythical: 7.5, legendary: 19.5, epic: 35, rare: 26, bonus: 12 }
  }
};

const QUESTS = [
  { id: 'q1', title: 'Khởi đầu cần thủ',    desc: 'Câu được 5 con cá bất kỳ',          target: 5,    check: s => s.stats.totalCaught,   rewardGold: 180,  rewardGems: 8,  rewardKeys: 1 },
  { id: 'q2', title: 'Thợ câu chăm chỉ',    desc: 'Câu được 25 con cá',                target: 25,   check: s => s.stats.totalCaught,   rewardGold: 700,  rewardGems: 15, rewardKeys: 2 },
  { id: 'q3', title: 'Kẻ săn Thủy Quái',    desc: 'Hạ gục 1 Boss Thủy Quái 3D',        target: 1,    check: s => s.stats.bossesKilled,  rewardGold: 1400, rewardGems: 20, rewardKeys: 2 },
  { id: 'q4', title: 'Khắc tinh Đại Dương', desc: 'Hạ gục 5 Boss Thủy Quái 3D',        target: 5,    check: s => s.stats.bossesKilled,  rewardGold: 5000, rewardGems: 45, rewardKeys: 5 },
  { id: 'q5', title: 'Thử vận may Gacha',   desc: 'Mở 5 Rương Cần Câu bất kỳ',         target: 5,    check: s => s.stats.gachaPulls,    rewardGold: 1200, rewardGems: 25, rewardKeys: 2 },
  { id: 'q6', title: 'Nhà thám hiểm 3D',    desc: 'Mở khóa 4 bản đồ 3D',               target: 4,    check: s => s.mapsUnlocked.length, rewardGold: 3200, rewardGems: 35, rewardKeys: 3 },
  { id: 'q7', title: 'Nhà sưu tầm',         desc: 'Mở khóa 15 loài trong Bộ sưu tập',  target: 15,   check: s => Object.keys(s.dex).length, rewardGold: 2800, rewardGems: 35, rewardKeys: 3 },
  { id: 'q8', title: 'Huyền thoại biển cả', desc: 'Câu được 1 cá Huyền Thoại trở lên', target: 1,    check: s => s.stats.legendCaught,  rewardGold: 5500, rewardGems: 50, rewardKeys: 4 }
];

// QUÀ ĐIỂM DANH 7 NGÀY
const DAILY_REWARDS = [
  { day: 1, icon: '🪙', label: '500 Vàng',       gold: 500,  gems: 5,  keys: 0 },
  { day: 2, icon: '🦐', label: '15 Tôm Tươi',    gold: 300,  gems: 8,  keys: 1, bait: { id: 'shrimp', qty: 15 } },
  { day: 3, icon: '💎', label: '25 Kim Cương',   gold: 800,  gems: 25, keys: 1 },
  { day: 4, icon: '🔑', label: '3 Chìa Gacha',   gold: 1200, gems: 15, keys: 3 },
  { day: 5, icon: '✨', label: '15 Mồi Sáng',    gold: 2000, gems: 25, keys: 2, bait: { id: 'glow', qty: 15 } },
  { day: 6, icon: '💎', label: '50 Kim Cương',   gold: 3500, gems: 50, keys: 3 },
  { day: 7, icon: '👑', label: 'Rương Siêu VIP', gold: 8000, gems: 90, keys: 6, bait: { id: 'mystic', qty: 10 } }
];

// MÃ GIFTCODE QUÀ TẶNG
const GIFTCODES = {
  TANTHU:   { label: 'Quà Tân Thủ',      gold: 1000, gems: 20, keys: 2 },
  TRIEUTAM: { label: 'Triệu Tâm 3D',     gold: 2500, gems: 35, keys: 3 },
  SANBOSS:  { label: 'Chiến Thần Boss',  gold: 1500, gems: 25, keys: 3, bait: { id: 'glow', qty: 10 } },
  GACHA99:  { label: 'Chìa Khóa Vàng',   gold: 500,  gems: 30, keys: 5 },
  VIP2026:  { label: 'Đặc Quyền VIP',    gold: 5000, gems: 60, keys: 4, bait: { id: 'mystic', qty: 8 } }
};
