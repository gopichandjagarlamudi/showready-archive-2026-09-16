import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react"
import { Text } from "react-native"
import { captureDiagnosticsError } from "./service"

type DiagnosticsErrorBoundaryProps = PropsWithChildren<{
  fallback?: ReactNode
}>

type DiagnosticsErrorBoundaryState = {
  hasError: boolean
}

export class DiagnosticsErrorBoundary extends Component<
  DiagnosticsErrorBoundaryProps,
  DiagnosticsErrorBoundaryState
> {
  state: DiagnosticsErrorBoundaryState = {
    hasError: false
  }

  static getDerivedStateFromError() {
    return {
      hasError: true
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void captureDiagnosticsError(error, {
      eventType: "error.unhandled",
      category: "error",
      severity: "fatal",
      context: {
        componentStack: info.componentStack ?? "unknown"
      }
    })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <Text>Something went wrong.</Text>
    }

    return this.props.children
  }
}
