// static/js/pages/choose_action.js
document.getElementById('joinFamilyForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const code = document.getElementById('invite_code').value;
    const errorDiv = document.getElementById('inviteError');
    const submitBtn = this.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;

    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Проверка...';

    const formData = new FormData();
    formData.append('invite_code', code);

    try {
        const response = await fetch('/join-by-code', {
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
            submitBtn.textContent = originalBtnText;
            document.getElementById('invite_code').value = '';
            document.getElementById('invite_code').focus();
        }
    } catch (err) {
        errorDiv.textContent = 'Ошибка соединения с сервером';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});

document.getElementById('invite_code').addEventListener('input', function() {
    const errorDiv = document.getElementById('inviteError');
    errorDiv.style.display = 'none';
});