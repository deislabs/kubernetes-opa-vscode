import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage, confirm, longRunning } from '../utils/host';
import { PolicyTreeNode } from '../ui/policies-node-contributor';  // TODO: consider how to decouple
import { policyIsDevRego, ConfigMap, OPA_NAMESPACE } from '../opa';

export async function deletePolicy(target: any) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    const kubectl = await k8s.extension.kubectl.v1;
    if (!clusterExplorer.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(clusterExplorer.reason)}`);
        return;
    } else if (!kubectl.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(kubectl.reason)}`);
        return;
    }

    const node = clusterExplorer.api.resolveCommandTarget(target);
    if (node && node.nodeType === 'extension') {
        const policyNode = target.impl /* something not great in the API here */ as PolicyTreeNode;  // TODO: tighten up the design here
        const policy = policyNode.configmap;
        await tryDeletePolicy(policy, clusterExplorer.api, kubectl.api);
    }
}

async function tryDeletePolicy(policy: ConfigMap, clusterExplorer: k8s.ClusterExplorerV1, kubectl: k8s.KubectlV1): Promise<void> {
    if (!policyIsDevRego(policy)) {
        const confirmed = await confirm(`Config map ${policy.metadata.name} was not deployed by the OPA extension.`, 'Delete it Anyway');
        if (!confirmed) {
            return;
        }
    }

    const deleteResult = await longRunning(`Deleting config map ${policy.metadata.name}...`, () =>
        kubectl.invokeCommand(`delete configmap ${policy.metadata.name} --namespace=${OPA_NAMESPACE}`)
    );

    if (deleteResult && deleteResult.code === 0) {
        clusterExplorer.refresh();
        await vscode.window.showInformationMessage(`Deleted config map ${policy.metadata.name}`);
    } else {
        const reason = deleteResult ? deleteResult.stderr : 'unable to run kubectl';
        await vscode.window.showErrorMessage(`Error deleteing config map ${policy.metadata.name}: ${reason}`);
    }
}
