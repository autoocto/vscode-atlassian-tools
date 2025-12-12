import * as vscode from 'vscode';
import { ConfluenceHelper, ConfluencePage } from '../helpers/confluenceHelper';

export class ConfluencePageWebviewProvider {
    private static currentPanel: vscode.WebviewPanel | undefined;

    constructor(private helper: ConfluenceHelper) {}

    public async showPage(pageId: string): Promise<void> {
        const page = await this.helper.getPage(pageId, 'body.storage,body.view,space,version');

        if (ConfluencePageWebviewProvider.currentPanel) {
            ConfluencePageWebviewProvider.currentPanel.reveal(vscode.ViewColumn.Beside);
            ConfluencePageWebviewProvider.currentPanel.webview.html = this.getWebviewContent(page);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'confluencePagePreview',
                page.title,
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = this.getWebviewContent(page);

            panel.onDidDispose(() => {
                ConfluencePageWebviewProvider.currentPanel = undefined;
            });

            ConfluencePageWebviewProvider.currentPanel = panel;
        }
    }

    private getWebviewContent(page: ConfluencePage): string {
        const content = page.body?.view?.value || page.body?.storage?.value || '<p>No content</p>';
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(page.title)}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
        }
        h1 {
            color: var(--vscode-editor-foreground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .metadata {
            display: grid;
            grid-template-columns: 100px auto;
            gap: 10px;
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
            font-size: 13px;
        }
        .label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
        }
        .value {
            color: var(--vscode-foreground);
        }
        .content {
            margin-top: 20px;
            padding: 20px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 5px;
        }
        .content img {
            max-width: 100%;
            height: auto;
        }
        .content table {
            border-collapse: collapse;
            width: 100%;
            margin: 10px 0;
        }
        .content th, .content td {
            border: 1px solid var(--vscode-panel-border);
            padding: 8px;
            text-align: left;
        }
        .content th {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            font-weight: bold;
        }
        .content pre {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 3px;
            overflow-x: auto;
        }
        .content code {
            font-family: var(--vscode-editor-font-family);
        }
    </style>
</head>
<body>
    <h1>${this.escapeHtml(page.title)}</h1>
    
    <div class="metadata">
        <div class="label">Space:</div>
        <div class="value">${this.escapeHtml(page.space?.key || 'Unknown')}</div>
        
        <div class="label">Status:</div>
        <div class="value">${this.escapeHtml(page.status)}</div>
        
        <div class="label">Version:</div>
        <div class="value">${page.version?.number || 1}</div>
    </div>
    
    <div class="content">
        ${content}
    </div>
</body>
</html>`;
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
