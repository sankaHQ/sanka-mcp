export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported?: string[] | undefined;
  resource_name?: string | undefined;
  scopes_supported?: string[] | undefined;
};

export function buildProtectedResourceMetadata({
  resource,
  authorizationServerUrl,
  resourceName,
  scopesSupported,
}: {
  resource: string;
  authorizationServerUrl: string;
  resourceName?: string | undefined;
  scopesSupported?: string[] | undefined;
}): ProtectedResourceMetadata {
  return {
    resource,
    authorization_servers: [authorizationServerUrl],
    bearer_methods_supported: ['header'],
    ...(resourceName ? { resource_name: resourceName } : {}),
    ...(scopesSupported && scopesSupported.length > 0 ? { scopes_supported: scopesSupported } : {}),
  };
}
