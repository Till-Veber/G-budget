// static/js/pages/transactions.js

let editingTransactionId = null;
let categoriesData = [];
let usersData = [];
let hierarchicalCategories = [];
let currentPage = 1;
let totalPages = 1;

let currentFilters = {
    type: '',
    category_ids: [],
    user_ids: [],
    date_from: '',
    date_to: '',
    amount_from: '',
    amount_to: '',
    comment_search: '',
    sort_by: 'date',
    sort_order: 'desc'
};

// Инициализация даты и времени
function initDateTime() {
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');

    if (dateInput && !dateInput.value) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }

    if (timeInput && !timeInput.value) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeInput.value = `${hours}:${minutes}`;
    }
}

function changeAmount(delta) {
    const input = document.getElementById('amount');
    let currentVal = parseFloat(input.value) || 0;
    let newVal = currentVal + delta;
    if (newVal < 0) newVal = 0;
    input.value = newVal.toFixed(2);
    input.style.borderColor = 'var(--accent-primary)';
    setTimeout(() => { input.style.borderColor = ''; }, 300);
}

function toggleCategoriesDropdown() {
    const dropdown = document.getElementById('categoriesDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function toggleUsersDropdown() {
    const dropdown = document.getElementById('usersDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function renderHierarchicalCategories(container, categories, level = 0, selectedIds = []) {
    categories.forEach(cat => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'multiselect-option';
        optionDiv.style.paddingLeft = `${20 + level * 20}px`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = cat.id;
        checkbox.id = `cat_${cat.id}`;
        checkbox.checked = selectedIds.includes(cat.id);
        checkbox.addEventListener('change', () => updateCategorySelection());

        const label = document.createElement('label');
        label.htmlFor = `cat_${cat.id}`;
        label.style.color = cat.color;
        label.textContent = cat.name;

        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(label);
        container.appendChild(optionDiv);

        if (cat.children && cat.children.length) {
            renderHierarchicalCategories(container, cat.children, level + 1, selectedIds);
        }
    });
}

function renderUsersList(users, selectedIds = []) {
    const container = document.getElementById('usersOptions');
    container.innerHTML = '';

    users.forEach(user => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'multiselect-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = user.id;
        checkbox.id = `user_${user.id}`;
        checkbox.checked = selectedIds.includes(user.id);
        checkbox.addEventListener('change', () => updateUserSelection());

        const label = document.createElement('label');
        label.htmlFor = `user_${user.id}`;
        label.textContent = user.name;

        optionDiv.appendChild(checkbox);
        optionDiv.appendChild(label);
        container.appendChild(optionDiv);
    });
}

function updateCategorySelection() {
    const checkboxes = document.querySelectorAll('#categoriesOptions input[type="checkbox"]');
    currentFilters.category_ids = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));

    const selectedCount = currentFilters.category_ids.length;
    const placeholder = document.querySelector('#categoriesMultiselect .multiselect-placeholder');
    if (selectedCount === 0) {
        placeholder.textContent = 'Выберите категории';
    } else if (selectedCount === 1) {
        let selectedName = '';
        function findName(node) {
            if (node.id === currentFilters.category_ids[0]) selectedName = node.name;
            if (node.children) node.children.forEach(findName);
        }
        hierarchicalCategories.forEach(findName);
        placeholder.textContent = selectedName || `1 категория`;
    } else {
        placeholder.textContent = `Выбрано: ${selectedCount}`;
    }
}

function updateUserSelection() {
    const checkboxes = document.querySelectorAll('#usersOptions input[type="checkbox"]');
    currentFilters.user_ids = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));

    const selectedCount = currentFilters.user_ids.length;
    const placeholder = document.querySelector('#usersMultiselect .multiselect-placeholder');
    if (selectedCount === 0) {
        placeholder.textContent = 'Выберите пользователей';
    } else if (selectedCount === 1) {
        const selectedUser = usersData.find(u => u.id === currentFilters.user_ids[0]);
        placeholder.textContent = selectedUser ? selectedUser.name : `1 пользователь`;
    } else {
        placeholder.textContent = `Выбрано: ${selectedCount}`;
    }
}

function searchCategories() {
    const searchTerm = document.getElementById('categorySearch').value.toLowerCase();
    const options = document.querySelectorAll('#categoriesOptions .multiselect-option');
    options.forEach(option => {
        const label = option.querySelector('label');
        if (label && label.textContent.toLowerCase().includes(searchTerm)) {
            option.style.display = 'flex';
        } else {
            option.style.display = 'none';
        }
    });
}

function searchUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const options = document.querySelectorAll('#usersOptions .multiselect-option');
    options.forEach(option => {
        const label = option.querySelector('label');
        if (label && label.textContent.toLowerCase().includes(searchTerm)) {
            option.style.display = 'flex';
        } else {
            option.style.display = 'none';
        }
    });
}

async function loadCategoriesAndUsers() {
    try {
        const catResponse = await fetch('/api/categories-tree');
        const catData = await catResponse.json();
        if (catData.success) {
            hierarchicalCategories = catData.tree;
            const container = document.getElementById('categoriesOptions');
            container.innerHTML = '';
            renderHierarchicalCategories(container, hierarchicalCategories, 0, currentFilters.category_ids);
            document.getElementById('categorySearch').addEventListener('input', searchCategories);
        }

        const familyResponse = await fetch('/api/family-data');
        const familyData = await familyResponse.json();
        if (familyData.success) {
            usersData = familyData.members.map(m => ({
                id: m.id,
                name: m.full_name
            }));
            renderUsersList(usersData, currentFilters.user_ids);
            document.getElementById('userSearch').addEventListener('input', searchUsers);
        }
    } catch (err) {
        console.error('Error loading categories/users:', err);
    }
}

async function loadTransactions(page = 1) {
    const tbody = document.getElementById('transactionsTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">Загрузка...</td</tr>';

    currentPage = page;

    const params = new URLSearchParams();
    params.append('page', page);
    params.append('per_page', 50);

    if (currentFilters.type) params.append('type', currentFilters.type);
    if (currentFilters.category_ids.length) params.append('category_ids', currentFilters.category_ids.join(','));
    if (currentFilters.user_ids.length) params.append('user_ids', currentFilters.user_ids.join(','));
    if (currentFilters.date_from) params.append('date_from', currentFilters.date_from);
    if (currentFilters.date_to) params.append('date_to', currentFilters.date_to);
    if (currentFilters.amount_from) params.append('amount_from', currentFilters.amount_from);
    if (currentFilters.amount_to) params.append('amount_to', currentFilters.amount_to);
    if (currentFilters.comment_search) params.append('comment_search', currentFilters.comment_search);
    params.append('sort_by', currentFilters.sort_by);
    params.append('sort_order', currentFilters.sort_order);

    try {
        const response = await fetch(`/api/transactions?${params.toString()}`);
        const data = await response.json();

        if (data.success && data.transactions) {
            categoriesData = data.categories;

            if (data.transactions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">Нет транзакций</td</tr>';
                document.getElementById('paginationContainer').style.display = 'none';
                return;
            }

            const pagination = data.pagination;
            totalPages = pagination.pages;
            updatePaginationUI(pagination);

            tbody.innerHTML = data.transactions.map(txn => `
                <tr data-id="${txn.id}">
                    <td class="date-cell">${txn.date}</td>
                    <td class="time-cell">${txn.time}</td>
                    <td>${escapeHtml(txn.author)}</td>
                    <td style="color: ${txn.category_color}; font-weight: 500;">${escapeHtml(txn.category_name)}</td>
                    <td style="color: ${txn.category_type === 'Расход' ? 'var(--error)' : 'var(--success)'}; font-weight: 600;">
                        ${txn.category_type === 'Расход' ? '-' : '+'} ${txn.amount.toFixed(2)}
                    </td>
                    <td>${escapeHtml(txn.comment)}</td>
                    <td class="actions-cell">
                        <button class="edit-txn-btn" onclick="editTransaction(${txn.id})" title="Редактировать">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 3l4 4-7 7H10v-4l7-7z"></path>
                                <path d="M4 20h16"></path>
                            </svg>
                        </button>
                        <button class="delete-txn-btn" onclick="deleteTransaction(${txn.id})" title="Удалить">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 7h16"></path>
                                <path d="M10 11v6"></path>
                                <path d="M14 11v6"></path>
                                <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"></path>
                                <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">Ошибка загрузки данных</td</tr>';
            document.getElementById('paginationContainer').style.display = 'none';
        }
    } catch (err) {
        console.error('Error loading transactions:', err);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-secondary">Ошибка соединения</td</tr>';
        document.getElementById('paginationContainer').style.display = 'none';
    }
}

function updatePaginationUI(pagination) {
    const container = document.getElementById('paginationContainer');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const infoSpan = document.getElementById('paginationInfo');

    container.style.display = 'flex';
    infoSpan.textContent = `Страница ${pagination.page} из ${pagination.pages} (всего ${pagination.total} записей)`;

    prevBtn.disabled = !pagination.has_prev;
    prevBtn.onclick = () => { if (pagination.has_prev) loadTransactions(currentPage - 1); };

    nextBtn.disabled = !pagination.has_next;
    nextBtn.onclick = () => { if (pagination.has_next) loadTransactions(currentPage + 1); };
}

function applyFilters() {
    currentFilters.type = document.getElementById('filterType').value;
    currentFilters.date_from = document.getElementById('dateFrom').value;
    currentFilters.date_to = document.getElementById('dateTo').value;
    currentFilters.amount_from = document.getElementById('amountFrom').value;
    currentFilters.amount_to = document.getElementById('amountTo').value;
    currentFilters.comment_search = document.getElementById('commentSearch').value;
    currentFilters.sort_by = document.getElementById('sortBy').value;
    currentFilters.sort_order = document.getElementById('sortOrder').value;

    loadTransactions(1);
    document.getElementById('categoriesDropdown').style.display = 'none';
    document.getElementById('usersDropdown').style.display = 'none';
}

function resetFilters() {
    document.getElementById('filterType').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    document.getElementById('amountFrom').value = '';
    document.getElementById('amountTo').value = '';
    document.getElementById('commentSearch').value = '';
    document.getElementById('sortBy').value = 'date';
    document.getElementById('sortOrder').value = 'desc';

    document.querySelectorAll('#categoriesOptions input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('#usersOptions input[type="checkbox"]').forEach(cb => cb.checked = false);

    currentFilters = {
        type: '',
        category_ids: [],
        user_ids: [],
        date_from: '',
        date_to: '',
        amount_from: '',
        amount_to: '',
        comment_search: '',
        sort_by: 'date',
        sort_order: 'desc'
    };

    updateCategorySelection();
    updateUserSelection();
    loadTransactions(1);

    document.getElementById('categoriesDropdown').style.display = 'none';
    document.getElementById('usersDropdown').style.display = 'none';
}

function exportCSV() {
    const params = new URLSearchParams();

    if (currentFilters.type) params.append('type', currentFilters.type);
    if (currentFilters.category_ids.length) params.append('category_ids', currentFilters.category_ids.join(','));
    if (currentFilters.user_ids.length) params.append('user_ids', currentFilters.user_ids.join(','));
    if (currentFilters.date_from) params.append('date_from', currentFilters.date_from);
    if (currentFilters.date_to) params.append('date_to', currentFilters.date_to);
    if (currentFilters.amount_from) params.append('amount_from', currentFilters.amount_from);
    if (currentFilters.amount_to) params.append('amount_to', currentFilters.amount_to);
    if (currentFilters.comment_search) params.append('comment_search', currentFilters.comment_search);
    params.append('sort_by', currentFilters.sort_by);
    params.append('sort_order', currentFilters.sort_order);

    const url = `/api/transactions-export?${params.toString()}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
        const canvas = document.getElementById('particles-canvas');
        if (canvas) {
            const event = new Event('resize');
            window.dispatchEvent(event);
        }
    }, 100);
}

function updateCategoriesSelect(selectedId = null) {
    const select = document.getElementById('edit_category_id');
    if (!select) return;
    select.innerHTML = '<option value="">Выберите категорию</option>';
    categoriesData.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = `${cat.name} (${cat.type})`;
        option.style.color = cat.color;
        if (selectedId && selectedId == cat.id) option.selected = true;
        select.appendChild(option);
    });
}

function editTransaction(id) {
    editingTransactionId = id;
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    const categoryId = (() => {
        const categoryCell = row.cells[3];
        const found = categoriesData.find(c => c.name === categoryCell.innerText);
        return found ? found.id : null;
    })();

    const amountText = row.cells[4].innerText;
    const amount = amountText.replace(/[+-]/g, '').trim();
    const date = row.cells[0].innerText.split('.').reverse().join('-');
    const time = row.cells[1].innerText;
    const comment = row.cells[5].innerText;

    updateCategoriesSelect(categoryId);
    document.getElementById('edit_amount').value = amount;
    document.getElementById('edit_date').value = date;
    document.getElementById('edit_time').value = time !== '—' ? time : '12:00';
    document.getElementById('edit_comment').value = comment !== '—' ? comment : '';
    document.getElementById('editError').style.display = 'none';
    document.getElementById('editTransactionModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('edit_amount').focus(), 100);
}

function closeEditModal() {
    document.getElementById('editTransactionModal').classList.remove('active');
    document.body.style.overflow = '';
    editingTransactionId = null;
    document.getElementById('editError').style.display = 'none';
}

function closeEditModalOnOverlay(event) {
    if (event.target === event.currentTarget) closeEditModal();
}

async function saveTransactionEdit() {
    const categoryId = document.getElementById('edit_category_id').value;
    const amount = document.getElementById('edit_amount').value;
    const date = document.getElementById('edit_date').value;
    const time = document.getElementById('edit_time').value;
    const comment = document.getElementById('edit_comment').value;
    const errorDiv = document.getElementById('editError');
    const saveBtn = document.querySelector('#editTransactionModal .btn-primary');

    if (!categoryId || !amount || !date) {
        errorDiv.textContent = 'Заполните обязательные поля';
        errorDiv.style.display = 'block';
        return;
    }

    errorDiv.style.display = 'none';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';
    }

    try {
        const response = await fetch(`/transaction/${editingTransactionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category_id: parseInt(categoryId),
                amount: parseFloat(amount),
                date: date,
                time: time,
                comment: comment
            })
        });

        const data = await response.json();
        if (data.success) {
            showFlash('Транзакция обновлена', 'success');
            closeEditModal();
            await loadTransactions(currentPage);
        } else {
            errorDiv.textContent = data.error || 'Ошибка при сохранении';
            errorDiv.style.display = 'block';
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Сохранить';
            }
        }
    } catch (err) {
        errorDiv.textContent = 'Ошибка соединения с сервером';
        errorDiv.style.display = 'block';
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить';
        }
    }
}

function deleteTransaction(id) {
    showConfirm('Удалить транзакцию? Это действие нельзя отменить.', 'Удаление транзакции', async () => {
        try {
            const response = await fetch(`/transaction/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
            const data = await response.json();
            if (data.success) {
                showFlash('Транзакция удалена', 'success');
                await loadTransactions(currentPage);
            } else {
                showFlash('Ошибка: ' + data.error, 'danger');
            }
        } catch (err) {
            showFlash('Ошибка соединения с сервером', 'danger');
        }
    });
}

// Обработчик отправки формы транзакции (AJAX)
document.getElementById('addTransactionForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const submitBtn = this.querySelector('button[type="submit"]');
    const errorDiv = document.getElementById('transactionFormError');
    const originalBtnText = submitBtn.textContent;

    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    submitBtn.disabled = true;
    submitBtn.textContent = 'Сохранение...';

    try {
        const response = await fetch('/add-transaction', {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            if (data.warning) {
                showFlash(data.warning, 'warning');
            } else {
                showFlash('Транзакция успешно добавлена', 'success');
            }

            document.getElementById('category_id').value = '';
            document.getElementById('amount').value = '0.00';
            document.getElementById('comment').value = '';

            initDateTime();

            await loadTransactions(currentPage);
        } else {
            errorDiv.textContent = data.error || 'Ошибка при сохранении транзакции';
            errorDiv.style.display = 'block';
        }
    } catch (err) {
        errorDiv.textContent = 'Ошибка соединения с сервером';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});

// Закрытие дропдаунов при клике вне
document.addEventListener('click', function(e) {
    const categoriesMultiselect = document.getElementById('categoriesMultiselect');
    const usersMultiselect = document.getElementById('usersMultiselect');
    if (categoriesMultiselect && !categoriesMultiselect.contains(e.target)) {
        document.getElementById('categoriesDropdown').style.display = 'none';
    }
    if (usersMultiselect && !usersMultiselect.contains(e.target)) {
        document.getElementById('usersDropdown').style.display = 'none';
    }
});

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initDateTime();
    loadCategoriesAndUsers();
    loadTransactions(1);
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeEditModal();
            document.getElementById('categoriesDropdown').style.display = 'none';
            document.getElementById('usersDropdown').style.display = 'none';
        }
    });
});