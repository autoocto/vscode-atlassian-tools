import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfluenceHelper } from '../helpers/confluenceHelper';
import { ConfluenceTreeItem, ConfluenceTreeProvider } from '../ui/ConfluenceTreeProvider';
import { ConfluencePageWebviewProvider } from '../ui/ConfluencePageWebviewProvider';
import * as yamlConverters from '../utils/confluenceYamlConverters';

export function registerConfluenceCommands(
    context: vscode.ExtensionContext,
    helper: ConfluenceHelper | null,
    treeProvider: ConfluenceTreeProvider
): void {
    const webviewProvider = helper ? new ConfluencePageWebviewProvider(helper) : null;
    // Open page in YAML editor
    const openPageYamlCommand = vscode.commands.registerCommand('confluence.openPageYaml', async (pageIdOrItem: string | ConfluenceTreeItem) => {
        if (!helper) {
            vscode.window.showErrorMessage('Confluence is not configured');
            return;
        }

        // Handle both string pageId and tree item
        const pageId = typeof pageIdOrItem === 'string' ? pageIdOrItem : (pageIdOrItem.itemId || pageIdOrItem.page?.id);
        
        if (!pageId) {
            vscode.window.showErrorMessage('No page ID provided');
            return;
        }

        try {
            const page = await helper.getPage(pageId, 'body.storage,space,version');
            const yamlContent = yamlConverters.pageToYaml(page);
            await openYamlDocument(yamlContent, pageId);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load page ${pageId}: ${error}`);
        }
    });

    // Open page (default command from tree) - shows both YAML editor and preview
    const openPageCommand = vscode.commands.registerCommand('confluence.openPage', async (pageId: string) => {
        // Open both YAML editor and preview
        vscode.commands.executeCommand('confluence.openPageYaml', pageId);
        
        if (webviewProvider) {
            await webviewProvider.showPage(pageId);
        }
    });

    // Create new page
    const createPageYamlCommand = vscode.commands.registerCommand('confluence.createPageYaml', async (spaceOrItem?: ConfluenceTreeItem) => {
        let spaceKey: string | undefined;

        if (spaceOrItem && spaceOrItem.contextValue === 'space') {
            spaceKey = spaceOrItem.spaceKey;
        } else {
            spaceKey = await vscode.window.showInputBox({
                prompt: 'Enter space key (e.g., SPACE)',
                placeHolder: 'SPACE'
            });
        }

        if (!spaceKey) {
            return;
        }

        const yamlContent = yamlConverters.newPageToYaml(spaceKey);
        await openYamlDocument(yamlContent, 'new');
    });

    // Save to Confluence
    const saveToConfluenceCommand = vscode.commands.registerCommand('confluence.saveToConfluence', async () => {
        if (!helper) {
            vscode.window.showErrorMessage('Confluence is not configured');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('.confluence.yaml')) {
            vscode.window.showErrorMessage('Please open a Confluence YAML file first');
            return;
        }

        try {
            const yamlContent = editor.document.getText();
            const pageData = yamlConverters.yamlToPage(yamlContent);
            const extracted = yamlConverters.extractPageContent(yamlContent);

            if (pageData.id === 'new') {
                // Create new page
                if (!pageData.space?.key) {
                    vscode.window.showErrorMessage('Space key is required to create a page');
                    return;
                }

                const newPage = await helper.createPage(
                    pageData.space.key,
                    extracted.title,
                    extracted.content
                );

                vscode.window.showInformationMessage(`Created page: ${newPage.title}`);
                
                // Reopen with the new page ID
                vscode.commands.executeCommand('confluence.openPageYaml', newPage.id);
            } else if (pageData.id) {
                // Update existing page
                await helper.updatePage(
                    pageData.id,
                    extracted.title,
                    extracted.content,
                    extracted.version
                );
                
                vscode.window.showInformationMessage(`Updated page: ${extracted.title}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save to Confluence: ${error}`);
        }
    });

    // Refresh tree
    const refreshTreeCommand = vscode.commands.registerCommand('confluence.refreshTree', () => {
        treeProvider.refresh();
        vscode.window.showInformationMessage('Confluence tree refreshed');
    });

    // Add comment
    const addCommentCommand = vscode.commands.registerCommand('confluence.addComment', async (pageIdOrItem: string | ConfluenceTreeItem) => {
        if (!helper) {
            vscode.window.showErrorMessage('Confluence is not configured');
            return;
        }

        const pageId = typeof pageIdOrItem === 'string' ? pageIdOrItem : pageIdOrItem.itemId;
        
        if (!pageId) {
            vscode.window.showErrorMessage('No page ID provided');
            return;
        }

        const comment = await vscode.window.showInputBox({
            prompt: `Add comment to page`,
            placeHolder: 'Enter your comment...'
        });

        if (!comment) {
            return;
        }

        try {
            await helper.createFooterComment(pageId, comment);
            vscode.window.showInformationMessage(`Comment added to page`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add comment: ${error}`);
        }
    });

    // Delete page
    const deletePageCommand = vscode.commands.registerCommand('confluence.deletePage', async (pageIdOrItem: string | ConfluenceTreeItem) => {
        if (!helper) {
            vscode.window.showErrorMessage('Confluence is not configured');
            return;
        }

        const pageId = typeof pageIdOrItem === 'string' ? pageIdOrItem : pageIdOrItem.itemId;
        
        if (!pageId) {
            vscode.window.showErrorMessage('No page ID provided');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to delete this page?',
            { modal: true },
            'Delete'
        );

        if (confirm !== 'Delete') {
            return;
        }

        try {
            await helper.deletePage(pageId);
            vscode.window.showInformationMessage('Page deleted');
            vscode.commands.executeCommand('confluence.refreshTree');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete page: ${error}`);
        }
    });

    context.subscriptions.push(
        openPageYamlCommand,
        openPageCommand,
        createPageYamlCommand,
        saveToConfluenceCommand,
        refreshTreeCommand,
        addCommentCommand,
        deletePageCommand
    );
}

async function openYamlDocument(content: string, pageId: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first');
        return;
    }

    // Create a .confluence directory if it doesn't exist
    const confluenceDir = path.join(workspaceFolder.uri.fsPath, '.confluence');
    
    try {
        await fs.mkdir(confluenceDir, { recursive: true });
    } catch (error) {
        // Directory might already exist, ignore
    }

    // Use page ID in filename
    const filename = `page-${pageId}.confluence.yaml`;
    const filePath = path.join(confluenceDir, filename);
    
    // Write the content to the file (overwrite if exists)
    await fs.writeFile(filePath, content, 'utf8');
    
    // Open the file
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc, { preview: false });
}
