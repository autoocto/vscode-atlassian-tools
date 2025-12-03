/* eslint-disable @typescript-eslint/no-unused-vars */
import * as vscode from 'vscode';
import { ConfluenceHelper } from '../helpers/confluenceHelper';
import { handleToolError, createSuccessResult } from '../utils/errorHandler';
import { formatConfluencePage, formatConfluencePageSummary } from '../utils/formatters';

export function registerConfluenceTools(context: vscode.ExtensionContext, helper: ConfluenceHelper | null): void {
    // Search Confluence Pages Tool
    const searchConfluencePagesTool = vscode.lm.registerTool('searchConfluencePages', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ cql: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { cql, limit = 25 } = options.input;
            try {
                const result = await helper.searchContent(cql, limit);
                const summary = formatConfluencePageSummary(result.results);
                return createSuccessResult({ total: result.size, pages: result.results, summary });
            } catch (error) {
                return handleToolError(error, `Failed to search Confluence with CQL: ${cql}`);
            }
        }
    });

    // Get Confluence Page Tool
    const getConfluencePageTool = vscode.lm.registerTool('getConfluencePage', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId } = options.input;
            try {
                const page = await helper.getPage(pageId);
                const formatted = formatConfluencePage(page);
                const textContent = helper.extractTextContent(page);
                return createSuccessResult({ page, formatted, textContent });
            } catch (error) {
                return handleToolError(error, `Failed to get Confluence page ${pageId}`);
            }
        }
    });

    // Create Confluence Page Tool
    const createConfluencePageTool = vscode.lm.registerTool('createConfluencePage', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ spaceKey: string; title: string; content: string; parentId?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { spaceKey, title, content, parentId } = options.input;
            try {
                const page = await helper.createPage(spaceKey, title, content, parentId);
                const formatted = formatConfluencePage(page);
                const webUrl = page._links?.webui || '';
                return createSuccessResult({ message: `Page created: ${title}`, page, formatted, webUrl });
            } catch (error) {
                return handleToolError(error, `Failed to create Confluence page: ${title}`);
            }
        }
    });

    // Update Confluence Page Tool
    const updateConfluencePageTool = vscode.lm.registerTool('updateConfluencePage', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; title: string; content: string; version: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, title, content, version } = options.input;
            try {
                const page = await helper.updatePage(pageId, title, content, version);
                const formatted = formatConfluencePage(page);
                return createSuccessResult({ message: `Page updated: ${title}`, page, formatted });
            } catch (error) {
                return handleToolError(error, `Failed to update Confluence page ${pageId}`);
            }
        }
    });

    // Search Confluence by Jira Key Tool
    const searchConfluenceByJiraKeyTool = vscode.lm.registerTool('searchConfluenceByJiraKey', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ jiraKey: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { jiraKey, limit = 20 } = options.input;
            try {
                const pages = await helper.searchByJiraKey(jiraKey, limit);
                const summary = formatConfluencePageSummary(pages);
                return createSuccessResult({ total: pages.length, pages, summary });
            } catch (error) {
                return handleToolError(error, `Failed to search Confluence for Jira key ${jiraKey}`);
            }
        }
    });

    context.subscriptions.push(
        searchConfluencePagesTool,
        getConfluencePageTool,
        createConfluencePageTool,
        updateConfluencePageTool,
        searchConfluenceByJiraKeyTool
    );
}
