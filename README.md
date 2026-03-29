# 🔬 WiGo - Plateforme d'Analyse Collaborative de Biopsies

**WiGo** est une solution de **Pathologie Numérique** assistée par ordinateur. Elle permet la conversion, la visualisation et l'annotation collaborative d'images de biopsies haute résolution (Whole Slide Imaging).

Conçue pour les workflow médicaux complexes, elle assure la transition entre le stockage froid (MinIO) et la visualisation web instantanée (Deep Zoom) grâce à une architecture microservices robuste.

---

## 🚀 Fonctionnalités Clés

### 1. Visualisation Ultra-Performante

* **Format Deep Zoom (DZI) :** Affichage fluide d'images gigapixels sans temps de chargement, grâce au tuilage pyramidal.
* **Support SVS :** Prise en charge native des fichiers scanners standards (Aperio .svs).
* **Navigation :** Zoom profond, panoramique et mini-map contextuelle via **OpenSeadragon**.

### 2. Collaboration Médicale Sécurisée

* **Gestion des Rôles :**
* **Mes annotations (Vert) :** Modifiables et supprimables.
* **Annotations Confrères (Orange) :** Lecture seule, affichage du nom de l'auteur.


* **Sécurité des Données :** Impossible de supprimer ou d'altérer le diagnostic d'un autre médecin.
* **Workflow Clinique :** Suivi du statut des analyses (En cours, Terminé, Archivé) et formulaires pathologiques standardisés (Grade SBR, H&E/IHC, etc.).

### 3. Dashboard Analytique

* **Statistiques en temps réel :** Graphiques (Recharts) montrant la répartition des cas (Sains vs Critiques) et l'activité hebdomadaire.
* **File d'attente intelligente :** Accès conditionnel aux dossiers (Bouton "Ouvrir" uniquement si une extraction existe).

---

## 🏗️ Architecture Technique : Le Pipeline SVS → DZI

L'innovation principale de WiGo réside dans sa gestion des fichiers lourds. Le navigateur ne peut pas lire un fichier `.svs` de 2Go directement. Nous utilisons un pipeline de conversion asynchrone.

### Comprendre le Flux de Données

1. **Le Coffre-Fort (MinIO / S3) :**
* Stocke le fichier original **`CMU-1.svs`** (la "source brute").
* C'est la référence légale et médicale inaltérable.


2. **Le Convertisseur (Backend Python) :**
* Au démarrage, le script `generate_dzi.py` télécharge le fichier depuis MinIO.
* Il utilise **LibVips (PyVips)** pour découper l'image en milliers de petites tuiles `.jpeg`.


3. **Le Serveur de Tuiles (Volume Docker) :**
* Le résultat est stocké dans `backend/dzi_data/`.
* Il contient un fichier manifeste `.dzi` (XML) et un dossier `_files` avec les niveaux de zoom (0 à 16).


4. **Le Visualiseur (Frontend React) :**
* OpenSeadragon ne télécharge pas l'image entière. Il requête uniquement les petites tuiles `.jpeg` correspondant à la zone que le médecin regarde.



> **En résumé :**
> * **MinIO** = La "Vache" entière (Stockage froid).
> * **DZI/Local** = Les "Steaks hachés" prêts à consommer (Stockage chaud).
> * **Viewer** = Le Client qui consomme les tuiles à la demande.
> 
> 

---

## 🛠️ Stack Technologique

| Couche | Technologies |
| --- | --- |
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, Material UI, OpenSeadragon |
| **Backend** | Python 3.10, FastAPI, SQLAlchemy, Pydantic |
| **Traitement** | **PyVips** (Traitement d'images haute performance) |
| **Base de Données** | **PostgreSQL 15** (Données structurées & Annotations JSON) |
| **Stockage Objet** | **MinIO** (Compatible Amazon S3) |
| **Infra** | Docker, Docker Compose |

---

## 📦 Installation & Démarrage

### Prérequis

* **Docker & Docker Compose :** Assurez-vous que Docker Desktop est installé et en cours d'exécution. Téléchargez-le depuis [docker.com](https://www.docker.com/products/docker-desktop) si nécessaire.
* **Fichiers de biopsie :** Un fichier de biopsie nommé **`CMU-1.svs`** doit être placé dans le dossier `backend/` (ou configuré dans votre bucket MinIO). Pour la démo, des fichiers exemples sont inclus.
* **Ressources système :** Au moins 8GB RAM et 10GB d'espace disque libre pour la conversion d'images.
* **Navigateur web :** Chrome, Firefox ou Edge pour une compatibilité optimale avec OpenSeadragon.

### Configuration

Avant de lancer le projet, vérifiez les fichiers de configuration :

* **`docker-compose.yml` :** Définit les services (backend, frontend, db, minio). Modifiez les ports si nécessaire (par défaut : 8000 pour backend, 5173 pour frontend, 5432 pour PostgreSQL, 9000/9001 pour MinIO).
* **Variables d'environnement :** Dans `docker-compose.yml`, ajustez les variables comme `POSTGRES_PASSWORD`, `MINIO_ACCESS_KEY`, etc., pour la sécurité en production.
* **Backend :** Le fichier `backend/main.py` contient les routes API. Pour le développement, vous pouvez modifier les endpoints ou ajouter de nouvelles fonctionnalités.
* **Frontend :** Le fichier `frontend/vite.config.ts` configure le proxy pour l'API backend.

Pour une configuration avancée, consultez la documentation de chaque service (FastAPI, React, PostgreSQL, MinIO).

### 1. Lancement

```bash
# Construire et lancer les conteneurs
docker compose up -d --build

```

### 2. Initialisation (Seed)

Pour peupler la base de données avec des médecins et des patients fictifs :

* **Via l'API :** `POST http://localhost:8000/seed`
* **Via Swagger :** Allez sur [http://localhost:8000/docs](https://www.google.com/search?q=http://localhost:8000/docs), cherchez `/seed` et cliquez sur "Execute".

### 3. Accès

* **Frontend (App) :** [http://localhost:5173](https://www.google.com/search?q=http://localhost:5173)
* **Backend (Docs) :** [http://localhost:8000/docs](https://www.google.com/search?q=http://localhost:8000/docs)
* **MinIO (Console) :** [http://localhost:9001](https://www.google.com/search?q=http://localhost:9001)

### Développement Local

Si vous souhaitez développer sans Docker ou personnaliser le code :

1. **Backend (Python) :**
   - Installez Python 3.10+.
   - Créez un environnement virtuel : `python -m venv backend/.venv`
   - Activez-le : `backend\.venv\Scripts\activate` (Windows) ou `source backend/.venv/bin/activate` (Linux/Mac)
   - Installez les dépendances : `pip install -r backend/requirements.txt`
   - Lancez le serveur : `uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000`

2. **Frontend (React) :**
   - Installez Node.js 18+ et npm.
   - Installez les dépendances : `cd frontend && npm install`
   - Lancez le serveur de développement : `npm run dev`
   - L'app sera accessible sur [http://localhost:5173](http://localhost:5173)

3. **Base de données :** Utilisez PostgreSQL local ou un conteneur séparé. Configurez la connexion dans `backend/main.py`.

4. **MinIO :** Lancez un serveur MinIO local ou utilisez un bucket cloud. Configurez les credentials dans le code.

Pour déboguer, consultez les logs des conteneurs avec `docker compose logs -f [service]`.

---

## 📖 Guide du Médecin (Démo)

1. **Connexion :** Entrez un nom d'utilisateur (ex: "Dr. House").
2. **Dashboard :** Sélectionnez le patient "Jean Dupont" (ID: CMU-1).
3. **Nouvelle Analyse :** Cliquez sur "Nouvelle" pour générer une extraction.
4. **Annotation :**
* Utilisez les outils (Rectangle, Cercle) pour marquer une zone.
* Remplissez le formulaire à droite (Diagnostic, Observations).
* Cliquez sur **"Créer l'extraction"**.


5. **Simulation Collaboration :**
* Ouvrez une nouvelle fenêtre privée.
* Connectez-vous en tant que "Dr. Wilson".
* Ouvrez le même dossier. Vous verrez les annotations du Dr. House en **Orange** (Lecture seule).
* Ajoutez une annotation par-dessus : elle sera en **Vert** (Votre propriété).

### APIs Principales

WiGo expose une API REST via FastAPI. Voici les endpoints clés :

* **GET /patients** : Liste tous les patients.
* **GET /patients/{id}** : Détails d'un patient spécifique.
* **POST /extractions** : Crée une nouvelle extraction/annotation.
* **GET /extractions/{patient_id}** : Liste les extractions pour un patient.
* **POST /seed** : Initialise la base de données avec des données fictives.
* **GET /dzi/{filename}** : Sert les fichiers DZI pour la visualisation.

Consultez la documentation complète sur [http://localhost:8000/docs](http://localhost:8000/docs) après lancement.

---

## 📂 Structure des Dossiers

```text
Projet6/
├── backend/
│   ├── dzi_data/           # Volume partagé contenant les tuiles générées
│   │   ├── CMU-1/          # Dossier par patient
│   │   └── biopsie_cmu_1.dzi
│   ├── main.py             # API FastAPI (Routes & Logique)
│   ├── generate_dzi.py     # Script ETL (MinIO -> PyVips -> DZI)
│   ├── models.py           # Schémas de Base de données (SQLAlchemy)
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # Viewer, Dashboard, PatientCard...
│   │   └── services/       # Appels API (Axios/Fetch)
│   └── Dockerfile
└── docker-compose.yml      # Orchestration

```

---

## 🔧 Troubleshooting

### Problèmes Courants

* **Erreur de build Docker :** Assurez-vous que Docker Desktop est en cours d'exécution et que vous avez suffisamment d'espace disque. Essayez `docker system prune` pour nettoyer.
* **Port déjà utilisé :** Modifiez les ports dans `docker-compose.yml` si 8000, 5173, etc., sont occupés.
* **Fichier SVS manquant :** Placez `CMU-1.svs` dans `backend/`. Pour tester, utilisez les fichiers exemples fournis.
* **Conversion DZI échoue :** Vérifiez les logs avec `docker compose logs backend`. Assurez-vous que PyVips est installé dans le conteneur.
* **Annotations non sauvegardées :** Vérifiez la connexion à PostgreSQL. Les données sont persistées dans un volume Docker.
* **Performance lente :** La conversion initiale peut prendre du temps. Pour les gros fichiers, augmentez la RAM allouée à Docker.

### Logs et Debugging

* **Logs des conteneurs :** `docker compose logs [service]` (ex: `docker compose logs backend`)
* **Accès au conteneur :** `docker compose exec backend bash`
* **Redémarrage :** `docker compose restart`

---

## 🔒 Sécurité et Conformité

**⚠️ Important :** WiGo est une plateforme de démonstration technique. Elle n'est pas destinée à un usage médical réel sans validation réglementaire.

* **Confidentialité :** Les données médicales sont sensibles. En production, chiffrez les communications (HTTPS) et stockez les données de manière sécurisée.
* **RGPD/Conformité :** Implémentez l'anonymisation des données et le consentement des patients.
* **Authentification :** Actuellement simplifiée pour la démo. En production, utilisez OAuth2, JWT sécurisés, ou intégration LDAP.
* **Audit :** Les annotations sont traçables par auteur, mais ajoutez des logs d'audit complets.
* **Sauvegarde :** Configurez des sauvegardes régulières pour PostgreSQL et MinIO.

Pour une implémentation en production, consultez les normes HIPAA, RGPD, ou équivalents locaux.

---

## 🤝 Contribution

Nous accueillons les contributions ! Pour participer :

1. **Fork** le repository.
2. **Clone** votre fork : `git clone https://github.com/votre-username/Projet6.git`
3. **Créez une branche** : `git checkout -b feature/nouvelle-fonctionnalite`
4. **Développez** et testez vos changements.
5. **Commit** : `git commit -m "Ajout de [description]"`
6. **Push** : `git push origin feature/nouvelle-fonctionnalite`
7. **Pull Request** : Ouvrez une PR avec une description détaillée.

### Guidelines

* Suivez les conventions de code (PEP8 pour Python, ESLint pour JS/TS).
* Ajoutez des tests pour les nouvelles fonctionnalités.
* Mettez à jour la documentation si nécessaire.
* Respectez la sécurité des données médicales.

---

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

**WiGo** - *Plateforme de démonstration technique pour l'analyse de biopsies.*