
/**
 * @interface LoaderStorage
 */
export interface LoaderStorage {
    /**
     * Store a value under the key in the storage
     * @param {string} key
     * @param {any} item
     */
    setItem(key: string, item: any): void;

    /**
     * Retrieves an item from storage
     * @param {string} key
     */
    getItem(key: string): any;

    /**
     * Removes an item from storage
     * @param {string} key
     */
    removeItem(key: string): void;
}

/**
 * @class LoaderLocalStorage
 * @implements LoaderStorage
 */
export class LoaderLocalStorage implements LoaderStorage {
    /**
     * Store a value under the key in the storage
     * @param {string} key
     * @param {any} item
     */
    setItem(key: string, item: any) {
        localStorage.setItem(key, item);
    }
    /**
     * Retrieves an item from storage
     * @param {string} key
     */
    getItem(key: string){
        return localStorage.getItem(key);
    }
    /**
     * Removes an item from storage
     * @param {string} key
     */
    removeItem(key: string){
        localStorage.removeItem(key);
    }
}