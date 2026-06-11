// static/js/core/flash-messages.js

(function() {
    // Функция для получения flash-сообщений от сервера
    function initFlashMessages() {
        const flashMessagesElement = document.getElementById('flash-messages-data');
        if (!flashMessagesElement) return;

        try {
            const messages = JSON.parse(flashMessagesElement.dataset.messages || '[]');

            messages.forEach(function(msg) {
                let category = msg.category;
                if (category === 'danger' || category === 'error') {
                    category = 'danger';
                } else if (category === 'warning') {
                    category = 'warning';
                } else if (category === 'success') {
                    category = 'success';
                } else {
                    category = 'info';
                }

                setTimeout(function() {
                    if (typeof showFlash !== 'undefined') {
                        showFlash(msg.message, category);
                    }
                }, 100);
            });
        } catch (e) {
            console.error('Error parsing flash messages:', e);
        }
    }

    // Запускаем после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFlashMessages);
    } else {
        initFlashMessages();
    }
})();