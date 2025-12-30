from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

# Imports de nos fichiers
import models
import database
import time
import random

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

class AIResult(BaseModel):
    cancer_detected: bool
    confidence: float
    cells_count: int
    regions_found: int

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

# 4. Analyse IA
@app.post("/biopsies/{biopsy_id}/analyze", response_model=AIResult)
def analyze_biopsy(biopsy_id: int, db: Session = Depends(database.get_db)):
    # 1. Vérifier que la biopsie existe
    biopsy = db.query(models.Biopsy).filter(models.Biopsy.id == biopsy_id).first()
    if not biopsy:
        raise HTTPException(status_code=404, detail="Biopsie introuvable")

    # 2. Simuler un traitement lourd (L'IA réfléchit...)
    time.sleep(3) 

    # 3. Générer des résultats aléatoires (Simulation)
    has_cancer = random.choice([True, False])
    confidence = round(random.uniform(0.85, 0.99), 2)
    cells = random.randint(1000, 5000)
    
    # 4. Mettre à jour la base de données
    biopsy.status = "Validé" if not has_cancer else "À vérifier"
    db.commit()

    return {
        "cancer_detected": has_cancer,
        "confidence": confidence,
        "cells_count": cells,
        "regions_found": random.randint(3, 15)
    }