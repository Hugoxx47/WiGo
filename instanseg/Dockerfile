FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install build dependencies, runtime libs, and clean up
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && pip install --upgrade pip \
    && pip install --no-cache-dir \
        wheel \
        setuptools \
    && rm -rf /var/lib/apt/lists/* /root/.cache/pip/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Remove build dependencies to reduce image size
RUN apt-get purge -y --auto-remove build-essential git

COPY api.py .

EXPOSE 7000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "7000"]
