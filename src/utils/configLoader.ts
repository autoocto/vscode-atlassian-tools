export interface AtlassianConfig {
    baseUrl: string;
    email: string;
    apiToken: string;
}

/**
 * Load Atlassian configuration from VS Code settings or environment variables
 */
export function loadAtlassianConfig(): AtlassianConfig | null {
    let atlassianBaseUrl = '';
    let atlassianEmail = '';
    let atlassianApiToken = '';

    // Try to load from VS Code settings first (if running in VS Code)
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const vscode = require('vscode');
        const config = vscode.workspace.getConfiguration('atlassianTools');
        
        atlassianBaseUrl = config.get('atlassianBaseUrl') || '';
        atlassianEmail = config.get('atlassianEmail') || '';
        atlassianApiToken = config.get('atlassianApiToken') || '';
    } catch {
        // Not in VS Code context, ignore
    }

    // Fall back to environment variables
    atlassianBaseUrl = atlassianBaseUrl || process.env.ATLASSIAN_BASE_URL || '';
    atlassianEmail = atlassianEmail || process.env.ATLASSIAN_EMAIL || '';
    atlassianApiToken = atlassianApiToken || process.env.ATLASSIAN_API_TOKEN || '';
    
    if (!atlassianBaseUrl || !atlassianEmail || !atlassianApiToken) {
        return null;
    }

    return {
        baseUrl: atlassianBaseUrl,
        email: atlassianEmail,
        apiToken: atlassianApiToken
    };
}

/**
 * Validate Atlassian configuration
 */
export function validateAtlassianConfig(config: AtlassianConfig | null): boolean {
    if (!config) {
        return false;
    }

    if (!config.baseUrl || !config.email || !config.apiToken) {
        return false;
    }

    return true;
}
