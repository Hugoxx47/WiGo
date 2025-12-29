import { Container, Typography, Card, CardContent, CardActions, Button, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>Tableau de bord - Oncologie</Typography>
      <Grid container spacing={3}>
        {/* Carte Patient */}
          <Card>
            <CardContent>
              <Typography variant="h5" component="div">Patient CMU-1</Typography>
              <Typography color="text.secondary">Biopsie Pulmonaire</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Statut: En attente d'analyse IA
              </Typography>
            </CardContent>
            <CardActions>
              <Button size="small" variant="contained" onClick={() => navigate('/viewer')}>
                Ouvrir Viewer
              </Button>
            </CardActions>
          </Card>
      </Grid>
    </Container>
  );
}