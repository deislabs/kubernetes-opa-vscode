# Open Policy Agent for Kubernetes for VS Code

This snappily-titled extension helps you to test your Open Policy Agent policies
(`.rego` files) in a Kubernetes development cluster.  It provides the following features:

* One-click install of Open Policy Agent as an admission controller, together
  with supporting configuration such as the standard 'system main' policy hook
  and having it read from Kubernetes configmaps in the `opa` namespace
* While editing a `.rego` file, deploy it as a configmap in the `opa` namespace
  where the Open Policy Agent will pick it up and start enforcing it
* View policies without needing to switch to the `opa` namespace and with visual
  feedback on their status.

## Notes

**This is a very early iteration - expect some fit and finish to be missing!**  For
example, you can currently see that a policy has errors but you can't see what they
are.  It's all very much work in progress!

**The deployment configuration is designed for convenience of development, not for secure deployment.**
If you're putting Open Policy Agent into production, _design deployment strategies for production_.
For example, you may want to deploy policies using bundles and servers rather than config maps.
And you certainly want to be conscious about permissions and roles.  **Don't use this extension
to deploy OPA to production.**
