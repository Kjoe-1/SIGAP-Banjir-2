FROM python:3.9-slim

WORKDIR /app

COPY requirements_fastapi.txt ./
RUN pip install --no-cache-dir -r requirements_fastapi.txt

COPY . .

EXPOSE 8000

CMD ["python", "fastapi_app.py"]
