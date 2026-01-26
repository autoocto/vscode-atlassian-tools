/**
 * Test script for creating and updating a Jira issue
 * Tests the fix for createIssue and updateIssue functionality
 */

import * as dotenv from 'dotenv';
import { loadAtlassianConfig } from '../utils/configLoader';
import { JiraHelper } from '../helpers/jiraHelper';

dotenv.config();

async function main() {
    console.log('🧪 Testing Jira Create and Update Issue\n');

    const config = await loadAtlassianConfig();
    if (!config) {
        console.error('❌ Atlassian configuration not found');
        process.exit(1);
    }

    const jira = new JiraHelper(config);
    let createdIssueKey: string | undefined;

    try {
        // Sample ticket data from user
        const projectKey = 'testproj';
        const issueType = 'Bug';
        const summary = 'Test Issue from Automated Script';
        const priority = 'High';
        const description = `test`;

        // ===== CREATE ISSUE =====
        console.log('📝 === CREATING JIRA ISSUE ===\n');
        console.log(`Project: ${projectKey}`);
        console.log(`Type: ${issueType}`);
        console.log(`Summary: ${summary}`);
        console.log(`Priority: ${priority}\n`);

        console.log('Creating issue...');
        const createdIssue = await jira.createIssue(projectKey, summary, issueType, description);
        createdIssueKey = createdIssue.key;

        console.log(`✅ Issue created successfully: ${createdIssue.key}`);
        console.log(`   Summary: ${createdIssue.fields.summary}`);
        console.log(`   Type: ${createdIssue.fields.issuetype?.name}`);
        console.log(`   Status: ${createdIssue.fields.status?.name}`);
        console.log(`   Priority: ${createdIssue.fields.priority?.name || 'None'}`);
        console.log(`   Reporter: ${createdIssue.fields.reporter?.displayName || 'Unknown'}\n`);

        // ===== UPDATE ISSUE =====
        console.log('🔄 === UPDATING JIRA ISSUE ===\n');
        
        // Update with labels and description append
        const updateFields: any = {};
        
        // Add labels
        updateFields.labels = ['dns-issue', 'pgbouncer', 'automated-test'];
        console.log(`Adding labels: dns-issue, pgbouncer, automated-test`);

        console.log('\nUpdating issue...');
        await jira.updateIssue(createdIssueKey, updateFields);
        console.log(`✅ Issue updated successfully: ${createdIssueKey}\n`);

        // Fetch updated issue to verify
        console.log('Fetching updated issue to verify changes...');
        const updatedIssue = await jira.getIssue(createdIssueKey);
        console.log(`✅ Verified issue: ${updatedIssue.key}`);
        console.log(`   Summary: ${updatedIssue.fields.summary}`);
        console.log(`   Priority: ${updatedIssue.fields.priority?.name || 'None'}`);
        console.log(`   Labels: ${updatedIssue.fields.labels?.join(', ') || 'None'}`);

        console.log('\n✅ All tests passed successfully!');
        console.log(`\n🎫 Created issue: ${createdIssueKey}`);
        console.log(`   You can view it in Jira or delete it manually if needed.\n`);

    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack);
        }
        process.exit(1);
    }
}

main();
