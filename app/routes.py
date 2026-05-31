from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, Response
from flask_login import login_user, login_required, logout_user, current_user
from app import db, login_manager
from app.models import User, Family, Category, Transaction, Invitation, UserPlan, FamilyPlan
from app.utils import (
    get_category_with_children_ids, calculate_limit_status, build_chart_items, build_category_tree
)
from datetime import datetime, timedelta
from sqlalchemy import func
import uuid
import csv
from io import StringIO
from decimal import Decimal

main_bp = Blueprint('main', __name__)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# ==================== АУТЕНТИФИКАЦИЯ ======================================== АУТЕНТИФИКАЦИЯ ======================================== АУТЕНТИФИКАЦИЯ ====================

@main_bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    return render_template('index.html')


@main_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        user = User.query.filter_by(login=request.form['login']).first()
        if user and user.check_password(request.form['password']):
            login_user(user)
            next_page = request.args.get('next')
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': True, 'redirect': next_page or url_for('main.dashboard')})
            return redirect(next_page or url_for('main.dashboard'))

        # Ошибка авторизации
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'Неверный логин или пароль'}), 401
        flash('Неверный логин или пароль', 'danger')
        return render_template('login.html')

    return render_template('login.html')


@main_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        # Проверка паролей
        if request.form['password'] != request.form['confirm_password']:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'error': 'Пароли не совпадают'}), 400
            flash('Пароли не совпадают', 'danger')
            return redirect(url_for('main.register'))

        # Проверка логина
        if User.query.filter_by(login=request.form['login']).first():
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'error': 'Логин уже занят'}), 400
            flash('Логин уже занят', 'danger')
            return redirect(url_for('main.register'))

        # Создание пользователя
        user = User(
            surname=request.form['surname'],
            name=request.form['name'],
            patronymic=request.form.get('patronymic'),
            login=request.form['login']
        )
        user.set_password(request.form['password'])
        user.role = 'Администратор'

        db.session.add(user)
        db.session.commit()

        login_user(user)

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': True, 'redirect': url_for('main.choose_action')})

        flash('Регистрация успешна! Теперь создайте семью или примите приглашение', 'success')
        return redirect(url_for('main.choose_action'))

    return render_template('register.html')


@main_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Вы вышли из системы', 'info')
    return redirect(url_for('main.login'))


# ==================== ОСНОВНЫЕ СТРАНИЦЫ ======================================== ОСНОВНЫЕ СТРАНИЦЫ ======================================== ОСНОВНЫЕ СТРАНИЦЫ ====================

@main_bp.route('/choose-action')
@login_required
def choose_action():
    if current_user.family_id:
        return redirect(url_for('main.dashboard'))
    return render_template('choose_action.html')


@main_bp.route('/no-family')
@login_required
def no_family():
    return render_template('no_family.html')


@main_bp.route('/dashboard')
@login_required
def dashboard():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))

    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    family_users = User.query.filter_by(family_id=current_user.family_id).all()
    user_ids = [u.id for u in family_users]

    month_income = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= month_start.date(),
        Transaction.category_id.in_(
            db.session.query(Category.id).filter(Category.type == 'Доход')
        )
    ).scalar() or 0
    month_income = float(month_income)

    month_expenses = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= month_start.date(),
        Transaction.category_id.in_(
            db.session.query(Category.id).filter(Category.type == 'Расход')
        )
    ).scalar() or 0
    month_expenses = float(month_expenses)

    balance = month_income - month_expenses

    if month_start.month == 1:
        prev_month_start = month_start.replace(year=month_start.year - 1, month=12)
    else:
        prev_month_start = month_start.replace(month=month_start.month - 1)

    prev_income = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= prev_month_start.date(),
        Transaction.date < month_start.date(),
        Transaction.category_id.in_(
            db.session.query(Category.id).filter(Category.type == 'Доход')
        )
    ).scalar() or 0
    prev_income = float(prev_income)

    prev_expenses = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= prev_month_start.date(),
        Transaction.date < month_start.date(),
        Transaction.category_id.in_(
            db.session.query(Category.id).filter(Category.type == 'Расход')
        )
    ).scalar() or 0
    prev_expenses = float(prev_expenses)

    prev_balance = prev_income - prev_expenses

    if prev_balance != 0:
        balance_change = ((balance - prev_balance) / abs(prev_balance)) * 100
    else:
        balance_change = 100 if balance > 0 else 0

    last_transactions = Transaction.query.join(User).filter(
        User.family_id == current_user.family_id
    ).order_by(Transaction.date.desc(), Transaction.time.desc()).limit(10).all()

    all_categories = Category.query.filter_by(family_id=current_user.family_id).all()
    hierarchical_categories = build_category_tree(all_categories)
    expense_categories = [cat for cat in all_categories if cat.type == 'Расход']

    family_limits = []
    if current_user.role in ['Создатель', 'Администратор']:
        family_plans = FamilyPlan.query.filter_by(family_id=current_user.family_id).all()
        for plan in family_plans:
            category = Category.query.get(plan.category_id)
            if not category:
                continue

            category_ids = get_category_with_children_ids(category)
            spent = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id.in_(user_ids),
                Transaction.category_id.in_(category_ids),
                Transaction.date >= month_start.date()
            ).scalar() or 0
            spent = float(spent)
            limit_amount = float(plan.limit_amount)
            percent = (spent / limit_amount) * 100 if limit_amount > 0 else 0
            is_exceeded = spent > limit_amount

            family_limits.append({
                'category_id': plan.category_id,
                'category_name': category.name,
                'limit_amount': limit_amount,
                'spent': spent,
                'percent': min(percent, 100),
                'is_exceeded': is_exceeded
            })

    members_count = len(family_users)

    # Строим данные для диаграммы
    chart_items_result = build_chart_items(None, user_ids, now)

    chart_data = {
        'items': chart_items_result['items'],
        'total': chart_items_result['total'],
        'current_category_id': None,
        'current_category_name': None,
        'history': []
    }

    return render_template(
        'dashboard.html',
        balance=balance,
        balance_change=balance_change,
        month_expenses=month_expenses,
        expense_percent=int((month_expenses / (month_income or 1)) * 100) if month_income > 0 else 0,
        budget_limit=month_income > 0,
        members_count=members_count,
        last_transactions=last_transactions,
        categories=hierarchical_categories,
        expense_categories=expense_categories,
        family_limits=family_limits,
        chart_data=chart_data
    )


# ==================== API ДЛЯ ДИНАМИЧЕСКОГО ОБНОВЛЕНИЯ DASHBOARD ======================================== API ДЛЯ ДИНАМИЧЕСКОГО ОБНОВЛЕНИЯ DASHBOARD ======================================== API ДЛЯ ДИНАМИЧЕСКОГО ОБНОВЛЕНИЯ DASHBOARD ====================

@main_bp.route('/api/dashboard-stats')
@login_required
def api_dashboard_stats():
    if not current_user.family_id:
        return jsonify({'success': False, 'error': 'Семья не найдена'}), 400

    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    family_users = User.query.filter_by(family_id=current_user.family_id).all()
    user_ids = [u.id for u in family_users]

    month_income = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= month_start.date(),
        Transaction.category_id.in_(
            db.session.query(Category.id).filter(Category.type == 'Доход')
        )
    ).scalar() or 0
    month_income = float(month_income)

    month_expenses = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= month_start.date(),
        Transaction.category_id.in_(
            db.session.query(Category.id).filter(Category.type == 'Расход')
        )
    ).scalar() or 0
    month_expenses = float(month_expenses)

    balance = month_income - month_expenses

    if month_start.month == 1:
        prev_month_start = month_start.replace(year=month_start.year - 1, month=12)
    else:
        prev_month_start = month_start.replace(month=month_start.month - 1)

    prev_income = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= prev_month_start.date(),
        Transaction.date < month_start.date(),
        Transaction.category_id.in_(
            db.session.query(Category.id).filter(Category.type == 'Доход')
        )
    ).scalar() or 0
    prev_income = float(prev_income)

    prev_expenses = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= prev_month_start.date(),
        Transaction.date < month_start.date(),
        Transaction.category_id.in_(
            db.session.query(Category.id).filter(Category.type == 'Расход')
        )
    ).scalar() or 0
    prev_expenses = float(prev_expenses)

    prev_balance = prev_income - prev_expenses

    if prev_balance != 0:
        balance_change = ((balance - prev_balance) / abs(prev_balance)) * 100
    else:
        balance_change = 100 if balance > 0 else 0

    expense_percent = int((month_expenses / (month_income or 1)) * 100) if month_income > 0 else 0

    return jsonify({
        'success': True,
        'balance': balance,
        'balance_change': balance_change,
        'month_expenses': month_expenses,
        'expense_percent': expense_percent,
        'members_count': len(family_users)
    })


@main_bp.route('/api/last-transactions')
@login_required
def api_last_transactions():
    if not current_user.family_id:
        return jsonify({'success': False, 'error': 'Семья не найдена'}), 400

    transactions = Transaction.query.join(User).filter(
        User.family_id == current_user.family_id
    ).order_by(Transaction.date.desc(), Transaction.time.desc()).limit(10).all()

    return jsonify({
        'success': True,
        'transactions': [{
            'id': t.id,
            'date': t.date.strftime('%d.%m.%Y'),
            'category_name': t.category.name,
            'category_color': t.category.color,
            'category_type': t.category.type,
            'amount': float(t.amount),
            'author': f"{t.author.surname} {t.author.name}"
        } for t in transactions]
    })


@main_bp.route('/api/limits-data')
@login_required
def api_limits_data():
    if not current_user.family_id:
        return jsonify({'success': False, 'error': 'Семья не найдена'}), 400

    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    family_users = User.query.filter_by(family_id=current_user.family_id).all()
    user_ids = [u.id for u in family_users]

    family_limits = []
    if current_user.role in ['Создатель', 'Администратор']:
        family_plans = FamilyPlan.query.filter_by(family_id=current_user.family_id).all()
        for plan in family_plans:
            category = Category.query.get(plan.category_id)
            if not category:
                continue

            category_ids = get_category_with_children_ids(category)
            spent = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id.in_(user_ids),
                Transaction.category_id.in_(category_ids),
                Transaction.date >= month_start.date()
            ).scalar() or 0
            spent = float(spent)
            limit_amount = float(plan.limit_amount)
            percent = (spent / limit_amount) * 100 if limit_amount > 0 else 0
            is_exceeded = spent > limit_amount

            family_limits.append({
                'category_id': plan.category_id,
                'category_name': category.name,
                'limit_amount': limit_amount,
                'spent': spent,
                'percent': min(percent, 100),
                'is_exceeded': is_exceeded
            })

    return jsonify({
        'success': True,
        'family_limits': family_limits
    })


# ==================== УПРАВЛЕНИЕ СЕМЬЁЙ ======================================== УПРАВЛЕНИЕ СЕМЬЁЙ ======================================== УПРАВЛЕНИЕ СЕМЬЁЙ ====================

@main_bp.route('/create-family', methods=['GET', 'POST'])
@login_required
def create_family():
    if current_user.family_id:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        family = Family(
            name=request.form['family_name'],
            creator_id=current_user.id
        )
        db.session.add(family)
        db.session.flush()

        current_user.family_id = family.id
        current_user.role = 'Создатель'
        db.session.commit()

        default_categories = [
            ('Продукты', 'Расход', '#ff7a00', False),
            ('Транспорт', 'Расход', '#10b981', False),
            ('Коммунальные услуги', 'Расход', '#3b82f6', False),
            ('Развлечения', 'Расход', '#8b5cf6', False),
            ('Зарплата', 'Доход', '#22c55e', False),
            ('Прочее', 'Расход', '#6c757d', True)
        ]

        for name, cat_type, color, is_protected in default_categories:
            category = Category(
                family_id=family.id,
                name=name,
                type=cat_type,
                color=color,
                is_protected=is_protected
            )
            db.session.add(category)

        db.session.commit()
        flash(f'Семья "{family.name}" успешно создана!', 'success')
        return redirect(url_for('main.dashboard'))

    return render_template('create_family.html')


@main_bp.route('/join-by-code', methods=['POST'])
@login_required
def join_family_by_code():
    if current_user.family_id:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'Вы уже состоите в семье'}), 400
        flash('Вы уже состоите в семье', 'warning')
        return redirect(url_for('main.dashboard'))

    code = request.form.get('invite_code')
    if not code:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'Введите код приглашения'}), 400
        flash('Введите код приглашения', 'danger')
        return redirect(url_for('main.choose_action'))

    invite = Invitation.query.filter_by(code=code, status='Ожидает').first()

    if not invite:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'Неверный код приглашения'}), 404
        flash('Неверный код приглашения', 'danger')
        return redirect(url_for('main.choose_action'))

    if invite.expires_at and invite.expires_at < datetime.utcnow():
        invite.status = 'Истёк'
        db.session.commit()
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'Срок действия приглашения истёк'}), 400
        flash('Срок действия приглашения истёк', 'danger')
        return redirect(url_for('main.choose_action'))

    current_user.family_id = invite.family_id
    current_user.role = 'Участник'
    invite.status = 'Принят'
    db.session.commit()

    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return jsonify({'success': True, 'redirect': url_for('main.dashboard')})

    flash('Вы успешно присоединились к семье!', 'success')
    return redirect(url_for('main.dashboard'))


@main_bp.route('/generate-invite', methods=['POST'])
@login_required
def generate_invite():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    if current_user.role not in ['Создатель', 'Администратор']:
        return jsonify({'error': 'Доступ запрещён'}), 403

    invite = Invitation(
        family_id=current_user.family_id,
        code=uuid.uuid4().hex[:12].upper(),
        status='Ожидает',
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.session.add(invite)
    db.session.commit()

    return jsonify({'code': invite.code})


@main_bp.route('/invite/<int:invite_id>', methods=['DELETE'])
@login_required
def delete_invite(invite_id):
    invite = Invitation.query.get_or_404(invite_id)

    if invite.family_id != current_user.family_id:
        return jsonify({'error': 'Доступ запрещён'}), 403

    if current_user.role not in ['Создатель', 'Администратор']:
        return jsonify({'error': 'Доступ запрещён'}), 403

    invite.status = 'Отозвано'
    db.session.commit()

    return jsonify({'success': True})


@main_bp.route('/family-settings')
@login_required
def family_settings():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))

    family = Family.query.get(current_user.family_id)
    members = User.query.filter_by(family_id=current_user.family_id).all()

    active_invites = Invitation.query.filter_by(
        family_id=current_user.family_id,
        status='Ожидает'
    ).order_by(Invitation.expires_at).all()

    old_invitations = Invitation.query.filter(
        Invitation.family_id == current_user.family_id,
        Invitation.status != 'Ожидает'
    ).order_by(Invitation.expires_at.desc()).limit(20).all()

    return render_template(
        'family_settings.html',
        family=family,
        members=members,
        active_invites=active_invites,
        old_invitations=old_invitations
    )


@main_bp.route('/api/family-data')
@login_required
def api_family_data():
    if not current_user.family_id:
        return jsonify({'success': False, 'error': 'Семья не найдена'}), 400

    family = Family.query.get(current_user.family_id)
    members = User.query.filter_by(family_id=current_user.family_id).all()

    active_invites = Invitation.query.filter_by(
        family_id=current_user.family_id,
        status='Ожидает'
    ).order_by(Invitation.expires_at).all()

    old_invitations = Invitation.query.filter(
        Invitation.family_id == current_user.family_id,
        Invitation.status != 'Ожидает'
    ).order_by(Invitation.expires_at.desc()).limit(20).all()

    return jsonify({
        'success': True,
        'family': {
            'id': family.id,
            'name': family.name,
            'created_at': family.created_at.strftime('%d.%m.%Y')
        },
        'members': [{
            'id': m.id,
            'full_name': f"{m.surname} {m.name} {m.patronymic or ''}".strip(),
            'role': m.role,
            'reg_date': m.reg_date.strftime('%d.%m.%Y'),
            'is_current_user': m.id == current_user.id
        } for m in members],
        'active_invites': [{
            'id': inv.id,
            'code': inv.code,
            'expires_at': inv.expires_at.strftime('%d.%m.%Y %H:%M') if inv.expires_at else '—'
        } for inv in active_invites],
        'old_invitations': [{
            'id': inv.id,
            'code': inv.code,
            'status': inv.status,
            'expires_at': inv.expires_at.strftime('%d.%m.%Y %H:%M') if inv.expires_at else '—'
        } for inv in old_invitations],
        'current_user_role': current_user.role,
        'current_user_id': current_user.id
    })


@main_bp.route('/family/rename', methods=['PUT'])
@login_required
def rename_family():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    if current_user.role not in ['Создатель', 'Администратор']:
        return jsonify({'error': 'Доступ запрещён'}), 403

    data = request.get_json()
    new_name = data.get('name', '').strip()

    if not new_name:
        return jsonify({'error': 'Название семьи не может быть пустым'}), 400

    if len(new_name) > 100:
        return jsonify({'error': 'Название не должно превышать 100 символов'}), 400

    family = Family.query.get(current_user.family_id)
    if not family:
        return jsonify({'error': 'Семья не найдена'}), 404

    family.name = new_name
    db.session.commit()

    return jsonify({'success': True})


@main_bp.route('/family/delete', methods=['DELETE'])
@login_required
def delete_family():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    if current_user.role != 'Создатель':
        return jsonify({'error': 'Доступ запрещён'}), 403

    family_id = current_user.family_id
    family = Family.query.get(family_id)

    if not family:
        return jsonify({'error': 'Семья не найдена'}), 404

    members = User.query.filter_by(family_id=family_id).all()
    for member in members:
        member.family_id = None
        member.role = 'Участник'

    Invitation.query.filter_by(family_id=family_id).delete()
    FamilyPlan.query.filter_by(family_id=family_id).delete()

    categories = Category.query.filter_by(family_id=family_id).all()
    for cat in categories:
        Transaction.query.filter_by(category_id=cat.id).delete()

    Category.query.filter_by(family_id=family_id).delete()
    db.session.delete(family)
    db.session.commit()

    return jsonify({'success': True})


@main_bp.route('/family/leave', methods=['POST'])
@login_required
def leave_family():
    if not current_user.family_id:
        return jsonify({'error': 'Вы не состоите в семье'}), 400

    family_id = current_user.family_id
    family = Family.query.get(family_id)
    other_members = User.query.filter(User.family_id == family_id, User.id != current_user.id).all()

    if current_user.role == 'Создатель':
        if other_members:
            new_creator = None
            for member in other_members:
                if member.role == 'Администратор':
                    new_creator = member
                    break
            if not new_creator:
                new_creator = other_members[0]
            new_creator.role = 'Создатель'
        else:
            db.session.delete(family)
            current_user.family_id = None
            current_user.role = 'Участник'
            db.session.commit()
            return jsonify({'success': True, 'family_deleted': True})

    current_user.family_id = None
    current_user.role = 'Участник'
    db.session.commit()

    return jsonify({'success': True})


@main_bp.route('/family/remove-member', methods=['POST'])
@login_required
def remove_member():
    if current_user.role not in ['Создатель', 'Администратор']:
        return jsonify({'error': 'Доступ запрещён'}), 403

    data = request.get_json()
    user_id = data.get('user_id')

    user = User.query.get(user_id)
    if not user or user.family_id != current_user.family_id:
        return jsonify({'error': 'Пользователь не найден'}), 404

    if user.id == current_user.id:
        return jsonify({'error': 'Нельзя исключить себя'}), 400

    if user.role == 'Создатель':
        return jsonify({'error': 'Нельзя исключить создателя семьи'}), 400

    user.family_id = None
    user.role = 'Участник'
    db.session.commit()

    return jsonify({'success': True})


@main_bp.route('/family/change-role', methods=['POST'])
@login_required
def change_member_role():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    data = request.get_json()
    user_id = data.get('user_id')
    new_role = data.get('role')

    user = User.query.get(user_id)
    if not user or user.family_id != current_user.family_id:
        return jsonify({'error': 'Пользователь не найден'}), 404

    if current_user.role != 'Создатель':
        return jsonify({'error': 'Только создатель семьи может менять роли'}), 403

    if user.id == current_user.id:
        return jsonify({'error': 'Нельзя изменить свою роль'}), 400

    user.role = new_role
    db.session.commit()

    return jsonify({'success': True})


@main_bp.route('/family/transfer-ownership', methods=['POST'])
@login_required
def transfer_ownership():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    if current_user.role != 'Создатель':
        return jsonify({'error': 'Только создатель может передать права'}), 403

    data = request.get_json()
    new_creator_id = data.get('new_creator_id')

    new_creator = User.query.get(new_creator_id)
    if not new_creator or new_creator.family_id != current_user.family_id:
        return jsonify({'error': 'Пользователь не найден'}), 404

    current_user.role = 'Администратор'
    new_creator.role = 'Создатель'
    db.session.commit()

    return jsonify({'success': True})


# ==================== КАТЕГОРИИ ======================================== КАТЕГОРИИ ======================================== КАТЕГОРИИ ====================

@main_bp.route('/categories')
@login_required
def categories():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))

    all_categories = Category.query.filter_by(family_id=current_user.family_id).all()

    def build_tree(cats, parent_id=None):
        tree = []
        for cat in cats:
            if cat.parent_id == parent_id:
                tree.append({
                    'id': cat.id,
                    'name': cat.name,
                    'type': cat.type,
                    'color': cat.color,
                    'parent_id': cat.parent_id,
                    'children': build_tree(cats, cat.id)
                })
        tree.sort(key=lambda x: x['name'].lower())
        return tree

    category_tree = build_tree(all_categories)
    hierarchical_categories = build_category_tree(all_categories)

    return render_template(
        'categories.html',
        categories=category_tree,
        all_categories=all_categories,
        hierarchical_categories=hierarchical_categories
    )


@main_bp.route('/api/categories-tree')
@login_required
def api_categories_tree():
    if not current_user.family_id:
        return jsonify({'success': False, 'error': 'Семья не найдена'}), 400

    all_categories = Category.query.filter_by(family_id=current_user.family_id).all()

    def build_tree(cats, parent_id=None):
        tree = []
        for cat in cats:
            if cat.parent_id == parent_id:
                tree.append({
                    'id': cat.id,
                    'name': cat.name,
                    'type': cat.type,
                    'color': cat.color,
                    'parent_id': cat.parent_id,
                    'is_protected': cat.is_protected,
                    'children': build_tree(cats, cat.id)
                })
        tree.sort(key=lambda x: x['name'].lower())
        return tree

    category_tree = build_tree(all_categories)

    # Также возвращаем плоский список для выпадающих списков
    hierarchical_categories = build_category_tree(all_categories)

    return jsonify({
        'success': True,
        'tree': category_tree,
        'flat': hierarchical_categories
    })


@main_bp.route('/category/add', methods=['POST'])
@login_required
def add_category():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    data = request.get_json()

    category = Category(
        family_id=current_user.family_id,
        name=data['name'],
        type=data['type'],
        color=data.get('color', '#6c757d'),
        parent_id=data.get('parent_id') if data.get('parent_id') else None
    )

    db.session.add(category)
    db.session.commit()

    return jsonify({'id': category.id, 'name': category.name, 'type': category.type, 'color': category.color})


@main_bp.route('/category/<int:category_id>', methods=['PUT'])
@login_required
def update_category(category_id):
    category = Category.query.get_or_404(category_id)

    if category.family_id != current_user.family_id:
        return jsonify({'error': 'Доступ запрещён'}), 403

    data = request.get_json()

    if 'name' in data:
        category.name = data['name']
    if 'type' in data:
        category.type = data['type']
    if 'color' in data:
        category.color = data['color']
    if 'parent_id' in data:
        category.parent_id = data['parent_id'] if data['parent_id'] else None

    db.session.commit()

    return jsonify({'success': True})


@main_bp.route('/category/<int:category_id>', methods=['DELETE'])
@login_required
def delete_category(category_id):
    category = Category.query.get_or_404(category_id)

    if category.family_id != current_user.family_id:
        return jsonify({'error': 'Доступ запрещён'}), 403

    if category.is_protected:
        return jsonify({'error': 'Нельзя удалить системную категорию "Прочее"'}), 400

    other_category = Category.query.filter_by(
        family_id=current_user.family_id,
        name='Прочее',
        type='Расход'
    ).first()

    if not other_category:
        other_category = Category(
            family_id=current_user.family_id,
            name='Прочее',
            type='Расход',
            color='#6c757d',
            is_protected=True
        )
        db.session.add(other_category)
        db.session.commit()

    data = request.get_json()
    delete_action = data.get('action', 'delete_children') if data else 'delete_children'

    def get_all_descendant_ids(cat):
        ids = [cat.id]
        for child in cat.children:
            ids.extend(get_all_descendant_ids(child))
        return ids

    all_category_ids = get_all_descendant_ids(category)

    Transaction.query.filter(Transaction.category_id.in_(all_category_ids)).update(
        {Transaction.category_id: other_category.id},
        synchronize_session=False
    )

    UserPlan.query.filter(UserPlan.category_id.in_(all_category_ids)).delete(synchronize_session=False)
    FamilyPlan.query.filter(FamilyPlan.category_id.in_(all_category_ids)).delete(synchronize_session=False)

    if delete_action == 'delete_children':
        for cat_id in all_category_ids:
            cat = Category.query.get(cat_id)
            if cat and cat.id != other_category.id:
                db.session.delete(cat)
    else:
        for child in category.children:
            child.parent_id = None
        db.session.delete(category)

    db.session.commit()
    return jsonify({'success': True})


@main_bp.route('/category/move', methods=['POST'])
@login_required
def move_category():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    data = request.get_json()
    category_id = data.get('category_id')
    target_id = data.get('target_id')
    position = data.get('position')

    category = Category.query.get_or_404(category_id)
    if category.family_id != current_user.family_id:
        return jsonify({'error': 'Доступ запрещён'}), 403

    if position == 'root':
        category.parent_id = None
        db.session.commit()
        return jsonify({'success': True})

    if not target_id:
        return jsonify({'error': 'Целевая категория не указана'}), 400

    target = Category.query.get_or_404(target_id)
    if target.family_id != current_user.family_id:
        return jsonify({'error': 'Доступ запрещён'}), 403

    def is_descendant(parent_id, child_id):
        child = Category.query.get(child_id)
        while child and child.parent_id:
            if child.parent_id == parent_id:
                return True
            child = Category.query.get(child.parent_id)
        return False

    if category_id == target_id or is_descendant(category_id, target_id):
        return jsonify({'error': 'Нельзя переместить категорию в саму себя или в подкатегорию'}), 400

    if position == 'inside':
        category.parent_id = target_id
    elif position in ('before', 'after'):
        category.parent_id = target.parent_id

    db.session.commit()
    return jsonify({'success': True})


# ==================== ТРАНЗАКЦИИ ======================================== ТРАНЗАКЦИИ ======================================== ТРАНЗАКЦИИ ====================

@main_bp.route('/add-transaction', methods=['GET', 'POST'])
@login_required
def add_transaction():
    if not current_user.family_id:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'Семья не найдена'}), 400
        return redirect(url_for('main.no_family'))

    if request.method == 'POST':
        category_id = request.form.get('category_id')
        amount = request.form.get('amount')
        date_str = request.form.get('date')
        time_str = request.form.get('time', '00:00')
        comment = request.form.get('comment', '')

        category = Category.query.get(category_id)
        if not category or category.family_id != current_user.family_id:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'error': 'Категория не найдена'}), 404
            flash('Категория не найдена', 'danger')
            return redirect(url_for('main.add_transaction'))

        try:
            amount = Decimal(amount)
            if amount <= 0:
                if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                    return jsonify({'success': False, 'error': 'Сумма должна быть положительной'}), 400
                flash('Сумма должна быть положительной', 'danger')
                return redirect(url_for('main.add_transaction'))
        except (ValueError, TypeError):
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({'success': False, 'error': 'Неверный формат суммы'}), 400
            flash('Неверный формат суммы', 'danger')
            return redirect(url_for('main.add_transaction'))

        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        time = datetime.strptime(time_str, '%H:%M').time()

        transaction = Transaction(
            user_id=current_user.id,
            category_id=category.id,
            amount=amount,
            date=date,
            time=time,
            comment=comment
        )

        db.session.add(transaction)
        db.session.commit()

        warning = calculate_limit_status(current_user, category, amount, date)

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            response_data = {'success': True}
            if warning:
                response_data['warning'] = warning
            return jsonify(response_data)

        if warning:
            flash(warning, 'warning')
        else:
            flash('Транзакция успешно добавлена', 'success')

        return redirect(url_for('main.transactions', added=1))

    all_categories = Category.query.filter_by(family_id=current_user.family_id).all()
    hierarchical_categories = build_category_tree(all_categories)

    return render_template('add_transaction.html', categories=hierarchical_categories)


@main_bp.route('/transactions')
@login_required
def transactions():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))

    all_transactions = Transaction.query.join(User).filter(
        User.family_id == current_user.family_id
    ).order_by(Transaction.date.desc(), Transaction.time.desc()).all()

    categories = Category.query.filter_by(family_id=current_user.family_id).order_by(Category.name).all()

    return render_template('transactions.html', transactions=all_transactions, categories=categories)


@main_bp.route('/api/transactions')
@login_required
def api_transactions():
    if not current_user.family_id:
        return jsonify({'success': False, 'error': 'Семья не найдена'}), 400

    all_transactions = Transaction.query.join(User).filter(
        User.family_id == current_user.family_id
    ).order_by(Transaction.date.desc(), Transaction.time.desc()).all()

    categories = Category.query.filter_by(family_id=current_user.family_id).all()
    categories_list = [{'id': c.id, 'name': c.name, 'type': c.type, 'color': c.color} for c in categories]

    transactions_list = []
    for txn in all_transactions:
        transactions_list.append({
            'id': txn.id,
            'date': txn.date.strftime('%d.%m.%Y'),
            'time': txn.time.strftime('%H:%M') if txn.time else '—',
            'author': f"{txn.author.surname} {txn.author.name}",
            'category_id': txn.category.id,
            'category_name': txn.category.name,
            'category_color': txn.category.color,
            'category_type': txn.category.type,
            'amount': float(txn.amount),
            'comment': txn.comment or '—'
        })

    return jsonify({
        'success': True,
        'transactions': transactions_list,
        'categories': categories_list
    })


@main_bp.route('/transaction/<int:transaction_id>', methods=['DELETE'])
@login_required
def delete_transaction(transaction_id):
    transaction = Transaction.query.get_or_404(transaction_id)

    if transaction.user_id != current_user.id and current_user.role != 'Администратор':
        return jsonify({'error': 'Доступ запрещён'}), 403

    db.session.delete(transaction)
    db.session.commit()

    return jsonify({'success': True})


@main_bp.route('/transaction/<int:transaction_id>', methods=['PUT'])
@login_required
def update_transaction(transaction_id):
    transaction = Transaction.query.get_or_404(transaction_id)

    if transaction.user_id != current_user.id and current_user.role not in ['Создатель', 'Администратор']:
        return jsonify({'error': 'Доступ запрещён'}), 403

    data = request.get_json()

    if 'category_id' in data:
        new_category = Category.query.get(data['category_id'])
        if not new_category or new_category.family_id != current_user.family_id:
            return jsonify({'error': 'Категория не найдена'}), 404
        transaction.category_id = new_category.id

    if 'amount' in data:
        transaction.amount = Decimal(str(data['amount']))

    if 'date' in data:
        transaction.date = datetime.strptime(data['date'], '%Y-%m-%d').date()

    if 'time' in data:
        transaction.time = datetime.strptime(data['time'], '%H:%M').time()

    if 'comment' in data:
        transaction.comment = data['comment']

    db.session.commit()

    return jsonify({'success': True})


# ==================== ЛИМИТЫ ======================================== ЛИМИТЫ ======================================== ЛИМИТЫ ====================

@main_bp.route('/limits')
@login_required
def limits():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))

    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    family_users = User.query.filter_by(family_id=current_user.family_id).all()
    user_ids = [u.id for u in family_users]

    expense_categories = Category.query.filter_by(family_id=current_user.family_id, type='Расход').order_by(
        Category.name).all()

    personal_plans = UserPlan.query.filter_by(user_id=current_user.id).all()
    personal_limits = []

    for plan in personal_plans:
        category = Category.query.get(plan.category_id)
        if not category:
            continue

        category_ids = get_category_with_children_ids(category)
        spent = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == current_user.id,
            Transaction.category_id.in_(category_ids),
            Transaction.date >= month_start.date()
        ).scalar() or 0
        spent = float(spent)
        limit_amount = float(plan.limit_amount)
        percent = (spent / limit_amount) * 100 if limit_amount > 0 else 0
        is_exceeded = spent > limit_amount

        personal_limits.append({
            'category_id': plan.category_id,
            'category_name': category.name,
            'limit_amount': limit_amount,
            'spent': spent,
            'percent': min(percent, 100),
            'is_exceeded': is_exceeded
        })

    family_limits = []
    if current_user.role in ['Создатель', 'Администратор']:
        family_plans = FamilyPlan.query.filter_by(family_id=current_user.family_id).all()
        for plan in family_plans:
            category = Category.query.get(plan.category_id)
            if not category:
                continue

            category_ids = get_category_with_children_ids(category)
            spent = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id.in_(user_ids),
                Transaction.category_id.in_(category_ids),
                Transaction.date >= month_start.date()
            ).scalar() or 0
            spent = float(spent)
            limit_amount = float(plan.limit_amount)
            percent = (spent / limit_amount) * 100 if limit_amount > 0 else 0
            is_exceeded = spent > limit_amount

            family_limits.append({
                'category_id': plan.category_id,
                'category_name': category.name,
                'limit_amount': limit_amount,
                'spent': spent,
                'percent': min(percent, 100),
                'is_exceeded': is_exceeded
            })

    return render_template(
        'limits.html',
        personal_limits=personal_limits,
        family_limits=family_limits,
        expense_categories=expense_categories
    )


@main_bp.route('/api/limits-full')
@login_required
def api_limits_full():
    if not current_user.family_id:
        return jsonify({'success': False, 'error': 'Семья не найдена'}), 400

    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    family_users = User.query.filter_by(family_id=current_user.family_id).all()
    user_ids = [u.id for u in family_users]

    expense_categories = Category.query.filter_by(family_id=current_user.family_id, type='Расход').order_by(Category.name).all()
    expense_categories_list = [{'id': c.id, 'name': c.name, 'color': c.color} for c in expense_categories]

    # Личные лимиты
    personal_plans = UserPlan.query.filter_by(user_id=current_user.id).all()
    personal_limits = []

    for plan in personal_plans:
        category = Category.query.get(plan.category_id)
        if not category:
            continue

        category_ids = get_category_with_children_ids(category)
        spent = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id == current_user.id,
            Transaction.category_id.in_(category_ids),
            Transaction.date >= month_start.date()
        ).scalar() or 0
        spent = float(spent)
        limit_amount = float(plan.limit_amount)
        percent = (spent / limit_amount) * 100 if limit_amount > 0 else 0
        is_exceeded = spent > limit_amount

        personal_limits.append({
            'category_id': plan.category_id,
            'category_name': category.name,
            'limit_amount': limit_amount,
            'spent': spent,
            'percent': min(percent, 100),
            'is_exceeded': is_exceeded
        })

    # Семейные лимиты
    family_limits = []
    if current_user.role in ['Создатель', 'Администратор']:
        family_plans = FamilyPlan.query.filter_by(family_id=current_user.family_id).all()
        for plan in family_plans:
            category = Category.query.get(plan.category_id)
            if not category:
                continue

            category_ids = get_category_with_children_ids(category)
            spent = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id.in_(user_ids),
                Transaction.category_id.in_(category_ids),
                Transaction.date >= month_start.date()
            ).scalar() or 0
            spent = float(spent)
            limit_amount = float(plan.limit_amount)
            percent = (spent / limit_amount) * 100 if limit_amount > 0 else 0
            is_exceeded = spent > limit_amount

            family_limits.append({
                'category_id': plan.category_id,
                'category_name': category.name,
                'limit_amount': limit_amount,
                'spent': spent,
                'percent': min(percent, 100),
                'is_exceeded': is_exceeded
            })

    return jsonify({
        'success': True,
        'personal_limits': personal_limits,
        'family_limits': family_limits,
        'expense_categories': expense_categories_list,
        'is_admin': current_user.role in ['Создатель', 'Администратор']
    })


@main_bp.route('/set-limit', methods=['POST'])
@login_required
def set_limit():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    data = request.get_json()
    category_id = data.get('category_id')
    limit_type = data.get('limit_type')
    amount = data.get('amount')

    if not category_id or not amount:
        return jsonify({'error': 'Заполните все поля'}), 400

    category = Category.query.get(category_id)
    if not category or category.family_id != current_user.family_id:
        return jsonify({'error': 'Категория не найдена'}), 404

    amount = Decimal(str(amount))
    today = datetime.now().date()
    month_start = today.replace(day=1)
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)

    if limit_type == 'family':
        if current_user.role not in ['Создатель', 'Администратор']:
            return jsonify({'error': 'Только создатель или администратор могут устанавливать семейные лимиты'}), 403

        existing = FamilyPlan.query.filter_by(
            family_id=current_user.family_id,
            category_id=category_id
        ).first()

        if existing:
            existing.limit_amount = amount
            existing.end_date = month_end
        else:
            family_plan = FamilyPlan(
                family_id=current_user.family_id,
                category_id=category_id,
                limit_amount=amount,
                start_date=month_start,
                end_date=month_end
            )
            db.session.add(family_plan)
    else:
        existing = UserPlan.query.filter_by(
            user_id=current_user.id,
            category_id=category_id
        ).first()

        if existing:
            existing.limit_amount = amount
            existing.end_date = month_end
        else:
            user_plan = UserPlan(
                user_id=current_user.id,
                category_id=category_id,
                limit_amount=amount,
                start_date=month_start,
                end_date=month_end
            )
            db.session.add(user_plan)

    db.session.commit()
    return jsonify({'success': True})


@main_bp.route('/delete-limit', methods=['POST'])
@login_required
def delete_limit():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    data = request.get_json()
    limit_type = data.get('limit_type')
    category_id = data.get('category_id')

    if limit_type == 'personal':
        limit = UserPlan.query.filter_by(user_id=current_user.id, category_id=category_id).first()
        if limit:
            db.session.delete(limit)
            db.session.commit()
    else:
        if current_user.role not in ['Создатель', 'Администратор']:
            return jsonify({'error': 'Доступ запрещён'}), 403
        limit = FamilyPlan.query.filter_by(family_id=current_user.family_id, category_id=category_id).first()
        if limit:
            db.session.delete(limit)
            db.session.commit()

    return jsonify({'success': True})


# ==================== ОТЧЁТЫ ======================================== ОТЧЁТЫ ======================================== ОТЧЁТЫ ====================

@main_bp.route('/reports')
@login_required
def reports():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))
    return render_template('reports.html')


@main_bp.route('/export-report')
@login_required
def export_report():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))

    report_type = request.args.get('report_type', 'expenses')
    date_start_str = request.args.get('date_start')
    date_end_str = request.args.get('date_end')
    group_by = request.args.get('group_by', 'category')

    if date_start_str and date_end_str:
        date_start = datetime.strptime(date_start_str, '%Y-%m-%d').date()
        date_end = datetime.strptime(date_end_str, '%Y-%m-%d').date()
    else:
        today = datetime.now()
        date_start = today.replace(day=1).date()
        if today.month == 12:
            date_end = today.replace(year=today.year + 1, month=1, day=1).date()
        else:
            date_end = today.replace(month=today.month + 1, day=1).date()

    family_users = User.query.filter_by(family_id=current_user.family_id).all()
    user_ids = [u.id for u in family_users]

    transactions = Transaction.query.filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= date_start,
        Transaction.date <= date_end
    ).order_by(Transaction.date.desc(), Transaction.time.desc()).all()

    output = StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_MINIMAL)
    writer.writerow(['Дата', 'Время', 'Автор', 'Категория', 'Тип', 'Сумма', 'Комментарий'])

    for txn in transactions:
        writer.writerow([
            txn.date.strftime('%d.%m.%Y'),
            txn.time.strftime('%H:%M') if txn.time else '',
            f"{txn.author.surname} {txn.author.name}",
            txn.category.name,
            txn.category.type,
            f"{'-' if txn.category.type == 'Расход' else '+'}{float(txn.amount):.2f}",
            (txn.comment or '').replace(';', ',')
        ])

    total_income = sum(float(t.amount) for t in transactions if t.category.type == 'Доход')
    total_expense = sum(float(t.amount) for t in transactions if t.category.type == 'Расход')
    balance = total_income - total_expense

    writer.writerow([])
    writer.writerow(['ИТОГО ДОХОДЫ:', '', '', '', '', f'{total_income:.2f}', ''])
    writer.writerow(['ИТОГО РАСХОДЫ:', '', '', '', '', f'{total_expense:.2f}', ''])
    writer.writerow(['БАЛАНС:', '', '', '', '', f'{balance:.2f}', ''])
    writer.writerow([f'ПЕРИОД: {date_start.strftime("%d.%m.%Y")} - {date_end.strftime("%d.%m.%Y")}', '', '', '', '', '', ''])

    content = output.getvalue().encode('windows-1251', errors='replace')

    response = Response(content, mimetype='text/csv')
    response.headers['Content-Disposition'] = f'attachment; filename=family_budget_{date_start.strftime("%Y%m%d")}_{date_end.strftime("%Ym%d")}.csv'
    response.headers['Content-Type'] = 'text/csv; charset=windows-1251'
    return response


# ==================== API ЭНДПОИНТЫ ======================================== API ЭНДПОИНТЫ ======================================== API ЭНДПОИНТЫ ====================

@main_bp.route('/api/chart-data')
@login_required
def api_chart_data():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    category_id = request.args.get('category_id', type=int)
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    family_users = User.query.filter_by(family_id=current_user.family_id).all()
    user_ids = [u.id for u in family_users]

    current_category = None
    if category_id:
        current_category = Category.query.get(category_id)
        if not current_category or current_category.family_id != current_user.family_id:
            return jsonify({'error': 'Доступ запрещён'}), 403

    chart_data = build_chart_items(current_category, user_ids, now)

    history = []
    if current_category:
        parent = current_category.parent
        while parent:
            history.insert(0, parent.id)
            parent = parent.parent

    return jsonify({
        'items': chart_data['items'],
        'total': chart_data['total'],
        'current_category_id': category_id,
        'current_category_name': current_category.name if current_category else None,
        'history': history
    })


@main_bp.route('/api/report-data')
@login_required
def api_report_data():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    report_type = request.args.get('report_type', 'expenses')
    date_start_str = request.args.get('date_start')
    date_end_str = request.args.get('date_end')
    group_by = request.args.get('group_by', 'category')
    category_id = request.args.get('category_id', type=int)

    date_start = datetime.strptime(date_start_str, '%Y-%m-%d').date()
    date_end = datetime.strptime(date_end_str, '%Y-%m-%d').date()

    family_users = User.query.filter_by(family_id=current_user.family_id).all()
    user_ids = [u.id for u in family_users]

    total_income = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= date_start,
        Transaction.date <= date_end,
        Transaction.category_id.in_(db.session.query(Category.id).filter(Category.type == 'Доход'))
    ).scalar() or 0
    total_income = float(total_income)

    total_expense = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= date_start,
        Transaction.date <= date_end,
        Transaction.category_id.in_(db.session.query(Category.id).filter(Category.type == 'Расход'))
    ).scalar() or 0
    total_expense = float(total_expense)

    if group_by == 'category':
        target_type = 'Расход' if report_type == 'expenses' else 'Доход'
        current_category = None

        if category_id:
            current_category = Category.query.get(category_id)
            if not current_category or current_category.family_id != current_user.family_id:
                return jsonify({'error': 'Категория не найдена'}), 404

        chart_data = build_chart_items(current_category, user_ids, date_start, date_end, target_type)

        return jsonify({
            'total_income': total_income if report_type == 'expenses' else chart_data['total'],
            'total_expense': chart_data['total'] if report_type == 'expenses' else total_expense,
            'items': chart_data['items'],
            'total': chart_data['total'],
            'current_category_id': category_id,
            'current_category_name': current_category.name if current_category else None
        })

    elif group_by == 'user':
        target_type = 'Расход' if report_type == 'expenses' else 'Доход'
        users_data = db.session.query(
            User.id, User.surname, User.name,
            func.sum(Transaction.amount).label('total')
        ).join(Transaction).filter(
            Transaction.user_id.in_(user_ids),
            Transaction.date >= date_start,
            Transaction.date <= date_end,
            Transaction.category_id.in_(
                db.session.query(Category.id).filter(Category.type == target_type)
            )
        ).group_by(User.id).all()

        user_items = []
        for u in users_data:
            if u.total and float(u.total) > 0:
                user_items.append({
                    'id': u.id,
                    'name': f"{u.surname} {u.name}",
                    'value': float(u.total)
                })
        user_items.sort(key=lambda x: x['value'], reverse=True)
        total_for_chart = sum(item['value'] for item in user_items)

        return jsonify({
            'total_income': total_income,
            'total_expense': total_expense,
            'items': user_items,
            'total': total_for_chart
        })

    elif group_by in ['day', 'month']:
        if group_by == 'day':
            balance_query = db.session.query(
                Transaction.date.label('period'),
                func.sum(Transaction.amount).filter(
                    Transaction.category_id.in_(
                        db.session.query(Category.id).filter(Category.type == 'Расход')
                    )
                ).label('expense'),
                func.sum(Transaction.amount).filter(
                    Transaction.category_id.in_(
                        db.session.query(Category.id).filter(Category.type == 'Доход')
                    )
                ).label('income')
            ).filter(
                Transaction.user_id.in_(user_ids),
                Transaction.date >= date_start,
                Transaction.date <= date_end
            ).group_by(Transaction.date).order_by(Transaction.date).all()
        else:
            balance_query = db.session.query(
                func.strftime('%Y-%m', Transaction.date).label('period'),
                func.sum(Transaction.amount).filter(
                    Transaction.category_id.in_(
                        db.session.query(Category.id).filter(Category.type == 'Расход')
                    )
                ).label('expense'),
                func.sum(Transaction.amount).filter(
                    Transaction.category_id.in_(
                        db.session.query(Category.id).filter(Category.type == 'Доход')
                    )
                ).label('income')
            ).filter(
                Transaction.user_id.in_(user_ids),
                Transaction.date >= date_start,
                Transaction.date <= date_end
            ).group_by('period').order_by('period').all()

        balance_data = []
        running_balance = 0
        for item in balance_query:
            expense = float(item.expense or 0)
            income = float(item.income or 0)
            running_balance += income - expense
            balance_data.append({
                'period': item.period,
                'expense': expense,
                'income': income,
                'balance': running_balance
            })

        return jsonify({
            'total_income': total_income,
            'total_expense': total_expense,
            'items': balance_data,
            'total': 0
        })

    return jsonify({
        'total_income': total_income,
        'total_expense': total_expense,
        'items': [],
        'total': 0
    })