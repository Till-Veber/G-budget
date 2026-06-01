# Семейный бюджет

## Установка и запуск

### 1. Клонирование репозитория

```bash
git clone https://github.com/Till-Veber/G-budget
```
```bash
cd G-budget
```

### 2. Создание виртуального окружения

#### На Windows:
```bash
python -m venv venv
```
```bash
venv\Scripts\activate.bat
```

#### MacOS/Linux:
```bash
python3 -m venv venv
```
```bash
source venv/bin/activate
```

### 3. Установка зависимостей
```bash
pip install -r requirements.txt
```

### 4. Создайте .env файл в корне проекта
```commandline
SECRET_KEY=ваш-секретный-ключ-для-продакшена
```
(Или по умолчанию подставится dev-secret-key-2026)

### 5. Запуск приложения
```bash
python run.py
```
Приложение будет доступно по адресу http://127.0.0.1:5000