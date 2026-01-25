import os
import requests
import pyvips
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import generate_uid, ImplicitVRLittleEndian
import datetime

# --- CONFIGURATION ---
INPUT_FILE = "CMU-1.svs"
ORTHANC_URL = "http://orthanc:8042/instances"

# AMÉLIORATION QUALITÉ : On passe de 4096 à 8192 (8K)
# C'est beaucoup plus net, tout en restant compatible web.
MAX_SIZE = 8192 

def create_dicom(image_path, patient_name, patient_id):
    if not os.path.exists(image_path):
        raise Exception(f"Fichier {image_path} introuvable.")

    print(f"🖼️  Traitement de l'image (Cible: {MAX_SIZE}px)...")

    # 1. Chargement intelligent
    try:
        vips_img = pyvips.Image.new_from_file(image_path, level=1)
    except:
        vips_img = pyvips.Image.new_from_file(image_path)

    # 2. Nettoyage (Alpha + sRGB + Resize)
    if vips_img.hasalpha():
        vips_img = vips_img.flatten(background=[255, 255, 255])
    
    if vips_img.interpretation != 'srgb':
        vips_img = vips_img.colourspace('srgb')

    if vips_img.width > MAX_SIZE:
        vips_img = vips_img.thumbnail_image(MAX_SIZE)

    # 3. Encapsulation DICOM
    mem_buf = vips_img.write_to_memory()
    
    sop_uid = generate_uid()
    series_uid = generate_uid()
    study_uid = generate_uid()

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.7"
    file_meta.MediaStorageSOPInstanceUID = sop_uid
    file_meta.ImplementationClassUID = generate_uid()
    file_meta.TransferSyntaxUID = ImplicitVRLittleEndian

    ds = FileDataset(None, {}, file_meta=file_meta, preamble=b"\0" * 128)
    ds.PatientName = patient_name
    ds.PatientID = patient_id
    ds.StudyInstanceUID = study_uid
    ds.SeriesInstanceUID = series_uid
    ds.SOPInstanceUID = sop_uid
    ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.7" 
    
    ds.Modality = "OT"
    ds.SamplesPerPixel = 3
    ds.PlanarConfiguration = 0 # Vital pour les couleurs
    ds.PhotometricInterpretation = "RGB"
    ds.PixelRepresentation = 0
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    ds.Rows = vips_img.height
    ds.Columns = vips_img.width
    ds.PixelData = mem_buf
    ds.is_little_endian = True
    ds.is_implicit_VR = True
    
    dt = datetime.datetime.now()
    ds.ContentDate = dt.strftime('%Y%m%d')
    ds.ContentTime = dt.strftime('%H%M%S.%f')[:6]

    return ds

def main():
    try:
        print("🚀 Démarrage conversion SVS -> DICOM...")
        dicom_obj = create_dicom(INPUT_FILE, "Jean Dupont", "CMU-1")
        
        output_dcm = "output.dcm"
        dicom_obj.save_as(output_dcm, write_like_original=False)
        print(f"✅ Conversion terminée (Fichier: {output_dcm})")

        with open(output_dcm, 'rb') as f:
            res = requests.post(
                ORTHANC_URL, 
                data=f.read(), 
                headers={'Content-Type': 'application/dicom'},
                auth=('orthanc', 'orthanc') 
            )

        if res.status_code == 200:
            print("🎉 SUCCÈS ! Image HD envoyée à Orthanc.")
        else:
            print(f"❌ Erreur Orthanc : {res.text}")

    except Exception as e:
        print(f"❌ Erreur : {e}")

if __name__ == "__main__":
    main()