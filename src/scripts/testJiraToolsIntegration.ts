/**
 * Jira Tools Integration Tests
 * 
 * This test file validates all Jira Language Model tools by making real API calls.
 * Tests are organized into the same 6 groups as jiraTools.ts:
 * 
 * Group 1: Issue Operations (CRUD)
 * Group 2: Issue Context (Comments, Links, Attachments, Watchers)
 * Group 3: Project Operations (Projects, Components)
 * Group 4: Version Management
 * Group 5: Epic Management
 * Group 6: Search & Metadata
 * 
 * Requirements:
 * - .env file with ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN
 * - A valid Jira project (default: SCRUM)
 * 
 * Run: npm run test-jira-integration
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { JiraHelper } from '../helpers/jiraHelper';
import { AtlassianConfig } from '../utils/configLoader';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Test configuration
const TEST_PROJECT_KEY = process.env.TEST_PROJECT_KEY || 'SCRUM';
const TEST_TIMEOUT = 30000;

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    skipped?: boolean;
    skipReason?: string;
}

interface TestGroup {
    name: string;
    tests: TestResult[];
}

// Track created resources for cleanup
const createdResources: {
    issues: string[];
    versions: string[];
    components: string[];
} = {
    issues: [],
    versions: [],
    components: []
};

let jiraHelper: JiraHelper;
let currentUserId: string;
let testIssueKey: string;
let testCommentId: string;
let testVersionId: string;
let testComponentId: string;
let testEpicKey: string;

// =============================================================================
// Helper Functions
// =============================================================================

async function runTest(testName: string, testFn: () => Promise<void>): Promise<TestResult> {
    try {
        await Promise.race([
            testFn(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Test timeout')), TEST_TIMEOUT)
            )
        ]);
        return { name: testName, passed: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { name: testName, passed: false, error: errorMessage };
    }
}

function skipTest(testName: string, reason: string): TestResult {
    return { name: testName, passed: true, skipped: true, skipReason: reason };
}

function printTestResults(groups: TestGroup[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('JIRA TOOLS INTEGRATION TEST RESULTS');
    console.log('='.repeat(80));

    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const group of groups) {
        console.log(`\n📁 ${group.name}`);
        console.log('-'.repeat(60));

        for (const result of group.tests) {
            if (result.skipped) {
                console.log(`  ⏭️  ${result.name} (SKIPPED: ${result.skipReason})`);
                totalSkipped++;
            } else if (result.passed) {
                console.log(`  ✅ ${result.name}`);
                totalPassed++;
            } else {
                console.log(`  ❌ ${result.name}`);
                console.log(`      Error: ${result.error}`);
                totalFailed++;
            }
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`SUMMARY: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped`);
    console.log('='.repeat(80));

    if (totalFailed > 0) {
        process.exit(1);
    }
}

// =============================================================================
// Cleanup Function
// =============================================================================

async function cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test resources...');

    // Delete created issues (will also clean up linked comments, attachments, etc.)
    for (const issueKey of createdResources.issues) {
        try {
            await jiraHelper.deleteIssue(issueKey);
            console.log(`  Deleted issue: ${issueKey}`);
        } catch {
            console.log(`  Failed to delete issue: ${issueKey}`);
        }
    }

    // Delete created versions
    for (const versionId of createdResources.versions) {
        try {
            await jiraHelper.deleteVersion(versionId);
            console.log(`  Deleted version: ${versionId}`);
        } catch {
            console.log(`  Failed to delete version: ${versionId}`);
        }
    }

    // Delete created components
    for (const componentId of createdResources.components) {
        try {
            await jiraHelper.deleteComponent(componentId);
            console.log(`  Deleted component: ${componentId}`);
        } catch {
            console.log(`  Failed to delete component: ${componentId}`);
        }
    }
}

// =============================================================================
// Test Groups
// =============================================================================

// GROUP 1: Issue Operations
async function testIssueOperations(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test: Create Issue
    results.push(await runTest('createIssue', async () => {
        const result = await jiraHelper.createIssue(
            TEST_PROJECT_KEY,
            'Test Issue for Integration Tests',
            'Task',
            'This is a test issue created by integration tests.'
        );
        if (!result.key) {
            throw new Error('No issue key returned');
        }
        testIssueKey = result.key;
        createdResources.issues.push(testIssueKey);
    }));

    // Test: Get Issue
    results.push(await runTest('getIssue', async () => {
        const issue = await jiraHelper.getIssue(testIssueKey);
        if (!issue || issue.key !== testIssueKey) {
            throw new Error('Issue not found or key mismatch');
        }
    }));

    // Test: Get Issue Changelog
    results.push(await runTest('getChangelog', async () => {
        const changelog = await jiraHelper.getChangelog(testIssueKey);
        if (!Array.isArray(changelog.values)) {
            throw new Error('Invalid changelog format');
        }
    }));

    // Test: Update Issue
    results.push(await runTest('updateIssue', async () => {
        const updateData = {
            summary: 'Updated Test Issue Title'
        };
        await jiraHelper.updateIssue(testIssueKey, updateData);
        const updatedIssue = await jiraHelper.getIssue(testIssueKey);
        if (updatedIssue.fields.summary !== 'Updated Test Issue Title') {
            throw new Error('Issue summary was not updated');
        }
    }));

    // Test: Get Issue Transitions
    results.push(await runTest('getTransitions', async () => {
        const transitions = await jiraHelper.getTransitions(testIssueKey);
        if (!Array.isArray(transitions.transitions)) {
            throw new Error('Invalid transitions format');
        }
    }));

    // Test: Transition Issue (if transitions available)
    results.push(await runTest('transitionIssue', async () => {
        const transitions = await jiraHelper.getTransitions(testIssueKey);
        if (transitions.transitions.length > 0) {
            const transitionId = transitions.transitions[0].id;
            await jiraHelper.transitionIssue(testIssueKey, transitionId);
        } else {
            throw new Error('No transitions available');
        }
    }));

    // Test: Assign Issue
    results.push(await runTest('assignIssue', async () => {
        await jiraHelper.assignIssue(testIssueKey, currentUserId);
        const issue = await jiraHelper.getIssue(testIssueKey);
        if (!issue.fields.assignee || issue.fields.assignee.accountId !== currentUserId) {
            throw new Error('Issue was not assigned correctly');
        }
    }));

    return results;
}

// GROUP 2: Issue Context (Comments, Links, Attachments, Watchers)
async function testIssueContext(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test: Add Comment
    results.push(await runTest('addComment', async () => {
        const result = await jiraHelper.addComment(testIssueKey, 'This is a test comment.');
        if (!result.id) {
            throw new Error('No comment ID returned');
        }
        testCommentId = result.id;
    }));

    // Test: Get Comments
    results.push(await runTest('getComments', async () => {
        const comments = await jiraHelper.getComments(testIssueKey);
        if (!comments.comments || comments.comments.length === 0) {
            throw new Error('No comments found');
        }
    }));

    // Test: Update Comment
    results.push(await runTest('updateComment', async () => {
        await jiraHelper.updateComment(testIssueKey, testCommentId, 'Updated test comment.');
    }));

    // Test: Delete Comment
    results.push(await runTest('deleteComment', async () => {
        await jiraHelper.deleteComment(testIssueKey, testCommentId);
    }));

    // Test: Create Issue Link (create second issue first)
    results.push(await runTest('createIssueLink', async () => {
        const linkedIssue = await jiraHelper.createIssue(
            TEST_PROJECT_KEY,
            'Linked Issue for Test',
            'Task',
            'This issue will be linked.'
        );
        createdResources.issues.push(linkedIssue.key);

        await jiraHelper.createIssueLink(testIssueKey, linkedIssue.key, 'Relates');
    }));

    // Test: Get Issue Links
    results.push(await runTest('getIssueLinks', async () => {
        const links = await jiraHelper.getIssueLinks(testIssueKey);
        // Links should be an array after creating one
        if (!Array.isArray(links)) {
            throw new Error('Issue links should be an array');
        }
    }));

    // Test: Get Link Types
    results.push(await runTest('getIssueLinkTypes', async () => {
        const linkTypes = await jiraHelper.getIssueLinkTypes();
        if (!Array.isArray(linkTypes.issueLinkTypes) || linkTypes.issueLinkTypes.length === 0) {
            throw new Error('No link types found');
        }
    }));

    // Test: Add Watcher
    results.push(await runTest('addWatcher', async () => {
        await jiraHelper.addWatcher(testIssueKey, currentUserId);
    }));

    // Test: Get Watchers
    results.push(await runTest('getWatchers', async () => {
        const watchers = await jiraHelper.getWatchers(testIssueKey);
        if (!watchers.watchers) {
            throw new Error('No watchers field in response');
        }
    }));

    // Test: Remove Watcher
    results.push(await runTest('removeWatcher', async () => {
        await jiraHelper.removeWatcher(testIssueKey, currentUserId);
    }));

    return results;
}

// GROUP 3: Project Operations
async function testProjectOperations(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test: Get All Projects
    results.push(await runTest('getAllProjects', async () => {
        const projects = await jiraHelper.getAllProjects();
        if (!Array.isArray(projects) || projects.length === 0) {
            throw new Error('No projects found');
        }
    }));

    // Test: Get Project
    results.push(await runTest('getProject', async () => {
        const project = await jiraHelper.getProject(TEST_PROJECT_KEY);
        if (!project || project.key !== TEST_PROJECT_KEY) {
            throw new Error('Project not found or key mismatch');
        }
    }));

    // Test: Get Project Components
    results.push(await runTest('getProjectComponents', async () => {
        const components = await jiraHelper.getProjectComponents(TEST_PROJECT_KEY);
        if (!Array.isArray(components)) {
            throw new Error('Invalid components format');
        }
    }));

    // Test: Create Component
    results.push(await runTest('createComponent', async () => {
        const component = await jiraHelper.createComponent(
            TEST_PROJECT_KEY,
            `Test Component ${Date.now()}`,
            { description: 'Test component created by integration tests' }
        );
        if (!component.id) {
            throw new Error('No component ID returned');
        }
        testComponentId = component.id;
        createdResources.components.push(testComponentId);
    }));

    // Test: Get Component
    results.push(await runTest('getComponent', async () => {
        const component = await jiraHelper.getComponent(testComponentId);
        if (!component || component.id !== testComponentId) {
            throw new Error('Component not found or ID mismatch');
        }
    }));

    // Test: Update Component
    results.push(await runTest('updateComponent', async () => {
        await jiraHelper.updateComponent(testComponentId, {
            description: 'Updated component description'
        });
        const component = await jiraHelper.getComponent(testComponentId);
        if (component.description !== 'Updated component description') {
            throw new Error('Component description not updated');
        }
    }));

    // Test: Get Component Issue Count
    results.push(await runTest('getComponentIssueCount', async () => {
        const count = await jiraHelper.getComponentIssueCount(testComponentId);
        if (typeof count.issueCount !== 'number') {
            throw new Error('Invalid issue count format');
        }
    }));

    // Test: Delete Component (handled in cleanup)
    results.push(await runTest('deleteComponent', async () => {
        await jiraHelper.deleteComponent(testComponentId);
        // Remove from cleanup list since we already deleted
        const index = createdResources.components.indexOf(testComponentId);
        if (index > -1) {
            createdResources.components.splice(index, 1);
        }
    }));

    return results;
}

// GROUP 4: Version Management
async function testVersionManagement(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test: Get Project Versions
    results.push(await runTest('getProjectVersions', async () => {
        const versions = await jiraHelper.getProjectVersions(TEST_PROJECT_KEY);
        if (!Array.isArray(versions)) {
            throw new Error('Invalid versions format');
        }
    }));

    // Test: Create Version
    results.push(await runTest('createVersion', async () => {
        const version = await jiraHelper.createVersion(
            TEST_PROJECT_KEY,
            `Test Version ${Date.now()}`,
            {
                description: 'Test version created by integration tests',
                released: false
            }
        );
        if (!version.id) {
            throw new Error('No version ID returned');
        }
        testVersionId = version.id;
        createdResources.versions.push(testVersionId);
    }));

    // Test: Update Version
    results.push(await runTest('updateVersion', async () => {
        await jiraHelper.updateVersion(testVersionId, {
            description: 'Updated version description'
        });
    }));

    // Test: Release Version
    results.push(await runTest('releaseVersion', async () => {
        await jiraHelper.releaseVersion(testVersionId);
    }));

    // Test: Archive Version
    results.push(await runTest('archiveVersion', async () => {
        await jiraHelper.archiveVersion(testVersionId);
    }));

    // Test: Delete Version (handled in cleanup)
    results.push(await runTest('deleteVersion', async () => {
        await jiraHelper.deleteVersion(testVersionId);
        // Remove from cleanup list since we already deleted
        const index = createdResources.versions.indexOf(testVersionId);
        if (index > -1) {
            createdResources.versions.splice(index, 1);
        }
    }));

    return results;
}

// GROUP 5: Epic Management
async function testEpicManagement(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // First check if Epic issue type exists by searching for any epic
    let epicTypeExists = false;
    try {
        // Check by trying to get create metadata
        const metadata = await jiraHelper.getCreateMetadata([TEST_PROJECT_KEY]);
        if (metadata && metadata.projects && metadata.projects.length > 0) {
            const projectMeta = metadata.projects[0];
            if (projectMeta.issuetypes) {
                epicTypeExists = projectMeta.issuetypes.some((t: { name: string }) =>
                    t.name.toLowerCase() === 'epic'
                );
            }
        }
    } catch {
        // Ignore error, will skip tests
    }

    if (!epicTypeExists) {
        results.push(skipTest('createEpic', 'Epic issue type not available'));
        results.push(skipTest('getEpicIssues', 'Epic issue type not available'));
        results.push(skipTest('addIssueToEpic', 'Epic issue type not available'));
        results.push(skipTest('removeIssueFromEpic', 'Epic issue type not available'));
        return results;
    }

    // Test: Create Epic
    results.push(await runTest('createEpic', async () => {
        const epic = await jiraHelper.createEpic(
            TEST_PROJECT_KEY,
            `Test Epic ${Date.now()}`,
            'This is a test epic created by integration tests.'
        );
        if (!epic.key) {
            throw new Error('No epic key returned');
        }
        testEpicKey = epic.key;
        createdResources.issues.push(testEpicKey);
    }));

    // Test: Get Epic Issues
    results.push(await runTest('getEpicIssues', async () => {
        const issues = await jiraHelper.getEpicIssues(testEpicKey);
        if (!Array.isArray(issues)) {
            throw new Error('Invalid epic issues format');
        }
    }));

    // Test: Add Issue to Epic (use our test issue)
    results.push(await runTest('addIssueToEpic', async () => {
        await jiraHelper.addIssueToEpic(testEpicKey, testIssueKey);
    }));

    // Test: Remove Issue from Epic
    results.push(await runTest('removeIssueFromEpic', async () => {
        await jiraHelper.removeIssueFromEpic(testIssueKey);
    }));

    return results;
}

// GROUP 6: Search & Metadata
async function testSearchMetadata(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test: Search Issues (JQL)
    results.push(await runTest('searchIssues', async () => {
        const searchResults = await jiraHelper.searchIssues(`project = ${TEST_PROJECT_KEY}`, 5);
        if (!searchResults.issues) {
            throw new Error('No issues field in search results');
        }
    }));

    // Test: Get Create Metadata
    results.push(await runTest('getCreateMetadata', async () => {
        const metadata = await jiraHelper.getCreateMetadata([TEST_PROJECT_KEY]);
        if (!metadata) {
            throw new Error('No create metadata returned');
        }
    }));

    // Test: Get Priorities
    results.push(await runTest('getPriorities', async () => {
        const priorities = await jiraHelper.getPriorities();
        if (!Array.isArray(priorities) || priorities.length === 0) {
            throw new Error('No priorities found');
        }
    }));

    // Test: Get Statuses
    results.push(await runTest('getStatuses', async () => {
        const statuses = await jiraHelper.getStatuses();
        if (!Array.isArray(statuses) || statuses.length === 0) {
            throw new Error('No statuses found');
        }
    }));

    // Test: Get Project Statuses
    results.push(await runTest('getProjectStatuses', async () => {
        const statuses = await jiraHelper.getProjectStatuses(TEST_PROJECT_KEY);
        if (!Array.isArray(statuses)) {
            throw new Error('Invalid project statuses format');
        }
    }));

    // Test: Search Users
    results.push(await runTest('searchUsers', async () => {
        const users = await jiraHelper.searchUsers('');
        if (!Array.isArray(users)) {
            throw new Error('Invalid users format');
        }
    }));

    // Test: Get Current User
    results.push(await runTest('getCurrentUser', async () => {
        const user = await jiraHelper.getCurrentUser();
        if (!user.accountId) {
            throw new Error('No account ID in current user');
        }
    }));

    // Test: Get Worklogs
    results.push(await runTest('getWorklogs', async () => {
        const worklogs = await jiraHelper.getWorklogs(testIssueKey);
        if (!worklogs.worklogs) {
            throw new Error('No worklogs field in response');
        }
    }));

    // Test: Delete Issue (test that it works, cleanup will handle the rest)
    results.push(await runTest('deleteIssue', async () => {
        const tempIssue = await jiraHelper.createIssue(
            TEST_PROJECT_KEY,
            'Temporary Issue to Delete',
            'Task',
            'This issue will be deleted immediately.'
        );
        await jiraHelper.deleteIssue(tempIssue.key);
    }));

    return results;
}

// =============================================================================
// Main Test Runner
// =============================================================================

async function main(): Promise<void> {
    console.log('🚀 Starting Jira Tools Integration Tests\n');
    console.log(`📋 Test Project: ${TEST_PROJECT_KEY}`);
    console.log(`🔗 Jira URL: ${process.env.ATLASSIAN_BASE_URL}`);

    // Validate environment
    if (!process.env.ATLASSIAN_BASE_URL || !process.env.ATLASSIAN_EMAIL || !process.env.ATLASSIAN_API_TOKEN) {
        console.error('❌ Missing required environment variables. Please check your .env file.');
        console.error('Required: ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN');
        process.exit(1);
    }

    // Create config object
    const config: AtlassianConfig = {
        baseUrl: process.env.ATLASSIAN_BASE_URL,
        email: process.env.ATLASSIAN_EMAIL,
        apiToken: process.env.ATLASSIAN_API_TOKEN
    };

    // Initialize JiraHelper
    jiraHelper = new JiraHelper(config);

    // Get current user for tests that need it
    try {
        const currentUser = await jiraHelper.getCurrentUser();
        currentUserId = currentUser.accountId;
        console.log(`👤 Current User: ${currentUser.displayName} (${currentUserId})`);
    } catch (error) {
        console.error('❌ Failed to get current user. Check your credentials.');
        process.exit(1);
    }

    // Verify project exists
    try {
        const project = await jiraHelper.getProject(TEST_PROJECT_KEY);
        console.log(`✅ Project Found: ${project.name} (${project.key})`);
    } catch (error) {
        console.error(`❌ Project ${TEST_PROJECT_KEY} not found. Please set TEST_PROJECT_KEY environment variable.`);
        process.exit(1);
    }

    const testGroups: TestGroup[] = [];

    try {
        // GROUP 1: Issue Operations
        console.log('\n📝 Running Group 1: Issue Operations...');
        testGroups.push({
            name: 'Group 1: Issue Operations',
            tests: await testIssueOperations()
        });

        // GROUP 2: Issue Context
        console.log('📝 Running Group 2: Issue Context...');
        testGroups.push({
            name: 'Group 2: Issue Context (Comments, Links, Watchers)',
            tests: await testIssueContext()
        });

        // GROUP 3: Project Operations
        console.log('📝 Running Group 3: Project Operations...');
        testGroups.push({
            name: 'Group 3: Project Operations',
            tests: await testProjectOperations()
        });

        // GROUP 4: Version Management
        console.log('📝 Running Group 4: Version Management...');
        testGroups.push({
            name: 'Group 4: Version Management',
            tests: await testVersionManagement()
        });

        // GROUP 5: Epic Management
        console.log('📝 Running Group 5: Epic Management...');
        testGroups.push({
            name: 'Group 5: Epic Management',
            tests: await testEpicManagement()
        });

        // GROUP 6: Search & Metadata
        console.log('📝 Running Group 6: Search & Metadata...');
        testGroups.push({
            name: 'Group 6: Search & Metadata',
            tests: await testSearchMetadata()
        });

    } finally {
        // Always cleanup
        await cleanup();
    }

    // Print results
    printTestResults(testGroups);
}

// Run tests
main().catch(console.error);
