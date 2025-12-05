import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to your error reporting service here
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 items-center justify-center bg-gray-50 p-6">
          <View className="bg-red-100 p-4 rounded-full mb-6">
            <Ionicons name="warning" size={48} color="#dc2626" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
            Oops! Something went wrong
          </Text>
          <Text className="text-gray-500 text-center mb-6 max-w-xs">
            We encountered an unexpected error. Please try again.
          </Text>
          {__DEV__ && this.state.error && (
            <View className="bg-gray-100 rounded-xl p-4 mb-6 w-full">
              <Text className="text-xs text-gray-600 font-mono">
                {this.state.error.message}
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={this.handleRetry}
            className="bg-primary-600 px-8 py-4 rounded-2xl"
            activeOpacity={0.8}
          >
            <Text className="text-white font-semibold text-base">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
