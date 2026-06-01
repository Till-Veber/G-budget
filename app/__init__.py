from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from config import Config
import os

db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = 'main.login'
login_manager.login_message = 'Пожалуйста, войдите в систему.'


def create_app():
    # Корректное определение корня проекта
    app = Flask(__name__)

    app.config.from_object(Config)

    db.init_app(app)
    login_manager.init_app(app)

    with app.app_context():
        from app.models import User, Family, Category, Transaction, FamilyPlan, UserPlan, Invitation
        db.create_all()

    from app.routes import main_bp
    app.register_blueprint(main_bp)

    return app