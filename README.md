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
