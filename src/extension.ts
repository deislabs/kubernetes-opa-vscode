import * as vscode from 'vscode';
import { install } from './commands/install';

export function activate(context: vscode.ExtensionContext) {

    const disposables = [
        vscode.commands.registerCommand('opak8s.install', install)
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {
}
