#!/usr/bin/env ts-node
import { loadAtlassianConfig } from '../utils/configLoader';
import { ConfluenceHelper } from '../helpers/confluenceHelper';

async function testConfluenceUI() {
    console.log('Testing Confluence UI components...\n');

    const config = loadAtlassianConfig();
    if (!config) {
        console.error('❌ Atlassian configuration not found. Please set environment variables or VS Code settings.');
        process.exit(1);
    }

    const helper = new ConfluenceHelper(config);

    try {
        // Test 1: Get all spaces (simulates tree provider root level)
        console.log('Test 1: Fetching spaces...');
        const spaces = await helper.getAllSpaces(10);
        console.log(`✓ Found ${spaces.length} spaces`);
        spaces.forEach(space => {
            console.log(`  - ${space.key}: ${space.name}`);
        });
        console.log('');

        // Test 2: Get recently updated pages (simulates tree provider "Recently Updated")
        console.log('Test 2: Fetching recently updated pages...');
        const recentPages = await helper.getRecentlyUpdated(5);
        console.log(`✓ Found ${recentPages.length} recent pages`);
        recentPages.forEach(page => {
            console.log(`  - ${page.title} (${page.space?.key || 'Unknown space'})`);
        });
        console.log('');

        // Test 3: Get pages in space (simulates expanding a space in tree)
        if (spaces.length > 0) {
            const spaceKey = spaces[0].key;
            console.log(`Test 3: Fetching pages in space ${spaceKey}...`);
            const pages = await helper.getPagesInSpace(spaceKey, 5);
            console.log(`✓ Found ${pages.length} pages in space ${spaceKey}`);
            pages.forEach(page => {
                console.log(`  - ${page.title}`);
            });
            console.log('');

            // Test 4: Get single page (simulates opening page in editor)
            if (pages.length > 0) {
                const pageId = pages[0].id;
                console.log(`Test 4: Fetching full details for page ${pageId}...`);
                const page = await helper.getPage(pageId, 'body.storage,space,version');
                console.log(`✓ Retrieved page: ${page.title}`);
                console.log(`  Space: ${page.space?.key || 'Unknown'}`);
                console.log(`  Status: ${page.status}`);
                console.log(`  Version: ${page.version?.number || 'Unknown'}`);
                console.log(`  Content length: ${page.body?.storage?.value?.length || 0} chars`);
                console.log('');
            }
        }

        // Test 5: Search by title (simulates search functionality)
        console.log('Test 5: Searching for pages by title...');
        const searchResults = await helper.searchByTitle('test', 3);
        console.log(`✓ Found ${searchResults.length} pages matching "test"`);
        searchResults.forEach(page => {
            console.log(`  - ${page.title} (${page.space?.key || 'Unknown'})`);
        });
        console.log('');

        console.log('✅ All Confluence UI tests passed!');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testConfluenceUI();
