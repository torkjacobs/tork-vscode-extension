import * as vscode from 'vscode';
import { TorkApiClient } from '../utils/apiClient';

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private apiClient: TorkApiClient;

  constructor(context: vscode.ExtensionContext, apiClient: TorkApiClient) {
    this.apiClient = apiClient;

    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'tork.configureApiKey';
    context.subscriptions.push(this.statusBarItem);

    this.updateStatus();
  }

  async updateStatus() {
    const config = vscode.workspace.getConfiguration('tork');
    const apiKey = config.get<string>('apiKey');
    const piiEnabled = config.get<boolean>('enablePiiDetection');

    if (!apiKey) {
      this.statusBarItem.text = '$(shield) Tork: No API Key';
      this.statusBarItem.tooltip = 'Click to configure Tork API key';
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    } else {
      // Check API connection
      const isConnected = await this.apiClient.checkConnection();

      if (isConnected) {
        this.statusBarItem.text = `$(shield-check) Tork${piiEnabled ? ' | PII' : ''}`;
        this.statusBarItem.tooltip = `Tork AI Governance - Connected\n\nPII Detection: ${piiEnabled ? 'Enabled' : 'Disabled'}\nClick to configure`;
        this.statusBarItem.backgroundColor = undefined;
      } else {
        this.statusBarItem.text = '$(shield-x) Tork: Disconnected';
        this.statusBarItem.tooltip = 'Unable to connect to Tork API. Click to configure.';
        this.statusBarItem.backgroundColor = new vscode.ThemeColor(
          'statusBarItem.errorBackground'
        );
      }
    }

    this.statusBarItem.show();
  }

  setLoading(message: string = 'Processing...') {
    this.statusBarItem.text = `$(loading~spin) Tork: ${message}`;
  }

  setSuccess(message: string = 'Success') {
    this.statusBarItem.text = `$(check) Tork: ${message}`;
    setTimeout(() => this.updateStatus(), 3000);
  }

  setError(message: string = 'Error') {
    this.statusBarItem.text = `$(error) Tork: ${message}`;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.errorBackground'
    );
    setTimeout(() => this.updateStatus(), 5000);
  }

  dispose() {
    this.statusBarItem.dispose();
  }
}
