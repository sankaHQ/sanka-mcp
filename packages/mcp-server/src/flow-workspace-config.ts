export function flowWorkspaceOrigin(): string | null {
  if (process.env['SANKA_MCP_FLOW_WORKSPACE_ENABLED'] !== '1') return null;
  try {
    const url = new URL(process.env['CHATGPT_WORKSPACE_ORIGIN'] || 'https://flow-chatgpt.sanka.com');
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    if (
      url.protocol !== 'https:' &&
      !(process.env['NODE_ENV'] !== 'production' && url.protocol === 'http:' && url.hostname === 'localhost')
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

// Optional while testing privately. A unique component origin is required for
// directory submission and must also be trusted by the embedded React app.
export function flowWidgetOrigin(): string | null {
  const value = process.env['SANKA_MCP_FLOW_WIDGET_ORIGIN'];
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === value && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}
