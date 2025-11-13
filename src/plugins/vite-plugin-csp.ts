/**
 * Vite Plugin: Dynamic CSP for Development vs Production
 *
 * This plugin automatically injects unsafe-inline/unsafe-eval in dev mode
 * and removes them in production builds for better security
 *
 * Development: Adds 'unsafe-inline' 'unsafe-eval' for HMR
 * Production: Strict CSP without unsafe directives
 */

import type { Plugin } from 'vite';

export function dynamicCSP(): Plugin {
  return {
    name: 'vite-plugin-dynamic-csp',
    transformIndexHtml(html, ctx) {
      const isDev = ctx.server !== undefined;

      if (isDev) {
        // Development mode: Add unsafe directives for Vite HMR
        return html.replace(
          /script-src 'self'/g,
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        ).replace(
          /style-src 'self'/g,
          "style-src 'self' 'unsafe-inline'"
        );
      }

      // Production mode: Use strict CSP (no changes needed - already strict in HTML)
      return html;
    },
  };
}

export default dynamicCSP;
