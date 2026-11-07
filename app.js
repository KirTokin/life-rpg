// ===== Конфиг: статы, квесты, баланс =====
const STATS = [
  { id: 'strength',   name: 'Сила',         icon: '💪' },
  { id: 'intellect',  name: 'Интеллект',    icon: '📚' },
  { id: 'endurance',  name: 'Выносливость', icon: '🏃' },
  { id: 'discipline', name: 'Дисциплина',   icon: '🧘' },
];

const QUESTS = [
  { id: 'pushups', name: '50 отжиманий',      stat: 'strength',   xp: 30 },
  { id: 'gym',     name: 'Тренировка в зале', stat: 'strength',   xp: 60 },
  { id: 'read30',  name: 'Чтение 30 минут',   stat: 'intellect',  xp: 30 },
  { id: 'course',  name: 'Урок курса',        stat: 'intellect',  xp: 50 },
  { id: 'run5k',   name: 'Пробежка 5 км',     stat: 'endurance',  xp: 50 },
  { id: 'wakeup',  name: 'Подъём до 7:00',    stat: 'discipline', xp: 20 },
];

// Кривые уровней: XP до следующего уровня = base · level^power
const BALANCE = {
  hero: { base: 100, power: 1.5 },
  stat: { base: 50,  power: 1.3 },
};

// ===== Настройки сохранения =====
const STORAGE_KEY = 'life-rpg-save';
const SAVE_VERSION = 2;

function createDefaultState() {
  const stats = {};
  STATS.forEach(s => { stats[s.id] = { level: 1, xp: 0 }; });
  return { version: SAVE_VERSION, level: 1, xp: 0, totalXp: 0, stats };
}

// ===== Хранилище (на этапе 5 заменим только этот блок) =====
const storage = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('Не удалось загрузить сохранение:', e);
      return null;
    }
  },
  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Не удалось сохранить:', e);
    }
  }
};

// ===== Проверка и нормализация данных =====
function isValidState(data) {
  return data !== null && typeof data === 'object'
    && Number.isInteger(data.level) && data.level >= 1
    && Number.isFinite(data.xp) && data.xp >= 0;
}

// Приводит любое валидное сохранение (включая старое v1) к текущей структуре
function normalizeState(data) {
  const def = createDefaultState();
  const result = { ...def, ...data, version: SAVE_VERSION, stats: {} };
  if (!Number.isFinite(result.totalXp) || result.totalXp < 0) result.totalXp = 0;

  STATS.forEach(s => {
    const st = data.stats?.[s.id];
    const ok = st && Number.isInteger(st.level) && st.level >= 1
      && Number.isFinite(st.xp) && st.xp >= 0;
    result.stats[s.id] = ok ? { level: st.level, xp: st.xp } : { level: 1, xp: 0 };
  });
  return result;
}

// ===== Загрузка при старте =====
const saved = storage.load();
let state = isValidState(saved) ? normalizeState(saved) : createDefaultState();

// ===== Логика игры =====
function xpToNext(level, curve) {
  return Math.round(curve.base * Math.pow(level, curve.power));
}

// Начисляет опыт герою или стату. Возвращает число полученных уровней.
function gainXp(entity, amount, curve) {
  entity.xp += amount;
  let gained = 0;
  while (entity.xp >= xpToNext(entity.level, curve)) {
    entity.xp -= xpToNext(entity.level, curve);
    entity.level++;
    gained++;
  }
  return gained;
}

function completeQuest(questId) {
  const quest = QUESTS.find(q => q.id === questId);
  if (!quest) {
    console.error('Квест не найден:', questId);
    return;
  }
  if (!Number.isFinite(quest.xp) || quest.xp <= 0) {
    console.error('Некорректный XP у квеста:', quest);
    return;
  }
  const statConf = STATS.find(s => s.id === quest.stat);
  const stat = state.stats[quest.stat];
  if (!statConf || !stat) {
    console.error('Стат не найден:', quest.stat);
    return;
  }

  const statUp = gainXp(stat, quest.xp, BALANCE.stat);
  const heroUp = gainXp(state, quest.xp, BALANCE.hero);
  state.totalXp += quest.xp;

  storage.save(state);
  render();

  let msg = `+${quest.xp} XP → ${statConf.name}`;
  if (statUp) msg += ` · ${statConf.name}: ур. ${stat.level}!`;
  if (heroUp) msg += ` · 🎉 Уровень героя ${state.level}!`;
  showMessage(msg);
}

// ===== Интерфейс =====
function renderBar(entity, curve) {
  const need = xpToNext(entity.level, curve);
  const pct = Math.min(entity.xp / need * 100, 100);
  return `
    <div class="bar"><div class="bar-fill" style="width: ${pct}%"></div></div>
    <div class="bar-label">${entity.xp} / ${need} XP</div>`;
}

function render() {
  document.getElementById('hero').innerHTML = `
    <h1>Герой · Ур. ${state.level}</h1>
    ${renderBar(state, BALANCE.hero)}
    <div class="bar-label">Всего опыта: ${state.totalXp}</div>`;

  document.getElementById('stats').innerHTML = STATS.map(s => {
    const st = state.stats[s.id];
    return `
      <div class="stat">
        <div class="stat-head"><span>${s.icon} ${s.name}</span><span>Ур. ${st.level}</span></div>
        ${renderBar(st, BALANCE.stat)}
      </div>`;
  }).join('');

  document.getElementById('quests').innerHTML = QUESTS.map(q => {
    const s = STATS.find(x => x.id === q.stat);
    return `
      <button class="quest" data-quest="${q.id}">
        <span>${s ? s.icon : '❓'} ${q.name}</span><span>+${q.xp} XP</span>
      </button>`;
  }).join('');
}

let messageTimer;
function showMessage(text) {
  const el = document.getElementById('message');
  el.textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { el.textContent = ''; }, 3000);
}

// ===== Бэкап =====
function exportSave() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `life-rpg-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importSave(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!isValidState(data)) {
      alert('Файл не похож на сохранение Life RPG');
      return;
    }
    state = normalizeState(data);
    storage.save(state);
    render();
  } catch (e) {
    alert('Не удалось прочитать файл: ' + e.message);
  }
}

// ===== Обработчики событий =====
// Один обработчик на весь блок квестов (делегирование)
document.getElementById('quests').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-quest]');
  if (btn) completeQuest(btn.dataset.quest);
});

document.getElementById('export-btn').addEventListener('click', exportSave);

document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importSave(file);
  e.target.value = '';
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('Сбросить весь прогресс? Это нельзя отменить.')) {
    state = createDefaultState();
    storage.save(state);
    render();
  }
});

render();