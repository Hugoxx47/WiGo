# 🔬 Projet 6 : Détection de Pathologies par IA (POC)

Ce projet est une preuve de concept (POC) d'une application web permettant aux pathologistes de visualiser des biopsies géantes (WSI - Whole Slide Images) et de lancer une analyse prédictive par Intelligence Artificielle.

## 🚀 Fonctionnalités

* **Dashboard Oncologue** : Liste des patients et statut des analyses.
* **Visualiseur Haute Résolution** : Visualisation fluide d'images médicales (plusieurs giga-octets) grâce au tuilage (Deep Zoom).
* **IA Prédictive** : Simulation d'un moteur IA détectant la présence de cellules cancéreuses.
* **Architecture Micro-services** : Application entièrement conteneurisée avec Docker.

## 🛠️ Stack Technique

* **Frontend** : React, TypeScript, Vite, Material UI, OpenSeadragon.
* **Backend** : Python, FastAPI, SQLAlchemy, Pydantic.
* **Base de données** : PostgreSQL.
* **Stockage Object (S3)** : MinIO (pour les tuiles d'images).
* **Infrastructure** : Docker & Docker Compose.

## 📋 Prérequis

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et lancé.
* Un fichier de biopsie `.svs` (ex: `CMU-1.svs`) placé dans le dossier `backend/`.

## ⚙️ Installation et Lancement

### 1. Cloner le projet
```bash
git clone [https://github.com/ton-pseudo/Projet6.git](https://github.com/ton-pseudo/Projet6.git)
cd Projet6
```

Mettre le fichier **CMU-1.svs** dans le dossier **backend**
**Activer son environnement virtuel**
- Taper : py -3.11 -m venv .venv
- .\.venv\Scripts\Activate
- Faire CTRL+SHIFT+P
- Taper sélectionner un interpréteur
- Choisir le .venv ou si pas afficher cliquer sur entrer le chemin de l'interpréteur... --> Rechercher... --> suivre ce chemin backend\.venv\Scripts --> prendre le python.exe

**A l'intérieur de l'environnement, on installe les dépendances (faire attention à bien être dans le (.venv) PS)**
- Taper : python -m pip install fastapi "uvicorn[standard]" sqlalchemy psycopg2-binary minio pyvips pydantic

**Lancer le serveur**
- Entrer dans le dossier backend dans le terminal : **cd backend**
- Taper : uvicorn main:app --reload
  
**Envoyer les tuiles et patientez le temps que ça se termine**
- Taper : python convert_wsi.py

**Login et password pour Minio et Orthanc**
- Login **minioadmin** Password **minioadmin**
- Login **orthanc** Password **orthanc**
