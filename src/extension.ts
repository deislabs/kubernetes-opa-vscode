import * as vscode from 'vscode';
import { install } from './commands/install';

export function activate(context: vscode.ExtensionContext) {

    const disposables = [
        vscode.commands.registerCommand('opak8s.install', install),
        vscode.commands.registerTextEditorCommand('opak8s.deployRego', deployRego),
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {
}

function deployRego(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    vscode.window.showInformationMessage("quick everybody look like you're deploying");
}
