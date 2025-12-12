import * as vscode from 'vscode';
import { JiraHelper, JiraIssue } from '../helpers/jiraHelper';

export class JiraTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly contextValue: 'category' | 'issue',
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemId?: string,
        public readonly issue?: JiraIssue
    ) {
        super(label, collapsibleState);
        
        if (contextValue === 'issue' && issue) {
            this.description = issue.fields.status.name;
            this.tooltip = `${issue.key}: ${issue.fields.summary}\nStatus: ${issue.fields.status.name}`;
            this.command = {
                command: 'jira.openIssue',
                title: 'Open Jira Issue',
                arguments: [this]
            };
            
            // Set icon based on issue type
            const issueType = issue.fields.issuetype?.name?.toLowerCase() || '';
            if (issueType.includes('bug')) {
                this.iconPath = new vscode.ThemeIcon('bug');
            } else if (issueType.includes('task')) {
                this.iconPath = new vscode.ThemeIcon('checklist');
            } else if (issueType.includes('story')) {
                this.iconPath = new vscode.ThemeIcon('book');
            } else {
                this.iconPath = new vscode.ThemeIcon('circle-outline');
            }
        } else if (contextValue === 'category') {
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}

export class JiraTreeProvider implements vscode.TreeDataProvider<JiraTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<JiraTreeItem | undefined | null | void> = new vscode.EventEmitter<JiraTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<JiraTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private assignedIssuesCache: JiraIssue[] | null = null;
    private reportedIssuesCache: JiraIssue[] | null = null;
    private recentIssuesCache: JiraIssue[] | null = null;

    constructor(private helper: JiraHelper | null) {}

    refresh(): void {
        this.assignedIssuesCache = null;
        this.reportedIssuesCache = null;
        this.recentIssuesCache = null;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: JiraTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: JiraTreeItem): Promise<JiraTreeItem[]> {
        if (!this.helper) {
            return [];
        }

        try {
            if (!element) {
                // Root level - show categories
                return [
                    new JiraTreeItem('Assigned to Me', 'category', vscode.TreeItemCollapsibleState.Collapsed, 'assigned'),
                    new JiraTreeItem('Reported by Me', 'category', vscode.TreeItemCollapsibleState.Collapsed, 'reported'),
                    new JiraTreeItem('Recent', 'category', vscode.TreeItemCollapsibleState.Collapsed, 'recent')
                ];
            }

            // Category level - show issues
            if (element.contextValue === 'category') {
                let issues: JiraIssue[] = [];

                switch (element.itemId) {
                    case 'assigned':
                        if (!this.assignedIssuesCache) {
                            this.assignedIssuesCache = await this.helper.getMyIssues(50);
                        }
                        issues = this.assignedIssuesCache;
                        break;

                    case 'reported':
                        if (!this.reportedIssuesCache) {
                            const result = await this.helper.searchIssues('reporter = currentUser() ORDER BY updated DESC', 50);
                            this.reportedIssuesCache = result.issues;
                        }
                        issues = this.reportedIssuesCache;
                        break;

                    case 'recent':
                        if (!this.recentIssuesCache) {
                            const result = await this.helper.searchIssues('updated >= -7d ORDER BY updated DESC', 50);
                            this.recentIssuesCache = result.issues;
                        }
                        issues = this.recentIssuesCache;
                        break;
                }

                return issues.map(issue => 
                    new JiraTreeItem(
                        `${issue.key}: ${issue.fields.summary}`,
                        'issue',
                        vscode.TreeItemCollapsibleState.None,
                        issue.key,
                        issue
                    )
                );
            }

            return [];
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load Jira issues: ${error}`);
            return [];
        }
    }
}
