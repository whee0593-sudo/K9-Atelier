type VerificationClient = {
  auth: {
    verifyOtp: (credentials: { token_hash: string; type: "signup" }) => PromiseLike<{ error: unknown; data: { user: { email_confirmed_at?: string | null } | null } }>;
    setSession: (tokens: { access_token: string; refresh_token: string }) => PromiseLike<{ error: unknown; data: { user: { email_confirmed_at?: string | null } | null } }>;
  };
};

/** Isolated, non-persistent client: confirmation never creates a login cookie.
 * Only signup evidence is accepted; existing sessions cannot mask a bad token.
 */
export async function verifySignupLink(url: URL, createClient: () => VerificationClient): Promise<boolean> {
  const params = url.searchParams;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  if (params.has("error") || hash.has("error") || params.has("error_code") || hash.has("error_code")) return false;
  const type = params.get("type") ?? hash.get("type");
  if (type !== "signup") return false;
  try {
    const client = createClient();
    const tokenHash = params.get("token_hash");
    if (tokenHash) {
      const result = await client.auth.verifyOtp({ token_hash: tokenHash, type: "signup" });
      return !result.error && Boolean(result.data.user?.email_confirmed_at);
    }
    // Compatibility with existing ConfirmationURL templates after signup switches
    // to a non-PKCE client. Recovery links never enter this branch.
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");
    if (!access || !refresh) return false;
    const result = await client.auth.setSession({ access_token: access, refresh_token: refresh });
    return !result.error && Boolean(result.data.user?.email_confirmed_at);
  } catch {
    return false;
  }
}
