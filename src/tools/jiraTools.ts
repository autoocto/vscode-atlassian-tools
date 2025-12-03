/* eslint-disable @typescript-eslint/no-unused-vars */
import * as vscode from 'vscode';
import { JiraHelper } from '../helpers/jiraHelper';
import { handleToolError, createSuccessResult } from '../utils/errorHandler';
import { formatJiraIssue, formatJiraIssueSummary } from '../utils/formatters';

export function registerJiraTools(context: vscode.ExtensionContext, helper: JiraHelper | null): void {
    // Get Jira Issue Tool
    const getJiraIssueTool = vscode.lm.registerTool('getJiraIssue', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }

            const { issueKey } = options.input;
            try {
                const issue = await helper.getIssue(issueKey);
                const formatted = formatJiraIssue(issue);
                return createSuccessResult({ issue, formatted });
            } catch (error) {
                return handleToolError(error, `Failed to get Jira issue ${issueKey}`);
            }
        }
    });

    // Search Jira Issues Tool
    const searchJiraIssuesTool = vscode.lm.registerTool('searchJiraIssues', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ jql: string; maxResults?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }

            const { jql, maxResults = 50 } = options.input;
            try {
                const result = await helper.searchIssues(jql, maxResults);
                const summary = formatJiraIssueSummary(result.issues);
                return createSuccessResult({ total: result.total, issues: result.issues, summary });
            } catch (error) {
                return handleToolError(error, `Failed to search Jira issues with JQL: ${jql}`);
            }
        }
    });

    // Get Jira Issue Links Tool
    const getJiraIssueLinksTool = vscode.lm.registerTool('getJiraIssueLinks', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }

            const { issueKey } = options.input;
            try {
                const links = await helper.getIssueLinks(issueKey);
                const formatted = links.map(link => {
                    const linkedIssue = link.outwardIssue || link.inwardIssue;
                    const linkType = link.type?.name || 'related';
                    return `${linkedIssue?.key}: ${linkedIssue?.fields?.summary} (${linkType})`;
                });
                return createSuccessResult({ links, formatted });
            } catch (error) {
                return handleToolError(error, `Failed to get links for ${issueKey}`);
            }
        }
    });

    // Gather Jira Issue Context Tool
    const gatherJiraIssueContextTool = vscode.lm.registerTool('gatherJiraIssueContext', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            
            const { issueKey } = options.input;
            try {
                const context = await helper.gatherIssueContext(issueKey);
                const summary = {
                    mainIssue: formatJiraIssue(context.mainIssue),
                    subTasks: formatJiraIssueSummary(context.subTasks),
                    linkedIssues: formatJiraIssueSummary(context.linkedIssues),
                    totalIssues: context.allIssues.length
                };
                return createSuccessResult({ context, summary });
            } catch (error) {
                return handleToolError(error, `Failed to gather context for ${issueKey}`);
            }
        }
    });

    // Create Jira Comment Tool
    const createJiraCommentTool = vscode.lm.registerTool('createJiraComment', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; comment: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }

            const { issueKey, comment } = options.input;
            try {
                const result = await helper.addComment(issueKey, comment);
                return createSuccessResult({ message: `Comment added to ${issueKey}`, result });
            } catch (error) {
                return handleToolError(error, `Failed to add comment to ${issueKey}`);
            }
        }
    });

    context.subscriptions.push(
        getJiraIssueTool,
        searchJiraIssuesTool,
        getJiraIssueLinksTool,
        gatherJiraIssueContextTool,
        createJiraCommentTool
    );
}
