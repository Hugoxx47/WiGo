import os
import pyvips
from minio import Minio

# Configuration MinIO (Interne à Docker)
MINIO_CLIENT = Minio(
    "minio:9000", # Nom du service dans docker-compose
    access_key="minioadmin",
    secret_key="minioadmin",
    secure=False
)

INPUT_DIR = "."
OUTPUT_DIR = "biopsie_cmu_1_files"
BUCKET_NAME = "biopsies"

def convert_and_upload():
    # 1. Création du dossier local
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    # 2. Recherche du fichier .svs
    files = [f for f in os.listdir(INPUT_DIR) if f.endswith(".svs")]
    if not files:
        print("❌ Aucun fichier .svs trouvé !")
        return

    svs_file = files[0]
    print(f"🚀 1/2 Conversion de {svs_file}...")

    try:
        # Conversion avec PyVips
        image = pyvips.Image.new_from_file(svs_file, access="sequential")
        preview = image.thumbnail_image(2048) # HD pour Cornerstone
        
        local_path = os.path.join(OUTPUT_DIR, "preview.jpg")
        preview.write_to_file(local_path)
        print(f"✅ Image locale créée : {local_path}")

        # 3. Envoi vers MinIO
        print(f"☁️ 2/2 Envoi vers MinIO (Bucket: {BUCKET_NAME})...")
        
        # On vérifie si le bucket existe, sinon on le crée
        if not MINIO_CLIENT.bucket_exists(BUCKET_NAME):
            MINIO_CLIENT.make_bucket(BUCKET_NAME)
            # Politique publique pour la lecture
            policy = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}' % BUCKET_NAME
            MINIO_CLIENT.set_bucket_policy(BUCKET_NAME, policy)

        # Upload du fichier
        remote_path = f"{OUTPUT_DIR}/preview.jpg"
        MINIO_CLIENT.fput_object(BUCKET_NAME, remote_path, local_path)
        
        print(f"🎉 SUCCÈS ! Image disponible sur : http://localhost:9000/{BUCKET_NAME}/{remote_path}")

    except Exception as e:
        print(f"❌ Erreur : {e}")

if __name__ == "__main__":
    convert_and_upload()