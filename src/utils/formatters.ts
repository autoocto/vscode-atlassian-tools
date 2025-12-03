import { JiraIssue } from '../helpers/jiraHelper';
import { ConfluencePage } from '../helpers/confluenceHelper';

/**
 * Format a Jira issue for display
 */
export function formatJiraIssue(issue: JiraIssue): string {
    return `
**${issue.key}**: ${issue.fields.summary}
**Status**: ${issue.fields.status?.name || 'Unknown'}
**Priority**: ${issue.fields.priority?.name || 'None'}
**Type**: ${issue.fields.issuetype?.name || 'Unknown'}
**Assignee**: ${issue.fields.assignee?.displayName || 'Unassigned'}
**Reporter**: ${issue.fields.reporter?.displayName || 'Unknown'}
**Created**: ${issue.fields.created}
**Updated**: ${issue.fields.updated}
`.trim();
}

/**
 * Format a Confluence page for display
 */
export function formatConfluencePage(page: ConfluencePage): string {
    const webUrl = page._links?.webui || '';
    return `
**${page.title}** (ID: ${page.id})
**Space**: ${page.space?.name || page.space?.key || 'Unknown'}
**Status**: ${page.status}
**Version**: ${page.version?.number || '1'}
${webUrl ? `**URL**: ${webUrl}` : ''}
`.trim();
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number = 500): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength) + '...';
}

/**
 * Format a list of Jira issues as a summary
 */
export function formatJiraIssueSummary(issues: JiraIssue[]): string {
    if (issues.length === 0) {
        return 'No issues found.';
    }

    const lines = issues.map(issue => 
        `- ${issue.key}: ${issue.fields.summary} [${issue.fields.status?.name}]`
    );

    return `Found ${issues.length} issue(s):\n${lines.join('\n')}`;
}

/**
 * Format a list of Confluence pages as a summary
 */
export function formatConfluencePageSummary(pages: ConfluencePage[]): string {
    if (pages.length === 0) {
        return 'No pages found.';
    }

    const lines = pages.map(page => 
        `- ${page.title} (${page.space?.key || 'Unknown'}) - ${page._links?.webui || page.id}`
    );

    return `Found ${pages.length} page(s):\n${lines.join('\n')}`;
}
