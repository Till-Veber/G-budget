from app import create_app, db
from app.models import User, Family, Category, Transaction, Invitation, UserPlan, FamilyPlan
import os

app = create_app()

if __name__ == '__main__':
    # Авто-создание БД при первом запуске (только в debug-режиме)
    if app.debug and os.environ.get('SKIP_DB_INIT') != '1':
        with app.app_context():
            db.create_all()
            print("🗄️  База данных проверена/создана")

    app.run(debug=True, host='0.0.0.0', port=5000)