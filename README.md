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

**Ojo con el plan gratis de Render — esto es importante, no solo cosmético**:
si nadie lo usa por 15 minutos, el servicio se "duerme" y **se reinicia
desde cero la próxima vez que alguien le pega**. Como el plan gratis no tiene
disco persistente, ese reinicio **borra todo lo que estaba guardado en
`data/`** (todas las skins y capas registradas hasta ese momento). Por eso
puede pasar que cada uno vea la suya (porque el launcher la vuelve a
registrar justo antes de lanzar el juego) pero no la del otro: si pasaron
más de 15 minutos sin actividad entre que una persona registró la suya y la
otra entró a jugar, el servidor ya se durmió y se llevó puesto ese registro.

La solución sin pagar nada: un servicio gratuito de "keep-alive" como
[UptimeRobot](https://uptimerobot.com) o [cron-job.org](https://cron-job.org)
que le pegue a `https://tu-servidor.onrender.com/health` cada 10 minutos, las
24 horas. Mientras el servicio nunca llegue a dormirse, no pierde los datos
(el borrado pasa específicamente al reiniciar/redesplegar, no mientras sigue
corriendo). Si querés algo más a prueba de balas (por ejemplo para que
sobreviva incluso a un redeploy), la alternativa es pasar a un plan pago de
Render con un disco persistente — pero para un grupo de amigos jugando
seguido, el keep-alive gratis alcanza.

Podés comprobar en cualquier momento quién está registrado ahora mismo
entrando a `https://tu-servidor.onrender.com/api/players` desde el navegador.

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

**Esto hay que hacerlo en CADA computadora**, no es una configuración que se
comparta sola entre vos y tus amigos: es un ajuste local de cada instalación
del launcher (se guarda en el almacenamiento del propio launcher, como
cualquier otro ajuste). Si alguien no pegó la URL en su Ajustes, su launcher
sigue usando su propio servidor local (solo su PC), nunca se registra en
este servidor compartido, y por lo tanto nadie más puede verlo — ni él puede
ver a los demás. Confirmá con tu amigo que también la haya pegado ahí.

## Notas

- El nombre de usuario ES la identidad: dos personas con el mismo nombre de
  cuenta sin conexión van a compartir la misma skin (es la misma limitación
  que tiene cualquier cuenta offline de Minecraft, no algo específico de este
  servidor).
- Las imágenes se guardan sin ningún tipo de moderación ni límite de quién
  puede subir qué. Para un grupo cerrado de amigos no es un problema; si lo
  vas a abrir más públicamente, convendría agregarle algún tipo de clave/
  token antes de exponerlo a cualquiera.
