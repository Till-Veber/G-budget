// static/js/core/modals.js

// ==================== CONFIRM MODAL ====================
let confirmCallback = null;

window.showConfirm = function(message, title = 'Подтверждение', onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    confirmCallback = onConfirm;
    document.getElementById('confirmModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        const confirmBtn = document.getElementById('confirmBtn');
        if (confirmBtn) confirmBtn.focus();
    }, 100);
};

window.closeConfirmModal = function() {
    document.getElementById('confirmModal').classList.remove('active');
    document.body.style.overflow = '';
    confirmCallback = null;
};

window.closeConfirmModalOnOverlay = function(event) {
    if (event.target === event.currentTarget) closeConfirmModal();
};

document.getElementById('confirmBtn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
});

// ==================== RENAME CATEGORY MODAL ====================
let renameCategoryId = null;
let renameCallback = null;

window.openRenameModal = function(categoryId, currentName, callback) {
    renameCategoryId = categoryId;
    renameCallback = callback;
    document.getElementById('rename_category_name').value = currentName;
    document.getElementById('renameCategoryModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        document.getElementById('rename_category_name').focus();
    }, 100);
};

window.closeRenameModal = function() {
    document.getElementById('renameCategoryModal').classList.remove('active');
    document.body.style.overflow = '';
    renameCategoryId = null;
    renameCallback = null;
};

window.closeRenameModalOnOverlay = function(event) {
    if (event.target === event.currentTarget) closeRenameModal();
};

window.confirmRename = function() {
    const newName = document.getElementById('rename_category_name').value.trim();
    if (newName && renameCallback) renameCallback(renameCategoryId, newName);
    closeRenameModal();
};

// ==================== DELETE CATEGORY MODAL ====================
let deleteCategoryId = null;
let deleteCategoryCallback = null;

window.showDeleteCategoryModal = function(categoryId, hasChildren, callback) {
    deleteCategoryId = categoryId;
    deleteCategoryCallback = callback;

    const messageEl = document.getElementById('deleteCategoryMessage');
    const actionSelect = document.getElementById('deleteCategoryAction');

    if (hasChildren) {
        messageEl.textContent = 'У этой категории есть подкатегории. Выберите действие:';
        actionSelect.style.display = 'block';
        actionSelect.disabled = false;
    } else {
        messageEl.textContent = 'Удалить эту категорию?';
        actionSelect.style.display = 'none';
        actionSelect.disabled = true;
    }

    document.getElementById('deleteCategoryModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
        const confirmBtn = document.getElementById('deleteCategoryConfirmBtn');
        if (confirmBtn) confirmBtn.focus();
    }, 100);
};

window.closeDeleteCategoryModal = function() {
    document.getElementById('deleteCategoryModal').classList.remove('active');
    document.body.style.overflow = '';
    deleteCategoryId = null;
    deleteCategoryCallback = null;
};

window.closeDeleteCategoryModalOnOverlay = function(event) {
    if (event.target === event.currentTarget) closeDeleteCategoryModal();
};

document.getElementById('deleteCategoryConfirmBtn').addEventListener('click', function() {
    if (deleteCategoryCallback) {
        const action = document.getElementById('deleteCategoryAction').value;
        deleteCategoryCallback(deleteCategoryId, action);
    }
    closeDeleteCategoryModal();
});

// ==================== COLOR PICKER ====================
const ColorPicker = {
    hue: 24,
    sat: 100,
    val: 100,
    els: {},
    isDraggingGradient: false,
    isDraggingHue: false,
    onSelectCallback: null,

    init() {
        this.els = {
            modal: document.getElementById('colorPickerModal'),
            gradientArea: document.getElementById('cpGradientArea'),
            cursor: document.getElementById('cpCursor'),
            hueVertical: document.getElementById('cpHueVertical'),
            hueCursorVertical: document.getElementById('cpHueCursorVertical'),
            hex: document.getElementById('cpHexInput'),
            r: document.getElementById('cpRInput'),
            g: document.getElementById('cpGInput'),
            b: document.getElementById('cpBInput'),
            previewBox: document.getElementById('cpPreviewBox')
        };

        this.bindEvents();
        this.updateGradientBackground();
        this.setColor(24, 100, 100);
    },

    bindEvents() {
        this.els.gradientArea.addEventListener('mousedown', (e) => {
            this.isDraggingGradient = true;
            this.updateFromGradient(e);
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isDraggingGradient) this.updateFromGradient(e);
            if (this.isDraggingHue) this.updateFromHue(e);
        });

        document.addEventListener('mouseup', () => {
            this.isDraggingGradient = false;
            this.isDraggingHue = false;
        });

        this.els.hueVertical.addEventListener('mousedown', (e) => {
            this.isDraggingHue = true;
            this.updateFromHue(e);
            e.preventDefault();
        });

        this.els.hex.addEventListener('input', () => {
            let hex = this.els.hex.value.trim();
            if (!hex.startsWith('#')) hex = '#' + hex;
            if (/^#[0-9A-F]{6}$/i.test(hex)) {
                const rgb = this.hexToRgb(hex);
                if (rgb) {
                    const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
                    this.hue = hsv.h;
                    this.sat = hsv.s;
                    this.val = hsv.v;
                    this.updateUI();
                }
            }
        });

        ['r', 'g', 'b'].forEach(ch => {
            this.els[ch].addEventListener('input', () => {
                const r = parseInt(this.els.r.value) || 0;
                const g = parseInt(this.els.g.value) || 0;
                const b = parseInt(this.els.b.value) || 0;
                const hsv = this.rgbToHsv(r, g, b);
                this.hue = hsv.h;
                this.sat = hsv.s;
                this.val = hsv.v;
                this.updateUI();
            });
        });

        this.els.modal.addEventListener('click', (e) => {
            if (e.target === this.els.modal) closeColorPicker();
        });
    },

    updateGradientBackground() {
        const hueColor = `hsl(${this.hue}, 100%, 50%)`;
        this.els.gradientArea.style.background = `linear-gradient(to right, white, ${hueColor}), linear-gradient(to bottom, transparent, black)`;
        this.els.gradientArea.style.backgroundBlendMode = 'multiply';
    },

    updateFromGradient(e) {
        const rect = this.els.gradientArea.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;
        x = Math.max(0, Math.min(x, rect.width));
        y = Math.max(0, Math.min(y, rect.height));

        this.sat = (x / rect.width) * 100;
        this.val = 100 - (y / rect.height) * 100;

        this.sat = Math.max(0, Math.min(100, this.sat));
        this.val = Math.max(0, Math.min(100, this.val));

        this.updateUI();
    },

    updateFromHue(e) {
        const rect = this.els.hueVertical.getBoundingClientRect();
        let y = e.clientY - rect.top;
        y = Math.max(0, Math.min(y, rect.height));

        this.hue = (y / rect.height) * 360;
        this.hue = Math.max(0, Math.min(360, this.hue));

        this.updateUI();
    },

    updateUI() {
        this.updateGradientBackground();

        const rgb = this.hsvToRgb(this.hue, this.sat, this.val);
        const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);

        const gradientRect = this.els.gradientArea.getBoundingClientRect();
        if (gradientRect.width > 0) {
            const cursorX = (this.sat / 100) * gradientRect.width;
            const cursorY = (1 - this.val / 100) * gradientRect.height;
            this.els.cursor.style.left = `${cursorX}px`;
            this.els.cursor.style.top = `${cursorY}px`;
        }

        const hueRect = this.els.hueVertical.getBoundingClientRect();
        if (hueRect.height > 0) {
            const hueY = (this.hue / 360) * hueRect.height;
            this.els.hueCursorVertical.style.top = `${hueY}px`;
        }

        this.els.hex.value = hex.toUpperCase();
        this.els.r.value = rgb.r;
        this.els.g.value = rgb.g;
        this.els.b.value = rgb.b;

        if (this.els.previewBox) this.els.previewBox.style.background = hex;
        document.getElementById('selectedCategoryColor').value = hex;
    },

    setColor(h, s, v) {
        this.hue = h;
        this.sat = s;
        this.val = v;
        this.updateUI();
    },

    hsvToRgb(h, s, v) {
        h = Math.max(0, Math.min(360, h));
        s = Math.max(0, Math.min(100, s)) / 100;
        v = Math.max(0, Math.min(100, v)) / 100;

        let r, g, b;
        const i = Math.floor(h / 60);
        const f = h / 60 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            default: r = v; g = p; b = q; break;
        }

        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    },

    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max;
        const d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                default: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return { h: h * 360, s: s * 100, v: v * 100 };
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },

    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.max(0, Math.min(255, x)).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
};

window.openColorPicker = function(initialColor = '#ff7a00', callback = null) {
    ColorPicker.onSelectCallback = callback;
    const rgb = ColorPicker.hexToRgb(initialColor);
    if (rgb) {
        const hsv = ColorPicker.rgbToHsv(rgb.r, rgb.g, rgb.b);
        ColorPicker.setColor(hsv.h, hsv.s, hsv.v);
    }
    ColorPicker.els.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeColorPicker = function() {
    ColorPicker.els.modal.classList.remove('active');
    document.body.style.overflow = '';
    ColorPicker.onSelectCallback = null;
};

window.confirmColor = function() {
    const color = document.getElementById('selectedCategoryColor').value;
    if (ColorPicker.onSelectCallback) ColorPicker.onSelectCallback(color);
    closeColorPicker();
};

// Инициализация ColorPicker после загрузки DOM
document.addEventListener('DOMContentLoaded', () => ColorPicker.init());

// Глобальный обработчик Escape для закрытия модальных окон
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeConfirmModal();
        closeColorPicker();
        closeRenameModal();
        closeDeleteCategoryModal();
    }
});