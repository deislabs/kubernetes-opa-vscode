export const OPA_HELM_RELEASE_NAME = 'opa';
export const OPA_NAMESPACE = 'opa';
export const OPA_DEV_REGO_ANNOTATION = 'k8s-opa-vscode.hestia.cc/devrego';

export function isSystemConfigMap(name: string): boolean {
    return name === 'opa-default-system-main';
}
