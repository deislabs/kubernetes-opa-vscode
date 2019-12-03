import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { install } from './commands/install';
import { deployRego } from './commands/deploy-rego';
import { unavailableMessage } from './utils/host';
import { OPAPoliciesNodeContributor } from './ui/policies-node-contributor';
import { deletePolicy } from './commands/delete-policy';

export async function activate(context: vscode.ExtensionContext) {
    const disposables = [
        vscode.commands.registerCommand('opak8s.install', install),
        vscode.commands.registerTextEditorCommand('opak8s.deployRego', deployRego),
        vscode.commands.registerCommand('opak8s.deletePolicy', deletePolicy),
    ];

    context.subscriptions.push(...disposables);

    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    const kubectl = await k8s.extension.kubectl.v1;
    if (!clusterExplorer.available) {
        vscode.window.showWarningMessage(`Can't show OPA policies: ${unavailableMessage(clusterExplorer.reason)}`);
    } else if (!kubectl.available) {
        vscode.window.showWarningMessage(`Can't show OPA policies: ${unavailableMessage(kubectl.reason)}`);
    } else {
        clusterExplorer.api.registerNodeContributor(new OPAPoliciesNodeContributor(kubectl.api, context));
    }
}

export function deactivate() {
}
