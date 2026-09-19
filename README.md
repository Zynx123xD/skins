# Iris Launcher — Servidor de skins compartido

Este es el servidor que hace que, si vos y otra persona usan Iris Launcher y
entran al mismo servidor de Minecraft, **cada uno vea la skin y la capa real
del otro** (no solo la propia). Sin esto, cada launcher corre su propio
servidor local que solo sabe de su propia skin.

No tiene dependencias externas — es un solo archivo (`server.js`) con los
módulos nativos de Node. Guarda todo en la carpeta `data/` (un JSON chico +
las imágenes PNG), nada de base de datos externa.

## Cómo probarlo en tu computadora

```
npm start
```

Por defecto escucha en el puerto 8080. Abrí `http://localhost:8080` en el
navegador para ver un formulario simple de prueba (registra una skin a mano,
sin pasar por el launcher).

## Cómo desplegarlo gratis

Cualquier hosting que corra Node.js y te dé una URL pública sirve. Un par de
opciones gratuitas que andan bien para este uso (bajo tráfico, un solo
archivo):

### Render.com (recomendado, el más simple)
1. Subí esta carpeta a un repositorio de GitHub.
2. En Render: "New" → "Web Service" → conectá el repo.
3. Build command: (vacío, no hace falta)
4. Start command: `npm start`
5. Plan: Free.
6. Te da una URL tipo `https://tu-servidor.onrender.com`.

**Ojo con el plan gratis de Render**: si nadie lo usa por 15 minutos, se
"duerme", y la primera conexión después de eso tarda ~30-50 segundos en
responder mientras se despierta. Para un grupo de amigos que juega seguido no
se nota mucho; si querés que esté siempre despierto sin pagar, hay servicios
gratuitos (como UptimeRobot) que le pegan un ping cada 10 minutos para que
nunca llegue a dormirse.

### Railway.app / Fly.io / Glitch.com
El mismo procedimiento: subir el repo, decirle que corra `npm start`, y usar
la URL pública que te den. Cada uno tiene sus propios límites de horas/tráfico
gratis, pero para este servidor (muy poco tráfico, nada de CPU) cualquiera
alcanza de sobra.

### Un servidor propio / VPS
Si ya tenés un servidor donde corre el Minecraft, lo más simple: subí esta
carpeta ahí, corré `npm start` (o con `pm2`/`systemd` para que quede siempre
prendido), y abrí el puerto 8080 (o el que uses) en el firewall.

## Cómo conectarlo con Iris Launcher

En el launcher, andá a **Ajustes → Servidor de skins compartido** y pegá la
URL pública (ej. `https://tu-servidor.onrender.com`, sin la barra final). A
partir de ahí, cada vez que alguien con una skin/capa configurada entre a
jugar, el launcher se la manda sola a este servidor antes de lanzar el juego.

## Notas

- El nombre de usuario ES la identidad: dos personas con el mismo nombre de
  cuenta sin conexión van a compartir la misma skin (es la misma limitación
  que tiene cualquier cuenta offline de Minecraft, no algo específico de este
  servidor).
- Las imágenes se guardan sin ningún tipo de moderación ni límite de quién
  puede subir qué. Para un grupo cerrado de amigos no es un problema; si lo
  vas a abrir más públicamente, convendría agregarle algún tipo de clave/
  token antes de exponerlo a cualquiera.
