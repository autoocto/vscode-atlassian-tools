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
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; title: string; content: string; version?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, title, content, version: providedVersion } = options.input;

            try {
                // If version not provided or stale, fetch current version
                let version = providedVersion;
                if (!version) {
                    const currentPage = await helper.getPage(pageId);
                    version = currentPage.version?.number;
                    if (!version) {
                        throw new Error('Could not determine page version');
                    }
                }

                const page = await helper.updatePage(pageId, title, content, version);
                const formatted = formatConfluencePage(page);
                return createSuccessResult({ message: `Page updated: ${title}`, page, formatted });
            } catch (error) {
                // If version conflict, retry with fresh version
                if (error instanceof Error && error.message.includes('Version must be incremented')) {
                    try {
                        const currentPage = await helper.getPage(pageId);
                        const currentVersion = currentPage.version?.number;
                        if (!currentVersion) {
                            throw new Error('Could not determine current page version');
                        }
                        const page = await helper.updatePage(pageId, title, content, currentVersion);
                        const formatted = formatConfluencePage(page);
                        return createSuccessResult({ message: `Page updated: ${title} (auto-resolved version conflict)`, page, formatted });
                    } catch (retryError) {
                        return handleToolError(retryError, `Failed to update Confluence page ${pageId} after retry`);
                    }
                }
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

    // Get Confluence Page Comments Tool
    const getConfluencePageCommentsTool = vscode.lm.registerTool('getConfluencePageComments', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; depth?: string; location?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, depth, location } = options.input;
            try {
                const result = await helper.getPageComments(pageId, depth, location);
                return createSuccessResult({ comments: result.results || [], total: result.size || 0 });
            } catch (error) {
                return handleToolError(error, `Failed to get comments for Confluence page ${pageId}`);
            }
        }
    });

    // Delete Confluence Page Tool
    const deleteConfluencePageTool = vscode.lm.registerTool('deleteConfluencePage', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId } = options.input;
            try {
                await helper.deletePage(pageId);
                return createSuccessResult({ message: `Page ${pageId} deleted successfully` });
            } catch (error) {
                return handleToolError(error, `Failed to delete Confluence page ${pageId}`);
            }
        }
    });

    // Create Footer Comment Tool (v2 API)
    const createFooterCommentTool = vscode.lm.registerTool('createConfluenceFooterComment', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; body: string; parentCommentId?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, body, parentCommentId } = options.input;
            try {
                const comment = await helper.createFooterComment(pageId, body, undefined, parentCommentId);
                const message = parentCommentId ? 'Reply created' : 'Comment created';
                return createSuccessResult({ message, comment });
            } catch (error) {
                return handleToolError(error, `Failed to create footer comment on page ${pageId}`);
            }
        }
    });

    // Update Footer Comment Tool (v2 API)
    const updateFooterCommentTool = vscode.lm.registerTool('updateConfluenceFooterComment', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ commentId: string; body: string; version: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { commentId, body, version } = options.input;
            try {
                const comment = await helper.updateFooterComment(commentId, body, version);
                return createSuccessResult({ message: 'Comment updated', comment });
            } catch (error) {
                return handleToolError(error, `Failed to update footer comment ${commentId}`);
            }
        }
    });

    // Delete Footer Comment Tool (v2 API)
    const deleteFooterCommentTool = vscode.lm.registerTool('deleteConfluenceFooterComment', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ commentId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { commentId } = options.input;
            try {
                await helper.deleteFooterComment(commentId);
                return createSuccessResult({ message: `Comment ${commentId} deleted` });
            } catch (error) {
                return handleToolError(error, `Failed to delete footer comment ${commentId}`);
            }
        }
    });

    // Get Footer Comment Tool (v2 API)
    const getFooterCommentTool = vscode.lm.registerTool('getConfluenceFooterComment', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ commentId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { commentId } = options.input;
            try {
                const comment = await helper.getFooterComment(commentId);
                return createSuccessResult({ comment });
            } catch (error) {
                return handleToolError(error, `Failed to get footer comment ${commentId}`);
            }
        }
    });

    // Resolve Inline Comment Tool (v2 API)
    const resolveInlineCommentTool = vscode.lm.registerTool('resolveConfluenceInlineComment', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ commentId: string; version: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { commentId, version } = options.input;
            try {
                const comment = await helper.resolveInlineComment(commentId, version);
                return createSuccessResult({ message: 'Inline comment resolved', comment });
            } catch (error) {
                return handleToolError(error, `Failed to resolve inline comment ${commentId}`);
            }
        }
    });

    // Reopen Inline Comment Tool (v2 API)
    const reopenInlineCommentTool = vscode.lm.registerTool('reopenConfluenceInlineComment', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ commentId: string; version: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { commentId, version } = options.input;
            try {
                const comment = await helper.reopenInlineComment(commentId, version);
                return createSuccessResult({ message: 'Inline comment reopened', comment });
            } catch (error) {
                return handleToolError(error, `Failed to reopen inline comment ${commentId}`);
            }
        }
    });

    // Get Inline Comment Tool (v2 API)
    const getInlineCommentTool = vscode.lm.registerTool('getConfluenceInlineComment', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ commentId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { commentId } = options.input;
            try {
                const comment = await helper.getInlineComment(commentId);
                return createSuccessResult({ comment });
            } catch (error) {
                return handleToolError(error, `Failed to get inline comment ${commentId}`);
            }
        }
    });

    // Get Page Footer Comments (v2 API)
    const getPageFooterCommentsTool = vscode.lm.registerTool('getConfluencePageFooterComments', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; sort?: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, sort, limit = 25 } = options.input;
            try {
                const result = await helper.getPageFooterComments(pageId, sort, limit);
                return createSuccessResult({ comments: result.results || [], total: result.size || 0 });
            } catch (error) {
                return handleToolError(error, `Failed to get footer comments for page ${pageId}`);
            }
        }
    });

    // Get Page Inline Comments (v2 API)
    const getPageInlineCommentsTool = vscode.lm.registerTool('getConfluencePageInlineComments', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; sort?: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, sort, limit = 25 } = options.input;
            try {
                const result = await helper.getPageInlineComments(pageId, sort, limit);
                return createSuccessResult({ comments: result.results || [], total: result.size || 0 });
            } catch (error) {
                return handleToolError(error, `Failed to get inline comments for page ${pageId}`);
            }
        }
    });

    context.subscriptions.push(
        searchConfluencePagesTool,
        getConfluencePageTool,
        createConfluencePageTool,
        updateConfluencePageTool,
        searchConfluenceByJiraKeyTool,
        getConfluencePageCommentsTool,
        deleteConfluencePageTool,
        createFooterCommentTool,
        updateFooterCommentTool,
        deleteFooterCommentTool,
        getFooterCommentTool,
        resolveInlineCommentTool,
        reopenInlineCommentTool,
        getInlineCommentTool,
        getPageFooterCommentsTool,
        getPageInlineCommentsTool
    );
}
