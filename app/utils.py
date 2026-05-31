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


def calculate_limit_status(user, category, new_amount, date):
    """Проверка личных и семейных лимитов с учётом периода и вложенности"""
    month_start = date.replace(day=1)
    if month_start.month == 12:
        next_month_start = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month_start = month_start.replace(month=month_start.month + 1)

    # Преобразуем new_amount в Decimal для корректного сложения
    if isinstance(new_amount, float):
        new_amount = Decimal(str(new_amount))

    # Собираем ID категории и всех её потомков
    category_ids = get_category_with_children_ids(category)

    spent = db.session.query(func.sum(Transaction.amount)).filter(
        Transaction.category_id.in_(category_ids),
        Transaction.user_id == user.id,
        Transaction.date >= month_start,
        Transaction.date < next_month_start
    ).scalar() or Decimal('0')

    spent += new_amount

    # Личный лимит
    user_plan = UserPlan.query.filter_by(user_id=user.id, category_id=category.id).first()
    if user_plan and spent > user_plan.limit_amount:
        return f"⚠ Превышен личный лимит по категории '{category.name}'!"

    # Семейный лимит
    fam_plan = FamilyPlan.query.filter_by(family_id=user.family_id, category_id=category.id).first()
    if fam_plan and spent > fam_plan.limit_amount:
        return f"⚠ Превышен общесемейный лимит по категории '{category.name}'!"

    return None

def get_category_with_children_ids(category):
    """Рекурсивно собирает ID категории и всех её потомков"""
    ids = [category.id]
    for child in category.children:
        if child.type == 'Расход':
            ids.extend(get_category_with_children_ids(child))
    return ids