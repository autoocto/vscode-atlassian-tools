/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Confluence Language Model Tools
 * 
 * Organized into 5 groups for better maintainability:
 * 
 * Group 1: Page Operations (CRUD)
 *   - searchConfluencePages, getConfluencePage, createConfluencePage, updateConfluencePage, deleteConfluencePage
 *   - getConfluencePageHistory, getConfluencePageVersion, getConfluenceChildPages, getConfluencePageAncestors
 *   - copyConfluencePage, moveConfluencePage
 * 
 * Group 2: Page Context (Comments, Labels, Attachments)
 *   - getConfluencePageComments, getConfluencePageFooterComments, getConfluencePageInlineComments
 *   - createConfluenceFooterComment, updateConfluenceFooterComment, deleteConfluenceFooterComment, getConfluenceFooterComment
 *   - resolveConfluenceInlineComment, reopenConfluenceInlineComment, getConfluenceInlineComment
 *   - getConfluencePageLabels, addConfluencePageLabel, removeConfluencePageLabel
 *   - getConfluencePageAttachments
 * 
 * Group 3: Space Operations
 *   - getConfluenceSpaces, getConfluenceSpace, getConfluenceSpacePages
 * 
 * Group 4: Search Operations
 *   - searchConfluenceByJiraKey, searchConfluenceByTitle, fullTextSearchConfluence
 *   - getConfluenceRecentlyUpdated, getConfluenceMyCreatedPages, getConfluenceMyContributedPages
 * 
 * Group 5: User & Metadata
 *   - getConfluenceCurrentUser, searchConfluenceUsers, getConfluencePageWatchers
 */

import * as vscode from 'vscode';
import { ConfluenceHelper } from '../helpers/confluenceHelper';
import { handleToolError, createSuccessResult } from '../utils/errorHandler';
import { formatConfluencePage, formatConfluencePageSummary } from '../utils/formatters';

export function registerConfluenceTools(context: vscode.ExtensionContext, helper: ConfluenceHelper | null): void {

    // =============================================================================
    // GROUP 1: PAGE OPERATIONS (CRUD)
    // =============================================================================

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

    // Get Page History Tool
    const getPageHistoryTool = vscode.lm.registerTool('getConfluencePageHistory', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, limit = 25 } = options.input;
            try {
                const history = await helper.getPageHistory(pageId, limit);
                return createSuccessResult({ history });
            } catch (error) {
                return handleToolError(error, `Failed to get history for page ${pageId}`);
            }
        }
    });

    // Get Page Version Tool
    const getPageVersionTool = vscode.lm.registerTool('getConfluencePageVersion', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; version: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, version } = options.input;
            try {
                const page = await helper.getPageVersion(pageId, version);
                const formatted = formatConfluencePage(page);
                return createSuccessResult({ page, formatted });
            } catch (error) {
                return handleToolError(error, `Failed to get version ${version} of page ${pageId}`);
            }
        }
    });

    // Get Child Pages Tool
    const getChildPagesTool = vscode.lm.registerTool('getConfluenceChildPages', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, limit = 25 } = options.input;
            try {
                const children = await helper.getChildPages(pageId, limit);
                const summary = formatConfluencePageSummary(children.results || []);
                return createSuccessResult({ children: children.results || [], total: children.size || 0, summary });
            } catch (error) {
                return handleToolError(error, `Failed to get child pages for ${pageId}`);
            }
        }
    });

    // Get Page Ancestors Tool
    const getPageAncestorsTool = vscode.lm.registerTool('getConfluencePageAncestors', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId } = options.input;
            try {
                const result = await helper.getPageAncestors(pageId);
                return createSuccessResult({ ancestors: result.ancestors || [] });
            } catch (error) {
                return handleToolError(error, `Failed to get ancestors for page ${pageId}`);
            }
        }
    });

    // Copy Page Tool
    const copyPageTool = vscode.lm.registerTool('copyConfluencePage', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; targetSpaceKey: string; newTitle: string; targetParentId?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, targetSpaceKey, newTitle, targetParentId } = options.input;
            try {
                const page = await helper.copyPage(pageId, targetSpaceKey, newTitle, targetParentId);
                const formatted = formatConfluencePage(page);
                return createSuccessResult({ message: `Page copied as: ${newTitle}`, page, formatted });
            } catch (error) {
                return handleToolError(error, `Failed to copy page ${pageId}`);
            }
        }
    });

    // Move Page Tool
    const movePageTool = vscode.lm.registerTool('moveConfluencePage', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; targetSpaceKey: string; targetParentId?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, targetSpaceKey, targetParentId } = options.input;
            try {
                const page = await helper.movePage(pageId, targetSpaceKey, targetParentId);
                const formatted = formatConfluencePage(page);
                return createSuccessResult({ message: `Page moved to space: ${targetSpaceKey}`, page, formatted });
            } catch (error) {
                return handleToolError(error, `Failed to move page ${pageId}`);
            }
        }
    });

    // =============================================================================
    // GROUP 2: PAGE CONTEXT (Comments, Labels, Attachments)
    // =============================================================================

    // Get Page Comments Tool (v1 API - legacy)
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

    // Get Page Labels Tool
    const getPageLabelsTool = vscode.lm.registerTool('getConfluencePageLabels', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId } = options.input;
            try {
                const result = await helper.getPageLabels(pageId);
                return createSuccessResult({ labels: result.results || [], total: result.size || 0 });
            } catch (error) {
                return handleToolError(error, `Failed to get labels for page ${pageId}`);
            }
        }
    });

    // Add Page Label Tool
    const addPageLabelTool = vscode.lm.registerTool('addConfluencePageLabel', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; label: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, label } = options.input;
            try {
                const result = await helper.addPageLabel(pageId, label);
                return createSuccessResult({ message: `Label '${label}' added`, result });
            } catch (error) {
                return handleToolError(error, `Failed to add label '${label}' to page ${pageId}`);
            }
        }
    });

    // Remove Page Label Tool
    const removePageLabelTool = vscode.lm.registerTool('removeConfluencePageLabel', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; label: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, label } = options.input;
            try {
                await helper.removePageLabel(pageId, label);
                return createSuccessResult({ message: `Label '${label}' removed from page ${pageId}` });
            } catch (error) {
                return handleToolError(error, `Failed to remove label '${label}' from page ${pageId}`);
            }
        }
    });

    // Get Page Attachments Tool
    const getPageAttachmentsTool = vscode.lm.registerTool('getConfluencePageAttachments', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId, limit = 25 } = options.input;
            try {
                const result = await helper.getPageAttachments(pageId, limit);
                return createSuccessResult({ attachments: result.results || [], total: result.size || 0 });
            } catch (error) {
                return handleToolError(error, `Failed to get attachments for page ${pageId}`);
            }
        }
    });

    // =============================================================================
    // GROUP 3: SPACE OPERATIONS
    // =============================================================================

    // Get Spaces Tool
    const getSpacesTool = vscode.lm.registerTool('getConfluenceSpaces', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { limit = 100 } = options.input;
            try {
                const spaces = await helper.getAllSpaces(limit);
                return createSuccessResult({ spaces, total: spaces.length });
            } catch (error) {
                return handleToolError(error, 'Failed to get Confluence spaces');
            }
        }
    });

    // Get Space Tool
    const getSpaceTool = vscode.lm.registerTool('getConfluenceSpace', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ spaceKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { spaceKey } = options.input;
            try {
                const space = await helper.getSpace(spaceKey);
                return createSuccessResult({ space });
            } catch (error) {
                return handleToolError(error, `Failed to get space ${spaceKey}`);
            }
        }
    });

    // Get Space Pages Tool
    const getSpacePagesTool = vscode.lm.registerTool('getConfluenceSpacePages', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ spaceKey: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { spaceKey, limit = 25 } = options.input;
            try {
                const pages = await helper.getPagesInSpace(spaceKey, limit);
                const summary = formatConfluencePageSummary(pages);
                return createSuccessResult({ pages, total: pages.length, summary });
            } catch (error) {
                return handleToolError(error, `Failed to get pages in space ${spaceKey}`);
            }
        }
    });

    // =============================================================================
    // GROUP 4: SEARCH OPERATIONS
    // =============================================================================

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

    // Search Confluence by Title Tool
    const searchByTitleTool = vscode.lm.registerTool('searchConfluenceByTitle', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ title: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { title, limit = 25 } = options.input;
            try {
                const pages = await helper.searchByTitle(title, limit);
                const summary = formatConfluencePageSummary(pages);
                return createSuccessResult({ pages, total: pages.length, summary });
            } catch (error) {
                return handleToolError(error, `Failed to search Confluence by title: ${title}`);
            }
        }
    });

    // Full Text Search Tool
    const fullTextSearchTool = vscode.lm.registerTool('fullTextSearchConfluence', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ query: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { query, limit = 25 } = options.input;
            try {
                const result = await helper.fullTextSearch(query, limit);
                const summary = formatConfluencePageSummary(result.results);
                return createSuccessResult({ pages: result.results, total: result.size, summary });
            } catch (error) {
                return handleToolError(error, `Failed to search Confluence: ${query}`);
            }
        }
    });

    // Get Recently Updated Pages Tool
    const getRecentlyUpdatedTool = vscode.lm.registerTool('getConfluenceRecentlyUpdated', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { limit = 25 } = options.input;
            try {
                const pages = await helper.getRecentlyUpdated(limit);
                const summary = formatConfluencePageSummary(pages);
                return createSuccessResult({ pages, total: pages.length, summary });
            } catch (error) {
                return handleToolError(error, 'Failed to get recently updated pages');
            }
        }
    });

    // Get My Created Pages Tool
    const getMyCreatedPagesTool = vscode.lm.registerTool('getConfluenceMyCreatedPages', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { limit = 25 } = options.input;
            try {
                const pages = await helper.getMyCreatedPages(limit);
                const summary = formatConfluencePageSummary(pages);
                return createSuccessResult({ pages, total: pages.length, summary });
            } catch (error) {
                return handleToolError(error, 'Failed to get my created pages');
            }
        }
    });

    // Get My Contributed Pages Tool
    const getMyContributedPagesTool = vscode.lm.registerTool('getConfluenceMyContributedPages', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { limit = 25 } = options.input;
            try {
                const pages = await helper.getMyContributedPages(limit);
                const summary = formatConfluencePageSummary(pages);
                return createSuccessResult({ pages, total: pages.length, summary });
            } catch (error) {
                return handleToolError(error, 'Failed to get my contributed pages');
            }
        }
    });

    // =============================================================================
    // GROUP 5: USER & METADATA
    // =============================================================================

    // Get Current User Tool
    const getCurrentUserTool = vscode.lm.registerTool('getConfluenceCurrentUser', {
        async invoke(_options: vscode.LanguageModelToolInvocationOptions<Record<string, never>>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            try {
                const user = await helper.getCurrentUser();
                return createSuccessResult({ user });
            } catch (error) {
                return handleToolError(error, 'Failed to get current user');
            }
        }
    });

    // Search Users Tool
    const searchUsersTool = vscode.lm.registerTool('searchConfluenceUsers', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ query: string; limit?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { query, limit = 25 } = options.input;
            try {
                const users = await helper.searchUsers(query, limit);
                return createSuccessResult({ users, total: users.length });
            } catch (error) {
                return handleToolError(error, `Failed to search users: ${query}`);
            }
        }
    });

    // Get Page Watchers Tool
    const getPageWatchersTool = vscode.lm.registerTool('getConfluencePageWatchers', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ pageId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Confluence is not configured'));
            }

            const { pageId } = options.input;
            try {
                const watchers = await helper.getPageWatchers(pageId);
                return createSuccessResult({ watchers });
            } catch (error) {
                return handleToolError(error, `Failed to get watchers for page ${pageId}`);
            }
        }
    });

    // =============================================================================
    // REGISTER ALL TOOLS
    // =============================================================================

    context.subscriptions.push(
        // Group 1: Page Operations
        searchConfluencePagesTool,
        getConfluencePageTool,
        createConfluencePageTool,
        updateConfluencePageTool,
        deleteConfluencePageTool,
        getPageHistoryTool,
        getPageVersionTool,
        getChildPagesTool,
        getPageAncestorsTool,
        copyPageTool,
        movePageTool,

        // Group 2: Page Context
        getConfluencePageCommentsTool,
        getPageFooterCommentsTool,
        getPageInlineCommentsTool,
        createFooterCommentTool,
        updateFooterCommentTool,
        deleteFooterCommentTool,
        getFooterCommentTool,
        resolveInlineCommentTool,
        reopenInlineCommentTool,
        getInlineCommentTool,
        getPageLabelsTool,
        addPageLabelTool,
        removePageLabelTool,
        getPageAttachmentsTool,

        // Group 3: Space Operations
        getSpacesTool,
        getSpaceTool,
        getSpacePagesTool,

        // Group 4: Search Operations
        searchConfluenceByJiraKeyTool,
        searchByTitleTool,
        fullTextSearchTool,
        getRecentlyUpdatedTool,
        getMyCreatedPagesTool,
        getMyContributedPagesTool,

        // Group 5: User & Metadata
        getCurrentUserTool,
        searchUsersTool,
        getPageWatchersTool
    );
}
