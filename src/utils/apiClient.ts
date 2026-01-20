import * as vscode from 'vscode';

export interface EvaluationResult {
  decision: 'ALLOW' | 'BLOCK' | 'WARN' | 'REDACT' | 'ESCALATE';
  reason?: string;
  score?: number;
  detections?: {
    type: string;
    value: string;
    action: string;
  }[];
  redacted_content?: string;
  policy_violations?: {
    rule: string;
    description: string;
    severity: string;
  }[];
}

export interface PolicyValidationResult {
  valid: boolean;
  errors?: {
    line: number;
    message: string;
    severity: 'error' | 'warning';
  }[];
  warnings?: string[];
}

export class TorkApiClient {
  private apiKey: string = '';
  private apiUrl: string = 'https://api.tork.network';
  private timeout: number = 30000;

  constructor() {
    this.updateConfiguration();
  }

  updateConfiguration() {
    const config = vscode.workspace.getConfiguration('tork');
    this.apiKey = config.get<string>('apiKey') || '';
    this.apiUrl = config.get<string>('apiUrl') || 'https://api.tork.network';
  }

  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: Record<string, unknown>,
    customTimeout?: number
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), customTimeout || this.timeout);

    try {
      const response = await fetch(`${this.apiUrl}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'User-Agent': 'tork-vscode-extension/0.1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your tork.apiKey setting.');
        }
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      return await response.json() as T;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  }

  async checkConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.request('GET', '/v1/health', undefined, 5000);
      return true;
    } catch (error) {
      console.error('[Tork API] Connection check failed:', error);
      return false;
    }
  }

  async evaluate(content: string, options?: {
    policyId?: string;
    context?: Record<string, unknown>;
  }): Promise<EvaluationResult> {
    if (!this.apiKey) {
      throw new Error('API key not configured. Please set tork.apiKey in settings.');
    }

    return this.request<EvaluationResult>('POST', '/v1/evaluate', {
      content,
      policy_id: options?.policyId,
      context: options?.context,
    });
  }

  async detectPii(content: string): Promise<{
    detections: {
      type: string;
      value: string;
      start: number;
      end: number;
    }[];
  }> {
    if (!this.apiKey) {
      throw new Error('API key not configured. Please set tork.apiKey in settings.');
    }

    return this.request('POST', '/v1/pii/detect', { content });
  }

  async redactPii(content: string, options?: {
    types?: string[];
    replacement?: 'mask' | 'placeholder' | 'hash';
  }): Promise<{
    redacted_content: string;
    redactions: {
      type: string;
      original: string;
      redacted: string;
    }[];
  }> {
    if (!this.apiKey) {
      throw new Error('API key not configured. Please set tork.apiKey in settings.');
    }

    return this.request('POST', '/v1/pii/redact', {
      content,
      types: options?.types,
      replacement: options?.replacement || 'placeholder',
    });
  }

  async validatePolicy(policyYaml: string): Promise<PolicyValidationResult> {
    if (!this.apiKey) {
      throw new Error('API key not configured. Please set tork.apiKey in settings.');
    }

    return this.request<PolicyValidationResult>('POST', '/v1/policies/validate', {
      policy: policyYaml,
    });
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
