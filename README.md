# Atlassian Tools for VS Code

Interact with Jira tickets and Confluence pages directly in GitHub Copilot chat.

## Features

- **Atlassian integrations:** Connect to Jira and Confluence using a single set of credentials (base URL, email, API token).
- **Jira:** Read and search issues (JQL), view changelogs, manage comments and worklogs, fetch attachments, manage watchers/votes, perform transitions and assignments, bulk-fetch issues, and access create/update metadata.
- **Confluence:** Search pages (CQL), read/create/update/delete pages, and manage comments using both the v1 (page-level) and v2 (footer/inline) comment APIs (create, reply, update, delete, resolve, reopen).
- **Developer tooling:** Built-in scripts to verify connectivity and run comprehensive integration tests for both Jira and Confluence language model tools.

## Configuration

The extension reads Atlassian credentials from VS Code settings or a `.env` file. The repository provides a `.env.example` as a starting point.

- `atlassianTools.atlassianBaseUrl` - Atlassian base URL (e.g., `https://yourcompany.atlassian.net`)
- `atlassianTools.atlassianEmail` - Atlassian account email
- `atlassianTools.atlassianApiToken` - Atlassian API token

These three values are used for both Jira and Confluence requests in this extension.

## Usage

### In GitHub Copilot Chat

Ask questions like:
- "Get details for ticket_number"
- "Search for Jira issues in project project_name that are in progress"
- "Find Confluence pages about ticket_number"
- "Create a Confluence page with title 'Improve feature X' in space space_name"

### Language Model Tools

This extension exposes a collection of language model tools registered in the extension manifest. The authoritative definitions (tool names, descriptions, and input schemas) live in `package.json` under `contributes.languageModelTools`.

Major tool groups include:
- **Jira tools:** issue read/search (JQL), comments, worklogs, changelogs, transitions, create/update/assign/delete, attachments, watchers and votes, bulk fetch, and create metadata.
- **Confluence tools:** page search/read/create/update/delete and v2 comment management (footer & inline: create, reply, update, delete, resolve, reopen).

Open `package.json` to view full tool definitions and input schemas.

## Development

Install dependencies and compile TypeScript:

```bash
npm install
npm run compile
```

Useful npm scripts in this repository:

- `npm run lint` — run ESLint against `src/`
- `npm run compile` — compile TypeScript
- `npm run watch` — run `tsc` in watch mode
- `npm run verify` — run connectivity verification script (`src/scripts/verifyConnectivity.ts`)
 - `npm run test-jira -- <ISSUE_KEY>` — run comprehensive Jira tool tests (`src/scripts/testJiraTools.ts`)
 - `npm run test-confluence -- <PAGE_ID>` — run comprehensive Confluence tool tests (`src/scripts/testConfluenceTools.ts`)

Changelog and release notes are available in `CHANGELOG.md`.

