import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { JiraHelper } from '../helpers/jiraHelper';
import { JiraTreeItem, JiraTreeProvider } from '../ui/JiraTreeProvider';
import { JiraIssueWebviewProvider } from '../ui/JiraIssueWebviewProvider';
import * as yamlConverters from '../utils/jiraYamlConverters';

export function registerJiraCommands(
    context: vscode.ExtensionContext,
    helper: JiraHelper | null,
    treeProvider: JiraTreeProvider
): void {
    const webviewProvider = helper ? new JiraIssueWebviewProvider(helper) : null;
    
    // Watch for changes to YAML files and sync to preview
    const yamlWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.fileName.endsWith('.jira.yaml')) {
            // Extract issue key from filename
            const match = document.fileName.match(/([A-Z]+-\\d+)\\.jira\\.yaml$/);
            if (match && webviewProvider) {
                const issueKey = match[1];
                // Refresh the preview
                await JiraIssueWebviewProvider.syncFromYaml(issueKey);
            }
        }
    });
    
    // Open issue in YAML editor
    const openIssueYamlCommand = vscode.commands.registerCommand('jira.openIssueYaml', async (issueKeyOrItem: string | JiraTreeItem) => {
        if (!helper) {
            vscode.window.showErrorMessage('Jira is not configured');
            return;
        }

        const issueKey = typeof issueKeyOrItem === 'string' ? issueKeyOrItem : issueKeyOrItem.itemId;
        
        if (!issueKey) {
            vscode.window.showErrorMessage('No issue key provided');
            return;
        }

        try {
            const issue = await helper.getIssue(issueKey);
            const yamlContent = yamlConverters.issueToYaml(issue);
            const yamlUri = await openYamlDocument(yamlContent, issueKey);
            // Pass the yamlUri to webview for syncing
            if (webviewProvider && yamlUri) {
                await webviewProvider.showIssue(issueKey, yamlUri);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load issue ${issueKey}: ${error}`);
        }
    });

    // Open issue (default command from tree) - shows both YAML editor and preview
    const openIssueCommand = vscode.commands.registerCommand('jira.openIssue', async (issueKeyOrItem: string | JiraTreeItem) => {
        const issueKey = typeof issueKeyOrItem === 'string' ? issueKeyOrItem : issueKeyOrItem.itemId;
        
        if (!issueKey) {
            vscode.window.showErrorMessage('No issue key provided');
            return;
        }

        // Open both YAML editor and preview
        vscode.commands.executeCommand('jira.openIssueYaml', issueKey);
        
        if (webviewProvider) {
            await webviewProvider.showIssue(issueKey);
        }
    });

    // Create new issue
    const createIssueYamlCommand = vscode.commands.registerCommand('jira.createIssueYaml', async () => {
        const projectKey = await vscode.window.showInputBox({
            prompt: 'Enter project key (e.g., PROJ)',
            placeHolder: 'PROJ'
        });

        if (!projectKey) {
            return;
        }

        const yamlContent = yamlConverters.newIssueToYaml(projectKey);
        await openYamlDocument(yamlContent, 'new');
    });

    // Save to Jira
    const saveToJiraCommand = vscode.commands.registerCommand('jira.saveToJira', async () => {
        if (!helper) {
            vscode.window.showErrorMessage('Jira is not configured');
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || !editor.document.fileName.endsWith('.jira.yaml')) {
            vscode.window.showErrorMessage('Please open a Jira YAML file first');
            return;
        }

        try {
            const yamlContent = editor.document.getText();
            const issueData = yamlConverters.yamlToIssue(yamlContent);

            if (issueData.id === 'new' || issueData.key === 'NEW') {
                // Create new issue
                const yamlData = yamlConverters.extractIssueFields(yamlContent);
                const projectKey = yamlData.projectKey || await vscode.window.showInputBox({
                    prompt: 'Enter project key',
                    placeHolder: 'PROJ'
                });

                if (!projectKey) {
                    return;
                }

                const newIssue = await helper.createIssue(
                    projectKey,
                    yamlData.summary || 'New Issue',
                    yamlData.issuetype || 'Task',
                    yamlData.description
                );

                vscode.window.showInformationMessage(`Created issue: ${newIssue.key}`);
                
                // Reopen with the new issue key
                vscode.commands.executeCommand('jira.openIssueYaml', newIssue.key);
            } else if (issueData.key) {
                // Update existing issue
                const fields = yamlConverters.extractIssueFields(yamlContent);
                await helper.updateIssue(issueData.key, fields);
                
                // Save the document to clear the unsaved mark
                await editor.document.save();
                
                // Refresh the preview if open
                if (webviewProvider) {
                    await JiraIssueWebviewProvider.syncFromYaml(issueData.key);
                }
                
                vscode.window.showInformationMessage(`Updated issue: ${issueData.key}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save to Jira: ${error}`);
        }
    });

    // Refresh tree
    const refreshTreeCommand = vscode.commands.registerCommand('jira.refreshTree', () => {
        treeProvider.refresh();
        vscode.window.showInformationMessage('Jira tree refreshed');
    });

    // Add comment
    const addCommentCommand = vscode.commands.registerCommand('jira.addComment', async (issueKeyOrItem: string | JiraTreeItem) => {
        if (!helper) {
            vscode.window.showErrorMessage('Jira is not configured');
            return;
        }

        const issueKey = typeof issueKeyOrItem === 'string' ? issueKeyOrItem : issueKeyOrItem.itemId;
        
        if (!issueKey) {
            vscode.window.showErrorMessage('No issue key provided');
            return;
        }

        const comment = await vscode.window.showInputBox({
            prompt: `Add comment to ${issueKey}`,
            placeHolder: 'Enter your comment...'
        });

        if (!comment) {
            return;
        }

        try {
            await helper.addComment(issueKey, comment);
            vscode.window.showInformationMessage(`Comment added to ${issueKey}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add comment: ${error}`);
        }
    });

    // Transition issue
    const transitionIssueCommand = vscode.commands.registerCommand('jira.transitionIssue', async (issueKeyOrItem: string | JiraTreeItem) => {
        if (!helper) {
            vscode.window.showErrorMessage('Jira is not configured');
            return;
        }

        const issueKey = typeof issueKeyOrItem === 'string' ? issueKeyOrItem : issueKeyOrItem.itemId;
        
        if (!issueKey) {
            vscode.window.showErrorMessage('No issue key provided');
            return;
        }

        try {
            const transitions = await helper.getTransitions(issueKey);
            const transitionNames = transitions.transitions.map((t: any) => ({
                label: t.name,
                description: t.to?.name || '',
                id: t.id
            }));

            const selected = await vscode.window.showQuickPick(transitionNames, {
                placeHolder: 'Select new status'
            });

            if (!selected) {
                return;
            }

            await helper.transitionIssue(issueKey, (selected as any).id);
            vscode.window.showInformationMessage(`Transitioned ${issueKey} to ${(selected as any).label}`);
            
            // Refresh tree
            vscode.commands.executeCommand('jira.refreshTree');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to transition issue: ${error}`);
        }
    });

    context.subscriptions.push(
        openIssueYamlCommand,
        openIssueCommand,
        createIssueYamlCommand,
        saveToJiraCommand,
        refreshTreeCommand,
        addCommentCommand,
        transitionIssueCommand,
        yamlWatcher
    );
}

async function openYamlDocument(content: string, issueKey: string): Promise<vscode.Uri | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Please open a workspace folder first');
        return undefined;
    }

    // Create a .jira directory if it doesn't exist
    const jiraDir = path.join(workspaceFolder.uri.fsPath, '.jira');
    
    try {
        await fs.mkdir(jiraDir, { recursive: true });
    } catch (error) {
        // Directory might already exist, ignore
    }

    // Use issue key in filename
    const filename = `${issueKey}.jira.yaml`;
    const filePath = path.join(jiraDir, filename);
    
    // Write the content to the file (overwrite if exists)
    await fs.writeFile(filePath, content, 'utf8');
    
    // Open the file
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc, { preview: false });
    
    return doc.uri;
}
