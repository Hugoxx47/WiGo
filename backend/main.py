import time
import os
import shutil
import pyvips
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles 
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import models
import database

# --- INIT BDD ---
try:
    models.Base.metadata.create_all(bind=database.engine)
    print("✅ Base de données connectée.")
except Exception as e:
    print(f"❌ ERREUR FATALE BDD : {e}")
    raise e

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

# Dossiers
DZI_FOLDER = "/app/dzi_data"
os.makedirs(DZI_FOLDER, exist_ok=True)
app.mount("/dzi_data", StaticFiles(directory=DZI_FOLDER), name="dzi_data")

# --- SCHEMAS (Mis à jour pour le formulaire) ---
class ROIRequest(BaseModel):
    filename: str
    x: int
    y: int
    width: int
    height: int
    patient_folder: str
    patient_name: str     
    annotation_label: str 
    
    # Infos Patient (Mise à jour dossier)
    birth_date: Optional[str] = None
    family_history: Optional[str] = None
    medical_history: Optional[str] = None

    # --- NOUVEAUX CHAMPS FORMULAIRE (Ceux du Viewer.tsx) ---
    prelevement_type: Optional[str] = None
    prelevement_date: Optional[str] = None
    block_number: Optional[str] = None
    fixation: Optional[str] = None
    slide_count: Optional[int] = None
    staining: Optional[List[str]] = None
    macro_obs: Optional[str] = None
    micro_obs: Optional[str] = None
    histo_type: Optional[str] = None
    sbr_grade: Optional[str] = None
    margins: Optional[str] = None
    hormonal_receptors: Optional[str] = None
    diagnosis: Optional[str] = None
    comments: Optional[str] = None
    status: Optional[str] = None
    pathologist: Optional[str] = None
    validation_date: Optional[str] = None

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

    # 2. MISE À JOUR DES INFOS PATIENT
    if roi.birth_date: patient.birth_date = roi.birth_date
    if roi.family_history: patient.family_history = roi.family_history
    if roi.medical_history: patient.medical_history = roi.medical_history
    db.commit()

    # 3. GENERATION DU FICHIER SVS (Extraction physique)
    safe_folder = "".join(c for c in roi.patient_folder if c.isalnum() or c in (' ', '-', '_')).strip()
    patient_dir = os.path.join(DZI_FOLDER, safe_folder, "extractions")
    os.makedirs(patient_dir, exist_ok=True)
    
    filename_str = f"extraction_{int(time.time())}.svs"
    output_path = os.path.join(patient_dir, filename_str)
    source_path = "/app/CMU-1.svs" # Source par défaut pour le POC

    # Tentative d'extraction réelle si le fichier source existe
    if os.path.exists(source_path):
        try:
            image = pyvips.Image.new_from_file(source_path, access="sequential")
            safe_x = max(0, min(roi.x, image.width))
            safe_y = max(0, min(roi.y, image.height))
            region = image.extract_area(safe_x, safe_y, roi.width, roi.height)
            region.tiffsave(output_path, compression="jpeg", Q=90, tile=True, pyramid=True, bigtiff=True)
        except Exception as e:
            print(f"⚠️ Erreur extraction image: {e}")
            # On continue pour sauvegarder les données même si l'image plante

    # 4. SAUVEGARDE EN BDD (Le rapport complet)
    new_ext = models.Extraction(
        patient_id=patient.id,
        label=roi.annotation_label,
        dzi_url=f"{safe_folder}/extractions/{filename_str}", # Chemin relatif pour le viewer
        x=roi.x, y=roi.y, w=roi.width, h=roi.height,
        
        # Mapping des champs du formulaire
        prelevement_type=roi.prelevement_type,
        prelevement_date=roi.prelevement_date,
        block_number=roi.block_number,
        fixation=roi.fixation,
        slide_count=roi.slide_count,
        staining=roi.staining,
        macro_obs=roi.macro_obs,
        micro_obs=roi.micro_obs,
        histo_type=roi.histo_type,
        sbr_grade=roi.sbr_grade,
        margins=roi.margins,
        hormonal_receptors=roi.hormonal_receptors,
        diagnosis=roi.diagnosis,
        comments=roi.comments,
        status=roi.status,
        pathologist=roi.pathologist,
        validation_date=roi.validation_date
    )
    db.add(new_ext)
    db.commit()
    
    return {"message": "Dossier mis à jour et Zone sauvegardée", "id": new_ext.id, "file": filename_str}

@app.get("/patients/{folder_id}/extractions")
def get_extractions(folder_id: str, db: Session = Depends(database.get_db)):
    patient = db.query(models.Patient).filter(models.Patient.folder_id == folder_id).first()
    if not patient: return []
    results = []
    for e in patient.extractions:
        results.append({
            "id": e.id,
            "filename": e.label,
            # Correction URL : pointer vers le fichier généré
            "url": f"http://localhost:8000/dzi_data/{e.dzi_url}", 
            "roi": { "x": e.x, "y": e.y, "w": e.w, "h": e.h },
            "diagnosis": e.diagnosis, # On peut renvoyer le diagnostic pour l'afficher
            "status": e.status
        })
    return results

@app.get("/extractions/{extraction_id}/details")
def get_extraction_details(extraction_id: int, db: Session = Depends(database.get_db)):
    # On cherche l'extraction par son ID
    ext = db.query(models.Extraction).filter(models.Extraction.id == extraction_id).first()
    
    if not ext:
        raise HTTPException(status_code=404, detail="Extraction introuvable")
    
    # On renvoie TOUT (y compris les champs médicaux)
    return {
        "id": ext.id,
        "filename": ext.label,
        "prelevement_type": ext.prelevement_type,
        "prelevement_date": ext.prelevement_date,
        "block_number": ext.block_number,
        "fixation": ext.fixation,
        "slide_count": ext.slide_count,
        "staining": ext.staining,
        "macro_obs": ext.macro_obs,
        "micro_obs": ext.micro_obs,
        "histo_type": ext.histo_type,
        "sbr_grade": ext.sbr_grade,
        "margins": ext.margins,
        "hormonal_receptors": ext.hormonal_receptors,
        "diagnosis": ext.diagnosis,
        "comments": ext.comments,
        "status": ext.status,
        "pathologist": ext.pathologist,
        "validation_date": ext.validation_date
    }

@app.post("/annotations/save")
def save_drawing(draw: DrawingRequest, db: Session = Depends(database.get_db)):
    db.add(models.Drawing(
        extraction_id=draw.extraction_id,
        x=draw.x, y=draw.y, w=draw.w, h=draw.h, label=draw.label
    ))
    db.commit()
    return {"message": "Annotation enregistrée"}