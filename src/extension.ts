import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

    const disposables = [
        vscode.commands.registerCommand('opak8s.install', install)
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {
}

function install() {
    vscode.window.showInformationMessage("quick everybody look like you're installing");
}
