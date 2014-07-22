/**
 * Definitions by: yoshiyuki Taniguchi
 */

interface JQueryStorageConfig {
    path?: string;
    expires?: string;
    domain?: string;
}
interface JQueryStorage {
    get<T>(...keys: string[]): T;
    get(keys: string[]): any;
    set<T>(key: string, value: T): void;
    set(...keysAndValue: any[]): void;
    set(dict: any): void;
    keys(...keys: string[]): string[];
    isEmpty(...keys: string[]): boolean;
    isEmpty(keys: string[]): boolean;
    isSet(...keys: string[]): boolean;
    isSet(keys: string[]): boolean;
    remove(...keys: string[]): void;
    remove(keys: string[]): void;
    removeAll(global?: boolean): void;
    
}
interface JQueryCookieStorage extends JQueryStorage{
    setExpires(expires: string): JQueryCookieStorage;
    setPath(path: string): JQueryCookieStorage;
    setDomain(domain: string): JQueryCookieStorage;
    setConf(config: JQueryStorageConfig): JQueryCookieStorage;
    setDefaultConf(): JQueryCookieStorage;
}
interface JQueryStatic {
    localStorage: JQueryStorage;
    sessionStorage: JQueryStorage;
    cookieStorage: JQueryCookieStorage;
    initNamespaceStorage(name: string): JQueryStatic;
}