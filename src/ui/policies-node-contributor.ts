import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { isSystemConfigMap, OPA_NAMESPACE, GetConfigMapsResponse, ConfigMap, policyStatus, PolicyStatus, policyIsDevRego } from '../opa';

export class OPAPoliciesNodeContributor implements k8s.ClusterExplorerV1.NodeContributor {
    constructor(private readonly kubectl: k8s.KubectlV1, private readonly extensionContext: vscode.ExtensionContext) {}
    contributesChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
        return !!parent && parent.nodeType === 'context';
    }

    async getChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<k8s.ClusterExplorerV1.Node[]> {
        if (!parent || parent.nodeType !== 'context') {
            return [];
        }

        return [new PoliciesFolderNode(this.kubectl, this.extensionContext)];  // TODO: consider showing only if opa namespace exists or something like that
    }
}

export interface PolicyTreeNode {
    readonly configmap: ConfigMap;
}

class PoliciesFolderNode implements k8s.ClusterExplorerV1.Node {
    constructor(private readonly kubectl: k8s.KubectlV1, private readonly extensionContext: vscode.ExtensionContext) {}
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        const sr = await this.kubectl.invokeCommand(`get configmap --namespace ${OPA_NAMESPACE} -o json`);
        if (!sr || sr.code !== 0) {
            return [new ErrorNode(sr)];
        }

        const configmaps: GetConfigMapsResponse = JSON.parse(sr.stdout);
        if (configmaps.items) {
            return configmaps.items
                             .filter((cm) => !isSystemConfigMap(cm))
                             .map((cm) => new PolicyNode(cm, this.extensionContext));
        }

        return [];
    }
    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem('OPA Policies', vscode.TreeItemCollapsibleState.Collapsed);
    }
}

class PolicyNode implements k8s.ClusterExplorerV1.Node, PolicyTreeNode {
    constructor(readonly configmap: ConfigMap, private readonly extensionContext: vscode.ExtensionContext) { }
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.configmap.metadata.name);
        treeItem.iconPath = this.extensionContext.asAbsolutePath(policyIcon(this.configmap));
        treeItem.contextValue = 'opak8s.policy';
        return treeItem;
    }
}

class ErrorNode implements k8s.ClusterExplorerV1.Node {
    constructor(private readonly sr: k8s.KubectlV1.ShellResult | undefined) { }
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('Error');
        treeItem.tooltip = this.tooltip();
        return treeItem;
    }
    private tooltip(): string {
        if (!this.sr) {
            return 'Unable to run kubectl';
        }
        return this.sr.stderr;
    }
}

function policyIcon(policy: ConfigMap): string {
    const statusPart = policyStatusIconPart(policy);
    const devPart = policyDevRegoPart(policy);
    return `images/policy-${statusPart}-${devPart}.svg`;
}

function policyStatusIconPart(policy: ConfigMap): string {
    const status = policyStatus(policy);
    switch (status) {
        case PolicyStatus.Unevaluated: return 'unevaluated';
        case PolicyStatus.Valid: return 'ok';
        case PolicyStatus.Error: return 'error';
    }
}

function policyDevRegoPart(policy: ConfigMap): string {
    if (policyIsDevRego(policy)) {
        return 'devrego';
    }
    return 'nondevrego';
}
