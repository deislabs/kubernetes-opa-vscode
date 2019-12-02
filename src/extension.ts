import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { install } from './commands/install';
import { deployRego } from './commands/deploy-rego';
import { unavailableMessage } from './utils/host';
import { OPAPoliciesNodeContributor } from './ui/policies-node-contributor';

export async function activate(context: vscode.ExtensionContext) {
    const disposables = [
        vscode.commands.registerCommand('opak8s.install', install),
        vscode.commands.registerTextEditorCommand('opak8s.deployRego', deployRego),
    ];

    context.subscriptions.push(...disposables);

    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (clusterExplorer.available) {
        clusterExplorer.api.registerNodeContributor(new OPAPoliciesNodeContributor());
    } else {
        vscode.window.showWarningMessage(`Can't show OPA policies: ${unavailableMessage(clusterExplorer.reason)}`);
    }
}

export function deactivate() {
}
