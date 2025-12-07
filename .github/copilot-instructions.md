# GitHub Copilot Instructions for Atlassian VS Code Extension

This file provides coding standards and best practices for contributing to the Atlassian VS Code extension codebase.

## General Guidelines

- **Use Latest Atlassian APIs**: Ensure compatibility with the latest Atlassian APIs. Update the old APIs if necessary.
- **Zero Lint Errors**: All changes must pass `npm run lint` without errors or warnings
- **TypeScript Best Practices**: Follow strict TypeScript conventions
- **Unit Tests**: Do not break existing tests; ensure `npm run verify` passes
- **Build Success**: All code must compile successfully with `npm run compile`

## TypeScript Standards

- Use explicit types for function parameters and return values
- Avoid `any` type unless absolutely necessary
- Use `const` over `let` when variables don't need reassignment
- Follow async/await patterns consistently
- Handle errors gracefully with try-catch blocks

## Code Quality

- Always check and consolidate src/scripts to have tests to cover all the language model tools 
- Remove unused imports and variables
- No trailing whitespace in files
- Use meaningful variable and function names
- Keep functions focused and concise

## Testing Requirements

- Run all reading verification in src/scripts
- Do not run any create/update/deletion scripts
- Run tests before committing: `npm run verify`
- Update tests when modifying functionality
- Add tests for new features when appropriate
- Ensure integration tests pass

## File Operations

- Use `fs.promises` for async file operations
- Handle file system errors appropriately
- Use `path.join()` for cross-platform path handling
- Clean up resources (file handles, watchers, etc.)

## VS Code Extension Guidelines

- Follow VS Code extension API patterns
- Register and dispose of resources properly
- Use VS Code's workspace and file system APIs
- Handle extension activation/deactivation correctly

## Before Submitting Changes

1. Run `npm run lint` - must pass with zero errors
2. Run `npm run compile` - must compile successfully
3. Run `npm run verify` - all tests must pass
4. Review changes for TypeScript best practices
5. Ensure no unused code or imports remain
6. Verify functionality works as expected

## Common Patterns in This Codebase

- Use `vscode` namespace for VS Code APIs
- Follow the existing project structure
- Maintain backward compatibility when possible
- Use the test model (`TestModel`) for test management
- Follow the existing command registration patterns

## Code Review Checklist

- [ ] No lint errors introduced
- [ ] TypeScript best practices followed
- [ ] Unit tests not broken
- [ ] Build succeeds
- [ ] No console.log statements left behind
- [ ] Error handling implemented
- [ ] Resources properly disposed
- [ ] Documentation updated if needed
