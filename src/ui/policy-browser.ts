import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { ConfigMap, policyStatus, PolicyStatus, policyIsDevRego, policyError, listPolicies } from '../opa';
import { definedOf } from '../utils/array';
import { failed } from '../utils/errorable';

const OPA_TREE_NODE_KEY = 'opak8s_tree_node_8357fa36-5ade-4b9b-b0f4-ac07d6460c5c';

export namespace PolicyBrowser {
    export function create(kubectl: k8s.KubectlV1, extensionContext: vscode.ExtensionContext): k8s.ClusterExplorerV1.NodeContributor {
        return new PoliciesNodeContributor(kubectl, extensionContext);
    }

    export function resolve(target: any, clusterExplorer: k8s.ClusterExplorerV1): Node | undefined {
        const k8snode = clusterExplorer.resolveCommandTarget(target);
        if (!k8snode) {
            // this can happen if a node gets passed unwrapped via vscode.TreeItem.command.arguments
            return typedNode(target);
        }
        if (k8snode.nodeType !== 'extension') {
            return undefined;
        }
        return typedNode(target.impl);  // TODO: fix the API
    }

    function typedNode(node: any): Node | undefined {
        if (!node || !node[OPA_TREE_NODE_KEY]) {
            return undefined;
        }
        if (node.nodeType === 'policy') {
            return node as PolicyNode;
        } else if (node.nodeType === 'folder.policies') {
            return node as PoliciesFolderNode;
        } else {
            return undefined;
        }
    }

    export interface OPATreeNode {
        readonly [OPA_TREE_NODE_KEY]: true;
    }
    export interface PolicyNode extends OPATreeNode {
        readonly nodeType: 'policy';
        readonly configmap: ConfigMap;
    }

    export interface PoliciesFolderNode extends OPATreeNode {
        readonly nodeType: 'folder.policies';
    }

    export type Node = PolicyNode | PoliciesFolderNode;
}

class PoliciesNodeContributor implements k8s.ClusterExplorerV1.NodeContributor {
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

class PoliciesFolderNode implements k8s.ClusterExplorerV1.Node, PolicyBrowser.PoliciesFolderNode {
    constructor(private readonly kubectl: k8s.KubectlV1, private readonly extensionContext: vscode.ExtensionContext) {}
    readonly [OPA_TREE_NODE_KEY] = true;
    readonly nodeType = 'folder.policies';
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        const policies = await listPolicies(this.kubectl);
        if (failed(policies)) {
            return [new ErrorNode(policies.error[0])];
        }

        return policies.result.map((cm) => new PolicyNode(cm, this.extensionContext));
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('OPA Policies', vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.contextValue = 'opak8s.folder.policies';
        return treeItem;
    }
}

class PolicyNode implements k8s.ClusterExplorerV1.Node, PolicyBrowser.PolicyNode {
    constructor(readonly configmap: ConfigMap, private readonly extensionContext: vscode.ExtensionContext) { }
    readonly [OPA_TREE_NODE_KEY] = true;
    readonly nodeType = 'policy';
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(this.configmap.metadata.name);
        treeItem.iconPath = this.extensionContext.asAbsolutePath(policyIcon(this.configmap));
        treeItem.contextValue = 'opak8s.policy';
        treeItem.tooltip = this.tooltip();
        // TODO: this is seductive but with the webview-based design it ends up opening a load of
        // tabs (including duplicates) - if we are going to have this then we need to move to a
        // document model, which will allow tabs to be transient, so let's park it for now.
        // treeItem.command = { command: 'opak8s.showPolicy', title: 'Show Policy', arguments: [this] };  // NOTE: if invoked this way, the command target is NOT wrapped by the k8s tree structure
        return treeItem;
    }
    private tooltip(): string {
        return definedOf(this.statusTooltipPart(), this.devRegoTooltipPart()).join('\n');
    }
    private statusTooltipPart(): string {
        switch (policyStatus(this.configmap)) {
            case PolicyStatus.Error: return `Error: ${policyError(this.configmap)!.message}`;
            case PolicyStatus.Valid: return 'Valid';
            case PolicyStatus.Unevaluated: return 'Not evaluated by OPA';
        }
    }
    private devRegoTooltipPart(): string | undefined {
        if (policyIsDevRego(this.configmap)) {
            return undefined;
        }
        return 'Not deployed by OPA VS Code extension';
    }
}

class ErrorNode implements k8s.ClusterExplorerV1.Node {
    constructor(private readonly message: string) { }
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        const treeItem = new vscode.TreeItem('Error');
        treeItem.tooltip = this.message;
        return treeItem;
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
