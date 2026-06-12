// static/js/pages/categories.js

let selectedColor = '#ff7a00';
let dragSourceId = null;
let currentFlatCategories = [];

async function loadCategoryTree() {
    const container = document.getElementById('categoryTree');
    container.innerHTML = '<div class="text-center text-secondary">Загрузка...</div>';

    try {
        const response = await fetch('/api/categories-tree');
        const data = await response.json();

        if (data.success) {
            currentFlatCategories = data.flat;
            renderTree(data.tree);
            updateParentSelect();
        } else {
            container.innerHTML = '<div class="text-center text-secondary">Ошибка загрузки категорий</div>';
        }
    } catch (err) {
        console.error('Error loading categories:', err);
        container.innerHTML = '<div class="text-center text-secondary">Ошибка соединения</div>';
    }
}

function renderCategoryHTML(cat, level = 0) {
    const sortedChildren = cat.children ? [...cat.children].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    ) : [];

    const hasChildren = sortedChildren.length > 0;

    let html = `
        <div class="category-item" data-id="${cat.id}" data-level="${level}" draggable="true">
            <div class="category-info">
                <div class="category-color-badge" style="background: ${cat.color};"></div>
                <span class="category-name">${escapeHtml(cat.name)}</span>
                <span class="badge badge-${cat.type === 'Расход' ? 'warning' : 'success'}">${cat.type}</span>
            </div>
            <div class="category-actions">
                <button onclick="editCategoryColor(${cat.id}, '${cat.color}')" title="Изменить цвет">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                    </svg>
                </button>
                <button onclick="editCategoryName(${cat.id}, '${escapeHtml(cat.name)}')" title="Переименовать">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 3l4 4-7 7H10v-4l7-7z"></path>
                        <path d="M4 20h16"></path>
                    </svg>
                </button>
                <button onclick="deleteCategory(${cat.id}, ${hasChildren})" title="Удалить">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18"></path>
                        <path d="M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;

    if (hasChildren) {
        html += `<div class="category-children" data-parent-id="${cat.id}">`;
        for (let child of sortedChildren) {
            html += renderCategoryHTML(child, level + 1);
        }
        html += `</div>`;
    }

    return html;
}

function renderTree(treeData) {
    const container = document.getElementById('categoryTree');
    if (!treeData || treeData.length === 0) {
        container.innerHTML = '<div class="text-center text-secondary">Нет категорий</div>';
        return;
    }

    const sortedRoot = [...treeData].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    let html = `
        <div class="drop-zone-root" id="dropZoneRoot">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 3v12m0 0-3-3m3 3 3-3"/>
                <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/>
            </svg>
            Перетащите сюда для перемещения в корень
        </div>
    `;
    for (let cat of sortedRoot) {
        html += renderCategoryHTML(cat, 0);
    }
    container.innerHTML = html;
    initDragAndDrop();
}

function updateParentSelect() {
    const select = document.getElementById('cat_parent');
    if (!select) return;

    select.innerHTML = '<option value="">— Корневая категория —</option>';

    currentFlatCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        let indent = '';
        for (let i = 0; i < cat.level; i++) indent += '&nbsp;&nbsp;&nbsp;&nbsp;';
        if (cat.level > 0) indent += '↳ ';
        option.innerHTML = `${indent}${escapeHtml(cat.name)} (${cat.type})`;
        option.style.color = cat.color;
        select.appendChild(option);
    });
}

function initDragAndDrop() {
    const draggables = document.querySelectorAll('.category-item');
    const dropZoneRoot = document.getElementById('dropZoneRoot');

    draggables.forEach(draggable => {
        draggable.removeEventListener('dragstart', handleDragStart);
        draggable.removeEventListener('dragend', handleDragEnd);
        draggable.removeEventListener('dragover', handleDragOver);
        draggable.removeEventListener('dragleave', handleDragLeave);
        draggable.removeEventListener('drop', handleDrop);

        draggable.addEventListener('dragstart', handleDragStart);
        draggable.addEventListener('dragend', handleDragEnd);
        draggable.addEventListener('dragover', handleDragOver);
        draggable.addEventListener('dragleave', handleDragLeave);
        draggable.addEventListener('drop', handleDrop);
    });

    if (dropZoneRoot) {
        dropZoneRoot.removeEventListener('dragover', handleRootDragOver);
        dropZoneRoot.removeEventListener('dragleave', handleRootDragLeave);
        dropZoneRoot.removeEventListener('drop', handleRootDrop);

        dropZoneRoot.addEventListener('dragover', handleRootDragOver);
        dropZoneRoot.addEventListener('dragleave', handleRootDragLeave);
        dropZoneRoot.addEventListener('drop', handleRootDrop);
    }
}

function handleDragStart(e) {
    dragSourceId = parseInt(e.target.closest('.category-item').dataset.id);
    e.target.closest('.category-item').classList.add('dragging');
    e.dataTransfer.setData('text/plain', dragSourceId);
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    document.querySelectorAll('.category-item').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
    });
    const dropZone = document.getElementById('dropZoneRoot');
    if (dropZone) dropZone.classList.remove('drag-over');
    dragSourceId = null;
}

function handleDragOver(e) {
    e.preventDefault();
    const target = e.target.closest('.category-item');
    if (!target || parseInt(target.dataset.id) === dragSourceId) return;

    e.dataTransfer.dropEffect = 'move';
    target.classList.add('drag-over');
}

function handleDragLeave(e) {
    const target = e.target.closest('.category-item');
    if (target) target.classList.remove('drag-over');
}

async function handleDrop(e) {
    e.preventDefault();
    const targetItem = e.target.closest('.category-item');
    if (!targetItem || !dragSourceId || parseInt(targetItem.dataset.id) === dragSourceId) return;

    const targetId = parseInt(targetItem.dataset.id);

    document.querySelectorAll('.category-item').forEach(el => {
        el.classList.remove('drag-over');
    });

    try {
        const response = await fetch('/category/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category_id: dragSourceId,
                target_id: targetId,
                position: 'inside'
            })
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Категория перемещена внутрь', 'success');
            await loadCategoryTree();
        } else {
            showFlash('Ошибка: ' + data.error, 'danger');
        }
    } catch (error) {
        showFlash('Ошибка сервера', 'danger');
    }
}

function handleRootDragOver(e) {
    e.preventDefault();
    const dropZone = document.getElementById('dropZoneRoot');
    if (dropZone && dragSourceId) {
        dropZone.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
    }
}

function handleRootDragLeave(e) {
    const dropZone = document.getElementById('dropZoneRoot');
    if (dropZone) dropZone.classList.remove('drag-over');
}

async function handleRootDrop(e) {
    e.preventDefault();
    const dropZone = document.getElementById('dropZoneRoot');
    if (dropZone) dropZone.classList.remove('drag-over');

    if (!dragSourceId) return;

    try {
        const response = await fetch('/category/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category_id: dragSourceId,
                target_id: null,
                position: 'root'
            })
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Категория перемещена в корень', 'success');
            await loadCategoryTree();
        } else {
            showFlash('Ошибка: ' + data.error, 'danger');
        }
    } catch (error) {
        showFlash('Ошибка сервера', 'danger');
    }
}

function openColorPickerForCategory() {
    openColorPicker(selectedColor, function(color) {
        selectedColor = color;
        const colorDisplay = document.getElementById('categoryColorDisplay');
        colorDisplay.style.background = color;
        colorDisplay.style.boxShadow = `0 2px 8px ${color}60`;
    });
}

async function editCategoryColor(id, currentColor) {
    openColorPicker(currentColor, async function(color) {
        try {
            const response = await fetch(`/category/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ color: color })
            });

            const data = await response.json();

            if (data.success) {
                showFlash('Цвет категории обновлён', 'success');
                await loadCategoryTree();
            } else {
                showFlash('Ошибка: ' + data.error, 'danger');
            }
        } catch (err) {
            showFlash('Ошибка сервера', 'danger');
        }
    });
}

async function addCategory() {
    const data = {
        name: document.getElementById('cat_name').value,
        type: document.getElementById('cat_type').value,
        color: selectedColor,
        parent_id: document.getElementById('cat_parent').value || null
    };

    const errorDiv = document.getElementById('addCategoryError');
    const submitBtn = document.querySelector('#addCategoryForm button[type="submit"]');
    const originalText = submitBtn.textContent;

    errorDiv.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Создание...';

    try {
        const response = await fetch('/category/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.id) {
            showFlash('Категория добавлена', 'success');
            document.getElementById('cat_name').value = '';
            document.getElementById('cat_type').value = 'Расход';
            document.getElementById('cat_parent').value = '';

            // Сбрасываем цвет на стандартный
            selectedColor = '#ff7a00';
            const colorDisplay = document.getElementById('categoryColorDisplay');
            colorDisplay.style.background = selectedColor;
            colorDisplay.style.boxShadow = `0 2px 8px ${selectedColor}60`;

            await loadCategoryTree();
        } else {
            errorDiv.textContent = result.error || 'Неизвестная ошибка';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Ошибка сервера';
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function deleteCategory(id, hasChildren) {
    showDeleteCategoryModal(id, hasChildren, async function(categoryId, action) {
        try {
            const response = await fetch(`/category/${categoryId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: action })
            });

            const data = await response.json();

            if (data.success) {
                showFlash('Категория удалена', 'success');
                await loadCategoryTree();
            } else {
                showFlash('Ошибка: ' + data.error, 'danger');
            }
        } catch (err) {
            showFlash('Ошибка сервера', 'danger');
        }
    });
}

function editCategoryName(id, currentName) {
    openRenameModal(id, currentName, async function(categoryId, newName) {
        try {
            const response = await fetch(`/category/${categoryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });

            const data = await response.json();

            if (data.success) {
                showFlash('Категория переименована', 'success');
                await loadCategoryTree();
            } else {
                showFlash('Ошибка: ' + data.error, 'danger');
            }
        } catch (err) {
            showFlash('Ошибка сервера', 'danger');
        }
    });
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    loadCategoryTree();
});