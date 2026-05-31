from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, Response
from flask_login import login_user, login_required, logout_user, current_user
from app import db, login_manager
from app.models import User, Family, Category, Transaction, Invitation, UserPlan, FamilyPlan
from app.utils import get_category_with_children_ids, calculate_limit_status
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


# ==================== АВТОРИЗАЦИЯ ====================

@main_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        user = User.query.filter_by(login=request.form['login']).first()
        if user and user.check_password(request.form['password']):
            login_user(user)
            next_page = request.args.get('next')
            return redirect(next_page or url_for('main.dashboard'))
        flash('Неверный логин или пароль', 'danger')
    return render_template('login.html')


@main_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        if request.form['password'] != request.form['confirm_password']:
            flash('Пароли не совпадают', 'danger')
            return redirect(url_for('main.register'))

        if User.query.filter_by(login=request.form['login']).first():
            flash('Логин уже занят', 'danger')
            return redirect(url_for('main.register'))

        user = User(
            surname=request.form['surname'],
            name=request.form['name'],
            patronymic=request.form.get('patronymic'),
            login=request.form['login']
        )
        user.set_password(request.form['password'])
        user.role = 'Администратор'  # Временно, потом может смениться при вступлении в семью

        db.session.add(user)
        db.session.commit()

        login_user(user)
        flash('Регистрация успешна! Теперь создайте семью или примите приглашение', 'success')
        return redirect(url_for('main.choose_action'))

    return render_template('register.html')


@main_bp.route('/choose-action')
@login_required
def choose_action():
    if current_user.family_id:
        return redirect(url_for('main.dashboard'))
    return render_template('choose_action.html')


# ==================== УПРАВЛЕНИЕ СЕМЬЁЙ ====================

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

        # Создаём стандартные категории для новой семьи
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
        flash('Вы уже состоите в семье', 'warning')
        return redirect(url_for('main.dashboard'))

    code = request.form.get('invite_code')
    if not code:
        flash('Введите код приглашения', 'danger')
        return redirect(url_for('main.choose_action'))

    invite = Invitation.query.filter_by(code=code, status='Ожидает').first()

    if not invite:
        flash('Неверный код приглашения', 'danger')
        return redirect(url_for('main.choose_action'))

    if invite.expires_at and invite.expires_at < datetime.utcnow():
        invite.status = 'Истёк'
        db.session.commit()
        flash('Срок действия приглашения истёк', 'danger')
        return redirect(url_for('main.choose_action'))

    # Присоединяем пользователя к семье
    current_user.family_id = invite.family_id
    current_user.role = 'Участник'
    invite.status = 'Принят'
    db.session.commit()

    flash('Вы успешно присоединились к семье!', 'success')
    return redirect(url_for('main.dashboard'))


@main_bp.route('/generate-invite', methods=['POST'])
@login_required
def generate_invite():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    if current_user.role not in ['Создатель', 'Администратор']:
        return jsonify({'error': 'Доступ запрещён'}), 403

    # Создаём новое приглашение (не деактивируем старые)
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

    # Активные приглашения (статус 'Ожидает')
    active_invites = Invitation.query.filter_by(
        family_id=current_user.family_id,
        status='Ожидает'
    ).order_by(Invitation.expires_at).all()

    # История приглашений (остальные)
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


# ==================== КАТЕГОРИИ ====================

@main_bp.route('/categories')
@login_required
def categories():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))

    # Получаем все категории семьи
    all_categories = Category.query.filter_by(family_id=current_user.family_id).all()

    # Строим дерево категорий с сортировкой по алфавиту
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
        # Сортируем на текущем уровне по имени
        tree.sort(key=lambda x: x['name'].lower())
        return tree

    category_tree = build_tree(all_categories)

    return render_template('categories.html', categories=category_tree, all_categories=all_categories)


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

    # Защищённые категории нельзя удалить
    if category.is_protected:
        return jsonify({'error': 'Нельзя удалить системную категорию "Прочее"'}), 400

    # Находим или создаём категорию "Прочее" для переноса транзакций
    other_category = Category.query.filter_by(
        family_id=current_user.family_id,
        name='Прочее',
        type='Расход'
    ).first()

    if not other_category:
        # Создаём, если вдруг нет
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

    # Рекурсивно собираем все ID подкатегорий
    def get_all_descendant_ids(cat):
        ids = [cat.id]
        for child in cat.children:
            ids.extend(get_all_descendant_ids(child))
        return ids

    # Получаем все ID удаляемой категории и её потомков
    all_category_ids = get_all_descendant_ids(category)

    # Переносим транзакции на "Прочее"
    Transaction.query.filter(Transaction.category_id.in_(all_category_ids)).update(
        {Transaction.category_id: other_category.id},
        synchronize_session=False
    )

    # Удаляем лимиты, связанные с этими категориями
    UserPlan.query.filter(UserPlan.category_id.in_(all_category_ids)).delete(synchronize_session=False)
    FamilyPlan.query.filter(FamilyPlan.category_id.in_(all_category_ids)).delete(synchronize_session=False)

    if delete_action == 'delete_children':
        # Удаляем все категории рекурсивно
        for cat_id in all_category_ids:
            cat = Category.query.get(cat_id)
            if cat and cat.id != other_category.id:
                db.session.delete(cat)
    else:  # move_to_parent
        for child in category.children:
            child.parent_id = None
        db.session.delete(category)

    db.session.commit()
    return jsonify({'success': True})


@main_bp.route('/transaction/<int:transaction_id>', methods=['PUT'])
@login_required
def update_transaction(transaction_id):
    transaction = Transaction.query.get_or_404(transaction_id)

    # Проверяем права
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


@main_bp.route('/category/move', methods=['POST'])
@login_required
def move_category():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    data = request.get_json()
    category_id = data.get('category_id')
    target_id = data.get('target_id')
    position = data.get('position')  # 'before', 'after', 'inside'

    category = Category.query.get_or_404(category_id)
    if category.family_id != current_user.family_id:
        return jsonify({'error': 'Доступ запрещён'}), 403

    target = Category.query.get_or_404(target_id)
    if target.family_id != current_user.family_id:
        return jsonify({'error': 'Доступ запрещён'}), 403

    # Запрещаем перемещение в самого себя или в своих потомков
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
        # Перемещаем внутрь целевой категории
        category.parent_id = target_id
    elif position == 'before':
        # Перемещаем перед целевой категорией (на том же уровне)
        category.parent_id = target.parent_id
    elif position == 'after':
        # Перемещаем после целевой категории (на том же уровне)
        category.parent_id = target.parent_id

    db.session.commit()
    return jsonify({'success': True})


# ==================== ТРАНЗАКЦИИ ====================

@main_bp.route('/add-transaction', methods=['GET', 'POST'])
@login_required
def add_transaction():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))

    if request.method == 'POST':
        category_id = request.form.get('category_id')
        amount = request.form.get('amount')
        date_str = request.form.get('date')
        time_str = request.form.get('time', '00:00')
        comment = request.form.get('comment', '')

        # Валидация
        category = Category.query.get(category_id)
        if not category or category.family_id != current_user.family_id:
            flash('Категория не найдена', 'danger')
            return redirect(url_for('main.add_transaction'))

        try:
            amount = Decimal(amount)
            if amount <= 0:
                flash('Сумма должна быть положительной', 'danger')
                return redirect(url_for('main.add_transaction'))
        except (ValueError, TypeError):
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

        # Проверка лимитов
        warning = calculate_limit_status(current_user, category, amount, date)
        if warning:
            flash(warning, 'warning')
        else:
            flash('Транзакция успешно добавлена', 'success')

        return redirect(url_for('main.dashboard'))

    # GET запрос - показываем форму
    categories = Category.query.filter_by(family_id=current_user.family_id).order_by(Category.name).all()
    return render_template('add_transaction.html', categories=categories)


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


@main_bp.route('/transaction/<int:transaction_id>', methods=['DELETE'])
@login_required
def delete_transaction(transaction_id):
    transaction = Transaction.query.get_or_404(transaction_id)

    # Проверяем, что транзакция принадлежит пользователю или пользователь админ
    if transaction.user_id != current_user.id and current_user.role != 'Администратор':
        return jsonify({'error': 'Доступ запрещён'}), 403

    db.session.delete(transaction)
    db.session.commit()

    return jsonify({'success': True})





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

    # Доходы за месяц
    month_income = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= month_start.date(),
        Transaction.category_id.in_(
            db.session.query(Category.id).filter(Category.type == 'Доход')
        )
    ).scalar() or 0
    month_income = float(month_income)

    # Расходы за месяц
    month_expenses = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.date >= month_start.date(),
        Transaction.category_id.in_(
            db.session.query(Category.id).filter(Category.type == 'Расход')
        )
    ).scalar() or 0
    month_expenses = float(month_expenses)

    balance = month_income - month_expenses

    # Баланс за предыдущий месяц
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

    # Последние транзакции
    last_transactions = Transaction.query.join(User).filter(
        User.family_id == current_user.family_id
    ).order_by(Transaction.date.desc(), Transaction.time.desc()).limit(10).all()

    # Категории для формы
    categories = Category.query.filter_by(family_id=current_user.family_id).order_by(Category.name).all()
    expense_categories = Category.query.filter_by(family_id=current_user.family_id, type='Расход').order_by(
        Category.name).all()

    # Семейные лимиты (для создателя и администратора)
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

    # ========== ДАННЫЕ ДЛЯ ДИАГРАММЫ ==========
    def build_chart_data(category_id=None):
        if category_id:
            current_cat = Category.query.get(category_id)
            if not current_cat or current_cat.family_id != current_user.family_id:
                return {'error': 'Категория не найдена'}
            children = Category.query.filter_by(parent_id=category_id, type='Расход').all()
            current_name = current_cat.name
        else:
            children = Category.query.filter_by(parent_id=None, type='Расход').all()
            current_name = None

        chart_items = []
        total = 0

        for cat in children:
            def get_category_total(category):
                cat_ids = [category.id]
                for child in category.children:
                    cat_ids.extend([c.id for c in child.children] + [child.id])
                amount = db.session.query(func.sum(Transaction.amount)).filter(
                    Transaction.user_id.in_(user_ids),
                    Transaction.category_id.in_(cat_ids),
                    Transaction.date >= month_start.date(),
                    Transaction.category_id.in_(
                        db.session.query(Category.id).filter(Category.type == 'Расход')
                    )
                ).scalar() or 0
                return float(amount)

            value = get_category_total(cat)
            if value > 0:
                total += value
                chart_items.append({
                    'id': cat.id,
                    'name': cat.name,
                    'color': cat.color,
                    'value': value,
                    'has_children': cat.children.count() > 0
                })

        chart_items.sort(key=lambda x: x['value'], reverse=True)

        history = []
        if category_id:
            parent = current_cat.parent
            while parent:
                history.insert(0, parent.id)
                parent = parent.parent

        return {
            'items': chart_items,
            'total': total,
            'current_category_id': category_id,
            'current_category_name': current_name,
            'history': history
        }

    chart_data = build_chart_data()

    return render_template(
        'dashboard.html',
        balance=balance,
        balance_change=balance_change,
        month_expenses=month_expenses,
        expense_percent=int((month_expenses / (month_income or 1)) * 100) if month_income > 0 else 0,
        budget_limit=month_income > 0,
        members_count=members_count,
        last_transactions=last_transactions,
        categories=categories,
        expense_categories=expense_categories,
        family_limits=family_limits,
        chart_data=chart_data
    )


@main_bp.route('/export-report')
@login_required
def export_report():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))

    report_type = request.args.get('report_type', 'expenses')
    date_start_str = request.args.get('date_start')
    date_end_str = request.args.get('date_end')
    group_by = request.args.get('group_by', 'category')

    from datetime import datetime
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

    # Используем стандартную кодировку Windows-1251 для совместимости с Excel
    import codecs
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
    writer.writerow(
        ['ПЕРИОД:', f'{date_start.strftime("%d.%m.%Y")} - {date_end.strftime("%d.%m.%Y")}', '', '', '', '', ''])

    # Кодируем в Windows-1251 для Excel
    content = output.getvalue().encode('windows-1251', errors='replace')

    response = Response(content, mimetype='text/csv')
    response.headers[
        'Content-Disposition'] = f'attachment; filename=family_budget_{date_start.strftime("%Y%m%d")}_{date_end.strftime("%Ym%d")}.csv'
    response.headers['Content-Type'] = 'text/csv; charset=windows-1251'
    return response


@main_bp.route('/reports')
@login_required
def reports():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))
    return render_template('reports.html')


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

    else:  # personal limit
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

@main_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Вы вышли из системы', 'info')
    return redirect(url_for('main.login'))


# ==================== УПРАВЛЕНИЕ РОЛЯМИ ====================

@main_bp.route('/family/change-role', methods=['POST'])
@login_required
def change_member_role():
    if not current_user.family_id:
        return jsonify({'error': 'Семья не найдена'}), 400

    data = request.get_json()
    user_id = data.get('user_id')
    new_role = data.get('role')  # 'Администратор' или 'Участник'

    user = User.query.get(user_id)
    if not user or user.family_id != current_user.family_id:
        return jsonify({'error': 'Пользователь не найден'}), 404

    # Только создатель может менять роли
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

    # Передаём права создателя
    current_user.role = 'Администратор'
    new_creator.role = 'Создатель'
    db.session.commit()

    return jsonify({'success': True})


@main_bp.route('/family/leave', methods=['POST'])
@login_required
def leave_family():
    if not current_user.family_id:
        return jsonify({'error': 'Вы не состоите в семье'}), 400

    family_id = current_user.family_id
    family = Family.query.get(family_id)

    # Проверяем, есть ли другие участники
    other_members = User.query.filter(User.family_id == family_id, User.id != current_user.id).all()

    if current_user.role == 'Создатель':
        if other_members:
            # Назначаем нового создателя (первого администратора или первого участника)
            new_creator = None
            for member in other_members:
                if member.role == 'Администратор':
                    new_creator = member
                    break
            if not new_creator:
                new_creator = other_members[0]
            new_creator.role = 'Создатель'
        else:
            # В семье больше никого нет — удаляем семью
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

    # Нельзя исключить создателя
    if user.role == 'Создатель':
        return jsonify({'error': 'Нельзя исключить создателя семьи'}), 400

    user.family_id = None
    user.role = 'Участник'
    db.session.commit()

    return jsonify({'success': True})


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

    # Определяем текущую категорию
    current_category = None
    if category_id:
        current_category = Category.query.get(category_id)
        if current_category and current_category.family_id != current_user.family_id:
            return jsonify({'error': 'Доступ запрещён'}), 403

    # Получаем дочерние категории (только расходы)
    if current_category:
        children = Category.query.filter_by(parent_id=category_id, type='Расход').all()
        current_category_name = current_category.name
    else:
        children = Category.query.filter_by(parent_id=None, type='Расход').all()
        current_category_name = None

    # Функция для получения суммы расходов по категории и всем её потомкам
    def get_category_total(category):
        # Собираем все ID категории и всех её потомков (рекурсивно)
        all_ids = [category.id]

        def collect_ids(cat):
            for child in cat.children:
                if child.type == 'Расход':
                    all_ids.append(child.id)
                    collect_ids(child)

        collect_ids(category)

        total_sum = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id.in_(user_ids),
            Transaction.category_id.in_(all_ids),
            Transaction.date >= month_start.date()
        ).scalar() or 0
        return float(total_sum)

    chart_items = []
    total = 0

    for cat in children:
        value = get_category_total(cat)
        if value > 0:
            total += value
            # Проверяем, есть ли у категории дети-расходы с ненулевыми суммами
            has_children_with_expenses = False
            for child in cat.children:
                if child.type == 'Расход' and get_category_total(child) > 0:
                    has_children_with_expenses = True
                    break

            chart_items.append({
                'id': cat.id,
                'name': cat.name,
                'color': cat.color,
                'value': value,
                'has_children': has_children_with_expenses
            })

    # Сортируем по убыванию суммы
    chart_items.sort(key=lambda x: x['value'], reverse=True)

    return jsonify({
        'items': chart_items,
        'total': total,
        'current_category_id': category_id,
        'current_category_name': current_category_name
    })


@main_bp.route('/limits')
@login_required
def limits():
    if not current_user.family_id:
        return redirect(url_for('main.no_family'))

    from datetime import datetime
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    family_users = User.query.filter_by(family_id=current_user.family_id).all()
    user_ids = [u.id for u in family_users]

    # Категории расходов для выбора
    expense_categories = Category.query.filter_by(family_id=current_user.family_id, type='Расход').order_by(
        Category.name).all()

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

    # Семейные лимиты (для создателя и администратора)
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
    else:  # family
        if current_user.role not in ['Создатель', 'Администратор']:
            return jsonify({'error': 'Доступ запрещён'}), 403
        limit = FamilyPlan.query.filter_by(family_id=current_user.family_id, category_id=category_id).first()
        if limit:
            db.session.delete(limit)
            db.session.commit()

    return jsonify({'success': True})


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

    from datetime import datetime
    date_start = datetime.strptime(date_start_str, '%Y-%m-%d').date()
    date_end = datetime.strptime(date_end_str, '%Y-%m-%d').date()

    family_users = User.query.filter_by(family_id=current_user.family_id).all()
    user_ids = [u.id for u in family_users]

    # Доходы и расходы за период
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
        # Определяем текущую категорию
        current_category = None
        if category_id:
            current_category = Category.query.get(category_id)
            if not current_category or current_category.family_id != current_user.family_id:
                return jsonify({'error': 'Категория не найдена'}), 404

        # Получаем детей в зависимости от типа отчёта
        target_type = 'Расход' if report_type == 'expenses' else 'Доход'

        if current_category:
            children = Category.query.filter_by(parent_id=category_id, type=target_type).all()
            current_name = current_category.name
        else:
            children = Category.query.filter_by(parent_id=None, type=target_type).all()
            current_name = None

        # Функция для получения суммы по категории и потомкам
        def get_category_total(cat):
            all_ids = [cat.id]

            def collect(c):
                for child in c.children:
                    if child.type == target_type:
                        all_ids.append(child.id)
                        collect(child)

            collect(cat)
            total = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id.in_(user_ids),
                Transaction.category_id.in_(all_ids),
                Transaction.date >= date_start,
                Transaction.date <= date_end
            ).scalar() or 0
            return float(total)

        items = []
        total = 0
        for cat in children:
            value = get_category_total(cat)
            if value > 0:
                total += value
                has_children = any(get_category_total(child) > 0 for child in cat.children if child.type == target_type)
                items.append({
                    'id': cat.id,
                    'name': cat.name,
                    'color': cat.color,
                    'value': value,
                    'has_children': has_children
                })

        items.sort(key=lambda x: x['value'], reverse=True)

        # Для доходов total_income и total_expense меняются местами
        if report_type == 'expenses':
            return jsonify({
                'total_income': total_income,
                'total_expense': total,
                'items': items,
                'total': total,
                'current_category_id': category_id,
                'current_category_name': current_name
            })
        else:
            return jsonify({
                'total_income': total,
                'total_expense': total_expense,
                'items': items,
                'total': total,
                'current_category_id': category_id,
                'current_category_name': current_name
            })


    elif group_by == 'user':
        target_type = 'Расход' if report_type == 'expenses' else 'Доход'
        # Данные по пользователям за период (в зависимости от типа отчёта)
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
        # Для сводки нужны и доходы и расходы
        total_income_all = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id.in_(user_ids),
            Transaction.date >= date_start,
            Transaction.date <= date_end,
            Transaction.category_id.in_(db.session.query(Category.id).filter(Category.type == 'Доход'))
        ).scalar() or 0
        total_income_all = float(total_income_all)
        total_expense_all = db.session.query(func.sum(Transaction.amount)).filter(
            Transaction.user_id.in_(user_ids),
            Transaction.date >= date_start,
            Transaction.date <= date_end,
            Transaction.category_id.in_(db.session.query(Category.id).filter(Category.type == 'Расход'))
        ).scalar() or 0
        total_expense_all = float(total_expense_all)
        # Формируем данные для диаграммы и таблицы
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
            'total_income': total_income_all,
            'total_expense': total_expense_all,
            'items': user_items,
            'total': total_for_chart
        })

    elif group_by in ['day', 'month']:
        # Баланс по дням или месяцам
        if group_by == 'day':
            from sqlalchemy import cast, Date
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
            # По месяцам
            from sqlalchemy import func as sql_func
            balance_query = db.session.query(
                sql_func.strftime('%Y-%m', Transaction.date).label('period'),
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
            ).group_by(sql_func.strftime('%Y-%m', Transaction.date)).order_by('period').all()

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
        'items': [],
        'total': 0
    })

@main_bp.route('/')
def index():
    """Главная страница (лендинг)"""
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    return render_template('index.html')

@main_bp.route('/test-ui')
def test_ui():
    return render_template('test_ui.html')