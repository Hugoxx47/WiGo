# backend/Dockerfile
FROM python:3.9

WORKDIR /app

# 1. Installation des dépendances système (DCMTK + LibVips + Java pour wsi-to-dicom si besoin)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libvips-dev \
    dcmtk \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 2. Installation des dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copie du code
COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]