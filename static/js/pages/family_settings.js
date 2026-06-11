// static/js/pages/family_settings.js

let currentFamilyName = '';
let currentUserRole = '';
let currentUserId = null;

async function loadFamilyData() {
    try {
        const response = await fetch('/api/family-data');
        const data = await response.json();

        if (data.success) {
            currentFamilyName = data.family.name;
            currentUserRole = data.current_user_role;
            currentUserId = data.current_user_id;

            document.getElementById('familyName').textContent = data.family.name;
            document.getElementById('familyCreatedAt').textContent = `Создана: ${data.family.created_at}`;

            const renameBtn = document.getElementById('renameFamilyBtn');
            const deleteBtn = document.getElementById('deleteFamilyBtn');
            const adminActions = document.getElementById('adminActions');

            if (data.current_user_role === 'Создатель') {
                if (renameBtn) renameBtn.style.display = 'inline-flex';
                if (deleteBtn) deleteBtn.style.display = 'inline-flex';
                if (adminActions) adminActions.style.display = 'block';
            } else if (data.current_user_role === 'Администратор') {
                if (renameBtn) renameBtn.style.display = 'inline-flex';
                if (deleteBtn) deleteBtn.style.display = 'none';
                if (adminActions) adminActions.style.display = 'block';
            } else {
                if (renameBtn) renameBtn.style.display = 'none';
                if (deleteBtn) deleteBtn.style.display = 'none';
                if (adminActions) adminActions.style.display = 'none';
            }

            renderMembers(data.members);
            renderActiveInvites(data.active_invites);
            renderOldInvites(data.old_invitations);
        } else {
            showFlash('Ошибка загрузки данных', 'danger');
        }
    } catch (err) {
        console.error('Error loading family data:', err);
        showFlash('Ошибка соединения', 'danger');
    }
}

function renderMembers(members) {
    const tbody = document.getElementById('membersTableBody');

    if (!members || members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary">Нет участников</td></tr>';
        return;
    }

    tbody.innerHTML = members.map(member => {
        let roleHtml = '';
        let actionsHtml = '';

        if (member.is_current_user) {
            const badgeClass = member.role === 'Создатель' ? 'badge-accent' : (member.role === 'Администратор' ? 'badge-warning' : 'badge-success');
            roleHtml = `<span class="badge ${badgeClass}">${member.role}</span>`;
            actionsHtml = `<button class="btn btn-outline" style="padding: 4px 12px; font-size: 0.8rem;" onclick="leaveFamily()">Покинуть</button>`;
        } else {
            if (currentUserRole === 'Создатель') {
                roleHtml = `
                    <select onchange="changeRole(${member.id}, this.value)" class="role-select" style="background: var(--bg-secondary); padding: 4px 8px; border-radius: var(--radius-sm);">
                        <option value="Участник" ${member.role === 'Участник' ? 'selected' : ''}>Участник</option>
                        <option value="Администратор" ${member.role === 'Администратор' ? 'selected' : ''}>Администратор</option>
                    </select>
                `;
                actionsHtml = `
                    <button class="btn btn-outline" style="padding: 4px 12px; font-size: 0.8rem; margin-right: 8px;" onclick="removeMember(${member.id})">Исключить</button>
                    ${member.role !== 'Создатель' ? `<button class="btn btn-outline" style="padding: 4px 12px; font-size: 0.8rem;" onclick="transferOwnership(${member.id})">Назначить создателем</button>` : ''}
                `;
            } else if (currentUserRole === 'Администратор' && member.role === 'Участник') {
                const badgeClass = member.role === 'Создатель' ? 'badge-accent' : (member.role === 'Администратор' ? 'badge-warning' : 'badge-success');
                roleHtml = `<span class="badge ${badgeClass}">${member.role}</span>`;
                actionsHtml = `<button class="btn btn-outline" style="padding: 4px 12px; font-size: 0.8rem;" onclick="removeMember(${member.id})">Исключить</button>`;
            } else {
                const badgeClass = member.role === 'Создатель' ? 'badge-accent' : (member.role === 'Администратор' ? 'badge-warning' : 'badge-success');
                roleHtml = `<span class="badge ${badgeClass}">${member.role}</span>`;
                actionsHtml = '';
            }
        }

        return `
            <tr>
                <td>${escapeHtml(member.full_name)}</td>
                <td>${roleHtml}</td>
                <td>${member.reg_date}</td>
                <td>${actionsHtml}</td>
            </tr>
        `;
    }).join('');
}

function renderActiveInvites(invites) {
    const tbody = document.getElementById('activeInvitesBody');

    if (!invites || invites.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-secondary">Нет активных приглашений</td></tr>';
        return;
    }

    tbody.innerHTML = invites.map(invite => `
        <tr>
            <td><code style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 8px; font-family: monospace;">${escapeHtml(invite.code)}</code></td>
            <td>${escapeHtml(invite.expires_at)}</td>
            <td>
                <button class="copy-btn" onclick="copyToClipboard('${invite.code}', this)" title="Скопировать код">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
                <button class="delete-invite-btn" onclick="deleteInvite(${invite.id})" title="Отозвать приглашение">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18"></path>
                        <path d="M6 6l12 12"></path>
                    </svg>
                </button>
              </td>
        </tr>
    `).join('');
}

function renderOldInvites(invites) {
    const tbody = document.getElementById('oldInvitesBody');

    if (!invites || invites.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-secondary">Нет истории приглашений</td</tr>';
        return;
    }

    tbody.innerHTML = invites.map(invite => {
        let badgeClass = '';
        if (invite.status === 'Ожидает') badgeClass = 'warning';
        else if (invite.status === 'Принят') badgeClass = 'success';
        else badgeClass = 'error';

        return `
            <tr>
                <td><code>${escapeHtml(invite.code)}</code></td>
                <td><span class="badge badge-${badgeClass}">${invite.status}</span></td>
                <td>${escapeHtml(invite.expires_at)}</span></td>
            </tr>
        `;
    }).join('');
}

function copyToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
        showFlash('Код скопирован в буфер обмена', 'success');
        btnElement.style.color = 'var(--success)';
        setTimeout(() => {
            btnElement.style.color = '';
        }, 500);
    }).catch(err => {
        showFlash('Не удалось скопировать код', 'danger');
    });
}

function openRenameFamilyModal() {
    document.getElementById('rename_family_name').value = currentFamilyName;
    document.getElementById('renameFamilyError').style.display = 'none';
    document.getElementById('renameFamilyModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        document.getElementById('rename_family_name').focus();
    }, 100);
}

function closeRenameFamilyModal() {
    document.getElementById('renameFamilyModal').classList.remove('active');
    document.body.style.overflow = '';
}

function closeRenameFamilyModalOnOverlay(event) {
    if (event.target === event.currentTarget) closeRenameFamilyModal();
}

async function confirmRenameFamily() {
    const newName = document.getElementById('rename_family_name').value.trim();
    const errorDiv = document.getElementById('renameFamilyError');
    const saveBtn = document.querySelector('#renameFamilyModal .btn-primary');

    if (!newName) {
        errorDiv.textContent = 'Название семьи не может быть пустым';
        errorDiv.style.display = 'block';
        return;
    }

    if (newName.length > 100) {
        errorDiv.textContent = 'Название не должно превышать 100 символов';
        errorDiv.style.display = 'block';
        return;
    }

    errorDiv.style.display = 'none';
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение...';
    }

    try {
        const response = await fetch('/family/rename', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Семья переименована', 'success');
            currentFamilyName = newName;
            document.getElementById('familyName').textContent = newName;
            closeRenameFamilyModal();
        } else {
            errorDiv.textContent = data.error || 'Ошибка при переименовании';
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

async function generateInvite() {
    const btn = document.getElementById('generateInviteBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Генерация...';

    try {
        const response = await fetch('/generate-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.code) {
            showFlash('Код приглашения создан: ' + data.code, 'success');
            await loadFamilyData();
        } else {
            showFlash('Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'danger');
        }
    } catch (err) {
        showFlash('Ошибка соединения с сервером', 'danger');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function deleteInvite(inviteId) {
    showConfirm(
        'Отозвать приглашение? Код станет недействительным.',
        'Отзыв приглашения',
        async function() {
            try {
                const response = await fetch(`/invite/${inviteId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();

                if (data.success) {
                    showFlash('Приглашение отозвано', 'success');
                    await loadFamilyData();
                } else {
                    showFlash('Ошибка: ' + data.error, 'danger');
                }
            } catch (err) {
                showFlash('Ошибка соединения с сервером', 'danger');
            }
        }
    );
}

async function changeRole(userId, newRole) {
    try {
        const response = await fetch('/family/change-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, role: newRole })
        });

        const data = await response.json();

        if (data.success) {
            showFlash('Роль изменена', 'success');
            await loadFamilyData();
        } else {
            showFlash('Ошибка: ' + data.error, 'danger');
        }
    } catch (err) {
        showFlash('Ошибка соединения с сервером', 'danger');
    }
}

async function transferOwnership(userId) {
    showConfirm(
        'Передать права создателя этому участнику? Вы станете администратором.',
        'Передача прав',
        async function() {
            try {
                const response = await fetch('/family/transfer-ownership', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_creator_id: userId })
                });

                const data = await response.json();

                if (data.success) {
                    showFlash('Права создателя переданы', 'success');
                    await loadFamilyData();
                } else {
                    showFlash('Ошибка: ' + data.error, 'danger');
                }
            } catch (err) {
                showFlash('Ошибка соединения с сервером', 'danger');
            }
        }
    );
}

async function removeMember(userId) {
    showConfirm(
        'Вы уверены, что хотите исключить участника из семьи?',
        'Исключение участника',
        async function() {
            try {
                const response = await fetch('/family/remove-member', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId })
                });

                const data = await response.json();

                if (data.success) {
                    showFlash('Участник исключён из семьи', 'success');
                    await loadFamilyData();
                } else {
                    showFlash('Ошибка: ' + data.error, 'danger');
                }
            } catch (err) {
                showFlash('Ошибка соединения с сервером', 'danger');
            }
        }
    );
}

async function leaveFamily() {
    showConfirm(
        'Вы уверены, что хотите покинуть семью?',
        'Выход из семьи',
        async function() {
            try {
                const response = await fetch('/family/leave', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();

                if (data.success) {
                    if (data.family_deleted) {
                        showFlash('Семья удалена, так как вы были последним участником', 'success');
                    } else {
                        showFlash('Вы покинули семью', 'success');
                    }
                    setTimeout(() => {
                        window.location.href = '/no-family';
                    }, 1500);
                } else {
                    showFlash('Ошибка: ' + data.error, 'danger');
                }
            } catch (err) {
                showFlash('Ошибка соединения с сервером', 'danger');
            }
        }
    );
}

function deleteFamily() {
    const confirmInput = document.getElementById('deleteFamilyConfirmInput');
    const errorDiv = document.getElementById('deleteFamilyError');

    if (confirmInput) {
        confirmInput.value = '';
        errorDiv.style.display = 'none';
    }

    document.getElementById('deleteFamilyModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        if (confirmInput) confirmInput.focus();
    }, 100);
}

function closeDeleteFamilyModal() {
    document.getElementById('deleteFamilyModal').classList.remove('active');
    document.body.style.overflow = '';
}

function closeDeleteFamilyModalOnOverlay(event) {
    if (event.target === event.currentTarget) closeDeleteFamilyModal();
}

async function confirmDeleteFamily() {
    const confirmInput = document.getElementById('deleteFamilyConfirmInput');
    const errorDiv = document.getElementById('deleteFamilyError');
    const inputValue = confirmInput ? confirmInput.value.trim() : '';
    const deleteBtn = document.getElementById('deleteFamilyConfirmBtn');

    if (inputValue === currentFamilyName) {
        errorDiv.style.display = 'none';
        deleteBtn.disabled = true;
        deleteBtn.textContent = 'Удаление...';

        try {
            const response = await fetch('/family/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (data.success) {
                closeDeleteFamilyModal();
                showFlash('Семья "' + currentFamilyName + '" удалена', 'success');
                setTimeout(() => {
                    window.location.href = '/no-family';
                }, 1500);
            } else {
                errorDiv.textContent = data.error || 'Ошибка при удалении';
                errorDiv.style.display = 'block';
                deleteBtn.disabled = false;
                deleteBtn.textContent = 'Удалить навсегда';
            }
        } catch (err) {
            errorDiv.textContent = 'Ошибка соединения с сервером';
            errorDiv.style.display = 'block';
            deleteBtn.disabled = false;
            deleteBtn.textContent = 'Удалить навсегда';
        }
    } else if (inputValue) {
        errorDiv.textContent = 'Название семьи введено неверно';
        errorDiv.style.display = 'block';
        if (confirmInput) {
            confirmInput.value = '';
            confirmInput.focus();
        }
    } else {
        errorDiv.textContent = 'Введите название семьи для подтверждения';
        errorDiv.style.display = 'block';
        if (confirmInput) confirmInput.focus();
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    loadFamilyData();

    document.getElementById('renameFamilyBtn').addEventListener('click', openRenameFamilyModal);
    document.getElementById('generateInviteBtn').addEventListener('click', generateInvite);
    document.getElementById('deleteFamilyBtn').addEventListener('click', deleteFamily);
    document.getElementById('deleteFamilyConfirmBtn').addEventListener('click', confirmDeleteFamily);

    const confirmInput = document.getElementById('deleteFamilyConfirmInput');
    if (confirmInput) {
        confirmInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmDeleteFamily();
            }
        });
    }

    const renameInput = document.getElementById('rename_family_name');
    if (renameInput) {
        renameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmRenameFamily();
            }
        });
    }
});