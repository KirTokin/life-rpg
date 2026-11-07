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

  errors.forEach(e => console.error('Ошибка конфига:', e));
}
validateConfig();

// ===== Локальное сохранение =====
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
    default:
      return false;
  }
}

function isValidSave(data) {
  return data !== null && typeof data === 'object'
    && data.version === SAVE_VERSION
    && Array.isArray(data.log) && data.log.every(isValidEntry);
}

const loaded = storage.load();
if (loaded && !isValidSave(loaded)) {
  console.warn('Старое или повреждённое сохранение перенесено в', STORAGE_KEY + '-old');
  storage.archive(loaded);
}
const save = isValidSave(loaded) ? loaded : createDefaultSave();

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
    if (!isActive(e)) continue;
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
function leftInPeriod(limit, matches) {
  const from = periodStart(limit.period);
  const done = save.log.filter(e => e.ts >= from && isActive(e) && matches(e)).length;
  return limit.max - done;
}

function questLeft(quest) {
  return leftInPeriod(quest.limit, e => entryType(e) === 'quest' && e.questId === quest.id);
}

function rewardLeft(reward) {
  if (!reward.limit) return Infinity;
  return leftInPeriod(reward.limit, e => entryType(e) === 'purchase' && e.rewardId === reward.id);
}

// ===== Синхронизация =====
// Локальная запись → строка таблицы log_entries
function toRow(e) {
  const type = entryType(e);
  const row = { id: e.id, type, ts: e.ts, deleted: !!e.deleted };
  if (type === 'quest') {
    Object.assign(row, { quest_id: e.questId, stat: e.stat, xp: e.xp, gold: e.gold ?? null });
  } else {
    Object.assign(row, { reward_id: e.rewardId, cost: e.cost });
  }
  return row;
}

// Строка таблицы → локальная запись
function fromRow(r) {
  const e = { id: r.id, type: r.type, ts: Number(r.ts), deleted: r.deleted };
  if (r.type === 'quest') {
    Object.assign(e, { questId: r.quest_id, stat: r.stat, xp: r.xp });
    if (r.gold !== null) e.gold = r.gold;
  } else {
    Object.assign(e, { rewardId: r.reward_id, cost: r.cost });
  }
  return e;
}

// Сливает записи в локальный журнал по id. Удаление побеждает.
function mergeEntries(entries, fromServer) {
  const byId = new Map(save.log.map(e => [e.id, e]));
  let added = 0;
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
      added++;
    } else if (incoming.deleted && !local.deleted) {
      local.deleted = true;
      if (!fromServer) local.synced = false;
    }
  }

  save.log.sort((a, b) => a.ts - b.ts);
  if (skipped) console.warn(`Пропущено некорректных записей: ${skipped}`);
  return added;
}

async function fetchAllRows() {
  const PAGE = 1000;
  const all = [];
  let from = 0;
  while (true) {
    const { data, error } = await db.from('log_entries')
      .select('id, type, quest_id, stat, xp, gold, reward_id, cost, ts, deleted')
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

async function sync() {
  if (!currentUser) return;
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

      const { error: insertError } = await db.from('log_entries')
        .upsert(pending.map(toRow), { onConflict: 'id', ignoreDuplicates: true });
      if (insertError) throw insertError;

      const deletedIds = pending.filter(e => e.deleted).map(e => e.id);
      if (deletedIds.length) {
        const { error: updateError } = await db.from('log_entries')
          .update({ deleted: true })
          .in('id', deletedIds);
        if (updateError) throw updateError;
      }

      pending.forEach(e => {
        if (!!e.deleted === sentDeleted.get(e.id)) e.synced = true;
      });
      storage.save(save);
    }

    // 2. Pull + merge: забрать всё из облака и слить
    const rows = await fetchAllRows();
    mergeEntries(rows.map(fromRow), true);
    storage.save(save);
    render();
    setSyncStatus(`✅ ${new Date().toLocaleTimeString().slice(0, 5)}`);
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
}

// ===== Действия =====
function commit(entry, before, baseMessage) {
  save.log.push({ ...entry, synced: false });
  storage.save(save);
  const after = computeState(save.log);
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

  after.achievements.forEach((a, i) => {
    if (a.unlocked && !before.achievements[i].unlocked) {
      msg += ` · 🏆 ${a.name} (+${a.gold} 🪙)`;
      showEffect(ASSETS.achievement, a.name, `${a.desc} · +${a.gold} 🪙`);
    }
  });

  showMessage(msg);
  sync();
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
  const last = [...save.log].reverse().find(isActive);
  if (!last) {
    showMessage('Нечего отменять');
    return;
  }
  if (!confirm(`Отменить ${describeEntry(last)}?`)) return;
  last.deleted = true;
  last.synced = false;
  storage.save(save);
  render();
  showMessage('Последнее действие отменено');
  sync();
}

function resetAll() {
  if (!confirm('Сбросить весь прогресс НА ВСЕХ УСТРОЙСТВАХ? Отменить сброс будет нельзя.')) return;
  save.log.forEach(e => {
    if (isActive(e)) {
      e.deleted = true;
      e.synced = false;
    }
  });
  storage.save(save);
  render();
  showMessage('Прогресс сброшен');
  sync();
}

// ===== Визуал =====
function iconImg(src, cls = 'icon') {
  return `<img class="${cls}" src="${src}" alt="">`;
}

function goldLabel(amount) {
  return `${iconImg(ASSETS.gold)} ${amount}`;
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

function renderBar(current, max) {
  const pct = max > 0 ? Math.min(current / max * 100, 100) : 0;
  return `<div class="bar"><div class="bar-fill" style="width: ${pct}%"></div></div>`;
}

function renderLevelBar(entity, curve) {
  const need = xpToNext(entity.level, curve);
  return `${renderBar(entity.xp, need)}<div class="bar-label">${entity.xp} / ${need} XP</div>`;
}

function renderAuth() {
  const el = document.getElementById('auth');
  if (currentUser) {
    el.innerHTML = `
      <div class="sync-bar">
        <span>${escapeHtml(currentUser.email)} · <span id="sync-status">${escapeHtml(syncStatus)}</span></span>
        <button id="logout-btn">Выйти</button>
      </div>`;
  } else {
    el.innerHTML = `
      <form id="login-form" class="login">
        <input type="email" name="email" placeholder="Email" required autocomplete="username">
        <input type="password" name="password" placeholder="Пароль" required autocomplete="current-password">
        <button type="submit">Войти для синхронизации</button>
      </form>`;
  }
}

function render() {
  const view = computeState(save.log);
  const tier = avatarTier(view.hero.level);
  const top = dominantStat(view.stats);
  const frame = top ? top.color : 'var(--gold)';
  const bg = top
    ? `background-image: radial-gradient(circle, transparent 35%, rgba(0,0,0,0.75)), url('${ASSETS.background(top.id)}');`
    : '';

  document.getElementById('hero').innerHTML = `
    <div class="hero-card" style="--frame: ${frame}; ${bg}">
      <img class="avatar" src="${tier.image}" alt="${escapeHtml(tier.name)}">
    </div>
    <h1>${escapeHtml(tier.name)} <span class="lvl">· ур. ${view.hero.level}</span></h1>
    ${renderLevelBar(view.hero, BALANCE.hero)}
    <div class="bar-label">
      Всего опыта: ${view.totalXp} · <span class="gold">${goldLabel(view.gold)}</span>
      ${top ? ` · Путь: ${escapeHtml(top.name)}` : ''}
    </div>`;

  document.getElementById('stats').innerHTML = STATS.map(s => {
    const st = view.stats[s.id];
    return `
      <div class="stat" style="--c: ${s.color}">
        <div class="stat-head"><span>${iconImg(s.icon)} ${s.name}</span><span>Ур. ${st.level}</span></div>
        ${renderLevelBar(st, BALANCE.stat)}
      </div>`;
  }).join('');

  document.getElementById('quests').innerHTML = STATS.map(s => {
    const items = QUESTS.filter(q => q.stat === s.id).map(q => {
      const left = Math.max(questLeft(q), 0);
      return `
        <button class="quest" style="--c: ${s.color}" data-quest="${q.id}" ${left === 0 ? 'disabled' : ''}>
          ${iconImg(q.icon ?? s.icon)}
          <span class="quest-main">${q.name}
            <small>${q.goal} · осталось ${PERIOD_NAMES[q.limit.period]}: ${left}</small>
          </span>
          <span>+${q.xp}</span>
        </button>`;
    }).join('');
    return items ? `<h3>${iconImg(s.icon)} ${s.name}</h3>${items}` : '';
  }).join('');

  document.getElementById('shop').innerHTML = REWARDS.map(r => {
    const left = rewardLeft(r);
    const affordable = view.gold >= r.cost;
    const available = affordable && left > 0;
    let note = affordable ? 'Можно купить' : `Не хватает ${r.cost - view.gold}`;
    if (r.limit) note += ` · осталось ${PERIOD_NAMES[r.limit.period]}: ${Math.max(left, 0)}`;
    return `
      <button class="quest reward" data-reward="${r.id}" ${available ? '' : 'disabled'}>
        <span class="quest-main">${r.icon} ${r.name}<small>${note}</small></span>
        <span class="gold">${goldLabel(r.cost)}</span>
      </button>`;
  }).join('');

  const unlockedCount = view.achievements.filter(a => a.unlocked).length;
  document.getElementById('achievements').innerHTML =
    `<p class="bar-label">Открыто: ${unlockedCount} / ${view.achievements.length}</p>` +
    view.achievements.map(a => `
      <div class="ach ${a.unlocked ? '' : 'locked'}">
        ${iconImg(a.unlocked ? (a.image ?? ASSETS.trophy) : ASSETS.lock, 'ach-icon')}
        <div class="ach-body">
          <strong>${a.name}</strong> <span class="gold">+${goldLabel(a.gold)}</span>
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
    const added = mergeEntries(data.log, false);
    storage.save(save);
    render();
    showMessage(`Импортировано новых записей: ${added}`);
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

db.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  if (!currentUser) syncStatus = '';
  renderAuth();
  // Вызов sync через setTimeout: внутри этого обработчика нельзя ждать другие запросы Supabase
  if (currentUser && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
    setTimeout(sync, 0);
  }
});

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