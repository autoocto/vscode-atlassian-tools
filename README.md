# Atlassian Tools for VS Code

Manage Jira issues and Confluence pages directly from VS Code with an integrated UI and GitHub Copilot chat support.

## Features

### 🎯 Jira Integration
- **Interactive Preview UI**: View and edit Jira issues in a rich webview with:
  - Status transitions with dropdown selection
  - Assignee management with user search
  - Priority updates
  - Field editing with @mentions support
  - Comment management (add, edit, delete)
  - Real-time sync between YAML files and preview
- **Tree View**: Browse your issues, recent items, and projects
- **YAML Editing**: Edit issues in YAML format with Ctrl+S sync to Jira
- **Language Model Tools**: 25+ tools for Copilot chat integration

### 📄 Confluence Integration
- **Smart Navigation**: Browse pages with personalized views:
  - "For you" section with recently contributed pages
  - Recent pages you've worked on
  - Starred pages and spaces
  - Filtered space view (excludes other users' personal spaces)
- **Page Editor**: View and edit pages in a webview preview
- **YAML Editing**: Edit pages in YAML format with automatic sync
- **Language Model Tools**: 12+ tools for page and comment management

### 🤖 GitHub Copilot Chat Integration
Ask questions in Copilot chat like:
- "Get details for PROJ-123"
- "Search for Jira issues in project MYPROJ that are in progress"
- "Find Confluence pages about authentication"
- "Create a Confluence page with title 'API Documentation' in TECH space"

## Configuration

Configure Atlassian credentials via VS Code settings or `.env` file:

- `atlassianTools.atlassianBaseUrl` - Your Atlassian base URL (e.g., `https://yourcompany.atlassian.net`)
- `atlassianTools.atlassianEmail` - Your Atlassian account email
- `atlassianTools.atlassianApiToken` - Atlassian API token ([create one here](https://id.atlassian.com/manage-profile/security/api-tokens))

Copy `.env.example` to `.env` and fill in your credentials for local development.

## Usage

### UI Commands

**Jira:**
- `Jira: Open Issue in YAML` - Edit issue in YAML format
- `Jira: Open Issue Preview` - View issue in interactive webview
- `Jira: Create New Issue` - Create new issue from template
- `Jira: Save to Jira` - Save YAML changes to Jira (or use Ctrl+S)
- `Jira: Add Comment` - Add comment to issue
- `Jira: Transition Issue` - Change issue status

**Confluence:**
- `Confluence: Open Page in YAML` - Edit page in YAML format
- `Confluence: Open Page Preview` - View page in webview
- `Confluence: Create New Page` - Create new page from template
- `Confluence: Save to Confluence` - Save YAML changes (or use Ctrl+S)
- `Confluence: Add Comment` - Add comment to page
- `Confluence: Delete Page` - Delete page with confirmation

### Keyboard Shortcuts

- `Ctrl+S` (Cmd+S on Mac) - Save changes from YAML to Jira/Confluence

## Language Model Tools

This extension provides 37+ language model tools for GitHub Copilot integration:

**Jira Tools (25):**
- Issue operations: search (JQL), read, create, update, delete, assign
- Comments: create, read, update, delete
- Worklogs: add, read, update, delete
- Transitions: get available, transition issue
- Issue links: read, create
- Watchers: read, add, remove
- Attachments and votes: read
- Bulk operations and metadata

**Confluence Tools (12):**
- Page operations: search (CQL), read, create, update, delete
- Comments: footer and inline comments (v2 API)
- Comment operations: create, reply, update, delete, resolve, reopen

See [package.json](package.json) for full tool definitions and schemas.

## Development

### Setup

```bash
npm install
npm run compile
```

### npm Scripts

- `npm run lint` - Run ESLint
- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch mode compilation
- `npm run verify` - Test Atlassian connectivity
- `npm run test-jira -- <ISSUE_KEY>` - Test Jira tools (read-only)
- `npm run test-confluence -- <PAGE_ID>` - Test Confluence tools (read-only)

### Project Structure

```
src/
├── commands/          # VS Code command implementations
├── helpers/           # Jira and Confluence API helpers
├── scripts/           # Verification and test scripts
├── tools/             # Language model tool implementations
├── ui/                # Tree providers and webview providers
└── utils/             # Config, error handling, formatters
```

### Testing

Run verification to ensure connectivity:
```bash
npm run verify
```

Test Jira tools (read-only operations):
```bash
npm run test-jira -- PROJ-123
```

Test Confluence tools (read-only operations):
```bash
npm run test-confluence -- 123456789
```

## Contributing

See [.github/copilot-instructions.md](.github/copilot-instructions.md) for coding standards and contribution guidelines.

## License

See [LICENSE.md](LICENSE.md).

