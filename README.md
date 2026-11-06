# ⭐ Fiesta Estelar

Juego de tablero y minijuegos estilo "fiesta" para **Android y navegador**, de **1 a 6 jugadores**: modo un jugador contra bots y multijugador en línea con amigos mediante código de sala. La app Android y la versión web pueden jugar **juntas** en la misma sala.

Personajes, tableros y minijuegos 100 % originales.

---

## 🚀 Publicarlo con GitHub (APK + web) en 5 pasos

1. Crea un repositorio nuevo en GitHub (por ejemplo `fiesta-estelar`).
2. Sube **todo el contenido** de esta carpeta (incluida la carpeta oculta `.github`). Puedes arrastrar los archivos en *Add file → Upload files*, o con git:
   ```bash
   git init && git add . && git commit -m "Fiesta Estelar"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/fiesta-estelar.git
   git push -u origin main
   ```
3. En el repositorio: **Settings → Pages → Source: “GitHub Actions”**.
4. Ve a la pestaña **Actions**. Se ejecutan dos flujos automáticamente:
   - **Web (GitHub Pages)** → el juego queda en `https://TU_USUARIO.github.io/fiesta-estelar/`
   - **Android APK** → compila la app con Capacitor (~5–8 min).
5. Descarga **`FiestaEstelar.apk`** desde la sección **Releases** del repositorio e instálalo en tu Android (permite *instalar apps de origen desconocido*). Compártelo con tus amigos.

Cada vez que hagas `push` a `main` se generan un APK y una web nuevos.

> Si el workflow de Android falla en "Publicar Release", revisa en *Settings → Actions → General → Workflow permissions* que esté marcado **Read and write permissions**.

---

## 🎮 Cómo se juega

- **Objetivo:** tener más ⭐ estrellas al final (desempate: 🪙 monedas).
- **Turno:** usa un objeto (opcional) → tira el dado (1–10) → avanza → se activa la casilla donde caes.
- **Estrella:** al pasar junto a ella puedes comprarla por 20 monedas (hasta 3 a la vez, porque los tableros son enormes). Después se muda.
- **Minijuego al final de cada ronda.** El tipo depende del color donde cayó cada jugador:
  - Todos del mismo color (o sorteo) → **Todos contra todos** (1º +10, 2º +5, 3º +2)
  - 3 vs 3 o 2 vs 4 → **Por equipos** (ganadores +10 cada uno)
  - 1 vs 5 → **Uno contra todos** (solitario gana +15 / grupo gana +6 cada uno)
- **Duelos ⚔️:** retas a un rival apostando monedas en un minijuego 1 vs 1.
- **Últimos 5 turnos:** azul/rojo valen doble y el último lugar recibe ayuda.
- **Estrellas extra al final:** 🎮 Minijuego, 💰 Rica, ❗ Sorpresa.

### Multijugador
1. El anfitrión toca **Crear sala** → aparece un **código de 5 letras**.
2. Los amigos (con la app o desde la web) tocan **Unirse a sala** y escriben el código.
3. Las plazas vacías (hasta 6) se rellenan con bots. El anfitrión elige tablero, turnos y velocidad, y pulsa **Empezar**.
4. Si alguien se desconecta, un bot toma su lugar y la partida continúa.

La conexión es **P2P (WebRTC con PeerJS)**: no necesitas servidor propio. Se usa el servidor público gratuito de PeerJS solo para que los jugadores se encuentren. Necesita internet en todos los dispositivos.

---

## 🗺️ Contenido

### 10 tableros (111–147 casillas cada uno, con rutas alternativas)
| Tablero | Mecánica única |
|---|---|
| 🏝️ Isla Coco | Mareas que abren y cierran rutas secretas cada 3 turnos; delfines |
| 🌋 Volcán Furioso | Erupciones cada 5 turnos sobre la zona de lava; géiseres |
| 🌃 Ciudad Neón | 2 bancos (depositas al pasar, cobras todo al caer) y taxis a la estrella |
| 🌲 Bosque Encantado | El Espectro roba monedas o estrellas; portales mágicos |
| 🏰 Castillo de Hielo | Atajos con peajes del Gólem que suben; toboganes que dan el bote |
| 🏜️ Pirámides del Sol | Ruleta de la Esfinge: puede dar o quitar estrellas |
| 🚀 Estación Órbita | Baja gravedad en turnos impares (+2); agujeros de gusano que revuelven a todos |
| 🧸 Fábrica de Juguetes | Cintas transportadoras ±5 casillas; máquina de objetos |
| 🏴‍☠️ Galeón Pirata | Cañones que te disparan por el mapa; el Kraken roba al más rico |
| ☁️ Templo Celestial | ¡Dos estrellas a la vez!; la Balanza reparte todas las monedas |

### 12 tipos de casilla
Azul, Roja, Suerte, Desgracia, Objeto, Evento (del tablero), Duelo, Teletransporte, Tienda, Banco, Peaje y Salida.

### 13 objetos
Dado Doble, Dado Triple, Dado Mágico (eliges el número), Dado Codicioso, Dado Tortuga, Portal de Cambio, Guante Ladrón, Silbato Estelar, Escudo, Trampa de Monedas, Llave Maestra, Imán de Monedas y Brújula Estelar.

### 30 minijuegos
- **Todos contra todos (10):** Machacabotones, Reflejo Relámpago, Memoria de Colores, Atrapa Estrellas, Esquiva Meteoritos, Cálculo Veloz, Detén el Reloj, Revienta Globos, Salto Imparable, Parejas Locas.
- **Por equipos (10):** Tira y Afloja, Torre Altísima, Carrera de Remos, Golpea Topos, Números en Orden, Tiro al Blanco, Equilibrista, Cosecha de Monedas, Ritmo Tropical, Clasificador.
- **Uno contra todos (10):** Asedio al Castillo, Laberinto Veloz, Ojo de Halcón, Carril Veloz, Puente de Cristal, Flechas Locas, Gran Pesca, Luz Verde Luz Roja, Cuenta Ovejas, Aguja de Precisión.

Todos se juegan con el dedo (también con ratón o teclado en PC). Puedes practicarlos desde el menú **Minijuegos**.

---

## 🛠️ Desarrollo

```
www/            ← el juego (HTML + JS sin compilación)
  js/engine.js    motor de reglas (autoritativo, sin DOM)
  js/boards.js    10 tableros + mecánicas únicas
  js/minigames.js 30 minijuegos en canvas
  js/mgmeta.js    catálogo de minijuegos y nivel de bots
  js/ai.js        decisiones de los bots
  js/net.js       multijugador P2P (PeerJS)
  js/render.js    dibujo del tablero
  js/main.js      menús, salas e interfaz
tests/simulate.mjs  simula partidas completas con 6 bots en los 10 tableros
.github/workflows   APK (Capacitor) y GitHub Pages
```

- Probar en la PC: `npm run serve` y abre `http://localhost:8080`.
- Simular partidas: `npm test`.
- Compilar el APK localmente (requiere Android Studio / JDK 21): `npm install && npx cap add android && npx cap sync android && cd android && ./gradlew assembleDebug`.

### Redes difíciles (opcional)
Algunas redes móviles bloquean las conexiones P2P directas. Si a alguien no le conecta, prueben con Wi-Fi. Si quieres añadir un servidor TURN, ejecuta esto en la consola del navegador (o adáptalo en `net.js`):
```js
localStorage.setItem('fe_turn', JSON.stringify({ urls: 'turn:TU_SERVIDOR:3478', username: 'usuario', credential: 'clave' }))
```
También puedes usar tu propio servidor PeerJS con `localStorage.setItem('fe_peerserver', JSON.stringify({ host, port, path, secure }))`.
