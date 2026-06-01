# <u><span style="color: #ff7a00;">G-budget</span></u>

<blockquote style="border-left: 5px solid #ff7a00; margin: 0; padding-left: 15px;">
    <span style="color: #f0f4f8;">Управляйте семеным бюджетом вместе</span>
</blockquote>

<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #ff7a00;">● </span><span style="color: #94a3b8;">Создайте семейное пространство и ведите совместный учёт</span>
</blockquote>
<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #ff7a00;">● </span><span style="color: #94a3b8;">Настраивайте категории операций по своим</span>
</blockquote>
<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #ff7a00;">● </span><span style="color: #94a3b8;">Сами опредетяйте категории своих операций</span>
</blockquote>
<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #ff7a00;">● </span><span style="color: #94a3b8;">Просматривайте понятную и гибкую аналитику</span>
</blockquote>
<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #ff7a00;">● </span><span style="color: #94a3b8;">Вносите планы бюджета для их удобного отслеживания</span>
</blockquote>

### <u><span style="color: #ff7a00;">Простой старт!</span></u>
![](media/start.mp4)


# <u><span style="color: #ff7a00;">Установка и запуск</span></u>

<blockquote style="border-left: 5px solid #ff7a00; margin: 0; padding-left: 15px;">
    <span style="color: #f0f4f8;">1. Клонирование репозитория</span>
</blockquote>

```bash
git clone https://github.com/Till-Veber/G-budget
```
```bash
cd G-budget
```

<blockquote style="border-left: 5px solid #ff7a00; margin: 0; padding-left: 15px;">
    <span style="color: #f0f4f8;">2. Создание виртуального окружения</span>
</blockquote>
<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 15px;">
    <span style="color: #94a3b8;">Windows:</span>
</blockquote>


```bash
python -m venv venv
```
```bash
venv\Scripts\activate.bat
```

<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 15px;">
    <span style="color: #94a3b8;">MacOS/Linux:</span>
</blockquote>

```bash
python3 -m venv venv
```
```bash
source venv/bin/activate
```

<blockquote style="border-left: 5px solid #ff7a00; margin: 0; padding-left: 15px;">
    <span style="color: #f0f4f8;">3. Установка зависимостей</span>
</blockquote>

```bash
pip install -r requirements.txt
```

<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 15px;">
    <span style="color: #94a3b8;">Если подключение не удаётся, можно использовать зеркала:</span>
</blockquote>
<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #94a3b8;">Alibaba Cloud:</span>
</blockquote>

```bash
pip install -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com -r requirements.txt
```

<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #94a3b8;">Netherlands eScience Center:</span>
</blockquote>

```bash
pip install -i https://mirror.nlesc.nl/pypi/web/simple/ --trusted-host mirror.nlesc.nl -r requirements.txt
```

<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #94a3b8;">Tencent Cloud:</span>
</blockquote>

```bash
pip install -i https://mirrors.cloud.tencent.com/pypi/simple/ --trusted-host mirrors.cloud.tencent.com -r requirements.txt
```

<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #94a3b8;">- Cloud.ru:</span>
</blockquote>

```bash
pip install -i https://mirror.cloud.ru/pypi/simple/ --trusted-host mirror.cloud.ru -r requirements.txt
```

<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #94a3b8;">- VK Cloud:</span>
</blockquote>

```bash
pip install -i https://mirror.vk.com/pypi/simple/ --trusted-host mirror.vk.com -r requirements.txt
```

<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 50px;">
    <span style="color: #94a3b8;">- Yandex:</span>
</blockquote>

```bash
pip install -i https://mirror.yandex.ru/pypi/simple/ --trusted-host mirror.yandex.ru -r requirements.txt
```

<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 15px;">
    <span style="color: #94a3b8;">И так далее</span>
</blockquote>
<blockquote style="border-left: 5px solid #ff7a00; margin: 0; padding-left: 15px;">
    <span style="color: #f0f4f8;">4. (Опционально) Создайте .env файл в корне проекта</span>
</blockquote>


```bash
SECRET_KEY=ваш-секретный-ключ-для-продакшена
```

<blockquote style="border-left: 5px solid #7a3a00; margin: 0; padding-left: 15px;">
    <span style="color: #94a3b8;">(Или по умолчанию подставится dev-secret-key-2026)</span>
</blockquote>

<blockquote style="border-left: 5px solid #ff7a00; margin: 0; padding-left: 15px;">
    <span style="color: #f0f4f8;">5. Запуск приложения</span>
</blockquote>

```bash
python run.py
```


http://127.0.0.1:5000