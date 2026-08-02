import { cookies } from "next/headers";
import { LANG_COOKIE, normalizeLang, type Lang } from "./i18n";

/** Server-side: read the UI language from the cookie set by the toggle. */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  return normalizeLang(store.get(LANG_COOKIE)?.value);
}
