import * as vscode from 'vscode';
import { PiiDiagnosticsProvider } from './providers/piiDiagnostics';
import { TorkApiClient } from './utils/apiClient';
import { registerCommands } from './commands';
import { StatusBarManager } from './providers/statusBar';

let piiDiagnosticsProvider: PiiDiagnosticsProvider;
let statusBarManager: StatusBarManager;
let apiClient: TorkApiClient;

export function activate(context: vscode.ExtensionContext) {
  console.log('Tork AI Governance extension is now active');

  // Initialize API client
  apiClient = new TorkApiClient();

  // Initialize status bar
  statusBarManager = new StatusBarManager(context, apiClient);

  // Initialize PII diagnostics provider
  piiDiagnosticsProvider = new PiiDiagnosticsProvider(context);

  // Register all commands
  registerCommands(context, apiClient, piiDiagnosticsProvider);

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('tork')) {
        apiClient.updateConfiguration();
        piiDiagnosticsProvider.updateConfiguration();
        statusBarManager.updateStatus();
      }
    })
  );

  // Watch for document changes (for PII detection)
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (shouldScanDocument(document)) {
        piiDiagnosticsProvider.scanDocument(document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      const config = vscode.workspace.getConfiguration('tork');
      if (config.get<boolean>('autoScanOnSave') && shouldScanDocument(document)) {
        piiDiagnosticsProvider.scanDocument(document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (shouldScanDocument(event.document)) {
        piiDiagnosticsProvider.scheduleScan(event.document);
      }
    })
  );

  // Scan all open documents on activation
  vscode.workspace.textDocuments.forEach((document) => {
    if (shouldScanDocument(document)) {
      piiDiagnosticsProvider.scanDocument(document);
    }
  });

  // Update status bar
  statusBarManager.updateStatus();

  // Show welcome message on first activation
  const hasShownWelcome = context.globalState.get<boolean>('tork.hasShownWelcome');
  if (!hasShownWelcome) {
    showWelcomeMessage(context);
    context.globalState.update('tork.hasShownWelcome', true);
  }
}

function shouldScanDocument(document: vscode.TextDocument): boolean {
  const config = vscode.workspace.getConfiguration('tork');

  // Check if PII detection is enabled
  if (!config.get<boolean>('enablePiiDetection')) {
    return false;
  }

  // Check exclude patterns
  const excludePatterns = config.get<string[]>('excludePatterns') || [];
  const relativePath = vscode.workspace.asRelativePath(document.uri);

  for (const pattern of excludePatterns) {
    if (matchesGlobPattern(relativePath, pattern)) {
      return false;
    }
  }

  // Don't scan binary files or certain file types
  const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
  const extension = document.fileName.toLowerCase().split('.').pop();
  if (extension && skipExtensions.includes(`.${extension}`)) {
    return false;
  }

  return true;
}

function matchesGlobPattern(path: string, pattern: string): boolean {
  // Simple glob matching (supports * and **)
  const regexPattern = pattern
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{DOUBLE_STAR}}/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

async function showWelcomeMessage(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('tork');
  const apiKey = config.get<string>('apiKey');

  if (!apiKey) {
    const action = await vscode.window.showInformationMessage(
      'Welcome to Tork AI Governance! Configure your API key to enable full functionality.',
      'Configure API Key',
      'Learn More'
    );

    if (action === 'Configure API Key') {
      vscode.commands.executeCommand('tork.configureApiKey');
    } else if (action === 'Learn More') {
      vscode.env.openExternal(vscode.Uri.parse('https://tork.network/docs'));
    }
  }
}

export function deactivate() {
  if (piiDiagnosticsProvider) {
    piiDiagnosticsProvider.dispose();
  }
  if (statusBarManager) {
    statusBarManager.dispose();
  }
}
