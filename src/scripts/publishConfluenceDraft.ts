#!/usr/bin/env ts-node

/**
 * Publish a local Confluence draft HTML file as a page using ConfluenceHelper.
 * Usage:
 *   npx ts-node src/scripts/publishConfluenceDraft.ts --file confluence_drafts/Test_file.html --title "Test file" --space space_name --parent parent_page_id
 *
 * Requires Confluence credentials configured in env or VS Code settings used by loadAtlassianConfig().
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { loadAtlassianConfig } from '../utils/configLoader';
import { ConfluenceHelper } from '../helpers/confluenceHelper';

// Load environment variables from .env file
dotenv.config();

function parseArgs() {
    const args = process.argv.slice(2);
    const out: any = {};
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if ((a === '--file' || a === '-f') && args[i+1]) { out.file = args[++i]; }
        else if ((a === '--title' || a === '-t') && args[i+1]) { out.title = args[++i]; }
        else if ((a === '--space' || a === '-s') && args[i+1]) { out.space = args[++i]; }
        else if ((a === '--parent' || a === '-p') && args[i+1]) { out.parent = args[++i]; }
    }
    return out;
}

async function main() {
    const args = parseArgs();
    const file = args.file || 'confluence_drafts/Test_file.html';
    const title = args.title || 'Test file';
    const space = args.space || 'space_name';
    const parent = args.parent || 'parent_page_id';

    if (!fs.existsSync(file)) {
        console.error('Draft file not found:', file);
        process.exit(1);
    }

    const content = fs.readFileSync(file, 'utf-8');

    const cfg = loadAtlassianConfig();
    if (!cfg || !cfg.baseUrl || !cfg.apiToken || !cfg.email) {
        console.error('Atlassian credentials not configured. Please set ATLASSIAN_BASE_URL, ATLASSIAN_EMAIL, and ATLASSIAN_API_TOKEN in environment or settings.');
        process.exit(1);
    }

    const helper = new ConfluenceHelper(cfg);
    try {
        console.log('Publishing page to Confluence...');
        const page = await helper.createPage(space, title, content, parent);
        console.log('Created page:', page._links?.webui || page._links?.self || JSON.stringify(page));
    } catch (e: any) {
        console.error('Failed to create Confluence page:', e.message || e);
        process.exit(1);
    }
}

main().catch(e => { console.error('Unexpected error:', e); process.exit(1); });
