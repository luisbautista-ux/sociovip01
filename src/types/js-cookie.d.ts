// This file is necessary to prevent TypeScript errors when using js-cookie
// without having to import it in every file. This declares the module globally.

declare module 'js-cookie' {
  interface CookieAttributes {
    expires?: number | Date | undefined;
    path?: string | undefined;
    domain?: string | undefined;
    secure?: boolean | undefined;
    sameSite?: 'strict' | 'lax' | 'none' | undefined;
    [property: string]: any;
  }

  interface CookiesStatic<T = string> {
    get(name: string): T | undefined;
    get(): { [key: string]: T | undefined };
    set(name: string, value: string | object, options?: CookieAttributes): string | undefined;
    remove(name: string, options?: CookieAttributes): void;
    withAttributes(attributes: CookieAttributes): CookiesStatic<T>;
    withConverter<TWrite, TRead>(converter: {
      write: (value: TWrite) => string;
      read: (value: string) => TRead;
    }): CookiesStatic<TRead>;
  }

  const Cookies: CookiesStatic;
  export = Cookies;
}
