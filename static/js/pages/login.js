// static/js/pages/login.js
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const errorDiv = document.getElementById('loginError');
    const submitBtn = this.querySelector('button[type="submit"]');

    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Вход...';

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            window.location.href = data.redirect;
        } else {
            errorDiv.textContent = data.error;
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Войти';
        }
    } catch (err) {
        errorDiv.textContent = 'Ошибка соединения с сервером';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
    }
});