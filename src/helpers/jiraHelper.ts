import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { AtlassianConfig } from '../utils/configLoader';

export interface JiraIssue {
    id: string;
    key: string;
    fields: {
        summary: string;
        status: { name: string };
        assignee?: { displayName: string; emailAddress: string };
        reporter?: { displayName: string; emailAddress: string };
        created: string;
        updated: string;
        description?: any;
        priority?: { name: string };
        issuetype?: { name: string };
        [key: string]: any;
    };
}

export interface JiraSearchResult {
    issues: JiraIssue[];
    total: number;
    maxResults: number;
    startAt: number;
}

export class JiraHelper {
    private config: AtlassianConfig;

    constructor(config: AtlassianConfig) {
        this.config = config;
    }

    /**
     * Make an authenticated request to JIRA REST API
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
                        reject(new Error(`JIRA API error: ${res.statusCode} - ${data}`));
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
     * Search for issues using JQL
     */
    async searchIssues(jql: string, maxResults: number = 50, startAt: number = 0): Promise<JiraSearchResult> {
        const params = new URLSearchParams({
            jql,
            maxResults: maxResults.toString(),
            startAt: startAt.toString()
        });
        return this.request<JiraSearchResult>(`/rest/api/3/search/jql?${params.toString()}`);
    }

    /**
     * Get my assigned issues
     */
    async getMyIssues(maxResults: number = 50): Promise<JiraIssue[]> {
        const jql = 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC';
        const result = await this.searchIssues(jql, maxResults);
        return result.issues;
    }

    /**
     * Get a specific issue by key
     */
    async getIssue(issueKey: string): Promise<JiraIssue> {
        const params = new URLSearchParams({
            fields: '*all',
            expand: 'renderedFields'
        });
        return this.request<JiraIssue>(`/rest/api/3/issue/${issueKey}?${params.toString()}`);
    }

    /**
     * Create a new issue
     */
    async createIssue(projectKey: string, summary: string, issueType: string = 'Task', description?: string): Promise<JiraIssue> {
        const body = {
            fields: {
                project: { key: projectKey },
                summary,
                issuetype: { name: issueType },
                ...(description && { description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: description }] }] } })
            }
        };
        return this.request<JiraIssue>('/rest/api/3/issue', 'POST', body);
    }

    /**
     * Update an issue
     */
    async updateIssue(issueKey: string, fields: any): Promise<void> {
        await this.request(`/rest/api/3/issue/${issueKey}`, 'PUT', { fields });
    }

    /**
     * Add a comment to an issue
     */
    async addComment(issueKey: string, comment: string): Promise<any> {
        const body = {
            body: {
                type: 'doc',
                version: 1,
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: comment }]
                }]
            }
        };
        return this.request(`/rest/api/3/issue/${issueKey}/comment`, 'POST', body);
    }

    /**
     * Transition an issue (change status)
     */
    async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
        const body = { transition: { id: transitionId } };
        await this.request(`/rest/api/3/issue/${issueKey}/transitions`, 'POST', body);
    }

    /**
     * Get available transitions for an issue
     */
    async getTransitions(issueKey: string): Promise<any> {
        return this.request(`/rest/api/3/issue/${issueKey}/transitions`);
    }

    /**
     * Check JIRA connectivity
     */
    async checkConnection(): Promise<boolean> {
        try {
            await this.request('/rest/api/3/myself');
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get current user info
     */
    async getCurrentUser(): Promise<any> {
        return this.request('/rest/api/3/myself');
    }

    /**
     * Get all sub-tasks for a parent issue
     */
    async getSubTasks(issueKey: string): Promise<JiraIssue[]> {
        const jql = `parent = ${issueKey} ORDER BY created ASC`;
        const result = await this.searchIssues(jql, 100);
        return result.issues;
    }

    /**
     * Get issue links (related issues, blocks, etc.)
     */
    async getIssueLinks(issueKey: string): Promise<any[]> {
        const issue = await this.getIssue(issueKey);
        return issue.fields.issuelinks || [];
    }

    /**
     * Get all related issues (sub-tasks, linked issues) recursively
     */
    async getRelatedIssues(issueKey: string, maxDepth: number = 2): Promise<JiraIssue[]> {
        const visited = new Set<string>();
        const allIssues: JiraIssue[] = [];

        const gather = async (key: string, depth: number) => {
            if (depth > maxDepth || visited.has(key)) {
                return;
            }

            visited.add(key);

            try {
                const issue = await this.getIssue(key);
                allIssues.push(issue);

                // Get sub-tasks
                const subtasks = issue.fields.subtasks || [];
                for (const subtask of subtasks) {
                    await gather(subtask.key, depth + 1);
                }

                // Get linked issues
                const links = issue.fields.issuelinks || [];
                for (const link of links) {
                    const linkedIssue = link.outwardIssue || link.inwardIssue;
                    if (linkedIssue) {
                        await gather(linkedIssue.key, depth + 1);
                    }
                }
            } catch (error) {
                console.error(`Error fetching issue ${key}:`, error);
            }
        };

        await gather(issueKey, 0);
        return allIssues;
    }

    /**
     * Gather comprehensive context for test planning
     * Returns parent issue, all sub-tasks, linked issues, and acceptance criteria
     */
    async gatherIssueContext(issueKey: string): Promise<{
        mainIssue: JiraIssue;
        subTasks: JiraIssue[];
        linkedIssues: JiraIssue[];
        allIssues: JiraIssue[];
    }> {
        const mainIssue = await this.getIssue(issueKey);
        const subTasks = await this.getSubTasks(issueKey);
        const links = await this.getIssueLinks(issueKey);

        const linkedIssues: JiraIssue[] = [];
        for (const link of links) {
            const linkedIssue = link.outwardIssue || link.inwardIssue;
            if (linkedIssue) {
                try {
                    const fullIssue = await this.getIssue(linkedIssue.key);
                    linkedIssues.push(fullIssue);
                } catch (error) {
                    console.error(`Error fetching linked issue ${linkedIssue.key}:`, error);
                }
            }
        }

        return {
            mainIssue,
            subTasks,
            linkedIssues,
            allIssues: [mainIssue, ...subTasks, ...linkedIssues]
        };
    }

    /**
     * Extract acceptance criteria and test scenarios from issue description
     */
    extractTestScenarios(issue: JiraIssue): string[] {
        const scenarios: string[] = [];
        const description = issue.fields.description;

        if (!description) {
            return scenarios;
        }

        // Handle Atlassian Document Format (ADF)
        if (description.type === 'doc' && description.content) {
            const text = this.extractTextFromADF(description);
            
            // Look for common patterns
            const patterns = [
                /acceptance criteria[:\s]+([^]*?)(?=\n\n|\n[A-Z]|$)/i,
                /test scenarios?[:\s]+([^]*?)(?=\n\n|\n[A-Z]|$)/i,
                /scenarios to test[:\s]+([^]*?)(?=\n\n|\n[A-Z]|$)/i,
                /given[^]*?when[^]*?then/gi
            ];

            for (const pattern of patterns) {
                const matches = text.match(pattern);
                if (matches) {
                    scenarios.push(...matches.map(m => m.trim()));
                }
            }
        }

        return scenarios;
    }

    /**
     * Extract plain text from Atlassian Document Format (ADF)
     */
    private extractTextFromADF(adf: any): string {
        if (!adf || !adf.content) {
            return '';
        }

        let text = '';
        
        const traverse = (node: any) => {
            if (node.type === 'text') {
                text += node.text + ' ';
            }
            
            if (node.content && Array.isArray(node.content)) {
                for (const child of node.content) {
                    traverse(child);
                }
                text += '\n';
            }
        };

        traverse(adf);
        return text;
    }

    /**
     * Get all JIRA projects
     */
    async getAllProjects(): Promise<Array<{ key: string; name: string; id: string }>> {
        const endpoint = '/rest/api/3/project';
        return this.request<Array<{ key: string; name: string; id: string }>>(endpoint);
    }

    // ===== WORKLOG MANAGEMENT =====

    /**
     * Add worklog entry (log time on issue)
     */
    async addWorklog(issueKey: string, timeSpent: string, started?: string, comment?: string): Promise<any> {
        const body: any = {
            timeSpent,
            started: started || new Date().toISOString()
        };
        if (comment) {
            body.comment = {
                type: 'doc',
                version: 1,
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: comment }]
                }]
            };
        }
        return this.request(`/rest/api/3/issue/${issueKey}/worklog`, 'POST', body);
    }

    /**
     * Get all worklogs for an issue
     */
    async getWorklogs(issueKey: string, startAt: number = 0, maxResults: number = 1000): Promise<any> {
        const params = new URLSearchParams({
            startAt: startAt.toString(),
            maxResults: maxResults.toString()
        });
        return this.request(`/rest/api/3/issue/${issueKey}/worklog?${params.toString()}`);
    }

    /**
     * Update a worklog entry
     */
    async updateWorklog(issueKey: string, worklogId: string, timeSpent: string, started?: string, comment?: string): Promise<any> {
        const body: any = {
            timeSpent,
            started: started || new Date().toISOString()
        };
        if (comment) {
            body.comment = {
                type: 'doc',
                version: 1,
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: comment }]
                }]
            };
        }
        return this.request(`/rest/api/3/issue/${issueKey}/worklog/${worklogId}`, 'PUT', body);
    }

    /**
     * Delete a worklog entry
     */
    async deleteWorklog(issueKey: string, worklogId: string): Promise<void> {
        await this.request(`/rest/api/3/issue/${issueKey}/worklog/${worklogId}`, 'DELETE');
    }

    // ===== CHANGELOG & HISTORY =====

    /**
     * Get issue changelog (history of changes)
     */
    async getChangelog(issueKey: string, startAt: number = 0, maxResults: number = 100): Promise<any> {
        const params = new URLSearchParams({
            startAt: startAt.toString(),
            maxResults: maxResults.toString()
        });
        return this.request(`/rest/api/3/issue/${issueKey}/changelog?${params.toString()}`);
    }

    // ===== BULK OPERATIONS =====

    /**
     * Bulk fetch multiple issues by key or ID
     */
    async bulkFetchIssues(issueKeys: string[], fields?: string[], expand?: string[]): Promise<any> {
        const body: any = {
            issueIdsOrKeys: issueKeys
        };
        if (fields) {
            body.fields = fields;
        }
        if (expand) {
            body.expand = expand.join(',');
        }
        return this.request('/rest/api/3/issue/bulkfetch', 'POST', body);
    }

    // ===== METADATA =====

    /**
     * Get create metadata for projects (fields, types, etc.)
     */
    async getCreateMetadata(projectKeys?: string[], issueTypeNames?: string[]): Promise<any> {
        const params = new URLSearchParams();
        if (projectKeys) {
            params.append('projectKeys', projectKeys.join(','));
        }
        if (issueTypeNames) {
            params.append('issuetypeNames', issueTypeNames.join(','));
        }
        params.append('expand', 'projects.issuetypes.fields');
        return this.request(`/rest/api/3/issue/createmeta?${params.toString()}`);
    }

    /**
     * Get edit metadata for an issue
     */
    async getEditMetadata(issueKey: string): Promise<any> {
        return this.request(`/rest/api/3/issue/${issueKey}/editmeta`);
    }

    // ===== USER SEARCH =====

    /**
     * Find users assignable to issues
     */
    async findAssignableUsers(query: string, project?: string, issueKey?: string, maxResults: number = 50): Promise<any[]> {
        const params = new URLSearchParams({
            query,
            maxResults: maxResults.toString()
        });
        if (project) {
            params.append('project', project);
        }
        if (issueKey) {
            params.append('issueKey', issueKey);
        }
        return this.request(`/rest/api/3/user/assignable/search?${params.toString()}`);
    }

    /**
     * Search for users
     */
    async searchUsers(query: string, maxResults: number = 50): Promise<any[]> {
        const params = new URLSearchParams({
            query,
            maxResults: maxResults.toString()
        });
        return this.request(`/rest/api/3/user/search?${params.toString()}`);
    }

    // ===== COMMENTS MANAGEMENT =====

    /**
     * Get all comments for an issue
     */
    async getComments(issueKey: string, startAt: number = 0, maxResults: number = 50, orderBy?: string): Promise<any> {
        const params = new URLSearchParams({
            startAt: startAt.toString(),
            maxResults: maxResults.toString()
        });
        if (orderBy) {
            params.append('orderBy', orderBy);
        }
        return this.request(`/rest/api/3/issue/${issueKey}/comment?${params.toString()}`);
    }

    /**
     * Update a comment
     */
    async updateComment(issueKey: string, commentId: string, comment: string): Promise<any> {
        const body = {
            body: {
                type: 'doc',
                version: 1,
                content: [{
                    type: 'paragraph',
                    content: [{ type: 'text', text: comment }]
                }]
            }
        };
        return this.request(`/rest/api/3/issue/${issueKey}/comment/${commentId}`, 'PUT', body);
    }

    /**
     * Delete a comment
     */
    async deleteComment(issueKey: string, commentId: string): Promise<void> {
        await this.request(`/rest/api/3/issue/${issueKey}/comment/${commentId}`, 'DELETE');
    }

    // ===== ATTACHMENTS =====

    /**
     * Get attachment metadata
     */
    async getAttachment(attachmentId: string): Promise<any> {
        return this.request(`/rest/api/3/attachment/${attachmentId}`);
    }

    /**
     * Delete an attachment
     */
    async deleteAttachment(attachmentId: string): Promise<void> {
        await this.request(`/rest/api/3/attachment/${attachmentId}`, 'DELETE');
    }

    // ===== ISSUE LINKS =====

    /**
     * Create a link between two issues
     */
    async createIssueLink(inwardIssue: string, outwardIssue: string, linkType: string, comment?: string): Promise<any> {
        const body: any = {
            type: { name: linkType },
            inwardIssue: { key: inwardIssue },
            outwardIssue: { key: outwardIssue }
        };
        if (comment) {
            body.comment = {
                body: {
                    type: 'doc',
                    version: 1,
                    content: [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: comment }]
                    }]
                }
            };
        }
        return this.request('/rest/api/3/issueLink', 'POST', body);
    }

    /**
     * Delete an issue link
     */
    async deleteIssueLink(linkId: string): Promise<void> {
        await this.request(`/rest/api/3/issueLink/${linkId}`, 'DELETE');
    }

    /**
     * Get available issue link types
     */
    async getIssueLinkTypes(): Promise<any> {
        return this.request('/rest/api/3/issueLinkType');
    }

    // ===== WATCHERS =====

    /**
     * Get watchers of an issue
     */
    async getWatchers(issueKey: string): Promise<any> {
        return this.request(`/rest/api/3/issue/${issueKey}/watchers`);
    }

    /**
     * Add watcher to an issue
     */
    async addWatcher(issueKey: string, accountId: string): Promise<void> {
        await this.request(`/rest/api/3/issue/${issueKey}/watchers`, 'POST', `"${accountId}"`);
    }

    /**
     * Remove watcher from an issue
     */
    async removeWatcher(issueKey: string, accountId: string): Promise<void> {
        await this.request(`/rest/api/3/issue/${issueKey}/watchers?accountId=${accountId}`, 'DELETE');
    }

    // ===== PRIORITIES & STATUSES =====

    /**
     * Get all priorities
     */
    async getPriorities(): Promise<any[]> {
        return this.request('/rest/api/3/priority');
    }

    /**
     * Get all statuses
     */
    async getStatuses(): Promise<any[]> {
        return this.request('/rest/api/3/status');
    }

    /**
     * Get project details
     */
    async getProject(projectKey: string, expand?: string[]): Promise<any> {
        const params = expand ? new URLSearchParams({ expand: expand.join(',') }) : null;
        return this.request(`/rest/api/3/project/${projectKey}${params ? '?' + params.toString() : ''}`);
    }
}
