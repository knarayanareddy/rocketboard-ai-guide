import * as vscode from 'vscode';
import * as path from 'path';

export interface SourceSpan {
    span_id: string; // e.g., "S1"
    path: string;
    start_line?: number;
    end_line?: number;
}

export async function handleCitationClick(badge: string, sourceMap: SourceSpan[]) {
    // Parse the badge "S1"
    const spanId = badge.replace(/[\[\]]/g, '');
    const span = sourceMap.find(s => s.span_id === spanId);
    
    if (!span) {
        vscode.window.showWarningMessage(`Citation [${badge}] not found in source map.`);
        return;
    }
    
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace open to locate the file.');
        return;
    }
    
    let foundUri: vscode.Uri | null = null;
    
    // Check across workspace folders until found
    for (const folder of workspaceFolders) {
        // SECURITY: Prevent path traversal (e.g., ../../../etc/passwd)
        const resolvedPath = path.resolve(folder.uri.fsPath, span.path);
        if (!resolvedPath.startsWith(folder.uri.fsPath + path.sep)) {
            vscode.window.showErrorMessage(`Security Error: Citation path attempts to traverse outside workspace root: ${span.path}`);
            return;
        }

        try {
            const uri = vscode.Uri.file(resolvedPath);
            await vscode.workspace.fs.stat(uri);
            foundUri = uri;
            break;
        } catch (e) {
            // Does not exist in this folder, try next
        }
    }
    
    if (!foundUri) {
        const result = await vscode.window.showWarningMessage(
            `Could not find local file: ${span.path}`, 
            'Copy Citation', 
            'Copy Filepath'
        );
        if (result === 'Copy Citation') vscode.env.clipboard.writeText(`[${badge}]`);
        if (result === 'Copy Filepath') vscode.env.clipboard.writeText(span.path);
        return;
    }
    
    // Open the document and reveal the referenced range
    const document = await vscode.workspace.openTextDocument(foundUri);
    const editor = await vscode.window.showTextDocument(document);
    
    // Coordinate clamping and sanity checking bounds
    const startL = Math.max(1, span.start_line || 1);
    const endL = Math.max(startL, span.end_line || startL);
    
    // SECURITY: Enforce reasonable bounds limits (max 5000 lines)
    if (endL - startL > 5000) {
        vscode.window.showErrorMessage(`Security Error: Citation range unexpectedly large (${endL - startL} lines).`);
        return;
    }
    
    const startLine = startL - 1;
    const endLine = endL - 1;
    
    const maxLineObj = document.lineCount > 0 ? document.lineAt(Math.min(endLine, document.lineCount - 1)) : undefined;
    const range = new vscode.Range(startLine, 0, Math.min(endLine, document.lineCount - 1), maxLineObj ? maxLineObj.text.length : 0);
    
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
}
