(function () {
    'use strict';

    const BALL_ID = 'my-bg-ball';
    const PANEL_ID = 'my-bg-panel';
    const STORAGE_KEY = 'my-bg-settings';

    let blurValue = 0;
    let brightnessValue = 100;
    let followCharAvatar = false;
    let originalBgImage = null;
    let lastAvatarKey = ''; // 用于检测角色是否真的变了

    setTimeout(init, 2000);

    function init() {
        if (document.getElementById(BALL_ID)) return;

        loadSettings();
        createBall();
        createPanel();
        applyBgFilter();
        if (followCharAvatar) applyCharBackground();
        setupCharWatcher();
    }

    // ---------- 设置读写 ----------
    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            if (typeof saved.blur === 'number') blurValue = saved.blur;
            if (typeof saved.brightness === 'number') brightnessValue = saved.brightness;
            if (typeof saved.follow === 'boolean') followCharAvatar = saved.follow;
        } catch (e) {}
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                blur: blurValue,
                brightness: brightnessValue,
                follow: followCharAvatar,
            }));
        } catch (e) {}
    }

    // ---------- 悬浮球 ----------
    function createBall() {
        const ball = document.createElement('div');
        ball.id = BALL_ID;
        ball.textContent = 'bg';
        document.body.appendChild(ball);

        try {
            const pos = JSON.parse(localStorage.getItem(STORAGE_KEY + '-pos') || 'null');
            if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
                ball.style.left = Math.max(0, Math.min(window.innerWidth - 40, pos.left)) + 'px';
                ball.style.top = Math.max(0, Math.min(window.innerHeight - 40, pos.top)) + 'px';
                ball.style.right = 'auto';
                ball.style.bottom = 'auto';
            }
        } catch (e) {}

        let isDragging = false;
        let hasMoved = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;

        ball.addEventListener('pointerdown', function (e) {
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            const rect = ball.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            try { ball.setPointerCapture(e.pointerId); } catch (err) {}
        });

        ball.addEventListener('pointermove', function (e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
            if (hasMoved) {
                let nl = startLeft + dx;
                let nt = startTop + dy;
                const maxL = window.innerWidth - ball.offsetWidth - 2;
                const maxT = window.innerHeight - ball.offsetHeight - 2;
                nl = Math.max(2, Math.min(maxL, nl));
                nt = Math.max(2, Math.min(maxT, nt));
                ball.style.left = nl + 'px';
                ball.style.top = nt + 'px';
                ball.style.right = 'auto';
                ball.style.bottom = 'auto';
            }
        });

        ball.addEventListener('pointerup', function (e) {
            if (!isDragging) return;
            isDragging = false;
            try { ball.releasePointerCapture(e.pointerId); } catch (err) {}
            if (hasMoved) {
                const rect = ball.getBoundingClientRect();
                try {
                    localStorage.setItem(STORAGE_KEY + '-pos', JSON.stringify({ left: rect.left, top: rect.top }));
                } catch (err) {}
            } else {
                openPanel();
            }
        });

        ball.addEventListener('pointercancel', function (e) {
            if (!isDragging) return;
            isDragging = false;
            try { ball.releasePointerCapture(e.pointerId); } catch (err) {}
        });
    }

    // ---------- 面板 ----------
    function createPanel() {
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="my-bg-header">
                <span>背景调节</span>
                <button id="my-bg-close" title="关闭">×</button>
            </div>
            <label class="my-bg-label">模糊</label>
            <input type="range" id="my-bg-blur" min="0" max="30" value="${blurValue}" step="1">
            <label class="my-bg-label">亮度</label>
            <input type="range" id="my-bg-bright" min="30" max="150" value="${brightnessValue}" step="1">
            <label class="my-bg-check">
                <input type="checkbox" id="my-bg-follow" ${followCharAvatar ? 'checked' : ''}>
                背景跟随角色头像
            </label>
        `;
        document.body.appendChild(panel);

        document.getElementById('my-bg-close').addEventListener('click', function () {
            panel.classList.remove('show');
            const ball = document.getElementById(BALL_ID);
            if (ball) ball.style.display = 'flex';
        });

        document.getElementById('my-bg-blur').addEventListener('input', function (e) {
            blurValue = Number(e.target.value);
            applyBgFilter();
            saveSettings();
        });

        document.getElementById('my-bg-bright').addEventListener('input', function (e) {
            brightnessValue = Number(e.target.value);
            applyBgFilter();
            saveSettings();
        });

        document.getElementById('my-bg-follow').addEventListener('change', function (e) {
            followCharAvatar = e.target.checked;
            if (followCharAvatar) {
                applyCharBackground(true);
            } else {
                restoreOriginalBg();
            }
            saveSettings();
        });
    }

    function openPanel() {
        const ball = document.getElementById(BALL_ID);
        const panel = document.getElementById(PANEL_ID);
        if (!ball || !panel) return;

        const ballRect = ball.getBoundingClientRect();
        panel.classList.add('show');
        ball.style.display = 'none';

        panel.style.visibility = 'hidden';
        panel.style.left = '0px';
        panel.style.top = '0px';

        const panelW = panel.offsetWidth;
        const panelH = panel.offsetHeight;

        let left;
        if (ballRect.right + 10 + panelW <= window.innerWidth - 5) {
            left = ballRect.right + 10;
        } else if (ballRect.left - 10 - panelW >= 5) {
            left = ballRect.left - 10 - panelW;
        } else {
            left = Math.max(5, window.innerWidth - panelW - 5);
        }

        let top = ballRect.top;
        if (top + panelH > window.innerHeight - 5) top = window.innerHeight - panelH - 5;
        if (top < 5) top = 5;

        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
        panel.style.visibility = 'visible';
    }

    // ---------- 背景滤镜 ----------
    function getBackgroundEls() {
        const els = [];
        const seen = new Set();
        ['bg1', 'bg_custom', 'bg'].forEach(id => {
            const el = document.getElementById(id);
            if (el && !seen.has(el)) { els.push(el); seen.add(el); }
        });
        const container = document.getElementById('backgrounds');
        if (container) {
            container.querySelectorAll('div').forEach(el => {
                if (el.id && el.id.toLowerCase().startsWith('bg') && !seen.has(el)) {
                    els.push(el);
                    seen.add(el);
                }
            });
        }
        return els;
    }

    function applyBgFilter() {
        const els = getBackgroundEls();
        const filter = `blur(${blurValue}px) brightness(${brightnessValue / 100})`;
        const scale = blurValue > 0 ? (1 + blurValue / 150) : 1;
        els.forEach(el => {
            el.style.filter = filter;
            if (blurValue > 0) {
                el.style.transform = `scale(${scale})`;
                el.style.transformOrigin = 'center center';
            } else {
                el.style.transform = '';
                el.style.transformOrigin = '';
            }
        });
    }

    // ---------- 角色头像背景（核心改动） ----------
    function getVisibleBgEl() {
        const els = getBackgroundEls();
        for (const el of els) {
            const s = getComputedStyle(el);
            if (s.display !== 'none' && s.backgroundImage && s.backgroundImage !== 'none') {
                return el;
            }
        }
        return els[0] || null;
    }

    function getCurrentCharacter() {
        try {
            // 优先用 getContext
            if (typeof getContext === 'function') {
                const ctx = getContext();
                if (ctx.characters && ctx.this_chid !== undefined && ctx.this_chid !== null && ctx.this_chid !== 'none') {
                    return ctx.characters[ctx.this_chid];
                }
            }
            // 回退到全局变量
            if (window.characters && window.this_chid !== undefined && window.this_chid !== null && window.this_chid !== 'none') {
                return window.characters[window.this_chid];
            }
        } catch (e) {}
        return null;
    }

    function applyCharBackground(force) {
        const el = getVisibleBgEl();
        if (!el) return;

        const char = getCurrentCharacter();
        if (!char || !char.avatar) {
            // 没有角色或没有头像，恢复原背景
            if (originalBgImage !== null) restoreOriginalBg();
            return;
        }

        // 检测角色是否真的变化了，避免重复设置同一张图
        const avatarKey = String(char.avatar);
        if (!force && avatarKey === lastAvatarKey) return;
        lastAvatarKey = avatarKey;

        // 记录原始背景（只在第一次开启时记录）
        if (originalBgImage === null) {
            originalBgImage = el.style.backgroundImage || getComputedStyle(el).backgroundImage || '';
        }

        const url = `/characters/${encodeURIComponent(char.avatar)}`;
        el.style.backgroundImage = `url("${url}")`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center center';
    }

    function restoreOriginalBg() {
        const el = getVisibleBgEl();
        if (!el) return;
        if (originalBgImage !== null) {
            el.style.backgroundImage = (originalBgImage && originalBgImage !== 'none') ? originalBgImage : '';
        }
        originalBgImage = null;
        lastAvatarKey = '';
    }

    // ---------- 角色切换监听（核心改动） ----------
    function setupCharWatcher() {
        const handler = function () {
            if (followCharAvatar) {
                // 稍作延迟，等 ST 自己渲染完再覆盖
                setTimeout(function () { applyCharBackground(true); }, 300);
            }
        };

        // 方式 1：使用 getContext 的事件系统
        try {
            if (typeof getContext === 'function') {
                const ctx = getContext();
                if (ctx.eventSource && ctx.eventTypes) {
                    const t = ctx.eventTypes;
                    if (t.CHARACTER_SELECTED !== undefined) ctx.eventSource.on(t.CHARACTER_SELECTED, handler);
                    if (t.CHAT_CHANGED !== undefined) ctx.eventSource.on(t.CHAT_CHANGED, handler);
                    return;
                }
            }
        } catch (e) {}

        // 方式 2：回退到全局 eventSource / event_types
        try {
            if (window.eventSource && window.event_types) {
                const t = window.event_types;
                if (t.CHARACTER_SELECTED !== undefined) window.eventSource.on(t.CHARACTER_SELECTED, handler);
                if (t.CHAT_CHANGED !== undefined) window.eventSource.on(t.CHAT_CHANGED, handler);
                return;
            }
        } catch (e) {}

        // 方式 3：兜底轮询（每 1.5 秒检查一次角色是否变化）
        setInterval(function () {
            if (!followCharAvatar) return;
            const char = getCurrentCharacter();
            const key = char && char.avatar ? String(char.avatar) : '';
            if (key && key !== lastAvatarKey) {
                applyCharBackground(true);
            }
        }, 1500);
    }
})();
