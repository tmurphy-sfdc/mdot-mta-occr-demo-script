(function () {
    'use strict';

    // ============== Build nav from stops ==============
    const stops = Array.from(document.querySelectorAll('.stop'));
    const nav = document.getElementById('stopNav');
    const stopLinks = [];

    stops.forEach((stop, idx) => {
        const id = stop.id;
        const h2 = stop.querySelector('h2').textContent;
        const isHero = stop.classList.contains('hero');
        const a = document.createElement('a');
        a.href = '#' + id;
        a.textContent = `${idx}. ${h2}`;
        a.dataset.target = id;
        if (isHero) a.classList.add('hero');
        nav.appendChild(a);
        stopLinks.push(a);
    });

    // ============== Scroll spy ==============
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                stops.forEach((s) => s.classList.remove('active'));
                stopLinks.forEach((l) => l.classList.remove('active'));
                entry.target.classList.add('active');
                const link = stopLinks.find((l) => l.dataset.target === entry.target.id);
                if (link) link.classList.add('active');
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    stops.forEach((s) => observer.observe(s));

    // ============== Mark-done buttons ==============
    document.querySelectorAll('.done-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.target;
            const stop = document.getElementById(id);
            stop.classList.toggle('done');
            btn.classList.toggle('done');
            btn.textContent = stop.classList.contains('done') ? '✓ Done' : 'Mark done';
            const link = stopLinks.find((l) => l.dataset.target === id);
            if (link) link.classList.toggle('done', stop.classList.contains('done'));
            saveState();
        });
    });

    // ============== Copy-to-clipboard buttons ==============
    document.querySelectorAll('.copy-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const target = document.getElementById(btn.dataset.copy);
            if (!target) return;
            try {
                await navigator.clipboard.writeText(target.textContent.trim());
                const original = btn.textContent;
                btn.textContent = '✓ Copied';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.textContent = original;
                    btn.classList.remove('copied');
                }, 1500);
            } catch (err) {
                btn.textContent = '⚠ Copy failed';
            }
        });
    });

    // ============== Timer ==============
    const TOTAL_SECONDS = 15 * 60;
    let secondsLeft = TOTAL_SECONDS;
    let running = false;
    let intervalId = null;

    const clockTime = document.getElementById('clockTime');
    const clockFill = document.getElementById('clockFill');
    const btnStart = document.getElementById('btnStart');
    const btnPause = document.getElementById('btnPause');
    const btnReset = document.getElementById('btnReset');

    function render() {
        const m = Math.floor(Math.abs(secondsLeft) / 60);
        const s = Math.abs(secondsLeft) % 60;
        const sign = secondsLeft < 0 ? '+' : '';
        clockTime.textContent = `${sign}${m}:${s.toString().padStart(2, '0')}`;
        const pct = Math.min(100, Math.max(0, ((TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS) * 100));
        clockFill.style.width = pct + '%';
        clockTime.classList.remove('warn', 'danger');
        if (secondsLeft <= 60 && secondsLeft > 0) clockTime.classList.add('warn');
        if (secondsLeft <= 0) clockTime.classList.add('danger');
    }

    function start() {
        if (running) return;
        running = true;
        btnStart.textContent = 'Running…';
        btnStart.classList.remove('primary');
        intervalId = setInterval(() => {
            secondsLeft -= 1;
            render();
        }, 1000);
    }

    function pause() {
        running = false;
        clearInterval(intervalId);
        btnStart.textContent = 'Resume';
        btnStart.classList.add('primary');
    }

    function reset() {
        pause();
        secondsLeft = TOTAL_SECONDS;
        btnStart.textContent = 'Start';
        btnStart.classList.add('primary');
        render();
    }

    btnStart.addEventListener('click', () => (running ? pause() : start()));
    btnPause.addEventListener('click', pause);
    btnReset.addEventListener('click', reset);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === ' ') { e.preventDefault(); running ? pause() : start(); }
        if (e.key === 'r' || e.key === 'R') reset();
        if (e.key === 'j' || e.key === 'ArrowDown') scrollToNextStop(1);
        if (e.key === 'k' || e.key === 'ArrowUp') scrollToNextStop(-1);
    });

    function scrollToNextStop(dir) {
        const active = document.querySelector('.stop.active') || stops[0];
        const idx = stops.indexOf(active);
        const next = stops[Math.max(0, Math.min(stops.length - 1, idx + dir))];
        if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    render();

    // ============== Persist state ==============
    const STATE_KEY = 'caltrans-demo-state';

    function saveState() {
        const state = {
            done: stops.filter((s) => s.classList.contains('done')).map((s) => s.id),
            checks: Array.from(document.querySelectorAll('.checklist input[type="checkbox"]'))
                .map((cb, i) => (cb.checked ? i : null))
                .filter((v) => v !== null),
        };
        try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STATE_KEY);
            if (!raw) return;
            const state = JSON.parse(raw);
            (state.done || []).forEach((id) => {
                const stop = document.getElementById(id);
                if (!stop) return;
                stop.classList.add('done');
                const btn = stop.querySelector('.done-btn');
                if (btn) { btn.classList.add('done'); btn.textContent = '✓ Done'; }
                const link = stopLinks.find((l) => l.dataset.target === id);
                if (link) link.classList.add('done');
            });
            const checks = document.querySelectorAll('.checklist input[type="checkbox"]');
            (state.checks || []).forEach((idx) => {
                if (checks[idx]) checks[idx].checked = true;
            });
        } catch (e) {}
    }

    document.querySelectorAll('.checklist input[type="checkbox"]').forEach((cb) => {
        cb.addEventListener('change', saveState);
    });

    loadState();

    // ============== Reset button for state ==============
    // Add a small reset link at the bottom of the sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const resetBlock = document.createElement('section');
        resetBlock.className = 'side-block';
        resetBlock.innerHTML = `
            <h3>Reset for next demo</h3>
            <p style="margin:0 0 10px;font-size:12px;color:var(--ink-dim);">Clears all done marks and checklist state.</p>
            <button class="btn ghost" id="btnResetAll">Reset checklist &amp; progress</button>
        `;
        sidebar.appendChild(resetBlock);
        document.getElementById('btnResetAll').addEventListener('click', () => {
            if (!confirm('Reset all done marks and checklist state?')) return;
            localStorage.removeItem(STATE_KEY);
            location.reload();
        });
    }
})();
