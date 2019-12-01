import * as vscode from 'vscode';
import * as k8s from 'vscode-kubernetes-tools-api';
import { showUnavailable } from '../utils/host';

export async function deployRego(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    const kubectl = await k8s.extension.kubectl.v1;
    if (!kubectl.available) {
        await showUnavailable(kubectl.reason);
        return;
    }

    const uri = textEditor.document.uri;
    if (uri.scheme === 'file') {
        await textEditor.document.save();
    } else {
        // NOTE: we don't need to handle the 'untitled' case because the language ID
        // won't be set until the document is saved
        vscode.window.showErrorMessage('This command requires the document to be a file. Save your document to the file system and try again.');
        return;
    }

    await createOrUpdateConfigMapFrom(uri);
}
async function createOrUpdateConfigMapFrom(uri: vscode.Uri) {
    // kubectl create configmap somename --from-file=path/to/file ... --save-config=true?

    // TODO: what if it already exists?
    // DIAGNOSIS: kubectl create configmap returns code 1 and stderr contains the
    // string "(AlreadyExists)"
    // --save-config means we can apply a change but that requires
    // us to compose the YAML in which case we might as well
    // do that every time.  The way Brendan does this in the k8s extension is to
    // download the CM from the cluster, modify the JSON, and do a replace...

    // const dataHolderJson = await kubectl.asJson<DataHolder>(`get ${obj.kind.abbreviation} ${obj.name} --namespace=${currentNS} -o json`);
    // dataHolder.data[fileName] = buff.toString();
    // const out = JSON.stringify(dataHolder);
    // await kubectl.invokeAsync(`replace -f - --namespace=${currentNS}`, out);

    // TODO: want to annotate it so we know it was a dev deployment from the extension
    // kubectl annotate configmap somename "k8s-opa-vscode.hestia.cc/devrego=true"
    // NOTE: if we synthesise the YAML we can do this atomically

    await vscode.window.showInformationMessage(`quick everybody look like you're deploying ${uri.toString()}`);
}
