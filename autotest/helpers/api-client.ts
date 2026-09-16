import { APIRequestContext } from '@playwright/test';
import { config } from '../config/test-config.js';
import { getAuthToken, UserRole } from './auth.js';

export class ApiClient {
  private baseUrl: string;
  private token: string = '';

  constructor(private apiContext: APIRequestContext, baseUrl?: string) {
    this.baseUrl = baseUrl || config.apiURL;
  }

  async authenticate(role: UserRole): Promise<void> {
    this.token = await getAuthToken(this.apiContext, role);
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async get(path: string, params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.apiContext.get(`${this.baseUrl}${path}${qs}`, { headers: this.headers() });
  }

  async post(path: string, data?: any) {
    return this.apiContext.post(`${this.baseUrl}${path}`, {
      headers: this.headers(),
      data,
    });
  }

  async put(path: string, data?: any) {
    return this.apiContext.put(`${this.baseUrl}${path}`, {
      headers: this.headers(),
      data,
    });
  }

  async patch(path: string, data?: any) {
    return this.apiContext.patch(`${this.baseUrl}${path}`, {
      headers: this.headers(),
      data,
    });
  }

  async delete(path: string) {
    return this.apiContext.delete(`${this.baseUrl}${path}`, { headers: this.headers() });
  }
}
