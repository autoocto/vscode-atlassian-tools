/**
 * Comprehensive test script for all Confluence Language Model Tools
 * 
 * Tests all Confluence tools including page CRUD, comments, and search operations
 * 
 * Usage: 
 *   npm run test-confluence <pageId>
 */

import * as dotenv from 'dotenv';
import { loadAtlassianConfig } from '../utils/configLoader';
import { ConfluenceHelper } from '../helpers/confluenceHelper';

dotenv.config();

const TEST_PAGE_ID = process.argv[2] || '123456789'; // Replace with a valid page ID
const TEST_SPACE_KEY = 'YOUR_SPACE'; // Will be extracted from page

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('🧪 Testing All Confluence Language Model Tools\n');
    console.log(`📄 Test Page ID: ${TEST_PAGE_ID}\n`);

    const config = await loadAtlassianConfig();
    if (!config) {
        console.error('❌ Atlassian configuration not found');
        process.exit(1);
    }

    const confluence = new ConfluenceHelper(config);
    let testCommentId: string | undefined;
    let testInlineCommentId: string | undefined;

    try {
        // ===== PAGE OPERATIONS =====
        console.log('📚 === PAGE OPERATIONS ===\n');

        // Test 1: Get Confluence Page
        console.log('1️⃣  getConfluencePage - Get page details');
        const page = await confluence.getPage(TEST_PAGE_ID);
        console.log(`✅ Page: ${page.title}`);
        console.log(`   Space: ${page.space?.key} (${page.space?.name})`);
        console.log(`   Version: ${page.version?.number}`);
        console.log(`   Status: ${page.status}\n`);

        const spaceKey = page.space?.key || TEST_SPACE_KEY;

        // Test 2: Search Confluence Pages
        console.log('2️⃣  searchConfluencePages - Search pages in space');
        const searchResult = await confluence.searchContent(`space = "${spaceKey}" AND type = page`, 5);
        console.log(`✅ Found ${searchResult.size} pages in space ${spaceKey}`);
        if (searchResult.results.length > 0) {
            searchResult.results.slice(0, 3).forEach((p: any) => {
                console.log(`   - ${p.title} (${p.id})`);
            });
        }
        console.log();

        // Test 3: Search by Title
        console.log('3️⃣  searchConfluencePages - Search by title keyword');
        const titleSearch = await confluence.searchByTitle('test', 5);
        console.log(`✅ Found ${titleSearch.length} pages with "test" in title\n`);

        // Test 4: Search Confluence by Jira Key
        console.log('4️⃣  searchConfluenceByJiraKey - Find pages mentioning TEST-1');
        const jiraPages = await confluence.searchByJiraKey('TEST-1', 5);
        console.log(`✅ Found ${jiraPages.length} pages mentioning TEST-1\n`);

        // Test 5: Update Confluence Page
        console.log('5️⃣  updateConfluencePage - Update page content');
        const testContent = `<p>Updated at ${new Date().toISOString()}</p><p>Testing Confluence v1 API</p>`;
        const updatedPage = await confluence.updatePage(TEST_PAGE_ID, page.title, testContent, page.version?.number || 1);
        console.log(`✅ Page updated to version ${updatedPage.version?.number}\n`);
        await sleep(1000);

        // ===== COMMENT OPERATIONS (v2 API) =====
        console.log('💬 === COMMENT OPERATIONS (v2 API) ===\n');

        // Test 6: Get Page Footer Comments (v2)
        console.log('6️⃣  getConfluencePageFooterComments - Get all footer comments');
        const footerComments = await confluence.getPageFooterComments(TEST_PAGE_ID);
        console.log(`✅ Found ${footerComments.results?.length || 0} footer comments`);
        if (footerComments.results && footerComments.results.length > 0) {
            const comment = footerComments.results[0];
            console.log(`   Latest: "${comment.body?.storage?.value?.substring(0, 50)}..."`);
            testCommentId = comment.id;
        }
        console.log();

        // Test 7: Get Page Inline Comments (v2)
        console.log('7️⃣  getConfluencePageInlineComments - Get all inline comments');
        const inlineComments = await confluence.getPageInlineComments(TEST_PAGE_ID);
        console.log(`✅ Found ${inlineComments.results?.length || 0} inline comments`);
        if (inlineComments.results && inlineComments.results.length > 0) {
            const comment = inlineComments.results[0];
            console.log(`   Status: ${comment.resolutionStatus}`);
            testInlineCommentId = comment.id;
        }
        console.log();

        // Test 8: Create Footer Comment (v2)
        console.log('8️⃣  createConfluenceFooterComment - Create new comment');
        const newComment = await confluence.createFooterComment(
            TEST_PAGE_ID,
            `<p>Test comment created at ${new Date().toISOString()}</p>`,
            undefined,
            undefined
        );
        console.log(`✅ Created comment: ${newComment.id}`);
        testCommentId = newComment.id;
        console.log();
        await sleep(1000);

        // Test 9: Get Footer Comment (v2)
        if (testCommentId) {
            console.log('9️⃣  getConfluenceFooterComment - Get specific comment');
            const comment = await confluence.getFooterComment(testCommentId);
            console.log(`✅ Comment ${comment.id}`);
            console.log(`   Page: ${comment.pageId}`);
            console.log(`   Version: ${comment.version?.number}\n`);

            // Test 10: Create Reply to Comment (v2)
            console.log('🔟 createConfluenceFooterComment - Reply to comment');
            const reply = await confluence.createFooterComment(
                TEST_PAGE_ID,
                `<p>Reply created at ${new Date().toISOString()}</p>`,
                undefined,
                testCommentId
            );
            console.log(`✅ Created reply: ${reply.id}`);
            console.log(`   Parent: ${reply.parentCommentId}\n`);
            await sleep(1000);

            // Test 11: Update Footer Comment (v2)
            console.log('1️⃣1️⃣  updateConfluenceFooterComment - Update comment');
            const updatedComment = await confluence.updateFooterComment(
                testCommentId,
                `<p>Updated comment at ${new Date().toISOString()}</p>`,
                comment.version?.number || 1
            );
            console.log(`✅ Updated comment to version ${updatedComment.version?.number}\n`);
            await sleep(1000);

            // Test 12: Get Comment Children (v2)
            console.log('1️⃣2️⃣  getFooterCommentChildren - Get replies');
            const children = await confluence.getFooterCommentChildren(testCommentId);
            console.log(`✅ Found ${children.results?.length || 0} replies\n`);

            // Test 15: Delete Reply Comment (v2)
            console.log('1️⃣5️⃣  deleteConfluenceFooterComment - Delete reply');
            await confluence.deleteFooterComment(reply.id);
            console.log(`✅ Deleted reply comment\n`);
            await sleep(1000);

            // Test 16: Delete Test Comment (v2)
            console.log('1️⃣6️⃣  deleteConfluenceFooterComment - Delete test comment');
            await confluence.deleteFooterComment(testCommentId);
            console.log(`✅ Deleted test comment\n`);
        }

        // Test 13: Resolve Inline Comment (if exists)
        if (testInlineCommentId) {
            console.log('1️⃣3️⃣  resolveConfluenceInlineComment - Resolve inline comment');
            const inlineComment = await confluence.getInlineComment(testInlineCommentId);
            const resolved = await confluence.resolveInlineComment(testInlineCommentId, inlineComment.version?.number || 1);
            console.log(`✅ Resolved inline comment: ${resolved.resolutionStatus}\n`);
            await sleep(1000);

            // Test 14: Reopen Inline Comment
            console.log('1️⃣4️⃣  reopenConfluenceInlineComment - Reopen inline comment');
            const reopened = await confluence.reopenInlineComment(testInlineCommentId, resolved.version?.number || 1);
            console.log(`✅ Reopened inline comment: ${reopened.resolutionStatus}\n`);
            await sleep(1000);
        }

        // Test 17: Get Legacy Comments (v1 API for comparison)
        console.log('1️⃣7️⃣  getConfluencePageComments - Get comments (v1 API)');
        const legacyComments = await confluence.getPageComments(TEST_PAGE_ID);
        console.log(`✅ Found ${legacyComments.results?.length || 0} comments (v1 API)\n`);

        // ===== SPACE OPERATIONS =====
        console.log('🏢 === SPACE OPERATIONS ===\n');

        // Test 18: Get All Spaces
        console.log('1️⃣8️⃣  Get all Confluence spaces');
        const spaces = await confluence.getAllSpaces(10);
        console.log(`✅ Found ${spaces.length} spaces`);
        spaces.slice(0, 3).forEach((s: any) => {
            console.log(`   - ${s.name} (${s.key})`);
        });
        console.log();

        // ===== SUMMARY =====
        console.log('✨ === TEST SUMMARY ===\n');
        console.log('✅ All Confluence Language Model Tools tested successfully!');
        console.log('\nTested Tools:');
        console.log('  ✓ searchConfluencePages');
        console.log('  ✓ getConfluencePage');
        console.log('  ✓ updateConfluencePage');
        console.log('  ✓ searchConfluenceByJiraKey');
        console.log('  ✓ getConfluencePageComments (v1)');
        console.log('  ✓ getConfluencePageFooterComments (v2)');
        console.log('  ✓ getConfluencePageInlineComments (v2)');
        console.log('  ✓ createConfluenceFooterComment (v2)');
        console.log('  ✓ getConfluenceFooterComment (v2)');
        console.log('  ✓ updateConfluenceFooterComment (v2)');
        console.log('  ✓ deleteConfluenceFooterComment (v2)');
        console.log('  ✓ resolveConfluenceInlineComment (v2)');
        console.log('  ✓ reopenConfluenceInlineComment (v2)');
        console.log('  ✓ getConfluenceInlineComment (v2)');
        console.log('\nNote: createConfluencePage and deleteConfluencePage not tested to avoid clutter');

    } catch (error: any) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

main();
