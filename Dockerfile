FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements-lock.txt /app/backend/requirements-lock.txt

RUN pip install --require-hashes -r /app/backend/requirements-lock.txt \
    && pip install gunicorn==23.0.0

COPY . /app

WORKDIR /app/backend

EXPOSE 10000

CMD ["sh", "-c", "gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-10000} --workers 2 --timeout 120"]
