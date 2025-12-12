import * as yaml from 'js-yaml';
import { ConfluencePage } from '../helpers/confluenceHelper';

export function pageToYaml(page: ConfluencePage): string {
    // Extract HTML content from storage or view
    const content = page.body?.storage?.value || page.body?.view?.value || '';
    
    // Create frontmatter
    const frontmatter = {
        entityType: 'page',
        id: page.id,
        title: page.title,
        type: page.type,
        status: page.status,
        spaceKey: page.space?.key || '',
        spaceName: page.space?.name || '',
        version: page.version?.number || 1
    };

    const yamlFrontmatter = yaml.dump(frontmatter, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
    });

    return `---\n${yamlFrontmatter}---\n\n${content}`;
}

export function yamlToPage(yamlContent: string): Partial<ConfluencePage> {
    // Split frontmatter and content
    const parts = yamlContent.split(/^---$/m);
    
    let frontmatter: any = {};
    let content = '';

    if (parts.length >= 3) {
        // Has frontmatter
        frontmatter = yaml.load(parts[1]) as any;
        content = parts.slice(2).join('---').trim();
    } else {
        // No frontmatter, whole thing is content
        content = yamlContent;
    }

    return {
        id: frontmatter.id,
        type: frontmatter.type || 'page',
        status: frontmatter.status || 'current',
        title: frontmatter.title || 'Untitled',
        space: frontmatter.spaceKey ? {
            key: frontmatter.spaceKey,
            name: frontmatter.spaceName || frontmatter.spaceKey
        } : undefined,
        version: frontmatter.version ? { number: frontmatter.version } : undefined,
        body: {
            storage: {
                value: content
            }
        }
    };
}

export function newPageToYaml(spaceKey: string, parentId?: string): string {
    const frontmatter = {
        entityType: 'page',
        id: 'new',
        title: 'New Page Title',
        type: 'page',
        status: 'current',
        spaceKey: spaceKey,
        parentId: parentId || '',
        version: 1
    };

    const yamlFrontmatter = yaml.dump(frontmatter, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
    });

    const templateContent = `<h1>New Page</h1>
<p>Start editing your Confluence page here...</p>
<p>You can use HTML or Confluence storage format.</p>`;

    return `---\n${yamlFrontmatter}---\n\n${templateContent}`;
}

export function extractPageContent(yamlContent: string): { title: string; content: string; version: number } {
    const parts = yamlContent.split(/^---$/m);
    
    let frontmatter: any = {};
    let content = '';

    if (parts.length >= 3) {
        frontmatter = yaml.load(parts[1]) as any;
        content = parts.slice(2).join('---').trim();
    } else {
        content = yamlContent;
    }

    return {
        title: frontmatter.title || 'Untitled',
        content: content,
        version: frontmatter.version || 1
    };
}
