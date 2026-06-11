// static/js/core/alerts.js

(function() {
    // Global Flash Function with auto-dismiss and close button
    window.showFlash = function(message, category = 'success', duration = 5000) {
        let container = document.querySelector('.alerts-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'alerts-container';
            document.body.appendChild(container);
        }

        const alert = document.createElement('div');
        alert.className = `alert alert-${category}`;

        // Создаём содержимое с крестиком
        alert.innerHTML = `
            <div class="alert-content">
                <strong>${getPrefix(category)}</strong>${message}
            </div>
            <button class="alert-close" onclick="this.closest('.alert').remove()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18"></path>
                    <path d="M6 6l12 12"></path>
                </svg>
            </button>
        `;

        container.appendChild(alert);

        // Активируем анимацию появления
        setTimeout(() => {
            alert.classList.add('show');
        }, 10);

        // Автоматическое удаление через duration мс
        let timeoutId = setTimeout(() => {
            dismissAlert(alert);
        }, duration);

        // При наведении на уведомление - отменяем авто-закрытие
        alert.addEventListener('mouseenter', () => {
            clearTimeout(timeoutId);
        });

        // При уходе мыши - возобновляем таймер
        alert.addEventListener('mouseleave', () => {
            timeoutId = setTimeout(() => {
                dismissAlert(alert);
            }, duration);
        });

        // Кнопка закрытия уже есть в HTML, она вызовет remove()
    };

    function getPrefix(category) {
        switch(category) {
            case 'success': return 'Успешно! ';
            case 'danger': return 'Ошибка! ';
            case 'warning': return 'Внимание! ';
            default: return '';
        }
    }

    function dismissAlert(alert) {
        if (!alert || !alert.parentNode) return;

        alert.classList.remove('show');
        alert.classList.add('hide');

        // Удаляем после завершения анимации
        setTimeout(() => {
            if (alert && alert.parentNode) {
                alert.remove();
            }
        }, 400);
    }

    window.clearAllAlerts = function() {
        const container = document.querySelector('.alerts-container');
        if (container) {
            const alerts = container.querySelectorAll('.alert');
            alerts.forEach(alert => dismissAlert(alert));
        }
    };

    window.addEventListener('beforeunload', () => {
        clearAllAlerts();
    });
})();