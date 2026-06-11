// static/js/pages/dashboard.js

// Инициализация даты и времени
function initDateTime() {
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');

    if (dateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }

    if (timeInput) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeInput.value = `${hours}:${minutes}`;
    }
}

// Данные для диаграммы
let chartData = null;
let currentCategoryId = null;
let categoryStack = [];
let visibleItemsMap = {};

// Функция для обновления видимости категории в легенде
function toggleCategory(itemId) {
    if (visibleItemsMap[itemId] === undefined) {
        visibleItemsMap[itemId] = true;
    }
    visibleItemsMap[itemId] = !visibleItemsMap[itemId];

    const legendItem = document.querySelector(`.legend-item[data-id="${itemId}"]`);
    if (legendItem) {
        if (!visibleItemsMap[itemId]) {
            legendItem.classList.add('disabled');
        } else {
            legendItem.classList.remove('disabled');
        }
    }

    updateChartData();
}

function updateChartData() {
    if (!chartData || !chartData.items) return;

    const total = chartData.total;
    if (total === 0) {
        document.getElementById('donutTotal').textContent = '0 ₽';
        document.getElementById('donutSegments').innerHTML = '';
        return;
    }

    const visibleItems = chartData.items.filter(item => visibleItemsMap[item.id] !== false);
    const visibleTotal = visibleItems.reduce((sum, item) => sum + item.value, 0);

    if (visibleTotal === 0) {
        document.getElementById('donutTotal').textContent = '0 ₽';
        document.getElementById('donutSegments').innerHTML = '';
        return;
    }

    document.getElementById('donutTotal').textContent = Math.round(visibleTotal) + ' ₽';

    const circumference = 1130.97;
    const segmentsGroup = document.getElementById('donutSegments');
    const oldSegments = segmentsGroup.querySelectorAll('.donut-segment');
    oldSegments.forEach(seg => seg.remove());

    let cumulativeOffset = 0;

    visibleItems.forEach((item, index) => {
        const percent = (item.value / visibleTotal) * 100;
        const length = (percent / 100) * circumference;
        const segmentClass = `donut-segment-${Date.now()}-${index}`;
        const color = item.color || '#6c757d';

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '250');
        circle.setAttribute('cy', '250');
        circle.setAttribute('r', '180');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', '40');
        circle.setAttribute('data-name', item.name);
        circle.setAttribute('data-value', `${item.value.toFixed(2)} ₽ (${percent.toFixed(1)}%)`);
        circle.setAttribute('data-id', item.id);
        circle.setAttribute('data-has-children', item.has_children);

        circle.classList.add('donut-segment', segmentClass);
        circle.style.strokeDasharray = `0 ${circumference}`;
        circle.style.strokeDashoffset = `-${cumulativeOffset}`;
        circle.style.transition = 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke-width 0.3s ease, filter 0.3s ease';

        if (item.has_children === true && item.id !== null) {
            circle.style.cursor = 'pointer';
            circle.addEventListener('click', (e) => {
                e.stopPropagation();
                updateChart(item.id, false);
            });
        }

        segmentsGroup.appendChild(circle);

        setTimeout(() => {
            circle.style.strokeDasharray = `${length} ${circumference}`;
        }, 50);

        const style = document.createElement('style');
        style.textContent = `
            .${segmentClass}:hover {
                stroke-width: 48px !important;
                filter: drop-shadow(0 0 25px ${color}) !important;
                cursor: ${item.has_children && item.id !== null ? 'pointer' : 'default'};
            }
        `;
        document.head.appendChild(style);

        cumulativeOffset += length;
    });

    attachTooltipEvents();
}

function attachTooltipEvents() {
    const tooltip = document.getElementById('donut-tooltip');
    document.querySelectorAll('#donutSegments .donut-segment').forEach(seg => {
        seg.removeEventListener('mouseenter', seg._mouseenterHandler);
        seg.removeEventListener('mousemove', seg._mousemoveHandler);
        seg.removeEventListener('mouseleave', seg._mouseleaveHandler);

        const mouseenterHandler = () => {
            tooltip.innerHTML = `<div class="tooltip-name">${seg.dataset.name}</div><div class="tooltip-value">${seg.dataset.value}</div>`;
            tooltip.classList.add('visible');
        };
        const mousemoveHandler = (e) => {
            let x = e.clientX + 16;
            let y = e.clientY - 16;
            if (x + tooltip.offsetWidth > window.innerWidth) x = e.clientX - tooltip.offsetWidth - 16;
            if (y + tooltip.offsetHeight > window.innerHeight) y = e.clientY - tooltip.offsetHeight - 16;
            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        };
        const mouseleaveHandler = () => {
            tooltip.classList.remove('visible');
        };

        seg._mouseenterHandler = mouseenterHandler;
        seg._mousemoveHandler = mousemoveHandler;
        seg._mouseleaveHandler = mouseleaveHandler;

        seg.addEventListener('mouseenter', mouseenterHandler);
        seg.addEventListener('mousemove', mousemoveHandler);
        seg.addEventListener('mouseleave', mouseleaveHandler);
    });
}

function renderLegend(data) {
    const legendDiv = document.getElementById('chartLegend');
    legendDiv.innerHTML = '';

    if (!data.items || data.items.length === 0) {
        legendDiv.innerHTML = '<div class="text-center text-secondary">Нет данных</div>';
        return;
    }

    data.items.forEach(item => {
        if (visibleItemsMap[item.id] === undefined) {
            visibleItemsMap[item.id] = true;
        }

        const percent = (item.value / data.total) * 100;
        const legendItem = document.createElement('div');
        legendItem.className = `legend-item ${!visibleItemsMap[item.id] ? 'disabled' : ''}`;
        legendItem.setAttribute('data-id', item.id);
        legendItem.innerHTML = `
            <span class="legend-color" style="background: ${item.color}; box-shadow: 0 0 10px ${item.color};"></span>
            ${item.name} (${percent.toFixed(1)}%)
        `;

        legendItem.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCategory(item.id);
        });

        legendDiv.appendChild(legendItem);
    });
}

async function updateChart(categoryId = null, isBackNavigation = false) {
    const url = categoryId
        ? `/api/chart-data?category_id=${categoryId}`
        : '/api/chart-data';

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            showFlash(data.error, 'danger');
            return;
        }

        if (!isBackNavigation && categoryId !== null && categoryId !== currentCategoryId) {
            if (currentCategoryId !== null) {
                categoryStack.push(currentCategoryId);
            }
        }

        currentCategoryId = data.current_category_id;
        chartData = data;

        visibleItemsMap = {};
        chartData.items.forEach(item => {
            visibleItemsMap[item.id] = true;
        });

        renderLegend(chartData);
        updateChartData();

        const backButton = document.getElementById('backButton');
        const pathSpan = document.getElementById('currentCategoryPath');

        if (data.current_category_id !== null && data.current_category_name) {
            pathSpan.textContent = data.current_category_name;
            backButton.style.display = 'inline-flex';
        } else {
            pathSpan.textContent = 'Все категории';
            backButton.style.display = 'none';
        }
    } catch (error) {
        console.error('Error:', error);
        showFlash('Ошибка загрузки данных диаграммы', 'danger');
    }
}

function goBack() {
    if (categoryStack.length > 0) {
        const parentId = categoryStack.pop();
        updateChart(parentId, true);
    } else {
        updateChart(null, true);
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

function openLimitModal() {
    document.getElementById('limitModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLimitModal() {
    document.getElementById('limitModal').classList.remove('active');
    document.body.style.overflow = '';
}

function closeModalOnOverlay(event) {
    if (event.target === event.currentTarget) {
        closeLimitModal();
    }
}

function deleteTransaction(id) {
    showConfirm(
        'Удалить транзакцию? Это действие нельзя отменить.',
        'Удаление транзакции',
        function() {
            fetch(`/transaction/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showFlash('Транзакция удалена', 'success');
                    setTimeout(() => location.reload(), 1000);
                } else {
                    showFlash('Ошибка: ' + data.error, 'danger');
                }
            });
        }
    );
}

function saveLimit() {
    const categoryId = document.getElementById('limit_category_id').value;
    const limitType = document.getElementById('limit_type').value;
    const amount = document.getElementById('limit_amount').value;

    if (!categoryId || !amount) {
        showFlash('Заполните все поля', 'warning');
        return;
    }

    fetch('/set-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            category_id: parseInt(categoryId),
            limit_type: limitType,
            amount: parseFloat(amount)
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showFlash('Лимит успешно установлен', 'success');
            closeLimitModal();
            setTimeout(() => location.reload(), 1000);
        } else {
            showFlash('Ошибка: ' + data.error, 'danger');
        }
    })
    .catch(error => {
        showFlash('Ошибка сервера', 'danger');
    });
}

function exportReport() {
    window.location.href = '/export-report';
}

async function updateStats() {
    try {
        const response = await fetch('/api/dashboard-stats');
        const data = await response.json();

        if (data.success) {
            const balanceEl = document.querySelector('.stat-card:first-child .stat-value');
            const balanceChangeEl = document.querySelector('.stat-card:first-child .stat-change');
            const expensesEl = document.querySelector('.stat-card:nth-child(2) .stat-value');
            const progressBar = document.querySelector('.stat-card:nth-child(2) .progress-bar');
            const progressPercent = document.querySelector('.stat-card:nth-child(2) .progress-label span:last-child');
            const membersCountEl = document.querySelector('.stat-card:nth-child(3) .stat-value');

            if (balanceEl) balanceEl.textContent = data.balance.toFixed(2);
            if (balanceChangeEl) {
                const change = data.balance_change;
                balanceChangeEl.innerHTML = change >= 0 ? `+${change.toFixed(1)}% за месяц` : `${change.toFixed(1)}% за месяц`;
                balanceChangeEl.className = `stat-change ${change < 0 ? 'negative' : ''}`;
            }
            if (expensesEl) expensesEl.textContent = data.month_expenses.toFixed(2);
            if (progressBar && data.expense_percent !== undefined) {
                progressBar.style.width = `${data.expense_percent}%`;
                if (data.expense_percent > 90) progressBar.classList.add('warning');
            }
            if (progressPercent && data.expense_percent !== undefined) {
                progressPercent.textContent = `${data.expense_percent}%`;
            }
            if (membersCountEl) membersCountEl.textContent = data.members_count;
        }
    } catch (err) {
        console.error('Error updating stats:', err);
    }
}

async function updateLastTransactions() {
    try {
        const response = await fetch('/api/last-transactions');
        const data = await response.json();

        if (data.success && data.transactions) {
            const tbody = document.querySelector('.table-container tbody');
            if (tbody && data.transactions.length > 0) {
                tbody.innerHTML = data.transactions.map(txn => `
                    <tr>
                        <td>${txn.date}</td>
                        <td style="color: ${txn.category_color};">${txn.category_name}</td>
                        <td style="color: ${txn.category_type === 'Расход' ? 'var(--error)' : 'var(--success)'}; font-weight: 600;">
                            ${txn.category_type === 'Расход' ? '-' : '+'} ${txn.amount.toFixed(2)}
                        </td>
                        <td>${txn.author}</td>
                    </tr>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error updating transactions:', err);
    }
}

async function updateChartDataFromAPI() {
    const currentId = currentCategoryId;
    await updateChart(currentId, false);
}

async function updateLimits() {
    try {
        const response = await fetch('/api/limits-data');
        const data = await response.json();

        if (data.success && data.family_limits) {
            const limitsContainer = document.querySelector('.card:last-child .grid-3');
            if (limitsContainer && data.family_limits.length > 0) {
                limitsContainer.innerHTML = data.family_limits.map(limit => `
                    <div class="limit-item ${limit.is_exceeded ? 'limit-exceeded' : ''}">
                        <div class="progress-label">
                            <span class="${limit.is_exceeded ? 'text-error' : ''}">${limit.category_name}</span>
                            <span class="${limit.is_exceeded ? 'text-error' : ''}">
                                ${limit.spent.toFixed(0)} / ${limit.limit_amount.toFixed(0)}
                                ${limit.is_exceeded ? '<span class="exceeded-badge">Превышен!</span>' : ''}
                            </span>
                        </div>
                        <div class="progress">
                            <div class="progress-bar ${limit.percent > 90 ? 'warning' : ''} ${limit.is_exceeded ? 'danger' : ''}" style="width: ${limit.percent}%"></div>
                        </div>
                        ${limit.is_exceeded ? `
                        <div class="exceeded-warning">
                            Превышение на ${(limit.spent - limit.limit_amount).toFixed(0)} ₽
                        </div>
                        ` : ''}
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Error updating limits:', err);
    }
}

// Инициализация страницы
document.addEventListener('DOMContentLoaded', () => {
    initDateTime();
    categoryStack = [];
    updateChart(null, false);
});

// Обработчик формы добавления транзакции
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

            await Promise.all([
                updateStats(),
                updateLastTransactions(),
                updateChartDataFromAPI(),
                updateLimits()
            ]);

            document.getElementById('category_id').value = '';
            document.getElementById('amount').value = '0.00';
            document.getElementById('comment').value = '';

            initDateTime();
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