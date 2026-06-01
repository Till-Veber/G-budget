#!/usr/bin/env python3
"""
Скрипт инициализации базы данных.
Запуск: python init_db.py
"""
import os
import sys
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# Добавляем корень проекта в PATH
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app, db
from app.models import User, Family, Category, Transaction, Invitation, UserPlan, FamilyPlan


def init_db():
    """Создаёт все таблицы, если их нет."""
    app = create_app()
    with app.app_context():
        print("🔄 Инициализация базы данных...")
        db.create_all()
        print("✅ Таблицы созданы успешно!")

        # Создаём тестового администратора, если пользователей нет
        if User.query.count() == 0:
            admin = User(
                surname='Админ',
                name='Админ',
                login='admin',
                role='Администратор'
            )
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
            print("👤 Создан тестовый пользователь: admin / admin123")


if __name__ == '__main__':
    init_db()