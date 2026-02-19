from datetime import datetime
from typing import Any, Dict, List, Optional
import os

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

import database
import models


try:
    models.Base.metadata.create_all(bind=database.engine)
    print("✅ Base de données connectée.")
except Exception as error:
    print(f"❌ ERREUR FATALE BDD : {error}")


app = FastAPI(title="Biopsie Workflow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DZI_FOLDER = "/app/dzi_data"
os.makedirs(DZI_FOLDER, exist_ok=True)
app.mount("/dzi_data", StaticFiles(directory=DZI_FOLDER), name="dzi_data")


class UserCreate(BaseModel):
    name: str
    role: models.UserRole


class UserOut(BaseModel):
    id: int
    name: str
    role: models.UserRole

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    name: str


class FormTemplateCreate(BaseModel):
    title: str
    schema_json: Dict[str, Any]


class FormTemplateOut(BaseModel):
    id: int
    title: str
    schema_json: Dict[str, Any]

    class Config:
        from_attributes = True


class WorkflowCreate(BaseModel):
    title: str
    steps_json: List[Dict[str, Any]]


class WorkflowOut(BaseModel):
    id: int
    title: str
    steps_json: List[Dict[str, Any]]

    class Config:
        from_attributes = True


class MedicalCaseCreate(BaseModel):
    patient_id: int
    workflow_id: int
    current_step: int = 1
    status: models.CaseStatus = models.CaseStatus.open
    data_jsonb: Dict[str, Any] = Field(default_factory=dict)


class SubmitStepPayload(BaseModel):
    step_data: Dict[str, Any]


class MedicalCaseOut(BaseModel):
    id: int
    current_step: int
    status: models.CaseStatus
    data_jsonb: Dict[str, Any]
    patient: UserOut
    workflow: WorkflowOut
    current_step_meta: Optional[Dict[str, Any]] = None


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
    owner: Optional[str] = "Inconnu"

    prelevement_type: Optional[str] = ""
    prelevement_date: Optional[str] = ""
    block_number: Optional[str] = ""
    fixation: Optional[str] = ""
    slide_count: Optional[int] = None
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

    drawings: List[DrawingSchema] = []


def get_current_step_meta(workflow: models.WorkflowDefinition, current_step: int) -> Optional[Dict[str, Any]]:
    steps = workflow.steps_json or []
    for step in steps:
        if int(step.get("step", 0)) == current_step:
            return step

    index = current_step - 1
    if 0 <= index < len(steps):
        return steps[index]

    return None


def serialize_case(item: models.MedicalCase) -> Dict[str, Any]:
    step_meta = get_current_step_meta(item.workflow, item.current_step)
    return {
        "id": item.id,
        "current_step": item.current_step,
        "status": item.status,
        "data_jsonb": item.data_jsonb or {},
        "patient": {
            "id": item.patient.id,
            "name": item.patient.name,
            "role": item.patient.role,
        },
        "workflow": {
            "id": item.workflow.id,
            "title": item.workflow.title,
            "steps_json": item.workflow.steps_json,
        },
        "current_step_meta": step_meta,
    }


def serialize_extraction_detail(record: models.ExtractionRecord) -> Dict[str, Any]:
    form_json = record.form_json or {}
    return {
        "id": record.id,
        "filename": record.annotation_label or record.filename,
        "prelevement_type": form_json.get("prelevement_type", ""),
        "prelevement_date": form_json.get("prelevement_date", ""),
        "block_number": form_json.get("block_number", ""),
        "fixation": form_json.get("fixation", ""),
        "slide_count": form_json.get("slide_count"),
        "staining": form_json.get("staining", []),
        "macro_obs": form_json.get("macro_obs", ""),
        "micro_obs": form_json.get("micro_obs", ""),
        "histo_type": form_json.get("histo_type", ""),
        "sbr_grade": form_json.get("sbr_grade", ""),
        "margins": form_json.get("margins", ""),
        "hormonal_receptors": form_json.get("hormonal_receptors", ""),
        "diagnosis": form_json.get("diagnosis", ""),
        "comments": form_json.get("comments", ""),
        "status": form_json.get("status", ""),
        "pathologist": form_json.get("pathologist", ""),
        "validation_date": form_json.get("validation_date", ""),
        "drawings": record.drawings_json or [],
    }


@app.post("/seed")
def seed_database(db: Session = Depends(database.get_db)):
    models.Base.metadata.drop_all(bind=database.engine)
    models.Base.metadata.create_all(bind=database.engine)

    users = [
        models.User(name="Admin Olivia", role=models.UserRole.admin),
        models.User(name="Dr Martin", role=models.UserRole.doctor),
        models.User(name="Infirmier Alice", role=models.UserRole.nurse),
        models.User(name="Patient Jean", role=models.UserRole.patient),
    ]

    db.add_all(users)
    db.commit()

    for item in users:
        db.refresh(item)

    olga_schema = {
        "title": "Formulaire OLGA",
        "fields": [
            {"name": "patient_reference", "label": "Référence patient", "type": "text", "required": True},
            {"name": "prelevement_date", "label": "Date de prélèvement", "type": "date", "required": True},
            {
                "name": "score_antre",
                "label": "Score Antre",
                "type": "select",
                "options": [0, 1, 2, 3],
                "required": True,
            },
            {
                "name": "score_corps",
                "label": "Score Corps",
                "type": "select",
                "options": [0, 1, 2, 3],
                "required": True,
            },
            {"name": "stade_olga", "label": "Stade OLGA", "type": "computed", "readOnly": True},
            {"name": "commentaire", "label": "Commentaire", "type": "textarea", "required": False},
        ],
        "computedFields": [
            {
                "target": "stade_olga",
                "dependencies": ["score_antre", "score_corps"],
                "type": "matrix",
                "matrix": {
                    "0,0": "0",
                    "0,1": "I",
                    "0,2": "II",
                    "0,3": "II",
                    "1,0": "I",
                    "1,1": "I",
                    "1,2": "II",
                    "1,3": "III",
                    "2,0": "II",
                    "2,1": "II",
                    "2,2": "III",
                    "2,3": "IV",
                    "3,0": "II",
                    "3,1": "III",
                    "3,2": "IV",
                    "3,3": "IV",
                },
            }
        ],
    }

    form_template = models.FormTemplate(title="Stadification OLGA", schema_json=olga_schema)
    db.add(form_template)
    db.commit()
    db.refresh(form_template)

    workflow_steps = [
        {"step": 1, "label": "Saisie infirmier", "form_id": form_template.id, "role_required": "nurse"},
        {"step": 2, "label": "Validation médecin", "form_id": form_template.id, "role_required": "doctor"},
        {"step": 3, "label": "Retour patient", "form_id": form_template.id, "role_required": "patient"},
    ]

    workflow = models.WorkflowDefinition(title="Workflow biopsie standard", steps_json=workflow_steps)
    db.add(workflow)
    db.commit()
    db.refresh(workflow)

    patient = next(user for user in users if user.role == models.UserRole.patient)

    cases = [
        models.MedicalCase(
            patient_id=patient.id,
            workflow_id=workflow.id,
            current_step=1,
            status=models.CaseStatus.open,
            data_jsonb={"meta": {"created_by": "seed"}},
        ),
        models.MedicalCase(
            patient_id=patient.id,
            workflow_id=workflow.id,
            current_step=2,
            status=models.CaseStatus.in_progress,
            data_jsonb={"step_1": {"score_antre": 1, "score_corps": 1, "stade_olga": "I"}},
        ),
    ]

    db.add_all(cases)
    db.commit()

    return {
        "message": "Seed terminé",
        "users": len(users),
        "form_template_id": form_template.id,
        "workflow_id": workflow.id,
        "cases": len(cases),
        "olga_schema_example": olga_schema,
    }


@app.post("/api/login", response_model=UserOut)
def login(payload: LoginRequest, db: Session = Depends(database.get_db)):
    normalized_name = payload.name.strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Identifiant requis")

    user = (
        db.query(models.User)
        .filter(func.lower(models.User.name) == normalized_name.lower())
        .first()
    )

    if not user:
        role_aliases = {
            "admin": models.UserRole.admin,
            "doctor": models.UserRole.doctor,
            "docteur": models.UserRole.doctor,
            "nurse": models.UserRole.nurse,
            "infirmier": models.UserRole.nurse,
            "infirmiere": models.UserRole.nurse,
            "patient": models.UserRole.patient,
        }
        mapped_role = role_aliases.get(normalized_name.lower())
        if mapped_role:
            user = db.query(models.User).filter(models.User.role == mapped_role).first()

    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return user


@app.get("/api/users", response_model=List[UserOut])
def get_users(db: Session = Depends(database.get_db)):
    return db.query(models.User).order_by(models.User.id.asc()).all()


@app.post("/api/form-templates", response_model=FormTemplateOut)
def create_form_template(payload: FormTemplateCreate, db: Session = Depends(database.get_db)):
    form = models.FormTemplate(title=payload.title, schema_json=payload.schema_json)
    db.add(form)
    db.commit()
    db.refresh(form)
    return form


@app.get("/api/form-templates", response_model=List[FormTemplateOut])
def get_form_templates(db: Session = Depends(database.get_db)):
    return db.query(models.FormTemplate).order_by(models.FormTemplate.id.asc()).all()


@app.get("/api/form-templates/{form_id}", response_model=FormTemplateOut)
def get_form_template(form_id: int, db: Session = Depends(database.get_db)):
    form = db.query(models.FormTemplate).filter(models.FormTemplate.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail="Formulaire introuvable")
    return form


@app.post("/api/workflows", response_model=WorkflowOut)
def create_workflow(payload: WorkflowCreate, db: Session = Depends(database.get_db)):
    workflow = models.WorkflowDefinition(title=payload.title, steps_json=payload.steps_json)
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


@app.get("/api/workflows", response_model=List[WorkflowOut])
def get_workflows(db: Session = Depends(database.get_db)):
    return db.query(models.WorkflowDefinition).order_by(models.WorkflowDefinition.id.asc()).all()


@app.get("/api/workflows/{workflow_id}", response_model=WorkflowOut)
def get_workflow(workflow_id: int, db: Session = Depends(database.get_db)):
    workflow = db.query(models.WorkflowDefinition).filter(models.WorkflowDefinition.id == workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow introuvable")
    return workflow


@app.post("/api/cases")
def create_case(payload: MedicalCaseCreate, db: Session = Depends(database.get_db)):
    patient = db.query(models.User).filter(models.User.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")

    workflow = db.query(models.WorkflowDefinition).filter(models.WorkflowDefinition.id == payload.workflow_id).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow introuvable")

    medical_case = models.MedicalCase(
        patient_id=payload.patient_id,
        workflow_id=payload.workflow_id,
        current_step=payload.current_step,
        status=payload.status,
        data_jsonb=payload.data_jsonb,
    )

    db.add(medical_case)
    db.commit()
    db.refresh(medical_case)

    full_case = (
        db.query(models.MedicalCase)
        .options(selectinload(models.MedicalCase.patient), selectinload(models.MedicalCase.workflow))
        .filter(models.MedicalCase.id == medical_case.id)
        .first()
    )

    if not full_case:
        raise HTTPException(status_code=404, detail="Case introuvable")

    return serialize_case(full_case)


@app.get("/api/cases")
def get_cases(
    role: Optional[str] = Query(default=None),
    db: Session = Depends(database.get_db),
):
    items = (
        db.query(models.MedicalCase)
        .options(selectinload(models.MedicalCase.patient), selectinload(models.MedicalCase.workflow))
        .order_by(models.MedicalCase.id.asc())
        .all()
    )

    serialized: List[Dict[str, Any]] = []
    for item in items:
        payload = serialize_case(item)
        if role:
            current_meta = payload.get("current_step_meta") or {}
            if str(current_meta.get("role_required", "")).lower() != role.lower():
                continue
        serialized.append(payload)

    return serialized


@app.get("/api/cases/{case_id}")
def get_case(case_id: int, db: Session = Depends(database.get_db)):
    item = (
        db.query(models.MedicalCase)
        .options(selectinload(models.MedicalCase.patient), selectinload(models.MedicalCase.workflow))
        .filter(models.MedicalCase.id == case_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Case introuvable")

    return serialize_case(item)


@app.post("/api/cases/{case_id}/submit-step")
def submit_step(case_id: int, payload: SubmitStepPayload, db: Session = Depends(database.get_db)):
    item = (
        db.query(models.MedicalCase)
        .options(selectinload(models.MedicalCase.workflow), selectinload(models.MedicalCase.patient))
        .filter(models.MedicalCase.id == case_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Case introuvable")

    steps = item.workflow.steps_json or []
    if not steps:
        raise HTTPException(status_code=400, detail="Workflow sans étapes")

    if item.status in {models.CaseStatus.completed, models.CaseStatus.cancelled}:
        raise HTTPException(status_code=400, detail="Case déjà fermé")

    current_step_key = f"step_{item.current_step}"
    merged_data = dict(item.data_jsonb or {})
    previous_step_data = merged_data.get(current_step_key, {})
    merged_data[current_step_key] = {
        **(previous_step_data if isinstance(previous_step_data, dict) else {}),
        **payload.step_data,
        "submitted_at": datetime.utcnow().isoformat(),
    }

    has_next_step = item.current_step < len(steps)
    item.data_jsonb = merged_data

    if has_next_step:
        item.current_step += 1
        item.status = models.CaseStatus.in_progress
    else:
        item.status = models.CaseStatus.completed

    db.commit()
    db.refresh(item)

    refreshed = (
        db.query(models.MedicalCase)
        .options(selectinload(models.MedicalCase.workflow), selectinload(models.MedicalCase.patient))
        .filter(models.MedicalCase.id == case_id)
        .first()
    )

    if not refreshed:
        raise HTTPException(status_code=404, detail="Case introuvable après mise à jour")

    return serialize_case(refreshed)


@app.post("/extract-roi")
def extract_roi(payload: AnalysisPayload, db: Session = Depends(database.get_db)):
    form_json = {
        "prelevement_type": payload.prelevement_type,
        "prelevement_date": payload.prelevement_date,
        "block_number": payload.block_number,
        "fixation": payload.fixation,
        "slide_count": payload.slide_count,
        "staining": payload.staining,
        "macro_obs": payload.macro_obs,
        "micro_obs": payload.micro_obs,
        "histo_type": payload.histo_type,
        "sbr_grade": payload.sbr_grade,
        "margins": payload.margins,
        "hormonal_receptors": payload.hormonal_receptors,
        "diagnosis": payload.diagnosis,
        "comments": payload.comments,
        "status": payload.status,
        "pathologist": payload.pathologist,
        "validation_date": payload.validation_date,
    }

    drawings_payload = [drawing.model_dump() for drawing in payload.drawings]

    record = models.ExtractionRecord(
        patient_folder=payload.patient_folder,
        patient_name=payload.patient_name,
        filename=payload.filename,
        annotation_label=payload.annotation_label,
        owner=payload.owner,
        x=payload.x,
        y=payload.y,
        w=payload.width,
        h=payload.height,
        form_json=form_json,
        drawings_json=drawings_payload,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {"message": "Extraction enregistrée", "id": record.id, "extraction_id": record.id}


@app.post("/annotations/save")
def update_annotation(payload: AnalysisPayload, db: Session = Depends(database.get_db)):
    if not payload.extraction_id:
        raise HTTPException(status_code=400, detail="ID extraction manquant")

    record = db.query(models.ExtractionRecord).filter(models.ExtractionRecord.id == payload.extraction_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Extraction introuvable")

    record.annotation_label = payload.annotation_label
    record.owner = payload.owner
    record.x = payload.x
    record.y = payload.y
    record.w = payload.width
    record.h = payload.height
    record.form_json = {
        "prelevement_type": payload.prelevement_type,
        "prelevement_date": payload.prelevement_date,
        "block_number": payload.block_number,
        "fixation": payload.fixation,
        "slide_count": payload.slide_count,
        "staining": payload.staining,
        "macro_obs": payload.macro_obs,
        "micro_obs": payload.micro_obs,
        "histo_type": payload.histo_type,
        "sbr_grade": payload.sbr_grade,
        "margins": payload.margins,
        "hormonal_receptors": payload.hormonal_receptors,
        "diagnosis": payload.diagnosis,
        "comments": payload.comments,
        "status": payload.status,
        "pathologist": payload.pathologist,
        "validation_date": payload.validation_date,
    }
    record.drawings_json = [drawing.model_dump() for drawing in payload.drawings]

    db.commit()
    db.refresh(record)
    return {"message": "Dossier et annotations mis à jour", "id": record.id}


@app.get("/extractions/{extraction_id}/details")
def get_extraction_details(extraction_id: int, db: Session = Depends(database.get_db)):
    record = db.query(models.ExtractionRecord).filter(models.ExtractionRecord.id == extraction_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Extraction introuvable")
    return serialize_extraction_detail(record)


@app.get("/patients/{folder_id}/extractions")
def get_patient_extractions(folder_id: str, db: Session = Depends(database.get_db)):
    records = (
        db.query(models.ExtractionRecord)
        .filter(models.ExtractionRecord.patient_folder == folder_id)
        .order_by(models.ExtractionRecord.created_at.desc())
        .all()
    )
    return [
        {
            "id": record.id,
            "filename": record.annotation_label or record.filename,
            "url": f"http://localhost:8000/dzi_data/{record.filename}",
            "roi": {"x": record.x, "y": record.y, "w": record.w, "h": record.h},
            "owner": record.owner,
            "status": (record.form_json or {}).get("status", "en_analyse"),
        }
        for record in records
    ]


@app.delete("/extractions/{extraction_id}")
def delete_extraction(extraction_id: int, username: str, db: Session = Depends(database.get_db)):
    record = db.query(models.ExtractionRecord).filter(models.ExtractionRecord.id == extraction_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Introuvable")

    if record.owner and record.owner != username:
        raise HTTPException(status_code=403, detail="Vous ne pouvez supprimer que vos propres extractions")

    db.delete(record)
    db.commit()
    return {"message": "Extraction supprimée"}
