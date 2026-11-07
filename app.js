// ===== Настройки =====
const STORAGE_KEY = 'life-rpg-save';
const SAVE_VERSION = 1;
const DEFAULT_STATE = { version: SAVE_VERSION, level: 1, xp: 0 };

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

// ===== Проверка данных =====
function isValidState(data) {
    return data !== null && typeof data === 'object'
    && Number.isInteger(data.level) && data.level >= 1
    && Number.isFinite(data.xp) && data.xp >= 0;
}

// ===== Загрузка при старте =====
const saved = storage.load();
let state = isValidState(saved) ? { ...DEFAULT_STATE, ...saved } : { ...DEFAULT_STATE };

// ===== Логика игры =====
function xpToNext(lvl) {
    return Math.round(100 * Math.pow(lvl, 1.5));
}

function addXp(amount) {
    state.xp += amount;
    while (state.xp >= xpToNext(state.level)) {
        state.xp -= xpToNext(state.level);
        state.level++;
    }
    storage.save(state);
    render();
}

// ===== Интерфейс =====
function render() {
    const need = xpToNext(state.level);
    document.getElementById('level').textContent = state.level;
    document.getElementById('xp').textContent = state.xp;
    document.getElementById('xp-next').textContent = need;
    document.getElementById('xp-fill').style.width = (state.xp / need * 100) + '%';
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
        state = { ...DEFAULT_STATE, ...data };
        storage.save(state);
        render();
    } catch (e) {
        alert('Не удалось прочитать файл: ' + e.message);
    }
}

// ===== Обработчики событий =====
document.querySelectorAll('[data-xp]').forEach(btn => {
    btn.addEventListener('click', () => addXp(Number(btn.dataset.xp)));
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
        state = { ...DEFAULT_STATE };
        storage.save(state);
        render();
    }
});

render();