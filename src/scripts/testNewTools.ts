/**
 * Test new Jira tools added based on OpenAPI spec
 * 
 * Usage: npx ts-node src/scripts/testNewTools.ts <issueKey>
 */

import * as dotenv from 'dotenv';
import { loadAtlassianConfig } from '../utils/configLoader';
import { JiraHelper } from '../helpers/jiraHelper';

// Load environment variables
dotenv.config();

async function main() {
    const issueKey = process.argv[2];
    
    if (!issueKey) {
        console.error('❌ Please provide an issue key');
        console.log('Usage: npx ts-node src/scripts/testNewTools.ts <issueKey>');
        process.exit(1);
    }

    console.log(`🧪 Testing new Jira tools with issue: ${issueKey}\n`);

    const config = await loadAtlassianConfig();
    if (!config) {
        console.error('❌ Atlassian configuration not found');
        process.exit(1);
    }
    const jira = new JiraHelper(config);

    try {
        // Test 1: Get Issue (existing)
        console.log('1️⃣  Testing getIssue...');
        const issue = await jira.getIssue(issueKey);
        console.log(`✅ Issue: ${issue.key} - ${issue.fields.summary}`);
        console.log(`   Status: ${issue.fields.status.name}`);

        // Test 2: Get Worklogs
        console.log('\n2️⃣  Testing getWorklogs...');
        const worklogs = await jira.getWorklogs(issueKey);
        console.log(`✅ Found ${worklogs.total} worklogs`);
        if (worklogs.worklogs && worklogs.worklogs.length > 0) {
            const firstLog = worklogs.worklogs[0];
            console.log(`   Latest: ${firstLog.timeSpent} by ${firstLog.author?.displayName}`);
        }

        // Test 3: Get Changelog
        console.log('\n3️⃣  Testing getChangelog...');
        const changelog = await jira.getChangelog(issueKey, 0, 5);
        console.log(`✅ Found ${changelog.total} changelog entries`);
        if (changelog.values && changelog.values.length > 0) {
            console.log(`   Latest change by: ${changelog.values[0].author?.displayName}`);
        }

        // Test 4: Get Comments
        console.log('\n4️⃣  Testing getComments...');
        const comments = await jira.getComments(issueKey);
        console.log(`✅ Found ${comments.total} comments`);
        if (comments.comments && comments.comments.length > 0) {
            console.log(`   Latest comment by: ${comments.comments[0].author?.displayName}`);
        }

        // Test 5: Get Create Metadata
        console.log('\n5️⃣  Testing getCreateMetadata...');
        const metadata = await jira.getCreateMetadata([issue.fields.project.key]);
        console.log(`✅ Got metadata for project: ${issue.fields.project.key}`);
        if (metadata.projects && metadata.projects.length > 0) {
            const project = metadata.projects[0];
            console.log(`   Project: ${project.name} (${project.key})`);
            console.log(`   Issue types: ${project.issuetypes?.length || 0}`);
        }

        // Test 6: Get Priorities
        console.log('\n6️⃣  Testing getPriorities...');
        const priorities = await jira.getPriorities();
        console.log(`✅ Found ${priorities.length} priorities`);
        console.log(`   Examples: ${priorities.slice(0, 3).map(p => p.name).join(', ')}`);

        // Test 7: Get Statuses
        console.log('\n7️⃣  Testing getStatuses...');
        const statuses = await jira.getStatuses();
        console.log(`✅ Found ${statuses.length} statuses`);
        console.log(`   Examples: ${statuses.slice(0, 3).map(s => s.name).join(', ')}`);

        // Test 8: Get Issue Link Types
        console.log('\n8️⃣  Testing getIssueLinkTypes...');
        const linkTypes = await jira.getIssueLinkTypes();
        console.log(`✅ Found ${linkTypes.issueLinkTypes?.length || 0} link types`);
        if (linkTypes.issueLinkTypes && linkTypes.issueLinkTypes.length > 0) {
            console.log(`   Examples: ${linkTypes.issueLinkTypes.slice(0, 3).map((t: any) => t.name).join(', ')}`);
        }

        // Test 9: Get Watchers
        console.log('\n9️⃣  Testing getWatchers...');
        try {
            const watchers = await jira.getWatchers(issueKey);
            console.log(`✅ Found ${watchers.watchCount} watchers`);
        } catch (error) {
            console.log(`⚠️  Could not get watchers (may not have permission)`);
        }

        // Test 10: Find Assignable Users
        console.log('\n🔟 Testing findAssignableUsers...');
        const users = await jira.findAssignableUsers('', issue.fields.project.key, issueKey);
        console.log(`✅ Found ${users.length} assignable users`);
        if (users.length > 0) {
            console.log(`   Examples: ${users.slice(0, 3).map(u => u.displayName).join(', ')}`);
        }

        // Test 11: Bulk Fetch (test with just this issue)
        console.log('\n1️⃣1️⃣  Testing bulkFetchIssues...');
        const bulkResult = await jira.bulkFetchIssues([issueKey]);
        console.log(`✅ Bulk fetched ${bulkResult.issues?.length || 0} issues`);

        // Test 12: Get Project
        console.log('\n1️⃣2️⃣  Testing getProject...');
        const project = await jira.getProject(issue.fields.project.key);
        console.log(`✅ Project: ${project.name} (${project.key})`);
        console.log(`   Lead: ${project.lead?.displayName || 'N/A'}`);

        console.log('\n✨ All tests completed successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

main();
