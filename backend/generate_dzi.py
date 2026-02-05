import os
import shutil
import pyvips
from minio import Minio
from minio.error import S3Error

# --- CONFIGURATION ---
MINIO_HOST = "minio:9000" 
ACCESS_KEY = "minioadmin"
SECRET_KEY = "minioadmin"
BUCKET_NAME = "biopsies"
SOURCE_FILE = "CMU-1.svs"

LOCAL_INPUT_FILE = "temp_input.svs"
OUTPUT_DIR = "dzi_data"
OUTPUT_NAME = "biopsie_cmu_1"

def download_from_minio():
    print(f"📥 Connexion à MinIO ({MINIO_HOST})...")
    try:
        client = Minio(
            MINIO_HOST,
            access_key=ACCESS_KEY,
            secret_key=SECRET_KEY,
            secure=False
        )
        
        try:
            client.stat_object(BUCKET_NAME, SOURCE_FILE)
        except S3Error as err:
            if err.code == "NoSuchKey":
                print(f"❌ Le fichier '{SOURCE_FILE}' n'existe pas dans le bucket '{BUCKET_NAME}'.")
                return False
            raise

        print(f"⬇️ Téléchargement de {SOURCE_FILE}...")
        client.fget_object(BUCKET_NAME, SOURCE_FILE, LOCAL_INPUT_FILE)
        print("✅ Téléchargement terminé !")
        return True

    except Exception as e:
        print(f"❌ Erreur MinIO critique : {e}")
        return False

def clean_directory(directory):
    """Vide le contenu d'un dossier sans supprimer le dossier lui-même (compatible Volume Docker)"""
    if not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)
        return

    print(f"🧹 Nettoyage du contenu de {directory}...")
    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)
        try:
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        except Exception as e:
            print(f"⚠️ Impossible de supprimer {file_path}. Raison: {e}")

def generate_dzi():
    print("--- DÉBUT DU TRAITEMENT ---")
    
    # 1. Nettoyage du contenu (CORRIGÉ)
    clean_directory(OUTPUT_DIR)

    # 2. Téléchargement (Si pas déjà présent)
    if not os.path.exists(LOCAL_INPUT_FILE):
        if not download_from_minio():
            return
    else:
        print("ℹ️ Fichier source déjà présent localement, on l'utilise.")

    # 3. Conversion
    output_path = os.path.join(OUTPUT_DIR, OUTPUT_NAME)
    print(f"🚀 Conversion avec PyVips...")
    
    try:
        image = pyvips.Image.new_from_file(LOCAL_INPUT_FILE, access="sequential")
        image.dzsave(output_path, tile_size=256, overlap=1)
        print("✅ SUCCÈS TOTAL ! Tuiles générées dans 'dzi_data/'.")
        
    except Exception as e:
        print(f"❌ Erreur PyVips : {e}")

if __name__ == "__main__":
    generate_dzi()