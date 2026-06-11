// static/js/core/particles.js
(function() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;

    let ctx = canvas.getContext('2d');
    let particlesArray = [];
    let animationId = null;
    let isActive = true;
    let isPageVisible = true;
    const mouse = { x: null, y: null, radius: 150 };

    // ==================== ОПРЕДЕЛЕНИЕ ПРОИЗВОДИТЕЛЬНОСТИ ====================
    let maxParticles = 250; // стандартное значение

    function detectAndSetMaxParticles() {
        let performanceScore = 0;

        // 1. Проверка на мобильные устройства
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);

        // 2. Количество логических ядер
        const cpuCores = navigator.hardwareConcurrency || 2;

        // 3. Память устройства (если доступна)
        let deviceMemory = 4;
        if ('deviceMemory' in navigator) {
            deviceMemory = navigator.deviceMemory;
        }

        // 4. Проверка на reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // 5. Проверка на слабую видеокарту через WebGL
        let isGPUWeak = false;
        try {
            const canvas_test = document.createElement('canvas');
            const gl = canvas_test.getContext('webgl') || canvas_test.getContext('experimental-webgl');
            if (gl) {
                const renderer = gl.getParameter(gl.RENDERER);
                const weakGPUs = /Intel|SWR|llvmpipe|Microsoft Basic|VirtualBox|VMware/i;
                if (weakGPUs.test(renderer)) {
                    isGPUWeak = true;
                }
            }
        } catch(e) {}

        // Расчёт скор производительности
        if (cpuCores >= 8) performanceScore += 40;
        else if (cpuCores >= 4) performanceScore += 25;
        else if (cpuCores >= 2) performanceScore += 15;
        else performanceScore += 8;

        if (deviceMemory >= 8) performanceScore += 30;
        else if (deviceMemory >= 4) performanceScore += 20;
        else if (deviceMemory >= 2) performanceScore += 10;
        else performanceScore += 5;

        if (isMobile) performanceScore -= 30;
        if (isTablet && !isMobile) performanceScore -= 15;
        if (isGPUWeak) performanceScore -= 25;
        if (prefersReducedMotion) performanceScore = 0;

        // Определение максимального количества частиц
        const rect = canvas.getBoundingClientRect();
        const areaFactor = Math.min(1, (rect.width * rect.height) / (1920 * 1080));

        if (prefersReducedMotion) {
            maxParticles = 0;
        } else if (performanceScore <= 15) {
            maxParticles = 30;
        } else if (performanceScore <= 30) {
            maxParticles = 60;
        } else if (performanceScore <= 50) {
            maxParticles = 120;
        } else if (performanceScore <= 70) {
            maxParticles = 180;
        } else {
            maxParticles = 250;
        }

        // Корректировка с учётом размера экрана
        maxParticles = Math.min(maxParticles, Math.floor((rect.width * rect.height) / 4000));

        console.log(`[Particles] Performance score: ${performanceScore}, Max particles: ${maxParticles}`);

        // В минимальном режиме отключаем анимацию совсем
        if (maxParticles === 0) {
            isActive = false;
            if (canvas) canvas.style.display = 'none';
        } else {
            isActive = true;
            if (canvas) canvas.style.display = 'block';
        }
    }

    // Быстрый бенчмарк для уточнения
    function runQuickBenchmark(callback) {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 400;
        testCanvas.height = 400;
        const testCtx = testCanvas.getContext('2d');

        let frames = 0;
        const startTime = performance.now();

        function testFrame() {
            for (let i = 0; i < 200; i++) {
                testCtx.beginPath();
                testCtx.arc(Math.random() * 400, Math.random() * 400, Math.random() * 3 + 1, 0, Math.PI * 2);
                testCtx.fillStyle = `rgba(255,255,255,${Math.random()})`;
                testCtx.fill();
            }
            frames++;

            const elapsed = performance.now() - startTime;
            if (elapsed < 150) {
                requestAnimationFrame(testFrame);
            } else {
                const fps = (frames * 1000) / elapsed;

                if (fps < 30 && maxParticles > 60) {
                    maxParticles = 60;
                    console.log(`[Particles] Benchmark FPS: ${fps.toFixed(1)}, reducing to ${maxParticles} particles`);
                } else if (fps < 45 && maxParticles > 120) {
                    maxParticles = 120;
                    console.log(`[Particles] Benchmark FPS: ${fps.toFixed(1)}, reducing to ${maxParticles} particles`);
                } else if (fps < 55 && maxParticles > 180) {
                    maxParticles = 180;
                    console.log(`[Particles] Benchmark FPS: ${fps.toFixed(1)}, reducing to ${maxParticles} particles`);
                }

                if (callback) callback();
            }
        }

        requestAnimationFrame(testFrame);
    }

    // Следим за зарядом батареи
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            const handleBatteryChange = () => {
                if (battery.charging === false && battery.level < 0.15 && maxParticles > 60) {
                    maxParticles = 60;
                    console.log('[Particles] Battery low, reducing particles');
                    reinitParticles();
                }
            };
            battery.addEventListener('levelchange', handleBatteryChange);
        }).catch(() => {});
    }

    // Следим за настройками reduced motion
    const motionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionMediaQuery.addEventListener('change', (e) => {
        if (e.matches) {
            maxParticles = 0;
            isActive = false;
            canvas.style.display = 'none';
        } else {
            detectAndSetMaxParticles();
            isActive = true;
            canvas.style.display = 'block';
            reinitParticles();
        }
    });

    function stopAnimation() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    function startAnimation() {
        if (!isActive || !isPageVisible) return;
        if (animationId) stopAnimation();
        ctx = canvas.getContext('2d');
        if (!ctx) return;
        animate();
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        if (ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
        }
        init();
    }

    function getMousePos(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left),
            y: (event.clientY - rect.top)
        };
    }

    window.addEventListener('mousemove', (event) => {
        const pos = getMousePos(event);
        mouse.x = pos.x;
        mouse.y = pos.y;
    });

    class Particle {
        constructor(x, y, directionX, directionY, size, color) {
            this.x = x;
            this.y = y;
            this.directionX = directionX;
            this.directionY = directionY;
            this.size = size;
            this.color = color;
        }
        draw() {
            if (!ctx) return;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        update() {
            const rect = canvas.getBoundingClientRect();
            if (this.x > rect.width || this.x < 0) this.directionX = -this.directionX;
            if (this.y > rect.height || this.y < 0) this.directionY = -this.directionY;
            this.x += this.directionX;
            this.y += this.directionY;
            this.draw();
        }
    }

    function init() {
        particlesArray = [];
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        let numberOfParticles = Math.min(maxParticles, (rect.width * rect.height) / 3000);
        numberOfParticles = Math.max(0, numberOfParticles);

        for (let i = 0; i < numberOfParticles; i++) {
            let size = (Math.random() * 2) + 1;
            let x = (Math.random() * ((rect.width - size * 2) - (size * 2)) + size * 2);
            let y = (Math.random() * ((rect.height - size * 2) - (size * 2)) + size * 2);
            let directionX = (Math.random() * 1.8) - 0.9;
            let directionY = (Math.random() * 1.8) - 0.9;
            particlesArray.push(new Particle(x, y, directionX, directionY, size, '#ffffff'));
        }
    }

    function connect() {
        if (!ctx) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        for (let a = 0; a < particlesArray.length; a++) {
            for (let b = a; b < particlesArray.length; b++) {
                let distance = ((particlesArray[a].x - particlesArray[b].x) * (particlesArray[a].x - particlesArray[b].x)) +
                               ((particlesArray[a].y - particlesArray[b].y) * (particlesArray[a].y - particlesArray[b].y));
                if (distance < (rect.width / 7) * (rect.height / 7)) {
                    let opacityValue = 1 - (distance / 20000);
                    ctx.strokeStyle = 'rgba(255, 255, 255,' + opacityValue * 0.1 + ')';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
                    ctx.stroke();
                }
            }
            if (mouse.x != null && rect.width > 0 && rect.height > 0) {
                let mouseDistance = ((particlesArray[a].x - mouse.x) * (particlesArray[a].x - mouse.x)) +
                                    ((particlesArray[a].y - mouse.y) * (particlesArray[a].y - mouse.y));
                if (mouseDistance < 20000) {
                    ctx.strokeStyle = 'rgba(255, 122, 0,' + (1 - mouseDistance/20000) + ')';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        if (!isActive || !isPageVisible) return;
        if (!ctx) {
            startAnimation();
            return;
        }

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            animationId = requestAnimationFrame(animate);
            return;
        }

        try {
            ctx.clearRect(0, 0, rect.width, rect.height);
            for (let i = 0; i < particlesArray.length; i++) particlesArray[i].update();
            connect();
            animationId = requestAnimationFrame(animate);
        } catch (e) {
            startAnimation();
        }
    }

    function reinitParticles() {
        if (!isActive || !isPageVisible) return;
        stopAnimation();
        init();
        startAnimation();
    }

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            detectAndSetMaxParticles();
            resizeCanvas();
        }, 100);
    });

    window.addEventListener('mouseout', () => { mouse.x = undefined; mouse.y = undefined; });
    document.addEventListener('visibilitychange', () => {
        isPageVisible = !document.hidden;
        if (isPageVisible && isActive) {
            resizeCanvas();
            startAnimation();
        } else if (!isPageVisible) {
            stopAnimation();
        }
    });
    window.addEventListener('pageshow', () => {
        setTimeout(() => {
            if (isActive) {
                stopAnimation();
                ctx = canvas.getContext('2d');
                if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
                resizeCanvas();
                startAnimation();
            }
        }, 30);
    });
    window.addEventListener('popstate', () => {
        setTimeout(() => {
            if (isActive) {
                stopAnimation();
                ctx = canvas.getContext('2d');
                if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
                resizeCanvas();
                startAnimation();
            }
        }, 50);
    });
    window.addEventListener('beforeunload', () => stopAnimation());

    // Запуск с определением производительности
    detectAndSetMaxParticles();
    runQuickBenchmark(() => {
        resizeCanvas();
        startAnimation();
    });
})();