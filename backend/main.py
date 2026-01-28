import time
import os
import shutil
import pyvips
import random
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles 
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.exc import OperationalError

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
class ROIRequest(BaseModel):
    filename: str
    x: int
    y: int
    width: int
    height: int
    patient_folder: str
    patient_name: str     
    annotation_label: str 

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

@app.post("/extract-roi")
def extract_roi_to_svs(roi: ROIRequest):
    """
    Extraction Pro : Dossier Patient > Extractions > Nom_Patient_Label_Date.svs
    """
    source_path = "/app/CMU-1.svs"
    
    if not os.path.exists(source_path):
        raise HTTPException(status_code=404, detail="Fichier source SVS introuvable")

    # 1. Nettoyage des noms pour éviter les caractères interdits
    def clean_name(name):
        return "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip().replace(" ", "_")

    safe_folder = clean_name(roi.patient_folder)
    safe_patient = clean_name(roi.patient_name)
    safe_label = clean_name(roi.annotation_label)
    date_str = datetime.now().strftime("%Y%m%d_%H%M")

    # 2. Structure Pro : dzi_data / CMU-1 / extractions /
    patient_dir = os.path.join(DZI_FOLDER, safe_folder, "extractions")
    os.makedirs(patient_dir, exist_ok=True)

    # 3. Nom de fichier Pro : Jean_Dupont_Zone_Suspecte_20231012.svs
    filename_str = f"{safe_patient}_{safe_label}_{date_str}.svs"
    output_path = os.path.join(patient_dir, filename_str)

    try:
        print(f"✂️ Extraction Pro vers {output_path}...")
        
        image = pyvips.Image.new_from_file(source_path, access="sequential")
        
        # Sécurisation des coordonnées
        safe_x = max(0, min(roi.x, image.width))
        safe_y = max(0, min(roi.y, image.height))
        safe_width = min(roi.width, image.width - safe_x)
        safe_height = min(roi.height, image.height - safe_y)

        # Extraction et Sauvegarde
        region = image.extract_area(safe_x, safe_y, safe_width, safe_height)
        
        region.tiffsave(
            output_path, 
            compression="jpeg", 
            Q=90, 
            tile=True, 
            pyramid=True, 
            bigtiff=True
        )
        
        # Chemin relatif pour l'affichage
        relative_path = f"{safe_folder}/extractions/{filename_str}"
        
        return {
            "message": "Extraction réussie", 
            "file": relative_path,
            "filename": filename_str
        }

    except Exception as e:
        print(f"❌ Erreur extraction : {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ... (Le reste des routes seed, patients, analyze ne change pas) ...
@app.post("/stitch-dzi/{filename}")
def stitch_dzi_to_svs(filename: str):
    return {"message": "Utiliser /extract-roi pour générer des SVS"}

@app.post("/seed")
def seed_database(db: Session = Depends(database.get_db)):
    db.query(models.Biopsy).delete()
    db.query(models.Patient).delete()
    db.commit()
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
        biopsy = models.Biopsy(patient_id=patient.id, image_url=default_dzi, status="Non analysé")
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