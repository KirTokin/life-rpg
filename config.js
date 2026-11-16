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
  { id: 'gym',       stat: 'strength',   name: 'Силовая тренировка 45+ мин',      xp: 60, limit: { period: 'day',  max: 1 }, goal: '2–3 р/нед',
    group: 'strength-session' },
  // Домашняя силовая: с STRENGTH_GROUPS[…].from — программа с отметками подходов и частичной наградой.
  // До этой даты действует прежний формат (legacy): одно нажатие, 25 XP.
  { id: 'home-str',  stat: 'strength',   name: 'Силовая дома — стартовая программа', xp: 40, gold: 20,
    limit: { period: 'day',  max: 1 }, goal: '2 р/нед (пн/чт)', group: 'strength-session', program: 'home-strength-v1',
    desc: 'Пять упражнений на всё тело. Отмечай выполненные подходы; можно сохранить частичный результат.',
    legacy: { until: '2026-11-23', name: 'Домашняя силовая 20 мин', xp: 25 } },
  { id: 'cardio',    stat: 'endurance',  name: 'Умеренное кардио 30 мин',         xp: 30, limit: { period: 'day',  max: 1 }, goal: '3 р/нед' },
  { id: 'cardio-hi', stat: 'endurance',  name: 'Интенсивное кардио 25+ мин',      xp: 35, limit: { period: 'day',  max: 1 }, goal: '2 р/нед' },
  { id: 'steps',     stat: 'endurance',  name: '8 000+ шагов',                    xp: 10, limit: { period: 'day',  max: 1 }, goal: '5 р/нед' },
  { id: 'read',      stat: 'intellect',  name: 'Чтение 30 мин',                   xp: 20, limit: { period: 'day',  max: 2 }, goal: '5 р/нед',
    guide: { firstStep: 'Открой книгу на закладке и начни читать.', done: 'Прочитаны примерно 30 минут; место остановки отмечено.',
      note: 'Один сеанс чтения засчитывается один раз: как 10 или как 30 минут.' } },
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

  // ===== Квесты с подсказкой «первый шаг / готово, когда» (guide) =====
  {
    id: 'read-start-10', stat: 'intellect', name: 'Чтение — 10 минут', xp: 10,
    limit: { period: 'day', max: 1 }, goal: 'каждый день',
    guide: {
      firstStep: 'Открой книгу на закладке и начни читать.',
      done: 'Прочитаны примерно 10 минут; место остановки отмечено в книге.',
      hint: 'Можно продолжить, если хочется.',
      note: 'Один сеанс чтения засчитывается один раз: как 10 или как 30 минут.',
    },
  },
  {
    id: 'work-focus-20', stat: 'discipline', name: 'Рабочий фокус — 20 минут', xp: 10,
    limit: { period: 'day', max: 3 }, goal: 'до 3 подходов в день',
    guide: {
      firstStep: 'Открой текущую задачу и выбери один конкретный шаг.',
      done: 'Около 20 минут работы над выбранным шагом; результат и следующий шаг сохранены в рабочем документе.',
      example: 'Список вопросов, разобранные исходные данные или черновик одного раздела.',
      hint: 'Этот блок помогает начать. После него продолжается обычный рабочий день.',
    },
  },
  {
    id: 'write-start-10', stat: 'intellect', name: 'Писать — 10 минут', xp: 10,
    limit: { period: 'day', max: 1 }, goal: 'творчество',
    guide: {
      firstStep: 'Открой собственный текст или пустой документ.',
      done: 'Около 10 минут писал или дорабатывал собственный художественный текст; результат сохранён.',
      hint: 'Объём и качество не важны — важно, что текст сдвинулся.',
    },
  },
];

// ===== План: направления, минимумы, бонусы, последствия =====
// Направление — поле плана, не характеристика героя. Одно выполнение покрывает одно направление.
// Игровой день — 04:00–04:00 (HEALTH.dayStartHour), неделя — с понедельника 04:00.
// Правила действуют с активации: дневные — со следующего игрового дня, недельные — со следующего понедельника.
// Изменить правила: ДОБАВЬТЕ версию в versions с новым rv и поднимите PLAN.rulesVersion.
const PLAN = {
  rulesVersion: 2,
  directions: {
    work:   'Работа',
    learn:  'Чтение / обучение',
    body:   'Физическая активность',
    strength: 'Силовая программа',
    create: 'Творчество',
    social: 'Общение / речь',
  },
  versions: {
    1: {
      workdays: [1, 2, 3, 4, 5],             // пн–пт: 0 — вс … 6 — сб
      daily: { workday: ['work', 'learn'], weekend: ['learn'] },
      weekly: { body: 2, create: 1, social: 1 }, // сколько разных игровых дней за неделю
      questDirs: {
        'work-focus-20': 'work',
        'read-start-10': 'learn', 'read': 'learn', 'study': 'learn',
        'gym': 'body', 'home-str': 'body', 'cardio': 'body', 'cardio-hi': 'body', 'steps': 'body',
        'write-start-10': 'create',
        'contact': 'social', 'speech': 'social', 'network': 'social', 'present': 'social',
      },
      dayBonus: 5,           // все дневные направления дня выполнены
      weekBonus: 10,         // все недельные направления недели выполнены
      dailyPenalty: 15,      // минут переходного запаса на следующий день за каждое невыполненное дневное
      dailyPenaltyMax: 30,
      weeklyPenalty: 15,     // минут в следующий понедельник за каждое невыполненное недельное
      weeklyPenaltyMax: 30,
      totalPenaltyMax: 60,
    },
    // v2: недельное «физическая активность 2 разных дня» заменено на «Силовая программа: объём 2».
    // Объём: домашняя программа — доля выполненных подходов, зал — 1. Дневные требования — как в v1.
    // Недельные правила v2 — с первой полной недели после активации, но не раньше weeklyNotBefore.
    2: {
      workdays: [1, 2, 3, 4, 5],
      daily: { workday: ['work', 'learn'], weekend: ['learn'] },
      weekly: { create: 1, social: 1 },          // разных игровых дней за неделю
      weeklyVolume: { strength: 2 },             // сумма вклада за неделю
      weeklyNotBefore: '2026-11-23',
      questDirs: {
        'work-focus-20': 'work',
        'read-start-10': 'learn', 'read': 'learn', 'study': 'learn',
        'gym': 'strength', 'home-str': 'strength',
        'cardio': 'body', 'cardio-hi': 'body', 'steps': 'body',
        'write-start-10': 'create',
        'contact': 'social', 'speech': 'social', 'network': 'social', 'present': 'social',
      },
      dayBonus: 5,
      weekBonus: 10,
      dailyPenalty: 15,
      dailyPenaltyMax: 30,
      weeklyPenalty: 15,     // одна поправка за каждое невыполненное недельное направление
      weeklyPenaltyMax: 30,
      totalPenaltyMax: 60,
    },
  },
};

// ===== Силовые занятия: общая недельная квота и восстановление =====
// Группа объединяет квесты с одинаковым group. Квота — занятий за игровую неделю (пн 04:00 — пн 04:00):
// завершённые (любой результат > 0), начатые и запланированные на сегодня/будущее вместе.
// Отдых — часов от последней нагрузки (последняя отметка рабочего подхода; у зала — время выполнения).
// Действует с игрового дня from; более ранние занятия правилами группы не пересчитываются.
const STRENGTH_GROUPS = {
  'strength-session': { name: 'Силовые занятия', maxPerWeek: 2, restHours: 48, from: '2026-11-23', preferredDays: [1, 4] },
};

// ===== Программы с отметками подходов =====
// Содержимое — данные: пункты с весом в прогрессе (подготовка — 0, рабочий подход — 1).
// Награда = floor(xp × доля) и отдельно floor(gold × доля). При старте занятия программа копируется
// в снимок: правка текста или нагрузки не меняет уже начатые и завершённые занятия.
// Новую версию — добавить с новым id, старые не редактировать по смыслу.
const PROGRAMS = {
  'home-strength-v1': {
    id: 'home-strength-v1', version: 1, questId: 'home-str', xp: 40, gold: 20, sets: 2,
    summary: 'Всё тело · около 25–35 минут',
    purpose: 'Первые две недели — освоение движений и регулярности. Понедельник и четверг — одна и та же программа. После первых четырёх занятий нагрузку стоит пересмотреть; сама игра её не повышает.',
    inventory: 'Разборная гантель или пара гантелей, коврик. Для опоры — прочная неподвижная поверхность подходящей высоты; скамья не обязательна. Не используй стеклянный, складной или скользящий стол и стул на колёсиках.',
    prep: {
      label: 'Подготовка и разминка сделаны',
      text: 'Освободи место, проверь крепления дисков. Сделай 5–7 минут лёгкой разминки: ходьба на месте, спокойные движения плечами и тазом, несколько неглубоких приседаний. Перед новым движением попробуй несколько повторений без веса или с минимальной нагрузкой.',
      note: 'Разминочные и пробные повторения не отмечаются как рабочие подходы. Разминка не отмечает зарядку в уходе за собой.',
    },
    order: 'Можно идти по порядку: оба подхода упражнения, затем следующее. Это не круг на скорость. Отдых между подходами — ориентир 90–120 секунд, можно дольше, до спокойного дыхания. Таймер не обязателен.',
    loadHint: 'Выбирай вариант и вес, с которыми движение остаётся контролируемым и в конце есть запас примерно 2–3 повторения. Не работай до отказа ради награды. Не задерживай дыхание.',
    progression: 'Когда в двух последовательных занятиях в обоих подходах упражнения достигнута верхняя граница с уверенной техникой и запасом, на следующем занятии можно немного увеличить вес или выбрать чуть более сложный вариант. Меняй один параметр. Используй минимальный доступный шаг веса; если он слишком велик, пока оставь прежний. После повышения допустимо вернуться к нижней границе повторов. Приседание: дальше — с лёгкой гантелью у груди; отжимание — от более низкой опоры. Мост и «рука и нога»: сначала качество и верхняя граница повторов, без утяжеления. Больший вес или число повторов не дают больше награды.',
    rangeNote: 'Диапазон повторений — ориентир, а не проверка. Можно отметить реально выполненный рабочий подход с меньшим числом повторов; короткая проба движения рабочим подходом не считается.',
    safety: 'При боли, головокружении или тошноте остановись. Можно сохранить сделанное и завершить частично; не продолжай ради 100%. Если симптомы повторяются, обсуди нагрузку с врачом.',
    coach: 'Приложение не проверяет технику. Для старта полезно одно ознакомительное занятие с квалифицированным тренером.',
    sources: [
      { label: 'ACSM — рекомендации по силовым тренировкам, 2026 (англ.)', url: 'https://acsm.org/resistance-training-guidelines-update-2026/' },
      { label: 'Mayo Clinic — силовые тренировки (англ.)', url: 'https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/strength-training/art-20046670' },
    ],
    exercises: [
      { id: 'squat', name: 'Приседание без веса', reps: '8–12', weight: true,
        variants: ['Без веса', 'Вставание со стула', 'С лёгкой гантелью у груди'],
        hint: 'Стопы примерно на ширине плеч, вся стопа на полу. Опускайся на комфортную глубину, колени движутся по направлению носков. Вставай без рывка. При необходимости начни с вставания с устойчивого стула.',
        links: [{ label: 'Техника (англ.)', url: 'https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/' }] },
      { id: 'push', name: 'Отжимание в доступном варианте', reps: '6–12',
        variants: ['От стены', 'От высокой опоры', 'От низкой опоры', 'С колен на коврике'],
        hint: 'Начни от стены либо высокой устойчивой опоры; если легко — от более низкой опоры или с колен на коврике. Корпус держи ровно, поясницу не проваливай. Двигайся спокойно, локти не разводи строго в стороны.',
        links: [{ label: 'От стены (англ.)', url: 'https://www.nhs.uk/live-well/exercise/strength-exercises/' },
                { label: 'С колен (англ.)', url: 'https://www.acefitness.org/resources/everyone/exercise-library/13/bent-knee-push-up/' }] },
      { id: 'row', name: 'Тяга гантели одной рукой с опорой', reps: '8–12 каждой рукой', weight: true,
        sides: ['прав.', 'лев.'], setLabel: 'правой и левой рукой',
        variants: ['Опора рукой на бедро, разножка', 'Опора на устойчивую поверхность'],
        hint: 'Спина сохраняет нейтральное положение, корпус устойчив. Тяни локоть назад к тазу, не разворачивай туловище вслед за гантелью. Опускай вес плавно. Сначала более слабая сторона; второй рукой столько же повторений. Если трудно удержать положение в разножке — выбери устойчивую опору и сначала освой движение с лёгким весом.',
        links: [{ label: 'Техника (англ.; на странице — со скамьёй, дома — адаптация)', url: 'https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/' }] },
      { id: 'bridge', name: 'Ягодичный мост на полу', reps: '10–15',
        hint: 'Лёжа на спине, согни колени, стопы на полу. Подними таз за счёт ягодиц, не выгибая поясницу; спокойно опусти. В первом варианте без дополнительного веса.',
        links: [{ label: 'Техника (англ.)', url: 'https://www.nasm.org/resource-center/exercise-library/floor-bridge' }] },
      { id: 'bird-dog', name: 'Противоположные рука и нога на четвереньках', reps: '6–8 каждой стороной',
        sides: ['1-я ст.', '2-я ст.'], setLabel: 'обеими сторонами',
        variants: ['Рука и нога', 'Только рука', 'Только нога'],
        hint: 'Ладони под плечами, колени под тазом. Медленно вытяни противоположные руку и ногу, удержи 1–2 секунды и верни. Таз не разворачивай, поясницу не прогибай. Упрощение: двигать только рукой или только ногой, сохраняя устойчивость.',
        links: [{ label: 'Техника (англ.)', url: 'https://www.acefitness.org/resources/everyone/exercise-library/14/bird-dog/' }] },
    ],
  },
};

// Шаблоны рабочих задач: при создании копируются, дальше редактируются
const TASK_TEMPLATES = [
  { id: 'doc', name: 'Подготовка документа',
    stages: ['Собрать сведения', 'Уточнить требования', 'Подготовить черновик', 'Согласовать', 'Передать результат'] },
  { id: 'org', name: 'Организация работы',
    stages: ['Определить результат', 'Собрать вводные', 'Распределить действия', 'Проверить выполнение', 'Закрыть задачу'] },
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
  // Полный день ухода — все дела одного дня (04:00–04:00). Бонус начисляется один раз за день,
  // при любом здоровье. Считается из журнала, отдельной записи нет.
  fullDayGold: 5,
};

// part: morning — утро, day — день, evening — вечер. id не менять: по ним считается история.
const CARE_TASKS = [
  { id: 'teeth-am',  part: 'morning', name: 'Почистить зубы утром',        penalty: 4, doneMsg: 'Зубы почищены' },
  { id: 'exercise',  part: 'morning', name: 'Сделать зарядку — 5–10 минут', penalty: 3, doneMsg: 'Зарядка сделана' },
  { id: 'breakfast', part: 'morning', name: 'Позавтракать',                penalty: 3, doneMsg: 'Завтрак отмечен' },
  { id: 'lunch',     part: 'day',     name: 'Пообедать',                   penalty: 3, doneMsg: 'Обед отмечен' },
  { id: 'water',     part: 'day',     name: 'Пить воду в течение дня',     penalty: 2, doneMsg: 'Вода отмечена' },
  { id: 'outside',   part: 'day',     name: 'Побыть на улице не меньше 15 минут', penalty: 2, doneMsg: 'Прогулка отмечена' },
  { id: 'dinner',    part: 'evening', name: 'Поужинать',                   penalty: 3, doneMsg: 'Ужин отмечен' },
  { id: 'shower',    part: 'evening', name: 'Принять душ',                 penalty: 4, doneMsg: 'Душ принят' },
  { id: 'teeth-pm',  part: 'evening', name: 'Почистить зубы перед сном',   penalty: 4, doneMsg: 'Зубы почищены' },
];

const CARE_PARTS = { morning: 'Утро', day: 'День', evening: 'Вечер' };

// ===== Развлечения: учёт времени =====
// Игры, YouTube/видео, фильмы и сериалы — один общий счёт минут. День — как у ухода (04:00–04:00).
// Порядок расхода: сначала переходный запас дня, затем купленные минуты, затем долг.
// Переходный запас — временный стартовый допуск для постепенного сокращения, не цель.
// Чтобы изменить запас — ДОБАВЬТЕ версию в allowanceHistory с новой датой from; прошлое не пересчитывается.
const LEISURE = {
  maxBalance: 120,   // обычная покупка не поднимает запас купленных минут выше
  maxDebt: 120,      // долг к погашению не больше; полный перерасход остаётся в истории
  reviewAfterDays: 7,
  maxSessionMinutes: 1440,
  modes: {
    home:    'Рабочий день дома',
    office:  'Офис',
    weekend: 'Выходной',
  },
  // день недели (0 — вс … 6 — сб) → режим дня
  weekdayMode: { 0: 'weekend', 1: 'home', 2: 'office', 3: 'office', 4: 'home', 5: 'home', 6: 'weekend' },
  allowanceHistory: [
    { from: '2026-11-16', minutes: { home: 360, office: 120, weekend: 480 } },
  ],
  categories: [
    { id: 'games',  name: 'Игры' },
    { id: 'video',  name: 'YouTube / видео' },
    { id: 'movies', name: 'Фильмы / сериалы' },
    { id: 'mixed',  name: 'Смешанное' },
  ],
};

// ===== Конфиг: награды (цена = 80 🪙 × дни усилий) =====
// limit необязателен
const REWARDS = [
  { id: 'treat',  name: 'Любимая вкусняшка',          icon: '🍰', cost: 50,   limit: { period: 'week', max: 3 } },
  // retired: больше не продаётся, определение оставлено для истории старых покупок
  { id: 'series', name: 'Вечер сериала/игр (2 ч)',    icon: '🎬', cost: 80,   limit: { period: 'week', max: 3 }, retired: true },
  // Время развлечений: 1 монета = 3 минуты. minutes сохраняется в самой покупке
  { id: 'leisure-15', name: '15 минут развлечений',   icon: '🎮', cost: 5,  minutes: 15 },
  { id: 'leisure-30', name: '30 минут развлечений',   icon: '🎮', cost: 10, minutes: 30 },
  { id: 'leisure-60', name: '60 минут развлечений',   icon: '🎮', cost: 20, minutes: 60 },
  { id: 'dinner', name: 'Ужин в ресторане',           icon: '🍽️', cost: 250 },
  { id: 'game',   name: 'Покупка игры/книги',         icon: '🎮', cost: 1100 },
  { id: 'big',    name: 'Крупная покупка/поездка',    icon: '✈️', cost: 6000 },
];

// ===== Конфиг: ачивки =====
// Типы условий: anyQuestCount, questCount, heroLevel, allStatsLevel, streak, purchaseCount, careDays
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
  // Уход: полные дни считаются накопительно, непрерывная серия не нужна
  { id: 'care-days-1',  icon: '🌱', name: 'Первый день заботы', desc: '1 полный день ухода',  gold: 10, condition: { type: 'careDays', count: 1 } },
  { id: 'care-days-3',  icon: '🌿', name: '3 дня заботы',       desc: '3 полных дня ухода',   gold: 15, condition: { type: 'careDays', count: 3 } },
  { id: 'care-days-7',  icon: '🍀', name: '7 дней заботы',      desc: '7 полных дней ухода',  gold: 25, condition: { type: 'careDays', count: 7 } },
  { id: 'care-days-14', icon: '🌳', name: '14 дней заботы',     desc: '14 полных дней ухода', gold: 40, condition: { type: 'careDays', count: 14 } },
  { id: 'care-days-30', icon: '🏵️', name: '30 дней заботы',     desc: '30 полных дней ухода', gold: 60, condition: { type: 'careDays', count: 30 } },
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