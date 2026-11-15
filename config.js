// ===== Конфиг: статы =====
const STATS = [
  { id: 'strength',   name: 'Сила',         icon: 'assets/icons/strength.svg',   color: '#b33a2a' },
  { id: 'endurance',  name: 'Выносливость', icon: 'assets/icons/endurance.svg',  color: '#5f8f4e' },
  { id: 'intellect',  name: 'Интеллект',    icon: 'assets/icons/intellect.svg',  color: '#4a78b0' },
  { id: 'charisma',   name: 'Харизма',      icon: 'assets/icons/charisma.svg',   color: '#b08a3a' },
  { id: 'discipline', name: 'Дисциплина',   icon: 'assets/icons/discipline.svg', color: '#8a8796' },
];

// ===== Визуал =====
// Облики героя: minLevel по возрастанию, первый — с уровня 1
const AVATAR_TIERS = [
  { minLevel: 1,  name: 'Странник',         image: 'assets/avatars/tier-1.webp' },
  { minLevel: 5,  name: 'Послушник ордена', image: 'assets/avatars/tier-2.webp' },
  { minLevel: 10, name: 'Рыцарь пепла',     image: 'assets/avatars/tier-3.webp' },
  { minLevel: 15, name: 'Тёмный чемпион',   image: 'assets/avatars/tier-4.webp' },
  { minLevel: 20, name: 'Легенда бездны',   image: 'assets/avatars/tier-5.webp' },
];

const ASSETS = {
  gold: 'assets/icons/gold.svg',
  lock: 'assets/icons/lock.svg',
  trophy: 'assets/icons/trophy.svg',
  levelUp: 'assets/effects/level-up.webp',
  achievement: 'assets/effects/achievement.webp',
  background: statId => `assets/backgrounds/${statId}.webp`,
};

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

  // ===== Раздел «Сегодня» =====
  // Квесты с полем today показываются только в разделе «Сегодня», не в общем каталоге.
  // today.days — дни недели, когда карточка предлагается: 0 — вс, 1 — пн … 6 — сб.
  {
    id: 'read-start-10', stat: 'intellect', name: 'Чтение — 10 минут', xp: 10,
    limit: { period: 'day', max: 1 }, goal: 'каждый день',
    today: {
      days: [0, 1, 2, 3, 4, 5, 6],
      firstStep: 'Открой книгу на закладке и начни читать.',
      done: 'Прочитаны примерно 10 минут; место остановки отмечено в книге.',
      hint: 'Можно продолжить, если хочется.',
      note: 'Одно чтение отмечай один раз: здесь или в квесте «Чтение 30 мин».',
    },
  },
  {
    id: 'work-focus-20', stat: 'discipline', name: 'Рабочий фокус — 20 минут', xp: 10,
    limit: { period: 'day', max: 1 }, goal: 'пн–пт',
    today: {
      days: [1, 2, 3, 4, 5],
      firstStep: 'Открой текущую задачу и выбери один конкретный шаг.',
      done: 'Около 20 минут работы над выбранным шагом; результат и следующий шаг сохранены в рабочем документе.',
      example: 'Список вопросов, разобранные исходные данные или черновик одного раздела.',
      hint: 'Этот блок помогает начать. После него продолжается обычный рабочий день.',
    },
  },
];

// ===== Здоровье и уход за собой =====
// Каждое выполненное дело восполняет restorePerTask здоровья (до max).
// В момент смены «дня здоровья» (dayStartHour, по умолчанию 04:00) за каждое
// невыполненное вчера дело списывается его penalty.
// Здоровье считается с даты startDate; дни до неё не учитываются.
// Ниже shopLockBelow магазин наград закрыт.
const HEALTH = {
  max: 100,
  restorePerTask: 1,
  dayStartHour: 4,
  startDate: '2026-11-16',
  shopLockBelow: 30,
};

// part: morning — утро, day — день, evening — вечер. id не менять: по ним считается история.
const CARE_TASKS = [
  { id: 'teeth-am',  part: 'morning', name: 'Почистить зубы',             penalty: 4 },
  { id: 'exercise',  part: 'morning', name: 'Зарядка 5–10 минут',         penalty: 3 },
  { id: 'breakfast', part: 'morning', name: 'Завтрак',                    penalty: 3 },
  { id: 'lunch',     part: 'day',     name: 'Обед',                       penalty: 3 },
  { id: 'water',     part: 'day',     name: 'Пить воду в течение дня',    penalty: 2 },
  { id: 'outside',   part: 'day',     name: 'Выйти на улицу, 15+ минут',  penalty: 2 },
  { id: 'dinner',    part: 'evening', name: 'Ужин',                       penalty: 3 },
  { id: 'shower',    part: 'evening', name: 'Душ',                        penalty: 4 },
  { id: 'teeth-pm',  part: 'evening', name: 'Почистить зубы',             penalty: 4 },
];

const CARE_PARTS = { morning: 'Утро', day: 'День', evening: 'Вечер' };

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
  { id: 'read-30',     icon: '📖', name: 'Книжный червь',       desc: '30 раз квест «Чтение 30 мин»',        gold: 100, condition: { type: 'questCount', questId: 'read', count: 30 } },
  { id: 'sleep-7',     icon: '😴', name: 'Режим налажен',       desc: 'Сон 7+ часов 7 дней подряд',          gold: 100, condition: { type: 'streak', questId: 'sleep', days: 7 } },
  { id: 'sleep-30',    icon: '🌙', name: 'Мастер сна',          desc: 'Сон 7+ часов 30 дней подряд',         gold: 300, condition: { type: 'streak', questId: 'sleep', days: 30 } },
  { id: 'habit-66',    icon: '🔥', name: 'Привычка сформирована', desc: '66 дней подряд хоть один квест',    gold: 500, condition: { type: 'streak', days: 66 } },
  { id: 'hero-5',      icon: '⭐', name: 'Новичок',             desc: 'Герой 5 уровня',                      gold: 100, condition: { type: 'heroLevel', level: 5 } },
  { id: 'hero-10',     icon: '🌟', name: 'Ветеран',             desc: 'Герой 10 уровня',                     gold: 300, condition: { type: 'heroLevel', level: 10 } },
  { id: 'all-stats-5', icon: '⚖️', name: 'Разносторонний',      desc: 'Все характеристики 5 уровня',         gold: 300, condition: { type: 'allStatsLevel', level: 5 } },
  { id: 'first-buy',   icon: '🎁', name: 'Заслужил',            desc: 'Купить первую награду',               gold: 10,  condition: { type: 'purchaseCount', count: 1 } },
];

// ===== Баланс: история версий =====
// Каждая версия действует с даты from (локальная дата, с начала суток).
// Чтобы изменить баланс — ДОБАВЬТЕ новую версию в конец с сегодняшней датой.
// Старые версии не редактировать: по ним считается уже достигнутый прогресс.
// Кривая уровня: XP до следующего уровня = base · level^power
const BALANCE_HISTORY = [
  {
    from: '2026-01-01',
    hero: { base: 100, power: 1.5 },
    stat: { base: 50,  power: 1.3 },
    goldPerXp: 0.5,
  },
];

// Текущий баланс (последняя версия) — для новых действий и отображения
const BALANCE = BALANCE_HISTORY[BALANCE_HISTORY.length - 1];

const PERIOD_NAMES = { day: 'сегодня', week: 'на неделе' };
const DAY_MS = 24 * 60 * 60 * 1000;
const SUPABASE_URL = 'https://mlmhlgtyvbmgjvkhyemx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_a_xjkzTNop7i98LecZ1k4w_ehi7qQka';