#!/usr/bin/env python
"""
Скрипт для инициализации базы данных.
Запустите один раз после клонирования репозитория.
"""
from app import create_app, db
from app.models import User, Family, Category, Transaction, FamilyPlan, UserPlan, Invitation
import os


def init_database():
    app = create_app()
    with app.app_context():
        # Проверяем, существует ли уже БД
        db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        if os.path.exists(db_path):
            response = input(f"База данных уже существует по пути {db_path}. Пересоздать? (y/N): ")
            if response.lower() != 'y':
                print("Отменено.")
                return
            os.remove(db_path)

        print("Создание таблиц...")
        db.create_all()
        print("База данных успешно инициализирована!")


if __name__ == '__main__':
    init_database()