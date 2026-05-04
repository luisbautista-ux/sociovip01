// src/lib/errors.ts

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `
Firestore Permission Denied:
-----------------------------
Operation: ${context.operation.toUpperCase()}
Path: ${context.path}
${context.requestResourceData ? `Data: ${JSON.stringify(context.requestResourceData, null, 2)}` : ''}
-----------------------------
`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
    // Esto es para que el stack trace sea más limpio en algunos entornos
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FirestorePermissionError);
    }
  }
}
