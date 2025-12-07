import * as vscode from 'vscode';
import { JiraHelper } from './helpers/jiraHelper';
import { ConfluenceHelper } from './helpers/confluenceHelper';
import { loadAtlassianConfig, validateAtlassianConfig } from './utils/configLoader';
import { registerJiraTools } from './tools/jiraTools';
import { registerConfluenceTools } from './tools/confluenceTools';

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

    registerJiraTools(context, jiraHelper);
    registerConfluenceTools(context, confluenceHelper);
    
    console.log('Atlassian Tools: All tools registered successfully');
}

export function deactivate() {}
