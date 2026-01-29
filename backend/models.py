from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    age = Column(Integer) # On garde l'âge pour l'affichage rapide
    folder_id = Column(String)
    
    # --- NOUVEAUX CHAMPS (Selon ton image) ---
    birth_date = Column(String)  # Ex: "12/05/1958"
    family_history = Column(String) # Ex: "Oui" (Cancer du sein)
    medical_history = Column(Text) # Ex: "Hypertension, Diabète..."

    biopsies = relationship("Biopsy", back_populates="patient", cascade="all, delete")
    extractions = relationship("Extraction", back_populates="patient", cascade="all, delete")

class Biopsy(Base):
    __tablename__ = "biopsies"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    image_url = Column(String)
    status = Column(String)
    patient = relationship("Patient", back_populates="biopsies")

class Extraction(Base):
    __tablename__ = "extractions"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    
    label = Column(String)
    dzi_url = Column(String) 
    
    x = Column(Integer, default=0)
    y = Column(Integer, default=0)
    w = Column(Integer, default=0)
    h = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="extractions")
    drawings = relationship("Drawing", back_populates="extraction", cascade="all, delete")

class Drawing(Base):
    __tablename__ = "drawings"
    id = Column(Integer, primary_key=True, index=True)
    extraction_id = Column(Integer, ForeignKey("extractions.id"))
    x = Column(Integer)
    y = Column(Integer)
    w = Column(Integer)
    h = Column(Integer)
    label = Column(String)
    
    extraction = relationship("Extraction", back_populates="drawings")