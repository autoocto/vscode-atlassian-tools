import * as vscode from 'vscode';

/**
 * Handle errors and return formatted error result for language model tools
 */
export function handleToolError(error: any, context?: string): vscode.LanguageModelToolResult {
    const message = error?.message || String(error);
    const fullMessage = context ? `${context}: ${message}` : message;
    
    console.error('Atlassian Tools Error:', fullMessage, error);
    
    return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error: ${fullMessage}`)
    ]);
}

/**
 * Create a success result for language model tools
 */
export function createSuccessResult(data: any): vscode.LanguageModelToolResult {
    return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(data, null, 2))
    ]);
}

/**
 * Create a warning result for language model tools
 */
export function createWarningResult(message: string): vscode.LanguageModelToolResult {
    return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Warning: ${message}`)
    ]);
}
