
import {decrypt, encrypt} from "./utils";
import {LoaderLocalStorage, LoaderStorage} from "./storage";
import {StorageKeys} from "./constants";
import {LoaderConfig} from "../types";
/**
 * Manages Storing and Retrieving stored credentials
 *
 * @class CredentialsManager
 */
export class CredentialsManager {
    private readonly appName: string;
    private readonly storage: LoaderStorage;

    /**
     *
     * @param {string} appName the application name
     * @param {LoaderStorage} [storage] a {@link LoaderStorage} implementation. default to {@link LoaderLocalStorage}
     */
    constructor(appName: string, storage?: LoaderStorage){
        this.appName = appName;
        this.storage = storage || new LoaderLocalStorage();
    }

    /**
     * Retrieves the key credentials will be stored under
     * @private
     */
    private getCredentialsKey() {
        return this.appName + StorageKeys.CREDENTIALS;
    }

    /**
     * Retrieves the key pin codes will be stored under
     * @private
     */
    private getPinCodeKey() {
        return this.appName + StorageKeys.PINCODE;
    }

    /**
     * Stores the credentials in its {@link LoaderStorage}
     * @param {string} pinCode
     * @param {string} credentials[]
     */
    saveCredentials(pinCode: string, credentials: string[]){
        const encryptedCredentials = encrypt(pinCode, credentials);
        this.storage.setItem(this.getCredentialsKey(), encryptedCredentials);
    }

    /**
     * Stores the pin code in its {@link LoaderStorage}
     * @param {string} pinCode
     * @param {any} credentials
     */
    savePinCode(pinCode: string, credentials: any){
        const encryptedCredentials = encrypt(pinCode, credentials);
        this.storage.setItem(pinCode, encryptedCredentials);
        this.addPin(pinCode);
    }

    /**
     * Adds a pin code
     * @param {string} pinCode
     * @private
     */
    private addPin(pinCode: string) {
        let pinArr: string | string[] = this.storage.getItem(this.getPinCodeKey());
        if (!pinArr) {
            pinArr = [pinCode];
        } else {
            pinArr = JSON.parse(pinArr as string);
            (pinArr as string[]).push(pinCode);
        }
        this.storage.setItem(this.getPinCodeKey(), JSON.stringify(pinArr));
    }

    private removePin(pinCode: string) {
        let pinArr = this.storage.getItem(this.getPinCodeKey());
        if (pinArr) {
            pinArr = JSON.parse(pinArr);
            pinArr = pinArr.filter((elem: string) => elem !== pinCode);
            this.storage.setItem(this.getPinCodeKey(), JSON.stringify(pinArr));
        } else {
            throw new Error("No pin found");
        }
    }

    private loadPinCodeCredentials(pinCode: string) {
        let pinCodeCredentials = this.storage.getItem(pinCode);
        if (!pinCodeCredentials) {
            pinCodeCredentials = {};
        } else {
            pinCodeCredentials = decrypt(pinCode, pinCodeCredentials);
        }
        return pinCodeCredentials;
    }

    private changePinCode(newPin: string, oldPin: string) {
        const pinCredentials = this.storage.getItem(oldPin);
        if (!pinCredentials)
            throw new Error("Could not find a stored pin")

        this.storage.setItem(newPin, pinCredentials);
        this.storage.removeItem(oldPin);
    }

    private hasPinCodes(): boolean {
        return !!this.storage.getItem(this.getPinCodeKey());
    }

    private getLastPinCode(): string | undefined {
        let pinArr: string | undefined = this.storage.getItem(this.getPinCodeKey());
        if (!pinArr) {
            return;
        } else {
            const arr: string[] = JSON.parse(pinArr);
            return arr[arr.length - 1];
        }
    }

    private pinCodeExists(pinCode: string) {
        let pinArr = this.storage.getItem(this.getPinCodeKey());
        if (!pinArr) {
            return false;
        } else {
            return pinArr.indexOf(pinCode) >= 0;
        }
    }

    loadCredentials(defaultPin: string): {} {
        let knownCredentials = this.storage.getItem(this.getCredentialsKey());
        if (!knownCredentials)
            return {};
        else
            return decrypt(defaultPin, knownCredentials);
    }

    private clearCredentials() {
        this.storage.removeItem(this.getCredentialsKey());
    }
}