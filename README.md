# G-Budget — Семейный бюджет

## Быстрый старт

### Требования
- Python 3.10+
- pip

### Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/Till-Veber/G-budget.git
cd G-budget
```
2. Создайте виртуальное окружение:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/macOS
python3 -m venv venv
source venv/bin/activate
```
3. Установите зависимости:
```bash
pip install -r requirements.txt
```
4. Настройте переменные окружения:
```bash
# Скопируйте шаблон
# Windows
copy .env.example .env 
# Linux/macOS
cp .env.example .env
# Откройте .env и задайте SECRET_KEY (можно сгенерировать на https://djecrety.ir/)
```
5. Инициализируйте базу данных:
```bash
python init_db.py
```
6. Запустите приложение:
```bash
python run.py
```
7. Откройте в браузере: http://localhost:5000