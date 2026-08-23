export const REMEMBER_ME_COOKIE = "k9-remember-me";
export const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 400;

type CookieWriteOptions = {
  path?: string;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
  maxAge?: number;
  expires?: Date;
  domain?: string;
  httpOnly?: boolean;
};

export function isRememberMeEnabled(value?: string | null) {
  return value !== "0";
}

export function rememberMeCookieOptions(remember: boolean): CookieWriteOptions {
  return remember
    ? { path: "/", sameSite: "lax", maxAge: REMEMBER_ME_MAX_AGE }
    : { path: "/", sameSite: "lax" };
}

export function withRememberMeCookieOptions<T extends CookieWriteOptions>(
  options: T | undefined,
  remember: boolean,
): T {
  const next = { ...(options ?? {}) } as T;
  next.path = next.path ?? "/";
  next.sameSite = next.sameSite ?? "lax";

  if (remember) {
    next.maxAge = next.maxAge ?? REMEMBER_ME_MAX_AGE;
    return next;
  }

  delete next.maxAge;
  delete next.expires;
  return next;
}

export function setRememberMePreference(remember: boolean) {
  if (typeof document === "undefined") return;
  const parts = [`${REMEMBER_ME_COOKIE}=${remember ? "1" : "0"}`, "Path=/", "SameSite=Lax"];
  if (remember) {
    parts.push(`Max-Age=${REMEMBER_ME_MAX_AGE}`);
  }
  if (window.location.protocol === "https:") {
    parts.push("Secure");
  }
  document.cookie = parts.join("; ");
}

export function readRememberMeFromDocument() {
  if (typeof document === "undefined") return true;
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${REMEMBER_ME_COOKIE}=`));
  return isRememberMeEnabled(match?.slice(`${REMEMBER_ME_COOKIE}=`.length));
}
