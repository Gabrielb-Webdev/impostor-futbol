# 🏟️ IMPOSTOR 412 — La Cobra

Juego del Impostor temático del canal **412 / La Cobra** para streams en vivo. Incluye app móvil para jugadores, panel de control para el host, y overlay transparente para OBS.

---

## 🚀 Instalación y uso en 5 pasos

### 1. Requisitos previos
- [Node.js](https://nodejs.org) v16 o superior instalado

### 2. Instalar dependencias
```bash
cd "Test Cobrix"
npm install
```

### 3. Iniciar el servidor
```bash
npm start
```
El servidor arranca en el **puerto 3000** y muestra las URLs en consola.

### 4. Abrir las interfaces
- **Host (La Cobra):** `http://TU_IP:3000/host` — Abrí esto en tu PC
- **Jugadores:** `http://TU_IP:3000/player` — Los jugadores entran desde el celu escaneando el QR que aparece en el panel del host
- **Overlay OBS:** `http://TU_IP:3000/overlay` — Agregalo como Browser Source en OBS (1920x1080, fondo transparente)

### 5. ¡A jugar!
Desde el **panel de host**, presioná **INICIAR JUEGO** cuando haya al menos 3 jugadores conectados.

---

## 🎮 Flujo del juego

1. Los jugadores entran desde el celu con su nombre
2. El host inicia → todos votan la temática
3. Se asignan roles (palabra + impostores al azar)
4. Fase de debate con timer
5. Votación de expulsión
6. Revelación dramática
7. Se repite hasta que ganen futbolistas o impostores

---

## 🖥️ Configuración OBS

1. Agregar **Browser Source** en OBS
2. URL: `http://TU_IP:3000/overlay`
3. Ancho: **1920** | Alto: **1080**
4. ✅ Marcar **"Shutdown source when not visible"**
5. ✅ Fondo transparente (ya está configurado en el CSS)

---

## 📁 Estructura del proyecto

```
├── server.js              # Servidor Express + Socket.io
├── package.json
├── README.md
├── src/
│   ├── gameState.js       # Lógica del juego en memoria
│   └── socketHandler.js   # Eventos Socket.io
└── public/
    ├── player/            # App móvil para jugadores
    │   ├── index.html
    │   ├── style.css
    │   └── app.js
    ├── host/              # Panel de control del host
    │   ├── index.html
    │   ├── style.css
    │   └── app.js
    └── overlay/           # Overlay OBS (1920x1080)
        ├── index.html
        ├── style.css
        └── app.js
```

---

## ⚙️ Características

- **Sin base de datos**: todo en memoria RAM (sesión única en vivo)
- **Red local**: funciona sin internet, solo necesitan estar en la misma red WiFi
- **QR automático**: el panel del host muestra QR y URL para que los jugadores se conecten
- **Tiempo real**: Socket.io sincroniza fases entre celulares, host y overlay
- **1 o 2 impostores**: configurable desde el host
- **Categorías personalizadas**: el host puede agregar nuevas categorías sobre la marcha
- **Timers configurables**: debate y votación con duración ajustable
- **Overlay con animaciones**: confetti, balón animado, alertas dramáticas, countdown tipo estadio

---

## 🎨 Estética

- Paleta: gris concreto (#1a1a1a, #2c2c2c), verde neón (#00e676), verde musgo (#2d5a27), rojo (#e53935)
- Tipografías: Bebas Neue + Barlow Condensed
- Inspirado en la estética del canal 412 / La Cobra
