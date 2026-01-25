from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

SQLALCHEMY_DATABASE_URL = "postgresql://user:password@postgres:5432/biopsie_db"

# Création du moteur
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Création de la session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base pour les modèles
Base = declarative_base()

# Fonction utilitaire pour récupérer la DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()