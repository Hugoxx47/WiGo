import { useEffect, useRef, useState } from 'react';
import OpenSeadragon from 'openseadragon';
import { Box, AppBar, Toolbar, Typography, IconButton, Button, CircularProgress, Alert, Snackbar } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SmartToyIcon from '@mui/icons-material/SmartToy'; // Icône robot
import { useNavigate } from 'react-router-dom';
import { analyzeBiopsy, type AIResult } from '../services/api';

export default function Viewer() {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const navigate = useNavigate();
  
  // États pour gérer l'analyse IA
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);

  useEffect(() => {
    if (viewerRef.current) return;

    const osd = OpenSeadragon({
      id: "osd-viewer",
      prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
      tileSources: {
        Image: {
          xmlns: "http://schemas.microsoft.com/deepzoom/2008",
          Url: "http://localhost:9000/biopsies/biopsie_cmu_1_files/",
          Format: "jpg",
          Overlap: "1",
          TileSize: "256",
          Size: { Height: "32914", Width: "46000" }
        }
      },
      showNavigator: true,
      wrapHorizontal: false,
      debugMode: false,
    });

    viewerRef.current = osd;

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Fonction déclenchée par le bouton "Lancer IA"
  const handleAnalyze = async () => {
    setLoading(true);
    // On suppose que l'ID de la biopsie est 1 pour l'instant (demo)
    const data = await analyzeBiopsy(1);
    setLoading(false);
    if (data) {
      setResult(data);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'black' }}>
      <AppBar position="static" sx={{ bgcolor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            🔬 Analyse : Patient #CMU-1
          </Typography>

          {/* BOUTON IA */}
          <Button 
            variant="contained" 
            color="secondary" 
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SmartToyIcon />}
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? "Analyse en cours..." : "Lancer Diagnostic IA"}
          </Button>
        </Toolbar>
      </AppBar>
      
      <div id="osd-viewer" style={{ flexGrow: 1, width: '100%', height: '100%' }} />

      {/* POPUP DE RÉSULTAT */}
      <Snackbar open={!!result} autoHideDuration={6000} onClose={() => setResult(null)}>
        <Alert severity={result?.cancer_detected ? "error" : "success"} sx={{ width: '100%' }}>
          {result && (
            result.cancer_detected
            ? `⚠️ Anomalie détectée (Confiance: ${Math.round(result.confidence * 100)}%) - ${result.cells_count} cellules analysées.` 
              : `✅ Tissu sain (Confiance: ${Math.round(result.confidence * 100)}%) - ${result.cells_count} cellules analysées.`
          )}
        </Alert>
      </Snackbar>
    </Box>
  );
}