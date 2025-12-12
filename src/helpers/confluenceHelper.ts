import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { AtlassianConfig } from '../utils/configLoader';

export interface ConfluencePage {
    id: string;
    type: string;
    status: string;
    title: string;
    space?: { key: string; name: string };
    version?: { number: number };
    body?: {
        storage?: { value: string };
        view?: { value: string };
    };
    _links?: {
        webui?: string;
        self?: string;
    };
}

export interface ConfluenceSearchResult {
    results: ConfluencePage[];
    size: number;
    start: number;
    limit: number;
    _links?: any;
}

export class ConfluenceHelper {
    private config: AtlassianConfig;

    constructor(config: AtlassianConfig) {
        this.config = config;
    }

    /**
     * Make an authenticated request to Confluence REST API
     */
    private async request<T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> {
        const url = new URL(endpoint, this.config.baseUrl);
        const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');

        return new Promise((resolve, reject) => {
            const protocol = url.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };

            const req = protocol.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const parsed = data ? JSON.parse(data) : {};
                            resolve(parsed);
                        } catch (e) {
                            resolve(data as any);
                        }
                    } else {
                        reject(new Error(`Confluence API error: ${res.statusCode} - ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (body) {
                req.write(JSON.stringify(body));
            }

            req.end();
        });
    }

    /**
     * Search for content using CQL (Confluence Query Language)
     */
    async searchContent(cql: string, limit: number = 25, start: number = 0): Promise<ConfluenceSearchResult> {
        const params = new URLSearchParams({
            cql,
            limit: limit.toString(),
            start: start.toString(),
            expand: 'space,version,body.storage'
        });
        return this.request<ConfluenceSearchResult>(`/wiki/rest/api/content/search?${params.toString()}`);
    }

    /**
     * Get a specific page by ID
     */
    async getPage(pageId: string, expand?: string): Promise<ConfluencePage> {
        const expandParam = expand || 'body.storage,version,space';
        return this.request<ConfluencePage>(`/wiki/rest/api/content/${pageId}?expand=${expandParam}`);
    }

    /**
     * Get pages from a space
     */
    async getPagesInSpace(spaceKey: string, limit: number = 25): Promise<ConfluencePage[]> {
        const cql = `space = "${spaceKey}" AND type = page ORDER BY lastmodified DESC`;
        const result = await this.searchContent(cql, limit);
        return result.results;
    }

    /**
     * Create a new page
     */
    async createPage(spaceKey: string, title: string, content: string, parentId?: string): Promise<ConfluencePage> {
        const body: any = {
            type: 'page',
            title,
            space: { key: spaceKey },
            body: {
                storage: {
                    value: content,
                    representation: 'storage'
                }
            }
        };

        if (parentId) {
            body.ancestors = [{ id: parentId }];
        }

        return this.request<ConfluencePage>('/wiki/rest/api/content', 'POST', body);
    }

    /**
     * Update a page
     */
    async updatePage(pageId: string, title: string, content: string, version: number): Promise<ConfluencePage> {
        const body = {
            version: { number: version + 1 },
            title,
            type: 'page',
            body: {
                storage: {
                    value: content,
                    representation: 'storage'
                }
            }
        };
        return this.request<ConfluencePage>(`/wiki/rest/api/content/${pageId}`, 'PUT', body);
    }

    /**
     * Get recently updated content
     */
    async getRecentlyUpdated(limit: number = 10): Promise<ConfluencePage[]> {
        const cql = 'type = page ORDER BY lastmodified DESC';
        const result = await this.searchContent(cql, limit);
        return result.results;
    }

    /**
     * Search pages by title
     */
    async searchByTitle(title: string, limit: number = 10): Promise<ConfluencePage[]> {
        const cql = `type = page AND title ~ "${title}" ORDER BY lastmodified DESC`;
        const result = await this.searchContent(cql, limit);
        return result.results;
    }

    /**
     * Get current user info
     */
    async getCurrentUser(): Promise<any> {
        return this.request('/wiki/rest/api/user/current');
    }

    /**
     * Get pages starred/favorited by the current user
     */
    async getStarredPages(limit: number = 25): Promise<ConfluencePage[]> {
        const cql = 'type = page AND favourite = currentUser() ORDER BY lastmodified DESC';
        const result = await this.searchContent(cql, limit);
        return result.results;
    }

    /**
     * Get spaces starred/favorited by the current user
     */
    async getStarredSpaces(): Promise<Array<{ key: string; name: string; id: string }>> {
        const cql = 'type = space AND favourite = currentUser() ORDER BY lastmodified DESC';
        const result: any = await this.request(`/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=100`);
        return result.results || [];
    }

    /**
     * Get recently viewed pages by current user
     */
    async getRecentlyViewedPages(limit: number = 25): Promise<ConfluencePage[]> {
        // Confluence doesn't have a 'lastViewed' CQL field, so we'll use recently updated pages
        // filtered by contributor to approximate recently viewed content
        const cql = 'type = page AND contributor = currentUser() ORDER BY lastmodified DESC';
        const result = await this.searchContent(cql, limit);
        return result.results;
    }

    /**
     * Get pages created by current user
     */
    async getMyCreatedPages(limit: number = 25): Promise<ConfluencePage[]> {
        const cql = 'type = page AND creator = currentUser() ORDER BY created DESC';
        const result = await this.searchContent(cql, limit);
        return result.results;
    }

    /**
     * Get pages contributed to by current user
     */
    async getMyContributedPages(limit: number = 25): Promise<ConfluencePage[]> {
        const cql = 'type = page AND contributor = currentUser() ORDER BY lastmodified DESC';
        const result = await this.searchContent(cql, limit);
        return result.results;
    }

    /**
     * Check Confluence connectivity
     */
    async checkConnection(): Promise<boolean> {
        try {
            await this.getCurrentUser();
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Search for pages related to a JIRA ticket
     */
    async searchByJiraKey(jiraKey: string, limit: number = 20): Promise<ConfluencePage[]> {
        const cql = `type = page AND text ~ "${jiraKey}" ORDER BY lastmodified DESC`;
        const result = await this.searchContent(cql, limit);
        return result.results;
    }

    /**
     * Extract plain text content from a page
     */
    extractTextContent(page: ConfluencePage): string {
        if (!page.body?.storage?.value) {
            return '';
        }

        // Basic HTML to text conversion (strips tags)
        return page.body.storage.value
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Get all Confluence spaces
     */
    async getAllSpaces(limit: number = 500): Promise<Array<{ key: string; name: string; id: string }>> {
        const endpoint = `/wiki/rest/api/space?limit=${limit}`;
        const result: any = await this.request(endpoint);
        return result.results || [];
    }

    /**
     * Get spaces where the current user has permissions (filters out other users' personal spaces)
     */
    async getUserAccessibleSpaces(limit: number = 500): Promise<Array<{ key: string; name: string; id: string; type?: string }>> {
        const currentUser = await this.getCurrentUser();
        const allSpaces = await this.getAllSpaces(limit);
        
        // Filter to include:
        // 1. User's own personal space (key starts with ~accountId)
        // 2. Global/team spaces (not personal spaces of other users)
        return allSpaces.filter(space => {
            const isPersonalSpace = space.key.startsWith('~');
            if (isPersonalSpace) {
                // Only include user's own personal space
                return space.key.includes(currentUser.accountId) || space.key.includes(currentUser.username);
            }
            // Include all non-personal spaces
            return true;
        });
    }

    /**
     * Get comments for a Confluence page (v1 API - legacy)
     */
    async getPageComments(pageId: string, depth?: string, location?: string): Promise<any> {
        const params = new URLSearchParams({
            expand: 'body.view'
        });
        if (depth) {
            params.append('depth', depth);
        }
        if (location) {
            params.append('location', location);
        }
        return this.request(`/wiki/rest/api/content/${pageId}/child/comment?${params.toString()}`);
    }

    /**
     * Delete a Confluence page
     */
    async deletePage(pageId: string): Promise<void> {
        await this.request(`/wiki/rest/api/content/${pageId}`, 'DELETE');
    }

    // ===== COMMENT MANAGEMENT (v2 API) =====

    /**
     * Get footer comments for a page (v2 API)
     */
    async getPageFooterComments(pageId: string, sort?: string, limit: number = 25): Promise<any> {
        const params = new URLSearchParams({
            'page-id': pageId,
            limit: limit.toString()
        });
        if (sort) {
            params.append('sort', sort);
        }
        return this.request(`/wiki/api/v2/pages/${pageId}/footer-comments?${params.toString()}`);
    }

    /**
     * Get inline comments for a page (v2 API)
     */
    async getPageInlineComments(pageId: string, sort?: string, limit: number = 25): Promise<any> {
        const params = new URLSearchParams({
            'page-id': pageId,
            limit: limit.toString()
        });
        if (sort) {
            params.append('sort', sort);
        }
        return this.request(`/wiki/api/v2/pages/${pageId}/inline-comments?${params.toString()}`);
    }

    /**
     * Create a footer comment on a page (v2 API)
     */
    async createFooterComment(pageId: string, body: string, blogPostId?: string, parentCommentId?: string): Promise<any> {
        const payload: any = {
            body: {
                representation: 'storage',
                value: body
            }
        };

        // Specify ONE of: parentCommentId (for replies), blogPostId, or pageId
        if (parentCommentId) {
            payload.parentCommentId = parentCommentId;
        } else if (blogPostId) {
            payload.blogPostId = blogPostId;
        } else {
            payload.pageId = pageId;
        }

        return this.request('/wiki/api/v2/footer-comments', 'POST', payload);
    }

    /**
     * Create an inline comment on a page (v2 API)
     */
    async createInlineComment(pageId: string, body: string, inlineProperties: any, parentCommentId?: string): Promise<any> {
        const payload: any = {
            body: {
                representation: 'storage',
                value: body
            },
            inlineCommentProperties: inlineProperties
        };

        if (parentCommentId) {
            payload.parentCommentId = parentCommentId;
        } else {
            payload.pageId = pageId;
        }

        return this.request('/wiki/api/v2/inline-comments', 'POST', payload);
    }

    /**
     * Update a footer comment (v2 API)
     */
    async updateFooterComment(commentId: string, body: string, version: number): Promise<any> {
        const payload = {
            body: {
                representation: 'storage',
                value: body
            },
            version: {
                number: version + 1,
                message: 'Updated comment'
            }
        };
        return this.request(`/wiki/api/v2/footer-comments/${commentId}`, 'PUT', payload);
    }

    /**
     * Update an inline comment (v2 API)
     */
    async updateInlineComment(commentId: string, body: string, version: number, resolutionStatus?: string): Promise<any> {
        const payload: any = {
            body: {
                representation: 'storage',
                value: body
            },
            version: {
                number: version + 1,
                message: 'Updated comment'
            }
        };

        if (resolutionStatus) {
            payload.resolutionStatus = resolutionStatus;
        }

        return this.request(`/wiki/api/v2/inline-comments/${commentId}`, 'PUT', payload);
    }

    /**
     * Get a footer comment by ID (v2 API)
     */
    async getFooterComment(commentId: string): Promise<any> {
        return this.request(`/wiki/api/v2/footer-comments/${commentId}?body-format=storage`);
    }

    /**
     * Get an inline comment by ID (v2 API)
     */
    async getInlineComment(commentId: string): Promise<any> {
        return this.request(`/wiki/api/v2/inline-comments/${commentId}?body-format=storage`);
    }

    /**
     * Delete a footer comment (v2 API)
     */
    async deleteFooterComment(commentId: string): Promise<void> {
        await this.request(`/wiki/api/v2/footer-comments/${commentId}`, 'DELETE');
    }

    /**
     * Delete an inline comment (v2 API)
     */
    async deleteInlineComment(commentId: string): Promise<void> {
        await this.request(`/wiki/api/v2/inline-comments/${commentId}`, 'DELETE');
    }

    /**
     * Get children comments of a footer comment (replies) (v2 API)
     */
    async getFooterCommentChildren(commentId: string, sort?: string, limit: number = 25): Promise<any> {
        const params = new URLSearchParams({
            limit: limit.toString()
        });
        if (sort) {
            params.append('sort', sort);
        }
        return this.request(`/wiki/api/v2/footer-comments/${commentId}/children?${params.toString()}`);
    }

    /**
     * Get children comments of an inline comment (replies) (v2 API)
     */
    async getInlineCommentChildren(commentId: string, sort?: string, limit: number = 25): Promise<any> {
        const params = new URLSearchParams({
            limit: limit.toString()
        });
        if (sort) {
            params.append('sort', sort);
        }
        return this.request(`/wiki/api/v2/inline-comments/${commentId}/children?${params.toString()}`);
    }

    /**
     * Resolve an inline comment (v2 API)
     * Resolution status can be: 'open', 'reopened', 'resolved', 'dangling'
     */
    async resolveInlineComment(commentId: string, version: number): Promise<any> {
        const comment = await this.getInlineComment(commentId);
        return this.updateInlineComment(commentId, comment.body.storage.value, version, 'resolved');
    }

    /**
     * Reopen an inline comment (v2 API)
     */
    async reopenInlineComment(commentId: string, version: number): Promise<any> {
        const comment = await this.getInlineComment(commentId);
        return this.updateInlineComment(commentId, comment.body.storage.value, version, 'reopened');
    }
}
