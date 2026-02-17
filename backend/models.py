from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Float, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    age = Column(Integer)
    folder_id = Column(String)
    
    birth_date = Column(String)
    family_history = Column(String)
    medical_history = Column(Text)

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

    # Formulaire Médical
    prelevement_type = Column(String, nullable=True)
    prelevement_date = Column(String, nullable=True)
    block_number = Column(String, nullable=True)
    fixation = Column(String, nullable=True)
    slide_count = Column(Integer, nullable=True)
    staining = Column(JSON, nullable=True) 

    macro_obs = Column(Text, nullable=True)
    micro_obs = Column(Text, nullable=True)
    histo_type = Column(String, nullable=True)
    sbr_grade = Column(String, nullable=True)
    margins = Column(String, nullable=True)
    hormonal_receptors = Column(String, nullable=True)
    diagnosis = Column(String, nullable=True)
    comments = Column(Text, nullable=True)

    status = Column(String, nullable=True)
    pathologist = Column(String, nullable=True)
    validation_date = Column(String, nullable=True)

    patient = relationship("Patient", back_populates="extractions")
    # Relation vers les dessins
    drawings = relationship("Drawing", back_populates="extraction", cascade="all, delete")

class Drawing(Base):
    __tablename__ = "drawings"
    id = Column(Integer, primary_key=True, index=True)
    extraction_id = Column(Integer, ForeignKey("extractions.id"))
    
    type = Column(String)  # 'rect', 'circle', 'polygon', 'text'
    x = Column(Float)
    y = Column(Float)
    w = Column(Float, nullable=True)
    h = Column(Float, nullable=True)
    radius = Column(Float, nullable=True)
    text = Column(String, nullable=True)
    points = Column(JSON, nullable=True) 

    author = Column(String, nullable=True)
    
    extraction = relationship("Extraction", back_populates="drawings")