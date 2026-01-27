import os
import shutil
import pyvips

# --- CONFIGURATION ---
INPUT_FILE = "CMU-1.svs"
OUTPUT_DIR = "dzi_data"
OUTPUT_NAME = "biopsie_cmu_1" 

def generate_dzi():
    print("🧹 Nettoyage de l'environnement...")
    
    # Au lieu de supprimer le dossier racine (ce qui plante), on vide son contenu
    if os.path.exists(OUTPUT_DIR):
        for filename in os.listdir(OUTPUT_DIR):
            file_path = os.path.join(OUTPUT_DIR, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"⚠️ Impossible de supprimer {file_path}. Raison: {e}")
    else:
        # S'il n'existe pas, on le crée
        os.makedirs(OUTPUT_DIR, exist_ok=True)

    # On vérifie l'entrée
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Erreur : Fichier {INPUT_FILE} introuvable dans {os.getcwd()}")
        return
    
    output_path = os.path.join(OUTPUT_DIR, OUTPUT_NAME)
    
    print(f"🚀 Conversion SVS -> DZI ({OUTPUT_NAME})...")
    print(f"   Source : {INPUT_FILE}")
    print(f"   Cible  : {output_path}.dzi")

    try:
        # IMPORTANT : access="sequential" est optimisé pour les gros fichiers SVS
        image = pyvips.Image.new_from_file(INPUT_FILE, access="sequential")
        
        # tile_size=256 est standard pour le web
        image.dzsave(output_path, tile_size=256, overlap=1)
        print("✅ SUCCÈS ! Tuiles générées dans dzi_data/")
    except Exception as e:
        print(f"❌ Erreur pyvips : {e}")

if __name__ == "__main__":
    generate_dzi()