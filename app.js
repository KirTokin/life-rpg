// ===== Конфиг: статы =====
const STATS = [
  { id: 'strength',   name: 'Сила',         icon: '💪' },
  { id: 'endurance',  name: 'Выносливость', icon: '🏃' },
  { id: 'intellect',  name: 'Интеллект',    icon: '📚' },
  { id: 'charisma',   name: 'Харизма',      icon: '🗣️' },
  { id: 'discipline', name: 'Дисциплина',   icon: '🧘' },
];

// limit: сколько раз можно выполнить за период (day — сутки, week — неделя с понедельника)
// goal: рекомендуемая частота, только для отображения
const QUESTS = [
  { id: 'gym',       stat: 'strength',   name: 'Силовая тренировка 45+ мин',      xp: 60, limit: { period: 'day',  max: 1 }, goal: '2–3 р/нед' },
  { id: 'home-str',  stat: 'strength',   name: 'Домашняя силовая 20 мин',         xp: 25, limit: { period: 'day',  max: 1 }, goal: '2 р/нед' },
  { id: 'cardio',    stat: 'endurance',  name: 'Умеренное кардио 30 мин',         xp: 30, limit: { period: 'day',  max: 1 }, goal: '3 р/нед' },
  { id: 'cardio-hi', stat: 'endurance',  name: 'Интенсивное кардио 25+ мин',      xp: 35, limit: { period: 'day',  max: 1 }, goal: '2 р/нед' },
  { id: 'steps',     stat: 'endurance',  name: '8 000+ шагов',                    xp: 10, limit: { period: 'day',  max: 1 }, goal: '5 р/нед' },
  { id: 'read',      stat: 'intellect',  name: 'Чтение 30 мин',                   xp: 20, limit: { period: 'day',  max: 2 }, goal: '5 р/нед' },
  { id: 'study',     stat: 'intellect',  name: 'Учёба/курс 45 мин',               xp: 45, limit: { period: 'day',  max: 1 }, goal: '3 р/нед' },
  { id: 'notes',     stat: 'intellect',  name: 'Конспект прочитанного',           xp: 10, limit: { period: 'day',  max: 1 }, goal: '3 р/нед' },
  { id: 'contact',   stat: 'charisma',   name: 'Звонок/встреча с близким',        xp: 20, limit: { period: 'day',  max: 1 }, goal: '4 р/нед' },
  { id: 'speech',    stat: 'charisma',   name: 'Практика речи 15 мин (видео)',    xp: 20, limit: { period: 'day',  max: 1 }, goal: '3 р/нед' },
  { id: 'network',   stat: 'charisma',   name: 'Новое знакомство/нетворкинг',     xp: 45, limit: { period: 'week', max: 2 }, goal: '1 р/нед' },
  { id: 'present',   stat: 'charisma',   name: 'Выступление/презентация',         xp: 80, limit: { period: 'week', max: 2 }, goal: 'по возможности' },
  { id: 'sleep',     stat: 'discipline', name: 'Сон 7+ часов',                    xp: 10, limit: { period: 'day',  max: 1 }, goal: 'ежедневно' },
  { id: 'wakeup',    stat: 'discipline', name: 'Подъём в запланированное время',  xp: 10, limit: { period: 'day',  max: 1 }, goal: '5 р/нед' },
  { id: 'no-phone',  stat: 'discipline', name: 'Без соцсетей до обеда',           xp: 10, limit: { period: 'day',  max: 1 }, goal: '5 р/нед' },
  { id: 'review',    stat: 'discipline', name: 'Недельный обзор и план',          xp: 30, limit: { period: 'week', max: 1 }, goal: '1 р/нед' },
];

// Кривые уровней: XP до следующего уровня = base · level^power
const BALANCE = {
  hero: { base: 100, power: 1.5 },
  stat: { base: 50,  power: 1.3 },
};

const PERIOD_NAMES = { day: 'сегодня', week: 'на неделе' };

// ===== Проверка конфига при старте =====
function validateConfig() {
  const errors = [];
  const statIds = new Set(STATS.map(s => s.id));
  const questIds = new Set();
  QUESTS.forEach(q => {
    if (questIds.has(q.id)) errors.push(`Повтор id квеста: ${q.id}`);
    questIds.add(q.id);
    if (!statIds.has(q.stat)) errors.push(`Квест ${q.id}: неизвестный стат ${q.stat}`);
    if (!Number.isFinite(q.xp) || q.xp <= 0) errors.push(`Квест ${q.id}: некорректный xp`);
    if (!q.limit || !PERIOD_NAMES[q.limit.period] || !(q.limit.max >= 1)) {
      errors.push(`Квест ${q.id}: некорректный limit`);
    }
  });
  errors.forEach(e => console.error('Ошибка конфига:', e));
}
validateConfig();

// ===== Сохранение =====
const STORAGE_KEY = 'life-rpg-save';
const SAVE_VERSION = 3;

function createDefaultSave() {
  return { version: SAVE_VERSION, log: [] };
}

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
  },
  archive(data) {
    try {
      localStorage.setItem(STORAGE_KEY + '-old', JSON.stringify(data));
    } catch (e) {
      console.error('Не удалось заархивировать старое сохранение:', e);
    }
  }
};

function isValidEntry(e) {
  return e !== null && typeof e === 'object'
    && typeof e.id === 'string' && typeof e.questId === 'string'
    && typeof e.stat === 'string'
    && Number.isFinite(e.xp) && e.xp > 0
    && Number.isFinite(e.ts);
}

function isValidSave(data) {
  return data !== null && typeof data === 'object'
    && data.version === SAVE_VERSION
    && Array.isArray(data.log) && data.log.every(isValidEntry);
}

// ===== Загрузка при старте =====
const loaded = storage.load();
if (loaded && !isValidSave(loaded)) {
  console.warn('Старое или повреждённое сохранение перенесено в', STORAGE_KEY + '-old');
  storage.archive(loaded);
}
let save = isValidSave(loaded) ? loaded : createDefaultSave();

// ===== Вычисление состояния из журнала =====
function xpToNext(level, curve) {
  return Math.round(curve.base * Math.pow(level, curve.power));
}

function gainXp(entity, amount, curve) {
  entity.xp += amount;
  while (entity.xp >= xpToNext(entity.level, curve)) {
    entity.xp -= xpToNext(entity.level, curve);
    entity.level++;
  }
}

function computeState(log) {
  const hero = { level: 1, xp: 0 };
  const stats = {};
  STATS.forEach(s => { stats[s.id] = { level: 1, xp: 0 }; });
  let totalXp = 0;

  for (const e of log) {
    gainXp(hero, e.xp, BALANCE.hero);
    if (stats[e.stat]) gainXp(stats[e.stat], e.xp, BALANCE.stat);
    totalXp += e.xp;
  }
  return { hero, stats, totalXp };
}

// ===== Лимиты по периодам =====
function periodStart(period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const dayIndex = (d.getDay() + 6) % 7; // понедельник = 0
    d.setDate(d.getDate() - dayIndex);
  }
  return d.getTime();
}

function questLeft(quest) {
  const from = periodStart(quest.limit.period);
  const done = save.log.filter(e => e.questId === quest.id && e.ts >= from).length;
  return quest.limit.max - done;
}

// ===== Действия =====
function completeQuest(questId) {
  const quest = QUESTS.find(q => q.id === questId);
  if (!quest) {
    console.error('Квест не найден:', questId);
    return;
  }
  if (questLeft(quest) <= 0) {
    showMessage(`Лимит исчерпан ${PERIOD_NAMES[quest.limit.period]}`);
    render();
    return;
  }

  const before = computeState(save.log);
  save.log.push({
    id: crypto.randomUUID(),
    questId: quest.id,
    stat: quest.stat,
    xp: quest.xp,
    ts: Date.now(),
  });
  storage.save(save);
  const after = computeState(save.log);
  render();

  const statConf = STATS.find(s => s.id === quest.stat);
  let msg = `+${quest.xp} XP → ${statConf.name}`;
  if (after.stats[quest.stat].level > before.stats[quest.stat].level) {
    msg += ` · ${statConf.name}: ур. ${after.stats[quest.stat].level}!`;
  }
  if (after.hero.level > before.hero.level) {
    msg += ` · 🎉 Уровень героя ${after.hero.level}!`;
  }
  showMessage(msg);
}

function undoLast() {
  const last = save.log[save.log.length - 1];
  if (!last) {
    showMessage('Нечего отменять');
    return;
  }
  const quest = QUESTS.find(q => q.id === last.questId);
  if (!confirm(`Отменить «${quest ? quest.name : last.questId}»?`)) return;
  save.log.pop();
  storage.save(save);
  render();
  showMessage('Последнее действие отменено');
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
  const view = computeState(save.log);

  document.getElementById('hero').innerHTML = `
    <h1>Герой · Ур. ${view.hero.level}</h1>
    ${renderBar(view.hero, BALANCE.hero)}
    <div class="bar-label">Всего опыта: ${view.totalXp}</div>`;

  document.getElementById('stats').innerHTML = STATS.map(s => {
    const st = view.stats[s.id];
    return `
      <div class="stat">
        <div class="stat-head"><span>${s.icon} ${s.name}</span><span>Ур. ${st.level}</span></div>
        ${renderBar(st, BALANCE.stat)}
      </div>`;
  }).join('');

  document.getElementById('quests').innerHTML = STATS.map(s => {
    const items = QUESTS.filter(q => q.stat === s.id).map(q => {
      const left = Math.max(questLeft(q), 0);
      return `
        <button class="quest" data-quest="${q.id}" ${left === 0 ? 'disabled' : ''}>
          <span class="quest-main">${q.name}
            <small>${q.goal} · осталось ${PERIOD_NAMES[q.limit.period]}: ${left}</small>
          </span>
          <span>+${q.xp}</span>
        </button>`;
    }).join('');
    return items ? `<h3>${s.icon} ${s.name}</h3>${items}` : '';
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
  const json = JSON.stringify(save, null, 2);
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
    if (!isValidSave(data)) {
      alert('Файл не похож на сохранение Life RPG (версия 3)');
      return;
    }
    save = data;
    storage.save(save);
    render();
  } catch (e) {
    alert('Не удалось прочитать файл: ' + e.message);
  }
}

// ===== Обработчики событий =====
document.getElementById('quests').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-quest]');
  if (btn && !btn.disabled) completeQuest(btn.dataset.quest);
});

document.getElementById('undo-btn').addEventListener('click', undoLast);
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
    save = createDefaultSave();
    storage.save(save);
    render();
  }
});

// Пересчитать лимиты, когда вкладка снова становится активной (например, на следующий день)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});

render();