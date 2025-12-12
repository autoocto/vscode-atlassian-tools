import * as vscode from 'vscode';
import { ConfluenceHelper, ConfluencePage } from '../helpers/confluenceHelper';

export class ConfluenceTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly contextValue: 'category' | 'subcategory' | 'space' | 'page',
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly itemId?: string,
        public readonly spaceKey?: string,
        public readonly page?: ConfluencePage
    ) {
        super(label, collapsibleState);
        
        if (contextValue === 'page' && page) {
            this.description = page.status;
            this.tooltip = `${page.title}\nStatus: ${page.status}\nSpace: ${page.space?.key || 'N/A'}`;
            this.command = {
                command: 'confluence.openPage',
                title: 'Open Confluence Page',
                arguments: [page.id]
            };
            this.iconPath = new vscode.ThemeIcon('file');
        } else if (contextValue === 'space') {
            this.iconPath = new vscode.ThemeIcon('folder-library');
        } else if (contextValue === 'category') {
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}

export class ConfluenceTreeProvider implements vscode.TreeDataProvider<ConfluenceTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ConfluenceTreeItem | undefined | null | void> = new vscode.EventEmitter<ConfluenceTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ConfluenceTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private spacesCache: Array<{ key: string; name: string; id: string }> | null = null;
    private pagesCache: Map<string, ConfluencePage[]> = new Map();
    private recentPagesCache: ConfluencePage[] | null = null;
    private starredPagesCache: ConfluencePage[] | null = null;
    private starredSpacesCache: Array<{ key: string; name: string; id: string }> | null = null;
    private pickUpPagesCache: ConfluencePage[] | null = null;
    private discoverPagesCache: ConfluencePage[] | null = null;

    constructor(private helper: ConfluenceHelper | null) {}

    refresh(): void {
        this.spacesCache = null;
        this.pagesCache.clear();
        this.recentPagesCache = null;
        this.starredPagesCache = null;
        this.starredSpacesCache = null;
        this.pickUpPagesCache = null;
        this.discoverPagesCache = null;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ConfluenceTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ConfluenceTreeItem): Promise<ConfluenceTreeItem[]> {
        if (!this.helper) {
            return [];
        }

        try {
            if (!element) {
                // Root level - show For you, Recent, Starred, Starred Spaces, and user's spaces
                const categories: ConfluenceTreeItem[] = [
                    new ConfluenceTreeItem('For you', 'category', vscode.TreeItemCollapsibleState.Collapsed, 'for-you'),
                    new ConfluenceTreeItem('Recent', 'category', vscode.TreeItemCollapsibleState.Collapsed, 'recent'),
                    new ConfluenceTreeItem('Starred', 'category', vscode.TreeItemCollapsibleState.Collapsed, 'starred'),
                    new ConfluenceTreeItem('Starred Spaces', 'category', vscode.TreeItemCollapsibleState.Collapsed, 'starred-spaces')
                ];

                // Load user's accessible spaces (excluding other users' personal spaces)
                if (!this.spacesCache) {
                    this.spacesCache = await this.helper.getUserAccessibleSpaces(100);
                }

                const spaceItems = this.spacesCache.map(space =>
                    new ConfluenceTreeItem(
                        space.name,
                        'space',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        space.id,
                        space.key
                    )
                );

                return [...categories, ...spaceItems];
            }

            // "For you" category level
            if (element.contextValue === 'category' && element.itemId === 'for-you') {
                return [
                    new ConfluenceTreeItem('Pick up where you left off', 'subcategory', vscode.TreeItemCollapsibleState.Collapsed, 'pick-up'),
                    new ConfluenceTreeItem('Discover what\'s happening', 'subcategory', vscode.TreeItemCollapsibleState.Collapsed, 'discover')
                ];
            }

            // "Pick up where you left off" subcategory
            if (element.contextValue === 'subcategory' && element.itemId === 'pick-up') {
                if (!this.pickUpPagesCache) {
                    this.pickUpPagesCache = await this.helper.getRecentlyViewedPages(15);
                }

                return this.pickUpPagesCache.map(page =>
                    new ConfluenceTreeItem(
                        page.title,
                        'page',
                        vscode.TreeItemCollapsibleState.None,
                        page.id,
                        page.space?.key,
                        page
                    )
                );
            }

            // "Discover what's happening" subcategory
            if (element.contextValue === 'subcategory' && element.itemId === 'discover') {
                if (!this.discoverPagesCache) {
                    this.discoverPagesCache = await this.helper.getMyContributedPages(15);
                }

                return this.discoverPagesCache.map(page =>
                    new ConfluenceTreeItem(
                        page.title,
                        'page',
                        vscode.TreeItemCollapsibleState.None,
                        page.id,
                        page.space?.key,
                        page
                    )
                );
            }

            // "Recent" category level
            if (element.contextValue === 'category' && element.itemId === 'recent') {
                if (!this.recentPagesCache) {
                    this.recentPagesCache = await this.helper.getRecentlyViewedPages(25);
                }

                return this.recentPagesCache.map(page =>
                    new ConfluenceTreeItem(
                        page.title,
                        'page',
                        vscode.TreeItemCollapsibleState.None,
                        page.id,
                        page.space?.key,
                        page
                    )
                );
            }

            // "Starred" category level
            if (element.contextValue === 'category' && element.itemId === 'starred') {
                if (!this.starredPagesCache) {
                    this.starredPagesCache = await this.helper.getStarredPages(25);
                }

                return this.starredPagesCache.map(page =>
                    new ConfluenceTreeItem(
                        page.title,
                        'page',
                        vscode.TreeItemCollapsibleState.None,
                        page.id,
                        page.space?.key,
                        page
                    )
                );
            }

            // "Starred Spaces" category level
            if (element.contextValue === 'category' && element.itemId === 'starred-spaces') {
                if (!this.starredSpacesCache) {
                    this.starredSpacesCache = await this.helper.getStarredSpaces();
                }

                return this.starredSpacesCache.map(space =>
                    new ConfluenceTreeItem(
                        space.name,
                        'space',
                        vscode.TreeItemCollapsibleState.Collapsed,
                        space.id,
                        space.key
                    )
                );
            }

            // Space level - show pages
            if (element.contextValue === 'space' && element.spaceKey) {
                const cacheKey = element.spaceKey;
                if (!this.pagesCache.has(cacheKey)) {
                    const pages = await this.helper.getPagesInSpace(element.spaceKey, 50);
                    this.pagesCache.set(cacheKey, pages);
                }

                const pages = this.pagesCache.get(cacheKey) || [];
                return pages.map(page =>
                    new ConfluenceTreeItem(
                        page.title,
                        'page',
                        vscode.TreeItemCollapsibleState.None,
                        page.id,
                        element.spaceKey,
                        page
                    )
                );
            }

            return [];
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to load Confluence data: ${error}`);
            return [];
        }
    }
}
