// Genera los iconos PNG para la PWA
// Ejecutar: node generate-icons.js

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fondo oscuro
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, size, size);

  // Círculo verde de fondo
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#2d5a27';
  ctx.fill();

  // Texto "412"
  const fontSize = size * 0.35;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // "4" en blanco
  const text = '412';
  const metrics = ctx.measureText(text);
  const charWidth = metrics.width / 3;
  const startX = size / 2 - metrics.width / 2;

  ctx.fillStyle = '#f5f5f5';
  ctx.fillText('4', startX + charWidth * 0.5, size / 2);

  ctx.fillStyle = '#00e676';
  ctx.fillText('1', startX + charWidth * 1.5, size / 2);

  ctx.fillStyle = '#f5f5f5';
  ctx.fillText('2', startX + charWidth * 2.5, size / 2);

  return canvas.toBuffer('image/png');
}

const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

[192, 512].forEach(size => {
  const buf = generateIcon(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), buf);
  console.log(`Generado icon-${size}.png`);
});
