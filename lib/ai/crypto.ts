// Cifra dos segredos guardados no banco (hoje: chaves de API dos provedores).
//
// Por que cifrar em vez de guardar o texto puro: a chave de API é dinheiro —
// quem a tiver gasta a cota da empresa, e num provedor de IA isso escala
// rápido. Um dump do banco (backup vazado, acesso de leitura ao Postgres,
// print de uma consulta) não pode entregar a chave junto.
//
// AES-256-GCM: além de cifrar, autentica. Um byte alterado no banco faz a
// decifragem falhar em vez de devolver lixo silenciosamente.

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/** Prefixo de versão: permite trocar o algoritmo sem quebrar o que já existe. */
const V1 = "v1";
const IV_BYTES = 12; // 96 bits, o tamanho recomendado para GCM
const KEY_BYTES = 32; // AES-256

/**
 * Segredo mestre do servidor.
 *
 * `AI_ENCRYPTION_KEY` é o lugar certo. O fallback para `SESSION_SECRET` existe
 * para a funcionalidade não nascer morta em quem já tem o .env montado — mas
 * com uma consequência que precisa estar clara: girar o SESSION_SECRET (coisa
 * boa de se fazer) torna as chaves guardadas indecifráveis, e cada usuário
 * precisa cadastrar a dele de novo. Por isso a decifragem devolve `null` em
 * vez de estourar: o sistema continua de pé, só pede a chave outra vez.
 */
function masterSecret(): string | null {
  const dedicated = process.env.AI_ENCRYPTION_KEY?.trim();
  if (dedicated) return dedicated;
  const session = process.env.SESSION_SECRET?.trim();
  return session || null;
}

/**
 * Deriva a chave de 256 bits do segredo mestre.
 *
 * HKDF e não o segredo cru: o SESSION_SECRET pode ser uma frase curta, e usar
 * texto arbitrário direto como chave AES é erro clássico. O `info` separa o
 * uso — a mesma origem gera chaves diferentes para propósitos diferentes.
 */
function derive(secret: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), "drr-ai-credentials-v1", KEY_BYTES),
  );
}

export class MissingEncryptionSecret extends Error {
  constructor() {
    super(
      "Nenhum segredo de criptografia configurado. Defina AI_ENCRYPTION_KEY (ou SESSION_SECRET) no ambiente para guardar chaves de API.",
    );
    this.name = "MissingEncryptionSecret";
  }
}

/**
 * Cifra um segredo. Formato: `v1.<iv>.<tag>.<cifra>`, tudo em base64url.
 *
 * O IV é sorteado a cada chamada — reutilizar IV em GCM quebra a cifra por
 * completo, não é um detalhe estético.
 */
export function encryptSecret(plaintext: string, secret?: string): string {
  const master = secret ?? masterSecret();
  if (!master) throw new MissingEncryptionSecret();

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", derive(master), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [V1, iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

/**
 * Decifra. Devolve `null` para qualquer falha — payload malformado, segredo
 * trocado, conteúdo adulterado.
 *
 * Não lançar é deliberado: quem chama está no meio de responder uma pergunta
 * no chat, e a reação certa a "não consegui ler a chave" é seguir sem ela
 * (cai no .env, ou avisa que precisa cadastrar), não derrubar a requisição.
 */
export function decryptSecret(payload: string, secret?: string): string | null {
  const master = secret ?? masterSecret();
  if (!master || typeof payload !== "string") return null;

  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== V1) return null;

  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const data = Buffer.from(parts[3], "base64url");
    if (iv.length !== IV_BYTES || tag.length !== 16) return null;

    const decipher = createDecipheriv("aes-256-gcm", derive(master), iv);
    decipher.setAuthTag(tag);
    // `final()` é quem confere a tag: adulteração cai aqui.
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Há segredo configurado para guardar chaves? */
export function canStoreSecrets(): boolean {
  return masterSecret() !== null;
}

/**
 * Últimos caracteres da chave, para a tela confirmar QUAL chave está salva
 * sem nunca mostrar a chave. Guardado em claro no banco de propósito: quatro
 * caracteres não permitem reconstruir nada.
 */
export function secretHint(plaintext: string): string {
  const s = plaintext.trim();
  if (s.length <= 4) return "••••";
  return s.slice(-4);
}
