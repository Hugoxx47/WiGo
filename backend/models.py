from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    age = Column(Integer)
    folder_id = Column(String, unique=True) # Ex: CMU-1

    # Relation : Un patient a plusieurs biopsies
    biopsies = relationship("Biopsy", back_populates="patient")

class Biopsy(Base):
    __tablename__ = "biopsies"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    
    # C'est la colonne qui te manquait :
    image_url = Column(String) 
    
    status = Column(String, default="En attente") 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="biopsies")