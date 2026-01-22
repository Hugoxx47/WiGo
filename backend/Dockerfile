# Image de base Python 3.11
FROM python:3.11-slim

# Installation des dépendances système
# CORRECTION ICI : on remplace libgl1-mesa-glx par libgl1
RUN apt-get update && apt-get install -y \
    libgl1 \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Dossier de travail dans le conteneur
WORKDIR /app

# Copie des requirements
COPY requirements.txt .

# Installation des dépendances Python
RUN pip install --no-cache-dir -r requirements.txt

# Copie de tout le code backend
COPY . .

# Exposition du port
EXPOSE 8000

# Commande de lancement
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]