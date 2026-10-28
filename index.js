(function () {
    'use strict';

    const BALL_ID = 'my-bg-ball';
    const PANEL_ID = 'my-bg-panel';
    const AVATAR_LAYER_ID = 'my-bg-avatar-layer';
    const FILTER_STYLE_ID = 'my-bg-filter-style';
    const TRANSPARENT_STYLE_ID = 'my-bg-transparent-style';
    const BODY_FOLLOWING_CLASS = 'my-bg-following';
    const TRANSPARENT_ATTR = 'data-my-bg-opaque';
    const STORAGE_KEY = 'my-bg-settings';
    const LOG = '[my-bg]';

    let blurValue = 0;
    let brightnessValue = 100;
    let followCharAvatar = false;
    let lastAvatarKey = '';
    let filterStyleEl = null;
    let avatarImg = null;
    let candidates = [];
    let candidateIndex = 0;

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
        console.log(LOG, 'initialized');
    }

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
            <div id="my-bg-debug" style="font-size:10px;opacity:.6;margin-top:8px;word-break:break-all;line-height:1.4;"></div>
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

        updateDebug();
    }

    function closePanel() {
        const panel = document.getElementById(PANEL_ID);
        const ball = document.getElementById(BALL_ID);
        if (panel) panel.classList.remove('show');
        if (ball) ball.style.display = 'flex';
    }

    // ---------- 头像图层：放到 body 顶层 ----------
    function createAvatarLayer() {
        let layer = document.getElementById(AVATAR_LAYER_ID);
        if (!layer) {
            layer = document.createElement('div');
            layer.id = AVATAR_LAYER_ID;
            document.body.appendChild(layer);
            console.log(LOG, 'layer appended to body');
        }

        avatarImg = layer.querySelector('img');
        if (!avatarImg) {
            avatarImg = document.createElement('img');
            avatarImg.alt = '';
            avatarImg.decoding = 'async';
            avatarImg.addEventListener('load', function () {
                console.log(LOG, 'avatar loaded:', avatarImg.src);
                updateDebug();
            });
            avatarImg.addEventListener('error', function () {
                console.warn(LOG, 'avatar failed:', avatarImg.src);
                candidateIndex++;
                if (candidateIndex < candidates.length) {
                    console.log(LOG, 'trying fallback:', candidates[candidateIndex]);
                    avatarImg.src = candidates[candidateIndex];
                } else {
                    console.error(LOG, 'all avatar candidates failed');
                }
                updateDebug();
            });
            layer.appendChild(avatarImg);
        }
    }

    function getContextSafe() {
        try {
            if (typeof getContext === 'function') return getContext();
        } catch (e) {}
        try {
            if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
                return window.SillyTavern.getContext();
            }
        } catch (e) {}
        return null;
    }

    function getCurrentCharacter() {
        const ctx = getContextSafe();
        if (ctx && Array.isArray(ctx.characters)) {
            let id = ctx.characterId;
            if (id === undefined || id === null) id = ctx.this_chid;
            if (id !== undefined && id !== null && id !== 'none' && id !== -1 && id !== '') {
                const c = ctx.characters[id];
                if (c && c.avatar) return c;
            }
        }
        try {
            if (window.characters && Array.isArray(window.characters)) {
                const id = window.this_chid;
                if (id !== undefined && id !== null && id !== 'none' && id !== -1 && id !== '') {
                    const c = window.characters[id];
                    if (c && c.avatar) return c;
                }
            }
        } catch (e) {}
        return null;
    }

    function getAvatarUrlsFromDom() {
        const urls = [];
        try {
            const msgs = document.querySelectorAll(
                '#chat .mes[is_user="false"] .avatar img, #chat .mes[is_user="false"] .mesAvatarWrapper img, #chat .mes[is_user="false"] img.avatar'
            );
            for (let i = msgs.length - 1; i >= 0; i--) {
                const src = msgs[i].currentSrc || msgs[i].src;
                if (src && src.startsWith('http')) { urls.push(src); break; }
            }
        } catch (e) {}
        try {
            const sel = document.querySelector(
                '#rm_print_characters_block .character_select.selected img, #rm_print_characters_block .character_select .avatar img'
            );
            if (sel && (sel.currentSrc || sel.src) && (sel.currentSrc || sel.src).startsWith('http')) {
                urls.push(sel.currentSrc || sel.src);
            }
        } catch (e) {}
        try {
            const alt = document.querySelector('#avatar_div img, #rm_button_selected_ch img, #character_avatar img');
            if (alt && (alt.currentSrc || alt.src) && (alt.currentSrc || alt.src).startsWith('http')) {
                urls.push(alt.currentSrc || alt.src);
            }
        } catch (e) {}
        return [...new Set(urls)];
    }

    function resolveCurrentAvatar() {
        const char = getCurrentCharacter();
        if (char && char.avatar) {
            const file = encodeURIComponent(char.avatar);
            const base = document.baseURI;
            const list = [
                new URL('characters/' + file, base).href,
                new URL('thumbnail?type=avatar&file=' + file, base).href,
            ];
            const domUrls = getAvatarUrlsFromDom();
            for (const u of domUrls) if (!list.includes(u)) list.push(u);
            return { key: 'card:' + char.avatar, name: char.name || '当前角色', candidates: list, source: 'card' };
        }
        const domUrls = getAvatarUrlsFromDom();
        if (domUrls.length) {
            return { key: 'dom:' + domUrls[0], name: '当前角色', candidates: domUrls, source: 'dom' };
        }
        return null;
    }

    // ---------- 滤镜 ----------
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
            if (layer) layer.style.setProperty('filter', filterStr, 'important');
            styleEl.textContent = '';
        } else {
            styleEl.textContent = `
                #bg1, #bg_custom, #bg {
                    filter: ${filterStr} !important;
                }
            `;
            if (layer) layer.style.removeProperty('filter');
        }
    }

    // ---------- 扫描并透明化遮挡层 ----------
    function ensureTransparentStyle() {
        let el = document.getElementById(TRANSPARENT_STYLE_ID);
        if (!el) {
            el = document.createElement('style');
            el.id = TRANSPARENT_STYLE_ID;
            document.head.appendChild(el);
        }
        return el;
    }

    function clearOpaqueMarks() {
        document.querySelectorAll('[' + TRANSPARENT_ATTR + ']').forEach(function (el) {
            el.removeAttribute(TRANSPARENT_ATTR);
        });
    }

    function scanAndTransparentize() {
        const styleEl = ensureTransparentStyle();
        const following = document.body.classList.contains(BODY_FOLLOWING_CLASS);

        if (!following) {
            styleEl.textContent = '';
            clearOpaqueMarks();
            return;
        }

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // 收集候选：body 直接子元素、#sheld 及一层子元素、#backgrounds 兄弟
        const targets = new Set();
        const add = function (el) {
            if (!el) return;
            if (el.id === AVATAR_LAYER_ID || el.id === BALL_ID || el.id === PANEL_ID) return;
            if (el.closest && (el.closest('#' + AVATAR_LAYER_ID) || el.closest('#' + BALL_ID) || el.closest('#' + PANEL_ID))) return;
            targets.add(el);
        };

        for (const el of document.body.children) add(el);
        const sheld = document.getElementById('sheld');
        if (sheld) {
            add(sheld);
            for (const el of sheld.children) add(el);
        }
        const chat = document.getElementById('chat');
        if (chat) {
            add(chat);
            for (const el of chat.children) add(el);
        }

        const hit = [];
        for (const el of targets) {
            if (el === document.getElementById(AVATAR_LAYER_ID)) continue;
            const rect = el.getBoundingClientRect();
            // 只处理覆盖视口大范围的元素
            if (rect.width < vw * 0.7 || rect.height < vh * 0.5) continue;
            if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= vw || rect.top >= vh) continue;
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') continue;
            const bg = s.backgroundColor;
            const bgImg = s.backgroundImage;
            const isOpaque = (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') ||
                             (bgImg && bgImg !== 'none');
            if (!isOpaque) continue;
            hit.push(el);
        }

        hit.forEach(function (el) { el.setAttribute(TRANSPARENT_ATTR, '1'); });

        if (hit.length > 0) {
            styleEl.textContent = `[${TRANSPARENT_ATTR}] { background-color: transparent !important; background-image: none !important; }`;
        } else {
            styleEl.textContent = '';
        }

        console.log(LOG, 'transparentized', hit.length, 'layer(s)',
            hit.map(function (el) { return (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ').filter(Boolean)[0] : ''); })
        );
    }

    // ---------- 应用状态 ----------
    function applyState(force) {
        const layer = document.getElementById(AVATAR_LAYER_ID);
        if (!layer || !avatarImg) {
            console.warn(LOG, 'layer/img missing');
            return;
        }

        if (!followCharAvatar) {
            layer.classList.remove('active');
            document.body.classList.remove(BODY_FOLLOWING_CLASS);
            lastAvatarKey = '';
            scanAndTransparentize();
            applyFilter();
            updateDebug();
            return;
        }

        const resolved = resolveCurrentAvatar();
        if (!resolved) {
            layer.classList.remove('active');
            document.body.classList.remove(BODY_FOLLOWING_CLASS);
            lastAvatarKey = '';
            console.warn(LOG, 'resolve failed: no char, no dom avatar');
            scanAndTransparentize();
            applyFilter();
            updateDebug();
            return;
        }

        document.body.classList.add(BODY_FOLLOWING_CLASS);
        layer.classList.add('active');

        if (force || resolved.key !== lastAvatarKey) {
            lastAvatarKey = resolved.key;
            candidates = resolved.candidates;
            candidateIndex = 0;
            console.log(LOG, 'resolve:', resolved.source, resolved.name, candidates);
            avatarImg.src = candidates[0];
        }

        // 头像加载后、透明化遮挡层
        scanAndTransparentize();
        applyFilter();
        updateDebug();
    }

    function updateDebug() {
        const el = document.getElementById('my-bg-debug');
        if (!el) return;
        if (!followCharAvatar) { el.textContent = ''; return; }

        const ctx = getContextSafe();
        const char = getCurrentCharacter();
        const parts = [];

        if (char) {
            parts.push('角色: ' + (char.name || '?'));
        } else if (ctx) {
            parts.push('角色: null (ctx有, chars=' + (Array.isArray(ctx.characters) ? ctx.characters.length : '?') +
                ', id=' + (ctx.characterId !== undefined ? ctx.characterId : ctx.this_chid) + ')');
        } else {
            parts.push('角色: null (ctx无)');
        }

        if (avatarImg && avatarImg.src && avatarImg.naturalWidth > 0) {
            parts.push('头像: ' + decodeURIComponent(avatarImg.src.split('/').pop().split('?')[0]));
        } else if (avatarImg && avatarImg.src) {
            parts.push('头像: 加载中/失败');
        } else {
            parts.push('头像: 无');
        }

        const domCount = getAvatarUrlsFromDom().length;
        parts.push('DOM候选: ' + domCount);
        parts.push('透明化: ' + document.querySelectorAll('[' + TRANSPARENT_ATTR + ']').length + ' 层');

        el.textContent = parts.join(' | ');
    }

    // ---------- 角色切换监听 ----------
    function setupCharWatcher() {
        const handler = function () {
            setTimeout(function () { applyState(true); }, 300);
        };

        try {
            if (typeof getContext === 'function') {
                const ctx = getContext();
                if (ctx.eventSource && ctx.eventTypes) {
                    const t = ctx.eventTypes;
                    if (t.CHARACTER_SELECTED !== undefined) ctx.eventSource.on(t.CHARACTER_SELECTED, handler);
                    if (t.CHAT_CHANGED !== undefined) ctx.eventSource.on(t.CHAT_CHANGED, handler);
                    console.log(LOG, 'event listener attached via getContext');
                    return;
                }
            }
        } catch (e) {}

        try {
            if (window.eventSource && window.event_types) {
                const t = window.event_types;
                if (t.CHARACTER_SELECTED !== undefined) window.eventSource.on(t.CHARACTER_SELECTED, handler);
                if (t.CHAT_CHANGED !== undefined) window.eventSource.on(t.CHAT_CHANGED, handler);
                console.log(LOG, 'event listener attached via window');
                return;
            }
        } catch (e) {}

        console.log(LOG, 'no event source, using polling');
        setInterval(function () {
            if (followCharAvatar) applyState(false);
        }, 1500);
    }

    function setupResizeGuard() {
        let t = null;
        window.addEventListener('resize', function () {
            clearTimeout(t);
            t = setTimeout(function () {
                applyFilter();
                scanAndTransparentize();
                updateDebug();
            }, 200);
        });
    }
})();
