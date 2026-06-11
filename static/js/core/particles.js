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

        let numberOfParticles = Math.min(250, (rect.width * rect.height) / 3000);
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

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
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

    resizeCanvas();
    startAnimation();
})();