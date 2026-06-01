from app import db
from app.models import Transaction, UserPlan, FamilyPlan, Category
from datetime import datetime
from sqlalchemy import func
from decimal import Decimal


def get_category_tree(cat, depth=0):
    """Рекурсивный обход иерархии категорий для UI"""
    result = {'id': cat.id, 'name': cat.name, 'depth': depth}
    result['children'] = [get_category_tree(c, depth + 1) for c in cat.children]
    return result


def get_category_with_children_ids(category):
    """Рекурсивно собирает ID категории и всех её потомков"""
    ids = [category.id]
    for child in category.children:
        if child.type == 'Расход':
            ids.extend(get_category_with_children_ids(child))
    return ids


def get_category_total(category, user_ids, date_start, date_end=None, category_type=None):
    """
    Возвращает сумму транзакций по категории и всем её потомкам.
    """
    if hasattr(date_start, 'date'):
        date_start = date_start.date()
    if date_end is not None and hasattr(date_end, 'date'):
        date_end = date_end.date()

    all_ids = [category.id]

    def collect_ids(cat):
        for child in cat.children:
            if category_type is None or child.type == category_type:
                all_ids.append(child.id)
                collect_ids(child)

    collect_ids(category)

    query = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.category_id.in_(all_ids)
    )

    if date_end is None:
        month_start = date_start.replace(day=1)
        query = query.filter(Transaction.date >= month_start)
    else:
        query = query.filter(
            Transaction.date >= date_start,
            Transaction.date <= date_end
        )

    if category_type:
        query = query.filter(
            Transaction.category_id.in_(
                db.session.query(Category.id).filter(Category.type == category_type)
            )
        )

    return float(query.scalar() or 0)


def get_direct_transactions_total(category, user_ids, date_start, date_end=None):
    """Сумма транзакций, привязанных напрямую к категории (без учёта детей)"""
    if hasattr(date_start, 'date'):
        date_start = date_start.date()
    if date_end is not None and hasattr(date_end, 'date'):
        date_end = date_end.date()

    query = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.user_id.in_(user_ids),
        Transaction.category_id == category.id
    )

    if date_end is None:
        month_start = date_start.replace(day=1)
        query = query.filter(Transaction.date >= month_start)
    else:
        query = query.filter(
            Transaction.date >= date_start,
            Transaction.date <= date_end
        )

    return float(query.scalar() or 0)


def build_chart_items(parent_category, user_ids, date_start, date_end=None, category_type='Расход'):
    """
    Строит данные для диаграммы: дочерние категории + пункт "Без подкатегории".

    Returns:
        dict: {'items': [...], 'total': float}
    """
    if parent_category:
        children = Category.query.filter_by(parent_id=parent_category.id, type=category_type).all()
    else:
        children = Category.query.filter_by(parent_id=None, type=category_type).all()

    items = []
    total = 0

    for cat in children:
        value = get_category_total(cat, user_ids, date_start, date_end, category_type)
        if value > 0:
            total += value
            has_children = any(
                get_category_total(child, user_ids, date_start, date_end, category_type) > 0
                for child in cat.children
                if child.type == category_type
            )
            items.append({
                'id': cat.id,
                'name': cat.name,
                'color': cat.color,
                'value': value,
                'has_children': has_children
            })

    if parent_category:
        direct_value = get_direct_transactions_total(parent_category, user_ids, date_start, date_end)
        if direct_value > 0:
            total += direct_value
            items.append({
                'id': None,
                'name': 'Без подкатегории',
                'color': '#9ca3af',
                'value': direct_value,
                'has_children': False
            })

    items.sort(key=lambda x: x['value'], reverse=True)
    return {'items': items, 'total': total}


def calculate_limit_status(user, category, new_amount, date):
    """Проверка личных и семейных лимитов с учётом периода и вложенности"""
    month_start = date.replace(day=1)

    if month_start.month == 12:
        next_month_start = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month_start = month_start.replace(month=month_start.month + 1)

    if isinstance(new_amount, float):
        new_amount = Decimal(str(new_amount))

    category_ids = get_category_with_children_ids(category)

    spent = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.category_id.in_(category_ids),
        Transaction.user_id == user.id,
        Transaction.date >= month_start,
        Transaction.date < next_month_start
    ).scalar() or Decimal('0')

    spent += new_amount

    user_plan = UserPlan.query.filter_by(user_id=user.id, category_id=category.id).first()
    if user_plan and spent > user_plan.limit_amount:
        return f"⚠ Превышен личный лимит по категории '{category.name}'!"

    fam_plan = FamilyPlan.query.filter_by(family_id=user.family_id, category_id=category.id).first()
    if fam_plan and spent > fam_plan.limit_amount:
        return f"⚠ Превышен общесемейный лимит по категории '{category.name}'!"

    return None


def build_category_tree(categories, parent_id=None, level=0):
    """
    Рекурсивно строит дерево категорий для отображения в выпадающем списке.
    Возвращает список кортежей (id, name_with_indent, type, color).
    """
    result = []
    # Фильтруем категории по parent_id
    for cat in categories:
        if cat.parent_id == parent_id:
            # Создаем отступ из символов неразрывного пробела (&nbsp;) или дефисов

            result.append({
                'id': cat.id,
                'name': cat.name,
                'type': cat.type,
                'color': cat.color,
                'level': level
            })
            # Рекурсивно добавляем детей, увеличивая уровень вложенности
            result.extend(build_category_tree(categories, cat.id, level + 1))
    return result