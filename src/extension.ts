import * as vscode from 'vscode';
import { PiiDiagnosticsProvider } from './providers/piiDiagnostics';
import { TorkApiClient } from './utils/apiClient';
import { registerCommands } from './commands';
import { StatusBarManager } from './providers/statusBar';

let piiDiagnosticsProvider: PiiDiagnosticsProvider;
let statusBarManager: StatusBarManager;
let apiClient: TorkApiClient;

export function activate(context: vscode.ExtensionContext) {
  console.log('[Tork] Extension activating...');

  // Initialize API client
  apiClient = new TorkApiClient();

  // Initialize status bar
  statusBarManager = new StatusBarManager(context, apiClient);

  // Initialize PII diagnostics provider
  piiDiagnosticsProvider = new PiiDiagnosticsProvider(context);

  // Register all commands
  registerCommands(context, apiClient, piiDiagnosticsProvider);

  console.log('[Tork] Commands and providers registered');

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('tork')) {
        console.log('[Tork] Configuration changed, updating...');
        apiClient.updateConfiguration();
        piiDiagnosticsProvider.updateConfiguration();
        statusBarManager.updateStatus();
      }
    })
  );

  // Watch for document changes (for PII detection)
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      console.log(`[Tork] Document opened: ${document.fileName}`);
      if (shouldScanDocument(document)) {
        console.log(`[Tork] Scanning opened document: ${document.fileName}`);
        piiDiagnosticsProvider.scanDocument(document);
      }
    })
  );

  // Watch for active editor changes (switch tabs)
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && shouldScanDocument(editor.document)) {
        console.log(`[Tork] Active editor changed, scanning: ${editor.document.fileName}`);
        piiDiagnosticsProvider.scanDocument(editor.document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      const config = vscode.workspace.getConfiguration('tork');
      if (config.get<boolean>('autoScanOnSave', true) && shouldScanDocument(document)) {
        console.log(`[Tork] Document saved, scanning: ${document.fileName}`);
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
  console.log(`[Tork] Scanning ${vscode.workspace.textDocuments.length} open documents...`);
  vscode.workspace.textDocuments.forEach((document) => {
    if (shouldScanDocument(document)) {
      console.log(`[Tork] Initial scan: ${document.fileName}`);
      piiDiagnosticsProvider.scanDocument(document);
    }
  });

  // Also scan the active editor immediately
  if (vscode.window.activeTextEditor) {
    const activeDoc = vscode.window.activeTextEditor.document;
    if (shouldScanDocument(activeDoc)) {
      console.log(`[Tork] Scanning active editor: ${activeDoc.fileName}`);
      piiDiagnosticsProvider.scanDocument(activeDoc);
    }
  }

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

  // Skip untitled/virtual documents
  if (document.uri.scheme !== 'file') {
    console.log(`[Tork] Skipping non-file document: ${document.uri.scheme}`);
    return false;
  }

  // Check if PII detection is enabled (default: true)
  const piiEnabled = config.get<boolean>('enablePiiDetection', true);
  if (!piiEnabled) {
    console.log('[Tork] PII detection is disabled in settings');
    return false;
  }

  // Check exclude patterns
  const excludePatterns = config.get<string[]>('excludePatterns') || [];
  const relativePath = vscode.workspace.asRelativePath(document.uri);

  for (const pattern of excludePatterns) {
    if (matchesGlobPattern(relativePath, pattern)) {
      console.log(`[Tork] Skipping excluded file: ${relativePath} (matched: ${pattern})`);
      return false;
    }
  }

  // Don't scan binary files or certain file types
  const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.vsix'];
  const extension = document.fileName.toLowerCase().split('.').pop();
  if (extension && skipExtensions.includes(`.${extension}`)) {
    console.log(`[Tork] Skipping binary file: ${document.fileName}`);
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
