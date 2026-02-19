from datetime import datetime
import enum

from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    doctor = "doctor"
    nurse = "nurse"
    patient = "patient"


class CaseStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    role = Column(SQLEnum(UserRole, name="user_role"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    medical_cases = relationship("MedicalCase", back_populates="patient")


class FormTemplate(Base):
    __tablename__ = "form_templates"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    schema_json = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class WorkflowDefinition(Base):
    __tablename__ = "workflow_definitions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    steps_json = Column(JSONB, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    medical_cases = relationship("MedicalCase", back_populates="workflow")


class MedicalCase(Base):
    __tablename__ = "medical_cases"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    workflow_id = Column(Integer, ForeignKey("workflow_definitions.id"), nullable=False, index=True)
    current_step = Column(Integer, nullable=False, default=1)
    status = Column(SQLEnum(CaseStatus, name="case_status"), nullable=False, default=CaseStatus.open)
    data_jsonb = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    patient = relationship("User", back_populates="medical_cases")
    workflow = relationship("WorkflowDefinition", back_populates="medical_cases")