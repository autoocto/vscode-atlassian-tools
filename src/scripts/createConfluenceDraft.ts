#!/usr/bin/env ts-node

/**
 * Create a local Confluence draft from a markdown test case file.
 * Usage:
 *   npx ts-node src/scripts/createConfluenceDraft.ts --source markdown_files/test_file.md --title "Test file" --parent parent_page_id
 *
 * The script performs a simple markdown -> HTML conversion and writes a Confluence
 * storage-format HTML file to `confluence_drafts/` for review. It does NOT call
 * Confluence APIs or publish the page.
 */

import * as fs from 'fs';
import * as path from 'path';

function parseArgs() {
    const args = process.argv.slice(2);
    const out: any = {};
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if ((a === '--source' || a === '-s') && args[i+1]) { out.source = args[++i]; }
        else if ((a === '--title' || a === '-t') && args[i+1]) { out.title = args[++i]; }
        else if ((a === '--parent' || a === '-p') && args[i+1]) { out.parent = args[++i]; }
        else if ((a === '--output' || a === '-o') && args[i+1]) { out.output = args[++i]; }
    }
    return out;
}

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function mdToSimpleHtml(md: string): string {
    // Very small converter: headings, lists, code blocks, paragraphs
    const lines = md.split(/\r?\n/);
    const out: string[] = [];
    let inUl = false;
    let inOl = false;
    let inCode = false;

    for (const raw of lines) {
        const line = raw.trimEnd();
        if (line.startsWith('```')) {
            if (!inCode) { out.push('<pre>'); inCode = true; }
            else { out.push('</pre>'); inCode = false; }
            continue;
        }
        if (inCode) { out.push(escapeHtml(line)); continue; }

        if (/^#{3}\s+/.test(line)) { out.push(`<h3>${escapeHtml(line.replace(/^#{3}\s+/, ''))}</h3>`); continue; }
        if (/^#{2}\s+/.test(line)) { out.push(`<h2>${escapeHtml(line.replace(/^#{2}\s+/, ''))}</h2>`); continue; }
        if (/^#\s+/.test(line)) { out.push(`<h1>${escapeHtml(line.replace(/^#\s+/, ''))}</h1>`); continue; }

        if (/^-\s+/.test(line)) {
            if (!inUl) { out.push('<ul>'); inUl = true; }
            out.push(`<li>${escapeHtml(line.replace(/^-\s+/, ''))}</li>`);
            continue;
        } else {
            if (inUl) { out.push('</ul>'); inUl = false; }
        }

        if (/^\d+\.\s+/.test(line)) {
            if (!inOl) { out.push('<ol>'); inOl = true; }
            out.push(`<li>${escapeHtml(line.replace(/^\d+\.\s+/, ''))}</li>`);
            continue;
        } else {
            if (inOl) { out.push('</ol>'); inOl = false; }
        }

        if (line === '---' || /^---+$/.test(line)) { out.push('<hr/>'); continue; }
        if (line === '') { out.push('<p/>'); continue; }

        // Inline bold/italic simple replacements
        const html = escapeHtml(line)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
        out.push(`<p>${html}</p>`);
    }
    if (inUl) out.push('</ul>');
    if (inOl) out.push('</ol>');
    if (inCode) out.push('</pre>');

    return out.join('\n');
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main() {
    const args = parseArgs();
    const source = args.source || 'markdown_test_cases/test_cases_for_html_rendering_issue_in_workflow_review.md';
    const title = args.title || `Test Plan Draft`;
    const outputFile = args.output || path.join('confluence_drafts', `${title.replace(/[^a-z0-9]/gi,'_')}_draft.html`);

    if (!fs.existsSync(source)) {
        console.error(`Source file not found: ${source}`);
        process.exit(1);
    }

    const md = fs.readFileSync(source, 'utf-8');
    const bodyHtml = mdToSimpleHtml(md);

    const storage = `<?xml version="1.0" encoding="UTF-8"?><div><h1>${escapeHtml(title)}</h1><p/><div>${bodyHtml}</div></div>`;

    ensureDir(path.dirname(outputFile));
    fs.writeFileSync(outputFile, storage, 'utf-8');

    console.log('Created local Confluence draft (storage HTML) at:');
    console.log(`  ${path.resolve(outputFile)}`);
    console.log('\nTo publish this draft to Confluence, use the publishConfluenceDraft.ts script or ConfluenceHelper.createPage API.');
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
