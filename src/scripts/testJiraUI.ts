#!/usr/bin/env ts-node
import { loadAtlassianConfig } from '../utils/configLoader';
import { JiraHelper } from '../helpers/jiraHelper';

async function testJiraUI() {
    console.log('Testing Jira UI components...\n');

    const config = loadAtlassianConfig();
    if (!config) {
        console.error('❌ Atlassian configuration not found. Please set environment variables or VS Code settings.');
        process.exit(1);
    }

    const helper = new JiraHelper(config);

    try {
        // Test 1: Get assigned issues (simulates tree provider "Assigned to Me")
        console.log('Test 1: Fetching issues assigned to me...');
        const assignedIssues = await helper.getMyIssues(5);
        console.log(`✓ Found ${assignedIssues.length} assigned issues`);
        assignedIssues.forEach(issue => {
            console.log(`  - ${issue.key}: ${issue.fields.summary} (${issue.fields.status.name})`);
        });
        console.log('');

        // Test 2: Get reported issues (simulates tree provider "Reported by Me")
        console.log('Test 2: Fetching issues reported by me...');
        const reportedResult = await helper.searchIssues('reporter = currentUser() ORDER BY updated DESC', 5);
        console.log(`✓ Found ${reportedResult.issues.length} reported issues`);
        reportedResult.issues.forEach(issue => {
            console.log(`  - ${issue.key}: ${issue.fields.summary} (${issue.fields.status.name})`);
        });
        console.log('');

        // Test 3: Get recent issues (simulates tree provider "Recent")
        console.log('Test 3: Fetching recently updated issues...');
        const recentResult = await helper.searchIssues('updated >= -7d ORDER BY updated DESC', 5);
        console.log(`✓ Found ${recentResult.issues.length} recent issues`);
        recentResult.issues.forEach(issue => {
            console.log(`  - ${issue.key}: ${issue.fields.summary} (updated: ${issue.fields.updated})`);
        });
        console.log('');

        // Test 4: Get single issue (simulates opening issue in editor)
        if (assignedIssues.length > 0) {
            const issueKey = assignedIssues[0].key;
            console.log(`Test 4: Fetching full details for ${issueKey}...`);
            const issue = await helper.getIssue(issueKey);
            console.log(`✓ Retrieved issue: ${issue.key}`);
            console.log(`  Summary: ${issue.fields.summary}`);
            console.log(`  Status: ${issue.fields.status.name}`);
            console.log(`  Assignee: ${issue.fields.assignee?.displayName || 'Unassigned'}`);
            console.log(`  Reporter: ${issue.fields.reporter?.displayName || 'Unknown'}`);
            console.log('');

            // Test 5: Get transitions (simulates status change dropdown)
            console.log(`Test 5: Fetching available transitions for ${issueKey}...`);
            const transitions = await helper.getTransitions(issueKey);
            console.log(`✓ Found ${transitions.transitions.length} available transitions`);
            transitions.transitions.forEach((t: any) => {
                console.log(`  - ${t.name} (ID: ${t.id})`);
            });
            console.log('');
        }

        console.log('✅ All Jira UI tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testJiraUI();
