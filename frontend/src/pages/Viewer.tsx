import { useEffect, useRef } from 'react';
import OpenSeadragon from 'openseadragon';
import { Box, AppBar, Toolbar, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

export default function Viewer() {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (viewerRef.current) return;

    const osd = OpenSeadragon({
      id: "osd-viewer",
      prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
      tileSources: {
        Image: {
          xmlns: "http://schemas.microsoft.com/deepzoom/2008",
          // ⚠️ Vérifie que ce chemin correspond EXACTEMENT à ton dossier MinIO
          Url: "http://localhost:9000/biopsies/biopsie_cmu_1_files/", 
          Format: "jpg",
          Overlap: "1",
          TileSize: "256",
          Size: {
            // Ces dimensions doivent correspondre à ce que le script Python a affiché
            // Pour CMU-1.svs, c'est généralement :
            Height: "32914", 
            Width: "46000"
          }
        }
      },
      showNavigator: true,
      wrapHorizontal: false,
      debugMode: false, // Mets à 'true' si tu veux voir les cases rouges de debug
    });

    viewerRef.current = osd;

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'black' }}>
      <AppBar position="static" sx={{ bgcolor: '#1a1a1a' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate('/dashboard')} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            🔬 Analyse : Patient #CMU-1 (Biopsie Pulmonaire)
          </Typography>
        </Toolbar>
      </AppBar>
      
      {/* C'est ici que l'image doit s'afficher */}
      <div id="osd-viewer" style={{ flexGrow: 1, width: '100%', height: '100%' }} />
    </Box>
  );
}