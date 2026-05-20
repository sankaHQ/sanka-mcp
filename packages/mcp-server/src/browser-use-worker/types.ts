export type BrowserUseWorkflow = 'demo.hubspot.company_avatar';
export type BrowserUseDriver = 'agent_browser' | 'playwright' | 'browser_use_oss' | 'browser_use_cloud';

export type BrowserUseWorkerPayload = {
  workflow: BrowserUseWorkflow;
  driver?: BrowserUseDriver;
  dry_run?: boolean;
  confirm?: boolean;
  workspace_id?: string;
  reference_id?: string;
  input?: Record<string, unknown>;
  context?: {
    client_name?: string;
    client_version?: string;
    mcp_session_id?: string;
  };
};

export type BrowserUseWorkerResponse = {
  status: string;
  worker_run_id: string;
  workflow: BrowserUseWorkflow;
  driver: BrowserUseDriver;
  dry_run: boolean;
  confirm: boolean;
  result: Record<string, unknown>;
  warnings: string[];
  message: string;
};

export type BrowserCommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type BrowserDriverClient = {
  version(): Promise<string>;
  closeSession(session: string): Promise<BrowserCommandResult>;
  open(input: {
    session: string;
    profilePath: string;
    url: string;
    headed: boolean;
    timeoutMs: number;
  }): Promise<BrowserCommandResult>;
  getURL(input: { session: string; profilePath: string; timeoutMs: number }): Promise<BrowserCommandResult>;
  getTitle(input: { session: string; profilePath: string; timeoutMs: number }): Promise<BrowserCommandResult>;
  snapshot(input: { session: string; profilePath: string; timeoutMs: number }): Promise<BrowserCommandResult>;
  evaluate(input: {
    session: string;
    profilePath: string;
    script: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult>;
  click(input: {
    session: string;
    profilePath: string;
    selector: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult>;
  upload(input: {
    session: string;
    profilePath: string;
    selector: string;
    filePath: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult>;
  screenshot(input: {
    session: string;
    profilePath: string;
    outputPath: string;
    timeoutMs: number;
  }): Promise<BrowserCommandResult>;
};

export type HubSpotAvatarCompanyInput = {
  record_id?: string;
  record_url?: string;
  company_id?: string;
  name?: string;
  image_url?: string;
  image_file_url?: string;
  image_base64?: string;
  image_mime_type?: string;
  image_path?: string;
  filename?: string;
};

export type HubSpotAvatarWorkflowInput = {
  portal_id: string;
  browser_profile_id?: string;
  companies: HubSpotAvatarCompanyInput[];
};

export type BrowserUseWorkerConfig = {
  artifactDir: string;
  headed: boolean;
  profileRoot: string;
  requestTimeoutMs: number;
  workerToken?: string;
};
