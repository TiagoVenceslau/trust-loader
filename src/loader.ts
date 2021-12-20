import {
    Callback,
    EnvironmentDefinition,
    Err, LoaderConfig,
    OpenDSULoader,
    WalletCreationStrategy
} from "./types";
import {LoaderLocalStorage, LoaderStorage, CredentialsManager, WalletService, NavigatorUtils} from "./services";
import {DefaultPopUp, LogSpinner, PopUp, Spinner} from "./ui";

export const DefaultLoaderConfig: LoaderConfig = {
    defaultPin: "0000",
    codeFolderName: "code",
    walletTemplateFolderName: "wallet-patch",
    appFolderName: "app",
    appsFolderName: "apps-patch",
    ssiFileName: "seed"
}

export class Loader implements OpenDSULoader {
    private readonly environment: EnvironmentDefinition;
    private readonly strategy?: WalletCreationStrategy;
    private readonly spinner: Spinner;
    private readonly credentialsManager: CredentialsManager;
    private readonly config: LoaderConfig;
    private readonly popUp: PopUp;

    private walletService: WalletService;
    private navigatorUtils: NavigatorUtils;

    constructor(config: LoaderConfig, environment: EnvironmentDefinition, creationStrategy?: WalletCreationStrategy, storage: LoaderStorage = new LoaderLocalStorage(), spinner: Spinner = new LogSpinner(), popUp: PopUp = new DefaultPopUp()){
        this.config = Object.assign({}, DefaultLoaderConfig, config);
        this.environment = environment;
        this.strategy = creationStrategy;
        this.spinner = spinner;
        this.popUp = popUp;
        this.credentialsManager = new CredentialsManager(environment.appName, storage);

        try {
            let config = require("opendsu").loadApi("config");
            config.autoconfigFromEnvironment(environment);
        } catch (e) {
            throw new Error(`Could not load OpenDSU framework due to ${e}`);
        }

        this.navigatorUtils = new NavigatorUtils(environment, spinner, popUp);
        this.walletService = new WalletService(config, this.environment, this.spinner, creationStrategy);
    }

    create(credentials: string[], callback: Callback): void {
        this.walletService.create(credentials, callback);
    }

    load(credentials: string[], callback: Callback): void {
        const self = this;
        this.navigatorUtils.unregisterAllServiceWorkers((err: Err) => {
            if (err)
                return callback(err);
            self.walletService.load(credentials, callback);
        });
    }
}