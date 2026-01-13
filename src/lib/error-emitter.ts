// src/lib/error-emitter.ts
import { EventEmitter } from 'events';

// Asegurarse de que solo haya una instancia en toda la aplicación
let errorEmitter: EventEmitter;

if (process.env.NODE_ENV === 'production') {
  errorEmitter = new EventEmitter();
} else {
  // En desarrollo, usa el objeto global para persistir entre recargas de módulos
  if (!(global as any).errorEmitter) {
    (global as any).errorEmitter = new EventEmitter();
  }
  errorEmitter = (global as any).errorEmitter;
}

export { errorEmitter };
