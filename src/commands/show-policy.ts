import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { unavailableMessage } from '../utils/host';
import { PolicyBrowser } from '../ui/policy-browser';
import { ConfigMap, policyError, PolicyError } from '../opa';
import { definedOf } from '../utils/array';

export async function showPolicy(target: any) {
    const clusterExplorer = await k8s.extension.clusterExplorer.v1;
    if (!clusterExplorer.available) {
        await vscode.window.showWarningMessage(`Can't run command: ${unavailableMessage(clusterExplorer.reason)}`);
        return;
    }

    const node = PolicyBrowser.resolve(target, clusterExplorer.api);
    if (node && node.nodeType === 'policy') {
        const policy = node.configmap;
        await tryShowPolicy(policy);
    }
}

async function tryShowPolicy(policy: ConfigMap): Promise<void> {
    const markdown = renderMarkdown(policy);
    const mdhtml = await vscode.commands.executeCommand<string>('markdown.api.render', markdown);
    if (!mdhtml) {
        await vscode.window.showErrorMessage("Can't show policy: internal error");
        return;
    }

    const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none';"><head><body>${mdhtml}</body></html>`;

    const webview = vscode.window.createWebviewPanel('opak8s-policy-view', policy.metadata.name, vscode.ViewColumn.Active, { enableFindWidget: true });
    webview.webview.html = html;
    webview.reveal();
}

function renderMarkdown(policy: ConfigMap): string {
    return definedOf(renderErrorMarkdown(policy), renderRegoMarkdown(policy)).join('\n\n---\n\n');
}

function renderErrorMarkdown(policy: ConfigMap): string | undefined {
    const error = policyError(policy);
    if (!error) {
        return undefined;
    }

    return `
## Error: ${error.message}

Error code: '${error.code}'

${renderErrorDetails(error)}`;
}

function renderErrorDetails(error: PolicyError): string {
    if (!error.errors) {
        return '';
    }
    const errorInfos = error.errors.map((e) => `* ${e.message} (${e.location.file}: ${e.location.row}, ${e.location.col})`);
    return `Error details:\n${errorInfos.join('\n')}`;
}

function renderRegoMarkdown(policy: ConfigMap): string | undefined {
    const data = policy.data;
    const files = Object.keys(data);
    if (files.length === 0) {
        return undefined;
    }
    if (files.length === 1) {
        return codeBlock(data[files[0]]);
    }
    return files.map((f) => `### ${f}\n\n` + codeBlock(data[f])).join('\n\n---\n\n');
}

function codeBlock(text: string): string {
    const lines = text.split('\n');
    const blockedLines = lines.map((l) => `    ${l}`);
    return blockedLines.join('\n');
}
