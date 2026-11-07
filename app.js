// Состояние героя
let level = 1;
let xp = 0;

// Сколько XP нужно для следующего уровня 100 . level^1.5
function xpToNext(lvl) {
    return Math.round(100 * Math.pow(lvl, 1.5));
}

// Перерисовать экран по текущему состоянию
function render() {
    const need = xpToNext(level);
    document.getElementById('level').textContent = level;
    document.getElementById('xp').textContent = xp;
    document.getElementById('xp-next').textContent = need;
    document.getElementById('xp-fill').style.width = (xp / need * 100) + '%';
}

// Начислить опыт и поднять уровень, усли XP хватает
function addXp(amount) {
    xp += amount;
    while (xp >= xpToNext(level)) {
        xp -= xpToNext(level);
        level++;
    }
    render();
}

document.getElementById('quest-btn').addEventListener('click', () => addXp(30));
render();