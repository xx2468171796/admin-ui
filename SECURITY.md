# Security Policy

## Supported versions

Only the latest minor release of the current major version receives security fixes.

| Version | Supported |
|---|---|
| 8.x (latest minor) | yes |
| < 8.0 | no |

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private vulnerability reporting:
[https://github.com/xx2468171796/admin-ui/security/advisories/new](https://github.com/xx2468171796/admin-ui/security/advisories/new).

Include the affected version, a minimal reproduction and the impact you see. We aim to acknowledge reports within 3 working days and to ship a fix or mitigation within 30 days; we will credit you in the advisory unless you prefer otherwise.

## Scope

admin-ui is a client-side UI library. It renders what your adapters return and never talks to a server by itself. Issues in scope include XSS through component props or Markdown rendering, unsafe URL handling in links / uploads / previews, and anything in the published npm package or the `admin-ui-audit` bin. Authentication, authorization and data validation are the host application's job and are out of scope unless a component makes them impossible to do safely.

## 安全问题（中文）

请不要公开提 issue，使用上面的 GitHub 私密漏洞报告入口，附上受影响版本、最小复现和影响。我们会在 3 个工作日内回复，30 天内给出修复或缓解措施。
