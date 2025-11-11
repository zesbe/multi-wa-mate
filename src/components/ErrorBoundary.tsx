import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the whole app.
 *
 * @see https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error("Error Boundary caught an error:", error, errorInfo);
    }

    // TODO: Log error to error tracking service (Sentry, LogRocket, etc.)
    // Example:
    // Sentry.captureException(error, { extra: errorInfo });

    this.setState({
      error,
      errorInfo,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-2xl">Oops! Something Went Wrong</CardTitle>
              <CardDescription>
                We're sorry, but something unexpected happened. Don't worry, your data is safe.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Only show error details in development mode */}
              {import.meta.env.DEV && this.state.error && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
                  <div className="font-semibold text-gray-700 mb-2">Error Details (Dev Only):</div>
                  <div className="text-gray-600 font-mono text-xs overflow-auto max-h-32">
                    {this.state.error.toString()}
                  </div>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                        Component Stack
                      </summary>
                      <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-48">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-800">
                  <strong>What can you do?</strong>
                  <ul className="mt-2 ml-4 list-disc space-y-1">
                    <li>Try reloading the page</li>
                    <li>Go back to the home page</li>
                    <li>Clear your browser cache</li>
                    <li>Contact support if the issue persists</li>
                  </ul>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={this.handleReload} variant="default" className="w-full sm:w-auto">
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
              <Button onClick={this.handleGoHome} variant="outline" className="w-full sm:w-auto">
                <Home className="w-4 h-4 mr-2" />
                Go to Home
              </Button>
              {import.meta.env.DEV && (
                <Button onClick={this.handleReset} variant="ghost" className="w-full sm:w-auto">
                  Reset Error
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
