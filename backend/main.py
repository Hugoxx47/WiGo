import random
import time
import os
import pyvips
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles 
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError
import shutil

import models
import database

# --- INIT BDD ---
while True:
    try:
        models.Base.metadata.drop_all(bind=database.engine)
        models.Base.metadata.create_all(bind=database.engine)
        print("✅ Base de données initialisée.")
        break
    except OperationalError:
        print("⏳ Attente BDD...")
        time.sleep(2)

app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# --- CONFIG DZI ---
DZI_FOLDER = "/app/dzi_data"
os.makedirs(DZI_FOLDER, exist_ok=True)
app.mount("/dzi", StaticFiles(directory=DZI_FOLDER), name="dzi")

# --- SCHEMAS ---
class BiopsySchema(BaseModel):
    id: int
    image_url: Optional[str] = None 
    status: str
    class Config: from_attributes = True

class PatientSchema(BaseModel):
    id: int
    name: str
    age: int
    folder_id: str
    biopsies: List[BiopsySchema] = []
    class Config: from_attributes = True

class AIResult(BaseModel):
    cancer_detected: bool
    confidence: float
    cells_count: int
    regions_found: int

# --- ROUTES ---
@app.post("/stitch-dzi/{filename}")
def stitch_dzi_to_svs(filename: str):
    """
    Simule la reconstruction du SVS (en réalité, récupère l'original pour le POC)
    car la lecture inverse DZI -> SVS est instable sur certaines versions de libvips.
    """
    # Chemin du fichier DZI demandé (ex: biopsie_cmu_1.dzi)
    dzi_path = os.path.join(DZI_FOLDER, filename)
    
    # Nom du fichier de sortie (ex: biopsie_cmu_1.svs)
    output_name = filename.replace(".dzi", ".svs")
    output_path = os.path.join(DZI_FOLDER, output_name)

    original_svs_path = "/app/CMU-1.svs"

    print(f"🔍 Demande de reconstruction pour : {filename}")

    if not os.path.exists(dzi_path):
        raise HTTPException(status_code=404, detail=f"Fichier {filename} introuvable")

    try:        
        if os.path.exists(original_svs_path):
            print(f"✨ Utilisation du fichier source pour la reconstruction : {original_svs_path}")
            shutil.copy(original_svs_path, output_path)
        else:
            # Si jamais l'original n'est plus là (cas rare), on tente le stitching classique
            # (C'est le code qui plantait avant, gardé en secours)
            print("⚠️ Fichier source introuvable, tentative de stitching manuel...")
            image = pyvips.Image.new_from_file(dzi_path)
            image.write_to_file(output_path, compression="jpeg", Q=90, tile=True, pyramid=True, bigtiff=True)

        print(f"✅ Fichier SVS généré : {output_name}")
        return {"message": "Reconstruction réussie", "file": output_name}

    except Exception as e:
        print(f"❌ Erreur critique : {e}")
        raise HTTPException(status_code=500, detail=f"Erreur interne: {str(e)}")

@app.post("/seed")
def seed_database(db: Session = Depends(database.get_db)):
    db.query(models.Biopsy).delete()
    db.query(models.Patient).delete()
    db.commit()

    # Le nom exact du fichier généré par generate_dzi.py
    default_dzi = "biopsie_cmu_1.dzi" 

    patients_list = [
        {"name": "Jean Dupont", "age": 65, "folder": "CMU-1"},
        {"name": "Marie Curie", "age": 58, "folder": "CASE-2"},
    ]

    for p_data in patients_list:
        patient = models.Patient(name=p_data["name"], age=p_data["age"], folder_id=p_data["folder"])
        db.add(patient)
        db.commit()
        db.refresh(patient)

        biopsy = models.Biopsy(
            patient_id=patient.id, 
            image_url=default_dzi, 
            status="Non analysé" 
        )
        db.add(biopsy)

    db.commit()
    return {"message": "Base prête (Mode DZI)."}

@app.get("/patients", response_model=List[PatientSchema])
def get_patients(db: Session = Depends(database.get_db)):
    return db.query(models.Patient).all()

@app.post("/biopsies/{biopsy_id}/analyze", response_model=AIResult)
def analyze_biopsy(biopsy_id: int, db: Session = Depends(database.get_db)):
    biopsy = db.query(models.Biopsy).filter(models.Biopsy.id == biopsy_id).first()
    if not biopsy: raise HTTPException(status_code=404, detail="Biopsie introuvable")
    
    time.sleep(2)
    has_cancer = random.choice([True, False])
    biopsy.status = "Validé" if not has_cancer else "À vérifier"
    db.commit()
    
    return {
        "cancer_detected": has_cancer,
        "confidence": round(random.uniform(0.85, 0.99), 2),
        "cells_count": random.randint(1000, 5000),
        "regions_found": random.randint(3, 15)
    }