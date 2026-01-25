import time
import random
import requests 
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError

import models
import database

# Attente BDD
while True:
    try:
        models.Base.metadata.create_all(bind=database.engine)
        print("✅ Base de données connectée et synchronisée !")
        break
    except OperationalError:
        print("⏳ La BDD n'est pas encore prête... Nouvelle tentative dans 2 secondes.")
        time.sleep(2)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEMAS ---
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

# --- ROUTES ---
@app.get("/")
def read_root():
    return {"status": "API Biopsie Online 🟢"}

@app.post("/seed")
def seed_database(db: Session = Depends(database.get_db)):

    # 2. Get Orthanc ID (NO AUTH)
    orthanc_id = "EMPTY"
    try:
        # NO auth parameter here
        response = requests.get("http://orthanc:8042/instances")
        if response.status_code == 200:
            instances = response.json()
            if instances:
                orthanc_id = instances[0]
                print(f"✅ Image Orthanc trouvée : {orthanc_id}")
            else:
                print("⚠️ Orthanc est vide.")
        else:
            print(f"❌ Erreur connexion Orthanc: {response.status_code}")
    except Exception as e:
        print(f"❌ Erreur Script : {e}")

    # 3. Création des patients
    patients_data = [
        {"name": "Jean Dupont", "age": 65, "folder": "CMU-1"},
        {"name": "Marie Curie", "age": 58, "folder": "CASE-2"},
        {"name": "Thomas Anderson", "age": 35, "folder": "MATRIX-3"},
        {"name": "Sarah Connor", "age": 42, "folder": "SKY-4"},
    ]

    for p in patients_data:
        patient = models.Patient(name=p["name"], age=p["age"], folder_id=p["folder"])
        db.add(patient)
        db.commit()
        db.refresh(patient)

        biopsy = models.Biopsy(
            patient_id=patient.id, 
            image_url=orthanc_id, 
            status="Non analysé" 
        )
        db.add(biopsy)
    
    db.commit()
    return {"message": f"✅ Base prête : 4 patients liés à l'image {orthanc_id}"}

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