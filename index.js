(function () {
    'use strict';

    const BALL_ID = 'my-bg-ball';
    const PANEL_ID = 'my-bg-panel';
    const AVATAR_LAYER_ID = 'my-bg-avatar-layer';
    const FILTER_STYLE_ID = 'my-bg-filter-style';
    const BODY_FOLLOWING_CLASS = 'my-bg-following';
    const STORAGE_KEY = 'my-bg-settings';

    let blurValue = 0;
    let brightnessValue = 100;
    let followCharAvatar = false;
    let lastAvatarKey = '';
    let filterStyleEl = null;

    setTimeout(init, 2000);

    function init() {
        if (document.getElementById(BALL_ID)) return;
        loadSettings();
        createBall();
        createPanel();
        createAvatarLayer();
        setupCharWatcher();
        applyState(true);
        setupResizeGuard();
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

        document.getElementById('my-bg-close').addEventListener('click', closePanel);

        document.getElementById('my-bg-blur').addEventListener('input', function (e) {
            blurValue = Number(e.target.value);
            applyFilter();
            saveSettings();
        });

        document.getElementById('my-bg-bright').addEventListener('input', function (e) {
            brightnessValue = Number(e.target.value);
            applyFilter();
            saveSettings();
        });

        document.getElementById('my-bg-follow').addEventListener('change', function (e) {
            followCharAvatar = e.target.checked;
            applyState(true);
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

    function closePanel() {
        const panel = document.getElementById(PANEL_ID);
        const ball = document.getElementById(BALL_ID);
        if (panel) panel.classList.remove('show');
        if (ball) ball.style.display = 'flex';
    }

    // ---------- 头像图层 ----------
    function createAvatarLayer() {
        if (document.getElementById(AVATAR_LAYER_ID)) return;
        const layer = document.createElement('div');
        layer.id = AVATAR_LAYER_ID;
        document.body.appendChild(layer);
    }

    // ---------- 原生背景元素 ----------
    function getNativeBgEls() {
        const ids = ['bg1', 'bg_custom', 'bg'];
        const els = [];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el && !els.includes(el)) els.push(el);
        }
        return els;
    }

    // ---------- 滤镜样式（用 style 标签 + !important，防止被 ST 重设） ----------
    function ensureFilterStyle() {
        if (filterStyleEl && filterStyleEl.isConnected) return filterStyleEl;
        filterStyleEl = document.getElementById(FILTER_STYLE_ID);
        if (!filterStyleEl) {
            filterStyleEl = document.createElement('style');
            filterStyleEl.id = FILTER_STYLE_ID;
            document.head.appendChild(filterStyleEl);
        }
        return filterStyleEl;
    }

    function applyFilter() {
        const isFollowing = document.body.classList.contains(BODY_FOLLOWING_CLASS);
        const filterStr = `blur(${blurValue}px) brightness(${brightnessValue / 100})`;
        const styleEl = ensureFilterStyle();
        const layer = document.getElementById(AVATAR_LAYER_ID);

        if (isFollowing) {
            // 跟随头像时：滤镜作用在我们自己的图层上
            if (layer) {
                layer.style.setProperty('filter', filterStr, 'important');
            }
            styleEl.textContent = '';
        } else {
            // 普通模式：滤镜作用在原生背景上（用 CSS 规则，元素被替换也能自动生效）
            styleEl.textContent = `
                #bg1, #bg_custom, #bg {
                    filter: ${filterStr} !important;
                }
            `;
            if (layer) {
                layer.style.removeProperty('filter');
            }
        }
    }

    // ---------- 当前角色与头像 ----------
    function getCurrentCharacter() {
        try {
            if (typeof getContext === 'function') {
                const ctx = getContext();
                if (ctx.characters && ctx.this_chid !== undefined && ctx.this_chid !== null && ctx.this_chid !== 'none') {
                    return ctx.characters[ctx.this_chid];
                }
            }
            if (window.characters && window.this_chid !== undefined && window.this_chid !== null && window.this_chid !== 'none') {
                return window.characters[window.this_chid];
            }
        } catch (e) {}
        return null;
    }

    function getAvatarUrl(char) {
        if (!char || !char.avatar) return '';
        return `/characters/${encodeURIComponent(char.avatar)}`;
    }

    // ---------- 应用整体状态 ----------
    function applyState(force) {
        const layer = document.getElementById(AVATAR_LAYER_ID);
        if (!layer) return;

        const char = getCurrentCharacter();
        const hasChar = !!(char && char.avatar);
        const shouldFollow = followCharAvatar && hasChar;

        if (shouldFollow) {
            const avatarKey = String(char.avatar);
            if (force || avatarKey !== lastAvatarKey) {
                lastAvatarKey = avatarKey;
                layer.style.backgroundImage = `url("${getAvatarUrl(char)}")`;
            }
            layer.classList.add('active');
            document.body.classList.add(BODY_FOLLOWING_CLASS);
        } else {
            layer.classList.remove('active');
            layer.style.removeProperty('background-image');
            document.body.classList.remove(BODY_FOLLOWING_CLASS);
            lastAvatarKey = '';
        }

        applyFilter();
    }

    // ---------- 角色切换监听 ----------
    function setupCharWatcher() {
        const handler = function () {
            // 等 ST 自己渲染完再覆盖
            setTimeout(function () {
                applyState(true);
            }, 300);
        };

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

        try {
            if (window.eventSource && window.event_types) {
                const t = window.event_types;
                if (t.CHARACTER_SELECTED !== undefined) window.eventSource.on(t.CHARACTER_SELECTED, handler);
                if (t.CHAT_CHANGED !== undefined) window.eventSource.on(t.CHAT_CHANGED, handler);
                return;
            }
        } catch (e) {}

        // 兜底轮询：每 1.5 秒检查一次角色/跟随状态
        setInterval(function () {
            if (followCharAvatar) applyState(false);
        }, 1500);
    }

    // ---------- 窗口大小变化时，重新应用（防止某些主题重算背景） ----------
    function setupResizeGuard() {
        let t = null;
        window.addEventListener('resize', function () {
            clearTimeout(t);
            t = setTimeout(function () {
                applyFilter();
            }, 200);
        });
    }
})();
