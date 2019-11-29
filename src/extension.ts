import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { longRunning } from './utils/host';
import { withTempFile } from './utils/tempfile';

export function activate(context: vscode.ExtensionContext) {

    const disposables = [
        vscode.commands.registerCommand('opak8s.install', install)
    ];

    context.subscriptions.push(...disposables);
}

export function deactivate() {
}

async function install() {
    const helm = await k8s.extension.helm.v1;
    if (!helm.available) {
        await showUnavailable(helm.reason);
        return;
    }
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        await showUnavailable(kubectl.reason);
        return;
    }
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (!clusterExplorer.available) {
        await showUnavailable(clusterExplorer.reason);
        return;
    }

    const installResult = await longRunning('Installing Open Policy Agent...', () =>
        installInto(helm.api, kubectl.api, 'opa', 'opa')
    );

    if (installResult && installResult.code === 0) {
        clusterExplorer.api.refresh();
        await vscode.window.showInformationMessage('Open Policy Agent installed');
        return;
    }

    const reason = installResult ? installResult.stderr : 'unable to run command';
    // TODO: possibly worth trapping for the case where OPA is already installed to give better message
    vscode.window.showInformationMessage(`Failed to install Open Policy Agent: ${reason}`);
}

async function installInto(helm: k8s.HelmV1, kubectl: k8s.KubectlV1, releaseName: string, ns: string): Promise<k8s.KubectlV1.ShellResult | k8s.HelmV1.ShellResult | undefined> {
    const ensureNamespaceResult = await ensureNamespace(kubectl, ns);
    if (!ensureNamespaceResult || ensureNamespaceResult.code !== 0) {
        return ensureNamespaceResult;
    }

    for (const protectedNamespace of ['kube-system', ns]) {
        const labelResult = await kubectl.invokeCommand(`label ns ${protectedNamespace} openpolicyagent.org/webhook=ignore`);
        if (!labelResult || labelResult.code !== 0) {
            return labelResult;
        }
    }

    const installResult = await withTempFile(devInstallationOptions(), 'yaml', (valuesFile) =>
        helm.invokeCommand(`install ${releaseName} stable/opa --namespace ${ns} --values ${valuesFile}`)
    );
    if (!installResult || installResult.code !== 0) {
        return installResult;
    }

    // The 'main' configmap that hooks this all up to the admission controller stuff
    // is *not* part of the Helm chart
    const hookResult = await withTempFile(admissionControlEntryPoint(), 'yaml', (acFile) =>
        kubectl.invokeCommand(`--namespace ${ns} create -f ${acFile}`)
    );
    return hookResult;
}

async function ensureNamespace(kubectl: k8s.KubectlV1, ns: string): Promise<k8s.KubectlV1.ShellResult | undefined> {
    const check = await kubectl.invokeCommand(`get namespace ${ns}`);
    if (check && check.code === 0) {
        return check;  // In this case we're good: return the success result from the get
    }

    return await kubectl.invokeCommand(`create namespace ${ns}`);
}

function devInstallationOptions(): string {
    return `
authz:
  enabled: false
mgmt:
  configmapPolicies:
    enabled: true
    namespaces: ["opa"]
    requireLabel: false
rbac:
  rules:
    cluster:
    - apiGroups: [""]
      resources: ["configmaps"]
      verbs: ["get", "list", "watch", "patch", "update"]
`;
}

function admissionControlEntryPoint(): string {
    return `
apiVersion: v1
kind: ConfigMap
metadata:
    name: opa-default-system-main
data:
    main: |
        package system

        import data.kubernetes.admission

        main = {
            "apiVersion": "admission.k8s.io/v1beta1",
            "kind": "AdmissionReview",
            "response": response,
        }

        default response = {"allowed": true}

        response = {
            "allowed": false,
            "status": {
                "reason": reason,
            },
        } {
            reason = concat(", ", admission.deny)
            reason != ""
        }`;
}

async function showUnavailable(reason: "version-unknown" | "version-removed" | "extension-not-available") {
    await vscode.window.showErrorMessage(unavailableMessage(reason));
}

function unavailableMessage(reason: "version-unknown" | "version-removed" | "extension-not-available"): string {
    switch (reason) {
        case "extension-not-available": return "Cannot run command: please check the 'Kubernetes' extension is installed";
        case "version-removed": return "Cannot run command: please check for updates to the 'Open Policy Agent for Kubernetes' extension";
        case "version-unknown": return "Cannot run command: please check for updates to the 'Kubernetes' extension";
    }
}
