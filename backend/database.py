from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# URL de connexion : postgresql://user:password@host:port/db_name
# Note: On utilise 'localhost' car tu lances FastAPI depuis ton terminal Windows
SQLALCHEMY_DATABASE_URL = "postgresql://admin:password_secure@localhost:5432/biopsie_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dépendance pour récupérer la DB dans chaque requête
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()