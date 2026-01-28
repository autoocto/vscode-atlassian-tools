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
        assignee?: { displayName: string; emailAddress: string; accountId?: string };
        reporter?: { displayName: string; emailAddress: string };
        created: string;
        updated: string;
        description?: any;
        priority?: { name: string; id?: string };
        issuetype?: { name: string };
        [key: string]: any;
    };
}

export interface JiraSearchResult {
    issues: JiraIssue[];
    total?: number; // Legacy API field
    maxResults?: number; // Legacy API field
    startAt?: number; // Legacy API field
    isLast?: boolean; // New API field
    nextPageToken?: string; // New API field
    names?: Record<string, string>; // New API field
    schema?: Record<string, any>; // New API field
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
            startAt: startAt.toString(),
            fields: '*all' // Request all fields (new API defaults to 'id' only)
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
        const createResponse = await this.request<{ id: string; key: string; self: string }>('/rest/api/3/issue', 'POST', body);
        return this.getIssue(createResponse.key);
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
     * Add a comment to an issue using ADF format
     */
    async addCommentADF(issueKey: string, adfContent: any): Promise<any> {
        const body = { body: adfContent };
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
        // Format date as Jira expects: yyyy-MM-dd'T'HH:mm:ss.SSSZ with numeric timezone
        const formatDate = (date: Date): string => {
            const offset = -date.getTimezoneOffset();
            const sign = offset >= 0 ? '+' : '-';
            const pad = (num: number) => String(Math.abs(num)).padStart(2, '0');
            const hrs = pad(Math.floor(Math.abs(offset) / 60));
            const mins = pad(Math.abs(offset) % 60);
            
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T` +
                   `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
                   `${String(date.getMilliseconds()).padStart(3, '0')}${sign}${hrs}${mins}`;
        };

        const body: any = {
            timeSpent,
            started: started || formatDate(new Date())
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
     * Update a comment using ADF format
     */
    async updateCommentADF(issueKey: string, commentId: string, adfContent: any): Promise<any> {
        const body = { body: adfContent };
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
        // Jira API expects the accountId as a plain JSON string value
        await this.request(`/rest/api/3/issue/${issueKey}/watchers`, 'POST', accountId);
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

    // ===== ISSUE MANAGEMENT =====

    /**
     * Assign issue to a user
     */
    async assignIssue(issueKey: string, accountId: string | null): Promise<void> {
        const body = accountId ? { accountId } : { accountId: null };
        await this.request(`/rest/api/3/issue/${issueKey}/assignee`, 'PUT', body);
    }

    /**
     * Delete an issue
     */
    async deleteIssue(issueKey: string, deleteSubtasks: boolean = false): Promise<void> {
        const params = deleteSubtasks ? '?deleteSubtasks=true' : '';
        await this.request(`/rest/api/3/issue/${issueKey}${params}`, 'DELETE');
    }

    /**
     * Get attachments for an issue
     */
    async getIssueAttachments(issueKey: string): Promise<any[]> {
        const issue = await this.getIssue(issueKey);
        return issue.fields.attachment || [];
    }

    /**
     * Get votes for an issue
     */
    async getVotes(issueKey: string): Promise<any> {
        return this.request(`/rest/api/3/issue/${issueKey}/votes`);
    }

    /**
     * Add vote to an issue
     */
    async addVote(issueKey: string): Promise<void> {
        await this.request(`/rest/api/3/issue/${issueKey}/votes`, 'POST');
    }

    /**
     * Remove vote from an issue
     */
    async removeVote(issueKey: string): Promise<void> {
        await this.request(`/rest/api/3/issue/${issueKey}/votes`, 'DELETE');
    }

    /**
     * Get project versions (releases)
     */
    async getProjectVersions(projectKey: string): Promise<any[]> {
        return this.request<any[]>(`/rest/api/3/project/${projectKey}/versions`);
    }

    /**
     * Get a specific version details
     */
    async getVersion(versionId: string): Promise<any> {
        return this.request<any>(`/rest/api/3/version/${versionId}`);
    }

    /**
     * Get version's related issues counts (done, to-do, in-progress)
     */
    async getVersionRelatedIssues(versionId: string): Promise<any> {
        return this.request<any>(`/rest/api/3/version/${versionId}/relatedIssueCounts`);
    }

    /**
     * Get unresolved issue count for a version
     */
    async getVersionUnresolvedIssues(versionId: string): Promise<any> {
        return this.request<any>(`/rest/api/3/version/${versionId}/unresolvedIssueCount`);
    }

    /**
     * Get all epics in a project
     */
    async getEpics(projectKey: string, maxResults: number = 50): Promise<JiraIssue[]> {
        const jql = `project = "${projectKey}" AND issuetype = Epic ORDER BY created DESC`;
        const result = await this.searchIssues(jql, maxResults);
        return result.issues;
    }

    /**
     * Get epic details including child issues
     */
    async getEpicDetails(epicKey: string): Promise<{
        epic: JiraIssue;
        childIssues: JiraIssue[];
        progress: {
            total: number;
            done: number;
            inProgress: number;
            toDo: number;
        };
    }> {
        const epic = await this.getIssue(epicKey);
        
        // Get all issues in this epic
        const jql = `"Epic Link" = ${epicKey} OR parent = ${epicKey}`;
        const childResult = await this.searchIssues(jql, 1000);
        
        // Calculate progress
        let done = 0;
        let inProgress = 0;
        let toDo = 0;
        
        childResult.issues.forEach(issue => {
            const status = issue.fields.status.name.toLowerCase();
            if (status.includes('done') || status.includes('closed') || status.includes('resolved')) {
                done++;
            } else if (status.includes('progress') || status.includes('review')) {
                inProgress++;
            } else {
                toDo++;
            }
        });
        
        return {
            epic,
            childIssues: childResult.issues,
            progress: {
                total: childResult.issues.length,
                done,
                inProgress,
                toDo
            }
        };
    }

    /**
     * Get project summary with key metrics
     */
    async getProjectSummary(projectKey: string): Promise<{
        project: any;
        issueCount: {
            total: number;
            done: number;
            inProgress: number;
            toDo: number;
            byType: Record<string, number>;
            byPriority: Record<string, number>;
        };
        recentActivity: JiraIssue[];
    }> {
        const project = await this.getProject(projectKey, ['description', 'lead', 'issueTypes']);
        
        // Get all issues in project
        const allIssuesResult = await this.searchIssues(`project = "${projectKey}"`, 1000);
        
        // Count by status category
        let done = 0;
        let inProgress = 0;
        let toDo = 0;
        const byType: Record<string, number> = {};
        const byPriority: Record<string, number> = {};
        
        allIssuesResult.issues.forEach(issue => {
            const status = issue.fields.status.name.toLowerCase();
            if (status.includes('done') || status.includes('closed') || status.includes('resolved')) {
                done++;
            } else if (status.includes('progress') || status.includes('review')) {
                inProgress++;
            } else {
                toDo++;
            }
            
            // Count by type
            const type = issue.fields.issuetype?.name || 'Unknown';
            byType[type] = (byType[type] || 0) + 1;
            
            // Count by priority
            const priority = issue.fields.priority?.name || 'None';
            byPriority[priority] = (byPriority[priority] || 0) + 1;
        });
        
        // Get recent activity (last 10 updated issues)
        const recentResult = await this.searchIssues(
            `project = "${projectKey}" ORDER BY updated DESC`,
            10
        );
        
        return {
            project,
            issueCount: {
                total: allIssuesResult.issues.length,
                done,
                inProgress,
                toDo,
                byType,
                byPriority
            },
            recentActivity: recentResult.issues
        };
    }

    /**
     * Get all epics with their progress for a project
     */
    async getEpicsProgress(projectKey: string): Promise<Array<{
        epic: JiraIssue;
        progress: {
            total: number;
            done: number;
            inProgress: number;
            toDo: number;
            percentComplete: number;
        };
    }>> {
        const epics = await this.getEpics(projectKey, 100);
        
        const epicsWithProgress = await Promise.all(
            epics.map(async (epic) => {
                const details = await this.getEpicDetails(epic.key);
                const percentComplete = details.progress.total > 0
                    ? Math.round((details.progress.done / details.progress.total) * 100)
                    : 0;
                
                return {
                    epic,
                    progress: {
                        ...details.progress,
                        percentComplete
                    }
                };
            })
        );
        
        return epicsWithProgress;
    }

    /**
     * Get component details for a project
     */
    async getProjectComponents(projectKey: string): Promise<any[]> {
        return this.request<any[]>(`/rest/api/3/project/${projectKey}/components`);
    }

    /**
     * Get issues by component
     */
    async getComponentIssues(componentId: string, maxResults: number = 50): Promise<JiraIssue[]> {
        const jql = `component = ${componentId} ORDER BY updated DESC`;
        const result = await this.searchIssues(jql, maxResults);
        return result.issues;
    }

    /**
     * Get project roles
     */
    async getProjectRoles(projectKey: string): Promise<any> {
        return this.request<any>(`/rest/api/3/project/${projectKey}/role`);
    }

    /**
     * Get statuses for a project
     */
    async getProjectStatuses(projectKey: string): Promise<any[]> {
        return this.request<any[]>(`/rest/api/3/project/${projectKey}/statuses`);
    }

    // ===== VERSION MANAGEMENT =====

    /**
     * Create a new version in a project
     */
    async createVersion(projectKey: string, name: string, options?: {
        description?: string;
        startDate?: string;
        releaseDate?: string;
        released?: boolean;
        archived?: boolean;
    }): Promise<any> {
        // First get the project to get its ID
        const project = await this.getProject(projectKey);
        const body: any = {
            projectId: parseInt(project.id),
            name,
            ...options
        };
        return this.request('/rest/api/3/version', 'POST', body);
    }

    /**
     * Update a version
     */
    async updateVersion(versionId: string, fields: {
        name?: string;
        description?: string;
        startDate?: string;
        releaseDate?: string;
        released?: boolean;
        archived?: boolean;
    }): Promise<any> {
        return this.request(`/rest/api/3/version/${versionId}`, 'PUT', fields);
    }

    /**
     * Delete a version
     */
    async deleteVersion(versionId: string, moveFixIssuesTo?: string, moveAffectedIssuesTo?: string): Promise<void> {
        const params = new URLSearchParams();
        if (moveFixIssuesTo) {
            params.append('moveFixIssuesTo', moveFixIssuesTo);
        }
        if (moveAffectedIssuesTo) {
            params.append('moveAffectedIssuesTo', moveAffectedIssuesTo);
        }
        const queryString = params.toString();
        await this.request(`/rest/api/3/version/${versionId}${queryString ? '?' + queryString : ''}`, 'DELETE');
    }

    /**
     * Release a version (mark as released)
     */
    async releaseVersion(versionId: string): Promise<any> {
        return this.updateVersion(versionId, { released: true });
    }

    /**
     * Archive a version
     */
    async archiveVersion(versionId: string): Promise<any> {
        return this.updateVersion(versionId, { archived: true });
    }

    // ===== COMPONENT MANAGEMENT =====

    /**
     * Create a new component in a project
     */
    async createComponent(projectKey: string, name: string, options?: {
        description?: string;
        leadAccountId?: string;
        assigneeType?: 'PROJECT_DEFAULT' | 'COMPONENT_LEAD' | 'PROJECT_LEAD' | 'UNASSIGNED';
    }): Promise<any> {
        const body: any = {
            project: projectKey,
            name,
            ...options
        };
        return this.request('/rest/api/3/component', 'POST', body);
    }

    /**
     * Update a component
     */
    async updateComponent(componentId: string, fields: {
        name?: string;
        description?: string;
        leadAccountId?: string;
        assigneeType?: 'PROJECT_DEFAULT' | 'COMPONENT_LEAD' | 'PROJECT_LEAD' | 'UNASSIGNED';
    }): Promise<any> {
        return this.request(`/rest/api/3/component/${componentId}`, 'PUT', fields);
    }

    /**
     * Delete a component
     */
    async deleteComponent(componentId: string, moveIssuesTo?: string): Promise<void> {
        const params = moveIssuesTo ? `?moveIssuesTo=${moveIssuesTo}` : '';
        await this.request(`/rest/api/3/component/${componentId}${params}`, 'DELETE');
    }

    /**
     * Get a single component by ID
     */
    async getComponent(componentId: string): Promise<any> {
        return this.request(`/rest/api/3/component/${componentId}`);
    }

    /**
     * Get count of issues for a component
     */
    async getComponentIssueCount(componentId: string): Promise<any> {
        return this.request(`/rest/api/3/component/${componentId}/relatedIssueCounts`);
    }

    // ===== EPIC MANAGEMENT (via issue type) =====

    /**
     * Create an Epic issue
     */
    async createEpic(projectKey: string, summary: string, description?: string): Promise<JiraIssue> {
        return this.createIssue(projectKey, summary, 'Epic', description);
    }

    /**
     * Add an issue to an epic (link child to epic)
     */
    async addIssueToEpic(epicKey: string, issueKey: string): Promise<void> {
        // Update the issue's Epic Link field
        // This requires knowing the custom field ID for Epic Link
        // A more reliable approach is to use the parent field in next-gen projects
        await this.updateIssue(issueKey, { parent: { key: epicKey } });
    }

    /**
     * Remove an issue from an epic
     */
    async removeIssueFromEpic(issueKey: string): Promise<void> {
        await this.updateIssue(issueKey, { parent: null });
    }

    /**
     * Get all issues in an epic
     */
    async getEpicIssues(epicKey: string, maxResults: number = 100): Promise<JiraIssue[]> {
        const jql = `"Epic Link" = ${epicKey} OR parent = ${epicKey}`;
        const result = await this.searchIssues(jql, maxResults);
        return result.issues;
    }
}

