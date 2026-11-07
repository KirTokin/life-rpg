// ===== Конфиг: статы =====
const STATS = [
  { id: 'strength',   name: 'Сила',         icon: '💪' },
  { id: 'endurance',  name: 'Выносливость', icon: '🏃' },
  { id: 'intellect',  name: 'Интеллект',    icon: '📚' },
  { id: 'charisma',   name: 'Харизма',      icon: '🗣️' },
  { id: 'discipline', name: 'Дисциплина',   icon: '🧘' },
];

// ===== Конфиг: квесты =====
// limit: сколько раз за период (day — сутки, week — неделя с понедельника)
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

// ===== Конфиг: награды (цена = 80 🪙 × дни усилий) =====
// limit необязателен
const REWARDS = [
  { id: 'treat',  name: 'Любимая вкусняшка',          icon: '🍰', cost: 50,   limit: { period: 'week', max: 3 } },
  { id: 'series', name: 'Вечер сериала/игр (2 ч)',    icon: '🎬', cost: 80,   limit: { period: 'week', max: 3 } },
  { id: 'dinner', name: 'Ужин в ресторане',           icon: '🍽️', cost: 250 },
  { id: 'game',   name: 'Покупка игры/книги',         icon: '🎮', cost: 1100 },
  { id: 'big',    name: 'Крупная покупка/поездка',    icon: '✈️', cost: 6000 },
];

// ===== Конфиг: ачивки =====
// Типы условий: anyQuestCount, questCount, heroLevel, allStatsLevel, streak, purchaseCount
const ACHIEVEMENTS = [
  { id: 'first-quest', icon: '👣', name: 'Первый шаг',          desc: 'Выполнить любой квест',               gold: 20,  condition: { type: 'anyQuestCount', count: 1 } },
  { id: 'quests-100',  icon: '💯', name: 'Сотня',               desc: 'Выполнить 100 квестов',               gold: 200, condition: { type: 'anyQuestCount', count: 100 } },
  { id: 'gym-10',      icon: '🏋️', name: 'Завсегдатай зала',    desc: '10 силовых тренировок',               gold: 100, condition: { type: 'questCount', questId: 'gym', count: 10 } },
  { id: 'read-30',     icon: '📖', name: 'Книжный червь',       desc: '30 сессий чтения',                    gold: 100, condition: { type: 'questCount', questId: 'read', count: 30 } },
  { id: 'sleep-7',     icon: '😴', name: 'Режим налажен',       desc: 'Сон 7+ часов 7 дней подряд',          gold: 100, condition: { type: 'streak', questId: 'sleep', days: 7 } },
  { id: 'sleep-30',    icon: '🌙', name: 'Мастер сна',          desc: 'Сон 7+ часов 30 дней подряд',         gold: 300, condition: { type: 'streak', questId: 'sleep', days: 30 } },
  { id: 'habit-66',    icon: '🔥', name: 'Привычка сформирована', desc: '66 дней подряд хоть один квест',    gold: 500, condition: { type: 'streak', days: 66 } },
  { id: 'hero-5',      icon: '⭐', name: 'Новичок',             desc: 'Герой 5 уровня',                      gold: 100, condition: { type: 'heroLevel', level: 5 } },
  { id: 'hero-10',     icon: '🌟', name: 'Ветеран',             desc: 'Герой 10 уровня',                     gold: 300, condition: { type: 'heroLevel', level: 10 } },
  { id: 'all-stats-5', icon: '⚖️', name: 'Разносторонний',      desc: 'Все характеристики 5 уровня',         gold: 300, condition: { type: 'allStatsLevel', level: 5 } },
  { id: 'first-buy',   icon: '🎁', name: 'Заслужил',            desc: 'Купить первую награду',               gold: 10,  condition: { type: 'purchaseCount', count: 1 } },
];

// ===== Баланс =====
const BALANCE = {
  hero: { base: 100, power: 1.5 },
  stat: { base: 50,  power: 1.3 },
  goldPerXp: 0.5,
};

const PERIOD_NAMES = { day: 'сегодня', week: 'на неделе' };
const DAY_MS = 24 * 60 * 60 * 1000;

// ===== Проверка конфига при старте =====
function validateConfig() {
  const errors = [];
  const statIds = new Set(STATS.map(s => s.id));
  const questIds = new Set();
  const isValidLimit = l => l && PERIOD_NAMES[l.period] && Number.isInteger(l.max) && l.max >= 1;

  QUESTS.forEach(q => {
    if (questIds.has(q.id)) errors.push(`Повтор id квеста: ${q.id}`);
    questIds.add(q.id);
    if (!statIds.has(q.stat)) errors.push(`Квест ${q.id}: неизвестный стат ${q.stat}`);
    if (!Number.isFinite(q.xp) || q.xp <= 0) errors.push(`Квест ${q.id}: некорректный xp`);
    if (!isValidLimit(q.limit)) errors.push(`Квест ${q.id}: некорректный limit`);
  });

  const rewardIds = new Set();
  REWARDS.forEach(r => {
    if (rewardIds.has(r.id)) errors.push(`Повтор id награды: ${r.id}`);
    rewardIds.add(r.id);
    if (!Number.isInteger(r.cost) || r.cost <= 0) errors.push(`Награда ${r.id}: cost должен быть целым > 0`);
    if (r.limit !== undefined && !isValidLimit(r.limit)) errors.push(`Награда ${r.id}: некорректный limit`);
  });

  const achIds = new Set();
  ACHIEVEMENTS.forEach(a => {
    if (achIds.has(a.id)) errors.push(`Повтор id ачивки: ${a.id}`);
    achIds.add(a.id);
    const c = a.condition;
    if (!c) errors.push(`Ачивка ${a.id}: нет condition`);
    else if (c.questId && !questIds.has(c.questId)) errors.push(`Ачивка ${a.id}: неизвестный квест ${c.questId}`);
    else if (c.stat && !statIds.has(c.stat)) errors.push(`Ачивка ${a.id}: неизвестный стат ${c.stat}`);
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

// Записи без type — квесты (совместимость с журналом занятия 4)
function entryType(e) {
  return e.type ?? 'quest';
}

function isValidEntry(e) {
  if (e === null || typeof e !== 'object') return false;
  if (typeof e.id !== 'string' || !Number.isFinite(e.ts)) return false;

  switch (entryType(e)) {
    case 'quest':
      return typeof e.questId === 'string' && typeof e.stat === 'string'
        && Number.isFinite(e.xp) && e.xp > 0
        && (e.gold === undefined || (Number.isInteger(e.gold) && e.gold >= 0));
    case 'purchase':
      return typeof e.rewardId === 'string' && Number.isInteger(e.cost) && e.cost > 0;
    default:
      return false;
  }
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

// ===== Даты =====
// Локальная дата 'ГГГГ-ММ-ДД' (toISOString дал бы дату по UTC — ошибка до 05:00 по Алматы)
function dateKey(ts) {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function periodStart(period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const dayIndex = (d.getDay() + 6) % 7; // понедельник = 0
    d.setDate(d.getDate() - dayIndex);
  }
  return d.getTime();
}

// Самая длинная серия дней подряд, в которые есть хотя бы одна запись
function longestStreak(entries) {
  const days = [...new Set(entries.map(e => dateKey(e.ts)))].sort();
  let best = 0;
  let current = 0;
  let prev = null;
  for (const key of days) {
    const t = new Date(key + 'T00:00:00').getTime();
    current = (prev !== null && Math.round((t - prev) / DAY_MS) === 1) ? current + 1 : 1;
    best = Math.max(best, current);
    prev = t;
  }
  return best;
}

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

function questGold(e) {
  return e.gold ?? Math.round(e.xp * BALANCE.goldPerXp);
}

function evaluateCondition(cond, view) {
  let current = 0;
  let target = 0;

  switch (cond.type) {
    case 'anyQuestCount':
      current = view.quests.length;
      target = cond.count;
      break;
    case 'questCount':
      current = view.quests.filter(e => e.questId === cond.questId).length;
      target = cond.count;
      break;
    case 'heroLevel':
      current = view.hero.level;
      target = cond.level;
      break;
    case 'allStatsLevel':
      current = Math.min(...Object.values(view.stats).map(s => s.level));
      target = cond.level;
      break;
    case 'streak': {
      const entries = view.quests.filter(e =>
        (!cond.questId || e.questId === cond.questId) && (!cond.stat || e.stat === cond.stat));
      current = longestStreak(entries);
      target = cond.days;
      break;
    }
    case 'purchaseCount':
      current = view.purchases.length;
      target = cond.count;
      break;
    default:
      console.error('Неизвестный тип условия ачивки:', cond.type);
  }
  return { current: Math.min(current, target), target, unlocked: target > 0 && current >= target };
}

function computeState(log) {
  const hero = { level: 1, xp: 0 };
  const stats = {};
  STATS.forEach(s => { stats[s.id] = { level: 1, xp: 0 }; });
  let totalXp = 0;
  let gold = 0;
  const quests = [];
  const purchases = [];

  for (const e of log) {
    if (entryType(e) === 'quest') {
      gainXp(hero, e.xp, BALANCE.hero);
      if (stats[e.stat]) gainXp(stats[e.stat], e.xp, BALANCE.stat);
      totalXp += e.xp;
      gold += questGold(e);
      quests.push(e);
    } else if (entryType(e) === 'purchase') {
      gold -= e.cost;
      purchases.push(e);
    }
  }

  const view = { hero, stats, totalXp, quests, purchases };
  view.achievements = ACHIEVEMENTS.map(a => ({ ...a, ...evaluateCondition(a.condition, view) }));
  const achGold = view.achievements
    .filter(a => a.unlocked)
    .reduce((sum, a) => sum + a.gold, 0);
  view.gold = gold + achGold;
  return view;
}

// ===== Лимиты по периодам =====
// matches — функция, которая решает, подходит ли запись (callback)
function leftInPeriod(limit, matches) {
  const from = periodStart(limit.period);
  const done = save.log.filter(e => e.ts >= from && matches(e)).length;
  return limit.max - done;
}

function questLeft(quest) {
  return leftInPeriod(quest.limit, e => entryType(e) === 'quest' && e.questId === quest.id);
}

function rewardLeft(reward) {
  if (!reward.limit) return Infinity;
  return leftInPeriod(reward.limit, e => entryType(e) === 'purchase' && e.rewardId === reward.id);
}

// ===== Действия =====
function commit(entry, before, baseMessage) {
  save.log.push(entry);
  storage.save(save);
  const after = computeState(save.log);
  render();

  let msg = baseMessage(after);
  after.achievements.forEach((a, i) => {
    if (a.unlocked && !before.achievements[i].unlocked) {
      msg += ` · 🏆 ${a.name} (+${a.gold} 🪙)`;
    }
  });
  showMessage(msg);
}

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
  const gold = Math.round(quest.xp * BALANCE.goldPerXp);
  const entry = {
    id: crypto.randomUUID(),
    type: 'quest',
    questId: quest.id,
    stat: quest.stat,
    xp: quest.xp,
    gold,
    ts: Date.now(),
  };

  commit(entry, before, (after) => {
    const statConf = STATS.find(s => s.id === quest.stat);
    let msg = `+${quest.xp} XP, +${gold} 🪙 → ${statConf.name}`;
    if (after.stats[quest.stat].level > before.stats[quest.stat].level) {
      msg += ` · ${statConf.name}: ур. ${after.stats[quest.stat].level}!`;
    }
    if (after.hero.level > before.hero.level) {
      msg += ` · 🎉 Уровень героя ${after.hero.level}!`;
    }
    return msg;
  });
}

function buyReward(rewardId) {
  const reward = REWARDS.find(r => r.id === rewardId);
  if (!reward) {
    console.error('Награда не найдена:', rewardId);
    return;
  }
  const before = computeState(save.log);
  if (before.gold < reward.cost) {
    showMessage(`Не хватает ${reward.cost - before.gold} 🪙`);
    return;
  }
  if (rewardLeft(reward) <= 0) {
    showMessage(`Лимит награды исчерпан ${PERIOD_NAMES[reward.limit.period]}`);
    return;
  }
  if (!confirm(`Купить «${reward.name}» за ${reward.cost} 🪙?`)) return;

  const entry = {
    id: crypto.randomUUID(),
    type: 'purchase',
    rewardId: reward.id,
    cost: reward.cost,
    ts: Date.now(),
  };
  commit(entry, before, () => `${reward.icon} ${reward.name} куплено за ${reward.cost} 🪙. Наслаждайтесь!`);
}

function describeEntry(e) {
  if (entryType(e) === 'purchase') {
    const r = REWARDS.find(x => x.id === e.rewardId);
    return `покупку «${r ? r.name : e.rewardId}»`;
  }
  const q = QUESTS.find(x => x.id === e.questId);
  return `квест «${q ? q.name : e.questId}»`;
}

function undoLast() {
  const last = save.log[save.log.length - 1];
  if (!last) {
    showMessage('Нечего отменять');
    return;
  }
  if (!confirm(`Отменить ${describeEntry(last)}?`)) return;
  save.log.pop();
  storage.save(save);
  render();
  showMessage('Последнее действие отменено');
}

// ===== Интерфейс =====
function renderBar(current, max) {
  const pct = max > 0 ? Math.min(current / max * 100, 100) : 0;
  return `<div class="bar"><div class="bar-fill" style="width: ${pct}%"></div></div>`;
}

function renderLevelBar(entity, curve) {
  const need = xpToNext(entity.level, curve);
  return `${renderBar(entity.xp, need)}<div class="bar-label">${entity.xp} / ${need} XP</div>`;
}

function render() {
  const view = computeState(save.log);

  document.getElementById('hero').innerHTML = `
    <h1>Герой · Ур. ${view.hero.level}</h1>
    ${renderLevelBar(view.hero, BALANCE.hero)}
    <div class="bar-label">Всего опыта: ${view.totalXp} · <span class="gold">🪙 ${view.gold}</span></div>`;

  document.getElementById('stats').innerHTML = STATS.map(s => {
    const st = view.stats[s.id];
    return `
      <div class="stat">
        <div class="stat-head"><span>${s.icon} ${s.name}</span><span>Ур. ${st.level}</span></div>
        ${renderLevelBar(st, BALANCE.stat)}
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

  document.getElementById('shop').innerHTML = REWARDS.map(r => {
    const left = rewardLeft(r);
    const affordable = view.gold >= r.cost;
    const available = affordable && left > 0;
    let note = affordable ? 'Можно купить' : `Не хватает ${r.cost - view.gold} 🪙`;
    if (r.limit) note += ` · осталось ${PERIOD_NAMES[r.limit.period]}: ${Math.max(left, 0)}`;
    return `
      <button class="quest reward" data-reward="${r.id}" ${available ? '' : 'disabled'}>
        <span class="quest-main">${r.icon} ${r.name}<small>${note}</small></span>
        <span>${r.cost} 🪙</span>
      </button>`;
  }).join('');

  const unlockedCount = view.achievements.filter(a => a.unlocked).length;
  document.getElementById('achievements').innerHTML =
    `<p class="bar-label">Открыто: ${unlockedCount} / ${view.achievements.length}</p>` +
    view.achievements.map(a => `
      <div class="ach ${a.unlocked ? '' : 'locked'}">
        <span class="ach-icon">${a.unlocked ? a.icon : '🔒'}</span>
        <div class="ach-body">
          <strong>${a.name}</strong> <span class="gold">+${a.gold} 🪙</span>
          <small>${a.desc} · ${a.current} / ${a.target}</small>
          ${a.unlocked ? '' : renderBar(a.current, a.target)}
        </div>
      </div>`).join('');
}

let messageTimer;
function showMessage(text) {
  const el = document.getElementById('message');
  el.textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { el.textContent = ''; }, 4000);
}

// ===== Бэкап =====
function exportSave() {
  const json = JSON.stringify(save, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `life-rpg-backup-${dateKey(Date.now())}.json`;
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

document.getElementById('shop').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-reward]');
  if (btn && !btn.disabled) buyReward(btn.dataset.reward);
});

document.querySelector('.tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (!tab) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
  document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.id !== tab.dataset.tab; });
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

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});

render();