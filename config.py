import os
from dotenv import load_dotenv

# Загружаем переменные из .env файла
load_dotenv()

basedir = os.path.abspath(os.path.dirname(__file__))


class Config:
    # Берём SECRET_KEY из переменных окружения, иначе генерируем предупреждение
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        import secrets
        SECRET_KEY = secrets.token_hex(32)
        print("⚠ ВНИМАНИЕ: Используется сгенерированный SECRET_KEY. Для production задайте его в .env")

    # Путь к БД - всегда внутри instance, но относительно корня проекта
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///' + os.path.join(basedir, 'instance', 'budget.db')
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False