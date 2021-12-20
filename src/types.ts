import {Spinner} from "./ui";
import {CredentialsManager, WalletService} from "./services";

export type LoaderConfig = {
    defaultPin?: string,
    codeFolderName?: string,
    walletTemplateFolderName?: string,
    appFolderName: string,
    appsFolderName: string,
    ssiFileName: string
    walletKeySSI?: string
}

export type Err = Error | undefined;
export type ErrCallback = (err: Err) => void;
export type Callback = (err?: Err, ...args: any[]) => void;

export enum LoaderMode {
    DEV_AUTO = "dev-autologin",
    AUTO = "autologin",
    EXTERNAL_AUTO = "external-autologin",
    MOBILE_AUTO = "mobile-autologin",
    SECURE = "secure",
    DEV_SECURE = "dev-secure"
}

export enum LoaderSystem {
    iOS = "iOS",
    ANDROID = "Android",
    ANY = 'any'
}

export enum LoaderBrowser {
    CHROME = 'Chrome',
    FIREFOX = "Firefox",
    ANY= "any"
}

export enum LoaderStage {
    DEVELOPMENT = "development",
    RELEASE = "release"
}

export enum LoaderVault {
    SERVER = "server",
    BROWSER = "browser"
}

export enum LoaderAgent {
    MOBILE = 'mobile',
    BROWSER = 'browser'
}

/**
 * Environment definitions to be passes to the loader and the interior apps
 *
 * @typedef EnvironmentDefinition
 */
export type EnvironmentDefinition = {
    /**
     * The application name
     */
    appName: string,
    /**
     * The vault definition (defaults to {@link LoaderVault.SERVER}
     */
    vault: LoaderVault,
    /**
     * The agent definition (defaults to {@link LoaderAgent.BROWSER}
     */
    agent: LoaderAgent,
    /**
     * The system. Defaults to {@link LoaderSystem.ANY}
     */
    system: LoaderSystem,
    /**
     * The browser. defaults {@link LoaderBrowser.ANY}
     */
    browser: LoaderBrowser,
    /**
     * the {@link LoaderMode} the dApp should run on. defaults to {@link LoaderMode.DEV_AUTO}
     */
    mode: LoaderMode,
    /**
     * The anchoring domain
     */
    domain: string,
    /**
     * The development stage. defaults to {@link LoaderStage.DEVELOPMENT}
     */
    stage: LoaderStage,
    /**
     * Turns Service worker on/Off
     */
    sw: boolean,
    /**
     * Turns Progressive Web Application installation on/Off
     */
    pwa: boolean,
    /**
     * Turns Pin Login Mode on/Off
     */
    allowPinLogin: boolean
}

export type WalletCreationStrategy = (domain: string, credentials: string[], spinner: Spinner, callback: Callback) => void;
export type WalletLoginStrategy = (credentials: string[] | undefined, walletService: WalletService, spinner: Spinner, callback: Callback) => void;

export interface OpenDSULoader {
    create(credentials: string[], callback: Callback): void;
    load(credentials: string[], callback: Callback): void;
}

