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
  LEISURE.allowanceHistory.forEach((h, i) => {
    if (!Number.isFinite(new Date(h.from + 'T00:00:00').getTime())) errors.push(`LEISURE.allowanceHistory[${i}]: некорректная дата`);
    if (i > 0 && !(h.from > LEISURE.allowanceHistory[i - 1].from)) errors.push('LEISURE.allowanceHistory: даты должны возрастать');
    Object.keys(LEISURE.modes).forEach(m => {
      if (!(Number.isInteger(h.minutes[m]) && h.minutes[m] >= 0)) errors.push(`LEISURE.allowanceHistory[${i}]: нет минут для режима ${m}`);
    });
  });
  REWARDS.filter(r => r.minutes !== undefined).forEach(r => {
    if (!Number.isInteger(r.minutes) || r.minutes <= 0) errors.push(`Награда ${r.id}: minutes — целое > 0`);
  });
  const rules = PLAN.versions[PLAN.rulesVersion];
  if (!rules) errors.push('PLAN: нет правил для rulesVersion');
  else Object.entries(rules.questDirs).forEach(([qid, dir]) => {
    if (!questIds.has(qid)) errors.push(`PLAN: неизвестный квест ${qid}`);
    if (!PLAN.directions[dir]) errors.push(`PLAN: неизвестное направление ${dir}`);
  });
  errors.forEach(e => console.error('Ошибка конфига:', e));
}
validateConfig();

// ===== Локальное сохранение =====
const STORAGE_KEY = 'life-rpg-save';
const SAVE_VERSION = 8;

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
  // v6 → v7: тип записи 'leisure' (расход времени) и поле minutes у покупок. Данные не меняются
  6: (data) => ({ ...data, version: 7 }),
  // v7 → v8: события планировщика 'plan' и метаданные выполнения квеста (payload). Данные не меняются
  7: (data) => ({ ...data, version: 8 }),
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

const MINUTE = 60 * 1000;
// Операции планировщика и пределы длины текста (объявлены до загрузки сохранения)
const PLAN_OPS = new Set(['activate', 'project-create', 'project-set', 'project-archive',
  'stage-add', 'stage-set', 'stage-done', 'stage-remove', 'pick-add', 'pick-remove']);
const NAME_MAX = 200;
const NOTE_MAX = 2000;

// Метаданные выполнения квеста: игровой день, версия правил, сессия, карточка, проект/этап, снимок названий
function validQuestPayload(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  const optStr = (v, max = 64) => v === undefined || v === null || (typeof v === 'string' && v.length <= max);
  return /^\d{4}-\d{2}-\d{2}$/.test(p.gameDay ?? '')
    && (p.rv === undefined || Number.isInteger(p.rv))
    && optStr(p.sessionId) && optStr(p.pickId) && optStr(p.projectId) && optStr(p.stageId) && optStr(p.dir)
    && (p.names === undefined || (typeof p.names === 'object' && p.names !== null
      && optStr(p.names.project, 200) && optStr(p.names.stage, 200)));
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
        && (e.gold === undefined || (Number.isInteger(e.gold) && e.gold >= 0))
        && (e.payload === undefined || validQuestPayload(e.payload));
    case 'plan':
      return validPlanPayload(e.payload);
    case 'purchase':
      return typeof e.rewardId === 'string' && Number.isInteger(e.cost) && e.cost > 0
        && (e.minutes === undefined || (Number.isInteger(e.minutes) && e.minutes > 0));
    case 'leisure': {
      const minutes = (e.end - e.start) / MINUTE;
      return Number.isInteger(e.start) && Number.isInteger(e.end)
        && e.start % MINUTE === 0 && e.end % MINUTE === 0
        && Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440
        && typeof e.category === 'string';
    }
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
  const plan = computePlan(log, Date.now());
  gold += plan.bonusGold;

  const view = { hero, stats, totalXp, quests, purchases, careFullDays: careDays.length, careDaysList: careDays, plan };
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
// Ключ включает игровой день: бонусы и поправки плана зависят от смены дня
function getState() {
  const key = `${saveRevision}|${gameDayKey(Date.now())}`;
  if (stateCache.revision !== key) {
    stateCache = { revision: key, view: computeState(save.log) };
  }
  return stateCache.view;
}

// ===== Лимиты по периодам =====
let countsCache = { key: null, day: null, week: null };

// Один проход по журналу: сколько раз каждый квест/награда выполнены сегодня и за неделю.
// Кэш зависит от ревизии журнала И от начала текущих суток/недели (после полуночи — пересчёт).
// Границы — игровой день 04:00–04:00 и неделя с понедельника 04:00.
function periodCounts() {
  const today = gameDayKey(Date.now());
  const thisWeek = weekKeyOf(today);
  const key = `${saveRevision}|${today}`;
  if (countsCache.key === key) return countsCache;

  const day = new Map();
  const week = new Map();
  const horizon = Date.now() - 9 * DAY_MS;
  for (const e of save.log) {
    if (!isActive(e) || e.ts < horizon) continue;
    const type = entryType(e);
    if (type !== 'quest' && type !== 'purchase') continue; // у забора наград лимитов нет
    const d = type === 'quest' ? entryGameDay(e) : gameDayKey(e.ts);
    if (weekKeyOf(d) !== thisWeek) continue;
    const id = type === 'quest' ? `quest:${e.questId}` : `purchase:${e.rewardId}`;
    if (d === today) day.set(id, (day.get(id) ?? 0) + 1);
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
    if (e.payload !== undefined) row.payload = e.payload; // колонку шлём только когда она нужна
  } else if (type === 'plan') {
    row.payload = e.payload;
  } else if (type === 'purchase') {
    Object.assign(row, { reward_id: e.rewardId, cost: e.cost });
    if (e.minutes !== undefined) row.minutes = e.minutes; // колонку шлём только когда она нужна
  } else if (type === 'leisure') {
    Object.assign(row, { leisure_start: e.start, leisure_end: e.end, category: e.category });
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
    if (r.payload !== null && r.payload !== undefined) e.payload = r.payload;
  } else if (r.type === 'plan') {
    e.payload = r.payload;
  } else if (r.type === 'purchase') {
    Object.assign(e, { rewardId: r.reward_id, cost: r.cost });
    if (r.minutes !== null && r.minutes !== undefined) e.minutes = r.minutes;
  } else if (r.type === 'leisure') {
    Object.assign(e, { start: Number(r.leisure_start), end: Number(r.leisure_end), category: r.category });
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
  if (e.payload?.gameDay) return period === 'day' ? e.payload.gameDay : weekKeyOf(e.payload.gameDay);
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
  let cancelled = 0;
  // Одна сессия — одно выполнение и одна награда (завершение на двух устройствах или вкладках)
  const sessions = new Set(addedEntries.filter(e => isActive(e) && e.payload?.sessionId).map(e => e.payload.sessionId));
  if (sessions.size) {
    const bySession = new Map();
    for (const e of save.log) {
      if (!isActive(e) || entryType(e) !== 'quest' || !sessions.has(e.payload?.sessionId)) continue;
      if (!bySession.has(e.payload.sessionId)) bySession.set(e.payload.sessionId, []);
      bySession.get(e.payload.sessionId).push(e);
    }
    for (const list of bySession.values()) {
      list.sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : 1));
      for (const e of list.slice(1)) {
        e.deleted = true;
        e.synced = false;
        cancelled++;
      }
    }
  }

  const touched = new Set();
  for (const e of addedEntries) {
    if (!isActive(e)) continue;
    const info = limitFor(e);
    if (info) touched.add(`${info.key}|${bucketOf(e, info.limit.period)}`);
  }
  if (!touched.size) return cancelled;

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

  for (const { max, entries } of groups.values()) {
    if (entries.length <= max) continue;
    // Сначала по времени, при равенстве — по id. Простое сравнение строк, без учёта языка браузера.
    entries.sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : 1));
    // У квестов отменяются только новые записи (с игровым днём): старые закрытые периоды не трогаем
    for (const e of entries.slice(max).filter(x => entryType(x) !== 'quest' || x.payload?.gameDay)) {
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

  // Минимумы плана: бонус дня и недели (только при действии, не при загрузке)
  const today = gameDayKey(Date.now());
  const r = after.plan.rules;
  if (after.plan.bonusDays.has(today) && !before.plan.bonusDays.has(today)) msg += ` · Дневной минимум выполнен · ещё +${r.dayBonus} монет`;
  if (after.plan.bonusDays.size < before.plan.bonusDays.size) msg += ' · Дневной минимум больше не выполнен';
  const wk = weekKeyOf(today);
  if (after.plan.bonusWeeks.has(wk) && !before.plan.bonusWeeks.has(wk)) msg += ` · Недельный минимум выполнен · ещё +${r.weekBonus} монет`;

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

// Выполнение квеста. Возвращает 'saved', 'limit', 'dup' или 'error'.
// meta: { sessionId, pickId, projectId, stageId, names, label } — для подходов из «Сегодня».
async function completeQuest(questId, meta = {}) {
  const quest = QUESTS.find(q => q.id === questId);
  if (!quest) {
    console.error('Квест не найден:', questId);
    return 'error';
  }
  absorbDisk(); // учесть выполнения из других вкладок до проверки лимита
  if (meta.sessionId && sessionDone(meta.sessionId)) {
    showMessage('Этот подход уже засчитан');
    render();
    return 'dup';
  }
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
  const rules = planRules();
  const payload = {
    gameDay: gameDayKey(entry.ts), rv: PLAN.rulesVersion, sessionId: meta.sessionId ?? crypto.randomUUID(),
    dir: rules.questDirs[quest.id] ?? null,
  };
  for (const k of ['pickId', 'projectId', 'stageId']) if (meta[k]) payload[k] = meta[k];
  if (meta.names?.project) payload.names = { project: meta.names.project.slice(0, 200), stage: (meta.names.stage ?? '').slice(0, 200) };
  entry.payload = payload;

  const ok = await commit(entry, before, (after) => {
    const statConf = STATS.find(s => s.id === quest.stat);
    let msg = `${meta.label ?? quest.name} · +${quest.xp} XP, +${gold} монет`;
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
  if (reward.retired) {
    showMessage('Эта позиция больше не продаётся');
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
  const lv = reward.minutes ? getLeisure() : null;
  if (lv && lv.balance + reward.minutes > LEISURE.maxBalance) {
    showMessage(`Не помещается: в запасе ${lv.bought} мин, максимум ${LEISURE.maxBalance}. Золото не списано`);
    return;
  }
  const effect = lv ? ` ${leisurePackEffect(reward, lv)}.` : '';
  if (!confirm(`Купить «${reward.name}» за ${reward.cost} 🪙?${effect}`)) return;

  const entry = {
    id: crypto.randomUUID(),
    type: 'purchase',
    rewardId: reward.id,
    cost: reward.cost,
    ts: Date.now(),
  };
  if (reward.minutes) entry.minutes = reward.minutes;
  commit(entry, before, () => lv
    ? `${reward.name}: куплено за ${reward.cost} 🪙.${effect}`
    : `${reward.icon} ${reward.name} куплено за ${reward.cost} 🪙. Наслаждайтесь!`);
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
  if (type === 'leisure') {
    return `расход времени «${leisureCategoryName(e.category)}» ${(e.end - e.start) / MINUTE} мин`;
  }
  if (type === 'care') {
    const t = CARE_TASKS.find(x => x.id === e.taskId);
    return `дело «${t ? t.name : e.taskId}»`;
  }
  if (type === 'claim') {
    const a = ACHIEVEMENTS.find(x => x.id === e.achievementId);
    return `получение награды за ачивку «${a ? a.name : e.achievementId}»`;
  }
  if (type === 'plan') return `изменение плана (${e.payload?.op})`;
  if (e.payload?.names?.project) return `подход «${e.payload.names.project} › ${e.payload.names.stage}»`;
  const q = QUESTS.find(x => x.id === e.questId);
  return `квест «${q ? q.name : e.questId}»`;
}

async function undoLast() {
  // События планировщика (проекты, выбор на день, активация) отменяются в своих местах, не здесь
  const last = [...save.log].reverse().find(e => isActive(e) && entryType(e) !== 'plan');
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
  const projectsTab = ui.questStat === 'projects';
  const questStat = STATS.find(s => s.id === ui.questStat) ?? STATS[0];
  const activeProjects = [...getProjects().values()].filter(p => !p.archived).length;
  setHtml('quest-tabs', html`${STATS.map(s => {
    const available = QUESTS.filter(q => q.stat === s.id && questLeft(q) > 0).length;
    return html`
      <button class="stat-tab ${!projectsTab && s.id === questStat.id ? 'active' : ''}" style="--c: ${s.color}"
              data-quest-stat="${s.id}" title="${s.name}">
        ${iconImg(s.icon, 'stat-tab-icon')}
        <span class="stat-tab-name">${s.name}</span>
        <span class="stat-tab-count">${available}</span>
      </button>`;
  })}
    <button class="stat-tab tasks-tab ${projectsTab ? 'active' : ''}" style="--c: var(--gold)" data-quest-stat="projects" title="Мои задачи">
      <span class="stat-tab-icon tasks-icon" aria-hidden="true">☰</span>
      <span class="stat-tab-name">Мои задачи</span>
      <span class="stat-tab-count">${activeProjects || ''}</span>
    </button>`);

  // Квесты выбранного стата
  const picksToday = picksForDay(gameDayKey(Date.now()));
  document.getElementById('quests').hidden = projectsTab;
  document.getElementById('projects-box').hidden = !projectsTab;
  if (projectsTab) renderProjects();
  else setHtml('quests', html`${QUESTS.filter(q => q.stat === questStat.id).map(q => renderCatalogRow(q, questStat, view.plan.rules, picksToday))}`);

  const shopLocked = health.hp < HEALTH.shopLockBelow;
  setHtml('shop', html`
    ${shopLocked ? html`<p class="shop-locked">🔒 Магазин закрыт: здоровье ${health.hp} из ${HEALTH.max}. Откроется при ${HEALTH.shopLockBelow}+ — выполняй дела ухода за собой.</p>` : ''}
    ${REWARDS.filter(r => !r.retired).map(r => rewardButton(r, view, health))}`);

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
  renderLeisure(view, health);
  updatePendingBadge();
  updateBackupHint();
  updateConfigWarning();
  applyFolds();
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
const ui = { v: UI_VERSION, screen: 'today', right: 'shop', questStat: STATS[0].id, folds: {} };
try {
  const stored = JSON.parse(localStorage.getItem(UI_KEY)) || {};
  if (stored.v === UI_VERSION) Object.assign(ui, stored);
  else Object.assign(ui, { right: stored.right ?? ui.right, questStat: stored.questStat ?? ui.questStat });
} catch (e) {
  // хранилище недоступно — используем значения по умолчанию
}
if (!SCREENS.includes(ui.screen)) ui.screen = 'today';
if (!ui.folds || typeof ui.folds !== 'object') ui.folds = {};

// Сворачиваемые подблоки «Сегодня»: шапка видна всегда, тело скрывается. По умолчанию раскрыты.
function isFoldOpen(id) {
  return ui.folds[id] !== false;
}

function applyFolds() {
  document.querySelectorAll('[data-fold-section]').forEach(section => {
    const open = isFoldOpen(section.dataset.foldSection);
    section.classList.toggle('collapsed', !open);
    section.querySelectorAll('[data-fold]').forEach(b => b.setAttribute('aria-expanded', open ? 'true' : 'false'));
  });
}
if (ui.questStat !== 'projects' && !STATS.some(s => s.id === ui.questStat)) ui.questStat = STATS[0].id;

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
  const foldBtn = e.target.closest('[data-fold]');
  if (foldBtn) {
    const id = foldBtn.dataset.fold;
    ui.folds[id] = !isFoldOpen(id);
    saveUi();
    applyFolds();
    return;
  }

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
    <h3 class="fold-title"><button class="fold-head" data-fold="care" aria-expanded="true" aria-controls="fold-body-care">
        <span class="fold-arrow" aria-hidden="true"></span>
        <span class="fold-name">Уход · ${health.doneToday}/${CARE_TASKS.length}</span>
        <span class="fold-sum">♥ ${health.hp}/${HEALTH.max}</span>
      </button></h3>
    <div class="fold-body" id="fold-body-care">
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
    </details>
    </div>`);
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

// ===== Развлечения: покупка и расход времени =====
// Источник истины — журнал: покупки с minutes и записи 'leisure' (интервалы). Расчёт детерминированный:
// пересекающиеся интервалы объединяются, режутся по границам дня (04:00) и по моментам покупок,
// затем события проходят по времени. B — знаковый баланс купленных минут (минус — долг).
function leisureCategoryName(id) {
  return LEISURE.categories.find(c => c.id === id)?.name ?? id;
}

function leisureAllowance(dayKey) {
  let version = LEISURE.allowanceHistory[0];
  for (const h of LEISURE.allowanceHistory) if (h.from <= dayKey) version = h;
  const mode = LEISURE.weekdayMode[new Date(dayKey + 'T12:00:00').getDay()];
  return { mode, minutes: version.minutes[mode] ?? 0 };
}

// Ближайшая граница дня (04:00) строго после t
function nextDayBoundary(t) {
  const d = new Date(t);
  d.setHours(HEALTH.dayStartHour, 0, 0, 0);
  if (d.getTime() <= t) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function computeLeisure(log, now) {
  const today = careDayKey(now);
  const plan = computePlan(log, now);
  const active = log.filter(isActive);

  // Объединение пересекающихся интервалов: одновременные игра и видео — одно время
  const ivs = active.filter(e => entryType(e) === 'leisure').map(e => [e.start, e.end])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
  const merged = [];
  for (const [s, e] of ivs) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }

  const buys = active.filter(e => entryType(e) === 'purchase' && Number.isInteger(e.minutes))
    .map(e => ({ t: Math.floor(e.ts / MINUTE) * MINUTE, minutes: e.minutes, id: e.id }))
    .sort((a, b) => (a.t - b.t) || (a.id < b.id ? -1 : 1));

  // Сегменты: части интервалов внутри одного дня и между покупками
  const events = buys.map(b => ({ t: b.t, kind: 0, buy: b }));
  for (const [s, e] of merged) {
    const cuts = new Set([s, e]);
    for (let b = nextDayBoundary(s); b < e; b = nextDayBoundary(b)) cuts.add(b);
    for (const b of buys) if (b.t > s && b.t < e) cuts.add(b.t);
    const points = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i + 1 < points.length; i++) {
      events.push({ t: points[i], kind: 1, start: points[i], end: points[i + 1] });
    }
  }
  events.sort((a, b) => (a.t - b.t) || (a.kind - b.kind)); // в одну минуту покупка раньше расхода

  const days = new Map();
  const day = (key) => {
    if (!days.has(key)) {
      const a = leisureAllowance(key);
      // Поправка плана за пропущенные минимумы — к своему историческому дню
      const pen = planPenalty(plan, key);
      const allowance = Math.max(0, a.minutes - pen.total);
      days.set(key, { key, mode: a.mode, base: a.minutes, penalty: pen, allowance, left: allowance,
        minutes: 0, free: 0, charged: 0, overrun: 0, bought: 0 });
    }
    return days.get(key);
  };

  let balance = 0;
  let totalOverrun = 0;
  for (const ev of events) {
    if (ev.kind === 0) {
      balance += ev.buy.minutes;
      day(careDayKey(ev.t)).bought += ev.buy.minutes;
      continue;
    }
    const d = day(careDayKey(ev.start));
    const m = (ev.end - ev.start) / MINUTE;
    const freeUsed = Math.min(m, d.left);
    d.left -= freeUsed;
    const charged = m - freeUsed;
    const overrun = Math.max(0, charged - Math.max(balance, 0));
    balance = Math.max(-LEISURE.maxDebt, balance - charged);
    d.minutes += m;
    d.free += freeUsed;
    d.charged += charged;
    d.overrun += overrun;
    totalOverrun += overrun;
  }

  const todayStat = day(today);
  const tracked = active.filter(e => entryType(e) === 'leisure' || (entryType(e) === 'purchase' && Number.isInteger(e.minutes)))
    .map(e => careDayKey(entryType(e) === 'leisure' ? e.start : e.ts)).sort();
  return {
    balance,
    bought: Math.max(0, balance),
    debt: Math.max(0, -balance),
    today: todayStat,
    available: todayStat.left + Math.max(0, balance),
    days,
    totalOverrun,
    firstDay: tracked[0] ?? null,
  };
}

let leisureCache = { key: null, value: null };
function getLeisure() {
  const now = Date.now();
  const key = `${saveRevision}|${careDayKey(now)}`;
  if (leisureCache.key !== key) leisureCache = { key, value: computeLeisure(save.log, now) };
  return leisureCache.value;
}

function daysBetween(fromKey, toKey) {
  return Math.round((new Date(toKey + 'T12:00:00') - new Date(fromKey + 'T12:00:00')) / (24 * 60 * MINUTE));
}

// Что сделает пакет: сколько долга погасит и сколько останется доступно
function leisurePackEffect(r, lv) {
  const after = lv.balance + r.minutes;
  if (lv.debt === 0) return `Купленных минут станет ${after}`;
  if (after < 0) return `Погасит ${r.minutes} мин долга, останется долг ${-after} мин`;
  return `Погасит долг ${lv.debt} мин, станет доступно ${after} мин`;
}

function rewardButton(r, view, health) {
  const shopLocked = health.hp < HEALTH.shopLockBelow;
  const left = rewardLeft(r);
  const affordable = view.gold >= r.cost;
  let fits = true;
  let note = affordable ? 'Можно купить' : `Не хватает ${r.cost - view.gold}`;
  if (r.minutes) {
    const lv = getLeisure();
    fits = lv.balance + r.minutes <= LEISURE.maxBalance;
    note = !fits ? `Не помещается: в запасе ${lv.bought} из ${LEISURE.maxBalance} мин`
      : affordable ? leisurePackEffect(r, lv) : note;
  }
  if (r.limit) note += ` · осталось ${PERIOD_NAMES[r.limit.period]}: ${Math.max(left, 0)}`;
  const available = affordable && left > 0 && fits && !shopLocked;
  return html`
    <button class="quest reward" data-reward="${r.id}" ${available ? '' : 'disabled'}>
      <span class="quest-main">${r.icon} ${r.name}<small>${note}</small></span>
      <span class="gold">${goldLabel(r.cost)}</span>
    </button>`;
}

const leisureUi = { panel: null, busy: false, error: '', category: 'games', minutes: '', end: '' };

function fmtMinutes(m) {
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} ч ${m % 60} мин` : `${h} ч`;
}

function fmtTime(t) {
  return new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function localInputValue(t) {
  const d = new Date(t);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderLeisure(view, health) {
  const lv = getLeisure();
  const today = careDayKey(Date.now());
  const modeName = LEISURE.modes[lv.today.mode];

  // Неделя наблюдения: с первой записи расхода или покупки минут
  let reviewLine = '';
  if (lv.firstDay) {
    const passed = daysBetween(lv.firstDay, today);
    const revised = LEISURE.allowanceHistory.some(h => h.from > lv.firstDay);
    if (passed >= LEISURE.reviewAfterDays && !revised) {
      reviewLine = html`<p class="leisure-review">Прошла неделя учёта. Посмотри сводку за 7 дней и реши, менять ли переходный запас — например, на 30 мин для одного режима. Сам он не меняется.</p>`;
    } else if (passed < LEISURE.reviewAfterDays) {
      reviewLine = html`<p class="today-note">Неделя наблюдения: день ${passed + 1} из ${LEISURE.reviewAfterDays}.</p>`;
    }
  }

  // Сводка за 7 дней
  const week = [];
  let key = today;
  for (let i = 0; i < 7; i++) {
    week.push(key);
    const d = new Date(key + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    key = dateKey(d.getTime());
  }
  const weekStats = week.map(k => ({ key: k, s: lv.days.get(k) }));
  const weekOverrun = weekStats.reduce((sum, w) => sum + (w.s?.overrun ?? 0), 0);
  const weekBought = weekStats.reduce((sum, w) => sum + (w.s?.bought ?? 0), 0);

  // Последние записи расхода и покупок минут
  const recent = save.log.filter(e => isActive(e)
    && (entryType(e) === 'leisure' || (entryType(e) === 'purchase' && Number.isInteger(e.minutes))))
    .sort((a, b) => b.ts - a.ts).slice(0, 10);

  setHtml('leisure', html`
    <h3 class="fold-title"><button class="fold-head" data-fold="leisure" aria-expanded="true" aria-controls="fold-body-leisure">
        <span class="fold-arrow" aria-hidden="true"></span>
        <span class="fold-name">Развлечения</span>
        <span class="fold-sum">Доступно сегодня: ${fmtMinutes(lv.available)}</span>
      </button></h3>
    <div class="fold-body" id="fold-body-leisure">
    <p class="today-note care-rule">
      Отмечено сегодня: ${fmtMinutes(lv.today.minutes)}${lv.debt ? html` · <span class="debt">Долг к погашению: ${lv.debt} мин</span>` : ''}
    </p>
    ${reviewLine}
    <div class="today-actions">
      <button class="today-btn ${leisureUi.panel === 'buy' ? 'primary' : ''}" data-leisure-panel="buy" aria-expanded="${leisureUi.panel === 'buy' ? 'true' : 'false'}">Купить время</button>
      <button class="today-btn ${leisureUi.panel === 'record' ? 'primary' : ''}" data-leisure-panel="record" aria-expanded="${leisureUi.panel === 'record' ? 'true' : 'false'}">Записать расход</button>
    </div>
    ${leisureUi.panel === 'buy' ? html`
      <div class="leisure-buy">
        ${health.hp < HEALTH.shopLockBelow ? html`<p class="shop-locked">Здоровье ${health.hp}: новые покупки закрыты до ${HEALTH.shopLockBelow}. Купленные минуты и переходный запас можно тратить.</p>` : ''}
        <p class="today-note">Золото: ${view.gold} · 1 монета = 3 мин · в запасе не больше ${LEISURE.maxBalance} мин</p>
        ${REWARDS.filter(r => r.minutes && !r.retired).map(r => rewardButton(r, view, health))}
      </div>` : ''}
    </div>`);

  setHtml('leisure-details', html`
    <details class="info" data-details="leisure-source" ${detailsAttr('leisure-source')}>
      <summary>Откуда время и правила</summary>
      <ul>
        <li>Переходный запас (${modeName}): осталось ${fmtMinutes(lv.today.left)} из ${fmtMinutes(lv.today.allowance)}.</li>
        ${lv.today.penalty.total ? html`<li>Базовый запас ${lv.today.base} − ${lv.today.penalty.total} за ${[lv.today.penalty.daily ? 'вчерашний минимум' : '', lv.today.penalty.weekly ? 'недельный минимум' : ''].filter(Boolean).join(' и ')} = ${lv.today.allowance} мин.</li>` : ''}
        <li>Купленные минуты: ${lv.bought} мин${lv.debt ? `; долг к погашению: ${lv.debt} мин` : ''}.</li>
        ${lv.debt && lv.today.left ? html`<li>Переходный запас можно тратить и при долге: долг гасится только покупкой времени.</li>` : ''}
        <li>Переходный запас — временный допуск для постепенного сокращения, не цель. Он сгорает в ${String(HEALTH.dayStartHour).padStart(2, '0')}:00 и не переносится.</li>
        <li>Расход: сначала переходный запас, затем купленные минуты. Сверх них — долг, не больше ${LEISURE.maxDebt} мин; полный перерасход остаётся в истории. Процентов нет.</li>
        <li>Новая покупка сначала гасит долг. Запас купленных минут — не больше ${LEISURE.maxBalance}.</li>
        <li>Учёт ручной: сайт не следит за приложениями и ничего не блокирует. Рабочие созвоны и видео для учебного задания не записываются.</li>
      </ul>
    </details>
    <details class="info" data-details="leisure-week" ${detailsAttr('leisure-week')}>
      <summary>Последние 7 дней</summary>
      <table class="leisure-week">
        <thead><tr><th>День</th><th>Отмечено</th><th>Перерасход</th><th>Куплено</th></tr></thead>
        <tbody>
          ${weekStats.map(w => html`
            <tr>
              <td>${new Date(w.key + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
              ${w.s?.minutes ? html`<td>${fmtMinutes(w.s.minutes)}</td>` : html`<td class="muted">Нет записей</td>`}
              <td>${w.s?.overrun ? `${w.s.overrun} мин` : '—'}</td>
              <td>${w.s?.bought ? `${w.s.bought} мин` : '—'}</td>
            </tr>`)}
        </tbody>
      </table>
      <p>Перерасход за 7 дней: ${weekOverrun} мин; к погашению сейчас: ${lv.debt} мин. Куплено за 7 дней: ${weekBought} мин.</p>
    </details>
    <details class="info" data-details="leisure-recent" ${detailsAttr('leisure-recent')}>
      <summary>Последние записи</summary>
      ${recent.length ? html`<ul class="leisure-recent">
        ${recent.map(e => html`
          <li>
            <span>${entryType(e) === 'leisure'
              ? `${new Date(e.start).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${fmtTime(e.start)}–${fmtTime(e.end)} · ${leisureCategoryName(e.category)} · ${(e.end - e.start) / MINUTE} мин`
              : `${new Date(e.ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${fmtTime(e.ts)} · куплено ${e.minutes} мин за ${e.cost} 🪙`}</span>
            <button class="link-btn" data-cancel-entry="${e.id}">Отменить</button>
          </li>`)}
      </ul>` : html`<p>Записей пока нет.</p>`}
    </details>`);

  if (leisureUi.panel === 'record' && !document.getElementById('leisure-form')) renderLeisureForm();
  if (leisureUi.panel !== 'record') setHtml('leisure-form-box', html``);
}

// Форма расхода перерисовывается только по её собственным действиям, чтобы не сбивать ввод
function renderLeisureForm() {
  const maxEnd = localInputValue(Date.now());
  setHtml('leisure-form-box', html`
    <form id="leisure-form" class="leisure-form" novalidate>
      <fieldset>
        <legend>Что это было</legend>
        <div class="chips">
          ${LEISURE.categories.map(c => html`
            <label class="chip"><input type="radio" name="category" value="${c.id}" ${leisureUi.category === c.id ? 'checked' : ''}><span>${c.name}</span></label>`)}
        </div>
      </fieldset>
      <fieldset>
        <legend>Сколько минут</legend>
        <div class="chips">
          ${[15, 30, 60].map(m => html`<button type="button" class="chip-btn ${String(m) === String(leisureUi.minutes) ? 'active' : ''}" data-quick-minutes="${m}">${m}</button>`)}
          <input class="minutes-input" type="number" name="minutes" min="1" max="${LEISURE.maxSessionMinutes}" step="1" inputmode="numeric"
                 placeholder="своё" aria-label="Своя длительность, минут" value="${leisureUi.minutes}">
        </div>
      </fieldset>
      <details class="info" data-details="leisure-end" ${detailsAttr('leisure-end') || (leisureUi.end ? 'open' : '')}>
        <summary>Закончил не сейчас?</summary>
        <label class="end-label">Окончание сеанса
          <input type="datetime-local" name="end" max="${maxEnd}" value="${leisureUi.end}">
        </label>
      </details>
      <p class="today-note">Фоновый просмотр тоже записывай. Игра и видео одновременно — это одно время: удобно записать одним сеансом «Смешанное». Пересекающиеся записи не удваиваются.</p>
      ${leisureUi.error ? html`<p class="today-error" role="alert">⚠️ ${leisureUi.error}</p>` : ''}
      <div class="today-actions">
        <button type="submit" class="today-btn primary" ${leisureUi.busy ? 'disabled' : ''}>${leisureUi.busy ? 'Сохраняю…' : 'Сохранить'}</button>
        <button type="button" class="today-btn" data-leisure-close>Закрыть</button>
      </div>
    </form>`);
}

function readLeisureForm(form) {
  leisureUi.category = form.category.value || leisureUi.category;
  leisureUi.minutes = form.minutes.value;
  leisureUi.end = form.end.value;
}

async function saveLeisure(form) {
  if (leisureUi.busy) return;
  readLeisureForm(form);
  const minutes = Number(leisureUi.minutes);
  const nowMinute = Math.floor(Date.now() / MINUTE) * MINUTE;
  let end = nowMinute;
  if (leisureUi.end) {
    const t = new Date(leisureUi.end).getTime();
    end = Math.floor(t / MINUTE) * MINUTE;
  }
  let error = '';
  if (!LEISURE.categories.some(c => c.id === leisureUi.category)) error = 'Выбери, что это было.';
  else if (!Number.isInteger(minutes) || minutes < 1 || minutes > LEISURE.maxSessionMinutes) error = `Длительность — целое число минут от 1 до ${LEISURE.maxSessionMinutes}.`;
  else if (!Number.isFinite(end)) error = 'Не удалось прочитать время окончания.';
  else if (end > nowMinute) error = 'Окончание не может быть в будущем.';
  if (error) {
    leisureUi.error = error;
    renderLeisureForm();
    return;
  }

  leisureUi.busy = true;
  leisureUi.error = '';
  renderLeisureForm();
  absorbDisk();
  const before = getLeisure();
  const entry = {
    id: crypto.randomUUID(), type: 'leisure', category: leisureUi.category,
    start: end - minutes * MINUTE, end, ts: Date.now(), synced: false,
  };
  save.log.push(entry);
  const ok = await storage.save(save);
  leisureUi.busy = false;
  if (!ok) {
    const i = save.log.indexOf(entry);
    if (i !== -1) save.log.splice(i, 1);
    saveRevision++;
    leisureUi.error = 'Запись не сохранилась на устройстве. Данные формы на месте — нажми «Сохранить» ещё раз.';
    renderLeisureForm();
    render();
    return;
  }
  Object.assign(leisureUi, { panel: null, error: '', minutes: '', end: '' });
  render();
  const after = getLeisure();
  let msg = `Записано: ${leisureCategoryName(entry.category)} · ${minutes} мин (${fmtTime(entry.start)}–${fmtTime(entry.end)}). Сохранено на устройстве`;
  if (after.debt > before.debt) msg += ` · долг к погашению: ${after.debt} мин`;
  showMessage(msg);
  sync();
}

// Отмена конкретной записи (расход или покупка минут): помечается удалённой, итог пересчитывается
async function cancelEntry(id) {
  const e = save.log.find(x => x.id === id && isActive(x));
  if (!e) return;
  if (!confirm(`Отменить ${describeEntry(e)}?`)) return;
  const prevSynced = e.synced;
  e.deleted = true;
  e.synced = false;
  if (!(await storage.save(save))) {
    e.deleted = false;
    e.synced = prevSynced;
    saveRevision++;
    render();
    showMessage('⚠️ Не удалось сохранить отмену. Попробуйте ещё раз.');
    return;
  }
  render();
  showMessage('Запись отменена');
  sync();
}

document.getElementById('leisure-wrap').addEventListener('click', (e) => {
  const panelBtn = e.target.closest('[data-leisure-panel]');
  if (panelBtn) {
    const panel = panelBtn.dataset.leisurePanel;
    leisureUi.panel = leisureUi.panel === panel ? null : panel;
    leisureUi.error = '';
    render();
    if (leisureUi.panel === 'record') document.querySelector('#leisure-form input[name="category"]:checked')?.focus();
    return;
  }
  const reward = e.target.closest('[data-reward]');
  if (reward && !reward.disabled) {
    buyReward(reward.dataset.reward);
    return;
  }
  const cancel = e.target.closest('[data-cancel-entry]');
  if (cancel) cancelEntry(cancel.dataset.cancelEntry);
});

const leisureFormBox = document.getElementById('leisure-form-box');
leisureFormBox.addEventListener('click', (e) => {
  const quick = e.target.closest('[data-quick-minutes]');
  if (quick) {
    const form = document.getElementById('leisure-form');
    readLeisureForm(form);
    leisureUi.minutes = quick.dataset.quickMinutes;
    renderLeisureForm();
    return;
  }
  if (e.target.closest('[data-leisure-close]')) {
    leisureUi.panel = null;
    leisureUi.error = '';
    render();
  }
});
leisureFormBox.addEventListener('input', (e) => {
  const form = e.target.form;
  if (!form) return;
  readLeisureForm(form);
  if (e.target.name === 'minutes') {
    form.querySelectorAll('[data-quick-minutes]').forEach(b => b.classList.toggle('active', b.dataset.quickMinutes === form.minutes.value));
  }
});
leisureFormBox.addEventListener('submit', (e) => {
  e.preventDefault();
  saveLeisure(e.target);
});

// ===== Игровой день и неделя =====
// Единые границы для плана, новых выполнений, их лимитов и развлечений: день 04:00–04:00, неделя с пн 04:00.
function gameDayKey(ts) {
  return careDayKey(ts);
}

function addDays(dayKey, n) {
  const d = new Date(dayKey + 'T12:00:00'); // полдень: переход на летнее время не сдвинет дату
  d.setDate(d.getDate() + n);
  return dateKey(d.getTime());
}

function weekdayOf(dayKey) {
  return new Date(dayKey + 'T12:00:00').getDay();
}

function weekKeyOf(dayKey) {
  return addDays(dayKey, -((weekdayOf(dayKey) + 6) % 7));
}

// Игровой день выполнения: сохранённый в записи (новые записи), иначе по 04:00
function entryGameDay(e) {
  return e.payload?.gameDay ?? gameDayKey(e.ts);
}

function fmtDay(dayKey, opts = { day: 'numeric', month: 'long' }) {
  return new Date(dayKey + 'T12:00:00').toLocaleDateString('ru-RU', opts);
}

// ===== План: правила и минимумы (чистые функции от журнала) =====
function planRules(rv = PLAN.rulesVersion) {
  return PLAN.versions[rv];
}

function questDir(e, rules) {
  return e.payload?.dir ?? rules.questDirs[e.questId] ?? null;
}

function planEvents(log) {
  return log.filter(e => isActive(e) && entryType(e) === 'plan')
    .sort((a, b) => (a.ts - b.ts) || (a.id < b.id ? -1 : 1));
}

// Самая ранняя активация текущей версии правил (после слияния устройств)
function findActivation(log) {
  return planEvents(log).find(e => e.payload.op === 'activate' && e.payload.rv === PLAN.rulesVersion) ?? null;
}

function requiredDaily(dayKey, rules) {
  return rules.workdays.includes(weekdayOf(dayKey)) ? rules.daily.workday : rules.daily.weekend;
}

// Минимумы, бонусы и поправки к переходному запасу. Не обращается к getState: без циклов gold → plan → leisure → gold.
function computePlan(log, now) {
  const today = gameDayKey(now);
  const rules = planRules();
  const act = findActivation(log);
  const empty = {
    active: false, today, firstDay: null, firstWeek: null, rules,
    dirsByDay: new Map(), bonusDays: new Set(), bonusWeeks: new Set(), bonusGold: 0,
    dailyMissed: new Map(), weeklyMissed: new Map(), weeks: new Map(),
  };
  // Выполненные направления по игровым дням (нужны и до активации — для подсказок)
  const dirsByDay = new Map();
  for (const e of log) {
    if (!isActive(e) || entryType(e) !== 'quest') continue;
    const dir = questDir(e, rules);
    if (!dir) continue;
    const d = entryGameDay(e);
    if (!dirsByDay.has(d)) dirsByDay.set(d, new Set());
    dirsByDay.get(d).add(dir);
  }
  empty.dirsByDay = dirsByDay;
  if (!act) return empty;

  const actDay = gameDayKey(act.ts);
  const firstDay = addDays(actDay, 1);              // ознакомительный день не обязателен
  const firstWeek = addDays(weekKeyOf(actDay), 7);  // первый понедельник после дня активации
  const bonusDays = new Set();
  const dailyMissed = new Map(); // день → невыполненные направления (для дней до сегодня)
  for (let d = firstDay; d <= today; d = addDays(d, 1)) {
    const done = dirsByDay.get(d) ?? new Set();
    const missing = requiredDaily(d, rules).filter(x => !done.has(x));
    if (!missing.length) bonusDays.add(d);
    else if (d < today) dailyMissed.set(d, missing);
  }

  const bonusWeeks = new Set();
  const weeklyMissed = new Map(); // понедельник, к которому применяется поправка → невыполненные
  const weeks = new Map();
  for (let w = firstWeek; w <= today; w = addDays(w, 7)) {
    const status = {};
    for (const [dir, need] of Object.entries(rules.weekly)) {
      let days = 0;
      for (let k = 0; k < 7; k++) {
        const d = addDays(w, k);
        if (d > today) break;
        if (dirsByDay.get(d)?.has(dir)) days++;
      }
      status[dir] = { days, need };
    }
    weeks.set(w, status);
    const missing = Object.entries(status).filter(([, s]) => s.days < s.need).map(([dir]) => dir);
    if (!missing.length) bonusWeeks.add(w);
    else if (addDays(w, 7) <= today) weeklyMissed.set(addDays(w, 7), missing);
  }

  return {
    ...empty, active: true, activation: act, actDay, firstDay, firstWeek, dirsByDay,
    bonusDays, bonusWeeks, dailyMissed, weeklyMissed, weeks,
    bonusGold: bonusDays.size * rules.dayBonus + bonusWeeks.size * rules.weekBonus,
  };
}

// Поправка к переходному запасу развлечений для игрового дня
function planPenalty(plan, dayKey) {
  const r = plan.rules;
  const dMiss = plan.dailyMissed.get(addDays(dayKey, -1)) ?? [];
  const wMiss = plan.weeklyMissed.get(dayKey) ?? [];
  const daily = Math.min(r.dailyPenaltyMax, dMiss.length * r.dailyPenalty);
  const weekly = Math.min(r.weeklyPenaltyMax, wMiss.length * r.weeklyPenalty);
  return { daily, weekly, total: Math.min(r.totalPenaltyMax, daily + weekly), dMiss, wMiss };
}

let planCache = { key: null, value: null };
function getPlan() {
  const now = Date.now();
  const key = `${saveRevision}|${gameDayKey(now)}`;
  if (planCache.key !== key) planCache = { key, value: computePlan(save.log, now) };
  return planCache.value;
}

// ===== Проекты, этапы и выбор на день: свёртка событий 'plan' =====

function validName(v) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= NAME_MAX;
}

function validPlanPayload(p) {
  if (!p || typeof p !== 'object' || !PLAN_OPS.has(p.op)) return false;
  const id = v => typeof v === 'string' && v.length > 0 && v.length <= 64;
  const stage = s => s && id(s.stageId) && validName(s.name) && Number.isFinite(s.pos)
    && (s.note === undefined || (typeof s.note === 'string' && s.note.length <= NOTE_MAX));
  switch (p.op) {
    case 'activate': return Number.isInteger(p.rv);
    case 'project-create':
      return id(p.projectId) && validName(p.name) && Array.isArray(p.stages) && p.stages.length <= 100 && p.stages.every(stage);
    case 'project-set': return id(p.projectId) && p.field === 'name' && validName(p.value);
    case 'project-archive': return id(p.projectId) && typeof p.archived === 'boolean';
    case 'stage-add': return id(p.projectId) && stage(p);
    case 'stage-set':
      return id(p.projectId) && id(p.stageId) && (
        (p.field === 'name' && validName(p.value))
        || (p.field === 'note' && typeof p.value === 'string' && p.value.length <= NOTE_MAX)
        || (p.field === 'pos' && Number.isFinite(p.value)));
    case 'stage-done': return id(p.projectId) && id(p.stageId) && typeof p.done === 'boolean';
    case 'stage-remove': return id(p.projectId) && id(p.stageId);
    case 'pick-add':
      return id(p.pickId) && /^\d{4}-\d{2}-\d{2}$/.test(p.day) && p.ref && (
        (p.ref.kind === 'quest' && id(p.ref.questId))
        || (p.ref.kind === 'stage' && id(p.ref.projectId) && id(p.ref.stageId)));
    case 'pick-remove': return id(p.pickId);
    default: return false;
  }
}

// Проекты из событий. Порядок: создания проектов, затем добавления этапов, затем изменения;
// внутри — по (ts, id). Так изменение с другого устройства не теряется из-за расхождения часов.
function computeProjects(log) {
  const phase = op => op === 'project-create' ? 0 : op === 'stage-add' ? 1 : 2;
  const evs = planEvents(log).filter(e => !e.payload.op.startsWith('pick') && e.payload.op !== 'activate')
    .sort((a, b) => (phase(a.payload.op) - phase(b.payload.op)) || (a.ts - b.ts) || (a.id < b.id ? -1 : 1));
  const projects = new Map();
  const addStage = (proj, s) => {
    if (proj.stages.has(s.stageId)) return;
    proj.stages.set(s.stageId, { id: s.stageId, name: s.name, note: s.note ?? '', pos: s.pos, done: false, removed: false });
  };
  for (const e of evs) {
    const p = e.payload;
    const proj = projects.get(p.projectId);
    const st = proj?.stages.get(p.stageId);
    switch (p.op) {
      case 'project-create':
        if (proj) break;
        projects.set(p.projectId, { id: p.projectId, name: p.name, archived: false, created: e.ts, stages: new Map() });
        p.stages.forEach(s => addStage(projects.get(p.projectId), s));
        break;
      case 'project-set': if (proj) proj.name = p.value; break;
      case 'project-archive': if (proj) proj.archived = p.archived; break;
      case 'stage-add': if (proj) addStage(proj, p); break;
      case 'stage-set': if (st) st[p.field] = p.value; break;
      case 'stage-done': if (st) st.done = p.done; break;
      case 'stage-remove': if (st) st.removed = true; break;
    }
  }
  for (const proj of projects.values()) {
    proj.list = [...proj.stages.values()].filter(s => !s.removed)
      .sort((a, b) => (a.pos - b.pos) || (a.id < b.id ? -1 : 1));
    proj.doneCount = proj.list.filter(s => s.done).length;
    proj.complete = proj.list.length > 0 && proj.doneCount === proj.list.length;
  }
  return projects;
}

let projectsCache = { revision: -1, value: null };
function getProjects() {
  if (projectsCache.revision !== saveRevision) projectsCache = { revision: saveRevision, value: computeProjects(save.log) };
  return projectsCache.value;
}

function refKey(ref) {
  return ref.kind === 'quest' ? `quest:${ref.questId}` : `stage:${ref.stageId}`;
}

// Карточки плана на день: ссылки на квест или этап. Одна карточка на квест/этап; самая ранняя побеждает.
function picksForDay(dayKey) {
  const evs = planEvents(save.log);
  const removed = new Set(evs.filter(e => e.payload.op === 'pick-remove').map(e => e.payload.pickId));
  const projects = getProjects();
  const seen = new Set();
  const picks = [];
  for (const e of evs) {
    const p = e.payload;
    if (p.op !== 'pick-add' || p.day !== dayKey || removed.has(p.pickId)) continue;
    const k = refKey(p.ref);
    if (seen.has(k)) continue;
    if (p.ref.kind === 'quest' && !QUESTS.some(q => q.id === p.ref.questId)) continue;
    if (p.ref.kind === 'stage') {
      const proj = projects.get(p.ref.projectId);
      const st = proj?.stages.get(p.ref.stageId);
      if (!proj || proj.archived || !st || st.removed) continue; // архив и удаление убирают из плана
    }
    seen.add(k);
    picks.push({ pickId: p.pickId, ref: p.ref, ts: e.ts });
  }
  return picks;
}

function questCompletions(dayKey) {
  return save.log.filter(e => isActive(e) && entryType(e) === 'quest' && entryGameDay(e) === dayKey);
}

// ===== Запись событий плана =====
async function writePlanEvent(payload, okMessage) {
  const entry = { id: crypto.randomUUID(), type: 'plan', payload: { ...payload, v: 1 }, ts: Date.now(), synced: false };
  if (!validPlanPayload(entry.payload)) {
    showMessage('⚠️ Некорректные данные — проверьте название (до 200 символов) и заметку (до 2000).');
    return false;
  }
  save.log.push(entry);
  const ok = await storage.save(save);
  if (!ok) {
    const i = save.log.indexOf(entry);
    if (i !== -1) save.log.splice(i, 1);
    saveRevision++;
    render();
    showMessage('⚠️ Не удалось сохранить на устройстве. Введённое осталось в форме — попробуйте ещё раз.');
    return false;
  }
  render();
  if (okMessage) showMessage(okMessage);
  sync();
  return true;
}

// Несколько связанных событий одной записью (например, перестановка двух этапов)
async function writePlanEvents(payloads, okMessage) {
  const entries = payloads.map((p, i) => ({ id: crypto.randomUUID(), type: 'plan', payload: { ...p, v: 1 }, ts: Date.now() + i, synced: false }));
  if (!entries.every(e => validPlanPayload(e.payload))) return false;
  save.log.push(...entries);
  const ok = await storage.save(save);
  if (!ok) {
    save.log = save.log.filter(e => !entries.includes(e));
    saveRevision++;
    render();
    showMessage('⚠️ Не удалось сохранить на устройстве. Попробуйте ещё раз.');
    return false;
  }
  render();
  if (okMessage) showMessage(okMessage);
  sync();
  return true;
}

// Активация правил при первом открытии этой версии (без сообщения и вне «Отменить»)
async function ensureActivation() {
  if (findActivation(save.log)) return;
  const entry = { id: crypto.randomUUID(), type: 'plan', payload: { op: 'activate', rv: PLAN.rulesVersion, v: 1 }, ts: Date.now(), synced: false };
  save.log.push(entry);
  if (!(await storage.save(save))) {
    const i = save.log.indexOf(entry);
    if (i !== -1) save.log.splice(i, 1);
    saveRevision++;
    return;
  }
  render();
  sync();
}

// ===== Сессии (подходы): локальный черновик интерфейса =====
// Начатый подход не даёт наград и не синхронизируется. Завершение создаёт одно выполнение с sessionId.
const DRAFT_KEY = 'life-rpg-today-draft';
const DRAFT_VERSION = 2;
let todayError = null;   // { pickId, text }
let todayBusy = false;
let todayDateShown = gameDayKey(Date.now());

function clearTodayDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    // не критично
  }
}

function sessionDone(sessionId) {
  return save.log.some(e => isActive(e) && entryType(e) === 'quest' && e.payload?.sessionId === sessionId);
}

function activeDraft() {
  let d = null;
  try {
    d = JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch (e) {
    return null;
  }
  if (!d) return null;
  let valid = d.v === DRAFT_VERSION && d.owner === save.ownerId && !sessionDone(d.sessionId)
    && QUESTS.some(q => q.id === d.questId);
  if (valid && d.stageId) {
    const proj = getProjects().get(d.projectId);
    const st = proj?.stages.get(d.stageId);
    valid = Boolean(proj && !proj.archived && st && !st.removed);
  }
  if (!valid) {
    clearTodayDraft();
    return null;
  }
  return d;
}

const READING = ['read-start-10', 'read'];
const WORK_QUEST = 'work-focus-20';

function startSession(pick) {
  const current = activeDraft();
  if (current) {
    showMessage(current.pickId === pick.pickId ? 'Подход уже начат' : 'Сначала заверши или отложи начатый подход');
    return;
  }
  const questId = pick.ref.kind === 'stage' ? WORK_QUEST : pick.ref.questId;
  const quest = QUESTS.find(q => q.id === questId);
  const readingLeft = READING.includes(questId) && READING.some(id => questLeft(QUESTS.find(q => q.id === id)) > 0);
  if (questLeft(quest) <= 0 && !readingLeft) {
    showMessage(questId === WORK_QUEST ? `Наградные подходы на сегодня исчерпаны (${quest.limit.max} из ${quest.limit.max})` : 'Лимит этого квеста на сегодня исчерпан');
    return;
  }
  const draft = {
    v: DRAFT_VERSION, owner: save.ownerId, sessionId: crypto.randomUUID(), pickId: pick.pickId, questId,
    projectId: pick.ref.projectId, stageId: pick.ref.stageId, startedDay: gameDayKey(Date.now()), startedAt: Date.now(),
  };
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    showMessage('⚠️ Не удалось запомнить начало на устройстве');
    return;
  }
  todayError = null;
  render();
  focusPick(pick.pickId, 'finish');
}

function laterSession(pickId) {
  const d = activeDraft();
  if (d?.pickId === pickId) clearTodayDraft();
  todayError = null;
  render();
  focusPick(pickId, 'start');
}

async function finishSession(pickId, questId) {
  if (todayBusy) return;
  const d = activeDraft();
  if (!d || d.pickId !== pickId) {
    render();
    showMessage('Подход уже завершён или отложен');
    return;
  }
  const today = gameDayKey(Date.now());
  if (d.startedDay !== today
      && !confirm(`Подход начат ${fmtDay(d.startedDay)}, а сейчас уже ${fmtDay(today)}. Он будет засчитан за ${fmtDay(today)}. Подтвердить?`)) {
    return;
  }
  todayBusy = true;
  render();
  const projects = getProjects();
  const proj = d.projectId ? projects.get(d.projectId) : null;
  const st = proj?.stages.get(d.stageId);
  const result = await completeQuest(questId ?? d.questId, {
    sessionId: d.sessionId, pickId: d.pickId, projectId: d.projectId, stageId: d.stageId,
    names: proj ? { project: proj.name, stage: st?.name } : undefined,
    label: proj ? 'Подход завершён' : undefined,
  });
  todayBusy = false;
  if (result === 'saved' || result === 'dup') {
    clearTodayDraft();
    todayError = null;
  } else if (result === 'error') {
    todayError = { pickId, text: 'Результат не сохранился на устройстве. Награда не начислена.' };
  }
  render();
  focusPick(pickId, result === 'error' ? 'finish' : null);
}

function focusPick(pickId, action) {
  const card = document.querySelector(`[data-pick-card="${pickId}"]`);
  if (!card) return;
  const target = (action && card.querySelector(`[data-pick-action="${action}"]`)) || card;
  target.focus();
}

// ===== Выбор на сегодня =====
async function addPick(ref, day = gameDayKey(Date.now())) {
  absorbDisk();
  if (picksForDay(day).some(p => refKey(p.ref) === refKey(ref))) {
    showMessage('Уже в плане на сегодня');
    return false;
  }
  return writePlanEvent({ op: 'pick-add', pickId: crypto.randomUUID(), day, ref }, 'Добавлено в план на сегодня');
}

async function removePick(pickId) {
  const d = activeDraft();
  if (d?.pickId === pickId) clearTodayDraft();
  return writePlanEvent({ op: 'pick-remove', pickId }, 'Убрано из плана. Выполненное остаётся в истории');
}

async function setStageDone(projectId, stageId, done) {
  const proj = getProjects().get(projectId);
  const st = proj?.stages.get(stageId);
  if (!st || st.done === done) return;
  const ok = await writePlanEvent({ op: 'stage-done', projectId, stageId, done });
  if (ok) {
    const p = getProjects().get(projectId);
    showMessage(done ? `Этап завершён · ${p.doneCount} из ${p.list.length}` : `Этап снова в работе · ${p.doneCount} из ${p.list.length}`);
  }
}

// ===== Раздел «Задачи дня» =====
function dirName(dir) {
  return PLAN.directions[dir] ?? dir;
}

function pickDir(pick, rules) {
  return pick.ref.kind === 'stage' ? 'work' : rules.questDirs[pick.ref.questId] ?? null;
}

// Незавершённые вчерашние карточки, которых нет сегодня
function carryOverPicks(today) {
  const yesterday = addDays(today, -1);
  const doneQuests = new Set(questCompletions(yesterday).map(e => e.questId));
  const todayKeys = new Set(picksForDay(today).map(p => refKey(p.ref)));
  const projects = getProjects();
  return picksForDay(yesterday).filter(p => {
    if (todayKeys.has(refKey(p.ref))) return false;
    if (p.ref.kind === 'quest') return !doneQuests.has(p.ref.questId);
    return !projects.get(p.ref.projectId)?.stages.get(p.ref.stageId)?.done;
  });
}

function pickTitle(pick) {
  if (pick.ref.kind === 'quest') return QUESTS.find(q => q.id === pick.ref.questId)?.name ?? pick.ref.questId;
  const proj = getProjects().get(pick.ref.projectId);
  return `${proj?.name ?? '?'} › ${proj?.stages.get(pick.ref.stageId)?.name ?? '?'}`;
}

function renderTodayMinimums(plan, today, picks) {
  const rules = plan.rules;
  const done = plan.dirsByDay.get(today) ?? new Set();
  const covered = new Set(picks.map(p => pickDir(p, rules)).filter(Boolean));
  const required = requiredDaily(today, rules);
  const dailyOn = plan.active && today >= plan.firstDay;
  const weekOn = plan.active && today >= plan.firstWeek;
  const pen = plan.active ? planPenalty(plan, today) : { total: 0 };
  const week = weekOn ? plan.weeks.get(weekKeyOf(today)) : null;
  const daysLeft = 7 - (weekdayOf(today) + 6) % 7;

  const chip = (dir, ok, label) => html`<span class="min-chip ${ok ? 'ok' : covered.has(dir) ? 'planned' : ''}">${ok ? '✓' : covered.has(dir) ? '◐' : '○'} ${label}</span>`;
  return html`
    <div class="minimums">
      ${!plan.active ? html`<p class="today-note">Правила плана ещё не активированы на этом устройстве.</p>` : ''}
      ${plan.active && !dailyOn ? html`<p class="today-note">Обязательные минимумы начнутся: дневные — с ${fmtDay(plan.firstDay)}, недельные — с ${fmtDay(plan.firstWeek)}. Сегодня квесты дают обычные награды.</p>` : ''}
      <div class="min-row">
        <span class="min-label">${dailyOn ? 'Минимум дня:' : 'Ориентир дня:'}</span>
        ${required.map(dir => chip(dir, done.has(dir), dirName(dir)))}
      </div>
      ${pen.total ? html`<p class="penalty-line">Вчера не выполнено: ${pen.dMiss.map(dirName).join(', ')}${pen.wMiss.length ? `${pen.dMiss.length ? '; ' : ''}за прошлую неделю: ${pen.wMiss.map(dirName).join(', ')}` : ''}. Сегодня переходный запас меньше на ${pen.total} мин.</p>` : ''}
      <details class="info" data-details="plan-week" ${detailsAttr('plan-week')}>
        <summary>Неделя${week ? ` · ${Object.values(week).filter(s => s.days >= s.need).length}/${Object.keys(week).length}` : ''}</summary>
        ${weekOn ? html`
          <ul>
            ${Object.entries(week).map(([dir, s]) => html`<li>${s.days >= s.need ? '✓' : '○'} ${dirName(dir)}: ${Math.min(s.days, s.need)}/${s.need} ${s.need > 1 ? 'дня' : 'день'}${s.days >= s.need ? '' : `, осталось дней в неделе: ${daysLeft}`}</li>`)}
          </ul>` : html`<p>Недельные минимумы начнутся с ${plan.firstWeek ? fmtDay(plan.firstWeek) : 'следующего понедельника'}.</p>`}
        <ul>
          <li>Бонус дня: +${rules.dayBonus} монет за все дневные направления (пн–пт — работа и чтение/обучение, сб–вс — чтение/обучение).</li>
          <li>Бонус недели: +${rules.weekBonus} монет — физическая активность 2 разных дня, творчество 1 день, общение/речь 1 день.</li>
          <li>Пропуск дневного направления: −${rules.dailyPenalty} мин переходного запаса на следующий день (не больше ${rules.dailyPenaltyMax}); недельного — −${rules.weeklyPenalty} мин в следующий понедельник (не больше ${rules.weeklyPenaltyMax}); всего не больше ${rules.totalPenaltyMax} мин. HP, золото и купленные минуты не меняются.</li>
          <li>◐ — направление есть в плане, ✓ — выполнено. Выполнение без плана тоже засчитывается.</li>
        </ul>
      </details>
    </div>`;
}

function renderPickCard(pick, ctx) {
  const { draft, today, rules } = ctx;
  const isStage = pick.ref.kind === 'stage';
  const questId = isStage ? WORK_QUEST : pick.ref.questId;
  const quest = QUESTS.find(q => q.id === questId);
  const stat = STATS.find(s => s.id === quest.stat);
  const dir = pickDir(pick, rules);
  const comps = questCompletions(today);
  const active = draft?.pickId === pick.pickId;
  const blocked = Boolean(draft) && !active;
  const error = todayError?.pickId === pick.pickId ? todayError.text : '';
  const gold = Math.round(quest.xp * BALANCE.goldPerXp);
  const workLeft = Math.max(questLeft(QUESTS.find(q => q.id === WORK_QUEST)), 0);
  const g = quest.guide ?? {};
  let proj = null;
  let st = null;
  let count = 0;
  let state = 'ready';
  let doneLine = '';
  let canStart = true;
  if (isStage) {
    proj = getProjects().get(pick.ref.projectId);
    st = proj.stages.get(pick.ref.stageId);
    count = comps.filter(e => e.payload?.stageId === st.id).length;
    canStart = workLeft > 0;
    if (st.done) state = 'done';
  } else {
    count = comps.filter(e => e.questId === questId).length;
    const left = Math.max(questLeft(quest), 0);
    const readingLeft = READING.includes(questId) && READING.some(id => questLeft(QUESTS.find(q => q.id === id)) > 0);
    canStart = left > 0 || readingLeft;
    if (count > 0 && !canStart) state = 'done';
    doneLine = count ? `сегодня ${count} из ${quest.limit.max}` : '';
  }
  if (active) state = 'active';

  let finishButtons;
  if (active && READING.includes(questId)) {
    finishButtons = READING.map(id => {
      const q = QUESTS.find(x => x.id === id);
      const ok = questLeft(q) > 0;
      return html`<button class="today-btn primary" data-pick-action="finish" data-finish-quest="${id}" data-pick-id="${pick.pickId}" ${ok && !todayBusy ? '' : 'disabled'}>
        Завершить: ${id === 'read' ? '30' : '10'} минут${ok ? '' : ' (лимит)'}</button>`;
    });
  } else {
    finishButtons = html`<button class="today-btn primary" data-pick-action="finish" data-pick-id="${pick.pickId}" ${todayBusy ? 'disabled' : ''}>
      ${todayBusy ? 'Сохраняю…' : error ? 'Повторить сохранение' : isStage ? 'Завершить подход' : 'Завершить'}</button>`;
  }

  return html`
    <article class="today-card ${state}" style="--c: ${stat.color}" data-pick-card="${pick.pickId}" tabindex="-1">
      <header class="today-card-head">
        ${iconImg(stat.icon)}
        <h3>${isStage ? `${proj.name} › ${st.name}` : quest.name}</h3>
        <span class="today-reward">+${quest.xp} XP · ${goldLabel(gold)}</span>
      </header>
      <p class="today-meta">
        ${dir ? html`<span class="dir-tag">${dirName(dir)}</span>` : ''}
        ${isStage ? html` Этапов готово: ${proj.doneCount} из ${proj.list.length} · подходов к этапу сегодня: ${count} · наградных подходов: ${quest.limit.max - workLeft} из ${quest.limit.max}` : doneLine}
      </p>
      ${active && draft.startedDay !== today ? html`<p class="today-error">Подход начат ${fmtDay(draft.startedDay)} — будет засчитан за ${fmtDay(today)}.</p>` : ''}
      ${state === 'done' && !isStage ? html`<p class="today-done" role="status">✓ Выполнено</p>` : ''}
      ${state === 'done' && isStage ? html`<p class="today-done" role="status">✓ Этап готов</p>` : ''}
      ${state !== 'done' && g.firstStep ? html`<p class="today-step"><b>${active ? 'Сейчас:' : 'Первый шаг:'}</b> ${g.firstStep}</p>` : ''}
      ${state !== 'done' && g.done ? html`<p class="today-line"><b>Готово, когда:</b> ${g.done}</p>` : ''}
      ${state !== 'done' && g.example ? html`<p class="today-line"><b>Например:</b> ${g.example}</p>` : ''}
      ${st?.note ? html`<p class="today-line"><b>Заметка:</b> ${st.note}</p>` : ''}
      ${active && g.hint ? html`<p class="today-hint">${g.hint}</p>` : ''}
      ${!active && g.note && state !== 'done' ? html`<p class="today-note">${g.note}</p>` : ''}
      ${error ? html`<p class="today-error" role="alert">⚠️ ${error}</p>` : ''}
      <div class="today-actions">
        ${active ? html`
          ${finishButtons}
          <button class="today-btn" data-pick-action="later" data-pick-id="${pick.pickId}" ${todayBusy ? 'disabled' : ''}>Вернуться позже</button>
        ` : state !== 'done' || isStage ? html`
          <button class="today-btn primary" data-pick-action="start" data-pick-id="${pick.pickId}" ${blocked || !canStart ? 'disabled' : ''}>
            ${isStage ? 'Начать подход' : count ? 'Новый подход' : 'Начать'}</button>
        ` : ''}
        ${isStage ? html`<button class="today-btn" data-pick-action="stage-done" data-pick-id="${pick.pickId}">${st.done ? 'Вернуть этап в работу' : 'Этап готов'}</button>` : ''}
      </div>
      ${isStage && !canStart && !active ? html`<p class="today-note">Наградные подходы на сегодня исчерпаны (${quest.limit.max} из ${quest.limit.max}). Этапы можно отмечать и редактировать.</p>` : ''}
      ${blocked && state !== 'done' ? html`<p class="today-note">Сначала заверши или отложи начатый подход.</p>` : ''}
      <button class="link-btn pick-remove" data-pick-action="remove" data-pick-id="${pick.pickId}">Убрать из плана</button>
    </article>`;
}

function renderToday() {
  const now = Date.now();
  const today = gameDayKey(now);
  todayDateShown = today;
  const plan = getPlan();
  const rules = plan.rules;
  const picks = picksForDay(today);
  const draft = activeDraft();
  const comps = questCompletions(today);
  const carry = carryOverPicks(today);
  const required = requiredDaily(today, rules);
  const doneDirs = plan.dirsByDay.get(today) ?? new Set();
  const minDone = required.filter(d => doneDirs.has(d)).length;
  const covered = new Set(picks.map(p => pickDir(p, rules)).filter(Boolean));
  const missingDirs = required.filter(d => !doneDirs.has(d) && !covered.has(d));

  // Выполнения сегодня, не представленные карточками
  const pickedQuests = new Set(picks.filter(p => p.ref.kind === 'quest').map(p => p.ref.questId));
  const pickedStages = new Set(picks.filter(p => p.ref.kind === 'stage').map(p => p.ref.stageId));
  const extra = comps.filter(e => e.payload?.stageId ? !pickedStages.has(e.payload.stageId) : !pickedQuests.has(e.questId));

  document.getElementById('today-date').textContent = fmtDay(today, { weekday: 'long', day: 'numeric', month: 'long' });
  setHtml('today', html`
    <h3 class="fold-title"><button class="fold-head" data-fold="tasks" aria-expanded="true" aria-controls="fold-body-tasks">
      <span class="fold-arrow" aria-hidden="true"></span>
      <span class="fold-name">Задачи дня</span>
      <span class="fold-sum">Выполнено: ${comps.length} · минимум ${minDone === required.length ? '✓' : `${minDone}/${required.length}`}</span>
    </button></h3>
    <div class="fold-body" id="fold-body-tasks">
      ${renderTodayMinimums(plan, today, picks)}
      ${carry.length ? html`
        <div class="carry">
          <p class="today-note">Вчера не завершено: ${carry.length}. Перенести на сегодня?</p>
          ${carry.map(p => html`<div class="carry-row"><span>${pickTitle(p)}</span>
            <button class="link-btn" data-carry='${p.pickId}'>Перенести</button></div>`)}
          ${carry.length > 1 ? html`<button class="link-btn" data-carry-all>Перенести все</button>` : ''}
        </div>` : ''}
      ${picks.length ? picks.map(p => renderPickCard(p, { draft, today, rules })) : html`
        <p class="today-note">План на сегодня пуст.${missingDirs.length ? ` Не хватает: ${missingDirs.map(dirName).join(', ')}.` : ''}</p>`}
      ${extra.length ? html`
        <div class="extra-done">
          <p class="today-note">Выполнено вне плана:</p>
          <ul>${extra.map(e => html`<li>✓ ${e.payload?.names?.project ? `${e.payload.names.project} › ${e.payload.names.stage}` : (QUESTS.find(q => q.id === e.questId)?.name ?? e.questId)}</li>`)}</ul>
        </div>` : ''}
      <div class="today-actions">
        <button class="today-btn" data-go-catalog>Выбрать квесты</button>
      </div>
    </div>`);
}

document.getElementById('today').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pick-action]');
  if (btn && !btn.disabled) {
    const pick = picksForDay(gameDayKey(Date.now())).find(p => p.pickId === btn.dataset.pickId);
    const action = btn.dataset.pickAction;
    if (action === 'later') { laterSession(btn.dataset.pickId); return; }
    if (action === 'finish') { finishSession(btn.dataset.pickId, btn.dataset.finishQuest); return; }
    if (!pick) { render(); return; }
    if (action === 'start') startSession(pick);
    else if (action === 'remove') removePick(pick.pickId);
    else if (action === 'stage-done') {
      const st = getProjects().get(pick.ref.projectId)?.stages.get(pick.ref.stageId);
      if (st) setStageDone(pick.ref.projectId, pick.ref.stageId, !st.done);
    }
    return;
  }
  const carry = e.target.closest('[data-carry]');
  if (carry) {
    const p = carryOverPicks(gameDayKey(Date.now())).find(x => x.pickId === carry.dataset.carry);
    if (p) addPick(p.ref);
    return;
  }
  if (e.target.closest('[data-carry-all]')) {
    const today = gameDayKey(Date.now());
    const list = carryOverPicks(today);
    writePlanEvents(list.map(p => ({ op: 'pick-add', pickId: crypto.randomUUID(), day: today, ref: p.ref })), `Перенесено: ${list.length}`);
    return;
  }
  if (e.target.closest('[data-go-catalog]')) {
    ui.screen = 'quests';
    saveUi();
    applyUi();
    document.querySelector('.quests-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

// Смена игрового дня при открытой вкладке: раз в 30 секунд проверяем
setInterval(() => {
  if (gameDayKey(Date.now()) !== todayDateShown || careDayKey(Date.now()) !== careDayShown) {
    todayError = null;
    render();
  }
}, 30 * 1000);

// ===== Каталог и «Мои задачи» =====
let questCooldown = new Map(); // защита от двойного клика «Выполнить» в каталоге

function renderCatalogRow(q, stat, rules, picksToday) {
  const left = Math.max(questLeft(q), 0);
  const dir = rules.questDirs[q.id];
  const picked = picksToday.some(p => p.ref.kind === 'quest' && p.ref.questId === q.id);
  const gold = Math.round(q.xp * BALANCE.goldPerXp);
  return html`
    <div class="quest catalog-row" style="--c: ${stat.color}">
      ${iconImg(q.icon ?? stat.icon)}
      <span class="quest-main">${q.name}
        <small>${dir ? html`<span class="dir-tag">${dirName(dir)}</span> ` : ''}ориентир: ${q.goal} · +${q.xp} XP, ${gold} 🪙 · осталось ${PERIOD_NAMES[q.limit.period]}: ${left}</small>
      </span>
      <span class="catalog-actions">
        <button class="small-btn" data-pick-quest="${q.id}" ${picked ? 'disabled' : ''}>${picked ? 'В плане' : 'На сегодня'}</button>
        <button class="small-btn primary" data-quest="${q.id}" ${left === 0 ? 'disabled' : ''}>Выполнить</button>
      </span>
    </div>`;
}

const projUi = { create: { open: false, name: '', template: '', stages: '' }, edit: null, addStage: {}, pendingRender: false };

function renderProjects() {
  const box = document.getElementById('projects-box');
  if (!box) return;
  // Не перерисовывать, пока пользователь печатает: перерисуем, когда фокус уйдёт
  if (box.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    projUi.pendingRender = true;
    return;
  }
  projUi.pendingRender = false;
  const today = gameDayKey(Date.now());
  const picks = picksForDay(today);
  const all = [...getProjects().values()].sort((a, b) => (a.created - b.created) || (a.id < b.id ? -1 : 1));
  const activeProjects = all.filter(p => !p.archived);
  const archived = all.filter(p => p.archived);
  const c = projUi.create;
  const ed = projUi.edit;
  const editing = (kind, projectId, stageId) => ed && ed.kind === kind && ed.projectId === projectId && (ed.stageId ?? null) === (stageId ?? null);
  const editForm = (label, multiline) => html`
    <form class="inline-edit" data-edit-form>
      <label class="sr-only" for="edit-input">${label}</label>
      ${multiline
        ? html`<textarea id="edit-input" name="value" maxlength="${NOTE_MAX}" rows="3">${ed.value}</textarea>`
        : html`<input id="edit-input" name="value" maxlength="${NAME_MAX}" value="${ed.value}" required>`}
      <button class="small-btn primary" type="submit">Сохранить</button>
      <button class="small-btn" type="button" data-edit-cancel>Отмена</button>
    </form>`;

  setHtml('projects-box', html`
    <p class="today-note">Рабочие задачи и их этапы. Работа над этапом — подход «Рабочий фокус — 20 минут»: до ${QUESTS.find(q => q.id === WORK_QUEST).limit.max} наградных подходов в день на все задачи вместе.</p>
    ${c.open ? html`
      <form class="project-create" data-create-form>
        <label>Название задачи
          <input name="name" maxlength="${NAME_MAX}" required value="${c.name}" placeholder="Например: Подготовить отчёт">
        </label>
        <label>Этапы
          <select name="template">
            <option value="" ${c.template === '' ? 'selected' : ''}>Пустой список</option>
            ${TASK_TEMPLATES.map(t => html`<option value="${t.id}" ${c.template === t.id ? 'selected' : ''}>Шаблон: ${t.name}</option>`)}
          </select>
        </label>
        <label>Названия этапов — по одному в строке (можно изменить)
          <textarea name="stages" rows="5" placeholder="Пусто — будет один этап «Выполнить задачу»">${c.stages}</textarea>
        </label>
        <div class="today-actions">
          <button class="today-btn primary" type="submit">Сохранить задачу</button>
          <button class="today-btn" type="button" data-create-cancel>Отмена</button>
        </div>
      </form>` : html`<button class="today-btn primary" data-create-open>+ Новая задача</button>`}
    ${activeProjects.length ? '' : html`<p class="today-note">Активных задач пока нет.</p>`}
    ${activeProjects.map(p => html`
      <section class="project ${p.complete ? 'complete' : ''}">
        <header class="project-head">
          ${editing('project', p.id) ? editForm('Название задачи', false) : html`
            <h4>${p.name}</h4>
            <button class="small-btn" data-proj-action="rename" data-project-id="${p.id}">Переименовать</button>`}
        </header>
        <p class="today-note">${p.doneCount} из ${p.list.length} этапов завершено${p.complete ? ' · задача выполнена' : ''}</p>
        <ol class="stages">
          ${p.list.map((s, i) => {
            const picked = picks.some(x => x.ref.kind === 'stage' && x.ref.stageId === s.id);
            return html`
              <li class="stage ${s.done ? 'done' : ''}">
                ${editing('stage', p.id, s.id) ? editForm('Название этапа', false) : html`
                  <span class="stage-name">${s.done ? '✓ ' : ''}${s.name}</span>`}
                ${editing('note', p.id, s.id) ? editForm('Заметка к этапу', true) : (s.note ? html`<p class="stage-note">${s.note}</p>` : '')}
                <div class="stage-actions">
                  <button class="small-btn" data-stage-action="up" data-project-id="${p.id}" data-stage-id="${s.id}" ${i === 0 ? 'disabled' : ''} aria-label="Поднять этап «${s.name}»">↑</button>
                  <button class="small-btn" data-stage-action="down" data-project-id="${p.id}" data-stage-id="${s.id}" ${i === p.list.length - 1 ? 'disabled' : ''} aria-label="Опустить этап «${s.name}»">↓</button>
                  ${s.done ? '' : html`<button class="small-btn" data-stage-action="pick" data-project-id="${p.id}" data-stage-id="${s.id}" ${picked ? 'disabled' : ''}>${picked ? 'В плане' : 'На сегодня'}</button>`}
                  <button class="small-btn" data-stage-action="toggle" data-project-id="${p.id}" data-stage-id="${s.id}">${s.done ? 'Вернуть в работу' : 'Этап готов'}</button>
                  <button class="small-btn" data-stage-action="rename" data-project-id="${p.id}" data-stage-id="${s.id}">Переименовать</button>
                  <button class="small-btn" data-stage-action="note" data-project-id="${p.id}" data-stage-id="${s.id}">Заметка</button>
                  ${s.done ? '' : html`<button class="small-btn danger" data-stage-action="remove" data-project-id="${p.id}" data-stage-id="${s.id}">Удалить</button>`}
                </div>
              </li>`;
          })}
        </ol>
        <form class="add-stage" data-add-stage="${p.id}">
          <label class="sr-only" for="add-stage-${p.id}">Новый этап</label>
          <input id="add-stage-${p.id}" name="name" maxlength="${NAME_MAX}" placeholder="Новый этап" value="${projUi.addStage[p.id] ?? ''}">
          <button class="small-btn" type="submit">Добавить этап</button>
        </form>
        <div class="stage-actions">
          <button class="small-btn" data-proj-action="copy" data-project-id="${p.id}">Создать похожую</button>
          <button class="small-btn" data-proj-action="archive" data-project-id="${p.id}">В архив</button>
        </div>
      </section>`)}
    ${archived.length ? html`
      <details class="info" data-details="projects-archive" ${detailsAttr('projects-archive')}>
        <summary>Архив (${archived.length})</summary>
        <ul class="archive-list">
          ${archived.map(p => html`<li><span>${p.name} · ${p.doneCount} из ${p.list.length}</span>
            <button class="small-btn" data-proj-action="restore" data-project-id="${p.id}">Восстановить</button></li>`)}
        </ul>
      </details>` : ''}`);
  if (ed) document.getElementById('edit-input')?.focus();
}

function newProjectPayload(name, stageNames) {
  const names = stageNames.map(s => s.trim()).filter(Boolean).slice(0, 100);
  const list = names.length ? names : ['Выполнить задачу'];
  return {
    op: 'project-create', projectId: crypto.randomUUID(), name: name.trim(),
    stages: list.map((n, i) => ({ stageId: crypto.randomUUID(), name: n.slice(0, NAME_MAX), pos: i + 1 })),
  };
}

async function projectAction(action, projectId, stageId) {
  const proj = getProjects().get(projectId);
  if (!proj) return;
  const st = stageId ? proj.stages.get(stageId) : null;
  const i = st ? proj.list.indexOf(st) : -1;
  switch (action) {
    case 'rename':
      projUi.edit = st ? { kind: 'stage', projectId, stageId, value: st.name } : { kind: 'project', projectId, value: proj.name };
      renderProjects();
      return;
    case 'note':
      projUi.edit = { kind: 'note', projectId, stageId, value: st.note ?? '' };
      renderProjects();
      return;
    case 'up':
    case 'down': {
      const other = proj.list[action === 'up' ? i - 1 : i + 1];
      if (!other) return;
      // Обмен позиций; при совпадении позиций назначаем различимые
      const a = st.pos === other.pos ? other.pos + (action === 'up' ? -0.5 : 0.5) : other.pos;
      await writePlanEvents([
        { op: 'stage-set', projectId, stageId: st.id, field: 'pos', value: a },
        { op: 'stage-set', projectId, stageId: other.id, field: 'pos', value: st.pos },
      ]);
      return;
    }
    case 'pick': await addPick({ kind: 'stage', projectId, stageId }); return;
    case 'toggle': await setStageDone(projectId, stageId, !st.done); return;
    case 'remove':
      if (st.done) return; // завершённый этап: сначала вернуть в работу
      if (!confirm(`Удалить этап «${st.name}»? Уже выполненные подходы останутся в истории.`)) return;
      await writePlanEvent({ op: 'stage-remove', projectId, stageId }, 'Этап удалён');
      return;
    case 'copy': {
      const payload = newProjectPayload(`${proj.name} (копия)`.slice(0, NAME_MAX), proj.list.map(s => s.name));
      await writePlanEvent(payload, 'Создана похожая задача — без отметок выполнения');
      return;
    }
    case 'archive':
      if (!confirm(`Перенести «${proj.name}» в архив? История подходов сохранится, карточки этапов уйдут из плана.`)) return;
      await writePlanEvent({ op: 'project-archive', projectId, archived: true }, 'Задача в архиве');
      return;
    case 'restore':
      await writePlanEvent({ op: 'project-archive', projectId, archived: false }, 'Задача восстановлена');
  }
}

const projectsBox = document.getElementById('projects-box');
projectsBox.addEventListener('focusout', () => {
  setTimeout(() => { if (projUi.pendingRender) renderProjects(); }, 0);
});
projectsBox.addEventListener('input', (e) => {
  const f = e.target.form;
  if (!f) return;
  if (f.matches('[data-create-form]')) projUi.create[e.target.name] = e.target.value;
  else if (f.matches('[data-edit-form]') && projUi.edit) projUi.edit.value = e.target.value;
  else if (f.matches('[data-add-stage]')) projUi.addStage[f.dataset.addStage] = e.target.value;
});
projectsBox.addEventListener('change', (e) => {
  if (e.target.name === 'template' && e.target.form?.matches('[data-create-form]')) {
    const t = TASK_TEMPLATES.find(x => x.id === e.target.value);
    projUi.create.template = e.target.value;
    projUi.create.stages = t ? t.stages.join('\n') : '';
    e.target.form.stages.value = projUi.create.stages;
  }
});
projectsBox.addEventListener('click', (e) => {
  if (e.target.closest('[data-create-open]')) {
    projUi.create.open = true;
    renderProjects();
    projectsBox.querySelector('[data-create-form] [name=name]')?.focus();
    return;
  }
  if (e.target.closest('[data-create-cancel]')) {
    projUi.create = { open: false, name: '', template: '', stages: '' };
    renderProjects();
    return;
  }
  if (e.target.closest('[data-edit-cancel]')) {
    projUi.edit = null;
    renderProjects();
    return;
  }
  const b = e.target.closest('[data-proj-action], [data-stage-action]');
  if (b && !b.disabled) projectAction(b.dataset.projAction ?? b.dataset.stageAction, b.dataset.projectId, b.dataset.stageId);
});
projectsBox.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.matches('[data-create-form]')) {
    const c = projUi.create;
    if (!validName(c.name)) {
      showMessage('Введите название задачи (до 200 символов)');
      return;
    }
    const ok = await writePlanEvent(newProjectPayload(c.name, c.stages.split('\n')), `Задача создана: ${c.name.trim()}`);
    if (ok) {
      projUi.create = { open: false, name: '', template: '', stages: '' };
      renderProjects();
    }
  } else if (f.matches('[data-edit-form]') && projUi.edit) {
    const ed = projUi.edit;
    const value = ed.kind === 'note' ? ed.value : ed.value.trim();
    const payload = ed.kind === 'project'
      ? { op: 'project-set', projectId: ed.projectId, field: 'name', value }
      : { op: 'stage-set', projectId: ed.projectId, stageId: ed.stageId, field: ed.kind === 'note' ? 'note' : 'name', value };
    document.activeElement?.blur();
    const ok = await writePlanEvent(payload, 'Сохранено');
    if (ok) {
      projUi.edit = null;
      renderProjects();
    }
  } else if (f.matches('[data-add-stage]')) {
    const projectId = f.dataset.addStage;
    const name = (projUi.addStage[projectId] ?? '').trim();
    if (!name) return;
    const proj = getProjects().get(projectId);
    const pos = Math.max(0, ...[...proj.stages.values()].map(s => s.pos)) + 1;
    document.activeElement?.blur();
    const ok = await writePlanEvent({ op: 'stage-add', projectId, stageId: crypto.randomUUID(), name, pos }, `Этап добавлен${proj.complete ? ' — задача снова в работе' : ''}`);
    if (ok) {
      projUi.addStage[projectId] = '';
      renderProjects();
    }
  }
});

// ===== Обработчики событий =====
document.getElementById('quests').addEventListener('click', (e) => {
  const pick = e.target.closest('[data-pick-quest]');
  if (pick && !pick.disabled) {
    addPick({ kind: 'quest', questId: pick.dataset.pickQuest });
    return;
  }
  const btn = e.target.closest('[data-quest]');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.quest;
  if (Date.now() - (questCooldown.get(id) ?? 0) < 1500) return; // двойной клик — одно выполнение
  questCooldown.set(id, Date.now());
  completeQuest(id);
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
ensureActivation();
