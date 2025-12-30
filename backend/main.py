from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

# Imports de nos fichiers
import models
import database

# Création automatique des tables dans la BDD
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# --- CONFIG CORS (Pour que React puisse parler à FastAPI) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # L'adresse de ton Frontend React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS PYDANTIC (Ce que l'API renvoie) ---
class BiopsySchema(BaseModel):
    id: int
    image_url: str
    status: str
    
    class Config:
        from_attributes = True

class PatientSchema(BaseModel):
    id: int
    name: str
    age: int
    folder_id: str
    biopsies: List[BiopsySchema] = []

    class Config:
        from_attributes = True

# --- ROUTES API ---

@app.get("/")
def read_root():
    return {"status": "API Biopsie Online 🟢"}

# 1. Route pour initialiser de fausses données (SEED)
@app.post("/seed")
def seed_database(db: Session = Depends(database.get_db)):
    # Vérifie si on a déjà des données
    if db.query(models.Patient).count() > 0:
        return {"message": "La base contient déjà des données."}

    # Création du Patient CMU-1 (Celui qui a la vraie image)
    patient1 = models.Patient(name="Jean Dupont", age=65, folder_id="CMU-1")
    db.add(patient1)
    db.commit()
    db.refresh(patient1)

    # Création de sa biopsie (Lien vers ton MinIO local)
    # L'URL doit correspondre au dossier généré par LibVIPS
    biopsy1 = models.Biopsy(
        patient_id=patient1.id, 
        image_url="http://localhost:9000/biopsies/biopsie_cmu_1_files/",
        status="En cours d'analyse"
    )
    db.add(biopsy1)

    # Un deuxième patient pour faire joli (sans vraie image pour l'instant)
    patient2 = models.Patient(name="Marie Curie", age=58, folder_id="CASE-2")
    db.add(patient2)
    
    db.commit()
    return {"message": "✅ Données de test injectées !"}

# 2. Récupérer tous les patients
@app.get("/patients", response_model=List[PatientSchema])
def get_patients(db: Session = Depends(database.get_db)):
    patients = db.query(models.Patient).all()
    return patients

# 3. Récupérer un patient spécifique
@app.get("/patients/{patient_id}", response_model=PatientSchema)
def get_patient(patient_id: int, db: Session = Depends(database.get_db)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    return patient