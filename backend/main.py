import time
import os
import pyvips
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles 
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
import models
import database

# --- INIT BDD ---
try:
    models.Base.metadata.create_all(bind=database.engine)
    print("✅ Base de données connectée.")
except Exception as e:
    print(f"❌ ERREUR FATALE BDD : {e}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

DZI_FOLDER = "/app/dzi_data"
os.makedirs(DZI_FOLDER, exist_ok=True)
app.mount("/dzi_data", StaticFiles(directory=DZI_FOLDER), name="dzi_data")

# --- SCHEMAS ---
class BiopsySchema(BaseModel):
    id: int
    image_url: Optional[str] = None
    status: str
    class Config:
        from_attributes = True

class PatientSchema(BaseModel):
    id: int
    name: str
    age: int
    folder_id: str
    birth_date: Optional[str] = None
    family_history: Optional[str] = None
    medical_history: Optional[str] = None
    biopsies: List[BiopsySchema] = [] 
    class Config:
        from_attributes = True 

# Schéma pour un dessin
class DrawingSchema(BaseModel):
    type: str
    x: float
    y: float
    w: Optional[float] = 0
    h: Optional[float] = 0
    radius: Optional[float] = 0
    text: Optional[str] = ""
    points: Optional[List[Dict[str, float]]] = []
    author: Optional[str] = "Inconnu"

class AnalysisPayload(BaseModel):
    filename: str
    x: int
    y: int
    width: int
    height: int
    patient_folder: str
    patient_name: str     
    annotation_label: str 
    extraction_id: Optional[int] = None

    # Champs Formulaire
    birth_date: Optional[str] = ""
    family_history: Optional[str] = ""
    medical_history: Optional[str] = ""
    prelevement_type: Optional[str] = ""
    prelevement_date: Optional[str] = ""
    block_number: Optional[str] = ""
    fixation: Optional[str] = ""
    slide_count: Optional[Any] = None 
    staining: Optional[List[str]] = []
    macro_obs: Optional[str] = ""
    micro_obs: Optional[str] = ""
    histo_type: Optional[str] = ""
    sbr_grade: Optional[str] = ""
    margins: Optional[str] = ""
    hormonal_receptors: Optional[str] = ""
    diagnosis: Optional[str] = ""
    comments: Optional[str] = ""
    status: Optional[str] = ""
    pathologist: Optional[str] = ""
    validation_date: Optional[str] = ""

    # LISTE DES DESSINS
    drawings: List[DrawingSchema] = []

# --- ROUTES ---
@app.post("/seed")
def seed_database(db: Session = Depends(database.get_db)):
    try:
        models.Base.metadata.drop_all(bind=database.engine)
        models.Base.metadata.create_all(bind=database.engine)
        
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
        return {"message": f"Succès ! BDD Réinitialisée avec {count} patients."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patients", response_model=List[PatientSchema])
def get_patients(db: Session = Depends(database.get_db)):
    return db.query(models.Patient).all()

@app.post("/extract-roi")
def extract_roi(data: AnalysisPayload, db: Session = Depends(database.get_db)):
    # 1. Gestion du Patient
    patient = db.query(models.Patient).filter(models.Patient.folder_id == data.patient_folder).first()
    if not patient:
        patient = models.Patient(name=data.patient_name, age=0, folder_id=data.patient_folder)
        db.add(patient)
        db.commit()
        db.refresh(patient)

    if data.birth_date: patient.birth_date = data.birth_date
    if data.family_history: patient.family_history = data.family_history
    if data.medical_history: patient.medical_history = data.medical_history
    db.commit()

    # 2. Sauvegarde de l'image (Fichier Physique)
    safe_folder = "".join(c for c in data.patient_folder if c.isalnum() or c in (' ', '-', '_')).strip()
    patient_dir = os.path.join(DZI_FOLDER, safe_folder, "extractions")
    os.makedirs(patient_dir, exist_ok=True)
    filename_str = f"extraction_{int(time.time())}.svs"
    output_path = os.path.join(patient_dir, filename_str)
    source_path = "/app/CMU-1.svs"

    if os.path.exists(source_path):
        try:
            image = pyvips.Image.new_from_file(source_path, access="sequential")
            safe_x = max(0, min(data.x, image.width))
            safe_y = max(0, min(data.y, image.height))
            region = image.extract_area(safe_x, safe_y, data.width, data.height)
            region.tiffsave(output_path, compression="jpeg", Q=90, tile=True, pyramid=True, bigtiff=True)
        except Exception as e:
            print(f"⚠️ Erreur extraction: {e}")

    # 3. Sauvegarde de l'Extraction en BDD
    sc = data.slide_count if isinstance(data.slide_count, int) else None

    new_ext = models.Extraction(
        patient_id=patient.id,
        label=data.annotation_label,
        dzi_url=f"{safe_folder}/extractions/{filename_str}",
        x=data.x, y=data.y, w=data.width, h=data.height,
        prelevement_type=data.prelevement_type,
        prelevement_date=data.prelevement_date,
        block_number=data.block_number,
        fixation=data.fixation,
        slide_count=sc,
        staining=data.staining,
        macro_obs=data.macro_obs,
        micro_obs=data.micro_obs,
        histo_type=data.histo_type,
        sbr_grade=data.sbr_grade,
        margins=data.margins,
        hormonal_receptors=data.hormonal_receptors,
        diagnosis=data.diagnosis,
        comments=data.comments,
        status=data.status,
        pathologist=data.pathologist,
        validation_date=data.validation_date
    )
    db.add(new_ext)
    db.commit()
    db.refresh(new_ext) 

    # --- MODIFICATION ICI ---
    # J'ai supprimé le bloc "if data.drawings:" qui était ici.
    # On ne sauvegarde PAS les dessins lors de la création initiale.
    # Cela permet à l'extraction d'être vierge (sans le rectangle vert).
    
    return {"message": "Dossier créé avec succès", "id": new_ext.id, "extraction_id": new_ext.id}

@app.post("/annotations/save")
def update_analysis(data: AnalysisPayload, db: Session = Depends(database.get_db)):
    if not data.extraction_id:
        raise HTTPException(status_code=400, detail="ID extraction manquant")
        
    ext = db.query(models.Extraction).filter(models.Extraction.id == data.extraction_id).first()
    if not ext:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    sc = data.slide_count if isinstance(data.slide_count, int) else None

    # Mise à jour formulaire
    ext.prelevement_type = data.prelevement_type
    ext.prelevement_date = data.prelevement_date
    ext.block_number = data.block_number
    ext.fixation = data.fixation
    ext.slide_count = sc
    ext.staining = data.staining
    ext.macro_obs = data.macro_obs
    ext.micro_obs = data.micro_obs
    ext.histo_type = data.histo_type
    ext.sbr_grade = data.sbr_grade
    ext.margins = data.margins
    ext.hormonal_receptors = data.hormonal_receptors
    ext.diagnosis = data.diagnosis
    ext.comments = data.comments
    ext.status = data.status
    ext.pathologist = data.pathologist
    ext.validation_date = data.validation_date
    
    # ICI ON GARDE LA SAUVEGARDE (car c'est une mise à jour volontaire)
    db.query(models.Drawing).filter(models.Drawing.extraction_id == ext.id).delete()
    
    for d in data.drawings:
        new_draw = models.Drawing(
            extraction_id=ext.id,
            type=d.type,
            x=d.x, y=d.y, w=d.w, h=d.h,
            radius=d.radius,
            text=d.text,
            points=d.points,
            author=d.author
        )
        db.add(new_draw)

    db.commit()
    return {"message": "Dossier et annotations mis à jour"}

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
            "roi": { "x": e.x, "y": e.y, "w": e.w, "h": e.h },
            "diagnosis": e.diagnosis,
            "status": e.status
        })
    return results

@app.get("/extractions/{extraction_id}/details")
def get_details(extraction_id: int, db: Session = Depends(database.get_db)):
    ext = db.query(models.Extraction).filter(models.Extraction.id == extraction_id).first()
    if not ext: raise HTTPException(status_code=404, detail="Non trouvé")
    
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
        "validation_date": ext.validation_date,
        "drawings": [
            {
                "type": d.type, "x": d.x, "y": d.y, 
                "w": d.w, "h": d.h, "radius": d.radius, 
                "text": d.text, "points": d.points,
                "author": d.author
            } for d in ext.drawings
        ]
    }