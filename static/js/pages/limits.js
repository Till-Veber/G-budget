// static/js/pages/limits.js

let currentLimitType = null;
let currentEditCategoryId = null;
let hierarchicalCategories = [];
let isAdmin = false;

function renderHierarchicalOptions(selectElement, selectedId = null) {
    if (!selectElement) return;

    selectElement.innerHTML = '<option value="">Выберите категорию</option>';

    hierarchicalCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.style.color = cat.color;

        let indent = '';
        for (let i = 0; i < cat.level; i++) {
            indent += '&nbsp;&nbsp;&nbsp;&nbsp;';
        }
        if (cat.level > 0) {
            indent += '↳ ';
        }
        option.innerHTML = `${indent}${escapeHtml(cat.name)} (${cat.type})`;

        if (selectedId && selectedId == cat.id) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}

async function loadLimits() {
    try {
        const response = await fetch('/api/limits-full');
        const data = await response.json();

        if (data.success) {
            hierarchicalCategories = data.hierarchical_categories || [];
            isAdmin = data.is_admin;

            const familyCard = document.getElementById('familyLimitsCard');
            if (familyCard) {
                familyCard.style.display = isAdmin ? 'block' : 'none';
            }

            renderPersonalLimits(data.personal_limits);
            if (isAdmin) {
                renderFamilyLimits(data.family_limits);
            }
        } else {
            showFlash('Ошибка загрузки лимитов', 'danger');
        }
    } catch (err) {
        console.error('Error loading limits:', err);
        showFlash('Ошибка соединения', 'danger');
    }
}

function renderPersonalLimits(limits) {
    const tbody = document.getElementById('personalLimitsBody');

    if (!limits || limits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary">Нет личных лимитов</td</tr>';
        return;
    }

    tbody.innerHTML = limits.map(limit => `
        <tr class="${limit.is_exceeded ? 'limit-row-exceeded' : ''}">
            <td>${escapeHtml(limit.category_name)}</td>
            <td>${limit.limit_amount.toFixed(2)} ₽</span></td>
            <td class="${limit.is_exceeded ? 'text-error font-bold' : ''}">
                ${limit.spent.toFixed(2)} ₽
                ${limit.is_exceeded ? `<span class="exceeded-badge-small">+${(limit.spent - limit.limit_amount).toFixed(0)}</span>` : ''}
             </span></td>
            <td>
                <div class="progress" style="width: 100px;">
                    <div class="progress-bar ${limit.percent > 90 ? 'warning' : ''} ${limit.is_exceeded ? 'danger' : ''}" style="width: ${limit.percent}%"></div>
                </div>
                ${limit.is_exceeded ? `<div class="exceeded-warning" style="font-size: 0.65rem; margin-top: 4px;">Превышение на ${(limit.spent - limit.limit_amount).toFixed(0)} ₽</div>` : ''}
             </span>
            <td>
                <button class="delete-txn-btn" onclick="editLimit('personal', ${limit.category_id}, ${limit.limit_amount})" title="Редактировать">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 3l4 4-7 7H10v-4l7-7z"></path>
                        <path d="M4 20h16"></path>
                    </svg>
                </button>
                <button class="delete-txn-btn" onclick="deleteLimit('personal', ${limit.category_id})" title="Удалить лимит">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 7h16"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                        <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"></path>
                        <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"></path>
                    </svg>
                </button>
             </span>
         </span>
    `).join('');
}

function renderFamilyLimits(limits) {
    const tbody = document.getElementById('familyLimitsBody');

    if (!limits || limits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary">Нет семейных лимитов</td>';
        return;
    }

    tbody.innerHTML = limits.map(limit => `
        <tr class="${limit.is_exceeded ? 'limit-row-exceeded' : ''}">
            <td>${escapeHtml(limit.category_name)}</span>
            <td>${limit.limit_amount.toFixed(2)} ₽</span>
            <td class="${limit.is_exceeded ? 'text-error font-bold' : ''}">
                ${limit.spent.toFixed(2)} ₽
                ${limit.is_exceeded ? `<span class="exceeded-badge-small">+${(limit.spent - limit.limit_amount).toFixed(0)}</span>` : ''}
             </span>
            <td>
                <div class="progress" style="width: 100px;">
                    <div class="progress-bar ${limit.percent > 90 ? 'warning' : ''} ${limit.is_exceeded ? 'danger' : ''}" style="width: ${limit.percent}%"></div>
                </div>
                ${limit.is_exceeded ? `<div class="exceeded-warning" style="font-size: 0.65rem; margin-top: 4px;">Превышение на ${(limit.spent - limit.limit_amount).toFixed(0)} ₽</div>` : ''}
             </span>
            <td>
                <button class="delete-txn-btn" onclick="editLimit('family', ${limit.category_id}, ${limit.limit_amount})" title="Редактировать">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 3l4 4-7 7H10v-4l7-7z"></path>
                        <path d="M4 20h16"></path>
                    </svg>
                </button>
                <button class="delete-txn-btn" onclick="deleteLimit('family', ${limit.category_id})" title="Удалить лимит">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 7h16"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                        <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"></path>
                        <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"></path>
                    </svg>
                </button>
             </span>
         </span>
    `).join('');
}

function resetSaveButton() {
    const saveBtn = document.getElementById('saveLimitBtn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить';
    }
}

function openLimitModal(type) {
    currentLimitType = type;
    currentEditCategoryId = null;
    document.getElementById('limitEditTitle').textContent = type === 'personal' ? 'Добавить личный лимит' : 'Добавить семейный лимит';

    const selectElement = document.getElementById('edit_limit_category_id');
    renderHierarchicalOptions(selectElement);

    document.getElementById('edit_limit_amount').value = '';
    document.getElementById('limitEditError').style.display = 'none';
    resetSaveButton();
    document.getElementById('limitEditModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        document.getElementById('edit_limit_amount').focus();
    }, 100);
}

function editLimit(type, categoryId, currentAmount) {
    currentLimitType = type;
    currentEditCategoryId = categoryId;
    document.getElementById('limitEditTitle').textContent = type === 'personal' ? 'Редактировать личный лимит' : 'Редактировать семейный лимит';

    const selectElement = document.getElementById('edit_limit_category_id');
    renderHierarchicalOptions(selectElement, categoryId);

    document.getElementById('edit_limit_amount').value = currentAmount;
    document.getElementById('limitEditError').style.display = 'none';
    resetSaveButton();
    document.getElementById('limitEditModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        document.getElementById('edit_limit_amount').focus();
    }, 100);
}

function closeLimitEditModal() {
    document.getElementById('limitEditModal').classList.remove('active');
    document.body.style.overflow = '';
    currentLimitType = null;
    currentEditCategoryId = null;
    resetSaveButton();
    document.getElementById('limitEditError').style.display = 'none';
}

function closeLimitEditModalOnOverlay(event) {
    if (event.target === event.currentTarget) {
        closeLimitEditModal();
    }
}

async function saveLimitEdit() {
    const categoryId = document.getElementById('edit_limit_category_id').value;
    const amount = document.getElementById('edit_limit_amount').value;
    const errorDiv = document.getElementById('limitEditError');
    const saveBtn = document.getElementById('saveLimitBtn');

    if (!categoryId || !amount) {
        errorDiv.textContent = 'Заполните все поля';
        errorDiv.style.display = 'block';
        return;
    }

    errorDiv.style.display = 'none';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Сохранение...';

    try {
        const response = await fetch('/set-limit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category_id: parseInt(categoryId),
                limit_type: currentLimitType,
                amount: parseFloat(amount)
            })
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Лимит сохранён', 'success');
            closeLimitEditModal();
            await loadLimits();
        } else {
            errorDiv.textContent = data.error || 'Ошибка при сохранении';
            errorDiv.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить';
        }
    } catch (err) {
        errorDiv.textContent = 'Ошибка соединения с сервером';
        errorDiv.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Сохранить';
    }
}

function deleteLimit(type, categoryId) {
    showConfirm(
        'Удалить лимит?',
        'Удаление лимита',
        async function() {
            try {
                const response = await fetch('/delete-limit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        limit_type: type,
                        category_id: categoryId
                    })
                });

                const data = await response.json();

                if (data.success) {
                    showFlash('Лимит удалён', 'success');
                    await loadLimits();
                } else {
                    showFlash('Ошибка: ' + data.error, 'danger');
                }
            } catch (err) {
                showFlash('Ошибка соединения с сервером', 'danger');
            }
        }
    );
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    loadLimits();

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeLimitEditModal();
        }
    });
});