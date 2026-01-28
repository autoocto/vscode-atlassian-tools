# Changelog

All notable changes to this project will be documented in this file.

## [0.2.4] - 2025-12-07
### Changed
- Reorganized Confluence tools into 5 logical groups (38 total tools)
- Consolidated test scripts: removed obsolete test files, kept comprehensive integration tests
- Cleaned up package.json scripts to only include active test suites

### Added
- 21 new Confluence tools: page history, versions, child pages, ancestors, copy/move pages, labels, attachments, space operations, search enhancements, user search, and page watchers
- Enhanced confluenceHelper with 15+ new methods
- Comprehensive integration tests for all Confluence tools (37 tests)

### Removed
- Obsolete test scripts: testJiraTools.ts and testCreateAndUpdate.ts (superseded by integration tests)

## [0.1.2] - 2025-12-07
### Fixed
- Resolve Jira search API migration by using `/rest/api/3/search/jql` and requesting fields explicitly (`fields=*all`).
- Fix worklog creation date format to use `yyyy-MM-dd'T'HH:mm:ss.SSSZ` with numeric timezone offset.

### Added
- Confluence v2 comment management tools (create, update, delete, reply, resolve, reopen, inline comment operations).
- Comprehensive test scripts for Jira and Confluence language model tools.

### Other
- Updated test infrastructure and verification scripts; all tested tools validated against the live Atlassian instance.

## [0.1.1] - 2025-12-06
- Initial release with Jira and Confluence language model tools.
