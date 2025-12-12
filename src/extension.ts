import * as vscode from 'vscode';
import { JiraHelper } from './helpers/jiraHelper';
import { ConfluenceHelper } from './helpers/confluenceHelper';
import { loadAtlassianConfig, validateAtlassianConfig } from './utils/configLoader';
import { registerJiraTools } from './tools/jiraTools';
import { registerConfluenceTools } from './tools/confluenceTools';
import { JiraTreeProvider } from './ui/JiraTreeProvider';
import { ConfluenceTreeProvider } from './ui/ConfluenceTreeProvider';
import { registerJiraCommands } from './commands/jiraCommands';
import { registerConfluenceCommands } from './commands/confluenceCommands';

export function activate(context: vscode.ExtensionContext) {
    console.log('Atlassian Tools extension is now active');

    const config = loadAtlassianConfig();

    const jiraHelper = config && validateAtlassianConfig(config) 
        ? new JiraHelper(config)
        : null;

    const confluenceHelper = config && validateAtlassianConfig(config)
        ? new ConfluenceHelper(config)
        : null;

    if (!jiraHelper || !confluenceHelper) {
        console.warn('Atlassian Tools: Configuration not found or invalid. Please configure Jira and Confluence settings.');
    }

    // Register language-model tools
    registerJiraTools(context, jiraHelper);
    registerConfluenceTools(context, confluenceHelper);

    // Register tree providers
    const jiraTreeProvider = new JiraTreeProvider(jiraHelper);
    const confluenceTreeProvider = new ConfluenceTreeProvider(confluenceHelper);

    vscode.window.registerTreeDataProvider('jiraTreeView', jiraTreeProvider);
    vscode.window.registerTreeDataProvider('confluenceTreeView', confluenceTreeProvider);

    // Register UI commands (includes refresh commands)
    registerJiraCommands(context, jiraHelper, jiraTreeProvider);
    registerConfluenceCommands(context, confluenceHelper, confluenceTreeProvider);
    
    console.log('Atlassian Tools: All tools, tree providers, and commands registered successfully');
}

export function deactivate() {}
