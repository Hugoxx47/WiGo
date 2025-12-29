import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Container, TextField, Typography, Paper } from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulation de connexion (à remplacer par le vrai backend plus tard)
    if(email) {
        localStorage.setItem('user', email);
        navigate('/dashboard');
    }
  };

  return (
    <Container component="main" maxWidth="xs" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <Paper elevation={3} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        
        <LocalHospitalIcon sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
        <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
          Biopsie IA - Accès Pro
        </Typography>

        <Box component="form" onSubmit={handleLogin} sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="Identifiant Médical"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Mot de passe"
            type="password"
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2, py: 1.5 }}
          >
            Se connecter
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}