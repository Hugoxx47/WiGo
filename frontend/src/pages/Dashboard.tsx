import { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, CardActions, Button, Grid, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getPatients, type Patient } from '../services/api'; // On importe notre service

export default function Dashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);

  // Au chargement de la page, on va chercher les données
  useEffect(() => {
    const fetchData = async () => {
      const data = await getPatients();
      setPatients(data);
    };
    fetchData();
  }, []);

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 'bold', color: '#1976d2' }}>
        Tableau de bord - Oncologie
      </Typography>
      
      <Grid container spacing={3}>
        {patients.map((patient) => (
          <Grid size={{ xs: 12, md: 4 }} key={patient.id}>
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h5" component="div">
                  {patient.name}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                  Dossier #{patient.folder_id} | {patient.age} ans
                </Typography>
                
                {patient.biopsies.length > 0 ? (
                  patient.biopsies.map(biopsy => (
                    <Chip 
                      key={biopsy.id} 
                      label={biopsy.status} 
                      color={biopsy.status === "Validé" ? "success" : "warning"} 
                      size="small" 
                      sx={{ mt: 1 }}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="error">Aucune biopsie</Typography>
                )}
                
              </CardContent>
              <CardActions>
                {/* On ne permet d'ouvrir le viewer que s'il y a une biopsie */}
                {patient.biopsies.length > 0 && (
                  <Button 
                    size="small" 
                    variant="contained" 
                    onClick={() => navigate('/viewer')}
                  >
                    Ouvrir Microscope IA
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}