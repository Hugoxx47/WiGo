import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VisibilityIcon from '@mui/icons-material/Visibility'; 
import EditIcon from '@mui/icons-material/Edit'; 
import DescriptionIcon from '@mui/icons-material/Description';
import FolderSharedIcon from '@mui/icons-material/FolderShared'; // Icône dossier

interface Biopsy {
  id: number;
  image_url: string; 
  status: string;
}

interface Patient {
  id: number;
  name: string;
  age: number;
  folder_id: string;
  // Nouveaux champs
  birth_date?: string;
  family_history?: string;
  medical_history?: string;
  biopsies: Biopsy[];
}

interface Extraction {
  id: number;
  filename: string;
  roi: { x: number; y: number; w: number; h: number }; 
}

const PatientCard = ({ patient }: { patient: Patient }) => {
  const navigate = useNavigate();
  const [extractions, setExtractions] = useState<Extraction[]>([]);
  const [showModal, setShowModal] = useState(false);

  const handleAnnotateClick = async () => {
    try {
      const response = await fetch(`http://localhost:8000/patients/${patient.folder_id}/extractions`);
      const data = await response.json();
      if (data.length === 0) {
        alert("Aucune zone extraite. Veuillez d'abord cliquer sur 'Voir tout'.");
      } else {
        setExtractions(data);
        setShowModal(true);
      }
    } catch (error) { alert("Erreur de connexion"); }
  };

  // MISE À JOUR ICI : On passe tout le dossier médical dans le 'state'
  const openViewer = (extractionData?: Extraction) => {
    const mainImageUrl = patient.biopsies[0]?.image_url || "biopsie_cmu_1.dzi";
    navigate(`/viewer?url=${encodeURIComponent(mainImageUrl)}`, {
        state: { 
            patientName: patient.name, 
            folderId: patient.folder_id,
            image_url: mainImageUrl,
            
            // ON PASSE LES INFOS POUR LE FORMULAIRE
            birthDate: patient.birth_date,
            familyHistory: patient.family_history,
            medicalHistory: patient.medical_history,

            roi: extractionData ? extractionData.roi : null,
            extractionId: extractionData ? extractionData.id : null,
        }
    });
  };

  const mainBiopsyUrl = patient.biopsies.length > 0 ? patient.biopsies[0].image_url : "";

  return (
    <div style={styles.card}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            <div style={styles.avatar}>{patient.name.charAt(0)}</div>
            <div>
                <h3 style={{margin: 0}}>{patient.name}</h3>
                <span style={styles.subId}>ID: {patient.folder_id}</span>
            </div>
        </div>
        <span style={styles.ageBadge}>{patient.age} ans</span>
      </div>
      
      {/* INFO MÉDICALES (Style Tableau comme demandé) */}
      <div style={styles.infoTable}>
          <div style={styles.row}>
              <span style={styles.label}>Né(e) le :</span>
              <span style={styles.value}>{patient.birth_date || "Non renseigné"}</span>
          </div>
          <div style={styles.row}>
              <span style={styles.label}>Antécédents Cancer Sein :</span>
              <span style={styles.valueWarning}>
                  {patient.family_history || "Non"}
              </span>
          </div>
          <div style={styles.row}>
              <span style={styles.label}>Médical :</span>
              <span style={styles.valueSmall}>{patient.medical_history || "RAS"}</span>
          </div>
      </div>

      {/* ACTIONS */}
      <div style={styles.actions}>
        <button onClick={() => mainBiopsyUrl && openViewer()} style={styles.btnVoirTout}>
            <VisibilityIcon style={{ marginRight: '8px' }}/> Voir tout
        </button>
        <button onClick={handleAnnotateClick} style={styles.btnAnnoter}>
            <EditIcon style={{ marginRight: '8px' }}/> Annoter
        </button>
      </div>

      {/* MODAL */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h4 style={{marginBottom: '15px', color: '#333'}}>Zones sauvegardées</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {extractions.map((file, index) => (
                <li key={index} style={{ marginBottom: '10px', borderBottom: '1px solid #eee' }}>
                  <button onClick={() => openViewer(file)} style={styles.btnLink}>
                    <DescriptionIcon style={{ fontSize: '18px', marginRight: '5px' }}/> {file.filename}
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowModal(false)} style={styles.btnClose}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
};

// STYLES CSS
const styles: any = {
  card: { 
    border: '1px solid #334155', padding: '20px', borderRadius: '16px', 
    backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', gap: '15px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '5px' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2em' },
  subId: { fontSize: '0.8em', color: '#94a3b8' },
  ageBadge: { backgroundColor: '#1e293b', padding: '4px 10px', borderRadius: '6px', fontSize: '0.9em', color: '#e2e8f0' },
  
  // NOUVEAU STYLE TABLEAU
  infoTable: { backgroundColor: '#1e293b', borderRadius: '8px', padding: '10px', fontSize: '0.9em' },
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '4px' },
  label: { color: '#94a3b8', fontWeight: 'bold' },
  value: { color: 'white', textAlign: 'right' as const },
  valueWarning: { color: '#fbbf24', textAlign: 'right' as const, fontWeight: 'bold', maxWidth: '60%' }, // Jaune pour attirer l'attention
  valueSmall: { color: '#cbd5e1', fontSize: '0.85em', textAlign: 'right' as const, maxWidth: '60%' },

  actions: { display: 'flex', gap: '10px', marginTop: 'auto' },
  btnVoirTout: { flex: 1, backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnAnnoter: { flex: 1, backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: 'white', color: 'black', padding: '25px', borderRadius: '12px', width: '300px' },
  btnLink: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', width: '100%', textAlign: 'left', padding: '8px' },
  btnClose: { marginTop: '10px', padding: '8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', width: '100%' }
};

export default PatientCard;