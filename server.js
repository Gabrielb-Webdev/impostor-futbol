// ============================================================
// server.js — Servidor principal Impostor 412
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;

// Hub / Home
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'hub', 'index.html'));
});

// Rutas principales (antes de static para evitar redirect 301)
app.get('/player', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player', 'index.html'));
});

app.get('/host', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'host', 'index.html'));
});

app.get('/overlay', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay', 'index.html'));
});

app.get('/overlay-a', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay-a', 'index.html'));
});

app.get('/overlay-b', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay-b', 'index.html'));
});

app.get('/overlay-c', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay-c', 'index.html'));
});

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// API: Generar QR con la URL del jugador
app.get('/api/qr', async (req, res) => {
  // En producción usa el host del request, en local usa IP local
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let url;
  if (process.env.BASE_URL) {
    url = `${process.env.BASE_URL}/player`;
  } else if (host && !host.includes('localhost') && !host.match(/^\d+\.\d+\.\d+\.\d+/)) {
    url = `${protocol}://${host}/player`;
  } else {
    const ip = getLocalIP();
    url = `http://${ip}:${PORT}/player`;
  }
  try {
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 1,
      color: { dark: '#00e676', light: '#1a1a1a' }
    });
    res.json({ url, qr: qrDataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Error generando QR' });
  }
});

// Socket.io
require('./src/socketHandler')(io);

// Obtener IP local
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║       🏟️  IMPOSTOR 412 - LA COBRA  🐍             ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Host:       http://${ip}:${PORT}/host`);
  console.log(`  ║  Player:     http://${ip}:${PORT}/player`);
  console.log(`  ║  Overlay:    http://${ip}:${PORT}/overlay    (Original)`);
  console.log(`  ║  Overlay A:  http://${ip}:${PORT}/overlay-a  (Marcador)`);
  console.log(`  ║  Overlay B:  http://${ip}:${PORT}/overlay-b  (Barra Inf)`);
  console.log(`  ║  Overlay C:  http://${ip}:${PORT}/overlay-c  (Minimal)`);
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
});
