import {Callback, EnvironmentDefinition, Err, LoaderConfig, LoaderMode, WalletLoginStrategy} from "../types";
import {CredentialsManager} from "./credentials";
import {Spinner} from "../ui";
import {WalletService} from "./wallet";
import {LoaderStorage} from "./storage";
import {LoaderConstants} from "./constants";

export function encrypt(key: string, dataObj: {}) {
    try {
        const crypto = require('opendsu').loadApi('crypto');
        const encryptionKey = crypto.deriveEncryptionKey(key);
        const encryptedCredentials = crypto.encrypt(JSON.stringify(dataObj), encryptionKey);
        return JSON.stringify(encryptedCredentials);
    } catch (e) {
        throw e;
    }
}


export function decrypt(key: string, dataObj: string) {
    try {
        const crypto = require('opendsu').loadApi('crypto');
        const encryptionKey = crypto.deriveEncryptionKey(key);
        // @ts-ignore
        const decryptData = crypto.decrypt($$.Buffer.from(JSON.parse(dataObj)), encryptionKey);
        return JSON.parse(decryptData.toString());
    } catch (e) {
        throw e
    }
}

export function generateRandom(charactersSet: string, length: number) {
    let result = '';
    const charactersLength = charactersSet.length;
    for (let i = 0; i < length; i++)
        result += charactersSet.charAt(Math.floor(Math.random() * charactersLength));
    return result;
}

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function getSecretLocalToken(storage: LoaderStorage, development: boolean, mobile: boolean, storageKey?: string): string {
    if (mobile)
        return "SuperUserSecurePassword1!";

    if(typeof storageKey === "undefined")
        storageKey = "secretToken";

    if (development)
        return generateRandom(characters, 32); //new key each time

    let secret = storage.getItem(storageKey);
    if (!secret) {
        secret = generateRandom(characters, 32);
        storage.setItem(storageKey, secret);
    }
    return secret;
}

export function runInAutoLogin(credentials: string[] | undefined, config: LoaderConfig, storage: LoaderStorage, credentialsManager: CredentialsManager, walletService: WalletService, development: boolean, mobile: boolean, callback: Callback){

    credentials = [getSecretLocalToken(storage, development, mobile)];

    walletService.create(credentials as string[], (err, wallet) => {
        if (err)
            return callback(err);

        if (!development)
            credentialsManager.saveCredentials(config.defaultPin as string, credentials as string[]);

        wallet.writeFile(LoaderConstants.USER_DETAILS_FILE, JSON.stringify(credentials), (err: Err) => {
            if (err)
                return callback(err);
            console.log("A new wallet got initialised...", wallet.getCreationSSI(true));
            callback();
        });
    });
}

export function getLoginByMode(environment: EnvironmentDefinition, config: LoaderConfig, credentialsManager: CredentialsManager, storage: LoaderStorage): WalletLoginStrategy | undefined {
    switch (environment.mode){
        case LoaderMode.EXTERNAL_AUTO:
            return (credentials: string[] | undefined, walletService: WalletService, spinner: Spinner, callback: Callback) => {
                try {
                    if (!config.defaultPin)
                        return callback(new Error(`Missing a default pin`));
                    credentials = Object.values(credentialsManager.loadCredentials(config.defaultPin));
                } catch (e) {
                    return callback(e as Error);
                }
                walletService.create(credentials, (err, wallet) => {
                    if (err)
                        return callback(err);
                    console.log("A new wallet got initialised...", wallet.getCreationSSI(true));
                    callback(undefined, wallet);
                })
            }
        case LoaderMode.DEV_AUTO:
            return (credentials: string[] | undefined, walletService: WalletService, spinner: Spinner, callback: Callback) => {
                runInAutoLogin(credentials, config, storage, credentialsManager, walletService, true, false, callback);
            }
        case LoaderMode.MOBILE_AUTO:
            return (credentials: string[] | undefined, walletService: WalletService, spinner: Spinner, callback: Callback) => {
                runInAutoLogin(credentials, config, storage, credentialsManager, walletService, false, true, callback);
            }
        case LoaderMode.AUTO:
            return (credentials: string[] | undefined, walletService: WalletService, spinner: Spinner, callback: Callback) => {
                runInAutoLogin(credentials, config, storage, credentialsManager, walletService, false, false, callback);
            }
        case LoaderMode.DEV_SECURE:
        case LoaderMode.SECURE:
        default:
            return undefined;
    }
}