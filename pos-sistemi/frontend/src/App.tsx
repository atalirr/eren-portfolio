/**
 * App Component
 * Root component with error boundary
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AppRouter } from './router';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Root Error Boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', maxWidth: '600px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
            <h1 style={{ color: '#ef4444', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>Uygulama Hatası</h1>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>Bir hata oluştu. Lütfen uygulamayı yeniden başlatın.</p>
            <pre style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', fontSize: '11px', color: '#374151', overflow: 'auto', maxHeight: '200px', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.message}
              {'\n'}
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{ marginTop: '16px', padding: '8px 16px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <RootErrorBoundary>
      <AppRouter />
    </RootErrorBoundary>
  );
}

export default App;
