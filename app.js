// Конфиг игры и подключения — в config.js

// ===== Supabase =====
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let currentUser = null;
let syncStatus = '';

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
    if (!Number.isInteger(q.xp) || q.xp <= 0) errors.push(`Квест ${q.id}: xp должен быть целым > 0`);
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
    if (!Number.isInteger(a.gold) || a.gold < 0) errors.push(`Ачивка ${a.id}: gold должен быть целым ≥ 0`);
    const c = a.condition;
    if (!c) errors.push(`Ачивка ${a.id}: нет condition`);
    else if (c.questId && !questIds.has(c.questId)) errors.push(`Ачивка ${a.id}: неизвестный квест ${c.questId}`);
    else if (c.stat && !statIds.has(c.stat)) errors.push(`Ачивка ${a.id}: неизвестный стат ${c.stat}`);
  });

  STATS.forEach(s => {
    if (!s.icon) errors.push(`Стат ${s.id}: нет icon`);
    if (!s.color) errors.push(`Стат ${s.id}: нет color`);
  });
  if (!AVATAR_TIERS.length || AVATAR_TIERS[0].minLevel !== 1) {
    errors.push('AVATAR_TIERS: первый облик должен начинаться с уровня 1');
  }
  AVATAR_TIERS.forEach((t, i) => {
    if (i > 0 && t.minLevel <= AVATAR_TIERS[i - 1].minLevel) {
      errors.push(`AVATAR_TIERS: уровни должны возрастать (${t.name})`);
    }
  });

  if (!Array.isArray(BALANCE_HISTORY) || !BALANCE_HISTORY.length) {
    errors.push('BALANCE_HISTORY пуст');
  }
  BALANCE_HISTORY.forEach((b, i) => {
    const t = balanceStart(b);
    if (!Number.isFinite(t)) errors.push(`BALANCE_HISTORY[${i}]: некорректная дата from '${b.from}'`);
    if (i > 0 && !(t > balanceStart(BALANCE_HISTORY[i - 1]))) {
      errors.push(`BALANCE_HISTORY[${i}]: даты from должны возрастать`);
    }
    if (!(b.hero?.base > 0 && b.hero?.power > 0 && b.stat?.base > 0 && b.stat?.power > 0)) {
      errors.push(`BALANCE_HISTORY[${i}]: некорректные кривые hero/stat`);
    }
    if (!(b.goldPerXp >= 0)) errors.push(`BALANCE_HISTORY[${i}]: некорректный goldPerXp`);
  });
  if (balanceStart(BALANCE) > Date.now()) {
    errors.push('Последняя версия баланса начинается в будущем — укажите сегодняшнюю или прошедшую дату');
  }

  const careIds = new Set();
  CARE_TASKS.forEach(t => {
    if (careIds.has(t.id)) errors.push(`Повтор id дела: ${t.id}`);
    careIds.add(t.id);
    if (!CARE_PARTS[t.part]) errors.push(`Дело ${t.id}: неизвестная часть дня ${t.part}`);
    if (!Number.isInteger(t.penalty) || t.penalty < 0) errors.push(`Дело ${t.id}: penalty — целое ≥ 0`);
  });
  if (!(HEALTH.max > 0) || !(HEALTH.restorePerTask >= 0) || !Number.isFinite(new Date(HEALTH.startDate + 'T00:00:00').getTime())
      || !(HEALTH.dayStartHour >= 0 && HEALTH.dayStartHour < 24)) {
    errors.push('HEALTH: некорректные настройки');
  }
  QUESTS.filter(q => q.today).forEach(q => {
    const t = q.today;
    if (!Array.isArray(t.days) || !t.days.length || !t.days.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
      errors.push(`Квест ${q.id}: today.days — массив дней недели 0–6`);
    }
    if (!t.firstStep || !t.done) errors.push(`Квест ${q.id}: today.firstStep и today.done обязательны`);
    if (q.limit?.period !== 'day' || q.limit?.max !== 1) errors.push(`Квест ${q.id}: карточке «Сегодня» нужен лимит 1 в день`);
  });
  errors.forEach(e => console.error('Ошибка конфига:', e));
}
validateConfig();

// ===== Локальное сохранение =====
const STORAGE_KEY = 'life-rpg-save';
const SAVE_VERSION = 6;

// Миграции сохранения. Ключ — версия, ИЗ которой мигрируем.
// Каждая функция переводит данные ровно на одну версию вперёд.
// ВАЖНО: старые миграции никогда не редактировать, только добавлять новые.
const MIGRATIONS = {
  // v3 → v4: добавлен владелец данных (id аккаунта Supabase)
  3: (data) => ({ ...data, version: 4, ownerId: null }),
  // v4 → v5: новый тип записи 'claim'. Данные не меняются, но старая версия игры
  // не должна молча открывать журнал с записями, которых не понимает
  4: (data) => ({ ...data, version: 5 }),
  // v5 → v6: новый тип записи 'care' (дела ухода за собой). Данные не меняются,
  // но старая версия игры не должна молча открывать журнал с записями, которых не понимает
  5: (data) => ({ ...data, version: 6 }),
};

// Прогоняет сохранение через цепочку миграций до текущей версии.
// Возвращает данные текущей версии или null, если перевести нельзя.
function migrate(data) {
  if (data === null || typeof data !== 'object' || !Number.isInteger(data.version)) {
    return null;
  }
  if (data.version > SAVE_VERSION) {
    console.error(`Сохранение версии ${data.version} новее игры (версия ${SAVE_VERSION}). Обновите страницу.`);
    return null;
  }
  let current = data;
  while (current.version < SAVE_VERSION) {
    const step = MIGRATIONS[current.version];
    if (!step) {
      console.error(`Нет миграции с версии ${current.version}`);
      return null;
    }
    const next = step(current);
    if (next.version !== current.version + 1) {
      console.error(`Миграция с версии ${current.version} вернула версию ${next.version}`);
      return null;
    }
    console.info(`Сохранение обновлено: v${current.version} → v${next.version}`);
    current = next;
  }
  return current;
}

function createDefaultSave() {
  return { version: SAVE_VERSION, ownerId: null, log: [] };
}

let saveRevision = 0; // увеличивается при каждом изменении журнала: признак «журнал изменился»

// Сливает журнал с диска (записанный другой вкладкой) в журнал в памяти.
// Записи объединяются по id, удаление побеждает. Возвращает { added, changed }.
function mergeLog(target, diskLog) {
  const byId = new Map(target.log.map(e => [e.id, e]));
  const added = [];
  let changed = false;
  for (const d of diskLog) {
    if (!isValidEntry(d)) continue;
    const local = byId.get(d.id);
    if (!local) {
      const copy = { ...d };
      target.log.push(copy);
      byId.set(copy.id, copy);
      added.push(copy);
    } else if (!!d.deleted !== !!local.deleted) {
      if (d.deleted) {
        local.deleted = true;
        local.synced = !!d.synced;
        changed = true;
      }
      // локальное удаление сильнее: оставляем его и его флаг synced
    } else if (d.synced && !local.synced) {
      local.synced = true; // другая вкладка уже отправила эту запись в облако
      changed = true;
    }
  }
  if (added.length) target.log.sort((a, b) => a.ts - b.ts);
  return { added, changed: changed || added.length > 0 };
}

// Читает сохранение с диска и сливает его в память.
// 'ok' — слито или нечего сливать; 'owner' — на диске данные другого аккаунта; 'newer' — формат новее игры.
function absorbDisk() {
  const disk = storage.load();
  const none = { status: 'ok', added: [], changed: false };
  if (!disk) return none;
  if (Number.isInteger(disk.version) && disk.version > SAVE_VERSION) return { ...none, status: 'newer' };
  const data = migrate(disk);
  if (!data || !isValidSave(data)) return none; // повреждённое — перезапишем своим
  if (data.ownerId && save.ownerId && data.ownerId !== save.ownerId) return { ...none, status: 'owner' };
  let ownerChanged = false;
  if (data.ownerId && !save.ownerId) {
    save.ownerId = data.ownerId; // другая вкладка вошла в аккаунт
    ownerChanged = true;
  }
  const { added, changed } = mergeLog(save, data.log);
  if (changed) saveRevision++;
  return { status: 'ok', added, changed: changed || ownerChanged };
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
  // Записывает журнал на диск. Возвращает Promise<boolean>: true — записано.
  // Блокировка (Web Locks) не даёт двум вкладкам писать одновременно, а перед записью
  // журнал с диска сливается в память — так запись одной вкладки не затирает другую.
  // replace: true — записать как есть, без слияния (смена владельца данных).
  save(data, { replace = false } = {}) {
    saveRevision++;
    const write = () => {
      if (!replace) {
        const r = absorbDisk();
        if (r.status !== 'ok') {
          console.error('Запись отменена: сохранение изменено другой вкладкой', r.status);
          handleForeignDisk(r.status);
          return false;
        }
        if (r.added.length && enforceLimits(r.added)) saveRevision++;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        console.error('Не удалось сохранить:', e);
        return false;
      }
    };
    if (navigator.locks?.request) {
      return navigator.locks.request(STORAGE_KEY, write).catch(e => {
        console.error('Не удалось сохранить:', e);
        return false;
      });
    }
    return Promise.resolve(write());
  },
  archive(data) {
    try {
      localStorage.setItem(STORAGE_KEY + '-old', JSON.stringify(data));
    } catch (e) {
      console.error('Не удалось заархивировать старое сохранение:', e);
    }
  }
};

function entryType(e) {
  return e.type ?? 'quest';
}

function isActive(e) {
  return !e.deleted;
}

function isValidEntry(e) {
  if (e === null || typeof e !== 'object') return false;
  if (typeof e.id !== 'string' || !Number.isFinite(e.ts)) return false;
  if (e.deleted !== undefined && typeof e.deleted !== 'boolean') return false;
  if (e.synced !== undefined && typeof e.synced !== 'boolean') return false;

  switch (entryType(e)) {
    case 'quest':
      return typeof e.questId === 'string' && typeof e.stat === 'string'
        && Number.isInteger(e.xp) && e.xp > 0
        && (e.gold === undefined || (Number.isInteger(e.gold) && e.gold >= 0));
    case 'purchase':
      return typeof e.rewardId === 'string' && Number.isInteger(e.cost) && e.cost > 0;
      case 'claim':
      return typeof e.achievementId === 'string' && Number.isInteger(e.gold) && e.gold >= 0;
    case 'care':
      return typeof e.taskId === 'string';
    default:
      return false;
  }
}

function isValidSave(data) {
  return data !== null && typeof data === 'object'
    && data.version === SAVE_VERSION
    && (data.ownerId === null || typeof data.ownerId === 'string')
    && Array.isArray(data.log) && data.log.every(isValidEntry);
}

const loaded = storage.load();
const migrated = loaded ? migrate(loaded) : null;
const loadedOk = migrated !== null && isValidSave(migrated);

if (loaded && !loadedOk) {
  console.warn('Сохранение не удалось загрузить, оно перенесено в', STORAGE_KEY + '-old');
  storage.archive(loaded);
  if (Number.isInteger(loaded.version) && loaded.version > SAVE_VERSION) {
    alert('Сохранение создано более новой версией игры. Обновите страницу (на ПК — Ctrl+F5).');
  }
}

const save = loadedOk ? migrated : createDefaultSave();

// На диске оказались данные другого аккаунта или более новый формат (другая вкладка):
// в этой вкладке ничего не пишем, просим перезагрузить страницу
let foreignDiskShown = false;
function handleForeignDisk(status) {
  if (foreignDiskShown) return;
  foreignDiskShown = true;
  alert(status === 'newer'
    ? 'Игра обновилась в другой вкладке. Страница будет перезагружена.'
    : 'В другой вкладке выполнен вход в другой аккаунт. Страница будет перезагружена.');
  location.reload();
}

// Другая вкладка записала журнал — подтягиваем изменения сразу
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY || e.newValue === null) return;
  const r = absorbDisk();
  if (r.status !== 'ok') {
    handleForeignDisk(r.status);
    return;
  }
  if (r.added.length && enforceLimits(r.added)) saveRevision++;
  if (r.changed) render();
});
if (loadedOk && migrated !== loaded) {
  storage.save(save); // сохраняем результат миграции
}

// ===== Даты =====
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
    const dayIndex = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayIndex);
  }
  return d.getTime();
}

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

// Золото за запись квеста: сохранённое в записи, иначе — по курсу версии баланса на момент записи
function questGold(e, balance) {
  return e.gold ?? Math.round(e.xp * balance.goldPerXp);
}

// Начало действия версии баланса (timestamp)
function balanceStart(version) {
  return new Date(version.from + 'T00:00:00').getTime();
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
    case 'careDays':
      current = view.careFullDays;
      target = cond.count;
      break;
    case 'purchaseCount':
      current = view.purchases.length;
      target = cond.count;
      break;
    default:
      console.error('Неизвестный тип условия ачивки:', cond.type);
  }
  return { current: Math.min(current, target), target, unlocked: target > 0 && current >= target };
}

// Дни ухода (с HEALTH.startDate), в которые выполнены все дела. Повторы одного дела не считаются.
function fullCareDays(log) {
  const known = new Set(CARE_TASKS.map(t => t.id));
  const byDay = new Map();
  for (const e of log) {
    if (!isActive(e) || entryType(e) !== 'care' || !known.has(e.taskId)) continue;
    const day = careDayKey(e.ts);
    if (day < HEALTH.startDate) continue;
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day).add(e.taskId);
  }
  return [...byDay].filter(([, set]) => set.size === known.size).map(([day]) => day).sort();
}

function computeState(log) {
  const hero = { level: 1, xp: 0 };
  const stats = {};
  STATS.forEach(s => { stats[s.id] = { level: 1, xp: 0 }; });
  let totalXp = 0;
  let gold = 0;
  const quests = [];
  const purchases = [];
  const claims = new Map(); // achievementId → первая запись забора награды

  // Переход на новую версию баланса: уровень и XP сохраняются,
  // gainXp(…, 0, …) только поднимает уровень, если по новой кривой XP уже хватает
  let vIndex = 0;
  const switchBalance = (index) => {
    vIndex = index;
    const b = BALANCE_HISTORY[vIndex];
    gainXp(hero, 0, b.hero);
    Object.values(stats).forEach(st => gainXp(st, 0, b.stat));
  };

  // Записи — строго по времени: от этого зависит, какая версия баланса к ним применяется
  const ordered = [...log].sort((a, b) => a.ts - b.ts);

  for (const e of ordered) {
    if (!isActive(e)) continue;
    while (vIndex + 1 < BALANCE_HISTORY.length && e.ts >= balanceStart(BALANCE_HISTORY[vIndex + 1])) {
      switchBalance(vIndex + 1);
    }
    const b = BALANCE_HISTORY[vIndex];
    const type = entryType(e);

    if (type === 'quest') {
      gainXp(hero, e.xp, b.hero);
      if (stats[e.stat]) gainXp(stats[e.stat], e.xp, b.stat);
      totalXp += e.xp;
      gold += questGold(e, b);
      quests.push(e);
    } else if (type === 'purchase') {
      gold -= e.cost;
      purchases.push(e);
    } else if (type === 'claim') {
      // Дубли (забор на двух устройствах офлайн) — засчитывается самый ранний
      if (!claims.has(e.achievementId)) claims.set(e.achievementId, e);
    }
  }

  // Довести состояние до текущей версии баланса, даже если после её начала ещё не было записей
  if (vIndex !== BALANCE_HISTORY.length - 1) switchBalance(BALANCE_HISTORY.length - 1);

  const careDays = fullCareDays(log);
  gold += careDays.length * HEALTH.fullDayGold;

  const view = { hero, stats, totalXp, quests, purchases, careFullDays: careDays.length, careDaysList: careDays };
  view.achievements = ACHIEVEMENTS.map(a => {
    const result = evaluateCondition(a.condition, view);
    const claim = claims.get(a.id);
    return {
      ...a,
      ...result,
      claimed: Boolean(claim),
      claimGold: claim ? claim.gold : 0,
      ready: result.unlocked && !claim, // открыта, награда ещё не забрана
    };
  });

  // Золото за ачивку — только если она открыта И награда забрана
  const achGold = view.achievements
    .filter(a => a.unlocked && a.claimed)
    .reduce((sum, a) => sum + a.claimGold, 0);
  view.gold = gold + achGold;
  view.readyCount = view.achievements.filter(a => a.ready).length;
  return view;
}

// ===== Кэш состояния =====
let stateCache = { revision: -1, view: null };

// Состояние героя с кэшем: пересчёт только если журнал изменился
function getState() {
  if (stateCache.revision !== saveRevision) {
    stateCache = { revision: saveRevision, view: computeState(save.log) };
  }
  return stateCache.view;
}

// ===== Лимиты по периодам =====
let countsCache = { key: null, day: null, week: null };

// Один проход по журналу: сколько раз каждый квест/награда выполнены сегодня и за неделю.
// Кэш зависит от ревизии журнала И от начала текущих суток/недели (после полуночи — пересчёт).
function periodCounts() {
  const dayStart = periodStart('day');
  const weekStart = periodStart('week');
  const key = `${saveRevision}|${dayStart}|${weekStart}`;
  if (countsCache.key === key) return countsCache;

  const day = new Map();
  const week = new Map();
  for (const e of save.log) {
    if (!isActive(e) || e.ts < weekStart) continue; // начало недели всегда не позже начала суток
    const type = entryType(e);
    if (type !== 'quest' && type !== 'purchase') continue; // у забора наград лимитов нет
    const id = type === 'quest' ? `quest:${e.questId}` : `purchase:${e.rewardId}`;
    if (e.ts >= dayStart) day.set(id, (day.get(id) ?? 0) + 1);
    week.set(id, (week.get(id) ?? 0) + 1);
  }
  countsCache = { key, day, week };
  return countsCache;
}

function leftInPeriod(limit, countKey) {
  const counts = periodCounts()[limit.period];
  return limit.max - (counts.get(countKey) ?? 0);
}

function questLeft(quest) {
  return leftInPeriod(quest.limit, `quest:${quest.id}`);
}

function rewardLeft(reward) {
  if (!reward.limit) return Infinity;
  return leftInPeriod(reward.limit, `purchase:${reward.id}`);
}

// ===== Проверка журнала на «потерянные» id =====
let orphanCache = { revision: -1, text: '' };

function findOrphansText() {
  if (orphanCache.revision === saveRevision) return orphanCache.text;

  const questIds = new Set(QUESTS.map(q => q.id));
  const statIds = new Set(STATS.map(s => s.id));
  const rewardIds = new Set(REWARDS.map(r => r.id));
  const achIds = new Set(ACHIEVEMENTS.map(a => a.id));
  const quests = new Map();
  const stats = new Map();
  const rewards = new Map();
  const achievements = new Map();
  const care = new Map();
  const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

  for (const e of save.log) {
    if (!isActive(e)) continue;
    const type = entryType(e);
    if (type === 'quest') {
      if (!questIds.has(e.questId)) bump(quests, e.questId);
      if (!statIds.has(e.stat)) bump(stats, e.stat);
    } else if (type === 'purchase') {
      if (!rewardIds.has(e.rewardId)) bump(rewards, e.rewardId);
    } else if (type === 'claim') {
      if (!achIds.has(e.achievementId)) bump(achievements, e.achievementId);
    } else if (type === 'care') {
      if (!CARE_TASKS.some(t => t.id === e.taskId)) bump(care, e.taskId);
    }
  }

  const fmt = (label, map) => map.size
    ? `${label}: ${[...map].map(([id, n]) => `${id} (записей: ${n})`).join(', ')}`
    : null;
  const parts = [
    fmt('квесты', quests),
    fmt('статы', stats),
    fmt('награды', rewards),
    fmt('ачивки', achievements),
    fmt('дела ухода', care),
  ].filter(Boolean);

  const text = parts.length
    ? `⚠️ В журнале есть id, которых нет в config.js — ${parts.join('; ')}. ` +
      'Скорее всего, id изменили или удалили. Верните его в конфиг, чтобы записи снова учитывались полностью.'
    : '';
  if (text && text !== orphanCache.text) console.warn(text);
  orphanCache = { revision: saveRevision, text };
  return text;
}

function updateConfigWarning() {
  const el = document.getElementById('config-warning');
  if (!el) return;
  const text = findOrphansText();
  el.textContent = text;
  el.hidden = !text;
}

// ===== Синхронизация =====
// Локальная запись → строка таблицы log_entries
function toRow(e) {
  const type = entryType(e);
  const row = { id: e.id, type, ts: e.ts, deleted: !!e.deleted };
  if (type === 'quest') {
    Object.assign(row, { quest_id: e.questId, stat: e.stat, xp: e.xp, gold: e.gold ?? null });
  } else if (type === 'purchase') {
    Object.assign(row, { reward_id: e.rewardId, cost: e.cost });
  } else if (type === 'claim') {
    Object.assign(row, { achievement_id: e.achievementId, gold: e.gold });
  } else if (type === 'care') {
    Object.assign(row, { care_id: e.taskId });
  }
  return row;
}

// Строка таблицы → локальная запись
function fromRow(r) {
  const e = { id: r.id, type: r.type, ts: Number(r.ts), deleted: r.deleted };
  if (r.type === 'quest') {
    Object.assign(e, { questId: r.quest_id, stat: r.stat, xp: r.xp });
    if (r.gold !== null) e.gold = r.gold;
  } else if (r.type === 'purchase') {
    Object.assign(e, { rewardId: r.reward_id, cost: r.cost });
  } else if (r.type === 'claim') {
    Object.assign(e, { achievementId: r.achievement_id, gold: r.gold });
  } else if (r.type === 'care') {
    Object.assign(e, { taskId: r.care_id });
  }
  return e;
}

// Сливает записи в локальный журнал по id. Удаление побеждает.
// Возвращает массив добавленных записей.
function mergeEntries(entries, fromServer) {
  const byId = new Map(save.log.map(e => [e.id, e]));
  const added = [];
  let skipped = 0;

  for (const incoming of entries) {
    if (!isValidEntry(incoming)) {
      skipped++;
      continue;
    }
    const local = byId.get(incoming.id);
    if (!local) {
      const entry = { ...incoming, synced: fromServer };
      save.log.push(entry);
      byId.set(entry.id, entry);
      added.push(entry);
    } else if (incoming.deleted && !local.deleted) {
      local.deleted = true;
      if (!fromServer) local.synced = false;
    }
  }

  save.log.sort((a, b) => a.ts - b.ts);
  if (skipped) console.warn(`Пропущено некорректных записей: ${skipped}`);
  return added;
}

// Лимит для записи: { limit, key } или null, если у записи лимита нет
function limitFor(e) {
  if (entryType(e) === 'care') {
    return { limit: { period: 'care', max: 1 }, key: `care:${e.taskId}` };
  }
  if (entryType(e) === 'quest') {
    const q = QUESTS.find(x => x.id === e.questId);
    return q ? { limit: q.limit, key: `quest:${q.id}` } : null;
  }
  const r = REWARDS.find(x => x.id === e.rewardId);
  return r?.limit ? { limit: r.limit, key: `purchase:${r.id}` } : null;
}

// Ключ периода записи: дата дня или дата понедельника её недели
function bucketOf(e, period) {
  if (period === 'care') return careDayKey(e.ts);
  if (period === 'day') return dateKey(e.ts);
  const d = new Date(e.ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return dateKey(d.getTime());
}

// После слияния отменяет записи сверх лимита в затронутых периодах.
// Оставляет самые ранние; правило одинаково на всех устройствах.
// Возвращает число отменённых записей.
function enforceLimits(addedEntries) {
  const touched = new Set();
  for (const e of addedEntries) {
    if (!isActive(e)) continue;
    const info = limitFor(e);
    if (info) touched.add(`${info.key}|${bucketOf(e, info.limit.period)}`);
  }
  if (!touched.size) return 0;

  const groups = new Map();
  for (const e of save.log) {
    if (!isActive(e)) continue;
    const info = limitFor(e);
    if (!info) continue;
    const bucket = `${info.key}|${bucketOf(e, info.limit.period)}`;
    if (!touched.has(bucket)) continue;
    if (!groups.has(bucket)) groups.set(bucket, { max: info.limit.max, entries: [] });
    groups.get(bucket).entries.push(e);
  }

  let cancelled = 0;
  for (const { max, entries } of groups.values()) {
    if (entries.length <= max) continue;
    // Сначала по времени, при равенстве — по id. Простое сравнение строк, без учёта языка браузера.
    entries.sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : 1));
    for (const e of entries.slice(max)) {
      e.deleted = true;
      e.synced = false;
      cancelled++;
      console.warn('Отменена запись сверх лимита:', describeEntry(e), new Date(e.ts).toLocaleString());
    }
  }
  return cancelled;
}

async function fetchAllRows() {
  const PAGE = 1000;
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await db.from('log_entries')
      .select('*') // все колонки, какие есть: игра не ломается, если миграция БД ещё не выполнена
      .order('ts', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE) return all;
    from += PAGE;
  }
}

let syncing = false;
let syncAgain = false;
let syncBlocked = 0; // записи, которые база отклонила (например, миграция БД ещё не выполнена)

// Отправляет записи пачкой. Если база отклонила пачку (неизвестный тип записи или колонка),
// отправляет по одной: принятые синхронизируются, отклонённые остаются на устройстве.
// Возвращает Set id отклонённых записей. Ошибка сети — исключение.
async function pushRows(entries) {
  const rows = entries.map(toRow);
  const { error } = await db.from('log_entries').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (!error) return new Set();
  if (!error.code) throw error; // сеть или иная ошибка без кода базы
  console.warn('База отклонила пачку записей, отправляю по одной:', error.message);
  const rejected = new Set();
  for (const row of rows) {
    const { error: rowError } = await db.from('log_entries').upsert([row], { onConflict: 'id', ignoreDuplicates: true });
    if (!rowError) continue;
    if (!rowError.code) throw rowError;
    console.warn('Запись не принята базой:', row.type, row.id, rowError.message);
    rejected.add(row.id);
  }
  return rejected;
}

async function sync() {
  if (!currentUser || save.ownerId !== currentUser.id) return;
  if (syncing) {
    syncAgain = true; // синхронизация уже идёт — повторим после неё
    return;
  }
  syncing = true;
  setSyncStatus('⏳ синхронизация…');

  try {
    // 1. Push: отправить неотправленное
    const pending = save.log.filter(e => !e.synced);
    if (pending.length) {
      // Запоминаем, что именно отправили (защита от гонки, см. разбор)
      const sentDeleted = new Map(pending.map(e => [e.id, !!e.deleted]));

      const rejected = await pushRows(pending);
      syncBlocked = rejected.size;

      const deletedIds = pending.filter(e => e.deleted && !rejected.has(e.id)).map(e => e.id);
      if (deletedIds.length) {
        const { error: updateError } = await db.from('log_entries')
          .update({ deleted: true })
          .in('id', deletedIds);
        if (updateError) throw updateError;
      }

      pending.forEach(e => {
        if (!rejected.has(e.id) && !!e.deleted === sentDeleted.get(e.id)) e.synced = true;
      });
      storage.save(save);
    }

        // 2. Pull + merge: забрать всё из облака и слить
    const rows = await fetchAllRows();
    const added = mergeEntries(rows.map(fromRow), true);
    const cancelled = enforceLimits(added);
    storage.save(save);
    render();
    if (cancelled) {
      showMessage(`После синхронизации отменено записей сверх лимита: ${cancelled}`);
      syncAgain = true; // отправить отмены в облако
    }
    setSyncStatus(syncBlocked
      ? `⚠️ база не принимает записей: ${syncBlocked} — нужна SQL-миграция, данные сохранены на устройстве`
      : `✅ ${new Date().toLocaleTimeString().slice(0, 5)}`);
  } catch (e) {
    console.error('Ошибка синхронизации:', e);
    setSyncStatus('⚠️ офлайн, данные сохранены локально');
  } finally {
    syncing = false;
    if (syncAgain) {
      syncAgain = false;
      sync();
    }
  }
}

function setSyncStatus(text) {
  syncStatus = text;
  const el = document.getElementById('sync-status');
  if (el) el.textContent = text;
  updatePendingBadge();
}

// ===== Надёжность локальных данных =====
async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return; // браузер не поддерживает
  try {
    const already = await navigator.storage.persisted();
    const granted = already || await navigator.storage.persist();
    console.info(granted
      ? 'Хранилище: постоянное, браузер не удалит его сам'
      : 'Хранилище: обычное, браузер может очистить его при нехватке места');
  } catch (e) {
    console.warn('Не удалось запросить постоянное хранилище:', e);
  }
}
requestPersistentStorage();

function pendingCount() {
  return save.log.filter(e => !e.synced).length;
}

function updatePendingBadge() {
  const el = document.getElementById('pending-badge');
  if (!el) return;
  const n = pendingCount();
  el.textContent = n ? ` · не отправлено: ${n}` : '';
}

// ===== Действия =====
// Записывает действие в журнал. Возвращает true, если запись сохранена на устройстве.
// Сообщение об успехе и награда показываются только после успешной записи.
async function commit(entry, before, baseMessage) {
  const stored = { ...entry, synced: false };
  save.log.push(stored);
  const ok = await storage.save(save);
  if (!ok) {
    const i = save.log.indexOf(stored);
    if (i !== -1) save.log.splice(i, 1);
    saveRevision++;
    render();
    showMessage('⚠️ Не удалось сохранить действие на устройстве. Попробуйте ещё раз.');
    return false;
  }
  if (stored.deleted) {
    // при записи выяснилось, что другая вкладка уже исчерпала лимит
    render();
    showMessage('Действие уже выполнено в другой вкладке — повтор отменён');
    sync();
    return false;
  }
  const after = getState();
  render();

  let msg = baseMessage(after);

  if (after.hero.level > before.hero.level) {
    const oldTier = avatarTier(before.hero.level);
    const newTier = avatarTier(after.hero.level);
    showEffect(
      ASSETS.levelUp,
      `Уровень ${after.hero.level}`,
      newTier !== oldTier ? `Новый облик: ${newTier.name}` : 'Герой стал сильнее'
    );
  }

  // Ачивки, открывшиеся этим действием: эффекта нет, только сообщение
  after.achievements.forEach((a, i) => {
    if (!a.unlocked || before.achievements[i].unlocked) return;
    msg += a.claimed
      ? ` · 🏆 ${a.name} снова получена (+${a.claimGold} 🪙)`
      : ` · 🏆 Доступна награда: ${a.name}`;
  });

  showMessage(msg);
  sync();
  return true;
}

// Выполнение квеста. Возвращает 'saved', 'limit' или 'error'.
async function completeQuest(questId) {
  const quest = QUESTS.find(q => q.id === questId);
  if (!quest) {
    console.error('Квест не найден:', questId);
    return 'error';
  }
  absorbDisk(); // учесть выполнения из других вкладок до проверки лимита
  if (questLeft(quest) <= 0) {
    showMessage(`Лимит исчерпан ${PERIOD_NAMES[quest.limit.period]}`);
    render();
    return 'limit';
  }

  const before = getState();
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

  const ok = await commit(entry, before, (after) => {
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
  return ok ? 'saved' : 'error';
}

function buyReward(rewardId) {
  const reward = REWARDS.find(r => r.id === rewardId);
  if (!reward) {
    console.error('Награда не найдена:', rewardId);
    return;
  }
  const before = getState();
  const hp = getHealth().hp;
  if (hp < HEALTH.shopLockBelow) {
    showMessage(`Магазин закрыт: здоровье ${hp} — нужно ${HEALTH.shopLockBelow} или больше`);
    return;
  }
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

function claimAchievement(achievementId) {
  const before = getState();
  const a = before.achievements.find(x => x.id === achievementId);
  if (!a) {
    console.error('Ачивка не найдена:', achievementId);
    return;
  }
  if (!a.ready) {
    showMessage(a.claimed ? 'Награда уже получена' : 'Условия ачивки ещё не выполнены');
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    type: 'claim',
    achievementId: a.id,
    gold: a.gold,
    ts: Date.now(),
  };
  commit(entry, before, () => `🏆 ${a.name}: получено +${a.gold} 🪙`);
  showEffect(ASSETS.achievement, a.name, `${a.desc} · +${a.gold} 🪙`);
}

function describeEntry(e) {
  const type = entryType(e);
  if (type === 'purchase') {
    const r = REWARDS.find(x => x.id === e.rewardId);
    return `покупку «${r ? r.name : e.rewardId}»`;
  }
  if (type === 'care') {
    const t = CARE_TASKS.find(x => x.id === e.taskId);
    return `дело «${t ? t.name : e.taskId}»`;
  }
  if (type === 'claim') {
    const a = ACHIEVEMENTS.find(x => x.id === e.achievementId);
    return `получение награды за ачивку «${a ? a.name : e.achievementId}»`;
  }
  const q = QUESTS.find(x => x.id === e.questId);
  return `квест «${q ? q.name : e.questId}»`;
}

async function undoLast() {
  const last = [...save.log].reverse().find(isActive);
  if (!last) {
    showMessage('Нечего отменять');
    return;
  }
  if (!confirm(`Отменить ${describeEntry(last)}?`)) return;
  const prevSynced = last.synced;
  last.deleted = true;
  last.synced = false;
  if (!(await storage.save(save))) {
    last.deleted = false;
    last.synced = prevSynced;
    saveRevision++;
    render();
    showMessage('⚠️ Не удалось сохранить отмену. Попробуйте ещё раз.');
    return;
  }
  render();
  showMessage('Последнее действие отменено');
  sync();
}

async function resetAll() {
  if (!confirm('Сбросить весь прогресс НА ВСЕХ УСТРОЙСТВАХ? Отменить сброс будет нельзя.')) return;
  save.log.forEach(e => {
    if (isActive(e)) {
      e.deleted = true;
      e.synced = false;
    }
  });
  clearTodayDraft();
  if (!(await storage.save(save))) {
    showMessage('⚠️ Не удалось сохранить сброс. Обновите страницу и попробуйте ещё раз.');
    return;
  }
  render();
  showMessage('Прогресс сброшен');
  sync();
}

// ===== Визуал =====
function iconImg(src, cls = 'icon') {
  return html`<img class="${cls}" src="${src}" alt="">`;
}

function goldLabel(amount) {
  return html`${iconImg(ASSETS.gold)} ${amount}`;
}

function avatarTier(level) {
  let tier = AVATAR_TIERS[0];
  for (const t of AVATAR_TIERS) {
    if (level >= t.minLevel) tier = t;
  }
  return tier;
}

// Самый прокачанный стат: сначала по уровню, при равенстве — по XP. Нет прогресса — null.
function dominantStat(stats) {
  let best = null;
  for (const s of STATS) {
    const st = stats[s.id];
    if (st.level === 1 && st.xp === 0) continue;
    const b = best && stats[best.id];
    if (!best || st.level > b.level || (st.level === b.level && st.xp > b.xp)) best = s;
  }
  return best;
}

// Битые картинки. Событие error не всплывает, поэтому ловим его на фазе перехвата (третий аргумент true)
document.addEventListener('error', (e) => {
  if (e.target.tagName === 'IMG') {
    console.warn('Не найден файл картинки:', e.target.getAttribute('src'));
    e.target.classList.add('img-missing');
  }
}, true);

// Заранее загружаем эмблемы, чтобы эффект не появлялся с задержкой
[ASSETS.levelUp, ASSETS.achievement].forEach(src => { new Image().src = src; });

// Очередь эффектов: если за одно действие и level-up, и ачивка — покажутся по очереди
const fxQueue = [];
let fxTimer = null;

function showEffect(image, title, subtitle) {
  fxQueue.push({ image, title, subtitle });
  if (document.getElementById('fx').hidden) nextEffect();
}

function nextEffect() {
  clearTimeout(fxTimer);
  const fx = document.getElementById('fx');
  const item = fxQueue.shift();
  if (!item) {
    fx.hidden = true;
    fx.classList.remove('play');
    return;
  }
  const img = document.getElementById('fx-img');
  img.classList.remove('img-missing');
  img.src = item.image;
  document.getElementById('fx-title').textContent = item.title;
  document.getElementById('fx-sub').textContent = item.subtitle;

  fx.hidden = false;
  fx.classList.remove('play');
  void fx.offsetWidth; // принудительный перерасчёт: без него повторная анимация не запустится
  fx.classList.add('play');
  fxTimer = setTimeout(nextEffect, 2600);
}

document.getElementById('fx').addEventListener('click', nextEffect);

// ===== Интерфейс =====
function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, ch => map[ch]);
}

// Обёртка-маркер: «этот HTML уже безопасен, экранировать не нужно»
class SafeHtml {
  constructor(value) {
    this.value = value;
  }
}

// Явная вставка HTML без экранирования. Использовать только для своих, проверенных строк.
function raw(value) {
  return new SafeHtml(String(value));
}

// Шаблон с автоэкранированием
function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => {
    out += toSafeString(v) + strings[i + 1];
  });
  return new SafeHtml(out);
}

function toSafeString(v) {
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(toSafeString).join('');
  if (v === null || v === undefined || v === false) return '';
  return escapeHtml(v);
}

// Единственное место в коде, где пишем в innerHTML. Принимает только SafeHtml.
function setHtml(id, content) {
  if (!(content instanceof SafeHtml)) {
    throw new TypeError(`setHtml(${id}): ожидался результат html\`\``);
  }
  document.getElementById(id).innerHTML = content.value;
}

function renderBar(current, max) {
  const pct = max > 0 ? Math.min(current / max * 100, 100) : 0;
  return html`<div class="bar"><div class="bar-fill" style="width: ${pct}%"></div></div>`;
}

function renderLevelBar(entity, curve) {
  const need = xpToNext(entity.level, curve);
  return html`${renderBar(entity.xp, need)}<div class="bar-label">${entity.xp} / ${need} XP</div>`;
}

function renderAuth() {
  if (currentUser) {
    setHtml('auth', html`
      <div class="sync-bar">
        <span>${currentUser.email} · <span id="sync-status">${syncStatus}</span><span id="pending-badge" class="pending"></span></span>
        <button id="logout-btn">Выйти</button>
      </div>`);
  } else {
    setHtml('auth', html`
      <form id="login-form" class="login">
        <input type="email" name="email" placeholder="Email" required autocomplete="username">
        <input type="password" name="password" placeholder="Пароль" required autocomplete="current-password">
        <button type="submit">Войти для синхронизации</button>
        <small class="hint">Без входа данные хранятся только на этом устройстве</small>
      </form>`);
  }
  updatePendingBadge();
}

function render() {
  const view = getState();
  const health = getHealth();
  const tier = avatarTier(view.hero.level);
  const top = dominantStat(view.stats);
  const frame = top ? top.color : 'var(--gold)';
  const bg = top
    ? `background-image: radial-gradient(circle, transparent 35%, rgba(0,0,0,0.75)), url('${ASSETS.background(top.id)}');`
    : '';

  setHtml('hero', html`
    <div class="hero-card" style="--frame: ${frame}; ${bg}">
      <img class="avatar" src="${tier.image}" alt="${tier.name}">
    </div>
    <h1>${tier.name} <span class="lvl">· ур. ${view.hero.level}</span></h1>
    ${renderHealthBar(health)}
    ${renderLevelBar(view.hero, BALANCE.hero)}
    <div class="bar-label">
      Всего опыта: ${view.totalXp} · <span class="gold">${goldLabel(view.gold)}</span>
      ${top ? ` · Путь: ${top.name}` : ''}
    </div>`);

  setHtml('stats', html`${STATS.map(s => {
    const st = view.stats[s.id];
    return html`
      <div class="stat" style="--c: ${s.color}">
        <div class="stat-head"><span>${iconImg(s.icon)} ${s.name}</span><span>Ур. ${st.level}</span></div>
        ${renderLevelBar(st, BALANCE.stat)}
      </div>`;
  })}`);

  // Квадратики статов: иконка, название, число доступных сегодня квестов
  const questStat = STATS.find(s => s.id === ui.questStat) ?? STATS[0];
  setHtml('quest-tabs', html`${STATS.map(s => {
    const available = QUESTS.filter(q => !q.today && q.stat === s.id && questLeft(q) > 0).length;
    return html`
      <button class="stat-tab ${s.id === questStat.id ? 'active' : ''}" style="--c: ${s.color}"
              data-quest-stat="${s.id}" title="${s.name}">
        ${iconImg(s.icon, 'stat-tab-icon')}
        <span class="stat-tab-name">${s.name}</span>
        <span class="stat-tab-count">${available}</span>
      </button>`;
  })}`);

  // Квесты выбранного стата
  setHtml('quests', html`${QUESTS.filter(q => !q.today && q.stat === questStat.id).map(q => {
    const left = Math.max(questLeft(q), 0);
    return html`
      <button class="quest" style="--c: ${questStat.color}" data-quest="${q.id}" ${left === 0 ? 'disabled' : ''}>
        ${iconImg(q.icon ?? questStat.icon)}
        <span class="quest-main">${q.name}
          <small>${q.goal} · осталось ${PERIOD_NAMES[q.limit.period]}: ${left}</small>
        </span>
        <span>+${q.xp}</span>
      </button>`;
  })}`);

  const shopLocked = health.hp < HEALTH.shopLockBelow;
  setHtml('shop', html`
    ${shopLocked ? html`<p class="shop-locked">🔒 Магазин закрыт: здоровье ${health.hp} из ${HEALTH.max}. Откроется при ${HEALTH.shopLockBelow}+ — выполняй дела ухода за собой.</p>` : ''}
    ${REWARDS.map(r => {
    const left = rewardLeft(r);
    const affordable = view.gold >= r.cost;
    const available = affordable && left > 0 && !shopLocked;
    let note = affordable ? 'Можно купить' : `Не хватает ${r.cost - view.gold}`;
    if (r.limit) note += ` · осталось ${PERIOD_NAMES[r.limit.period]}: ${Math.max(left, 0)}`;
    return html`
      <button class="quest reward" data-reward="${r.id}" ${available ? '' : 'disabled'}>
        <span class="quest-main">${r.icon} ${r.name}<small>${note}</small></span>
        <span class="gold">${goldLabel(r.cost)}</span>
      </button>`;
  })}`);

    const unlockedCount = view.achievements.filter(a => a.unlocked).length;
  setHtml('achievements', html`
    <p class="bar-label">Открыто: ${unlockedCount} / ${view.achievements.length}</p>
    ${view.achievements.map(a => {
      let status = '';
      if (a.unlocked && a.claimed) status = ' · получено ✓';
      else if (!a.unlocked && a.claimed) status = ' · награда вернётся при выполнении условий';
      return html`
        <div class="ach ${a.unlocked ? '' : 'locked'} ${a.ready ? 'ready' : ''}">
          ${iconImg(a.unlocked ? (a.image ?? ASSETS.trophy) : ASSETS.lock, 'ach-icon')}
          <div class="ach-body">
            <strong>${a.name}</strong> <span class="gold">+${goldLabel(a.gold)}</span>
            <small>${a.desc} · ${a.current} / ${a.target}${status}</small>
            ${a.unlocked ? '' : renderBar(a.current, a.target)}
            ${a.ready ? html`<button class="claim-btn" data-claim="${a.id}">Забрать награду</button>` : ''}
          </div>
        </div>`;
    })}`);
  document.querySelectorAll('.ach-badge').forEach(el => { el.textContent = view.readyCount || ''; });
  renderToday();
  renderCare(health, view);
  updatePendingBadge();
  updateBackupHint();
  updateConfigWarning();
}

let messageTimer;
function showMessage(text) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.classList.add('visible');
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => el.classList.remove('visible'), 4000);
}

// ===== Бэкап =====
const LAST_EXPORT_KEY = 'life-rpg-last-export';

function exportSave() {
  const json = JSON.stringify(save, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `life-rpg-backup-${dateKey(Date.now())}.json`;
  a.click();
  URL.revokeObjectURL(url);

  try {
    localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
  } catch (e) {
    console.warn('Не удалось запомнить дату экспорта:', e);
  }
  updateBackupHint();
}

function updateBackupHint() {
  const el = document.getElementById('backup-hint');
  if (!el) return;
  let last = null;
  try {
    last = Number(localStorage.getItem(LAST_EXPORT_KEY)) || null;
  } catch (e) {
    // хранилище недоступно — считаем, что экспорта не было
  }
  if (!last) {
    el.textContent = '⚠️ Экспорт ещё не делался на этом устройстве';
    return;
  }
  const days = Math.floor((Date.now() - last) / DAY_MS);
  el.textContent = days > 7
    ? `⚠️ Последний экспорт ${days} дн. назад — сделайте бэкап`
    : `Последний экспорт: ${days === 0 ? 'сегодня' : days + ' дн. назад'}`;
}

async function importSave(file) {
  try {
    const data = migrate(JSON.parse(await file.text()));
    if (!data || !isValidSave(data)) {
      alert('Файл не похож на сохранение Life RPG или создан более новой версией игры');
      return;
    }
        const added = mergeEntries(data.log, false);
    const cancelled = enforceLimits(added);
    storage.save(save);
    render();
    showMessage(`Импортировано новых записей: ${added.length}` +
      (cancelled ? `, отменено сверх лимита: ${cancelled}` : ''));
    sync();
  } catch (e) {
    alert('Не удалось прочитать файл: ' + e.message);
  }
}

// ===== Авторизация =====
document.getElementById('auth').addEventListener('submit', async (e) => {
  e.preventDefault(); // не перезагружать страницу при отправке формы
  const form = e.target;
  const button = form.querySelector('button');
  button.disabled = true;
  const { error } = await db.auth.signInWithPassword({
    email: form.email.value.trim(),
    password: form.password.value,
  });
  button.disabled = false;
  if (error) showMessage('Ошибка входа: ' + error.message);
});

document.getElementById('auth').addEventListener('click', async (e) => {
  if (e.target.id !== 'logout-btn') return;
  if (!confirm('Выйти? Локальные данные останутся на этом устройстве.')) return;
  await db.auth.signOut();
});

// Проверяет, чьи данные лежат на устройстве. true — можно синхронизировать.
function checkOwner(user) {
  if (save.ownerId === user.id) return true;

  if (save.ownerId === null) {
    // Данные набраны без входа — присваиваем их этому аккаунту
    save.ownerId = user.id;
    storage.save(save);
    return true;
  }

  const ok = confirm(
    'Данные на этом устройстве принадлежат другому аккаунту.\n\n' +
    'OK — убрать их с устройства (копия сохранится в резерв) и загрузить данные текущего аккаунта.\n' +
    'Отмена — выйти из аккаунта, ничего не меняя.'
  );
  if (!ok) return false;

  storage.archive(save);
  save.log = [];
  save.ownerId = user.id;
  clearTodayDraft();
  storage.save(save, { replace: true });
  render();
  return true;
}

db.auth.onAuthStateChange((event, session) => {
  const user = session?.user ?? null;
  const isLogin = event === 'INITIAL_SESSION' || event === 'SIGNED_IN';

  if (user && isLogin && !checkOwner(user)) {
    // Через setTimeout: внутри этого обработчика нельзя ждать другие запросы Supabase
    setTimeout(() => db.auth.signOut(), 0);
    return;
  }

  if (event === 'SIGNED_OUT') clearTodayDraft(); // незавершённое действие не переживает выход
  currentUser = user;
  if (!currentUser) syncStatus = '';
  renderAuth();
  if (currentUser && isLogin) setTimeout(sync, 0);
});

// ===== Раскладка: экраны и вкладки =====
// Состояние интерфейса: что открыто. Запоминается на устройстве.
const UI_KEY = 'life-rpg-ui';
const UI_VERSION = 2; // v2: появился экран «Сегодня», он открывается первым
const SCREENS = ['today', 'hero', 'quests', 'shop', 'achievements'];
const ui = { v: UI_VERSION, screen: 'today', right: 'shop', questStat: STATS[0].id };
try {
  const stored = JSON.parse(localStorage.getItem(UI_KEY)) || {};
  if (stored.v === UI_VERSION) Object.assign(ui, stored);
  else Object.assign(ui, { right: stored.right ?? ui.right, questStat: stored.questStat ?? ui.questStat });
} catch (e) {
  // хранилище недоступно — используем значения по умолчанию
}
if (!SCREENS.includes(ui.screen)) ui.screen = 'today';
if (!STATS.some(s => s.id === ui.questStat)) ui.questStat = STATS[0].id;

function saveUi() {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(ui));
  } catch (e) {
    // не критично: в следующий раз откроется экран по умолчанию
  }
}

// Применить состояние: атрибуты body управляют раскладкой через CSS
function applyUi() {
  document.body.dataset.active = ui.screen;
  document.body.dataset.right = ui.right;
  document.querySelectorAll('[data-go-screen]').forEach(b => {
    b.classList.toggle('active', b.dataset.goScreen === ui.screen);
  });
  document.querySelectorAll('[data-go-right]').forEach(b => {
    b.classList.toggle('active', b.dataset.goRight === ui.right);
  });
}

document.addEventListener('click', (e) => {
  // Меню экранов (телефон)
  const screenBtn = e.target.closest('[data-go-screen]');
  if (screenBtn) {
    ui.screen = screenBtn.dataset.goScreen;
    if (ui.screen === 'shop' || ui.screen === 'achievements') ui.right = ui.screen;
    saveUi();
    applyUi();
    window.scrollTo(0, 0);
    return;
  }

  // Вкладки «Магазин / Ачивки» (ПК)
  const rightBtn = e.target.closest('[data-go-right]');
  if (rightBtn) {
    ui.right = rightBtn.dataset.goRight;
    if (ui.screen === 'shop' || ui.screen === 'achievements') ui.screen = ui.right;
    saveUi();
    applyUi();
    return;
  }

  // Квадратики статов в квестах
  const statBtn = e.target.closest('[data-quest-stat]');
  if (statBtn) {
    ui.questStat = statBtn.dataset.questStat;
    saveUi();
    render();
  }
});

applyUi();

// ===== Здоровье =====
// «День здоровья» начинается в HEALTH.dayStartHour (04:00): душ в 00:30 засчитывается вчерашнему дню.
function careDayKey(ts) {
  return dateKey(ts - HEALTH.dayStartHour * 60 * 60 * 1000);
}

function nextDayKey(key) {
  const d = new Date(key + 'T12:00:00'); // полдень: переход на летнее время не сдвинет дату
  d.setDate(d.getDate() + 1);
  return dateKey(d.getTime());
}

// Активная запись выполнения дела за текущий день здоровья (или null)
function careDoneToday(taskId) {
  const today = careDayKey(Date.now());
  return save.log.find(e => isActive(e) && entryType(e) === 'care'
    && e.taskId === taskId && careDayKey(e.ts) === today) ?? null;
}

// Здоровье из журнала. По каждому дню с startDate: сначала +restorePerTask за выполненные дела
// (не выше max), затем, если день уже закончился, −penalty за каждое невыполненное.
let healthCache = { key: null, value: null };
function getHealth() {
  const today = careDayKey(Date.now());
  const key = `${saveRevision}|${today}`;
  if (healthCache.key === key) return healthCache.value;

  const doneByDay = new Map();
  for (const e of save.log) {
    if (!isActive(e) || entryType(e) !== 'care') continue;
    if (!CARE_TASKS.some(t => t.id === e.taskId)) continue;
    const day = careDayKey(e.ts);
    if (day < HEALTH.startDate) continue;
    if (!doneByDay.has(day)) doneByDay.set(day, new Set());
    doneByDay.get(day).add(e.taskId);
  }

  let hp = HEALTH.max;
  let lastPenalty = 0;
  for (let day = HEALTH.startDate; day <= today; day = nextDayKey(day)) {
    const done = doneByDay.get(day) ?? new Set();
    hp = Math.min(HEALTH.max, hp + done.size * HEALTH.restorePerTask);
    if (day < today) {
      const penalty = CARE_TASKS.filter(t => !done.has(t.id)).reduce((sum, t) => sum + t.penalty, 0);
      hp = Math.max(0, hp - penalty);
      lastPenalty = penalty;
    }
  }
  const started = today >= HEALTH.startDate;
  const doneToday = started ? (doneByDay.get(today)?.size ?? 0) : 0;
  const value = { hp, started, lastPenalty, doneToday };
  healthCache = { key, value };
  return value;
}

function renderHealthBar(health) {
  const pct = health.hp / HEALTH.max * 100;
  const level = health.hp < HEALTH.shopLockBelow ? 'low' : health.hp < 60 ? 'mid' : 'high';
  return html`
    <div class="hp-row" title="Здоровье">
      <span class="hp-label">❤ Здоровье</span>
      <div class="bar hp-bar ${level}" role="progressbar" aria-label="Здоровье"
           aria-valuemin="0" aria-valuemax="${HEALTH.max}" aria-valuenow="${health.hp}">
        <div class="bar-fill" style="width: ${pct}%"></div>
      </div>
      <span class="hp-value">${health.hp}/${HEALTH.max}</span>
    </div>`;
}

let careDayShown = careDayKey(Date.now());
let careBusy = false;

// Состояние раскрытых блоков <details>: переживает перерисовку
const openDetails = new Set();
document.addEventListener('toggle', (e) => {
  const id = e.target?.dataset?.details;
  if (!id) return;
  if (e.target.open) openDetails.add(id);
  else openDetails.delete(id);
}, true);
function detailsAttr(id) {
  return openDetails.has(id) ? 'open' : '';
}

function partProgress(part) {
  const tasks = CARE_TASKS.filter(t => t.part === part);
  return { done: tasks.filter(t => careDoneToday(t.id)).length, total: tasks.length };
}

function renderCare(health, view) {
  careDayShown = careDayKey(Date.now());
  const startLabel = new Date(HEALTH.startDate + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const next = view.achievements.find(a => a.condition.type === 'careDays' && !a.unlocked);
  const hour = String(HEALTH.dayStartHour).padStart(2, '0');
  setHtml('care', html`
    <div class="care-head">
      <h3>Уход · ${health.doneToday}/${CARE_TASKS.length}</h3>
      <span class="today-count">♥ ${health.hp}/${HEALTH.max}</span>
    </div>
    <p class="today-note care-rule">
      Полных дней: ${view.careFullDays}${next ? ` · до «${next.name}»: ${next.current} из ${next.target}` : ' · все рубежи пройдены'}
    </p>
    ${health.hp < HEALTH.shopLockBelow ? html`<p class="shop-locked">Здоровье ${health.hp}: магазин закрыт до ${HEALTH.shopLockBelow}. Заработанное золото сохраняется.</p>` : ''}
    ${Object.entries(CARE_PARTS).map(([part, label]) => {
      const tasks = CARE_TASKS.filter(t => t.part === part);
      if (!tasks.length) return '';
      const p = partProgress(part);
      return html`
        <div class="care-part">
          <div class="care-part-name">${label} · ${p.done}/${p.total}${p.done === p.total ? ' ✓' : ''}</div>
          ${tasks.map(t => {
            const done = Boolean(careDoneToday(t.id));
            const badge = done ? (health.hp < HEALTH.max ? `+${HEALTH.restorePerTask} ♥` : '') : `−${t.penalty}`;
            return html`
              <button class="care-task ${done ? 'done' : ''}" data-care="${t.id}" aria-pressed="${done ? 'true' : 'false'}" ${careBusy ? 'disabled' : ''}>
                <span class="care-check" aria-hidden="true">${done ? '✓' : ''}</span>
                <span class="care-name">${t.name}</span>
                <span class="care-penalty">${badge}</span>
              </button>`;
          })}
        </div>`;
    })}
    <details class="info" data-details="care-rules" ${detailsAttr('care-rules')}>
      <summary>Как считается</summary>
      <ul>
        <li>Каждое отмеченное дело: +${HEALTH.restorePerTask} к здоровью, максимум ${HEALTH.max}.</li>
        <li>День ухода длится с ${hour}:00 до ${hour}:00. В ${hour}:00 за каждое невыполненное вчера дело здоровье снижается на число рядом с делом.</li>
        <li>Все ${CARE_TASKS.length} дел за день: +${HEALTH.fullDayGold} монет, при любом здоровье.</li>
        <li>Достижения ухода считают полные дни накопительно: пропуск не отнимает прежние дни.</li>
        <li>Ниже ${HEALTH.shopLockBelow} здоровья магазин закрыт; золото и полученные награды сохраняются.</li>
        <li>${health.started ? (health.lastPenalty ? `Вчера здоровье снизилось на ${health.lastPenalty}.` : 'Вчера снижения не было.') : `Здоровье считается с ${startLabel}.`}</li>
      </ul>
    </details>`);
}

const PART_DONE = { morning: 'Утро завершено', day: 'День завершён', evening: 'Вечер завершён' };

// Короткая обратная связь после отметки: дело, группа, полный день, доступное достижение
function careFeedback(task, before, after) {
  const p = partProgress(task.part);
  const label = CARE_PARTS[task.part];
  const parts = [task.doneMsg ?? `✓ ${task.name}`];
  parts.push(p.done === p.total ? `${PART_DONE[task.part] ?? label + ' завершено'} · ${p.done}/${p.total}` : `${label}: ${p.done}/${p.total}`);
  if (after.careFullDays > before.careFullDays) {
    parts.push(`Вся база дня выполнена. +${HEALTH.fullDayGold} монет`);
  }
  after.achievements.forEach((a, i) => {
    if (!a.unlocked || before.achievements[i].unlocked) return;
    parts.push(a.claimed ? `«${a.name}» снова засчитано (+${a.claimGold})` : `Доступна награда: «${a.name}»`);
  });
  return parts.join(' · ');
}

// Отметить или снять отметку дела за текущий день здоровья
async function toggleCare(taskId) {
  if (careBusy) return;
  const task = CARE_TASKS.find(t => t.id === taskId);
  if (!task) return;
  careBusy = true;
  absorbDisk();
  const before = getState();
  const existing = careDoneToday(taskId);
  let ok;
  if (existing) {
    const prevSynced = existing.synced;
    existing.deleted = true;
    existing.synced = false;
    ok = await storage.save(save);
    if (!ok) {
      existing.deleted = false;
      existing.synced = prevSynced;
      saveRevision++;
    }
  } else {
    const entry = { id: crypto.randomUUID(), type: 'care', taskId, ts: Date.now(), synced: false };
    save.log.push(entry);
    ok = await storage.save(save);
    if (!ok) {
      const i = save.log.indexOf(entry);
      if (i !== -1) save.log.splice(i, 1);
      saveRevision++;
    }
  }
  careBusy = false;
  render();
  document.querySelector(`[data-care="${taskId}"]`)?.focus();
  if (!ok) {
    showMessage('⚠️ Не удалось сохранить отметку на устройстве. Попробуйте ещё раз.');
    return;
  }
  showMessage(existing ? `Отметка снята: ${task.name}` : careFeedback(task, before, getState()));
  sync();
}

document.getElementById('care').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-care]');
  if (btn && !btn.disabled) toggleCare(btn.dataset.care);
});

// ===== Раздел «Сегодня» =====
// Выполнено ли — считается только по журналу (активные записи за текущую локальную дату).
// Начатая карточка — локальный черновик интерфейса: не влияет на прогресс, не синхронизируется.
const DRAFT_KEY = 'life-rpg-today-draft';
const DRAFT_VERSION = 1;
let todayError = null; // { questId, text } — ошибка записи, показывается в карточке
let todayBusy = false; // защита от двойного нажатия «Завершить»
let todayDateShown = dateKey(Date.now());

function todayQuests() {
  const weekday = new Date().getDay();
  return QUESTS.filter(q => q.today && q.today.days.includes(weekday));
}

function doneToday(questId) {
  const today = dateKey(Date.now());
  return save.log.find(e => isActive(e) && entryType(e) === 'quest'
    && e.questId === questId && dateKey(e.ts) === today) ?? null;
}

function clearTodayDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    // не критично
  }
}

// Активный черновик: только этого дня, этого владельца, для карточки, доступной сегодня и ещё не выполненной
function activeDraft() {
  let d = null;
  try {
    d = JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch (e) {
    return null;
  }
  if (!d) return null;
  const valid = d.v === DRAFT_VERSION
    && d.date === dateKey(Date.now())
    && d.owner === save.ownerId
    && todayQuests().some(q => q.id === d.questId)
    && !doneToday(d.questId);
  if (!valid) {
    clearTodayDraft();
    return null;
  }
  return d;
}

function startToday(questId) {
  if (!todayQuests().some(q => q.id === questId) || doneToday(questId)) {
    render();
    return;
  }
  const current = activeDraft();
  if (current && current.questId !== questId) {
    const q = QUESTS.find(x => x.id === current.questId);
    showMessage(`Сначала заверши или отложи «${q.name}»`);
    return;
  }
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      v: DRAFT_VERSION, owner: save.ownerId, questId, date: dateKey(Date.now()), startedAt: Date.now(),
    }));
  } catch (e) {
    showMessage('⚠️ Не удалось запомнить начало — но можно просто начать и потом нажать «Завершить»');
  }
  todayError = null;
  render();
  focusToday(questId, 'finish');
}

function laterToday(questId) {
  const d = activeDraft();
  if (d?.questId === questId) clearTodayDraft();
  todayError = null;
  render();
  focusToday(questId, 'start');
}

async function finishToday(questId) {
  if (todayBusy) return;
  const d = activeDraft();
  if (!d || d.questId !== questId) {
    // день сменился, карточку отменили или уже выполнили в другом месте
    render();
    showMessage(doneToday(questId) ? 'Уже выполнено сегодня' : 'Начни карточку заново — день сменился');
    return;
  }
  todayBusy = true;
  render();
  const result = await completeQuest(questId);
  todayBusy = false;
  if (result === 'saved') {
    clearTodayDraft();
    todayError = null;
  } else if (result === 'error') {
    todayError = { questId, text: 'Результат не сохранился на устройстве. Награда не начислена.' };
  }
  render();
  focusToday(questId, result === 'error' ? 'finish' : null);
}

function focusToday(questId, action) {
  const card = document.querySelector(`[data-today-card="${questId}"]`);
  if (!card) return;
  const target = (action && card.querySelector(`[data-today-action="${action}"]`)) || card;
  target.focus();
}

function renderToday() {
  const cards = todayQuests();
  const draft = activeDraft();
  const doneCount = cards.filter(q => doneToday(q.id)).length;
  const dateLabel = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const activeQuest = draft ? QUESTS.find(q => q.id === draft.questId) : null;
  todayDateShown = dateKey(Date.now());

  setHtml('today', html`
    <div class="today-head">
      <span class="today-date">${dateLabel}</span>
      <span class="today-count">Выполнено: ${doneCount} из ${cards.length}</span>
    </div>
    ${cards.map(q => {
      const stat = STATS.find(s => s.id === q.stat);
      const gold = Math.round(q.xp * BALANCE.goldPerXp);
      const done = doneToday(q.id);
      const active = draft?.questId === q.id;
      const blocked = !done && !active && Boolean(draft);
      const error = todayError?.questId === q.id ? todayError.text : '';
      const t = q.today;
      const state = done ? 'done' : active ? 'active' : 'ready';
      return html`
        <article class="today-card ${state}" style="--c: ${stat.color}" data-today-card="${q.id}" tabindex="-1">
          <header class="today-card-head">
            ${iconImg(stat.icon)}
            <h3>${q.name}</h3>
            <span class="today-reward">+${q.xp} XP · ${goldLabel(gold)}</span>
          </header>
          ${done ? html`
            <p class="today-done" role="status">✓ Выполнено · начислено +${done.xp} XP и ${goldLabel(questGold(done, BALANCE))}</p>
          ` : html`
            <p class="today-step"><b>${active ? 'Сейчас:' : 'Первый шаг:'}</b> ${t.firstStep}</p>
            <p class="today-line"><b>Готово, когда:</b> ${t.done}</p>
            ${t.example ? html`<p class="today-line"><b>Например:</b> ${t.example}</p>` : ''}
            ${active ? html`<p class="today-hint">${t.hint}</p>` : ''}
            ${t.note ? html`<p class="today-note">${t.note}</p>` : ''}
            ${error ? html`<p class="today-error" role="alert">⚠️ ${error}</p>` : ''}
            <div class="today-actions">
              ${active ? html`
                <button class="today-btn primary" data-today-action="finish" data-quest-id="${q.id}" ${todayBusy ? 'disabled' : ''}>
                  ${todayBusy ? 'Сохраняю…' : error ? 'Повторить сохранение' : 'Завершить'}
                </button>
                <button class="today-btn" data-today-action="later" data-quest-id="${q.id}" ${todayBusy ? 'disabled' : ''}>Вернуться позже</button>
              ` : html`
                <button class="today-btn primary" data-today-action="start" data-quest-id="${q.id}" ${blocked ? 'disabled' : ''}>Начать</button>
              `}
            </div>
            ${blocked ? html`<p class="today-note">Сначала заверши или отложи «${activeQuest.name}».</p>` : ''}
          `}
        </article>`;
    })}`);
}

document.getElementById('today').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-today-action]');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.questId;
  const action = btn.dataset.todayAction;
  if (action === 'start') startToday(id);
  else if (action === 'later') laterToday(id);
  else if (action === 'finish') finishToday(id);
});

// Смена дня при открытой вкладке: раз в 30 секунд проверяем дату
setInterval(() => {
  if (dateKey(Date.now()) !== todayDateShown || careDayKey(Date.now()) !== careDayShown) {
    todayError = null;
    render();
  }
}, 30 * 1000);

// ===== Обработчики событий =====
document.getElementById('quests').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-quest]');
  if (btn && !btn.disabled) completeQuest(btn.dataset.quest);
});

document.getElementById('shop').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-reward]');
  if (btn && !btn.disabled) buyReward(btn.dataset.reward);
});

document.getElementById('achievements').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-claim]');
  if (btn) claimAchievement(btn.dataset.claim);
});

document.getElementById('undo-btn').addEventListener('click', undoLast);
document.getElementById('export-btn').addEventListener('click', exportSave);
document.getElementById('reset-btn').addEventListener('click', resetAll);

document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importSave(file);
  e.target.value = '';
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    render();
    sync();
  }
});

window.addEventListener('online', sync);

render();
renderAuth();