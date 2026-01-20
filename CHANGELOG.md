# Changelog

All notable changes to the Tork AI Governance VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-21

### Added

- **Initial Release**

#### PII Detection
- Automatic inline PII detection for open files
- Support for email, SSN, phone, credit card, IP address, DOB, passport, and driver's license patterns
- Configurable severity levels (hint, information, warning, error)
- Quick fix to redact detected PII
- Gutter decorations for PII warnings
- Configurable patterns to detect
- Exclude patterns for files to skip

#### Policy YAML Support
- Syntax highlighting for `.tork.yaml` and `.tork.yml` files
- Language grammar for policy keywords, actions, conditions
- Code folding support
- Comment highlighting
- Bracket matching

#### Commands
- `Tork: Evaluate Selected Text` - Send selection to Tork API for evaluation
- `Tork: Insert Policy Template` - Quick pick menu with policy templates
- `Tork: Scan File for PII` - Manually scan current file
- `Tork: Redact PII in Selection` - Redact detected PII
- `Tork: Configure API Key` - Set up API credentials
- `Tork: Validate Policy File` - Validate policy YAML

#### Policy Templates
- Basic Policy template
- PII Protection policy
- Content Moderation policy
- Rate Limiting policy
- Tool Governance policy
- Human-in-the-Loop (HITL) policy
- Compliance Logging policy
- Jailbreak Prevention policy

#### Snippets
- `tork-policy` - Full policy template
- `tork-pii` - PII protection policy
- `tork-moderation` - Content moderation
- `tork-ratelimit` - Rate limiting
- `tork-tools` - Tool governance
- `tork-hitl` - Human approval workflow
- `tork-rule` - Single rule
- `tork-condition` - Condition block

#### Status Bar
- Connection status indicator
- PII detection status
- Click to configure API key

#### Configuration
- `tork.apiKey` - API key setting
- `tork.apiUrl` - Custom API endpoint
- `tork.enablePiiDetection` - Toggle PII scanning
- `tork.piiSeverity` - Diagnostic severity
- `tork.piiPatterns` - Patterns to detect
- `tork.autoScanOnSave` - Scan on file save
- `tork.excludePatterns` - Files to exclude

### Security
- API keys stored securely in VS Code settings
- Local PII detection (no API calls)
- Explicit user action required for API evaluation

---

## [Unreleased]

### Planned
- Policy file validation with detailed error reporting
- IntelliSense for policy fields
- Policy simulation/dry-run mode
- Integration with Tork dashboard
- Real-time policy sync
- Team policy sharing
- VS Code Copilot integration
