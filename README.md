# 🔬 WiGo - Plateforme d'Analyse Collaborative de Biopsies

![WiGo Status](https://img.shields.io/badge/Status-Prototype-blue) ![Docker](https://img.shields.io/badge/Docker-Ready-2496ED) ![Stack](https://img.shields.io/badge/Stack-React%20%7C%20FastAPI%20%7C%20PostgreSQL-green)

**WiGo** est une solution innovante de workflow no-code assisté par IA, conçue pour transformer le diagnostic anatomopathologique. Elle permet aux pathologistes et oncologues de collaborer de manière asynchrone (mode offline) sur des lames virtuelles haute résolution, sécurisant ainsi le diagnostic et accélérant la prise en charge des patients.

---

## 🚀 Fonctionnalités Clés

### 1. Visualisation Haute Résolution (WSI)
- **Deep Zooming :** Intégration d'**OpenSeadragon** pour la navigation fluide dans les images gigapixels (format `.dzi` / `.svs`).
- **Mini-map :** Navigation contextuelle rapide sur la lame.

### 2. Collaboration "Asynchrone & Sécurisée"
- **Logique Métier Avancée :** Système de droits stricts sur les annotations.
    - Un médecin voit les annotations de ses confrères (code couleur **Orange**).
    - Il ne peut modifier ou supprimer **que ses propres annotations** (code couleur **Vert**).
    - Protection contre les suppressions accidentelles via des modales de confirmation.
- **Attribution Automatique :** Chaque forme (carré, rond, polygone, texte) est signée numériquement par son auteur.

### 3. Workflow Médical Structuré
- **File d'attente intelligente :** Tableau de bord listant les patients et le statut de l'analyse (En cours, Terminé, Archivé).
- **Formulaires Pathologiques :** Saisie standardisée des données (Type histologique, Grade SBR, Biomarqueurs).
- **Gestion des cas :** Création de nouvelles extractions (ROI) ou révision de dossiers existants.

### 4. Architecture Robuste & Portable
- **Conteneurisation Totale :** Déploiement "One-Click" via Docker Compose.
- **Persistance des données :** Volumes Docker pour PostgreSQL et le stockage d'images (MinIO).

---

## 🛠️ Architecture Technique

Le projet repose sur une architecture micro-services moderne :

```mermaid
graph TD
    Client[Client Web (React/Vite)] -->|HTTP/REST| API[API Gateway (FastAPI)]
    API -->|SQL| DB[(PostgreSQL)]
    API -->|File Storage| MinIO[(MinIO / S3)]
    API -->|Image Processing| PyVips[Traitement DZI]

```

### Stack Technologique

* **Frontend :** React 18, TypeScript, TailwindCSS, Material UI, Recharts.
* **Backend :** Python 3.9, FastAPI, SQLAlchemy, Pydantic.
* **Traitement Image :** LibVips (conversion performante SVS -> DZI).
* **Base de Données :** PostgreSQL 15.
* **Infrastructure :** Docker & Docker Compose.

---

## 📦 Installation & Démarrage

Ce projet est conçu pour être lancé instantanément sur n'importe quelle machine disposant de Docker.

### Prérequis

* [Docker Desktop](https://www.docker.com/products/docker-desktop/) installé et lancé.
* Le fichier de biopsie **`CMU-1.svs`** doit être placé dans le dossier `backend/` avant de lancer.

### 1. Démarrage de l'application

Ouvrez un terminal à la racine du projet et lancez :

```bash
docker compose up -d --build

```

> ☕ **Prenez un café :** La première construction peut prendre quelques minutes (téléchargement des images de base et compilation).

### 2. Initialisation des Données (Seed)

Une fois les conteneurs lancés ("Up"), injectez les données de test (Patients fictifs, Dossiers, Médecins) :

**Option A (Via Navigateur - Recommandé) :**

1. Allez sur le Swagger de l'API : [http://localhost:8000/docs](https://www.google.com/search?q=http://localhost:8000/docs)
2. Cherchez la route verte **`POST /seed`**.
3. Cliquez sur **"Try it out"** puis **"Execute"**.

**Option B (Via Terminal Windows) :**

```powershell
curl.exe -X POST http://localhost:8000/seed

```

### 3. Accès à la plateforme

Ouvrez votre navigateur sur : **[http://localhost:5173](https://www.google.com/search?q=http://localhost:5173)**

---

## 📖 Guide d'Utilisation (Scénario de Démo)

Pour démontrer la logique collaborative, suivez ces étapes :

### Phase 1 : Le Diagnostic Initial

1. Connectez-vous avec l'identifiant : **`Dr. Kennedy`**.
2. Sélectionnez le patient **"Jean Dupont"**.
3. Cliquez sur **"Nouvelle"** pour créer une nouvelle zone d'analyse.
4. Utilisez l'outil **Rectangle** pour entourer une zone suspecte.
5. Cliquez sur **"Créer l'extraction"**.
6. Déconnectez-vous.

### Phase 2 : La Contre-Expertise (Second Avis)

1. Connectez-vous avec l'identifiant : **`Dr. House`**.
2. Sur la carte de "Jean Dupont", le bouton **"Ouvrir"** est apparu. Cliquez dessus.
3. Sélectionnez le dossier créé par Kennedy dans la liste.
4. **Observez la collaboration :**
* L'annotation de Kennedy apparaît en **Orange** (indiquant qu'elle appartient à un collègue).
* Une étiquette "Dr. Kennedy" est affichée au-dessus.
* Impossible de la déplacer ou de la modifier (Curseur interdit 🚫).


5. Ajoutez votre propre annotation (Cercle). Elle s'affiche en **Vert** ("Moi").
6. Cliquez sur **"Mettre à jour"**.

---

## 📂 Structure du Projet

```text
Projet6/
├── backend/                # API Python & Logique métier
│   ├── main.py             # Point d'entrée FastAPI
│   ├── models.py           # Modèles de BDD (User, Extraction, Drawing...)
│   ├── database.py         # Connexion Postgres
│   └── dzi_data/           # Stockage des images tuilées
├── frontend/               # Interface Utilisateur React
│   ├── src/
│   │   ├── components/     # Composants réutilisables (PatientCard...)
│   │   ├── pages/          # Pages principales (Dashboard, Viewer, Login)
│   │   └── services/       # Appels API
├── docker-compose.yml      # Orchestration des conteneurs
└── README.md               # Documentation

```

---

## 🔮 Roadmap / Prochaines Étapes

* [ ] **Sécurité :** Chiffrement des données patients au repos (AES-256).
* [ ] **IA :** Intégration réelle du modèle de segmentation pour la pré-annotation automatique des tumeurs.
* [ ] **Messagerie :** Ajout d'un chat temps réel (WebSocket) associé à chaque extraction.
* [ ] **Export :** Génération PDF du rapport final standardisé.

---

**WiGo** - *Innovation Lab for Health*

```

```