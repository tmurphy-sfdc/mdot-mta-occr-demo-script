(function () {
    'use strict';
    const EDIT_STATE_KEY = 'mta-demo-script-edits-v1';

    // ============== Build nav from stops ==============
    const stops = Array.from(document.querySelectorAll('.stop'));
    const nav = document.getElementById('stopNav');
    const stopLinks = [];

    function visibleStops() {
        return stops.filter((s) => !s.classList.contains('hidden-track'));
    }

    function rebuildNav() {
        nav.innerHTML = '';
        stopLinks.length = 0;
        visibleStops().forEach((stop, idx) => {
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
    }
    rebuildNav();

    // ============== Edit mode ==============
    const btnEditMode = document.getElementById('btnEditMode');
    const btnSaveEdits = document.getElementById('btnSaveEdits');
    const btnResetEdits = document.getElementById('btnResetEdits');
    const editableNodes = Array.from(document.querySelectorAll(
        '.stop-meta h2, .stop-time, .say p, .do p, .do li, .transition, .exec-summary, .hero-list li, .cut-list li, .prompt-hint, .prompt-label, .prompt-block pre'
    ));
    let editModeOn = false;

    editableNodes.forEach((node, idx) => {
        node.dataset.editKey = `editable-${idx}`;
    });

    function setEditMode(enabled) {
        editModeOn = enabled;
        document.body.classList.toggle('is-editing', enabled);
        editableNodes.forEach((node) => {
            node.setAttribute('contenteditable', enabled ? 'true' : 'false');
        });
        btnEditMode.textContent = enabled ? 'Disable Edit Mode' : 'Enable Edit Mode';
        btnEditMode.classList.toggle('primary', enabled);
    }

    function saveEdits() {
        const payload = {};
        editableNodes.forEach((node) => {
            payload[node.dataset.editKey] = node.innerHTML;
        });
        try {
            localStorage.setItem(EDIT_STATE_KEY, JSON.stringify(payload));
        } catch (e) {}
    }

    function loadEdits() {
        try {
            const raw = localStorage.getItem(EDIT_STATE_KEY);
            if (!raw) return;
            const payload = JSON.parse(raw);
            editableNodes.forEach((node) => {
                const key = node.dataset.editKey;
                if (Object.prototype.hasOwnProperty.call(payload, key)) {
                    node.innerHTML = payload[key];
                }
            });
        } catch (e) {}
    }

    function resetEdits() {
        if (!confirm('Reset all local text edits on this page?')) return;
        localStorage.removeItem(EDIT_STATE_KEY);
        location.reload();
    }

    btnEditMode.addEventListener('click', () => setEditMode(!editModeOn));
    btnSaveEdits.addEventListener('click', saveEdits);
    btnResetEdits.addEventListener('click', resetEdits);
    loadEdits();
    setEditMode(false);

    // ============== Scroll spy ==============
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting && !entry.target.classList.contains('hidden-track')) {
                stops.forEach((s) => s.classList.remove('active'));
                stopLinks.forEach((l) => l.classList.remove('active'));
                entry.target.classList.add('active');
                const link = stopLinks.find((l) => l.dataset.target === entry.target.id);
                if (link) link.classList.add('active');
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    stops.forEach((s) => observer.observe(s));

    // ============== Track filters ==============
    const btnViewAll = document.getElementById('btnViewAll');
    const btnViewExec = document.getElementById('btnViewExec');
    const btnViewFull = document.getElementById('btnViewFull');

    function setToggleActive(mode) {
        [btnViewAll, btnViewExec, btnViewFull].forEach((b) => b.classList.remove('primary'));
        if (mode === 'exec') btnViewExec.classList.add('primary');
        else if (mode === 'full') btnViewFull.classList.add('primary');
        else btnViewAll.classList.add('primary');
    }

    function applyTrackFilter(mode) {
        stops.forEach((s) => {
            const track = s.dataset.track || 'full';
            const hide = mode === 'all' ? false : track !== mode;
            s.classList.toggle('hidden-track', hide);
            if (hide) s.classList.remove('active');
        });
        document.querySelectorAll('[data-track]:not(.stop)').forEach((el) => {
            const track = el.dataset.track || 'full';
            const hide = mode === 'all' ? false : track !== mode;
            el.classList.toggle('hidden-track', hide);
        });
        rebuildNav();
        setToggleActive(mode);
        const first = visibleStops()[0];
        if (first) {
            first.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        saveState();
    }

    btnViewAll.addEventListener('click', () => applyTrackFilter('all'));
    btnViewExec.addEventListener('click', () => applyTrackFilter('exec'));
    btnViewFull.addEventListener('click', () => applyTrackFilter('full'));

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
        const inEditable =
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable === true ||
            (typeof e.target.closest === 'function' && e.target.closest('[contenteditable="true"]'));
        if (inEditable) return;
        if (e.key === ' ') { e.preventDefault(); running ? pause() : start(); }
        if (e.key === 'r' || e.key === 'R') reset();
        if (e.key === 'j' || e.key === 'ArrowDown') scrollToNextStop(1);
        if (e.key === 'k' || e.key === 'ArrowUp') scrollToNextStop(-1);
    });

    function scrollToNextStop(dir) {
        const list = visibleStops();
        const active = document.querySelector('.stop.active') || list[0];
        const idx = list.indexOf(active);
        const next = list[Math.max(0, Math.min(list.length - 1, idx + dir))];
        if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    render();

    // ============== Persist state ==============
    const STATE_KEY = 'caltrans-demo-state';

    function saveState() {
        const state = {
            done: stops.filter((s) => s.classList.contains('done')).map((s) => s.id),
            filterMode: btnViewExec.classList.contains('primary')
                ? 'exec'
                : (btnViewFull.classList.contains('primary') ? 'full' : 'all'),
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
            applyTrackFilter(state.filterMode || 'all');
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
    if (!localStorage.getItem(STATE_KEY)) {
        applyTrackFilter('all');
    }

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
