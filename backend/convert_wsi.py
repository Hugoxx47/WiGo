import os
import requests
import pyvips
import pydicom
from pydicom.dataset import FileDataset, FileMetaDataset
from pydicom.uid import generate_uid, ImplicitVRLittleEndian
import datetime

# --- CONFIGURATION ---
INPUT_DIR = "."
# Use the internal docker network name
ORTHANC_URL = "http://orthanc:8042/instances" 
MAX_SIZE = 8192 

def create_dicom_from_image(image_path, patient_name, patient_id):
    sop_instance_uid = generate_uid()
    series_instance_uid = generate_uid()
    study_instance_uid = generate_uid()
    sop_class_uid = "1.2.840.10008.5.1.4.1.1.7" 

    file_meta = FileMetaDataset()
    file_meta.MediaStorageSOPClassUID = sop_class_uid
    file_meta.MediaStorageSOPInstanceUID = sop_instance_uid
    file_meta.ImplementationClassUID = generate_uid()
    file_meta.TransferSyntaxUID = ImplicitVRLittleEndian

    ds = FileDataset(None, {}, file_meta=file_meta, preamble=b"\0" * 128)

    ds.PatientName = patient_name
    ds.PatientID = patient_id
    ds.StudyInstanceUID = study_instance_uid
    ds.SeriesInstanceUID = series_instance_uid
    ds.SOPInstanceUID = sop_instance_uid
    ds.SOPClassUID = sop_class_uid
    
    ds.Modality = "OT"
    ds.SamplesPerPixel = 3
    # Explicitly state RGB interpretation
    ds.PhotometricInterpretation = "RGB" 
    ds.PixelRepresentation = 0
    ds.BitsAllocated = 8
    ds.BitsStored = 8
    ds.HighBit = 7
    
    dt = datetime.datetime.now()
    ds.ContentDate = dt.strftime('%Y%m%d')
    ds.ContentTime = dt.strftime('%H%M%S.%f')[:6]
    
    print(f"🖼️ Reading image and correcting colors...")
    vips_img = pyvips.Image.new_from_file(image_path, access="sequential")
    
    # --- COLOR CORRECTION ---
    # Force conversion to sRGB. This fixes the Blue/Cyan issue.
    # If the image is already sRGB, this does nothing harmful.
    if vips_img.interpretation != 'srgb':
        vips_img = vips_img.colourspace('srgb')
    
    if vips_img.width > MAX_SIZE:
        vips_img = vips_img.thumbnail_image(MAX_SIZE)
    
    mem_buf = vips_img.write_to_memory()
    
    ds.Rows = vips_img.height
    ds.Columns = vips_img.width
    ds.PixelData = mem_buf
    ds.is_little_endian = True
    ds.is_implicit_VR = True

    return ds

def convert_and_upload():
    print("--- Start DICOM Conversion ---")
    files = [f for f in os.listdir(INPUT_DIR) if f.endswith(".svs") or f.endswith(".tif") or f.endswith(".jpg") or f.endswith(".png")]
    
    # Filter for SVS first as per your project, but fallback to others if needed for testing
    svs_files = [f for f in files if f.endswith(".svs")]
    target_file = svs_files[0] if svs_files else (files[0] if files else None)

    if not target_file:
        print("❌ No image file found (svs, jpg, png, tif).")
        return

    print(f"🚀 Processing {target_file}...")

    try:
        dicom_obj = create_dicom_from_image(target_file, "Jean Dupont", "CMU-1")
        output_dcm = "temp_output.dcm"
        dicom_obj.save_as(output_dcm, write_like_original=False) 
        
        print(f"☁️ Uploading to Orthanc...")
        with open(output_dcm, 'rb') as f:
            content = f.read()
            # Auth is included just in case, but open mode will ignore it
            res = requests.post(
                ORTHANC_URL, 
                data=content, 
                headers={'Content-Type': 'application/dicom'},
                auth=('orthanc', 'orthanc') 
            )
            
        if res.status_code == 200:
            try:
                instance_id = res.json()['ID']
                print(f"🎉 SUCCESS! Image stored.")
                print(f"🆔 Orthanc ID: {instance_id}")
            except:
                print("⚠️ Success (200) but unexpected JSON response.")
        else:
            print(f"❌ Orthanc Error ({res.status_code}): {res.text}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    convert_and_upload()