export interface ClaspConfig {
  token: {
    access_token: string;
    refresh_token: string;
    scope: string;
    token_type: string;
    expiry_date: number;
  };
  oauth2ClientSettings: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
}

export function validateClaspConfig(content: string): boolean {
  try {
    const config = JSON.parse(content) as Partial<ClaspConfig>;
    return !!(
      config.token?.access_token &&
      config.token?.refresh_token &&
      config.oauth2ClientSettings?.clientId &&
      config.oauth2ClientSettings?.clientSecret
    );
  } catch {
    return false;
  }
}

export interface ClaspProjectConfig {
  scriptId: string;
  rootDir?: string;
  projectId?: string;
  parentId?: string[];
}

export function validateClaspProjectConfig(content: string): boolean {
  try {
    const config = JSON.parse(content) as Partial<ClaspProjectConfig>;
    return !!config.scriptId;
  } catch {
    return false;
  }
}
