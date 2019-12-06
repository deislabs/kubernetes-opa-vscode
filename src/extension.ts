import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { install } from './commands/install';
import { deployRego } from './commands/deploy-rego';
import { unavailableMessage } from './utils/host';
import { PolicyBrowser } from './ui/policy-browser';
import { showPolicy } from './commands/show-policy';
import { deletePolicy } from './commands/delete-policy';
import { findFileInWorkspace } from './commands/find-file-in-workspace';
import { syncFromWorkspace } from './commands/sync-from-workspace';

export async function activate(context: vscode.ExtensionContext) {
    const disposables = [
        vscode.commands.registerCommand('opak8s.install', install),
        vscode.commands.registerTextEditorCommand('opak8s.deployRego', deployRego),
        vscode.commands.registerCommand('opak8s.showPolicy', showPolicy),
        vscode.commands.registerCommand('opak8s.findFileInWorkspace', findFileInWorkspace),
        vscode.commands.registerCommand('opak8s.deletePolicy', deletePolicy),
        vscode.commands.registerCommand('opak8s.syncFromWorkspace', syncFromWorkspace),
    ];

    context.subscriptions.push(...disposables);

    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    const kubectl = await k8s.extension.kubectl.v1;
    if (!clusterExplorer.available) {
        vscode.window.showWarningMessage(`Can't show OPA policies: ${unavailableMessage(clusterExplorer.reason)}`);
    } else if (!kubectl.available) {
        vscode.window.showWarningMessage(`Can't show OPA policies: ${unavailableMessage(kubectl.reason)}`);
    } else {
        clusterExplorer.api.registerNodeContributor(PolicyBrowser.create(kubectl.api, context));
    }
}

export function deactivate() {
}
