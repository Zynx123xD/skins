/* =============================================================================
 * Servidor de skins/capas COMPARTIDO para Iris Launcher
 * -----------------------------------------------------------------------------
 * Es el mismo protocolo (Yggdrasil, el que usa authlib-injector) que ya corre
 * localmente dentro de Iris Launcher, pero pensado para vivir en un solo
 * lugar de internet y que TODOS los que jueguen entre sí lo usen. Así, si dos
 * personas con Iris Launcher entran al mismo servidor de Minecraft, cada una
 * ve la skin y la capa real de la otra — no solo la propia.
 *
 * No tiene dependencias externas (todo con los módulos nativos de Node), para
 * poder desplegarlo en cualquier hosting gratuito sin líos de instalación.
 *
 * Endpoints:
 *   POST /register                     -> registra/actualiza una skin y capa
 *   GET  /api/yggdrasil                -> metadata que pide authlib-injector
 *   GET  /api/yggdrasil/sessionserver/session/minecraft/profile/:uuid
 *   GET  /textures/:uuid/skin.png
 *   GET  /textures/:uuid/cape.png
 *   GET  /health                       -> para que el hosting sepa que sigue viva
 *   GET  /                             -> mini formulario web para probar a mano
 * ========================================================================= */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const TEXTURES_DIR = path.join(DATA_DIR, "textures");
const KEYS_DIR = path.join(DATA_DIR, "keys");

for (const dir of [DATA_DIR, TEXTURES_DIR, KEYS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

/* ---------- Base de datos (un JSON en disco, nada de motor externo) ---------- */

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch (e) {
    return {};
  }
}
function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/* ---------- UUID "offline", IDÉNTICO al que calcula el propio Minecraft
   (y por lo tanto Iris Launcher) para cuentas sin conexión. Tiene que dar
   exactamente el mismo resultado en los dos lados o el juego busca un UUID
   y este servidor tiene guardado otro. ---------- */
function offlineUuid(username) {
  const hash = crypto.createHash("md5").update("OfflinePlayer:" + username).digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return hash.toString("hex");
}

/* ---------- Par de claves RSA propio, para firmar los perfiles ---------- */
function ensureKeys() {
  const privPath = path.join(KEYS_DIR, "private.pem");
  const pubPath = path.join(KEYS_DIR, "public.pem");
  if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
    return { privateKey: fs.readFileSync(privPath, "utf8"), publicKey: fs.readFileSync(pubPath, "utf8") };
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  fs.writeFileSync(privPath, privateKey);
  fs.writeFileSync(pubPath, publicKey);
  return { privateKey, publicKey };
}
const { privateKey, publicKey } = ensureKeys();

function signValue(valueBase64) {
  const signer = crypto.createSign("RSA-SHA1");
  signer.update(valueBase64);
  signer.end();
  return signer.sign(privateKey).toString("base64");
}

/* ---------- Utilidades HTTP ---------- */

function send(res, status, body, contentType) {
  res.writeHead(status, { "Content-Type": contentType || "application/json; charset=utf-8" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Cuerpo de la petición demasiado grande."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (e) {
        reject(new Error("JSON inválido."));
      }
    });
    req.on("error", reject);
  });
}

function decodeDataUri(value) {
  if (!value) return null;
  const base64 = String(value).replace(/^data:image\/\w+;base64,/, "");
  try {
    return Buffer.from(base64, "base64");
  } catch (e) {
    return null;
  }
}

const MAX_IMAGE_BYTES = 512 * 1024; // 512 KB de sobra para una skin/capa PNG

/* ---------- Server ---------- */

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    // Registrar/actualizar una skin y/o capa.
    if (req.method === "POST" && url.pathname === "/register") {
      const body = await readJsonBody(req, 2 * 1024 * 1024);
      const username = String(body.username || "").trim();
      if (!/^[A-Za-z0-9_]{1,16}$/.test(username)) {
        return send(res, 400, { error: "Nombre de usuario inválido (letras, números y guion bajo, máx. 16)." });
      }
      const uuid = offlineUuid(username);
      const db = loadDb();
      const entry = db[uuid] || { username };
      entry.username = username;
      entry.slim = !!body.slim;
      entry.updatedAt = Date.now();

      if (body.skin) {
        const buf = decodeDataUri(body.skin);
        if (!buf || buf.length > MAX_IMAGE_BYTES) return send(res, 400, { error: "Skin inválida o demasiado pesada." });
        fs.writeFileSync(path.join(TEXTURES_DIR, `${uuid}-skin.png`), buf);
        entry.hasSkin = true;
        // Hash del contenido: Minecraft cachea texturas por URL, así que si
        // la URL nunca cambia, nunca vuelve a bajar la imagen nueva aunque
        // el archivo del servidor sí haya cambiado. Metiendo este hash en la
        // URL (más abajo), cada skin distinta pide una URL distinta.
        entry.skinHash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
      } else if (body.skin === null) {
        try { fs.unlinkSync(path.join(TEXTURES_DIR, `${uuid}-skin.png`)); } catch (e) {}
        entry.hasSkin = false;
        entry.skinHash = null;
      }

      if (body.cape) {
        const buf = decodeDataUri(body.cape);
        if (!buf || buf.length > MAX_IMAGE_BYTES) return send(res, 400, { error: "Capa inválida o demasiado pesada." });
        fs.writeFileSync(path.join(TEXTURES_DIR, `${uuid}-cape.png`), buf);
        entry.hasCape = true;
        entry.capeHash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 12);
      } else if (body.cape === null) {
        try { fs.unlinkSync(path.join(TEXTURES_DIR, `${uuid}-cape.png`)); } catch (e) {}
        entry.hasCape = false;
        entry.capeHash = null;
      }

      db[uuid] = entry;
      saveDb(db);
      return send(res, 200, { ok: true, uuid, username });
    }

    // Metadata que pide authlib-injector al arrancar.
    if (url.pathname === "/api/yggdrasil" || url.pathname === "/api/yggdrasil/") {
      return send(res, 200, {
        meta: {
          serverName: "Iris Launcher — Skins compartidas",
          implementationName: "iris-shared-skin-server",
          implementationVersion: "1.0.0",
          "feature.non_email_login": true,
          "feature.enable_profile_key": false
        },
        skinDomains: [new URL(`http://${req.headers.host}`).hostname],
        signaturePublickey: publicKey
      });
    }

    // Perfil de un jugador: lo que Minecraft pide para saber qué skin pintar.
    const profileMatch = url.pathname.match(/^\/api\/yggdrasil\/sessionserver\/session\/minecraft\/profile\/([0-9a-fA-F]+)$/);
    if (profileMatch) {
      const uuid = profileMatch[1].toLowerCase();
      const db = loadDb();
      const entry = db[uuid];
      if (!entry) return send(res, 204, "");

      const base = `${url.protocol}//${req.headers.host}`;
      const textures = {};
      if (entry.hasSkin) {
        textures.SKIN = { url: `${base}/textures/${uuid}/skin.png?v=${entry.skinHash || "0"}` };
        if (entry.slim) textures.SKIN.metadata = { model: "slim" };
      }
      if (entry.hasCape) {
        textures.CAPE = { url: `${base}/textures/${uuid}/cape.png?v=${entry.capeHash || "0"}` };
      }
      const payload = { timestamp: Date.now(), profileId: uuid, profileName: entry.username, textures };
      const valueBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
      return send(res, 200, {
        id: uuid,
        name: entry.username,
        properties: [{ name: "textures", value: valueBase64, signature: signValue(valueBase64) }]
      });
    }

    // Las imágenes en sí.
    const textureMatch = url.pathname.match(/^\/textures\/([0-9a-fA-F]+)\/(skin|cape)\.png$/);
    if (textureMatch) {
      const filePath = path.join(TEXTURES_DIR, `${textureMatch[1].toLowerCase()}-${textureMatch[2]}.png`);
      if (!fs.existsSync(filePath)) return send(res, 404, "");
      return send(res, 200, fs.readFileSync(filePath), "image/png");
    }

    if (url.pathname === "/health") return send(res, 200, { ok: true, players: Object.keys(loadDb()).length });

    if (url.pathname === "/" && req.method === "GET") {
      return send(res, 200, HOME_PAGE, "text/html; charset=utf-8");
    }

    send(res, 404, { error: "not found" });
  } catch (err) {
    send(res, 500, { error: err.message || String(err) });
  }
});

const HOME_PAGE = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Iris Launcher — Skins compartidas</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0b0b10;color:#eee;max-width:520px;margin:40px auto;padding:0 20px}
  h1{font-size:20px} label{display:block;margin-top:14px;font-size:13px;color:#aaa}
  input[type=text]{width:100%;padding:8px;border-radius:6px;border:1px solid #333;background:#161620;color:#eee;box-sizing:border-box}
  button{margin-top:18px;padding:10px 18px;border:0;border-radius:6px;background:#8b5cf6;color:#fff;font-weight:700;cursor:pointer}
  small{color:#888}
  #out{margin-top:14px;font-size:13px;white-space:pre-wrap}
</style></head>
<body>
  <h1>Iris Launcher — Skins compartidas</h1>
  <p><small>Esto normalmente lo hace el propio launcher solo. Este formulario es solo para probar el servidor a mano.</small></p>
  <label>Nombre de usuario (igual al de tu cuenta sin conexión)</label>
  <input type="text" id="username" maxlength="16">
  <label>Skin (PNG)</label>
  <input type="file" id="skin" accept="image/png">
  <label>Capa (PNG, opcional)</label>
  <input type="file" id="cape" accept="image/png">
  <label><input type="checkbox" id="slim"> Modelo delgado (Alex)</label>
  <button onclick="submitForm()">Registrar</button>
  <div id="out"></div>
  <script>
    function toDataUri(file) {
      return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }
    async function submitForm() {
      const out = document.getElementById('out');
      out.textContent = 'Enviando...';
      const username = document.getElementById('username').value.trim();
      const skin = await toDataUri(document.getElementById('skin').files[0]);
      const cape = await toDataUri(document.getElementById('cape').files[0]);
      const slim = document.getElementById('slim').checked;
      const res = await fetch('/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, skin, cape, slim })
      });
      out.textContent = JSON.stringify(await res.json(), null, 2);
    }
  </script>
</body>
</html>`;

server.listen(PORT, () => {
  console.log(`Iris Launcher — servidor de skins compartido escuchando en el puerto ${PORT}`);
});
