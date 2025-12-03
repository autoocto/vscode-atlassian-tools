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
}
