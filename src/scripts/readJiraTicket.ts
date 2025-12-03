/**
 * Read JIRA Ticket Details
 * 
 * This script fetches and displays details from a Jira ticket including:
 * - Summary, description, status, priority
 * - Assignee, reporter, dates
 * - Sub-tasks and linked issues
 * 
 * Usage: ts-node src/scripts/readJiraTicket.ts <JIRA-KEY>
 */

import * as dotenv from 'dotenv';
import { loadAtlassianConfig } from '../utils/configLoader';
import { JiraHelper } from '../helpers/jiraHelper';

// Load environment variables from .env file
dotenv.config();

async function main() {
    const jiraKey = process.argv[2];
    
    if (!jiraKey) {
        console.error('Usage: ts-node src/scripts/readJiraTicket.ts <JIRA-KEY>');
        process.exit(1);
    }

    console.log(`\n📋 Fetching JIRA ticket: ${jiraKey}\n`);

    try {
        const config = loadAtlassianConfig();
        if (!config) {
            console.error('❌ Atlassian configuration not found. Please configure Atlassian settings.');
            process.exit(1);
        }
        const jira = new JiraHelper(config);

        // Fetch the main issue
        const issue = await jira.getIssue(jiraKey);

        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`KEY:         ${issue.key}`);
        console.log(`SUMMARY:     ${issue.fields.summary}`);
        console.log(`TYPE:        ${issue.fields.issuetype?.name || 'N/A'}`);
        console.log(`STATUS:      ${issue.fields.status?.name || 'N/A'}`);
        console.log(`PRIORITY:    ${issue.fields.priority?.name || 'N/A'}`);
        console.log(`ASSIGNEE:    ${issue.fields.assignee?.displayName || 'Unassigned'}`);
        console.log(`REPORTER:    ${issue.fields.reporter?.displayName || 'N/A'}`);
        console.log(`CREATED:     ${issue.fields.created}`);
        console.log(`UPDATED:     ${issue.fields.updated}`);
        console.log('═══════════════════════════════════════════════════════════════');

        // Display description
        console.log('\n📝 DESCRIPTION:\n');
        if (issue.fields.description) {
            const description = formatDescription(issue.fields.description);
            console.log(description);
        } else {
            console.log('(No description)');
        }

        // Fetch and display sub-tasks if any
        console.log('\n📌 SUB-TASKS:\n');
        if (issue.fields.subtasks && issue.fields.subtasks.length > 0) {
            for (const subtask of issue.fields.subtasks) {
                console.log(`   - ${subtask.key}: ${subtask.fields.summary} [${subtask.fields.status.name}]`);
            }
        } else {
            console.log('   (No sub-tasks)');
        }

        // Fetch and display linked issues
        console.log('\n🔗 LINKED ISSUES:\n');
        const links = await jira.getIssueLinks(jiraKey);
        if (links && links.length > 0) {
            for (const link of links) {
                console.log(`   - ${link.type}: ${link.key} - ${link.summary} [${link.status}]`);
            }
        } else {
            console.log('   (No linked issues)');
        }

        // Display acceptance criteria if present
        console.log('\n✅ ACCEPTANCE CRITERIA:\n');
        const acceptanceCriteria = issue.fields.customfield_10100 || issue.fields.acceptanceCriteria;
        if (acceptanceCriteria) {
            const ac = formatDescription(acceptanceCriteria);
            console.log(ac);
        } else {
            console.log('   (No acceptance criteria defined)');
        }

        console.log('\n═══════════════════════════════════════════════════════════════\n');
        console.log('✅ Successfully fetched ticket details\n');

    } catch (error: any) {
        console.error('\n❌ Error fetching JIRA ticket:', error.message);
        process.exit(1);
    }
}

/**
 * Format Jira description (ADF or plain text) to readable console output
 */
function formatDescription(desc: any): string {
    if (!desc) return '(No description)';

    // If it's an Atlassian Document Format (ADF) object
    if (typeof desc === 'object' && desc.type === 'doc' && desc.content) {
        return formatADF(desc);
    }

    // If it's already a string
    if (typeof desc === 'string') {
        return desc;
    }

    // Fallback: JSON stringify
    return JSON.stringify(desc, null, 2);
}

/**
 * Convert Atlassian Document Format (ADF) to plain text
 */
function formatADF(adf: any): string {
    const lines: string[] = [];

    function processNode(node: any, indent: string = ''): void {
        if (!node) return;

        switch (node.type) {
            case 'paragraph': {
                const text = extractText(node);
                if (text) lines.push(indent + text);
                break;
            }
            case 'heading': {
                const headingText = extractText(node);
                const level = node.attrs?.level || 1;
                lines.push(indent + '#'.repeat(level) + ' ' + headingText);
                break;
            }
            case 'bulletList':
            case 'orderedList':
                if (node.content) {
                    node.content.forEach((item: any, index: number) => {
                        const bullet = node.type === 'bulletList' ? '•' : `${index + 1}.`;
                        processListItem(item, indent + `  ${bullet} `);
                    });
                }
                break;
            case 'codeBlock': {
                const code = extractText(node);
                lines.push(indent + '```');
                lines.push(indent + code);
                lines.push(indent + '```');
                break;
            }
            case 'panel':
                lines.push(indent + '┌─────────────────────────────────────────┐');
                if (node.content) {
                    node.content.forEach((child: any) => processNode(child, indent + '│ '));
                }
                lines.push(indent + '└─────────────────────────────────────────┘');
                break;
            default:
                // Recursively process content
                if (node.content) {
                    node.content.forEach((child: any) => processNode(child, indent));
                }
        }
    }

    function processListItem(item: any, prefix: string): void {
        if (item.content) {
            item.content.forEach((child: any, index: number) => {
                if (child.type === 'paragraph') {
                    const text = extractText(child);
                    lines.push((index === 0 ? prefix : '    ') + text);
                } else {
                    processNode(child, '    ');
                }
            });
        }
    }

    function extractText(node: any): string {
        if (!node) return '';
        if (node.type === 'text') return node.text || '';
        if (node.content) {
            return node.content.map(extractText).join('');
        }
        return '';
    }

    if (adf.content) {
        adf.content.forEach((node: any) => processNode(node));
    }

    return lines.join('\n');
}

main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});
