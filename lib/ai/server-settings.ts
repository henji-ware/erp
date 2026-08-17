import { cookies } from "next/headers";
import { AI_SETTINGS_COOKIE, parseAISettings } from "./settings";
import { AISettingsData } from "./types";

export async function getServerAISettings(): Promise<AISettingsData> {
  const store = await cookies();
  const cookieVal = store.get(AI_SETTINGS_COOKIE)?.value;
  return parseAISettings(cookieVal);
}
