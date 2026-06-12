// static/js/pages/reports.js

let currentReportData = null;
let currentDateOffset = 0;
let currentPeriodType = 'month';
let currentCategoryId = null;
let categoryStack = [];
let visibleItemsMap = {};
let visibleUsersMap = {};

// Инициализация формы
document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    currentDateOffset = 0;
    currentCategoryId = null;
    categoryStack = [];
    visibleItemsMap = {};
    visibleUsersMap = {};
    await loadReport();
});

document.getElementById('group_by').addEventListener('change', (e) => {
    const groupBy = e.target.value;
    const categoryContainer = document.getElementById('categoryChartContainer');
    const userContainer = document.getElementById('userChartContainer');

    if (groupBy === 'user') {
        categoryContainer.style.display = 'none';
        userContainer.style.display = 'block';
        visibleUsersMap = {};
    } else {
        categoryContainer.style.display = 'block';
        userContainer.style.display = 'none';
        visibleItemsMap = {};
    }
    loadReport();
});

document.getElementById('period_type').addEventListener('change', (e) => {
    const periodType = e.target.value;
    const customPeriod = document.getElementById('customPeriod');
    const periodNavigation = document.getElementById('periodNavigation');

    currentPeriodType = periodType;
    currentDateOffset = 0;

    if (periodType === 'custom') {
        customPeriod.style.display = 'block';
        periodNavigation.style.display = 'none';
    } else {
        customPeriod.style.display = 'none';
        periodNavigation.style.display = 'flex';
        updatePeriodLabel();
        loadReport();
    }
});

document.getElementById('prevPeriodBtn').addEventListener('click', () => {
    currentDateOffset--;
    updatePeriodLabel();
    currentCategoryId = null;
    categoryStack = [];
    visibleItemsMap = {};
    loadReport();
});

document.getElementById('nextPeriodBtn').addEventListener('click', () => {
    currentDateOffset++;
    updatePeriodLabel();
    currentCategoryId = null;
    categoryStack = [];
    visibleItemsMap = {};
    loadReport();
});

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function updatePeriodLabel() {
    const today = new Date();
    let label = '';
    let dateStart = null;
    let dateEnd = null;

    if (currentPeriodType === 'week') {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + (currentDateOffset * 7));
        const dayOfWeek = currentDate.getDay();
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        label = `${formatDateDisplay(startOfWeek)} - ${formatDateDisplay(endOfWeek)}`;
        dateStart = startOfWeek;
        dateEnd = endOfWeek;
    } else if (currentPeriodType === 'month') {
        const currentDate = new Date(today.getFullYear(), today.getMonth() + currentDateOffset, 1);
        dateStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        dateEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        label = `${monthNames[dateStart.getMonth()]} ${dateStart.getFullYear()}`;
    } else if (currentPeriodType === 'quarter') {
        let totalMonthOffset = today.getMonth() + currentDateOffset * 3;
        let year = today.getFullYear();
        while (totalMonthOffset < 0) { totalMonthOffset += 12; year--; }
        while (totalMonthOffset >= 12) { totalMonthOffset -= 12; year++; }
        const quarterStartMonth = Math.floor(totalMonthOffset / 3) * 3;
        dateStart = new Date(year, quarterStartMonth, 1);
        dateEnd = new Date(year, quarterStartMonth + 3, 0);
        label = `${dateStart.getFullYear()}, ${Math.floor(quarterStartMonth / 3) + 1}-й квартал`;
    } else if (currentPeriodType === 'year') {
        const year = today.getFullYear() + currentDateOffset;
        dateStart = new Date(year, 0, 1);
        dateEnd = new Date(year, 11, 31);
        label = `${year} год`;
    }

    document.getElementById('currentPeriodLabel').textContent = label;
    window.currentDateStart = formatDate(dateStart);
    window.currentDateEnd = formatDate(dateEnd);
}

async function loadReport(categoryId = null, isBackNavigation = false) {
    const reportType = document.getElementById('report_type').value;
    const groupBy = document.getElementById('group_by').value;
    const periodType = document.getElementById('period_type').value;

    let dateStart, dateEnd;

    if (periodType === 'custom') {
        dateStart = document.getElementById('date_start').value;
        dateEnd = document.getElementById('date_end').value;
        if (!dateStart || !dateEnd) {
            showFlash('Выберите период', 'warning');
            return;
        }
    } else {
        dateStart = window.currentDateStart;
        dateEnd = window.currentDateEnd;
    }

    let url = `/api/report-data?report_type=${reportType}&date_start=${dateStart}&date_end=${dateEnd}&group_by=${groupBy}`;
    if (categoryId !== undefined && groupBy === 'category') {
        url += `&category_id=${categoryId || ''}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            showFlash(data.error, 'danger');
            return;
        }

        currentReportData = data;
        updateSummary(data);

        const titles = {
            'expenses': 'Расходы по категориям',
            'income': 'Доходы по категориям'
        };
        document.getElementById('chartTitle').textContent = titles[reportType] || 'Распределение';

        if (groupBy === 'user') {
            renderUserDonutChart(data);
            updateTable(data, groupBy);
        } else {
            if (!isBackNavigation && categoryId !== null && categoryId !== currentCategoryId) {
                if (currentCategoryId !== null) categoryStack.push(currentCategoryId);
            } else if (categoryId === null) {
                categoryStack = [];
            }
            currentCategoryId = data.current_category_id;

            renderCategoryDonutChart(data);
            updateTable(data, groupBy);

            const backButton = document.getElementById('backButton');
            const pathSpan = document.getElementById('currentCategoryPath');

            if (data.current_category_name) {
                pathSpan.textContent = data.current_category_name;
                backButton.style.display = 'inline-flex';
            } else {
                pathSpan.textContent = 'Все категории';
                backButton.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showFlash('Ошибка загрузки отчёта', 'danger');
    }
}

function goBack() {
    if (categoryStack.length > 0) {
        const parentId = categoryStack.pop();
        loadReport(parentId, true);
    } else {
        loadReport(null, true);
    }
}

function toggleCategory(itemId) {
    if (visibleItemsMap[itemId] === undefined) {
        visibleItemsMap[itemId] = true;
    }
    visibleItemsMap[itemId] = !visibleItemsMap[itemId];

    // Обновляем класс disabled у элемента легенды
    const legendItem = document.querySelector(`.legend-item[data-id="${itemId}"]`);
    if (legendItem) {
        if (!visibleItemsMap[itemId]) {
            legendItem.classList.add('disabled');
        } else {
            legendItem.classList.remove('disabled');
        }
    }

    // Перерисовываем легенду с новыми процентами
    if (currentReportData) {
        renderCategoryLegend(currentReportData);
    }

    updateCategoryChartData();
}

function toggleUser(userId) {
    if (visibleUsersMap[userId] === undefined) {
        visibleUsersMap[userId] = true;
    }
    visibleUsersMap[userId] = !visibleUsersMap[userId];

    const legendItem = document.querySelector(`.legend-user-item[data-id="${userId}"]`);
    if (legendItem) {
        if (!visibleUsersMap[userId]) {
            legendItem.classList.add('disabled');
        } else {
            legendItem.classList.remove('disabled');
        }
    }

    updateUserChartData();
}

function updateCategoryChartData() {
    if (!currentReportData || !currentReportData.items) return;

    const total = currentReportData.total;
    if (total === 0) {
        document.getElementById('donutTotal').textContent = '0 ₽';
        document.getElementById('donutSegments').innerHTML = '';
        return;
    }

    const visibleItems = currentReportData.items.filter(item => visibleItemsMap[item.id] !== false);
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
                loadReport(item.id, false);
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

    attachCategoryTooltipEvents();
}

function attachCategoryTooltipEvents() {
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

function renderCategoryDonutChart(data) {
    visibleItemsMap = {};
    data.items.forEach(item => {
        visibleItemsMap[item.id] = true;
    });

    renderCategoryLegend(data);
    updateCategoryChartData();

    const backButton = document.getElementById('backButton');
    const pathSpan = document.getElementById('currentCategoryPath');

    if (data.current_category_name) {
        pathSpan.textContent = data.current_category_name;
        backButton.style.display = 'inline-flex';
    } else {
        pathSpan.textContent = 'Все категории';
        backButton.style.display = 'none';
    }
}

function renderCategoryLegend(data) {
    const legendDiv = document.getElementById('chartLegend');
    legendDiv.innerHTML = '';

    if (!data.items || data.items.length === 0) {
        legendDiv.innerHTML = '<div class="text-center text-secondary">Нет данных</div>';
        return;
    }

    // Вычисляем текущую видимую сумму
    const visibleTotal = data.items.reduce((sum, item) => {
        if (visibleItemsMap[item.id] !== false) {
            return sum + item.value;
        }
        return sum;
    }, 0);

    data.items.forEach(item => {
        const isVisible = visibleItemsMap[item.id] !== false;
        // Пересчитываем процент относительно видимой суммы
        const percent = visibleTotal > 0 && isVisible ? (item.value / visibleTotal) * 100 : 0;

        const legendItem = document.createElement('div');
        legendItem.className = `legend-item ${!isVisible ? 'disabled' : ''}`;
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

function updateUserChartData() {
    if (!currentReportData || !currentReportData.items) return;

    const total = currentReportData.total;
    if (total === 0) {
        document.getElementById('userDonutTotal').textContent = '0 ₽';
        document.getElementById('userDonutSegments').innerHTML = '';
        return;
    }

    const visibleItems = currentReportData.items.filter(item => visibleUsersMap[item.id] !== false);
    const visibleTotal = visibleItems.reduce((sum, item) => sum + item.value, 0);

    if (visibleTotal === 0) {
        document.getElementById('userDonutTotal').textContent = '0 ₽';
        document.getElementById('userDonutSegments').innerHTML = '';
        return;
    }

    document.getElementById('userDonutTotal').textContent = Math.round(visibleTotal) + ' ₽';

    const circumference = 1130.97;
    const segmentsGroup = document.getElementById('userDonutSegments');
    const oldSegments = segmentsGroup.querySelectorAll('.donut-segment');
    oldSegments.forEach(seg => seg.remove());

    let cumulativeOffset = 0;
    const userColors = [
        '#ff7a00', '#10b981', '#3b82f6', '#8b5cf6',
        '#f59e0b', '#ef4444', '#22c55e', '#06b6d4',
        '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    visibleItems.forEach((item, index) => {
        const percent = (item.value / visibleTotal) * 100;
        const length = (percent / 100) * circumference;
        const color = userColors[index % userColors.length];

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

        circle.classList.add('donut-segment', `user-segment-${index}`);
        circle.style.strokeDasharray = `0 ${circumference}`;
        circle.style.strokeDashoffset = `-${cumulativeOffset}`;
        circle.style.transition = 'stroke-dasharray 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke-width 0.3s ease, filter 0.3s ease';

        segmentsGroup.appendChild(circle);

        setTimeout(() => {
            circle.style.strokeDasharray = `${length} ${circumference}`;
        }, 50);

        const style = document.createElement('style');
        style.textContent = `
            .user-segment-${index}:hover {
                stroke-width: 48px !important;
                filter: drop-shadow(0 0 25px ${color}) !important;
                cursor: default;
            }
        `;
        document.head.appendChild(style);

        cumulativeOffset += length;
    });

    attachUserTooltipEvents();
}

function attachUserTooltipEvents() {
    const tooltip = document.getElementById('donut-tooltip');
    document.querySelectorAll('#userDonutSegments .donut-segment').forEach(seg => {
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

function renderUserDonutChart(data) {
    const total = data.total || 0;
    const reportType = document.getElementById('report_type').value;
    const titleText = reportType === 'expenses' ? 'Расходы по пользователям' : 'Доходы по пользователям';
    document.querySelector('#userChartContainer .card-title').textContent = titleText;

    visibleUsersMap = {};
    data.items.forEach(item => {
        visibleUsersMap[item.id] = true;
    });

    renderUserLegend(data);
    updateUserChartData();
}

function renderUserLegend(data) {
    const legendDiv = document.getElementById('userChartLegend');
    legendDiv.innerHTML = '';

    if (!data.items || data.items.length === 0) {
        legendDiv.innerHTML = '<div class="text-center text-secondary">Нет данных</div>';
        return;
    }

    const userColors = [
        '#ff7a00', '#10b981', '#3b82f6', '#8b5cf6',
        '#f59e0b', '#ef4444', '#22c55e', '#06b6d4',
        '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    data.items.forEach((item, index) => {
        const percent = (item.value / data.total) * 100;
        const color = userColors[index % userColors.length];
        const legendItem = document.createElement('div');
        legendItem.className = `legend-item legend-user-item ${!visibleUsersMap[item.id] ? 'disabled' : ''}`;
        legendItem.setAttribute('data-id', item.id);
        legendItem.innerHTML = `
            <span class="legend-color" style="background: ${color}; box-shadow: 0 0 10px ${color};"></span>
            ${item.name} (${percent.toFixed(1)}%)
        `;

        legendItem.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUser(item.id);
        });

        legendDiv.appendChild(legendItem);
    });
}

function updateTable(data, groupBy) {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';

    let items = [];
    let total = 0;

    if (groupBy === 'category') {
        items = data.items || [];
        total = data.total || 0;
    } else if (groupBy === 'user') {
        items = data.items || [];
        total = data.total || 0;
    }

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-secondary">Нет данных</td</tr>';
        return;
    }

    for (const item of items) {
        const row = tbody.insertRow();
        const value = item.value !== undefined ? item.value : item.total;
        const percent = total > 0 ? (value / total) * 100 : 0;
        row.insertCell(0).textContent = item.name;
        row.insertCell(1).innerHTML = formatMoney(value);
        row.insertCell(2).innerHTML = `${percent.toFixed(1)}%`;
    }

    const totalRow = tbody.insertRow();
    totalRow.style.borderTop = '2px solid var(--border-primary)';
    totalRow.style.fontWeight = '600';
    totalRow.insertCell(0).textContent = 'ИТОГО';
    totalRow.insertCell(1).innerHTML = formatMoney(total);
    totalRow.insertCell(2).innerHTML = '100%';
}

function updateSummary(data) {
    document.getElementById('summaryIncome').textContent = formatMoney(data.total_income);
    document.getElementById('summaryExpense').textContent = formatMoney(data.total_expense);
    const balance = data.total_income - data.total_expense;
    document.getElementById('summaryBalance').textContent = formatMoney(balance);
    document.getElementById('summaryBalance').style.color = balance >= 0 ? 'var(--success)' : 'var(--error)';
}

function exportReport() {
    if (!currentReportData) {
        showFlash('Сначала сформируйте отчёт', 'warning');
        return;
    }

    const reportType = document.getElementById('report_type').value;
    const groupBy = document.getElementById('group_by').value;
    const periodType = document.getElementById('period_type').value;

    let dateStart, dateEnd;
    if (periodType === 'custom') {
        dateStart = document.getElementById('date_start').value;
        dateEnd = document.getElementById('date_end').value;
    } else {
        dateStart = window.currentDateStart;
        dateEnd = window.currentDateEnd;
    }

    const url = `/export-report?report_type=${reportType}&group_by=${groupBy}&date_start=${dateStart}&date_end=${dateEnd}`;

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

function init() {
    const today = new Date();
    document.getElementById('date_start').value = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
    document.getElementById('date_end').value = formatDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    updatePeriodLabel();
    loadReport();
}

document.getElementById('report_type').addEventListener('change', () => {
    currentCategoryId = null;
    categoryStack = [];
    visibleItemsMap = {};
    visibleUsersMap = {};
    loadReport();
});

// Запуск инициализации
init();