import os
import time
import glob
import json
from minio import Minio

# --- CONFIGURATION VIPS (WINDOWS) ---
# On ajoute le chemin des binaires VIPS au système
vips_bin = os.path.join(os.getcwd(), "vips", "bin")
if os.path.exists(vips_bin):
    os.environ['PATH'] = vips_bin + ';' + os.environ['PATH']
    if hasattr(os, 'add_dll_directory'):
        os.add_dll_directory(vips_bin)
    print("✅ LibVIPS chargé.")
else:
    print("❌ ERREUR : Dossier 'vips/bin' introuvable. Télécharge libvips !")
    exit()

import pyvips

# --- CONFIGURATION MINIO ---
MINIO_CLIENT = Minio(
    "localhost:9000",
    access_key="minioadmin",
    secret_key="minioadmin",
    secure=False
)
BUCKET_NAME = "biopsies"
SOURCE_FILE = "CMU-1.svs"
OUTPUT_DIR = "biopsie_cmu_1" # Nom du dossier temporaire

def setup_bucket():
    if not MINIO_CLIENT.bucket_exists(BUCKET_NAME):
        MINIO_CLIENT.make_bucket(BUCKET_NAME)
        policy = {
            "Version": "2012-10-17",
            "Statement": [{"Effect": "Allow", "Principal": {"AWS": ["*"]}, "Action": ["s3:GetObject"], "Resource": [f"arn:aws:s3:::{BUCKET_NAME}/*"]}]
        }
        MINIO_CLIENT.set_bucket_policy(BUCKET_NAME, json.dumps(policy))

def convert_with_vips():
    print(f"🔬 Ouverture de {SOURCE_FILE} avec LibVIPS...")
    
    # 1. Chargement de l'image (streaming, pas de saturation RAM)
    image = pyvips.Image.new_from_file(SOURCE_FILE, access='sequential')
    
    print(f"📏 Dimensions : {image.width} x {image.height}")
    print("🚀 Génération des tuiles (dzsave)...")
    
    # 2. La magie VIPS : Il génère le .dzi et le dossier _files tout seul
    # tile_size=256, overlap=1, format=jpg
    start_time = time.time()
    image.dzsave(OUTPUT_DIR, tile_size=256, overlap=1, suffix='.jpg')
    
    print(f"✅ Découpage terminé en {round(time.time() - start_time, 2)} secondes !")

def upload_to_minio():
    print("📦 Upload vers MinIO...")
    
    # 1. Upload du fichier .dzi
    dzi_file = f"{OUTPUT_DIR}.dzi"
    if os.path.exists(dzi_file):
        MINIO_CLIENT.fput_object(BUCKET_NAME, dzi_file, dzi_file)
        print(f"   📄 {dzi_file} envoyé.")

    # 2. Upload récursif du dossier des tuiles
    # Le dossier généré par VIPS s'appelle "nom_files"
    files_dir = f"{OUTPUT_DIR}_files"
    
    # On liste tous les fichiers JPG dans le dossier
    files = glob.glob(f"{files_dir}/**/*.jpg", recursive=True)
    
    total_files = len(files)
    print(f"   📂 {total_files} tuiles à envoyer...")

    count = 0
    for local_path in files:
        # On transforme le chemin local "biopsie_cmu_1_files\10\2_3.jpg"
        # en chemin MinIO "biopsie_cmu_1_files/10/2_3.jpg"
        minio_path = local_path.replace(os.sep, "/")
        
        MINIO_CLIENT.fput_object(BUCKET_NAME, minio_path, local_path)
        
        count += 1
        if count % 100 == 0:
            print(f"      Progression : {count}/{total_files}", end="\r")

    print(f"\n🎉 Terminé ! Tout est sur MinIO.")

    # (Optionnel) Nettoyage : tu peux supprimer le dossier local ici si tu veux
    # import shutil
    # shutil.rmtree(files_dir)
    # os.remove(dzi_file)

if __name__ == "__main__":
    setup_bucket()
    
    if not os.path.exists(SOURCE_FILE):
        print(f"⚠️ Fichier {SOURCE_FILE} introuvable.")
    else:
        # Étape 1 : Conversion locale ultra-rapide
        convert_with_vips()
        
        # Étape 2 : Envoi vers le cloud
        upload_to_minio()