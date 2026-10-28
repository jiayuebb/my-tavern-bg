(function () {
    // 等页面基本加载完再创建悬浮球
    setTimeout(init, 2000);

    function init() {
        // 如果已经有了，就不重复创建
        if (document.getElementById('my-bg-ball')) return;

        // ---------- 1. 创建悬浮球 ----------
        const ball = document.createElement('div');
        ball.id = 'my-bg-ball';
        ball.textContent = '🎨';
        document.body.appendChild(ball);

        // ---------- 2. 创建调节面板 ----------
        const panel = document.createElement('div');
        panel.id = 'my-bg-panel';
        panel.innerHTML = `
            <div style="margin-bottom:8px; font-size:13px;">背景调节</div>
            <label style="font-size:12px; display:block; margin-bottom:4px;">模糊</label>
            <input type="range" id="my-bg-blur" min="0" max="30" value="0" step="1" style="width:100%; margin-bottom:12px;">
            <label style="font-size:12px; display:block; margin-bottom:4px;">亮度</label>
            <input type="range" id="my-bg-bright" min="30" max="150" value="100" step="1" style="width:100%;">
        `;
        document.body.appendChild(panel);

        // ---------- 3. 拖动悬浮球（同时区分“拖动”和“点击”） ----------
        let isDragging = false;
        let hasMoved = false;
        let startX, startY, startLeft, startTop;

        ball.addEventListener('pointerdown', function (e) {
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            const rect = ball.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            ball.setPointerCapture(e.pointerId);
        });

        ball.addEventListener('pointermove', function (e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                hasMoved = true;
                ball.style.left = (startLeft + dx) + 'px';
                ball.style.top = (startTop + dy) + 'px';
                ball.style.right = 'auto';
                ball.style.bottom = 'auto';
            }
        });

        ball.addEventListener('pointerup', function (e) {
            isDragging = false;
            ball.releasePointerCapture(e.pointerId);
            // 如果没有明显移动，就当作“点击”，切换面板
            if (!hasMoved) {
                panel.classList.toggle('show');
            }
        });

        // ---------- 4. 滑块事件：调节背景的模糊和亮度 ----------
        // SillyTavern 的背景图层 ID 是 #bg1
        const bg = document.getElementById('bg1');
        if (!bg) {
            console.warn('没找到 #bg1，背景调节可能不生效。请确认 SillyTavern 版本。');
            return;
        }

        document.getElementById('my-bg-blur').addEventListener('input', function (e) {
            const val = e.target.value;
            // 优先用 backdrop-filter（如果 #bg1 是一个覆盖层），否则用 filter
            bg.style.backdropFilter = `blur(${val}px)`;
            bg.style.webkitBackdropFilter = `blur(${val}px)`;
        });

        document.getElementById('my-bg-bright').addEventListener('input', function (e) {
            const val = e.target.value / 100;
            // 亮度用 filter，和上面配合
            bg.style.filter = `brightness(${val})`;
        });
    }
})();
