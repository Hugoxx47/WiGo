import time
import random
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError # Pour gérer l'erreur de connexion

# Imports de nos fichiers
import models
import database

while True:
    try:
        models.Base.metadata.create_all(bind=database.engine)
        print("✅ Base de données connectée et synchronisée !")
        break
    except OperationalError:
        print("⏳ La BDD n'est pas encore prête... Nouvelle tentative dans 2 secondes.")
        time.sleep(2)

app = FastAPI()

# --- CONFIG CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # On autorise tout pour Docker (plus simple)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS PYDANTIC ---
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

@app.post("/seed")
def seed_database(db: Session = Depends(database.get_db)):
    if db.query(models.Patient).count() > 0:
        return {"message": "La base contient déjà des données."}

    patient1 = models.Patient(name="Jean Dupont", age=65, folder_id="CMU-1")
    db.add(patient1)
    db.commit()
    db.refresh(patient1)

    # Attention : L'URL ici doit être accessible depuis ton navigateur (localhost)
    biopsy1 = models.Biopsy(
        patient_id=patient1.id, 
        image_url="http://localhost:9000/biopsies/biopsie_cmu_1_files/",
        status="En cours d'analyse"
    )
    db.add(biopsy1)

    patient2 = models.Patient(name="Marie Curie", age=58, folder_id="CASE-2")
    db.add(patient2)
    
    db.commit()
    return {"message": "✅ Données de test injectées !"}

@app.get("/patients", response_model=List[PatientSchema])
def get_patients(db: Session = Depends(database.get_db)):
    patients = db.query(models.Patient).all()
    return patients

@app.post("/biopsies/{biopsy_id}/analyze", response_model=AIResult)
def analyze_biopsy(biopsy_id: int, db: Session = Depends(database.get_db)):
    biopsy = db.query(models.Biopsy).filter(models.Biopsy.id == biopsy_id).first()
    if not biopsy:
        raise HTTPException(status_code=404, detail="Biopsie introuvable")

    time.sleep(3) 

    has_cancer = random.choice([True, False])
    confidence = round(random.uniform(0.85, 0.99), 2)
    cells = random.randint(1000, 5000)
    
    biopsy.status = "Validé" if not has_cancer else "À vérifier"
    db.commit()

    return {
        "cancer_detected": has_cancer,
        "confidence": confidence,
        "cells_count": cells,
        "regions_found": random.randint(3, 15)
    }