import time
import os
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles 
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import models
import database

# --- INIT BDD ---
while True:
    try:
        models.Base.metadata.create_all(bind=database.engine)
        print("✅ Base de données connectée.")
        break
    except Exception as e:
        print(f"⏳ Attente BDD... ({e})")
        time.sleep(2)

app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.middleware("http")
async def add_cors_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

DZI_FOLDER = "/app/dzi_data"
os.makedirs(DZI_FOLDER, exist_ok=True)
app.mount("/dzi_data", StaticFiles(directory=DZI_FOLDER), name="dzi_data")

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
    # NOUVEAUX CHAMPS FORMULAIRE
    birth_date: Optional[str] = None
    family_history: Optional[str] = None
    medical_history: Optional[str] = None

class DrawingRequest(BaseModel):
    extraction_id: int
    x: int
    y: int
    w: int
    h: int
    label: str

class BiopsySchema(BaseModel):
    id: int
    image_url: str
    status: str
    class Config: from_attributes = True

class PatientSchema(BaseModel):
    id: int
    name: str
    age: int
    folder_id: str
    birth_date: Optional[str] = None
    family_history: Optional[str] = None
    medical_history: Optional[str] = None
    biopsies: List[BiopsySchema] = [] 
    class Config: from_attributes = True

# --- ROUTES ---

@app.post("/seed")
def seed_database(db: Session = Depends(database.get_db)):
    try:
        db.query(models.Drawing).delete()
        db.query(models.Extraction).delete()
        db.query(models.Biopsy).delete()
        db.query(models.Patient).delete()
        db.commit()
    except Exception:
        db.rollback()

    patients_data = [
        {"name": "Jean Dupont", "age": 65, "folder": "CMU-1", "birth": "1958-05-12", "family": "Non", "med": "Hypertension"},
        {"name": "Marie Curie", "age": 58, "folder": "CASE-2", "birth": "1965-11-07", "family": "Oui", "med": "Suivi annuel"},
        {"name": "Paul Martin", "age": 42, "folder": "X-99", "birth": "1982-02-23", "family": "Non", "med": "RAS"}
    ]
    
    default_image = "biopsie_cmu_1.dzi"
    
    count = 0
    for p in patients_data:
        patient = models.Patient(
            name=p["name"], age=p["age"], folder_id=p["folder"],
            birth_date=p["birth"], family_history=p["family"], medical_history=p["med"]
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        
        biopsy = models.Biopsy(patient_id=patient.id, image_url=default_image, status="Non analysé")
        db.add(biopsy)
        count += 1
    
    db.commit()
    return {"message": f"Succès ! {count} patients ajoutés."}

@app.get("/patients", response_model=List[PatientSchema])
def get_patients(db: Session = Depends(database.get_db)):
    return db.query(models.Patient).all()

@app.post("/extract-roi")
def extract_roi(roi: ROIRequest, db: Session = Depends(database.get_db)):
    # 1. On récupère ou crée le patient
    patient = db.query(models.Patient).filter(models.Patient.folder_id == roi.patient_folder).first()
    if not patient:
        patient = models.Patient(name=roi.patient_name, age=0, folder_id=roi.patient_folder)
        db.add(patient)
        db.commit()
        db.refresh(patient)

    # 2. MISE À JOUR DES INFOS MÉDICALES (C'est ici la magie)
    # Si le formulaire envoie des données, on met à jour le patient
    if roi.birth_date: patient.birth_date = roi.birth_date
    if roi.family_history: patient.family_history = roi.family_history
    if roi.medical_history: patient.medical_history = roi.medical_history
    db.commit()

    # 3. Création de l'extraction
    new_ext = models.Extraction(
        patient_id=patient.id,
        label=roi.annotation_label,
        dzi_url="biopsie_cmu_1.dzi",
        x=roi.x, y=roi.y, w=roi.width, h=roi.height
    )
    db.add(new_ext)
    db.commit()
    return {"message": "Dossier mis à jour et Zone sauvegardée", "id": new_ext.id}

@app.get("/patients/{folder_id}/extractions")
def get_extractions(folder_id: str, db: Session = Depends(database.get_db)):
    patient = db.query(models.Patient).filter(models.Patient.folder_id == folder_id).first()
    if not patient: return []
    results = []
    for e in patient.extractions:
        results.append({
            "id": e.id,
            "filename": e.label,
            "url": f"http://localhost:8000/dzi_data/{e.dzi_url}",
            "roi": { "x": e.x, "y": e.y, "w": e.w, "h": e.h }
        })
    return results

@app.post("/annotations/save")
def save_drawing(draw: DrawingRequest, db: Session = Depends(database.get_db)):
    db.add(models.Drawing(
        extraction_id=draw.extraction_id,
        x=draw.x, y=draw.y, w=draw.w, h=draw.h, label=draw.label
    ))
    db.commit()
    return {"message": "Annotation enregistrée"}