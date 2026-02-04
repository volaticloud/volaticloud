/**
 * Console Error Tracker
 *
 * Tracks console errors during E2E tests to catch JS errors,
 * network failures, and React errors that might not cause visible failures.
 */
import { Page } from '@playwright/test';

export interface ConsoleMessage {
  type: 'error' | 'warning' | 'log';
  text: string;
  url?: string;
  timestamp: Date;
}

export interface PageError {
  message: string;
  stack?: string;
  timestamp: Date;
}

export class ConsoleTracker {
  private messages: ConsoleMessage[] = [];
  private errors: PageError[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.attach();
  }

  private attach(): void {
    // Track console messages
    this.page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        this.messages.push({
          type: type as 'error' | 'warning',
          text: msg.text(),
          url: this.page.url(),
          timestamp: new Date(),
        });
      }
    });

    // Track page errors (uncaught exceptions)
    this.page.on('pageerror', (error) => {
      this.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
    });

    // Track failed requests
    this.page.on('requestfailed', (request) => {
      const failure = request.failure();
      this.messages.push({
        type: 'error',
        text: `Request failed: ${request.url()} - ${failure?.errorText || 'unknown'}`,
        url: this.page.url(),
        timestamp: new Date(),
      });
    });
  }

  /**
   * Get all console errors (excluding expected ones)
   */
  getErrors(options?: { excludePatterns?: RegExp[] }): ConsoleMessage[] {
    const excludePatterns = options?.excludePatterns || [
      /favicon/i,
      /ResizeObserver/i, // Common React warning
      /third-party cookie/i,
      /Manifest/i,
      /net::ERR_ABORTED/i, // Expected during navigation/redirect
      /openid-connect\/auth/i, // Auth redirects are expected
      /fonts\.gstatic\.com/i, // Font loading can fail
      /Failed to fetch/i, // Network issues during navigation
    ];

    return this.messages.filter((msg) => {
      if (msg.type !== 'error') return false;
      return !excludePatterns.some((pattern) => pattern.test(msg.text));
    });
  }

  /**
   * Get all page errors (uncaught exceptions)
   */
  getPageErrors(): PageError[] {
    return this.errors;
  }

  /**
   * Get warnings
   */
  getWarnings(): ConsoleMessage[] {
    return this.messages.filter((msg) => msg.type === 'warning');
  }

  /**
   * Check if there are any critical errors
   */
  hasCriticalErrors(): boolean {
    const errors = this.getErrors();
    const pageErrors = this.getPageErrors();
    return errors.length > 0 || pageErrors.length > 0;
  }

  /**
   * Get summary for test report
   */
  getSummary(): string {
    const errors = this.getErrors();
    const pageErrors = this.getPageErrors();
    const warnings = this.getWarnings();

    if (errors.length === 0 && pageErrors.length === 0 && warnings.length === 0) {
      return '✓ No console errors or warnings';
    }

    const lines: string[] = [];

    if (pageErrors.length > 0) {
      lines.push(`❌ ${pageErrors.length} uncaught exception(s):`);
      pageErrors.forEach((e) => lines.push(`   - ${e.message}`));
    }

    if (errors.length > 0) {
      lines.push(`❌ ${errors.length} console error(s):`);
      errors.forEach((e) => lines.push(`   - ${e.text.slice(0, 100)}`));
    }

    if (warnings.length > 0) {
      lines.push(`⚠ ${warnings.length} warning(s)`);
    }

    return lines.join('\n');
  }

  /**
   * Clear tracked messages
   */
  clear(): void {
    this.messages = [];
    this.errors = [];
  }

  /**
   * Assert no critical errors occurred
   */
  assertNoErrors(): void {
    const errors = this.getErrors();
    const pageErrors = this.getPageErrors();

    if (errors.length > 0 || pageErrors.length > 0) {
      const summary = this.getSummary();
      throw new Error(`Console errors detected:\n${summary}`);
    }
  }
}

/**
 * Create and attach a console tracker to a page
 */
export function trackConsole(page: Page): ConsoleTracker {
  return new ConsoleTracker(page);
}
