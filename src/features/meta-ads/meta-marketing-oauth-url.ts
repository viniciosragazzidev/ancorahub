const DEFAULT_META_APP_ID = "780859815090303";

export function createMetaMarketingOAuthUrl(input: {
  appId?: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.search = new URLSearchParams({
    client_id: input.appId || DEFAULT_META_APP_ID,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: "code",
    // Existing tokens do not receive new scopes retroactively. This asks Meta to
    // show any missing consent again without requesting campaign write access.
    auth_type: "rerequest",
    return_scopes: "true",
    scope: "pages_show_list,pages_read_engagement,pages_manage_metadata,leads_retrieval,ads_read",
  }).toString();

  // Cross-window APIs require a structured-cloneable primitive. A URL instance
  // is not valid message data in all browser/runtime combinations.
  return url.toString();
}
