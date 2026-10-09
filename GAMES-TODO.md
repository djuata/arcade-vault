# To-do de juegos — Arcade Vault

> Mantenido por el agente `game-planner`. Última actualización: 2026-10-08.
> Para decidir: aceptar → mover a "Aceptados"; rechazar → mover a "Descartados" con el motivo.

## Pendientes de decisión

- [ ] **MOTOS DE LUZ** (`motos`) — VERSUS / cyan · puntaje 22/25 · sugerido 2026-10-07
  - Por qué: Tron light cycles contra la CPU; primer VERSUS jugable y reutiliza la grilla y la cola de giros de SNAKE.
  - Riesgo: IA de la CPU justa (ni suicida ni imbatible) y dificultad escalonada por ronda.
- [ ] **COLUMNAS** (`columnas`) — PUZZLE / magenta · puntaje 21/25 · sugerido 2026-10-07
  - Por qué: estrena el color magenta, refuerza PUZZLE (solo hay Tetris) y reutiliza la grilla, gravedad y autorrepetición del motor de Tetris.
  - Riesgo: detección de tríos en 4 direcciones y cascadas encadenadas con animación sin congelar el loop.
- [ ] **MISILES** (`misiles`) — SHOOTER / magenta · puntaje 19/25 · sugerido 2026-10-07
  - Por qué: Missile Command es arcade puro, muy competitivo por oleadas y suma un segundo SHOOTER en magenta.
  - Riesgo: es un juego pensado para mouse; la mira por teclado necesita aceleración bien afinada para no frustrar.
- [ ] **CIEMPIÉS** (`ciempies`) — SHOOTER / green · puntaje 19/25 · sugerido 2026-10-07
  - Por qué: Centipede, shooter clásico de alto puntaje con hongos, araña y ciempiés que se parte.
  - Riesgo: segmentación del ciempiés al recibir disparos y su recorrido entre hongos.
- [ ] **TANQUES** (`tanques`) — VERSUS / yellow · puntaje 19/25 · sugerido 2026-10-07
  - Por qué: duelo de tanques tipo Combat contra la CPU en arena con muros; otro VERSUS (la categoría no tiene juegos jugables).
  - Riesgo: pathfinding de la CPU y rebote de balas en muros.
- [ ] **HÉLICE** (`helice`) — ARCADE / cyan · puntaje 19/25 · sugerido 2026-10-07
  - Por qué: helicóptero en cueva infinita de un solo botón; partidas de segundos, adictivo para el top 10.
  - Riesgo: generación procedural de la cueva que sea siempre pasable; suma a ARCADE, ya poblada.
- [ ] **ATRAPA** (`atrapa`) — ARCADE / yellow · puntaje 19/25 · sugerido 2026-10-07
  - Por qué: Kaboom! (atrapar bombas con cubetas); reutiliza paleta y mouse de ARKANOID, motor chico.
  - Riesgo: curva de velocidad del bombardero; ARCADE ya tiene dos juegos.
- [ ] **SALTARÍN** (`saltarin`) — ARCADE / magenta · puntaje 18/25 · sugerido 2026-10-07
  - Por qué: saltador vertical infinito con plataformas; puntaje = altura, muy rejugable.
  - Riesgo: es más "móvil moderno" que arcade retro; hay que darle estética de neón para que encaje.
- [ ] **ALUNIZAJE** (`alunizaje`) — ARCADE / magenta · puntaje 17/25 · sugerido 2026-10-07
  - Por qué: Lunar Lander reutiliza la física de rotación y empuje de ROCAS.
  - Riesgo: ritmo lento y poco "arcade de récord"; terreno y colisión precisa con el módulo.
- [ ] **BURBUJAS** (`burbujas`) — PUZZLE / yellow · puntaje 17/25 · sugerido 2026-10-07
  - Por qué: Puzzle Bobble/Bust-a-Move, puzzle de apuntar y combinar colores muy reconocible.
  - Riesgo: grilla hexagonal, rebote en paredes y caída de grupos desconectados.
- [ ] **2048** (`dosmil`) — PUZZLE / green · puntaje 17/25 · sugerido 2026-10-07
  - Por qué: motor trivial, puntaje natural y game over claro (sin movimientos).
  - Riesgo: no es retro arcade; encaja poco con la identidad del portal.
- [ ] **SIMÓN** (`simon`) — PUZZLE / magenta · puntaje 17/25 · sugerido 2026-10-07
  - Por qué: memoria de secuencias con 4 colores neón; motor muy simple, game over al primer error.
  - Riesgo: poca profundidad; sin audio pierde gracia.
- [ ] **CARRETERA** (`carretera`) — ARCADE / cyan · puntaje 17/25 · sugerido 2026-10-07
  - Por qué: carreras verticales tipo Road Fighter esquivando autos con combustible; puntaje por distancia.
  - Riesgo: scroll y spawns de tráfico balanceados; temática cercana a CROAC (autos), aunque la mecánica es distinta.
- [ ] **DEFENSOR** (`defensor`) — SHOOTER / cyan · puntaje 16/25 · sugerido 2026-10-07
  - Por qué: Defender, shooter de scroll horizontal con radar y rescate.
  - Riesgo: mundo con scroll envolvente, radar y varios tipos de enemigos: motor costoso.
- [ ] **BUSCAMINAS** (`minas`) — PUZZLE / cyan · puntaje 16/25 · sugerido 2026-10-07
  - Por qué: motor trivial; puntaje por celdas reveladas más bonus de tiempo.
  - Riesgo: no es arcade y el teclado (cursor + bandera) es incómodo frente al mouse.
- [ ] **PENALES** (`penales`) — VERSUS / green · puntaje 16/25 · sugerido 2026-10-07
  - Por qué: tanda de penales contra la CPU, alternando pateador y arquero; VERSUS liviano.
  - Riesgo: poco retro reconocible y profundidad limitada; sprites propios.
- [ ] **EXCAVADOR** (`excavador`) — ARCADE / green · puntaje 14/25 · sugerido 2026-10-07
  - Por qué: Dig Dug, cavar túneles e inflar enemigos.
  - Riesgo: terreno destructible + IA que atraviesa tierra; esfuerzo alto.
- [ ] **CUBOS** (`cubos`) — ARCADE / magenta · puntaje 14/25 · sugerido 2026-10-07
  - Por qué: Q*bert, pirámide isométrica que cambia de color al saltar.
  - Riesgo: render isométrico y controles diagonales con teclado.
- [ ] **FLIPPER** (`flipper`) — ARCADE / yellow · puntaje 14/25 · sugerido 2026-10-07
  - Por qué: pinball de una mesa, puntaje altísimo y muy competitivo.
  - Riesgo: física de flippers y colisiones contra curvas: lo más caro de la lista.
- [ ] **BARRILES** (`barriles`) — ARCADE / yellow · puntaje 13/25 · sugerido 2026-10-07
  - Por qué: plataformas tipo Donkey Kong esquivando barriles.
  - Riesgo: plataformas inclinadas, escaleras y saltos precisos; esfuerzo alto e imagen de marca muy ajena.

## Aceptados (próximos a implementar)

- [ ] **FROGGER** (`frogger`) — ARCADE / green · aceptado 2026-10-09 — spec [15](specs/15-frogger-game.md)
  - Por qué: el Frogger de arcade completo (mosca, rana dama, cocodrilos, serpiente, vida extra) que CROAC descartó; entrada aparte de CROAC.
  - Riesgo: "Frogger" es marca registrada; amenazas por nivel con relojes deterministas.

## Implementados

- [x] **ROCAS** (`rocas`) — spec [05](specs/05-asteroids-game.md)
- [x] **TETRIS** (`tetris`) — spec [07](specs/07-tetris-game.md)
- [x] **ARKANOID** (`arkanoid`) — spec [08](specs/08-arkanoid-game.md)
- [x] **SNAKE** (`snake`) — spec [09](specs/09-snake-game.md)
- [x] **CROAC** (`croac`) — ganó el game jam "Cruza la carretera y el río sin convertirte en papilla" 2026-10-07 — spec [10](specs/10-croac-game.md)

## Descartados

- **CRUCE** (`cruce`) — PUZZLE / cyan · perdió el game jam "Cruza la carretera y el río sin convertirte en papilla" 2026-10-07 — spec [game jam](specs/game-jam/cruce/cruce-game.md)
- **CHARCA** (`charca`) — VERSUS / yellow · perdió el game jam "Cruza la carretera y el río sin convertirte en papilla" 2026-10-07 — spec [game jam](specs/game-jam/charca/charca-game.md)
