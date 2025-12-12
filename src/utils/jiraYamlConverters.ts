import * as yaml from 'js-yaml';
import { JiraIssue } from '../helpers/jiraHelper';

export function issueToYaml(issue: JiraIssue): string {
    const data = {
        entityType: 'issue',
        key: issue.key,
        id: issue.id,
        fields: {
            summary: issue.fields.summary,
            description: issue.fields.description || '',
            status: issue.fields.status?.name || '',
            assignee: issue.fields.assignee?.displayName || '',
            assigneeEmail: issue.fields.assignee?.emailAddress || '',
            reporter: issue.fields.reporter?.displayName || '',
            reporterEmail: issue.fields.reporter?.emailAddress || '',
            priority: issue.fields.priority?.name || '',
            issuetype: issue.fields.issuetype?.name || '',
            created: issue.fields.created,
            updated: issue.fields.updated,
            // Include other custom fields
            ...Object.keys(issue.fields)
                .filter(key => key.startsWith('customfield_'))
                .reduce((acc, key) => {
                    acc[key] = issue.fields[key];
                    return acc;
                }, {} as Record<string, any>)
        }
    };

    return yaml.dump(data, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
    });
}

export function yamlToIssue(yamlContent: string): Partial<JiraIssue> {
    const data = yaml.load(yamlContent) as any;
    
    return {
        key: data.key,
        id: data.id,
        fields: {
            summary: data.fields?.summary || '',
            description: data.fields?.description,
            status: data.fields?.status ? { name: data.fields.status } : undefined,
            assignee: data.fields?.assigneeEmail ? {
                displayName: data.fields.assignee,
                emailAddress: data.fields.assigneeEmail
            } : undefined,
            reporter: data.fields?.reporterEmail ? {
                displayName: data.fields.reporter,
                emailAddress: data.fields.reporterEmail
            } : undefined,
            priority: data.fields?.priority ? { name: data.fields.priority } : undefined,
            issuetype: data.fields?.issuetype ? { name: data.fields.issuetype } : undefined,
            created: data.fields?.created,
            updated: data.fields?.updated
        } as any
    };
}

export function newIssueToYaml(projectKey: string): string {
    const data = {
        entityType: 'issue',
        key: 'NEW',
        id: 'new',
        projectKey: projectKey,
        fields: {
            summary: 'New Issue Title',
            description: 'Issue description here...',
            issuetype: 'Task',
            priority: 'Medium',
            assignee: '',
            assigneeEmail: ''
        }
    };

    return yaml.dump(data, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
    });
}

export function extractIssueFields(yamlContent: string): any {
    const data = yaml.load(yamlContent) as any;
    
    const fields: any = {
        summary: data.fields?.summary
    };

    if (data.fields?.description) {
        fields.description = data.fields.description;
    }

    if (data.fields?.priority) {
        fields.priority = { name: data.fields.priority };
    }

    if (data.fields?.assigneeEmail) {
        fields.assignee = { accountId: data.fields.assigneeEmail }; // This would need proper user lookup
    }

    // Do NOT include custom fields when updating - they cause errors
    // Custom fields are read-only for most Jira configurations

    return fields;
}
