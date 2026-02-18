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

* Docker & Docker Compose installés.
* Un fichier de biopsie nommé **`CMU-1.svs`** placé à la racine du dossier `backend/` (ou disponible dans votre bucket MinIO configuré).

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

**WiGo** - *Plateforme de démonstration technique pour l'analyse de biopsies.*