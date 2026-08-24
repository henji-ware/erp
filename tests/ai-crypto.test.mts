import { test } from "node:test";
import assert from "node:assert/strict";
import {
  encryptSecret,
  decryptSecret,
  secretHint,
  MissingEncryptionSecret,
} from "../lib/ai/crypto.ts";

const SEGREDO = "segredo-mestre-de-teste-nao-usar-em-producao";
const CHAVE = "sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

test("o texto cifrado não contém a chave em lugar nenhum", () => {
  // O ponto da funcionalidade: um dump do banco não pode entregar a chave.
  const cifrado = encryptSecret(CHAVE, SEGREDO);
  assert.ok(!cifrado.includes(CHAVE));
  assert.ok(!cifrado.includes("sk-ant"));
  assert.ok(!cifrado.includes("ABCDEFGH"));
});

test("cifra e decifra devolve o original", () => {
  assert.equal(decryptSecret(encryptSecret(CHAVE, SEGREDO), SEGREDO), CHAVE);
});

test("cifrar duas vezes gera saídas diferentes", () => {
  // O IV é sorteado a cada chamada. Se fosse fixo, chaves iguais gerariam
  // cifras iguais — e em GCM reusar IV quebra a cifra por completo, não é
  // só um detalhe de aparência.
  const a = encryptSecret(CHAVE, SEGREDO);
  const b = encryptSecret(CHAVE, SEGREDO);
  assert.notEqual(a, b);
  assert.equal(decryptSecret(a, SEGREDO), CHAVE);
  assert.equal(decryptSecret(b, SEGREDO), CHAVE);
});

test("segredo errado não decifra — devolve null, não lixo", () => {
  const cifrado = encryptSecret(CHAVE, SEGREDO);
  assert.equal(decryptSecret(cifrado, "outro-segredo-qualquer"), null);
});

test("conteúdo adulterado é recusado", () => {
  // GCM autentica além de cifrar: mexer num byte da cifra tem que falhar,
  // não devolver um texto parcialmente decifrado.
  const cifrado = encryptSecret(CHAVE, SEGREDO);
  const partes = cifrado.split(".");

  const mexido = [...partes];
  const dados = Buffer.from(partes[3], "base64url");
  dados[0] = dados[0] ^ 0xff;
  mexido[3] = dados.toString("base64url");
  assert.equal(decryptSecret(mexido.join("."), SEGREDO), null);

  // Trocar a tag de autenticação também.
  const tagTrocada = [...partes];
  tagTrocada[2] = Buffer.alloc(16).toString("base64url");
  assert.equal(decryptSecret(tagTrocada.join("."), SEGREDO), null);
});

test("payload malformado devolve null em vez de estourar", () => {
  // A decifragem roda no meio de uma pergunta no chat: a reação certa a
  // "não consegui ler" é seguir sem a chave, não derrubar a requisição.
  for (const v of ["", "lixo", "v1.a.b", "v1.a.b.c.d", "v2.a.b.c", "....", "v1...."]) {
    assert.equal(decryptSecret(v, SEGREDO), null, `deveria recusar: ${JSON.stringify(v)}`);
  }
  assert.equal(decryptSecret(undefined as unknown as string, SEGREDO), null);
});

test("o formato carrega a versão, para poder trocar o algoritmo depois", () => {
  assert.ok(encryptSecret(CHAVE, SEGREDO).startsWith("v1."));
});

test("aguenta chave vazia, longa e com acento", () => {
  for (const v of ["", "x", "á é í õ ç 日本語", "k".repeat(4000)]) {
    assert.equal(decryptSecret(encryptSecret(v, SEGREDO), SEGREDO), v);
  }
});

test("sem segredo configurado, cifrar falha de forma explícita", () => {
  const antesDedicado = process.env.AI_ENCRYPTION_KEY;
  const antesSessao = process.env.SESSION_SECRET;
  delete process.env.AI_ENCRYPTION_KEY;
  delete process.env.SESSION_SECRET;
  try {
    // Guardar sem cifrar seria pior que não guardar: melhor recusar.
    assert.throws(() => encryptSecret(CHAVE), MissingEncryptionSecret);
    assert.equal(decryptSecret("v1.a.b.c"), null);
  } finally {
    if (antesDedicado !== undefined) process.env.AI_ENCRYPTION_KEY = antesDedicado;
    if (antesSessao !== undefined) process.env.SESSION_SECRET = antesSessao;
  }
});

test("a dica mostra só os últimos caracteres", () => {
  assert.equal(secretHint(CHAVE), "6789");
  assert.equal(secretHint("abcd"), "••••", "chave curta não vira dica útil");
  assert.equal(secretHint("ab"), "••••");
  assert.equal(secretHint("  sk-teste-XYZW  "), "XYZW", "ignora espaços nas pontas");
});
