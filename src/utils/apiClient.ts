import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';

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
  private client: AxiosInstance;
  private apiKey: string = '';
  private apiUrl: string = 'https://api.tork.network';

  constructor() {
    this.updateConfiguration();
    this.client = this.createClient();
  }

  updateConfiguration() {
    const config = vscode.workspace.getConfiguration('tork');
    this.apiKey = config.get<string>('apiKey') || '';
    this.apiUrl = config.get<string>('apiUrl') || 'https://api.tork.network';
    this.client = this.createClient();
  }

  private createClient(): AxiosInstance {
    return axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'User-Agent': 'tork-vscode-extension/0.1.0',
      },
    });
  }

  async checkConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const response = await this.client.get('/v1/health', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      console.error('Tork API connection check failed:', error);
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

    try {
      const response = await this.client.post('/v1/evaluate', {
        content,
        policy_id: options?.policyId,
        context: options?.context,
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid API key. Please check your tork.apiKey setting.');
      }
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(`API error: ${error.message}`);
    }
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

    try {
      const response = await this.client.post('/v1/pii/detect', {
        content,
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`PII detection failed: ${error.message}`);
    }
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

    try {
      const response = await this.client.post('/v1/pii/redact', {
        content,
        types: options?.types,
        replacement: options?.replacement || 'placeholder',
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`PII redaction failed: ${error.message}`);
    }
  }

  async validatePolicy(policyYaml: string): Promise<PolicyValidationResult> {
    if (!this.apiKey) {
      throw new Error('API key not configured. Please set tork.apiKey in settings.');
    }

    try {
      const response = await this.client.post('/v1/policies/validate', {
        policy: policyYaml,
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Policy validation failed: ${error.message}`);
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
