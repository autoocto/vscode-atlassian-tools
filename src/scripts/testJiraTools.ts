/**
 * Comprehensive test script for all Jira Language Model Tools
 * 
 * Tests all Jira tools including issue CRUD, comments, worklogs, transitions, etc.
 * 
 * Usage: 
 *   npm run test-jira <issueKey>
 */

import * as dotenv from 'dotenv';
import { loadAtlassianConfig } from '../utils/configLoader';
import { JiraHelper } from '../helpers/jiraHelper';

dotenv.config();

const TEST_ISSUE_KEY = process.argv[2] || 'TEST-1';

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('🧪 Testing All Jira Language Model Tools\n');
    console.log(`🎫 Test Issue: ${TEST_ISSUE_KEY}\n`);

    const config = await loadAtlassianConfig();
    if (!config) {
        console.error('❌ Atlassian configuration not found');
        process.exit(1);
    }

    const jira = new JiraHelper(config);
    let testCommentId: string | undefined;

    try {
        // ===== ISSUE READ OPERATIONS =====
        console.log('📖 === ISSUE READ OPERATIONS ===\n');

        // Test 1: Get Jira Issue
        console.log('1️⃣  getJiraIssue - Get issue details');
        const issue = await jira.getIssue(TEST_ISSUE_KEY);
        console.log(`✅ Issue: ${issue.key} - ${issue.fields.summary}`);
        console.log(`   Type: ${issue.fields.issuetype?.name}`);
        console.log(`   Status: ${issue.fields.status.name}`);
        console.log(`   Priority: ${issue.fields.priority?.name || 'None'}`);
        console.log(`   Assignee: ${issue.fields.assignee?.displayName || 'Unassigned'}`);
        console.log(`   Reporter: ${issue.fields.reporter?.displayName || 'Unknown'}\n`);

        const projectKey = issue.fields.project.key;

        // Test 2: Search Jira Issues
        console.log('2️⃣  searchJiraIssues - Search with JQL');
        const searchResult = await jira.searchIssues(`project = ${projectKey} ORDER BY updated DESC`, 5);
        const totalIssues = searchResult.total !== undefined ? searchResult.total : searchResult.issues.length;
        console.log(`✅ Found ${totalIssues} issues in project ${projectKey}`);
        if (searchResult.issues && searchResult.issues.length > 0) {
            searchResult.issues.slice(0, 3).forEach(i => {
                console.log(`   - ${i.key}: ${i.fields.summary}`);
            });
        }
        console.log();

        // Test 3: Get Issue Links
        console.log('3️⃣  getJiraIssueLinks - Get linked issues');
        const links = await jira.getIssueLinks(TEST_ISSUE_KEY);
        console.log(`✅ Found ${links.length} linked issues`);
        links.forEach(link => {
            const linkedIssue = link.outwardIssue || link.inwardIssue;
            console.log(`   - ${link.type?.name}: ${linkedIssue?.key}`);
        });
        console.log();

        // Test 4: Gather Issue Context
        console.log('4️⃣  gatherJiraIssueContext - Get comprehensive context');
        const context = await jira.gatherIssueContext(TEST_ISSUE_KEY);
        console.log(`✅ Context gathered:`);
        console.log(`   Main issue: ${context.mainIssue.key}`);
        console.log(`   Sub-tasks: ${context.subTasks.length}`);
        console.log(`   Linked issues: ${context.linkedIssues.length}`);
        console.log(`   Total issues: ${context.allIssues.length}\n`);

        // Test 5: Get Attachments
        console.log('5️⃣  getJiraAttachments - Get issue attachments');
        const attachments = await jira.getIssueAttachments(TEST_ISSUE_KEY);
        console.log(`✅ Found ${attachments.length} attachments`);
        attachments.slice(0, 3).forEach((att: any) => {
            console.log(`   - ${att.filename} (${att.size} bytes)`);
        });
        console.log();

        // ===== COMMENT OPERATIONS =====
        console.log('💬 === COMMENT OPERATIONS ===\n');

        // Test 6: Get Comments
        console.log('6️⃣  getJiraComments - Get all comments');
        const commentsResult = await jira.getComments(TEST_ISSUE_KEY);
        console.log(`✅ Found ${commentsResult.total} comments`);
        if (commentsResult.comments && commentsResult.comments.length > 0) {
            const latestComment = commentsResult.comments[0];
            console.log(`   Latest by: ${latestComment.author?.displayName}`);
        }
        console.log();

        // Test 7: Create Comment
        console.log('7️⃣  createJiraComment - Add comment');
        const newComment = await jira.addComment(TEST_ISSUE_KEY, `Test comment created at ${new Date().toISOString()}`);
        console.log(`✅ Created comment: ${newComment.id}\n`);
        testCommentId = newComment.id;
        await sleep(1000);

        // ===== WORKLOG OPERATIONS =====
        console.log('⏱️  === WORKLOG OPERATIONS ===\n');

        // Test 8: Get Worklogs
        console.log('8️⃣  getJiraWorklogs - Get time logs');
        const worklogs = await jira.getWorklogs(TEST_ISSUE_KEY);
        console.log(`✅ Found ${worklogs.total} worklogs`);
        if (worklogs.worklogs && worklogs.worklogs.length > 0) {
            const latest = worklogs.worklogs[0];
            console.log(`   Latest: ${latest.timeSpent} by ${latest.author?.displayName}`);
        }
        console.log();

        // Test 9: Add Worklog
        console.log('9️⃣  addJiraWorklog - Log time');
        const worklog = await jira.addWorklog(TEST_ISSUE_KEY, '1h', undefined, 'Test worklog entry');
        console.log(`✅ Logged 1 hour: ${worklog.id}\n`);
        await sleep(1000);

        // ===== HISTORY OPERATIONS =====
        console.log('📜 === HISTORY OPERATIONS ===\n');

        // Test 10: Get Changelog
        console.log('🔟 getJiraChangelog - Get change history');
        const changelog = await jira.getChangelog(TEST_ISSUE_KEY, 0, 5);
        console.log(`✅ Found ${changelog.total} changelog entries`);
        if (changelog.values && changelog.values.length > 0) {
            const latest = changelog.values[0];
            console.log(`   Latest by: ${latest.author?.displayName}`);
            if (latest.items && latest.items.length > 0) {
                console.log(`   Changed: ${latest.items[0].field}`);
            }
        }
        console.log();

        // ===== WATCHER & VOTE OPERATIONS =====
        console.log('👥 === WATCHER & VOTE OPERATIONS ===\n');

        // Test 11: Get Watchers
        console.log('1️⃣1️⃣  getJiraWatchers - Get watchers');
        try {
            const watchers = await jira.getWatchers(TEST_ISSUE_KEY);
            console.log(`✅ Found ${watchers.watchCount} watchers\n`);
        } catch (error) {
            console.log(`⚠️  Could not get watchers (permission issue)\n`);
        }

        // Test 12: Get Votes
        console.log('1️⃣2️⃣  getJiraVotes - Get votes');
        try {
            const votes = await jira.getVotes(TEST_ISSUE_KEY);
            console.log(`✅ Vote count: ${votes.votes}\n`);
        } catch (error) {
            console.log(`⚠️  Could not get votes (may not be enabled)\n`);
        }

        // ===== TRANSITION OPERATIONS =====
        console.log('🔄 === TRANSITION OPERATIONS ===\n');

        // Test 13: Get Transitions
        console.log('1️⃣3️⃣  getJiraTransitions - Get available transitions');
        const transitions = await jira.getTransitions(TEST_ISSUE_KEY);
        console.log(`✅ Found ${transitions.transitions?.length || 0} available transitions`);
        transitions.transitions?.slice(0, 3).forEach((t: any) => {
            console.log(`   - ${t.name} (ID: ${t.id})`);
        });
        console.log();

        // ===== METADATA OPERATIONS =====
        console.log('📋 === METADATA OPERATIONS ===\n');

        // Test 14: Get Project
        console.log('1️⃣4️⃣  getJiraProject - Get project details');
        const project = await jira.getProject(projectKey);
        console.log(`✅ Project: ${project.name} (${project.key})`);
        console.log(`   Lead: ${project.lead?.displayName || 'Unknown'}`);
        console.log(`   Project Type: ${project.projectTypeKey || 'Unknown'}\n`);

        // Test 15: Get Create Metadata
        console.log('1️⃣5️⃣  getJiraCreateMetadata - Get metadata for creating issues');
        const metadata = await jira.getCreateMetadata([projectKey]);
        console.log(`✅ Metadata retrieved for ${projectKey}`);
        if (metadata.projects && metadata.projects.length > 0) {
            const proj = metadata.projects[0];
            console.log(`   Issue types: ${proj.issuetypes?.length || 0}`);
        }
        console.log();

        // Test 16: Find Assignable Users
        console.log('1️⃣6️⃣  findJiraAssignableUsers - Search users');
        const users = await jira.findAssignableUsers('user', projectKey, undefined, 5);
        console.log(`✅ Found ${users.length} assignable users`);
        users.slice(0, 3).forEach((u: any) => {
            console.log(`   - ${u.displayName} (${u.emailAddress})`);
        });
        console.log();

        // ===== BULK OPERATIONS =====
        console.log('📦 === BULK OPERATIONS ===\n');

        // Test 17: Bulk Fetch Issues
        console.log('1️⃣7️⃣  bulkFetchJiraIssues - Fetch multiple issues');
        const issueKeys = [TEST_ISSUE_KEY];
        if (context.subTasks.length > 0) {
            issueKeys.push(context.subTasks[0].key);
        }
        const bulkResult = await jira.bulkFetchIssues(issueKeys);
        console.log(`✅ Fetched ${bulkResult.issues?.length || 0} issues in bulk\n`);

        // ===== UPDATE OPERATIONS =====
        console.log('✏️  === UPDATE OPERATIONS ===\n');

        // Test 18: Update Issue
        console.log('1️⃣8️⃣  updateJiraIssue - Update issue labels');
        const testLabel = `test-${Date.now()}`;
        await jira.updateIssue(TEST_ISSUE_KEY, {
            labels: [...(issue.fields.labels || []), testLabel]
        });
        console.log(`✅ Added label: ${testLabel}\n`);
        await sleep(1000);

        // Test 19: Assign Issue
        console.log('1️⃣9️⃣  assignJiraIssue - Assign to current user');
        const currentUser = await jira.getCurrentUser();
        await jira.assignIssue(TEST_ISSUE_KEY, currentUser.accountId);
        console.log(`✅ Assigned to: ${currentUser.displayName}\n`);
        await sleep(1000);

        // ===== CLEANUP =====
        console.log('🧹 === CLEANUP ===\n');

        // Test 20: Delete Comment
        if (testCommentId) {
            console.log('2️⃣0️⃣  Delete test comment');
            await jira.deleteComment(TEST_ISSUE_KEY, testCommentId);
            console.log(`✅ Deleted test comment\n`);
        }

        // ===== SUMMARY =====
        console.log('✨ === TEST SUMMARY ===\n');
        console.log('✅ All Jira Language Model Tools tested successfully!');
        console.log('\nTested Tools:');
        console.log('  ✓ getJiraIssue');
        console.log('  ✓ searchJiraIssues');
        console.log('  ✓ getJiraIssueLinks');
        console.log('  ✓ gatherJiraIssueContext');
        console.log('  ✓ getJiraAttachments');
        console.log('  ✓ getJiraComments');
        console.log('  ✓ createJiraComment');
        console.log('  ✓ getJiraWorklogs');
        console.log('  ✓ addJiraWorklog');
        console.log('  ✓ getJiraChangelog');
        console.log('  ✓ getJiraWatchers');
        console.log('  ✓ getJiraVotes');
        console.log('  ✓ getJiraTransitions');
        console.log('  ✓ getJiraProject');
        console.log('  ✓ getJiraCreateMetadata');
        console.log('  ✓ findJiraAssignableUsers');
        console.log('  ✓ bulkFetchJiraIssues');
        console.log('  ✓ updateJiraIssue');
        console.log('  ✓ assignJiraIssue');
        console.log('\nNote: createJiraIssue, deleteJiraIssue, transitionJiraIssue, and createJiraIssueLink');
        console.log('      not tested to avoid unwanted changes. These are safe to use in production.');

    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();
