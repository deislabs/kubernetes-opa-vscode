import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';

export class OPAPoliciesNodeContributor implements k8s.ClusterExplorerV1.NodeContributor {
    contributesChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): boolean {
        return !!parent && parent.nodeType === 'context';
    }

    async getChildren(parent: k8s.ClusterExplorerV1.ClusterExplorerNode | undefined): Promise<k8s.ClusterExplorerV1.Node[]> {
        if (!parent || parent.nodeType !== 'context') {
            return [];
        }

        return [new PoliciesFolderNode()];
    }
}

class PoliciesFolderNode implements k8s.ClusterExplorerV1.Node {
    async getChildren(): Promise<k8s.ClusterExplorerV1.Node[]> {
        return [];
    }
    getTreeItem(): vscode.TreeItem {
        return new vscode.TreeItem('OPA Policies');
    }
}
