import { useEffect, useRef } from 'react';
import OpenSeadragon from 'openseadragon';
import { Box, AppBar, Toolbar, Typography, IconButton, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

export default function Viewer() {
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Éviter le double chargement en React 18
    if (viewerRef.current) return;

    const osd = OpenSeadragon({
      id: "osd-viewer",
      prefixUrl: "https://openseadragon.github.io/openseadragon/images/", // Icônes (zoom, home...)
      tileSources: {
        Image: {
          xmlns: "http://schemas.microsoft.com/deepzoom/2008",
          // L'URL vers le dossier "_files" dans MinIO
          Url: "http://localhost:9000/biopsies/biopsie_cmu_1_files/", 
          Format: "jpg",
          Overlap: "1",      // Doit correspondre à ton script Python (overlap=1)
          TileSize: "256",   // Doit correspondre à ton script Python (tile_size=256)
          Size: {
            Height: "32914", // ⚠️ Chiffres exacts de ton log Python
            Width: "46000"
          }
        }
      },
      showNavigator: true,    // Affiche la mini-carte en haut à droite
      wrapHorizontal: false,
      animationTime: 0.5,
      blendTime: 0.1,
      constrainDuringPan: true,
      maxZoomPixelRatio: 2,
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
      
      {/* Zone du Viewer */}
      <div id="osd-viewer" style={{ flexGrow: 1, width: '100%', height: '100%' }} />
      
      {/* Légende ou info bulle (Optionnel) */}
      <Box sx={{ position: 'absolute', bottom: 20, right: 20, bgcolor: 'rgba(255,255,255,0.8)', p: 1, borderRadius: 1 }}>
        <Typography variant="caption">Source: CMU-1.svs | WSI High Res</Typography>
      </Box>
    </Box>
  );
}