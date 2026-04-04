export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[] | undefined;
};

export function buildProtectedResourceMetadata({
  resource,
  authorizationServerUrl,
  scopesSupported,
}: {
  resource: string;
  authorizationServerUrl: string;
  scopesSupported?: string[] | undefined;
}): ProtectedResourceMetadata {
  return {
    resource,
    authorization_servers: [authorizationServerUrl],
    ...(scopesSupported && scopesSupported.length > 0 ? { scopes_supported: scopesSupported } : {}),
  };
}
