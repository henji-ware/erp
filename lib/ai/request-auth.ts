/** Cabeçalhos usados na listagem, no teste e na geração (inclusive streaming). */
export function geminiAuthHeaders(apiKey: string, authType?: "api-key" | "oauth", quotaProject?: string): Record<string, string> {
  if (authType === "oauth") {
    if (!quotaProject) throw new Error("Projeto Google não configurado. Reconecte sua conta.");
    return { Authorization: `Bearer ${apiKey}`, "x-goog-user-project": quotaProject };
  }
  return { "x-goog-api-key": apiKey };
}
