import * as vscode from 'vscode';
import { TorkApiClient } from '../utils/apiClient';
import { PiiDiagnosticsProvider } from '../providers/piiDiagnostics';
import { POLICY_TEMPLATES } from './policyTemplates';

export function registerCommands(
  context: vscode.ExtensionContext,
  apiClient: TorkApiClient,
  piiProvider: PiiDiagnosticsProvider
) {
  // Evaluate Selection Command
  context.subscriptions.push(
    vscode.commands.registerCommand('tork.evaluateSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage('No text selected. Please select text to evaluate.');
        return;
      }

      const selectedText = editor.document.getText(selection);

      if (!apiClient.isConfigured()) {
        const action = await vscode.window.showWarningMessage(
          'Tork API key not configured.',
          'Configure Now'
        );
        if (action === 'Configure Now') {
          vscode.commands.executeCommand('tork.configureApiKey');
        }
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Tork: Evaluating content...',
            cancellable: false,
          },
          async () => {
            const result = await apiClient.evaluate(selectedText);

            const outputChannel = vscode.window.createOutputChannel('Tork Evaluation');
            outputChannel.clear();
            outputChannel.appendLine('═══════════════════════════════════════');
            outputChannel.appendLine('       TORK AI GOVERNANCE EVALUATION    ');
            outputChannel.appendLine('═══════════════════════════════════════');
            outputChannel.appendLine('');
            outputChannel.appendLine(`Decision: ${result.decision}`);

            if (result.score !== undefined) {
              outputChannel.appendLine(`Risk Score: ${(result.score * 100).toFixed(1)}%`);
            }

            if (result.reason) {
              outputChannel.appendLine('');
              outputChannel.appendLine(`Reason: ${result.reason}`);
            }

            if (result.detections && result.detections.length > 0) {
              outputChannel.appendLine('');
              outputChannel.appendLine('Detections:');
              result.detections.forEach((d, i) => {
                outputChannel.appendLine(`  ${i + 1}. [${d.type}] "${d.value}" → ${d.action}`);
              });
            }

            if (result.policy_violations && result.policy_violations.length > 0) {
              outputChannel.appendLine('');
              outputChannel.appendLine('Policy Violations:');
              result.policy_violations.forEach((v, i) => {
                outputChannel.appendLine(`  ${i + 1}. [${v.severity}] ${v.rule}: ${v.description}`);
              });
            }

            outputChannel.appendLine('');
            outputChannel.appendLine('═══════════════════════════════════════');
            outputChannel.show();

            // Show notification based on decision
            const icon = result.decision === 'ALLOW' ? '✅' : result.decision === 'BLOCK' ? '🛑' : '⚠️';
            vscode.window.showInformationMessage(
              `${icon} Tork: ${result.decision}${result.reason ? ` - ${result.reason}` : ''}`
            );
          }
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(`Tork evaluation failed: ${error.message}`);
      }
    })
  );

  // Insert Policy Template Command
  context.subscriptions.push(
    vscode.commands.registerCommand('tork.insertPolicyTemplate', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const templateOptions = POLICY_TEMPLATES.map((t) => ({
        label: t.name,
        description: t.description,
        detail: t.tags.join(', '),
        template: t,
      }));

      const selected = await vscode.window.showQuickPick(templateOptions, {
        placeHolder: 'Select a policy template',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (selected) {
        const snippet = new vscode.SnippetString(selected.template.content);
        editor.insertSnippet(snippet);
      }
    })
  );

  // Scan for PII Command
  context.subscriptions.push(
    vscode.commands.registerCommand('tork.scanForPii', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const matches = piiProvider.scanDocument(editor.document);

      if (matches.length === 0) {
        vscode.window.showInformationMessage('No PII detected in this file.');
      } else {
        const typeCounts: Record<string, number> = {};
        matches.forEach((m) => {
          typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
        });

        const summary = Object.entries(typeCounts)
          .map(([type, count]) => `${count} ${type}`)
          .join(', ');

        vscode.window.showWarningMessage(
          `Found ${matches.length} potential PII items: ${summary}`,
          'Redact All'
        ).then((action) => {
          if (action === 'Redact All') {
            piiProvider.redactPii(editor, matches);
          }
        });
      }
    })
  );

  // Redact PII Command
  context.subscriptions.push(
    vscode.commands.registerCommand('tork.redactPii', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      let matches;
      if (editor.selection.isEmpty) {
        // Scan entire document
        matches = piiProvider.getMatches(editor.document);
      } else {
        // Scan selection only
        matches = piiProvider.scanSelection(editor);
      }

      if (matches.length === 0) {
        vscode.window.showInformationMessage('No PII detected to redact.');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Redact ${matches.length} PII items?`,
        { modal: true },
        'Redact'
      );

      if (confirm === 'Redact') {
        const success = await piiProvider.redactPii(editor, matches);
        if (success) {
          vscode.window.showInformationMessage(`Redacted ${matches.length} PII items.`);
        }
      }
    })
  );

  // Configure API Key Command
  context.subscriptions.push(
    vscode.commands.registerCommand('tork.configureApiKey', async () => {
      const config = vscode.workspace.getConfiguration('tork');
      const currentKey = config.get<string>('apiKey') || '';

      const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Tork API key',
        password: true,
        value: currentKey ? '••••••••' : '',
        placeHolder: 'tork_xxxxxxxxxxxxxxxxxxxxxxxx',
        validateInput: (value) => {
          if (!value) {
            return 'API key is required';
          }
          if (!value.startsWith('tork_') && value !== '••••••••') {
            return 'API key should start with "tork_"';
          }
          return null;
        },
      });

      if (apiKey && apiKey !== '••••••••') {
        await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Tork API key saved successfully.');

        // Test connection
        apiClient.updateConfiguration();
        const connected = await apiClient.checkConnection();
        if (connected) {
          vscode.window.showInformationMessage('Connected to Tork API successfully!');
        } else {
          vscode.window.showWarningMessage(
            'Could not connect to Tork API. Please verify your API key.'
          );
        }
      }
    })
  );

  // Validate Policy Command
  context.subscriptions.push(
    vscode.commands.registerCommand('tork.validatePolicy', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const document = editor.document;
      const text = document.getText();

      if (!apiClient.isConfigured()) {
        // Do local validation only
        try {
          const yaml = require('yaml');
          const parsed = yaml.parse(text);

          if (!parsed) {
            vscode.window.showErrorMessage('Invalid YAML: Empty document');
            return;
          }

          if (!parsed.name && !parsed.rules && !parsed.policies) {
            vscode.window.showWarningMessage(
              'Policy file may be missing required fields (name, rules, or policies)'
            );
            return;
          }

          vscode.window.showInformationMessage('Policy YAML syntax is valid.');
        } catch (error: any) {
          vscode.window.showErrorMessage(`YAML parse error: ${error.message}`);
        }
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Tork: Validating policy...',
            cancellable: false,
          },
          async () => {
            const result = await apiClient.validatePolicy(text);

            if (result.valid) {
              vscode.window.showInformationMessage('✅ Policy is valid!');
            } else {
              const diagnostics: vscode.Diagnostic[] = (result.errors || []).map((err) => {
                const line = Math.max(0, (err.line || 1) - 1);
                const range = new vscode.Range(line, 0, line, 1000);
                const severity =
                  err.severity === 'error'
                    ? vscode.DiagnosticSeverity.Error
                    : vscode.DiagnosticSeverity.Warning;
                const diagnostic = new vscode.Diagnostic(range, err.message, severity);
                diagnostic.source = 'Tork';
                return diagnostic;
              });

              const collection = vscode.languages.createDiagnosticCollection('tork-policy');
              collection.set(document.uri, diagnostics);

              vscode.window.showErrorMessage(
                `Policy validation failed with ${result.errors?.length || 0} errors.`
              );
            }
          }
        );
      } catch (error: any) {
        vscode.window.showErrorMessage(`Policy validation failed: ${error.message}`);
      }
    })
  );
}
