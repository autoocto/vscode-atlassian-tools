import * as vscode from 'vscode';
import { JiraHelper, JiraIssue } from '../helpers/jiraHelper';
import * as yamlConverters from '../utils/jiraYamlConverters';

export class JiraIssueWebviewProvider {
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentIssueKey: string | undefined;
    private static currentYamlUri: vscode.Uri | undefined;

    constructor(private helper: JiraHelper) {}

    public async showIssue(issueKey: string, yamlUri?: vscode.Uri): Promise<void> {
        JiraIssueWebviewProvider.currentIssueKey = issueKey;
        if (yamlUri) {
            JiraIssueWebviewProvider.currentYamlUri = yamlUri;
        }
        const issue = await this.helper.getIssue(issueKey);
        const commentsData = await this.helper.getComments(issueKey, 0, 100, '-created');
        const comments = commentsData.comments || [];

        if (JiraIssueWebviewProvider.currentPanel) {
            JiraIssueWebviewProvider.currentPanel.reveal(vscode.ViewColumn.Beside);
            JiraIssueWebviewProvider.currentPanel.webview.html = this.getWebviewContent(issue, comments);
        } else {
            const panel = vscode.window.createWebviewPanel(
                'jiraIssuePreview',
                `${issue.key}: ${issue.fields.summary}`,
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = this.getWebviewContent(issue, comments);

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'searchUsers': {
                            const users = await this.helper.searchUsers(message.query, 20);
                            panel.webview.postMessage({
                                command: 'usersSearchResult',
                                users: users.map((u: any) => ({
                                    accountId: u.accountId,
                                    displayName: u.displayName,
                                    emailAddress: u.emailAddress,
                                    avatarUrls: u.avatarUrls
                                }))
                            });
                            break;
                        }
                        case 'getTransitions': {
                            const transitions = await this.helper.getTransitions(issueKey);
                            panel.webview.postMessage({
                                command: 'transitionsResult',
                                transitions: transitions.transitions.map((t: any) => ({
                                    id: t.id,
                                    name: t.to.name
                                }))
                            });
                            break;
                        }
                        case 'getPriorities': {
                            const priorities = await this.helper.getPriorities();
                            panel.webview.postMessage({
                                command: 'prioritiesResult',
                                priorities: priorities.map((p: any) => ({
                                    id: p.id,
                                    name: p.name
                                }))
                            });
                            break;
                        }
                        case 'transitionStatus': {
                            await this.helper.transitionIssue(issueKey, message.transitionId);
                            vscode.window.showInformationMessage('Status updated');
                            await this.refreshWebview(issueKey);
                            await this.syncToYaml(issueKey);
                            break;
                        }
                        case 'assignIssue': {
                            await this.helper.assignIssue(issueKey, message.accountId);
                            vscode.window.showInformationMessage('Assignee updated');
                            await this.refreshWebview(issueKey);
                            await this.syncToYaml(issueKey);
                            break;
                        }
                        case 'updateField': {
                            await this.updateIssueField(issueKey, message.field, message.value);
                            await this.refreshWebview(issueKey);
                            await this.syncToYaml(issueKey);
                            break;
                        }
                        case 'addComment': {
                            const commentADF = this.convertToADF(message.comment);
                            await this.helper.addCommentADF(issueKey, commentADF);
                            vscode.window.showInformationMessage('Comment added');
                            await this.refreshWebview(issueKey);
                            break;
                        }
                        case 'updateComment': {
                            const commentADF = this.convertToADF(message.comment);
                            await this.helper.updateCommentADF(issueKey, message.commentId, commentADF);
                            vscode.window.showInformationMessage('Comment updated');
                            await this.refreshWebview(issueKey);
                            break;
                        }
                        case 'requestDeleteConfirmation': {
                            const result = await vscode.window.showWarningMessage(
                                'Delete this comment?',
                                { modal: true },
                                'Delete'
                            );
                            if (result === 'Delete') {
                                await this.helper.deleteComment(issueKey, message.commentId);
                                vscode.window.showInformationMessage('Comment deleted');
                                await this.refreshWebview(issueKey);
                            }
                            break;
                        }
                        case 'openInBrowser': {
                            const url = `${this.helper['config'].baseUrl}/browse/${issueKey}`;
                            vscode.env.openExternal(vscode.Uri.parse(url));
                            break;
                        }
                        case 'refresh': {
                            await this.refreshWebview(issueKey);
                            break;
                        }
                    }
                },
                undefined,
                []
            );

            panel.onDidDispose(() => {
                JiraIssueWebviewProvider.currentPanel = undefined;
            });

            JiraIssueWebviewProvider.currentPanel = panel;
        }
    }

    private async refreshWebview(issueKey: string): Promise<void> {
        if (JiraIssueWebviewProvider.currentPanel) {
            const issue = await this.helper.getIssue(issueKey);
            const comments = await this.helper.getComments(issueKey, 0, 100, '-created');
            JiraIssueWebviewProvider.currentPanel.webview.html = this.getWebviewContent(issue, comments.comments || []);
        }
    }

    private async syncToYaml(issueKey: string): Promise<void> {
        if (!JiraIssueWebviewProvider.currentYamlUri) {
            return;
        }
        
        try {
            const issue = await this.helper.getIssue(issueKey);
            const yamlContent = yamlConverters.issueToYaml(issue);
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                new vscode.Position(0, 0),
                new vscode.Position(Number.MAX_SAFE_INTEGER, 0)
            );
            edit.replace(JiraIssueWebviewProvider.currentYamlUri, fullRange, yamlContent);
            await vscode.workspace.applyEdit(edit);
        } catch (error) {
            console.error('Failed to sync to YAML:', error);
        }
    }

    public static async syncFromYaml(issueKey: string): Promise<void> {
        if (JiraIssueWebviewProvider.currentPanel && JiraIssueWebviewProvider.currentIssueKey === issueKey) {
            // Trigger a refresh of the webview content
            JiraIssueWebviewProvider.currentPanel.webview.postMessage({
                command: 'refresh'
            });
        }
    }

    private async updateIssueField(issueKey: string, field: string, value: any): Promise<void> {
        try {
            const fields: any = {};
            
            switch (field) {
                case 'summary':
                    fields.summary = value;
                    break;
                case 'description':
                    // Convert text with @mentions to ADF format
                    fields.description = this.convertToADF(value);
                    break;
                case 'priority':
                    // Priority requires id, not name
                    fields.priority = { id: value };
                    break;
            }

            if (Object.keys(fields).length > 0) {
                await this.helper.updateIssue(issueKey, fields);
                vscode.window.showInformationMessage(`${field} updated`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update ${field}: ${error}`);
        }
    }

    private convertToADF(text: string): any {
        // Convert text with @mentions to Atlassian Document Format
        // Format: @[displayName](accountId)
        const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
        const parts: any[] = [];
        let lastIndex = 0;
        let match;

        while ((match = mentionRegex.exec(text)) !== null) {
            // Add text before mention
            if (match.index > lastIndex) {
                const textBefore = text.substring(lastIndex, match.index);
                if (textBefore) {
                    parts.push({ type: 'text', text: textBefore });
                }
            }
            
            // Add mention
            parts.push({
                type: 'mention',
                attrs: {
                    id: match[2],
                    text: `@${match[1]}`
                }
            });
            
            lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text
        if (lastIndex < text.length) {
            parts.push({ type: 'text', text: text.substring(lastIndex) });
        }

        if (parts.length === 0 && text) {
            parts.push({ type: 'text', text });
        }

        return {
            type: 'doc',
            version: 1,
            content: [{
                type: 'paragraph',
                content: parts.length > 0 ? parts : [{ type: 'text', text: '' }]
            }]
        };
    }

    private getWebviewContent(issue: JiraIssue, comments: any[] = []): string {
        const description = this.formatDescription(issue.fields.description);
        const currentUser = this.helper['config'].email;
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${issue.key}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: var(--vscode-font-family);
            padding: 0;
            margin: 0;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        .toolbar {
            position: sticky;
            top: 0;
            background: var(--vscode-titleBar-activeBackground);
            padding: 10px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 10px;
            z-index: 100;
        }
        .content {
            padding: 20px;
        }
        h1 {
            color: var(--vscode-editor-foreground);
            border-bottom: 2px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-top: 0;
        }
        .metadata {
            display: grid;
            grid-template-columns: 120px auto;
            gap: 8px 15px;
            margin: 20px 0;
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
        }
        .label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
        }
        .value {
            color: var(--vscode-foreground);
        }
        .editable {
            cursor: pointer;
            padding: 2px 6px;
            border-radius: 3px;
            display: inline-block;
        }
        .editable:hover {
            background-color: var(--vscode-list-hoverBackground);
            text-decoration: underline;
        }
        input, select, textarea {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 10px;
            border-radius: 3px;
            font-family: var(--vscode-font-family);
            font-size: 13px;
            width: 100%;
        }
        textarea {
            min-height: 80px;
            resize: vertical;
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .edit-container {
            margin-top: 8px;
            display: none;
        }
        .edit-container.active {
            display: block;
        }
        .edit-actions {
            margin-top: 8px;
            display: flex;
            gap: 8px;
        }
        .user-search {
            position: relative;
        }
        .user-results {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 3px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        }
        .user-results.active {
            display: block;
        }
        .user-item {
            padding: 8px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .user-item:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .user-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
        }
        section {
            margin: 30px 0;
        }
        .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 15px;
            color: var(--vscode-editor-foreground);
        }
        .description {
            padding: 15px;
            background-color: var(--vscode-textCodeBlock-background);
            border-radius: 5px;
            line-height: 1.6;
        }
        .comment {
            padding: 12px;
            margin-bottom: 12px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 5px;
            border-left: 3px solid var(--vscode-textLink-foreground);
        }
        .comment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .comment-author {
            font-weight: bold;
            color: var(--vscode-foreground);
        }
        .comment-body {
            line-height: 1.5;
        }
        .comment-actions {
            margin-top: 8px;
            display: flex;
            gap: 8px;
        }
        .comment-actions button {
            padding: 4px 10px;
            font-size: 12px;
        }
        .comment-edit-form {
            margin-top: 8px;
        }
        .comment-edit-form textarea {
            width: 100%;
            min-height: 60px;
        }
        .new-comment {
            margin-top: 15px;
        }
        .mention {
            background: var(--vscode-textLink-activeForeground);
            color: var(--vscode-editor-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-weight: 500;
        }
        .status {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-in-progress {
            background-color: #0052cc;
            color: white;
        }
        .status-done {
            background-color: #00875a;
            color: white;
        }
        .status-todo {
            background-color: #dfe1e6;
            color: #172b4d;
        }
        .priority-high {
            color: #ff5630;
        }
        .priority-medium {
            color: #ffab00;
        }
        .priority-low {
            color: #36b37e;
        }
    </style>
</head>
<body>
    <div class="toolbar">
        <button onclick="openInBrowser()">🌐 Open in Browser</button>
        <button onclick="refresh()">🔄 Refresh</button>
    </div>
    
    <div class="content">
        <h1>${this.escapeHtml(issue.key)}: ${this.escapeHtml(issue.fields.summary)}</h1>
        
        <div class="metadata">
            <div class="label">Status:</div>
            <div class="value">
                <span class="status editable ${this.getStatusClass(issue.fields.status.name)}" onclick="editStatus()">
                    ${this.escapeHtml(issue.fields.status.name)}
                </span>
                <div id="statusEdit" class="edit-container">
                    <select id="statusSelect">
                        <option value="">Loading...</option>
                    </select>
                    <div class="edit-actions">
                        <button onclick="saveStatus()">Save</button>
                        <button class="secondary" onclick="cancelEdit('statusEdit')">Cancel</button>
                    </div>
                </div>
            </div>
            
            <div class="label">Type:</div>
            <div class="value">${this.escapeHtml(issue.fields.issuetype?.name || 'Unknown')}</div>
            
            <div class="label">Priority:</div>
            <div class="value">
                <span class="editable ${this.getPriorityClass(issue.fields.priority?.name)}" onclick="editPriority()">
                    ${this.escapeHtml(issue.fields.priority?.name || 'None')}
                </span>
                <div id="priorityEdit" class="edit-container">
                    <select id="prioritySelect" data-current-id="${issue.fields.priority?.id || ''}">
                        <option value="">Loading...</option>
                    </select>
                    <div class="edit-actions">
                        <button onclick="savePriority()">Save</button>
                        <button class="secondary" onclick="cancelEdit('priorityEdit')">Cancel</button>
                    </div>
                </div>
            </div>
            
            <div class="label">Assignee:</div>
            <div class="value">
                <span class="editable" onclick="editAssignee()">
                    ${this.escapeHtml(issue.fields.assignee?.displayName || 'Unassigned')}
                </span>
                <div id="assigneeEdit" class="edit-container user-search">
                    <input 
                        id="assigneeSearch" 
                        type="text" 
                        placeholder="Search users..." 
                        onkeyup="searchUsers(this.value)"
                    />
                    <div id="assigneeResults" class="user-results"></div>
                    <div class="edit-actions">
                        <button class="secondary" onclick="cancelEdit('assigneeEdit')">Cancel</button>
                    </div>
                </div>
            </div>
            
            <div class="label">Reporter:</div>
            <div class="value">${this.escapeHtml(issue.fields.reporter?.displayName || 'Unknown')}</div>
            
            <div class="label">Created:</div>
            <div class="value">${new Date(issue.fields.created).toLocaleString()}</div>
            
            <div class="label">Updated:</div>
            <div class="value">${new Date(issue.fields.updated).toLocaleString()}</div>
        </div>
        
        <section>
            <div class="section-title">Summary</div>
            <div>
                <span id="summaryDisplay" class="editable" onclick="editSummary()">
                    ${this.escapeHtml(issue.fields.summary)}
                </span>
                <div id="summaryEdit" class="edit-container">
                    <input id="summaryInput" type="text" value="${this.escapeHtml(issue.fields.summary)}" />
                    <div class="edit-actions">
                        <button onclick="saveSummary()">Save</button>
                        <button class="secondary" onclick="cancelEdit('summaryEdit')">Cancel</button>
                    </div>
                </div>
            </div>
        </section>
        
        <section>
            <div class="section-title">Description</div>
            <div>
                <div id="descriptionDisplay" class="description editable" onclick="editDescription()">
                    ${description}
                </div>
                <div id="descriptionEdit" class="edit-container">
                    <textarea id="descriptionInput">${this.extractPlainText(issue.fields.description)}</textarea>
                    <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 4px;">
                        Tip: Type @ to mention users. Format: @[Display Name](accountId)
                    </div>
                    <div class="edit-actions">
                        <button onclick="saveDescription()">Save</button>
                        <button class="secondary" onclick="cancelEdit('descriptionEdit')">Cancel</button>
                    </div>
                </div>
            </div>
        </section>
        
        <section>
            <div class="section-title">Comments (${comments.length})</div>
            <div id="commentsSection">
                ${this.renderComments(comments, currentUser)}
            </div>
            <div class="new-comment">
                <textarea id="newCommentInput" placeholder="Add a comment... Use @[Name](accountId) to mention users"></textarea>
                <div class="edit-actions">
                    <button onclick="addComment()">Add Comment</button>
                </div>
            </div>
        </section>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        let userSearchTimeout;
        let mentionSearchTimeout;
        let currentMentionInput = null;
        
        // Load available transitions and priorities when page loads
        window.addEventListener('load', () => {
            vscode.postMessage({ command: 'getTransitions' });
            vscode.postMessage({ command: 'getPriorities' });
        });
        
        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'transitionsResult':
                    const select = document.getElementById('statusSelect');
                    select.innerHTML = message.transitions.map(t => 
                        '<option value="' + t.id + '">' + t.name + '</option>'
                    ).join('');
                    break;
                case 'prioritiesResult':
                    const prioritySelect = document.getElementById('prioritySelect');
                    const currentId = prioritySelect.getAttribute('data-current-id');
                    prioritySelect.innerHTML = message.priorities.map(p => 
                        '<option value="' + p.id + '"' + (p.id === currentId ? ' selected' : '') + '>' + p.name + '</option>'
                    ).join('');
                    break;
                case 'usersSearchResult':
                    if (currentMentionInput) {
                        displayMentionResults(message.users);
                    } else {
                        displayUserResults(message.users);
                    }
                    break;
            }
        });
        
        function openInBrowser() {
            vscode.postMessage({ command: 'openInBrowser' });
        }
        
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
        
        function editStatus() {
            showEdit('statusEdit');
        }
        
        function saveStatus() {
            const select = document.getElementById('statusSelect');
            const transitionId = select.value;
            if (transitionId) {
                vscode.postMessage({
                    command: 'transitionStatus',
                    transitionId: transitionId
                });
                cancelEdit('statusEdit');
            }
        }
        
        function editPriority() {
            showEdit('priorityEdit');
        }
        
        function savePriority() {
            const value = document.getElementById('prioritySelect').value;
            vscode.postMessage({
                command: 'updateField',
                field: 'priority',
                value: value
            });
            cancelEdit('priorityEdit');
        }
        
        function editAssignee() {
            showEdit('assigneeEdit');
            // Show special options immediately
            displayUserResults([]);
            document.getElementById('assigneeSearch').focus();
        }
        
        function searchUsers(query) {
            clearTimeout(userSearchTimeout);
            if (query.length < 2) {
                // Still show special options
                displayUserResults([]);
                return;
            }
            userSearchTimeout = setTimeout(() => {
                vscode.postMessage({
                    command: 'searchUsers',
                    query: query
                });
            }, 300);
        }
        
        function displayUserResults(users) {
            const results = document.getElementById('assigneeResults');
            let html = '';
            
            // Add special options
            html += '<div class="user-item" onclick="selectUser(null, ' + "'Unassigned'" + ')">';
            html += '❌ <div><div>Unassigned</div></div></div>';
            html += '<div class="user-item" onclick="selectUser(' + "'-1'" + ', ' + "'Automatic'" + ')">';
            html += '⚙️ <div><div>Automatic</div></div></div>';
            
            // Add search results
            html += users.map(u => {
                const avatar = u.avatarUrls && u.avatarUrls['24x24'] 
                    ? '<img class="user-avatar" src="' + u.avatarUrls['24x24'] + '" />'
                    : '👤';
                return '<div class="user-item" onclick="selectUser(' + "'" + u.accountId + "', '" + 
                    escapeJs(u.displayName) + "'" + ')">' + avatar + '<div><div>' + 
                    escapeHtml(u.displayName) + '</div><div style="font-size: 11px; color: var(--vscode-descriptionForeground);">' + 
                    escapeHtml(u.emailAddress || '') + '</div></div></div>';
            }).join('');
            
            results.innerHTML = html;
            results.classList.add('active');
        }
        
        function selectUser(accountId, displayName) {
            vscode.postMessage({
                command: 'assignIssue',
                accountId: accountId
            });
            cancelEdit('assigneeEdit');
        }
        
        function editSummary() {
            showEdit('summaryEdit');
            document.getElementById('summaryInput').focus();
        }
        
        function saveSummary() {
            const value = document.getElementById('summaryInput').value;
            vscode.postMessage({
                command: 'updateField',
                field: 'summary',
                value: value
            });
            cancelEdit('summaryEdit');
        }
        
        function editDescription() {
            showEdit('descriptionEdit');
            document.getElementById('descriptionInput').focus();
        }
        
        function saveDescription() {
            const value = document.getElementById('descriptionInput').value;
            vscode.postMessage({
                command: 'updateField',
                field: 'description',
                value: value
            });
            cancelEdit('descriptionEdit');
        }
        
        function addComment() {
            const input = document.getElementById('newCommentInput');
            const comment = input.value.trim();
            if (comment) {
                vscode.postMessage({
                    command: 'addComment',
                    comment: comment
                });
                input.value = '';
            }
        }
        
        function editComment(commentId, currentBody) {
            // Hide all comment displays, show this edit form
            document.querySelectorAll('.comment-edit-form').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.comment-body').forEach(el => el.style.display = 'block');
            
            const commentEl = document.querySelector('[data-comment-id="' + commentId + '"]');
            if (commentEl) {
                commentEl.querySelector('.comment-body').style.display = 'none';
                const editForm = commentEl.querySelector('.comment-edit-form');
                editForm.style.display = 'block';
                editForm.querySelector('textarea').focus();
            }
        }
        
        function saveCommentEdit(commentId) {
            const commentEl = document.querySelector('[data-comment-id="' + commentId + '"]');
            const textarea = commentEl.querySelector('.comment-edit-form textarea');
            const comment = textarea.value.trim();
            if (comment) {
                vscode.postMessage({
                    command: 'updateComment',
                    commentId: commentId,
                    comment: comment
                });
            }
        }
        
        function cancelCommentEdit(commentId) {
            const commentEl = document.querySelector('[data-comment-id="' + commentId + '"]');
            commentEl.querySelector('.comment-body').style.display = 'block';
            commentEl.querySelector('.comment-edit-form').style.display = 'none';
        }
        
        function deleteComment(commentId) {
            vscode.postMessage({
                command: 'requestDeleteConfirmation',
                commentId: commentId
            });
        }
        
        // @ mention autocomplete
        function setupMentionAutocomplete() {
            const textareas = document.querySelectorAll('textarea');
            textareas.forEach(textarea => {
                textarea.addEventListener('input', handleMentionInput);
                textarea.addEventListener('keydown', handleMentionKeydown);
            });
        }
        
        function handleMentionInput(e) {
            const textarea = e.target;
            const cursorPos = textarea.selectionStart;
            const textBeforeCursor = textarea.value.substring(0, cursorPos);
            const atIndex = textBeforeCursor.lastIndexOf('@');
            
            if (atIndex !== -1) {
                const query = textBeforeCursor.substring(atIndex + 1);
                // Check if @ is at start or after whitespace
                if (atIndex === 0 || /\\s/.test(textBeforeCursor[atIndex - 1])) {
                    if (query.length >= 0 && !query.includes(' ')) {
                        currentMentionInput = textarea;
                        clearTimeout(mentionSearchTimeout);
                        mentionSearchTimeout = setTimeout(() => {
                            vscode.postMessage({
                                command: 'searchUsers',
                                query: query || 'a'
                            });
                        }, 300);
                        return;
                    }
                }
            }
            hideMentionResults();
        }
        
        function handleMentionKeydown(e) {
            const results = document.getElementById('mentionResults');
            if (results && results.classList.contains('active')) {
                if (e.key === 'Escape') {
                    hideMentionResults();
                    e.preventDefault();
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    // TODO: Add keyboard navigation
                    e.preventDefault();
                }
            }
        }
        
        function displayMentionResults(users) {
            let results = document.getElementById('mentionResults');
            if (!results) {
                results = document.createElement('div');
                results.id = 'mentionResults';
                results.className = 'user-results mention-results';
                document.body.appendChild(results);
            }
            
            results.innerHTML = users.map(u => {
                const avatar = u.avatarUrls && u.avatarUrls['24x24'] 
                    ? '<img class="user-avatar" src="' + u.avatarUrls['24x24'] + '" />'
                    : '👤';
                return '<div class="user-item" onclick="insertMention(' + "'" + 
                    escapeJs(u.displayName) + "', '" + u.accountId + "'" + ')">' + avatar + 
                    '<div><div>' + escapeHtml(u.displayName) + '</div></div></div>';
            }).join('');
            
            // Position near cursor
            if (currentMentionInput) {
                const rect = currentMentionInput.getBoundingClientRect();
                results.style.position = 'fixed';
                results.style.top = (rect.bottom + 5) + 'px';
                results.style.left = rect.left + 'px';
                results.style.width = '300px';
            }
            
            results.classList.add('active');
        }
        
        function insertMention(displayName, accountId) {
            if (!currentMentionInput) {return;}
            
            const textarea = currentMentionInput;
            const cursorPos = textarea.selectionStart;
            const textBeforeCursor = textarea.value.substring(0, cursorPos);
            const atIndex = textBeforeCursor.lastIndexOf('@');
            
            if (atIndex !== -1) {
                const textBefore = textarea.value.substring(0, atIndex);
                const textAfter = textarea.value.substring(cursorPos);
                const mention = '@[' + displayName + '](' + accountId + ')';
                textarea.value = textBefore + mention + ' ' + textAfter;
                textarea.selectionStart = textarea.selectionEnd = atIndex + mention.length + 1;
                textarea.focus();
            }
            
            hideMentionResults();
        }
        
        function hideMentionResults() {
            const results = document.getElementById('mentionResults');
            if (results) {
                results.classList.remove('active');
            }
            currentMentionInput = null;
        }
        
        function showEdit(editId) {
            document.querySelectorAll('.edit-container').forEach(el => {
                el.classList.remove('active');
            });
            document.getElementById(editId).classList.add('active');
        }
        
        function cancelEdit(editId) {
            document.getElementById(editId).classList.remove('active');
            const results = document.getElementById('assigneeResults');
            if (results) {
                results.classList.remove('active');
            }
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        function escapeJs(text) {
            return text.replace(/'/g, "\\\\'").replace(/"/g, '\\\\"');
        }
        
        // Initialize mention autocomplete on page load
        setupMentionAutocomplete();
    </script>
</body>
</html>`;
    }

    private formatDescription(description: any): string {
        if (!description) {
            return '<em>No description provided</em>';
        }

        if (typeof description === 'string') {
            return this.escapeHtml(description);
        }

        // Handle Atlassian Document Format (ADF)
        if (description.type === 'doc' && description.content) {
            return this.adfToHtml(description.content);
        }

        return this.escapeHtml(JSON.stringify(description, null, 2));
    }

    private adfToHtml(content: any[]): string {
        return content.map((node: any) => {
            if (node.type === 'paragraph') {
                if (!node.content) {return '<p></p>';}
                const html = node.content.map((c: any) => {
                    if (c.type === 'text') {
                        return this.escapeHtml(c.text);
                    }
                    if (c.type === 'mention') {
                        const name = c.attrs?.text || c.attrs?.id || 'user';
                        return `<span class="mention" style="background-color: var(--vscode-editor-inactiveSelectionBackground); padding: 2px 4px; border-radius: 3px;">${this.escapeHtml(name)}</span>`;
                    }
                    return '';
                }).join('');
                return `<p>${html}</p>`;
            }
            if (node.type === 'heading') {
                if (!node.content) {return '<h1></h1>';}
                const html = node.content.map((c: any) => {
                    if (c.type === 'text') {
                        return this.escapeHtml(c.text);
                    }
                    if (c.type === 'mention') {
                        const name = c.attrs?.text || c.attrs?.id || 'user';
                        return `<span class="mention" style="background-color: var(--vscode-editor-inactiveSelectionBackground); padding: 2px 4px; border-radius: 3px;">${this.escapeHtml(name)}</span>`;
                    }
                    return '';
                }).join('');
                const level = node.attrs?.level || 1;
                return `<h${level}>${html}</h${level}>`;
            }
            if (node.type === 'bulletList') {
                const items = node.content?.map((item: any) => {
                    const text = item.content?.[0]?.content?.[0]?.text || '';
                    return `<li>${this.escapeHtml(text)}</li>`;
                }).join('') || '';
                return `<ul>${items}</ul>`;
            }
            return '';
        }).join('');
    }

    private extractPlainText(description: any): string {
        if (!description) {
            return '';
        }
        if (typeof description === 'string') {
            return description;
        }
        // Extract text from ADF format
        if (description.type === 'doc' && description.content) {
            return this.adfToPlainText(description.content);
        }
        return JSON.stringify(description);
    }

    private adfToPlainText(content: any[]): string {
        return content.map((node: any) => {
            if (node.type === 'paragraph' || node.type === 'heading') {
                if (!node.content) {return '';}
                return node.content.map((c: any) => {
                    if (c.type === 'text') {
                        return c.text;
                    }
                    if (c.type === 'mention') {
                        // Convert mention to plain text format @[Name](id)
                        const name = c.attrs?.text || c.attrs?.id || 'user';
                        const id = c.attrs?.id || '';
                        return `@[${name}](${id})`;
                    }
                    return '';
                }).join('');
            }
            if (node.content) {
                return this.adfToPlainText(node.content);
            }
            return node.text || '';
        }).join('\n');
    }

    private renderComments(comments: any[], currentUser: string): string {
        if (!comments || comments.length === 0) {
            return '<p style="color: var(--vscode-descriptionForeground);">No comments yet</p>';
        }

        return comments.map((comment: any) => {
            const author = comment.author?.displayName || 'Unknown';
            const authorEmail = comment.author?.emailAddress || '';
            const created = new Date(comment.created).toLocaleString();
            const body = this.formatCommentBody(comment.body);
            const plainBody = this.extractPlainText(comment.body);
            const canEdit = authorEmail === currentUser;

            let html = `<div class="comment" data-comment-id="${comment.id}">`;
            html += '<div class="comment-header">';
            html += `<span class="comment-author">${this.escapeHtml(author)}</span>`;
            html += `<span>${created}</span>`;
            html += '</div>';
            html += `<div class="comment-body">${body}</div>`;
            if (canEdit) {
                html += `<div class="comment-edit-form" style="display:none;">`;
                html += `<textarea class="comment-edit-textarea">${this.escapeHtml(plainBody)}</textarea>`;
                html += '<div class="edit-actions">';
                html += `<button onclick="saveCommentEdit('${comment.id}')">Save</button>`;
                html += `<button class="secondary" onclick="cancelCommentEdit('${comment.id}')">Cancel</button>`;
                html += '</div>';
                html += '</div>';
                html += '<div class="comment-actions">';
                html += `<button class="secondary" onclick="editComment('${comment.id}')">Edit</button>`;
                html += `<button class="secondary" onclick="deleteComment('${comment.id}')">Delete</button>`;
                html += '</div>';
            }
            html += '</div>';
            return html;
        }).join('');
    }

    private formatCommentBody(body: any): string {
        if (!body) {
            return '';
        }
        if (typeof body === 'string') {
            return this.escapeHtml(body);
        }
        // Handle ADF format with mentions
        if (body.type === 'doc' && body.content) {
            return this.adfCommentToHtml(body.content);
        }
        return this.escapeHtml(JSON.stringify(body));
    }

    private adfCommentToHtml(content: any[]): string {
        return content.map((node: any) => {
            if (node.type === 'paragraph') {
                if (!node.content) {return '<p></p>';}
                const html = node.content.map((c: any) => {
                    if (c.type === 'text') {
                        return this.escapeHtml(c.text);
                    }
                    if (c.type === 'mention') {
                        const name = c.attrs?.text || c.attrs?.id || 'user';
                        return `<span class="mention" style="background-color: var(--vscode-editor-inactiveSelectionBackground); padding: 2px 4px; border-radius: 3px; font-weight: 500;">${this.escapeHtml(name)}</span>`;
                    }
                    return '';
                }).join('');
                return `<p>${html}</p>`;
            }
            return '';
        }).join('');
    }

    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private getStatusClass(status: string): string {
        const lower = status.toLowerCase();
        if (lower.includes('progress') || lower.includes('review')) {
            return 'status-in-progress';
        }
        if (lower.includes('done') || lower.includes('closed') || lower.includes('resolved')) {
            return 'status-done';
        }
        return 'status-todo';
    }

    private getPriorityClass(priority?: string): string {
        if (!priority) {return '';}
        const lower = priority.toLowerCase();
        if (lower.includes('high') || lower.includes('critical') || lower.includes('blocker')) {
            return 'priority-high';
        }
        if (lower.includes('medium')) {
            return 'priority-medium';
        }
        return 'priority-low';
    }
}
