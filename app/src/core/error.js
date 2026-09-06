// Global error logging and unhandled rejection interceptor
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[Mandate Engine] Intercepted async warning:', event.reason?.message || event.reason);
  });
}
