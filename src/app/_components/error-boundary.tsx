"use client";

import React, { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import ErrorCard from "@/app/erro/error";
import Link from "next/link";
import { HomeIcon } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component to catch React errors
 * Shows user-friendly error messages and provides retry functionality
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-blue px-4 py-8">
          <ErrorCard
            title="Erro"
            message={
              this.state.error?.message ??
              "Ocorreu um erro inesperado. Por favor, tente novamente."
            }
            variant="home"
            light={false}
          >
            <div className="mt-4 flex flex-col gap-4">
              <Button onClick={this.handleReset} className="h-12">
                Tente novamente
              </Button>
              <Link href="/">
                <Button variant="outline" className="h-12">
                  <HomeIcon className="mr-2 h-4 w-4" />
                  Voltar para a página inicial
                </Button>
              </Link>
            </div>
          </ErrorCard>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary wrapper for functional components
 * Uses ErrorBoundaryToast to show toast notifications
 */
export function ErrorBoundaryWithToast({
  children,
}: {
  children: ReactNode;
}) {
  const { toast } = useToast();

  const handleError = (error: Error) => {
    toast({
      title: "Erro",
      description:
        error.message ||
        "Ocorreu um erro inesperado. Por favor, tente novamente.",
      variant: "destructive",
    });
  };

  return (
    <ErrorBoundary onError={handleError}>{children}</ErrorBoundary>
  );
}


