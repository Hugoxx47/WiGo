# 🔬 Projet 6 : Détection de Pathologies par IA

Application web d'aide au diagnostic permettant aux pathologistes de visualiser des biopsies géantes (WSI) et de simuler une analyse IA.

## 📋 Prérequis

1.  **Docker Desktop** doit être installé et lancé.
2.  Le fichier de biopsie **`CMU-1.svs`** (téléchargeable sur OpenSlide).

---

## ⚙️ Installation Rapide (3 minutes)

### 1. Préparation du fichier
Place le fichier **`CMU-1.svs`** directement dans le dossier :
`Projet6/backend/`

*(C'est indispensable pour que le convertisseur le trouve)*.

### 2. Démarrage de l'infrastructure
Ouvre un terminal (PowerShell ou VS Code) à la racine du projet et lance :

`docker-compose up -d --build`

*Attends que tous les conteneurs (frontend, backend, postgres, orthanc) soient verts (environ 1-2 minutes la première fois).*

### 3. Conversion de l'image (Une seule fois)
Cette étape transforme le fichier .svs en format médical DICOM et l'envoie dans le serveur Orthanc.

`docker exec p6_backend python -u convert_wsi.py`

*Attends de voir le message : 🎉 SUCCÈS ! Image HD envoyée à Orthanc.*

### 4. Création des patients (Seed)
Cette étape remplit la base de données avec les patients fictifs (Jean Dupont, etc.) et lie l'image.

`Invoke-RestMethod -Method POST -Uri "http://localhost:8000/seed"`

*(Si cette commande échoue sur ton PC, va simplement sur https://www.google.com/search?q=http://localhost:8000/docs, cherche POST /seed et clique sur "Execute").*

---

## 🖥️ Accès à l'application
Site Web (Dashboard) : http://localhost:5173

Serveur PACS (Orthanc) : http://localhost:8042

Login : orthanc

Password : orthanc

Dans Orthanc cliquer sur Lookup en haut à gauche puis sur Do lookup et cliquer sur Jean Dupont avancer dans les onglets jusqu'à arriver sur DICOM Tags et cliquer sur Preview the instance en bas à gauche pour voir l'image.

API Documentation (Swagger) : http://localhost:8000/docs

---

## 🛠️ Commandes Utiles
#### Éteindre l'application
Pour arrêter les serveurs sans rien effacer :

`docker-compose stop`

#### Tout nettoyer (Reset complet)

Si l'application bug ou si tu veux repartir de zéro (efface la base de données et les images) :

`docker-compose down -v`

Ensuite, il faut relancer l'installation depuis l'étape 2.

#### Voir les logs (en cas de problème)

Pour voir ce qui se passe dans le backend :

`docker logs -f p6_backend`

---

## 🏗️ Architecture Technique
L'application tourne entièrement dans des conteneurs Docker isolés :

Frontend (Port 5173) : React + Vite + CornerstoneJS (Visualiseur médical).

Backend (Port 8000) : Python FastAPI. Gère la logique et la conversion d'images.

PostgreSQL (Port 5432) : Base de données des patients et des analyses.

Orthanc (Port 8042) : Serveur PACS standard pour le stockage des images médicales DICOM.
