// ゲームのバランス値はこの先頭の CONFIG の中にまとめています。
// ここを変えると、少しずつ難しさや成長の速さを調整しやすくなります。
const CONFIG = {
  initialClickPower: 1,
  shop: [
    {
      key: 'spatula',
      emoji: '🥄',
      name: '丈夫な木べら',
      description: '生地をこねて、1回のタップでたくさん作りやすくします。',
      basePrice: 12,
      growth: 1.15,
      clickBonus: 1,
      autoBonus: 0,
      multiplierBonus: 1,
      effectLabel: '1個につき +1 タップ生産数'
    },
    {
      key: 'apprentice',
      emoji: '👩‍🍳',
      name: '見習い職人',
      description: '少しずつ丁寧に焼き上げて、毎秒お菓子を増やします。',
      basePrice: 35,
      growth: 1.18,
      clickBonus: 0,
      autoBonus: 1,
      multiplierBonus: 1,
      effectLabel: '1個につき +1 /秒'
    },
    {
      key: 'veteran',
      emoji: '🧑‍🍳',
      name: 'ベテラン職人',
      description: '手早く焼きながら、安定した生産量を作ります。',
      basePrice: 140,
      growth: 1.22,
      clickBonus: 0,
      autoBonus: 7,
      multiplierBonus: 1,
      effectLabel: '1個につき +7 /秒'
    },
    {
      key: 'oven',
      emoji: '🔥',
      name: '魔法のオーブン',
      description: '一気に焼き上げて、たくさんの菓子を作ります。',
      basePrice: 500,
      growth: 1.25,
      clickBonus: 0,
      autoBonus: 24,
      multiplierBonus: 1,
      effectLabel: '1個につき +24 /秒'
    },
    {
      key: 'dreamFactory',
      emoji: '🏭',
      name: '夢のお菓子工房',
      description: '工房全体の生産量を大きく伸ばす夢の設備です。',
      basePrice: 1800,
      growth: 1.28,
      clickBonus: 0,
      autoBonus: 0,
      multiplierBonus: 1.3,
      effectLabel: '1個につき +30% の自動生産ボーナス'
    }
  ],
  offlineCapSeconds: 60 * 60 * 8,
  offlineMultiplier: 0.5,
  dreamFactoryBonus: 0.3,
  saveIntervalMs: 10000,
  achievementDefinitions: [
    {
      key: 'first-bake',
      title: 'はじめてのひと焼き',
      description: '初めてお菓子をタップして作る'
    },
    {
      key: 'hundred-bakes',
      title: 'お菓子100個',
      description: '累計100個のお菓子を作る'
    },
    {
      key: 'busy-kitchen',
      title: 'にぎやかな工房',
      description: '職人を合計5人雇う'
    },
    {
      key: 'bakery-pro',
      title: 'お菓子職人',
      description: '累計1,000個のお菓子を作る'
    },
    {
      key: 'dream-factory',
      title: '夢の工房',
      description: '夢のお菓子工房を購入する'
    }
  ]
};

const STORAGE_KEY = 'manmaru-bakery-save-v1';
const LEGACY_STORAGE_KEYS = ['indie-studio-save-v1'];

const state = {
  points: 0,
  totalPoints: 0,
  totalClicks: 0,
  owned: {},
  achievements: {},
  lastSavedAt: Date.now()
};

const refs = {
  pointsDisplay: null,
  clickPowerDisplay: null,
  autoPowerDisplay: null,
  totalPointsDisplay: null,
  bakeryButton: null,
  shopList: null,
  achievementList: null,
  toast: null,
  resetButton: null,
  resetModal: null,
  confirmReset: null,
  cancelReset: null
};

function defaultOwnedState() {
  return {
    spatula: 0,
    apprentice: 0,
    veteran: 0,
    oven: 0,
    dreamFactory: 0
  };
}

function formatNumber(value) {
  return Math.floor(value).toLocaleString('ja-JP');
}

function getItemByKey(key) {
  return CONFIG.shop.find((item) => item.key === key);
}

function getClickPower() {
  const spatulaItem = getItemByKey('spatula');
  return CONFIG.initialClickPower + (state.owned.spatula || 0) * spatulaItem.clickBonus;
}

function getAutoPowerFromOwned(ownedData) {
  const owned = ownedData || state.owned;
  const apprenticePower = (owned.apprentice || 0) * getItemByKey('apprentice').autoBonus;
  const veteranPower = (owned.veteran || 0) * getItemByKey('veteran').autoBonus;
  const ovenPower = (owned.oven || 0) * getItemByKey('oven').autoBonus;
  const basePower = apprenticePower + veteranPower + ovenPower;
  const dreamFactoryCount = owned.dreamFactory || 0;
  const dreamMultiplier = 1 + dreamFactoryCount * CONFIG.dreamFactoryBonus;
  return basePower * dreamMultiplier;
}

function getAutoPower() {
  return getAutoPowerFromOwned(state.owned);
}

function getItemPrice(key) {
  const item = getItemByKey(key);
  const ownedCount = state.owned[key] || 0;
  return Math.floor(item.basePrice * Math.pow(item.growth, ownedCount));
}

function addPoints(rawAmount, source = 'click') {
  const amount = Math.max(0, rawAmount);
  state.points += amount;
  state.totalPoints += amount;

  if (source === 'click') {
    state.totalClicks += 1;
  }

  if (source === 'click') {
    spawnFloatingText('+' + formatNumber(amount));
  }

  updateAchievements();
  renderStatus();
  renderShop();
}

function spawnFloatingText(text) {
  const popup = document.createElement('div');
  popup.className = 'floating-point';
  popup.textContent = text;
  popup.style.left = `${Math.random() * 60 + 20}%`;
  popup.style.top = `${Math.random() * 50 + 40}%`;
  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 900);
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add('show');

  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    refs.toast.classList.remove('show');
  }, 1400);
}

function renderStatus() {
  refs.pointsDisplay.textContent = formatNumber(state.points);
  refs.clickPowerDisplay.textContent = formatNumber(getClickPower());
  refs.autoPowerDisplay.textContent = formatNumber(getAutoPower());
  refs.totalPointsDisplay.textContent = formatNumber(state.totalPoints);
}

function renderShop() {
  refs.shopList.innerHTML = CONFIG.shop.map((item) => {
    const ownedCount = state.owned[item.key] || 0;
    const price = getItemPrice(item.key);
    const canAfford = state.points >= price;

    return `
      <div class="shop-item">
        <div class="shop-header">
          <div class="shop-icon">${item.emoji}</div>
          <div>
            <h3>${item.name}</h3>
            <p>${item.description}</p>
          </div>
        </div>

        <div class="shop-stats">
          <span>価格: ${formatNumber(price)}</span>
          <span>所持: ${ownedCount}</span>
          <span>効果: ${item.effectLabel}</span>
        </div>

        <button
          type="button"
          class="shop-buy ${canAfford ? '' : 'disabled'}"
          data-item-key="${item.key}"
          ${canAfford ? '' : 'disabled'}
        >
          ${canAfford ? '購入する' : 'お菓子不足'}
        </button>
      </div>
    `;
  }).join('');
}

function renderAchievements() {
  refs.achievementList.innerHTML = CONFIG.achievementDefinitions.map((achievement) => {
    const isUnlocked = Boolean(state.achievements[achievement.key]);

    return `
      <li class="achievement-item ${isUnlocked ? 'unlocked' : ''}">
        <div class="achievement-text">
          <span class="achievement-name">${achievement.title}</span>
          <span class="achievement-desc">${achievement.description}</span>
        </div>
        <span class="achievement-state">${isUnlocked ? '達成' : '未達成'}</span>
      </li>
    `;
  }).join('');
}

function updateAchievements() {
  const totalStaff = (state.owned.apprentice || 0) + (state.owned.veteran || 0) + (state.owned.oven || 0);

  const checks = {
    'first-bake': state.totalClicks > 0,
    'hundred-bakes': state.totalPoints >= 100,
    'busy-kitchen': totalStaff >= 5,
    'bakery-pro': state.totalPoints >= 1000,
    'dream-factory': (state.owned.dreamFactory || 0) > 0
  };

  Object.entries(checks).forEach(([key, condition]) => {
    if (condition && !state.achievements[key]) {
      state.achievements[key] = true;
      showToast(`実績達成: ${getAchievementTitle(key)}`);
    }
  });

  renderAchievements();
}

function getAchievementTitle(key) {
  const match = CONFIG.achievementDefinitions.find((item) => item.key === key);
  return match ? match.title : '実績';
}

function buyItem(key) {
  const item = getItemByKey(key);
  const price = getItemPrice(key);

  if (state.points < price) {
    return;
  }

  state.points -= price;
  state.owned[key] = (state.owned[key] || 0) + 1;
  state.lastSavedAt = Date.now();

  saveGame();
  updateAchievements();
  renderStatus();
  renderShop();
  showToast(`${item.name} を購入しました`);
}

function normalizeOwnedData(rawOwned) {
  const base = defaultOwnedState();
  const owned = rawOwned || {};

  for (const key of Object.keys(base)) {
    base[key] = Number(owned[key] || 0);
  }

  return base;
}

function tryParseJson(dataText) {
  if (!dataText) {
    return null;
  }

  try {
    return JSON.parse(dataText);
  } catch (error) {
    console.warn('セーブデータの読み込みに失敗しました。', error);
    return null;
  }
}

function migrateLegacySave(rawData) {
  if (!rawData || typeof rawData !== 'object') {
    return null;
  }

  const legacyKeyMap = {
    notepad: 'spatula',
    planner: 'apprentice',
    programmer: 'veteran',
    artist: 'oven',
    office: 'dreamFactory'
  };

  const migratedOwned = defaultOwnedState();
  const legacyOwned = rawData.owned || {};

  Object.entries(legacyKeyMap).forEach(([legacyKey, newKey]) => {
    migratedOwned[newKey] = Number(legacyOwned[legacyKey] || 0);
  });

  const legacyAchievementMap = {
    'first-click': 'first-bake',
    'small-team': 'busy-kitchen',
    'idea-rich': 'bakery-pro',
    'studio-start': 'dream-factory'
  };

  const migratedAchievements = {};
  Object.entries(rawData.achievements || {}).forEach(([legacyKey, value]) => {
    const newKey = legacyAchievementMap[legacyKey] || legacyKey;
    if (value) {
      migratedAchievements[newKey] = true;
    }
  });

  const migratedData = {
    version: 2,
    points: Number(rawData.points || 0),
    totalPoints: Number(rawData.totalPoints || 0),
    totalClicks: Number(rawData.totalClicks || 0),
    owned: migratedOwned,
    achievements: migratedAchievements,
    lastSavedAt: Number(rawData.lastSavedAt || Date.now()),
    migratedLegacy: true
  };

  const hasSavedProgress = Object.values(migratedOwned).some((value) => value > 0) || migratedData.points > 0 || migratedData.totalPoints > 0 || migratedData.totalClicks > 0 || Object.keys(migratedAchievements).length > 0;
  return hasSavedProgress ? migratedData : null;
}

function saveGame() {
  const payload = {
    version: 2,
    points: state.points,
    totalPoints: state.totalPoints,
    totalClicks: state.totalClicks,
    owned: state.owned,
    achievements: state.achievements,
    lastSavedAt: Date.now()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadGame() {
  const currentSave = tryParseJson(localStorage.getItem(STORAGE_KEY));
  if (currentSave) {
    return currentSave;
  }

  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    const legacyRawText = localStorage.getItem(legacyKey);
    if (!legacyRawText) {
      continue;
    }

    const legacyData = tryParseJson(legacyRawText);
    const migrated = migrateLegacySave(legacyData);

    if (migrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(legacyKey);
      return migrated;
    }

    return { legacyNotice: true };
  }

  return null;
}

function applyOfflineProgress(savedData) {
  if (!savedData || !savedData.lastSavedAt) {
    return;
  }

  const savedAt = Number(savedData.lastSavedAt) || Date.now();
  const elapsedSeconds = Math.max(0, (Date.now() - savedAt) / 1000);
  const cappedSeconds = Math.min(elapsedSeconds, CONFIG.offlineCapSeconds);

  if (cappedSeconds <= 0) {
    return;
  }

  const offlineGain = getAutoPowerFromOwned(savedData.owned) * CONFIG.offlineMultiplier * cappedSeconds;
  if (offlineGain <= 0) {
    return;
  }

  state.points += offlineGain;
  state.totalPoints += offlineGain;
  state.lastSavedAt = Date.now();

  showToast(`オフライン中に ${formatNumber(offlineGain)} 個を受け取りました`);
}

function resetGame() {
  localStorage.removeItem(STORAGE_KEY);
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    localStorage.removeItem(legacyKey);
  }

  state.points = 0;
  state.totalPoints = 0;
  state.totalClicks = 0;
  state.owned = defaultOwnedState();
  state.achievements = {};
  state.lastSavedAt = Date.now();

  renderStatus();
  renderShop();
  renderAchievements();
  showToast('セーブデータをリセットしました');
}

function setupEventListeners() {
  refs.bakeryButton.addEventListener('click', () => {
    const gain = getClickPower();
    addPoints(gain, 'click');
    refs.bakeryButton.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(0.96)' },
        { transform: 'scale(1.04)' },
        { transform: 'scale(1)' }
      ],
      {
        duration: 140,
        easing: 'ease-out'
      }
    );
  });

  refs.shopList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-item-key]');
    if (!button) {
      return;
    }

    buyItem(button.dataset.itemKey);
  });

  refs.resetButton.addEventListener('click', () => {
    refs.resetModal.classList.remove('hidden');
    refs.resetModal.setAttribute('aria-hidden', 'false');
  });

  refs.cancelReset.addEventListener('click', () => {
    refs.resetModal.classList.add('hidden');
    refs.resetModal.setAttribute('aria-hidden', 'true');
  });

  refs.confirmReset.addEventListener('click', () => {
    resetGame();
    refs.resetModal.classList.add('hidden');
    refs.resetModal.setAttribute('aria-hidden', 'true');
  });
}

function initialize() {
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

  state.owned = defaultOwnedState();

  const savedData = loadGame();
  if (savedData && savedData.migratedLegacy) {
    showToast('古い保存データを新しい形式に変換しました');
  }

  if (savedData && savedData.legacyNotice) {
    showToast('古い保存データが見つかったため、最初から始めます');
  }

  if (savedData && !savedData.legacyNotice) {
    state.points = Number(savedData.points || 0);
    state.totalPoints = Number(savedData.totalPoints || 0);
    state.totalClicks = Number(savedData.totalClicks || 0);
    state.owned = normalizeOwnedData(savedData.owned);
    state.achievements = savedData.achievements || {};
    state.lastSavedAt = Number(savedData.lastSavedAt || Date.now());

    applyOfflineProgress(savedData);
    saveGame();
  }

  renderStatus();
  renderShop();
  renderAchievements();
  setupEventListeners();
  updateAchievements();

  setInterval(() => {
    const gain = getAutoPower();
    if (gain > 0) {
      addPoints(gain, 'auto');
    }
  }, 1000);

  setInterval(() => {
    saveGame();
  }, CONFIG.saveIntervalMs);
}

initialize();
