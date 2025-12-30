import axios from 'axios';

// L'adresse de ton backend Python
const API_URL = 'http://127.0.0.1:8000';

export interface Biopsy {
  id: number;
  image_url: string;
  status: string;
}

export interface Patient {
  id: number;
  name: string;
  age: number;
  folder_id: string;
  biopsies: Biopsy[];
}

// Fonction pour récupérer la liste des patients
export const getPatients = async (): Promise<Patient[]> => {
  try {
    const response = await axios.get(`${API_URL}/patients`);
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la récupération des patients", error);
    return [];
  }
};