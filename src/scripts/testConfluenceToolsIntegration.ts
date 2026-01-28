/**
 * Confluence Tools Integration Tests
 * 
 * This test file validates all Confluence Language Model tools by making real API calls.
 * Tests are organized into the same 5 groups as confluenceTools.ts:
 * 
 * Group 1: Page Operations (CRUD)
 * Group 2: Page Context (Comments, Labels, Attachments)
 * Group 3: Space Operations
 * Group 4: Search Operations
 * Group 5: User & Metadata
 * 
 * Requirements:
 * - .env file with ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN
 * - A valid Confluence space (default: will use first available space)
 * 
 * Run: npm run test-confluence-integration
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { ConfluenceHelper } from '../helpers/confluenceHelper';
import { AtlassianConfig } from '../utils/configLoader';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Test configuration
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
    pages: string[];
    comments: string[];
    labels: { pageId: string; label: string }[];
} = {
    pages: [],
    comments: [],
    labels: []
};

let confluenceHelper: ConfluenceHelper;
let testSpaceKey: string;
let testPageId: string;
let testPageTitle: string;
let testPageVersion: number;
let testCommentId: string;

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function skipTest(testName: string, reason: string): TestResult {
    console.log(`  ⏭️  ${testName} (SKIPPED: ${reason})`);
    return { name: testName, passed: true, skipped: true, skipReason: reason };
}

function printTestResults(groups: TestGroup[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('CONFLUENCE TOOLS INTEGRATION TEST RESULTS');
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

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Cleanup Function
// =============================================================================

async function cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test resources...');

    // Remove labels first (before deleting pages)
    for (const labelInfo of createdResources.labels) {
        try {
            await confluenceHelper.removePageLabel(labelInfo.pageId, labelInfo.label);
            console.log(`  Removed label '${labelInfo.label}' from page ${labelInfo.pageId}`);
        } catch {
            console.log(`  Failed to remove label '${labelInfo.label}'`);
        }
    }

    // Delete comments (in reverse order to handle replies first)
    for (const commentId of createdResources.comments.reverse()) {
        try {
            await confluenceHelper.deleteFooterComment(commentId);
            console.log(`  Deleted comment: ${commentId}`);
        } catch {
            console.log(`  Failed to delete comment: ${commentId}`);
        }
    }

    // Delete created pages (in reverse order to handle child pages first)
    for (const pageId of createdResources.pages.reverse()) {
        try {
            await confluenceHelper.deletePage(pageId);
            console.log(`  Deleted page: ${pageId}`);
        } catch {
            console.log(`  Failed to delete page: ${pageId}`);
        }
    }
}

// =============================================================================
// Test Groups
// =============================================================================

// GROUP 1: Page Operations
async function testPageOperations(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test: Create Page
    testPageTitle = `Integration Test Page ${Date.now()}`;
    results.push(await runTest('createPage', async () => {
        const page = await confluenceHelper.createPage(
            testSpaceKey,
            testPageTitle,
            '<p>This is a test page created by integration tests.</p>'
        );
        if (!page.id) {
            throw new Error('No page ID returned');
        }
        testPageId = page.id;
        testPageVersion = page.version?.number || 1;
        createdResources.pages.push(testPageId);
    }));

    // Wait for page creation to propagate
    await sleep(1000);

    // Test: Get Page
    results.push(await runTest('getPage', async () => {
        const page = await confluenceHelper.getPage(testPageId);
        if (!page || page.id !== testPageId) {
            throw new Error('Page not found or ID mismatch');
        }
    }));

    // Test: Update Page
    results.push(await runTest('updatePage', async () => {
        const updatedPage = await confluenceHelper.updatePage(
            testPageId,
            testPageTitle,
            `<p>Updated content at ${new Date().toISOString()}</p>`,
            testPageVersion
        );
        if (updatedPage.version?.number !== testPageVersion + 1) {
            throw new Error('Page version was not incremented');
        }
        testPageVersion = updatedPage.version?.number || testPageVersion + 1;
    }));

    // Test: Get Page History
    results.push(await runTest('getPageHistory', async () => {
        const history = await confluenceHelper.getPageHistory(testPageId);
        if (!history) {
            throw new Error('No history returned');
        }
    }));

    // Test: Get Page Version
    results.push(await runTest('getPageVersion', async () => {
        const page = await confluenceHelper.getPageVersion(testPageId, 1);
        if (!page || !page.version) {
            throw new Error('No page version returned');
        }
    }));

    // Test: Get Child Pages (may be empty)
    results.push(await runTest('getChildPages', async () => {
        const children = await confluenceHelper.getChildPages(testPageId);
        // Just verify the API call works - may return empty array
        if (!children) {
            throw new Error('No children response');
        }
    }));

    // Test: Get Page Ancestors
    results.push(await runTest('getPageAncestors', async () => {
        const result = await confluenceHelper.getPageAncestors(testPageId);
        // May have no ancestors if at root level
        if (!result) {
            throw new Error('No ancestors response');
        }
    }));

    // Test: Copy Page
    results.push(await runTest('copyPage', async () => {
        const copiedPage = await confluenceHelper.copyPage(
            testPageId,
            testSpaceKey,
            `Copied Test Page ${Date.now()}`
        );
        if (!copiedPage.id) {
            throw new Error('Copy failed - no page ID returned');
        }
        createdResources.pages.push(copiedPage.id);
    }));

    return results;
}

// GROUP 2: Page Context (Comments, Labels, Attachments)
async function testPageContext(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test: Get Page Comments (v1 API)
    results.push(await runTest('getPageComments', async () => {
        const comments = await confluenceHelper.getPageComments(testPageId);
        // Just verify API works
        if (!comments) {
            throw new Error('No comments response');
        }
    }));

    // Test: Get Page Footer Comments (v2 API)
    results.push(await runTest('getPageFooterComments', async () => {
        const comments = await confluenceHelper.getPageFooterComments(testPageId);
        if (!comments) {
            throw new Error('No footer comments response');
        }
    }));

    // Test: Get Page Inline Comments (v2 API)
    results.push(await runTest('getPageInlineComments', async () => {
        const comments = await confluenceHelper.getPageInlineComments(testPageId);
        if (!comments) {
            throw new Error('No inline comments response');
        }
    }));

    // Test: Create Footer Comment
    results.push(await runTest('createFooterComment', async () => {
        const comment = await confluenceHelper.createFooterComment(
            testPageId,
            `<p>Test comment created at ${new Date().toISOString()}</p>`
        );
        if (!comment.id) {
            throw new Error('No comment ID returned');
        }
        testCommentId = comment.id;
        createdResources.comments.push(testCommentId);
    }));

    await sleep(500);

    // Test: Get Footer Comment
    results.push(await runTest('getFooterComment', async () => {
        const comment = await confluenceHelper.getFooterComment(testCommentId);
        if (!comment || comment.id !== testCommentId) {
            throw new Error('Comment not found');
        }
    }));

    // Test: Update Footer Comment
    results.push(await runTest('updateFooterComment', async () => {
        const comment = await confluenceHelper.getFooterComment(testCommentId);
        const updatedComment = await confluenceHelper.updateFooterComment(
            testCommentId,
            `<p>Updated comment at ${new Date().toISOString()}</p>`,
            comment.version?.number || 1
        );
        if (!updatedComment) {
            throw new Error('Comment update failed');
        }
    }));

    // Test: Create Reply to Comment
    let replyId: string | undefined;
    results.push(await runTest('createFooterCommentReply', async () => {
        const reply = await confluenceHelper.createFooterComment(
            testPageId,
            `<p>Reply at ${new Date().toISOString()}</p>`,
            undefined,
            testCommentId
        );
        if (!reply.id) {
            throw new Error('No reply ID returned');
        }
        replyId = reply.id;
        createdResources.comments.push(reply.id);
    }));

    await sleep(500);

    // Test: Get Footer Comment Children (replies)
    results.push(await runTest('getFooterCommentChildren', async () => {
        const children = await confluenceHelper.getFooterCommentChildren(testCommentId);
        if (!children) {
            throw new Error('No children response');
        }
    }));

    // Test: Delete Footer Comment (reply first)
    if (replyId) {
        results.push(await runTest('deleteFooterComment', async () => {
            await confluenceHelper.deleteFooterComment(replyId!);
            // Remove from cleanup list since we deleted it
            const index = createdResources.comments.indexOf(replyId!);
            if (index > -1) {
                createdResources.comments.splice(index, 1);
            }
        }));
    }

    // Test: Get Page Labels
    results.push(await runTest('getPageLabels', async () => {
        const labels = await confluenceHelper.getPageLabels(testPageId);
        if (!labels) {
            throw new Error('No labels response');
        }
    }));

    // Test: Add Page Label
    const testLabel = `test-label-${Date.now()}`;
    results.push(await runTest('addPageLabel', async () => {
        const result = await confluenceHelper.addPageLabel(testPageId, testLabel);
        if (!result) {
            throw new Error('Add label failed');
        }
        createdResources.labels.push({ pageId: testPageId, label: testLabel });
    }));

    await sleep(500);

    // Test: Remove Page Label
    results.push(await runTest('removePageLabel', async () => {
        await confluenceHelper.removePageLabel(testPageId, testLabel);
        // Remove from cleanup list
        const index = createdResources.labels.findIndex(l => l.label === testLabel);
        if (index > -1) {
            createdResources.labels.splice(index, 1);
        }
    }));

    // Test: Get Page Attachments
    results.push(await runTest('getPageAttachments', async () => {
        const attachments = await confluenceHelper.getPageAttachments(testPageId);
        if (!attachments) {
            throw new Error('No attachments response');
        }
    }));

    return results;
}

// GROUP 3: Space Operations
async function testSpaceOperations(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test: Get All Spaces
    results.push(await runTest('getAllSpaces', async () => {
        const spaces = await confluenceHelper.getAllSpaces(10);
        if (!Array.isArray(spaces)) {
            throw new Error('Invalid spaces format');
        }
    }));

    // Test: Get Space
    results.push(await runTest('getSpace', async () => {
        const space = await confluenceHelper.getSpace(testSpaceKey);
        if (!space || space.key !== testSpaceKey) {
            throw new Error('Space not found or key mismatch');
        }
    }));

    // Test: Get Pages in Space
    results.push(await runTest('getPagesInSpace', async () => {
        const pages = await confluenceHelper.getPagesInSpace(testSpaceKey, 5);
        if (!Array.isArray(pages)) {
            throw new Error('Invalid pages format');
        }
    }));

    // Test: Get User Accessible Spaces
    results.push(await runTest('getUserAccessibleSpaces', async () => {
        const spaces = await confluenceHelper.getUserAccessibleSpaces(10);
        if (!Array.isArray(spaces)) {
            throw new Error('Invalid spaces format');
        }
    }));

    return results;
}

// GROUP 4: Search Operations
async function testSearchOperations(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test: Search Content (CQL)
    results.push(await runTest('searchContent', async () => {
        const result = await confluenceHelper.searchContent(`space = "${testSpaceKey}" AND type = page`, 5);
        if (!result || !Array.isArray(result.results)) {
            throw new Error('Invalid search results');
        }
    }));

    // Test: Search by Title
    results.push(await runTest('searchByTitle', async () => {
        const pages = await confluenceHelper.searchByTitle('test', 5);
        if (!Array.isArray(pages)) {
            throw new Error('Invalid search results');
        }
    }));

    // Test: Full Text Search
    results.push(await runTest('fullTextSearch', async () => {
        const result = await confluenceHelper.fullTextSearch('test', 5);
        if (!result || !Array.isArray(result.results)) {
            throw new Error('Invalid search results');
        }
    }));

    // Test: Search by Jira Key
    results.push(await runTest('searchByJiraKey', async () => {
        // This may return empty results if no pages mention Jira keys
        const pages = await confluenceHelper.searchByJiraKey('TEST-1', 5);
        if (!Array.isArray(pages)) {
            throw new Error('Invalid search results');
        }
    }));

    // Test: Get Recently Updated
    results.push(await runTest('getRecentlyUpdated', async () => {
        const pages = await confluenceHelper.getRecentlyUpdated(5);
        if (!Array.isArray(pages)) {
            throw new Error('Invalid results');
        }
    }));

    // Test: Get My Created Pages
    results.push(await runTest('getMyCreatedPages', async () => {
        const pages = await confluenceHelper.getMyCreatedPages(5);
        if (!Array.isArray(pages)) {
            throw new Error('Invalid results');
        }
    }));

    // Test: Get My Contributed Pages
    results.push(await runTest('getMyContributedPages', async () => {
        const pages = await confluenceHelper.getMyContributedPages(5);
        if (!Array.isArray(pages)) {
            throw new Error('Invalid results');
        }
    }));

    // Test: Get Starred Pages
    results.push(await runTest('getStarredPages', async () => {
        const pages = await confluenceHelper.getStarredPages(5);
        if (!Array.isArray(pages)) {
            throw new Error('Invalid results');
        }
    }));

    return results;
}

// GROUP 5: User & Metadata
async function testUserMetadata(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test: Get Current User
    results.push(await runTest('getCurrentUser', async () => {
        const user = await confluenceHelper.getCurrentUser();
        if (!user || !user.accountId) {
            throw new Error('No user or account ID');
        }
    }));

    // Test: Search Users
    results.push(await runTest('searchUsers', async () => {
        // Search with a common term to find users
        const users = await confluenceHelper.searchUsers('admin', 5);
        // May return empty if no users match
        if (!Array.isArray(users)) {
            throw new Error('Invalid users format');
        }
    }));

    // Test: Check Connection
    results.push(await runTest('checkConnection', async () => {
        const connected = await confluenceHelper.checkConnection();
        if (!connected) {
            throw new Error('Connection check failed');
        }
    }));

    // Test: Delete Page (test that it works, cleanup will handle the rest)
    results.push(await runTest('deletePage', async () => {
        const tempPage = await confluenceHelper.createPage(
            testSpaceKey,
            `Temp Delete Test Page ${Date.now()}`,
            '<p>This page will be deleted immediately.</p>'
        );
        await confluenceHelper.deletePage(tempPage.id);
    }));

    return results;
}

// =============================================================================
// Main Test Runner
// =============================================================================

async function main(): Promise<void> {
    console.log('🚀 Starting Confluence Tools Integration Tests\n');
    console.log(`🔗 Confluence URL: ${process.env.ATLASSIAN_BASE_URL}`);

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

    // Initialize ConfluenceHelper
    confluenceHelper = new ConfluenceHelper(config);

    // Get current user
    try {
        const currentUser = await confluenceHelper.getCurrentUser();
        console.log(`👤 Current User: ${currentUser.displayName} (${currentUser.accountId})`);
    } catch (error) {
        console.error('❌ Failed to get current user. Check your credentials.');
        process.exit(1);
    }

    // Find a space to test with
    try {
        const spaces = await confluenceHelper.getUserAccessibleSpaces(10);
        if (spaces.length === 0) {
            console.error('❌ No accessible Confluence spaces found.');
            process.exit(1);
        }
        // Use the first non-personal space, or the first available
        const nonPersonalSpace = spaces.find(s => !s.key.startsWith('~'));
        testSpaceKey = nonPersonalSpace?.key || spaces[0].key;
        console.log(`📋 Test Space: ${testSpaceKey}`);
    } catch (error) {
        console.error('❌ Failed to list Confluence spaces.');
        process.exit(1);
    }

    const testGroups: TestGroup[] = [];

    try {
        // GROUP 1: Page Operations
        console.log('\n📝 Running Group 1: Page Operations...');
        testGroups.push({
            name: 'Group 1: Page Operations',
            tests: await testPageOperations()
        });

        // GROUP 2: Page Context
        console.log('📝 Running Group 2: Page Context...');
        testGroups.push({
            name: 'Group 2: Page Context (Comments, Labels, Attachments)',
            tests: await testPageContext()
        });

        // GROUP 3: Space Operations
        console.log('📝 Running Group 3: Space Operations...');
        testGroups.push({
            name: 'Group 3: Space Operations',
            tests: await testSpaceOperations()
        });

        // GROUP 4: Search Operations
        console.log('📝 Running Group 4: Search Operations...');
        testGroups.push({
            name: 'Group 4: Search Operations',
            tests: await testSearchOperations()
        });

        // GROUP 5: User & Metadata
        console.log('📝 Running Group 5: User & Metadata...');
        testGroups.push({
            name: 'Group 5: User & Metadata',
            tests: await testUserMetadata()
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
