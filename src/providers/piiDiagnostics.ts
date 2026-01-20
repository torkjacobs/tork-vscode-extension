import * as vscode from 'vscode';

export interface PiiMatch {
  type: string;
  value: string;
  range: vscode.Range;
  redacted: string;
}

export interface PiiPattern {
  name: string;
  regex: RegExp;
  description: string;
  redactionPattern: string;
}

const PII_PATTERNS: PiiPattern[] = [
  {
    name: 'email',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    description: 'Email address',
    redactionPattern: '[EMAIL]',
  },
  {
    name: 'ssn',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    description: 'Social Security Number',
    redactionPattern: '[SSN]',
  },
  {
    name: 'phone',
    regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    description: 'Phone number',
    redactionPattern: '[PHONE]',
  },
  {
    name: 'creditCard',
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    description: 'Credit card number',
    redactionPattern: '[CREDIT_CARD]',
  },
  {
    name: 'ipAddress',
    regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    description: 'IP address',
    redactionPattern: '[IP_ADDRESS]',
  },
  {
    name: 'dateOfBirth',
    regex: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g,
    description: 'Date of birth',
    redactionPattern: '[DOB]',
  },
  {
    name: 'passport',
    regex: /\b[A-Z]{1,2}\d{6,9}\b/g,
    description: 'Passport number',
    redactionPattern: '[PASSPORT]',
  },
  {
    name: 'driverLicense',
    regex: /\b[A-Z]{1,2}\d{5,8}\b/g,
    description: 'Driver license number',
    redactionPattern: '[DRIVER_LICENSE]',
  },
];

export class PiiDiagnosticsProvider implements vscode.Disposable {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private scanTimeout: Map<string, NodeJS.Timeout> = new Map();
  private decorationType: vscode.TextEditorDecorationType;
  private enabledPatterns: string[] = [];
  private severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Warning;

  constructor(context: vscode.ExtensionContext) {
    console.log('[Tork PII] Initializing PII diagnostics provider...');

    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('tork-pii');
    context.subscriptions.push(this.diagnosticCollection);

    // Create decoration type for PII highlights
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 193, 7, 0.3)',
      border: '1px solid rgba(255, 152, 0, 0.8)',
      borderRadius: '3px',
    });

    this.updateConfiguration();
    console.log(`[Tork PII] Initialized with ${this.enabledPatterns.length} patterns: ${this.enabledPatterns.join(', ')}`);
  }

  updateConfiguration() {
    const config = vscode.workspace.getConfiguration('tork');
    this.enabledPatterns = config.get<string[]>('piiPatterns') || ['email', 'ssn', 'phone', 'creditCard', 'ipAddress', 'dateOfBirth', 'passport', 'driverLicense'];

    const severityStr = config.get<string>('piiSeverity') || 'warning';
    switch (severityStr) {
      case 'hint':
        this.severity = vscode.DiagnosticSeverity.Hint;
        break;
      case 'information':
        this.severity = vscode.DiagnosticSeverity.Information;
        break;
      case 'warning':
        this.severity = vscode.DiagnosticSeverity.Warning;
        break;
      case 'error':
        this.severity = vscode.DiagnosticSeverity.Error;
        break;
    }
  }

  scheduleScan(document: vscode.TextDocument) {
    const uri = document.uri.toString();

    // Cancel existing timeout
    const existingTimeout = this.scanTimeout.get(uri);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new scan with debounce
    const timeout = setTimeout(() => {
      this.scanDocument(document);
      this.scanTimeout.delete(uri);
    }, 500);

    this.scanTimeout.set(uri, timeout);
  }

  scanDocument(document: vscode.TextDocument): PiiMatch[] {
    console.log(`[Tork PII] Scanning document: ${document.fileName}`);

    const config = vscode.workspace.getConfiguration('tork');
    if (!config.get<boolean>('enablePiiDetection', true)) {
      console.log('[Tork PII] Detection disabled, clearing diagnostics');
      this.diagnosticCollection.delete(document.uri);
      return [];
    }

    const text = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];
    const matches: PiiMatch[] = [];

    console.log(`[Tork PII] Enabled patterns: ${this.enabledPatterns.join(', ')}`);
    console.log(`[Tork PII] Document length: ${text.length} characters`);

    for (const pattern of PII_PATTERNS) {
      if (!this.enabledPatterns.includes(pattern.name)) {
        continue;
      }

      // Reset regex state
      pattern.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(text)) !== null) {
        const startPos = document.positionAt(match.index);
        const endPos = document.positionAt(match.index + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        const piiMatch: PiiMatch = {
          type: pattern.name,
          value: match[0],
          range,
          redacted: pattern.redactionPattern,
        };
        matches.push(piiMatch);

        console.log(`[Tork PII] Found ${pattern.name}: "${match[0]}" at line ${startPos.line + 1}`);

        const diagnostic = new vscode.Diagnostic(
          range,
          `Potential PII detected: ${pattern.description}`,
          this.severity
        );
        diagnostic.code = `tork-pii-${pattern.name}`;
        diagnostic.source = 'Tork';
        // Removed DiagnosticTag.Unnecessary - it causes grayed-out text

        diagnostics.push(diagnostic);
      }
    }

    console.log(`[Tork PII] Total matches found: ${matches.length}`);
    this.diagnosticCollection.set(document.uri, diagnostics);
    this.updateDecorations(document, matches);

    return matches;
  }

  private updateDecorations(document: vscode.TextDocument, matches: PiiMatch[]) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document !== document) {
      return;
    }

    const decorations: vscode.DecorationOptions[] = matches.map((match) => ({
      range: match.range,
      hoverMessage: `**Tork PII Detection**\n\nType: ${match.type}\n\nClick to redact: \`${match.redacted}\``,
    }));

    editor.setDecorations(this.decorationType, decorations);
  }

  scanSelection(editor: vscode.TextEditor): PiiMatch[] {
    const selection = editor.selection;
    const text = editor.document.getText(selection);
    const matches: PiiMatch[] = [];

    for (const pattern of PII_PATTERNS) {
      if (!this.enabledPatterns.includes(pattern.name)) {
        continue;
      }

      pattern.regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(text)) !== null) {
        const startOffset = editor.document.offsetAt(selection.start) + match.index;
        const startPos = editor.document.positionAt(startOffset);
        const endPos = editor.document.positionAt(startOffset + match[0].length);
        const range = new vscode.Range(startPos, endPos);

        matches.push({
          type: pattern.name,
          value: match[0],
          range,
          redacted: pattern.redactionPattern,
        });
      }
    }

    return matches;
  }

  redactPii(editor: vscode.TextEditor, matches: PiiMatch[]): Thenable<boolean> {
    return editor.edit((editBuilder) => {
      // Sort matches in reverse order to preserve positions
      const sortedMatches = [...matches].sort(
        (a, b) => b.range.start.compareTo(a.range.start)
      );

      for (const match of sortedMatches) {
        editBuilder.replace(match.range, match.redacted);
      }
    });
  }

  getMatches(document: vscode.TextDocument): PiiMatch[] {
    return this.scanDocument(document);
  }

  clearDiagnostics(document: vscode.TextDocument) {
    this.diagnosticCollection.delete(document.uri);
  }

  dispose() {
    this.diagnosticCollection.dispose();
    this.decorationType.dispose();

    for (const timeout of this.scanTimeout.values()) {
      clearTimeout(timeout);
    }
    this.scanTimeout.clear();
  }
}
