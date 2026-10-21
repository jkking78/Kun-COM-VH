// Envoi Web Push sans dépendance : chiffrement « aes128gcm » (RFC 8291) et
// signature VAPID (RFC 8292), uniquement avec WebCrypto. Fonctionne à
// l'identique dans Deno (Edge Function) et dans Node ≥ 18 (tests).

export type Abonnement = { endpoint: string; keys: { p256dh: string; auth: string } };
export type ClesVapid = { publique: string; privee: string };   // base64url

const te = new TextEncoder();

export function b64u(octets: Uint8Array): string {
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function deb64u(texte: string): Uint8Array {
  const b = texte.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b + "===".slice((b.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}
async function hmac(cle: Uint8Array, donnees: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", cle, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, donnees));
}

// Nouvelle paire de clés VAPID (P-256), en base64url : publique non compressée
// (65 octets), privée = scalaire d (32 octets).
export async function genererClesVapid(): Promise<ClesVapid> {
  const paire = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", paire.privateKey) as JsonWebKey;
  const brute = new Uint8Array(await crypto.subtle.exportKey("raw", paire.publicKey));
  return { publique: b64u(brute), privee: jwk.d! };
}

async function jetonVapid(audience: string, cles: ClesVapid, contact: string): Promise<string> {
  const pub = deb64u(cles.publique);
  const jwk: JsonWebKey = {
    kty: "EC", crv: "P-256", d: cles.privee,
    x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true,
  };
  const cle = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const entete = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const charge = b64u(te.encode(JSON.stringify({
    aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contact,
  })));
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, cle, te.encode(entete + "." + charge)));
  return entete + "." + charge + "." + b64u(sig);
}

// Corps chiffré pour UN abonnement (un seul enregistrement, sans remplissage).
export async function chiffrer(abo: Abonnement, message: Uint8Array, sel?: Uint8Array,
                               ephemere?: CryptoKeyPair): Promise<Uint8Array> {
  const uaPublique = deb64u(abo.keys.p256dh);
  const secretAuth = deb64u(abo.keys.auth);
  const paire = ephemere ?? await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublique = new Uint8Array(await crypto.subtle.exportKey("raw", paire.publicKey));
  const cleUa = await crypto.subtle.importKey("raw", uaPublique, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secretEcdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: cleUa }, paire.privateKey, 256));

  // IKM = HKDF(auth, ecdh, "WebPush: info" || 0 || ua || as)
  const prkCle = await hmac(secretAuth, secretEcdh);
  const ikm = await hmac(prkCle, concat(te.encode("WebPush: info\0"), uaPublique, asPublique, new Uint8Array([1])));
  const salt = sel ?? crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(te.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(te.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);

  const cleAes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce }, cleAes, concat(message, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]);   // taille d'enregistrement : 4096
  return concat(salt, rs, new Uint8Array([asPublique.length]), asPublique, chiffre);
}

// Envoie une notification. Renvoie le code HTTP du service de push :
// 404 / 410 signifient que l'abonnement n'existe plus (à supprimer).
export async function envoyer(abo: Abonnement, charge: unknown, cles: ClesVapid, contact: string): Promise<number> {
  const corps = await chiffrer(abo, te.encode(JSON.stringify(charge)));
  const audience = new URL(abo.endpoint).origin;
  const rep = await fetch(abo.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "high",
      "Authorization": "vapid t=" + await jetonVapid(audience, cles, contact) + ", k=" + cles.publique,
    },
    body: corps,
  });
  try { await rep.arrayBuffer(); } catch { /* corps ignoré */ }
  return rep.status;
}

export const _interne = { jetonVapid };
