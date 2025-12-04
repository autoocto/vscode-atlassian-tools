# Atlassian Tools for VS Code

Interact with Jira tickets and Confluence pages directly in GitHub Copilot chat.

## Features

- **Jira Tools**
  - Get Jira issue details
  - Search issues using JQL
  - Get issue links and relationships
  - Gather comprehensive issue context (including sub-tasks and linked issues)
  - Create comments on Jira tickets

- **Confluence Tools**
  - Search Confluence pages using CQL
  - Get page content by ID
  - Create new Confluence pages
  - Update existing pages
  - Search pages by Jira ticket key

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

The extension registers the following language model tools:
- `getJiraIssue` - Get details for a specific Jira issue
- `searchJiraIssues` - Search Jira using JQL
- `getJiraIssueLinks` - Get linked issues
- `gatherJiraIssueContext` - Get comprehensive context (main issue + sub-tasks + links)
- `createJiraComment` - Add a comment to a ticket
- `searchConfluencePages` - Search Confluence using CQL
- `getConfluencePage` - Get page by ID
- `createConfluencePage` - Create a new page
- `updateConfluencePage` - Update an existing page
- `searchConfluenceByJiraKey` - Find pages mentioning a Jira ticket

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
- `npm run read-jira -- <KEY>` — fetch and print a Jira ticket (`src/scripts/readJiraTicket.ts`)
- `npm run create-confluence-draft` — run `src/scripts/createConfluenceDraft.ts`
- `npm run publish-confluence-draft` — run `src/scripts/publishConfluenceDraft.ts`

