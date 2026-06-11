// static/js/pages/register.js
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm_password').value;
    const errorDiv = document.getElementById('registerError');
    const submitBtn = this.querySelector('button[type="submit"]');

    errorDiv.className = 'form-alert form-alert-danger';

    if (password !== confirm) {
        errorDiv.textContent = 'Пароли не совпадают';
        errorDiv.style.display = 'block';
        return;
    }

    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Регистрация...';

    const formData = new FormData(this);

    try {
        const response = await fetch('/register', {
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
            submitBtn.textContent = 'Зарегистрироваться';
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } catch (err) {
        errorDiv.textContent = 'Ошибка соединения с сервером';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Зарегистрироваться';
    }
});

const inputs = document.querySelectorAll('#registerForm input');
inputs.forEach(input => {
    input.addEventListener('input', () => {
        const errorDiv = document.getElementById('registerError');
        errorDiv.style.display = 'none';
    });
});