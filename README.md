# Tork AI Governance for VS Code

[![Version](https://img.shields.io/visual-studio-marketplace/v/torknetwork.tork-governance)](https://marketplace.visualstudio.com/items?itemName=torknetwork.tork-governance)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/torknetwork.tork-governance)](https://marketplace.visualstudio.com/items?itemName=torknetwork.tork-governance)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/torknetwork.tork-governance)](https://marketplace.visualstudio.com/items?itemName=torknetwork.tork-governance)

AI governance, policy validation, and PII detection for Visual Studio Code. Secure your AI applications with enterprise-grade policy enforcement.

![Tork Extension Demo](images/demo.gif)

## Features

### 🔍 Inline PII Detection

Automatically detect potential PII (Personally Identifiable Information) in your code and documents:

- **Email addresses**
- **Social Security Numbers (SSN)**
- **Credit card numbers**
- **Phone numbers**
- **IP addresses**
- **Dates of birth**
- **Passport numbers**
- **Driver's license numbers**

PII is highlighted with warning decorations in the gutter, and you can quickly redact them with a single command.

![PII Detection](images/pii-detection.png)

### 📝 Policy YAML Syntax Highlighting

First-class support for Tork policy files (`.tork.yaml`, `.tork.yml`):

- Syntax highlighting for policy keywords, actions, conditions
- Auto-completion and IntelliSense
- Bracket matching and folding
- Code snippets for common patterns

![Syntax Highlighting](images/syntax-highlighting.png)

### 🛡️ Evaluate Selected Text

Send any selected text to the Tork API for governance evaluation:

1. Select text in any file
2. Run `Tork: Evaluate Selected Text` (Cmd+Shift+T / Ctrl+Shift+T)
3. View results in the output panel

Results include:
- Decision (ALLOW, BLOCK, WARN, REDACT, ESCALATE)
- Risk score
- Policy violations
- PII detections

### 📋 Policy Templates

Quickly insert pre-built policy templates:

1. Run `Tork: Insert Policy Template`
2. Choose from templates:
   - **PII Protection** - Detect and redact sensitive data
   - **Content Moderation** - Block harmful content
   - **Rate Limiting** - Prevent API abuse
   - **Tool Governance** - Control AI agent tools
   - **Human-in-the-Loop** - Require approval for sensitive actions
   - **Compliance Logging** - Audit trails for regulations
   - **Jailbreak Prevention** - Block prompt injection

### 📊 Status Bar Integration

The Tork status bar shows:
- Connection status to Tork API
- PII detection status
- Quick access to configuration

Click the status bar item to configure your API key.

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)
3. Search for "Tork AI Governance"
4. Click Install

### From VSIX

```bash
code --install-extension tork-governance-0.1.0.vsix
```

## Configuration

Open VS Code Settings (Cmd+, / Ctrl+,) and search for "Tork":

| Setting | Description | Default |
|---------|-------------|---------|
| `tork.apiKey` | Your Tork API key | `""` |
| `tork.apiUrl` | Tork API endpoint | `https://api.tork.network` |
| `tork.enablePiiDetection` | Enable automatic PII scanning | `true` |
| `tork.piiSeverity` | Diagnostic severity for PII | `warning` |
| `tork.piiPatterns` | PII patterns to detect | `["email", "ssn", "phone", "creditCard", "ipAddress"]` |
| `tork.autoScanOnSave` | Scan for PII when saving files | `true` |
| `tork.excludePatterns` | File patterns to exclude from scanning | `["**/node_modules/**", "**/dist/**"]` |

### Getting an API Key

1. Sign up at [tork.network](https://tork.network)
2. Go to Dashboard → API Keys
3. Create a new API key
4. Copy the key and paste it in VS Code settings

## Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `Tork: Evaluate Selected Text` | Evaluate selection with Tork API | Cmd+Shift+T |
| `Tork: Insert Policy Template` | Insert a policy template | - |
| `Tork: Scan File for PII` | Scan current file for PII | - |
| `Tork: Redact PII in Selection` | Redact detected PII | - |
| `Tork: Configure API Key` | Set your Tork API key | - |
| `Tork: Validate Policy File` | Validate a .tork.yaml file | - |

## Supported File Types

### Policy Files
- `.tork.yaml`
- `.tork.yml`

### PII Scanning
All text files are scanned by default. Binary files and files matching exclude patterns are skipped.

## Example Policy File

```yaml
# content-moderation.tork.yaml
version: "1.0.0"
name: content-moderation
description: Block harmful content in AI interactions

rules:
  - name: block-harmful-instructions
    description: Block requests for harmful content
    condition:
      contains:
        - "how to hack"
        - "bypass security"
    action: BLOCK
    severity: CRITICAL

  - name: redact-pii
    description: Redact personal information
    condition:
      pattern: EMAIL
    action: REDACT
    severity: MEDIUM
```

## Snippets

Type these prefixes to insert policy snippets:

| Prefix | Description |
|--------|-------------|
| `tork-policy` | Basic policy template |
| `tork-pii` | PII protection policy |
| `tork-moderation` | Content moderation policy |
| `tork-ratelimit` | Rate limiting policy |
| `tork-tools` | Tool governance policy |
| `tork-hitl` | Human-in-the-loop policy |
| `tork-rule` | Single rule template |
| `tork-condition` | Condition block |

## Troubleshooting

### PII Detection Not Working

1. Check that `tork.enablePiiDetection` is enabled
2. Verify the file is not in `tork.excludePatterns`
3. Check the file extension is not in the skip list

### API Connection Failed

1. Verify your API key is correct
2. Check your internet connection
3. Ensure `tork.apiUrl` is correct (default: `https://api.tork.network`)

### Syntax Highlighting Not Showing

1. Make sure your file has `.tork.yaml` or `.tork.yml` extension
2. Or manually set the language mode to "Tork Policy"

## Privacy

- PII detection runs locally in VS Code
- API calls only occur when you explicitly run evaluation commands
- Your code is only sent to Tork API when you use evaluation features
- See our [Privacy Policy](https://tork.network/privacy)

## Support

- [Documentation](https://tork.network/docs)
- [GitHub Issues](https://github.com/torkjacobs/tork-vscode-extension/issues)
- [Discord Community](https://discord.gg/tork)
- Email: support@tork.network

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with ❤️ by [Tork Network](https://tork.network)
