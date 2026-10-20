// Promise-based confirmation that renders the app's own dialog (see ConfirmHost)
// instead of the browser's native confirm(), which is unstyled, untranslated
// and blocks the page.
export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for deletions. */
  destructive?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

let listener: ((request: ConfirmRequest) => void) | null = null;

export function subscribeConfirm(fn: (request: ConfirmRequest) => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) {
      // The host is not mounted (e.g. an auth page): fall back to the native prompt.
      resolve(typeof window !== "undefined" ? window.confirm(options.description) : false);
      return;
    }
    listener({ ...options, resolve });
  });
}
