import fs from 'node:fs/promises';
import path from 'node:path';
import {
  BrowserDriverClient,
  BrowserUseWorkerConfig,
  BrowserUseWorkerPayload,
  BrowserUseWorkerResponse,
  HubSpotAvatarCompanyInput,
  HubSpotAvatarWorkflowInput,
} from './types';

type CandidateControl = {
  selector?: string;
  tag: string;
  text?: string;
  ariaLabel?: string;
  title?: string;
  accept?: string;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type ProbeResult = {
  fileInputs: CandidateControl[];
  avatarCandidates: CandidateControl[];
};

type CompanyRunResult = {
  record_id?: string;
  record_url?: string;
  name?: string;
  status: string;
  current_url?: string;
  title?: string;
  screenshot_path?: string;
  probe?: ProbeResult;
  upload_selector?: string;
  uploaded_selector?: string;
  message?: string;
};

const HUBSPOT_AVATAR_PROBE_SCRIPT = String.raw`
(() => {
  const fallbackSelectorFor = (el) => {
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentElement?.children || []).filter((sibling) => sibling.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? tag + ':nth-of-type(' + index + ')' : tag);
      current = current.parentElement;
    }
    return parts.length ? 'body > ' + parts.join(' > ') : undefined;
  };
  const selectorFor = (el) => {
    const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-selenium-test');
    if (testId) return '[' + (el.getAttribute('data-testid') ? 'data-testid' : el.getAttribute('data-test-id') ? 'data-test-id' : 'data-selenium-test') + '="' + CSS.escape(testId) + '"]';
    if (el.id) return '#' + CSS.escape(el.id);
    const name = el.getAttribute('name');
    if (name) return el.tagName.toLowerCase() + '[name="' + CSS.escape(name) + '"]';
    const aria = el.getAttribute('aria-label');
    if (aria) return el.tagName.toLowerCase() + '[aria-label="' + CSS.escape(aria) + '"]';
    return fallbackSelectorFor(el);
  };
  const serialize = (el) => {
    const rect = el.getBoundingClientRect();
    return {
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').trim().slice(0, 120) || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      title: el.getAttribute('title') || undefined,
      accept: el.getAttribute('accept') || undefined,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  };
  const isTopLeft = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0 && rect.x < 620 && rect.y < 360;
  };
  const avatarPattern = /avatar|photo|image|logo|picture|profile|画像|写真|アイコン|会社/i;
  const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).map(serialize);
  const avatarCandidates = Array.from(document.querySelectorAll('button,[role="button"],a,input,div[tabindex],span[tabindex]'))
    .filter(isTopLeft)
    .filter((el) => {
      const value = [
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.getAttribute('data-testid'),
        el.getAttribute('data-test-id'),
        el.className,
        el.id,
        el.innerText,
        el.textContent,
      ].join(' ');
      return avatarPattern.test(value);
    })
    .slice(0, 20)
    .map(serialize);
  return JSON.stringify({ fileInputs, avatarCandidates });
})()
`;

const HUBSPOT_AVATAR_FILE_CHOOSER_SCRIPT = String.raw`
(() => {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const fallbackSelectorFor = (el) => {
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentElement?.children || []).filter((sibling) => sibling.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      parts.unshift(siblings.length > 1 ? tag + ':nth-of-type(' + index + ')' : tag);
      current = current.parentElement;
    }
    return parts.length ? 'body > ' + parts.join(' > ') : undefined;
  };
  const selectorFor = (el) => {
    const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-selenium-test');
    if (testId) return '[' + (el.getAttribute('data-testid') ? 'data-testid' : el.getAttribute('data-test-id') ? 'data-test-id' : 'data-selenium-test') + '="' + CSS.escape(testId) + '"]';
    if (el.id) return '#' + CSS.escape(el.id);
    const aria = el.getAttribute('aria-label');
    if (aria) return el.tagName.toLowerCase() + '[aria-label="' + CSS.escape(aria) + '"]';
    return fallbackSelectorFor(el);
  };
  const serialize = (el) => {
    const rect = el.getBoundingClientRect();
    return {
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').trim().slice(0, 120),
      ariaLabel: el.getAttribute('aria-label') || undefined,
      role: el.getAttribute('role') || undefined,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  };
  const target = Array.from(document.querySelectorAll('button,[role="button"],label'))
    .filter(visible)
    .find((el) => {
      const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
      return /ファイルを選択|ファイルを選ぶ|Choose file|Select file|Browse/i.test(text);
    });
  return JSON.stringify({ found: Boolean(target), target: target ? serialize(target) : undefined });
})()
`;

const HUBSPOT_AVATAR_CLICK_SCRIPT = String.raw`
(() => {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0;
  };
  const serialize = (el) => {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      className: String(el.className || '').slice(0, 160),
      ariaLabel: el.getAttribute('aria-label') || undefined,
      role: el.getAttribute('role') || undefined,
      text: (el.innerText || el.textContent || '').trim().slice(0, 120) || undefined,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  };
  const score = (el) => {
    const rect = el.getBoundingClientRect();
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const distance = Math.hypot(centerX - 104, centerY - 126);
    const className = String(el.className || '');
    return distance - (/Avatar|avatar|profile|photo|image|logo/i.test(className) ? 80 : 0);
  };
  const candidates = Array.from(document.querySelectorAll('button,[role="button"],a,[tabindex],div,span'))
    .filter(visible)
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.x > 190 || rect.y > 190 || rect.x < 40 || rect.y < 70) return false;
      if (rect.width < 24 || rect.height < 24 || rect.width > 120 || rect.height > 120) return false;
      const value = [
        el.getAttribute('aria-label'),
        el.getAttribute('role'),
        el.getAttribute('title'),
        el.getAttribute('data-testid'),
        el.getAttribute('data-test-id'),
        el.className,
      ].join(' ');
      return /Avatar|avatar|photo|image|logo|picture|profile|画像|写真|アイコン|会社/i.test(value) || Boolean(el.querySelector('svg'));
    })
    .sort((a, b) => score(a) - score(b));
  const coordinateTarget = document.elementFromPoint(104, 126);
  const target =
    candidates[0] ||
    coordinateTarget?.closest('button,[role="button"],a,[tabindex],div,span') ||
    coordinateTarget;
  if (!target) {
    return JSON.stringify({ clicked: false, reason: 'avatar_target_not_found', candidateCount: candidates.length });
  }
  for (const eventName of ['mouseover', 'mouseenter', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    target.dispatchEvent(new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window }));
  }
  return JSON.stringify({
    clicked: true,
    candidateCount: candidates.length,
    target: serialize(target),
  });
})()
`;

const HUBSPOT_AVATAR_CONFIRM_SCRIPT = String.raw`
(() => {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const serialize = (el) => {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').trim().slice(0, 120),
      ariaLabel: el.getAttribute('aria-label') || undefined,
      role: el.getAttribute('role') || undefined,
      disabled: Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true',
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  };
  const buttons = Array.from(document.querySelectorAll('button,[role="button"]')).filter(visible);
  const target = buttons.find((el) => {
    const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
    const disabled = Boolean(el.disabled) || el.getAttribute('aria-disabled') === 'true';
    return !disabled && /^(確認|保存|適用|完了|Confirm|Save|Apply|Done)$/i.test(text);
  });
  if (!target) {
    return JSON.stringify({ clicked: false, reason: 'confirm_button_not_found', buttons: buttons.slice(-8).map(serialize) });
  }
  for (const eventName of ['mouseover', 'mouseenter', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    target.dispatchEvent(new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window }));
  }
  return JSON.stringify({ clicked: true, target: serialize(target) });
})()
`;

const HUBSPOT_AVATAR_UPLOAD_MENU_SCRIPT = String.raw`
(() => {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const serialize = (el) => {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').trim().slice(0, 120),
      ariaLabel: el.getAttribute('aria-label') || undefined,
      role: el.getAttribute('role') || undefined,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  };
  const target = Array.from(document.querySelectorAll('button,[role="button"],a'))
    .filter(visible)
    .find((el) => {
      const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim();
      return /画像をアップロード|写真をアップロード|Upload image|Upload photo|Upload logo/i.test(text);
    });
  if (!target) {
    return JSON.stringify({ clicked: false, reason: 'upload_menu_item_not_found' });
  }
  for (const eventName of ['mouseover', 'mouseenter', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    target.dispatchEvent(new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window }));
  }
  return JSON.stringify({ clicked: true, target: serialize(target) });
})()
`;

const sanitizeID = (value: string): string => value.replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '');

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const readBoolean = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const readPlainObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const errorResponse = ({
  confirm,
  driver,
  dryRun,
  message,
  result,
  runId,
  warnings,
}: {
  confirm: boolean;
  driver: BrowserUseWorkerResponse['driver'];
  dryRun: boolean;
  message: string;
  result?: Record<string, unknown>;
  runId: string;
  warnings?: string[];
}): BrowserUseWorkerResponse => ({
  status: 'failed',
  worker_run_id: runId,
  workflow: 'demo.hubspot.company_avatar',
  driver,
  dry_run: dryRun,
  confirm,
  result: result ?? {},
  warnings: warnings ?? [],
  message,
});

const normalizeCompany = (value: unknown): HubSpotAvatarCompanyInput | undefined => {
  const object = readPlainObject(value);
  if (!object) {
    return undefined;
  }
  const company: HubSpotAvatarCompanyInput = {};
  const recordId = readString(object['record_id'] ?? object['recordId']);
  if (recordId) company.record_id = recordId;
  const recordURL = readString(object['record_url'] ?? object['recordUrl']);
  if (recordURL) company.record_url = recordURL;
  const companyId = readString(object['company_id'] ?? object['companyId']);
  if (companyId) company.company_id = companyId;
  const name = readString(object['name']);
  if (name) company.name = name;
  const imageURL = readString(object['image_url'] ?? object['imageUrl']);
  if (imageURL) company.image_url = imageURL;
  const imageFileURL = readString(object['image_file_url'] ?? object['imageFileUrl']);
  if (imageFileURL) company.image_file_url = imageFileURL;
  const imageBase64 = readString(object['image_base64'] ?? object['imageBase64']);
  if (imageBase64) company.image_base64 = imageBase64;
  const imageMimeType = readString(object['image_mime_type'] ?? object['imageMimeType']);
  if (imageMimeType) company.image_mime_type = imageMimeType;
  const imagePath = readString(object['image_path'] ?? object['imagePath']);
  if (imagePath) company.image_path = imagePath;
  const filename = readString(object['filename']);
  if (filename) company.filename = filename;
  return company;
};

const normalizeInput = (input: unknown): HubSpotAvatarWorkflowInput | undefined => {
  const object = readPlainObject(input);
  if (!object) {
    return undefined;
  }
  const portalId = readString(object['portal_id'] ?? object['portalId']);
  const rawCompanies = Array.isArray(object['companies']) ? object['companies'] : undefined;
  if (!portalId || !rawCompanies) {
    return undefined;
  }
  const companies = rawCompanies
    .map((company) => normalizeCompany(company))
    .filter((company): company is HubSpotAvatarCompanyInput => Boolean(company));
  if (companies.length === 0) {
    return undefined;
  }
  const result: HubSpotAvatarWorkflowInput = {
    portal_id: portalId,
    companies,
  };
  const profileId = readString(object['browser_profile_id'] ?? object['browserProfileId']);
  if (profileId) {
    result.browser_profile_id = profileId;
  }
  return result;
};

const validateHubSpotURL = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' && url.hostname === 'app.hubspot.com' && url.pathname.includes('/record/0-2/')
    );
  } catch {
    return false;
  }
};

const isHubSpotRecordURL = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.hostname.endsWith('hubspot.com') && /\/record\/0-2\//.test(url.pathname);
  } catch {
    return false;
  }
};

const recordURLForCompany = (portalId: string, company: HubSpotAvatarCompanyInput): string | undefined => {
  if (company.record_url) {
    return company.record_url;
  }
  const recordId = company.record_id ?? company.company_id;
  if (!recordId) {
    return undefined;
  }
  return `https://app.hubspot.com/contacts/${encodeURIComponent(portalId)}/record/0-2/${encodeURIComponent(
    recordId,
  )}`;
};

const parseProbe = (value: string): ProbeResult => {
  const trimmed = value.trim();
  const firstParsed = JSON.parse(trimmed) as unknown;
  const parsed =
    typeof firstParsed === 'string' ?
      (JSON.parse(firstParsed) as Partial<ProbeResult>)
    : (firstParsed as Partial<ProbeResult>);
  return {
    fileInputs: Array.isArray(parsed.fileInputs) ? parsed.fileInputs : [],
    avatarCandidates: Array.isArray(parsed.avatarCandidates) ? parsed.avatarCandidates : [],
  };
};

const extensionForMime = (mimeType: string | undefined): string => {
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/svg+xml') return '.svg';
  if (mimeType === 'image/webp') return '.webp';
  return '.png';
};

const materializeImage = async ({
  artifactDir,
  company,
  runId,
}: {
  artifactDir: string;
  company: HubSpotAvatarCompanyInput;
  runId: string;
}): Promise<string | undefined> => {
  if (company.image_path) {
    return company.image_path;
  }
  const imageURL = company.image_file_url ?? company.image_url;
  const baseName = sanitizeID(company.record_id ?? company.company_id ?? company.name ?? 'company');
  if (company.image_base64) {
    const filePath = path.join(artifactDir, runId, `${baseName}${extensionForMime(company.image_mime_type)}`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(company.image_base64, 'base64'));
    return filePath;
  }
  if (imageURL) {
    const response = await fetch(imageURL);
    if (!response.ok) {
      throw new Error(`Image download failed with HTTP ${response.status}: ${imageURL}`);
    }
    const mimeType = response.headers.get('content-type') ?? undefined;
    const filePath = path.join(artifactDir, runId, `${baseName}${extensionForMime(mimeType)}`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    return filePath;
  }
  return undefined;
};

const probeUploadSelector = async ({
  driver,
  probe,
  profilePath,
  recordResult,
  recordURL,
  session,
  warnings,
}: {
  driver: BrowserDriverClient;
  probe: ProbeResult;
  profilePath: string;
  recordResult: CompanyRunResult;
  recordURL: string;
  session: string;
  warnings: string[];
}): Promise<string | undefined> => {
  let uploadSelector = probe.fileInputs.find((inputControl) => inputControl.selector)?.selector;
  if (uploadSelector) {
    recordResult.upload_selector = uploadSelector;
    return uploadSelector;
  }

  const clickProbeOutput = await driver.evaluate({
    session,
    profilePath,
    script: HUBSPOT_AVATAR_CLICK_SCRIPT,
    timeoutMs: 20000,
  });
  if (clickProbeOutput.exitCode !== 0) {
    warnings.push(
      `Failed to click HubSpot avatar control for ${recordURL}: ${
        clickProbeOutput.stderr || clickProbeOutput.stdout || 'agent-browser eval failed'
      }`,
    );
  } else if (clickProbeOutput.stdout.trim()) {
    recordResult.message = `avatar click probe: ${clickProbeOutput.stdout.trim()}`;
  }

  const postClickProbeOutput = await driver.evaluate({
    session,
    profilePath,
    script: HUBSPOT_AVATAR_PROBE_SCRIPT,
    timeoutMs: 20000,
  });
  if (postClickProbeOutput.exitCode === 0 && postClickProbeOutput.stdout.trim()) {
    try {
      const postClickProbe = parseProbe(postClickProbeOutput.stdout);
      recordResult.probe = postClickProbe;
      uploadSelector = postClickProbe.fileInputs.find((inputControl) => inputControl.selector)?.selector;
    } catch (error) {
      warnings.push(`Failed to parse post-click HubSpot avatar probe for ${recordURL}: ${String(error)}`);
    }
  }
  if (!uploadSelector) {
    const uploadMenuOutput = await driver.evaluate({
      session,
      profilePath,
      script: HUBSPOT_AVATAR_UPLOAD_MENU_SCRIPT,
      timeoutMs: 20000,
    });
    if (uploadMenuOutput.exitCode !== 0) {
      warnings.push(
        `Failed to click HubSpot avatar upload menu item for ${recordURL}: ${
          uploadMenuOutput.stderr || uploadMenuOutput.stdout || 'agent-browser eval failed'
        }`,
      );
    } else if (uploadMenuOutput.stdout.trim()) {
      recordResult.message = `avatar upload menu probe: ${uploadMenuOutput.stdout.trim()}`;
    }

    const postMenuProbeOutput = await driver.evaluate({
      session,
      profilePath,
      script: HUBSPOT_AVATAR_PROBE_SCRIPT,
      timeoutMs: 20000,
    });
    if (postMenuProbeOutput.exitCode === 0 && postMenuProbeOutput.stdout.trim()) {
      try {
        const postMenuProbe = parseProbe(postMenuProbeOutput.stdout);
        recordResult.probe = postMenuProbe;
        uploadSelector = postMenuProbe.fileInputs.find((inputControl) => inputControl.selector)?.selector;
      } catch (error) {
        warnings.push(`Failed to parse post-menu HubSpot avatar probe for ${recordURL}: ${String(error)}`);
      }
    }
  }
  if (!uploadSelector) {
    const fileChooserOutput = await driver.evaluate({
      session,
      profilePath,
      script: HUBSPOT_AVATAR_FILE_CHOOSER_SCRIPT,
      timeoutMs: 20000,
    });
    if (fileChooserOutput.exitCode !== 0) {
      warnings.push(
        `Failed to detect HubSpot avatar file chooser button for ${recordURL}: ${
          fileChooserOutput.stderr || fileChooserOutput.stdout || 'agent-browser eval failed'
        }`,
      );
    } else if (fileChooserOutput.stdout.trim()) {
      try {
        const fileChooserResult = parseFileChooserResult(fileChooserOutput.stdout);
        recordResult.message = `avatar file chooser probe: ${fileChooserResult.raw}`;
        uploadSelector = fileChooserResult.selector;
      } catch (error) {
        warnings.push(`Failed to parse HubSpot avatar file chooser probe for ${recordURL}: ${String(error)}`);
      }
    }
  }
  if (uploadSelector) {
    recordResult.upload_selector = uploadSelector;
  }
  return uploadSelector;
};

const parseFileChooserResult = (value: string): { selector?: string; raw: string } => {
  const raw = value.trim();
  if (!raw) {
    return { raw };
  }
  const parsed = JSON.parse(raw) as unknown;
  const object =
    typeof parsed === 'string' ?
      (JSON.parse(parsed) as Record<string, unknown>)
    : (parsed as Record<string, unknown>);
  const target = readPlainObject(object['target']);
  const selector = readString(target?.['selector']);
  return {
    ...(selector ? { selector } : undefined),
    raw: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
  };
};

const parseClickedResult = (value: string): { clicked: boolean; raw: string } => {
  const raw = value.trim();
  if (!raw) {
    return { clicked: false, raw };
  }
  const parsed = JSON.parse(raw) as unknown;
  const object =
    typeof parsed === 'string' ?
      (JSON.parse(parsed) as Record<string, unknown>)
    : (parsed as Record<string, unknown>);
  return {
    clicked: object['clicked'] === true,
    raw: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
  };
};

const clickHubSpotAvatarConfirm = async ({
  driver,
  profilePath,
  session,
}: {
  driver: BrowserDriverClient;
  profilePath: string;
  session: string;
}): Promise<{ clicked: boolean; raw: string }> => {
  let lastResult = { clicked: false, raw: '' };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await driver.evaluate({
      session,
      profilePath,
      script: HUBSPOT_AVATAR_CONFIRM_SCRIPT,
      timeoutMs: 20000,
    });
    if (result.exitCode !== 0) {
      lastResult = { clicked: false, raw: result.stderr || result.stdout || 'agent-browser eval failed' };
    } else {
      try {
        lastResult = parseClickedResult(result.stdout);
      } catch {
        lastResult = { clicked: false, raw: result.stdout.trim() };
      }
      if (lastResult.clicked) {
        return lastResult;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return lastResult;
};

export const runHubSpotAvatarWorkflow = async ({
  config,
  driver,
  payload,
  runId,
}: {
  config: BrowserUseWorkerConfig;
  driver: BrowserDriverClient;
  payload: BrowserUseWorkerPayload;
  runId: string;
}): Promise<BrowserUseWorkerResponse> => {
  const dryRun = readBoolean(payload.dry_run) ?? true;
  const confirm = readBoolean(payload.confirm) ?? false;
  const driverName = payload.driver ?? 'agent_browser';
  const input = normalizeInput(payload.input);
  const warnings = [
    'HubSpot company avatar is a UI-only workflow because hs_avatar_filemanager_key is read-only through public CRM APIs.',
  ];

  if (!input) {
    return errorResponse({
      confirm,
      driver: driverName,
      dryRun,
      message: 'Invalid demo.hubspot.company_avatar input.',
      runId,
      warnings,
    });
  }
  if (!dryRun && !confirm) {
    return errorResponse({
      confirm,
      driver: driverName,
      dryRun,
      message: 'confirm=true is required when dry_run=false.',
      runId,
      warnings,
    });
  }

  const profileId = sanitizeID(input.browser_profile_id ?? `hubspot-${input.portal_id}`);
  const profilePath = path.resolve(config.profileRoot, profileId);
  const session = `hubspot-avatar-${sanitizeID(runId)}`;
  await fs.mkdir(path.join(config.artifactDir, runId), { recursive: true });
  await fs.mkdir(profilePath, { recursive: true });

  const agentBrowserVersion = await driver.version();
  const records: CompanyRunResult[] = [];
  let updated = 0;
  let failed = 0;
  let loginRequired = false;

  try {
    for (const company of input.companies) {
      const recordURL = recordURLForCompany(input.portal_id, company);
      const recordResult: CompanyRunResult = {
        ...(company.record_id ? { record_id: company.record_id } : undefined),
        ...(company.name ? { name: company.name } : undefined),
        ...(recordURL ? { record_url: recordURL } : undefined),
        status: 'pending',
      };
      records.push(recordResult);
      if (!recordURL || !validateHubSpotURL(recordURL)) {
        recordResult.status = 'invalid_record_url';
        failed += 1;
        continue;
      }

      const openResult = await driver.open({
        session,
        profilePath,
        url: recordURL,
        headed: config.headed,
        timeoutMs: config.requestTimeoutMs,
      });

      const currentURLResult = await driver.getURL({ session, profilePath, timeoutMs: 15000 });
      const titleResult = await driver.getTitle({ session, profilePath, timeoutMs: 15000 });
      const currentURL = currentURLResult.stdout.trim();
      const title = titleResult.stdout.trim();
      recordResult.current_url = currentURL;
      recordResult.title = title;
      if (openResult.exitCode !== 0) {
        if (!isHubSpotRecordURL(currentURL)) {
          recordResult.status = 'open_failed';
          recordResult.message = openResult.stderr || openResult.stdout || 'agent-browser open failed';
          failed += 1;
          continue;
        }
        warnings.push(
          `agent-browser open returned a non-zero exit for ${recordURL}, but the browser reached the record URL; continuing with probe.`,
        );
      }
      if (/\/login|\/signin|app\.hubspot\.com\/login/i.test(currentURL)) {
        recordResult.status = 'login_required';
        recordResult.message = `Open this profile locally and log in to HubSpot: ${profilePath}`;
        loginRequired = true;
        failed += 1;
        continue;
      }

      const probeOutput = await driver.evaluate({
        session,
        profilePath,
        script: HUBSPOT_AVATAR_PROBE_SCRIPT,
        timeoutMs: 20000,
      });
      let probe: ProbeResult = { fileInputs: [], avatarCandidates: [] };
      if (probeOutput.exitCode === 0 && probeOutput.stdout.trim()) {
        try {
          probe = parseProbe(probeOutput.stdout);
        } catch (error) {
          warnings.push(`Failed to parse HubSpot avatar probe for ${recordURL}: ${String(error)}`);
        }
      }
      recordResult.probe = probe;

      const uploadSelector = await probeUploadSelector({
        driver,
        probe,
        profilePath,
        recordResult,
        recordURL,
        session,
        warnings,
      });

      const screenshotPath = path.join(
        config.artifactDir,
        runId,
        `${sanitizeID(company.record_id ?? company.company_id ?? company.name ?? 'company')}.png`,
      );
      const screenshotResult = await driver.screenshot({
        session,
        profilePath,
        outputPath: screenshotPath,
        timeoutMs: 20000,
      });
      if (screenshotResult.exitCode === 0) {
        recordResult.screenshot_path = screenshotPath;
      }

      if (dryRun) {
        if (!uploadSelector) {
          recordResult.status = 'avatar_upload_control_not_found';
          recordResult.message =
            recordResult.message ??
            'No file input was detected after opening the HubSpot avatar upload control.';
          failed += 1;
          continue;
        }
        recordResult.status = 'validated';
        continue;
      }

      const imagePath = await materializeImage({ artifactDir: config.artifactDir, company, runId });
      if (!imagePath) {
        recordResult.status = 'missing_image_source';
        failed += 1;
        continue;
      }

      if (!uploadSelector) {
        recordResult.status = 'avatar_upload_control_not_found';
        recordResult.message =
          'No file input or stable avatar edit control was detected. Inspect the screenshot artifact and add a selector for this HubSpot UI state.';
        failed += 1;
        continue;
      }

      const uploadResult = await driver.upload({
        session,
        profilePath,
        selector: uploadSelector,
        filePath: imagePath,
        timeoutMs: config.requestTimeoutMs,
      });
      if (uploadResult.exitCode !== 0) {
        recordResult.status = 'upload_failed';
        recordResult.message = uploadResult.stderr || uploadResult.stdout || 'agent-browser upload failed';
        failed += 1;
        continue;
      }

      const confirmResult = await clickHubSpotAvatarConfirm({
        driver,
        profilePath,
        session,
      });
      if (!confirmResult.clicked) {
        recordResult.status = 'avatar_confirm_failed';
        recordResult.message = `HubSpot avatar upload did not expose a clickable confirmation button: ${confirmResult.raw}`;
        failed += 1;
        continue;
      }

      recordResult.status = 'updated';
      recordResult.uploaded_selector = uploadSelector;
      recordResult.message = `avatar confirm probe: ${confirmResult.raw}`;
      updated += 1;
    }
  } finally {
    await driver.closeSession(session).catch(() => undefined);
  }

  const status =
    loginRequired ? 'login_required'
    : failed > 0 && updated > 0 ? 'partial'
    : failed > 0 ? 'failed'
    : dryRun ? 'validated'
    : 'completed';

  return {
    status,
    worker_run_id: runId,
    workflow: 'demo.hubspot.company_avatar',
    driver: driverName,
    dry_run: dryRun,
    confirm,
    result: {
      portal_id: input.portal_id,
      browser_profile_id: profileId,
      profile_path: profilePath,
      agent_browser_version: agentBrowserVersion,
      company_count: input.companies.length,
      updated_count: updated,
      failed_count: failed,
      records,
      artifact_dir: path.join(config.artifactDir, runId),
    },
    warnings,
    message:
      dryRun ?
        `Validated ${input.companies.length} HubSpot company avatar target${
          input.companies.length === 1 ? '' : 's'
        }.`
      : `Updated ${updated} HubSpot company avatar${updated === 1 ? '' : 's'}; ${failed} failed.`,
  };
};
