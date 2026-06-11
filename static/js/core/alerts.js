// static/js/core/alerts.js
(function() {
    // Global Flash Function
    window.showFlash = function(message, category = 'success') {
        let container = document.querySelector('.alerts-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'alerts-container';
            container.style.position = 'fixed';
            container.style.top = '20px';
            container.style.right = '20px';
            container.style.zIndex = '10000';
            document.body.appendChild(container);
        }

        const alert = document.createElement('div');
        alert.className = `alert alert-${category}`;
        let prefix = '';
        if (category === 'success') prefix = 'Успешно! ';
        else if (category === 'danger') prefix = 'Ошибка! ';
        else if (category === 'warning') prefix = 'Внимание! ';
        alert.innerHTML = `<strong>${prefix}</strong>${message}`;

        container.appendChild(alert);

        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateX(100%)';
            setTimeout(() => alert.remove(), 400);
        }, 3000);
    };

    // Auto-close alerts on click
    document.addEventListener('click', (e) => {
        if (e.target.closest('.alert')) {
            const alert = e.target.closest('.alert');
            alert.style.opacity = '0';
            alert.style.transform = 'translateX(100%)';
            setTimeout(() => alert.remove(), 400);
        }
    });
})();