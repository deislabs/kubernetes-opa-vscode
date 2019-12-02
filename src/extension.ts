import * as vscode from 'vscode';
import { install } from './commands/install';
import { deployRego } from './commands/deploy-rego';

export function activate(context: vscode.ExtensionContext) {

    const disposables = [
        vscode.commands.registerCommand('opak8s.install', install),
        vscode.commands.registerTextEditorCommand('opak8s.deployRego', deployRego),
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {
}
