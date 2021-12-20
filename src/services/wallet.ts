import {Callback, EnvironmentDefinition, Err, LoaderConfig, WalletCreationStrategy} from "../types";
import {Spinner} from "../ui";
import {FileService} from "./FileService";

/**
 * Handles creating and loading Wallets
 *
 * Can use custom {@link WalletCreationStrategy}s when provided
 *
 * @class WalletService
 *
 */
export class WalletService {
    private readonly creationStrategy?: WalletCreationStrategy = undefined;
    private readonly config: LoaderConfig;
    private readonly environment: EnvironmentDefinition;
    private readonly spinner: Spinner;
    private readonly fileService: FileService;

    constructor(config: LoaderConfig, environment: EnvironmentDefinition, spinner: Spinner, creationStrategy?: WalletCreationStrategy) {
        this.creationStrategy = creationStrategy;
        this.config = config;
        this.environment = environment;
        this.spinner = spinner;
        this.fileService = new FileService();
    }

    private getWalletTemplateContent(callback: Callback){
        this.fileService.getFolderContentAsJSON(this.config.walletTemplateFolderName as string, (err, data) => {
            if (err)
                return callback(new Error("Failed to get content for " + this.config.walletTemplateFolderName));

            let content;
            try {
                content = JSON.parse(data);
            } catch (e) {
                return callback(new Error("Failed to parse content for " + this.config.walletTemplateFolderName));
            }

            callback(undefined, content);
        });
    }

    private dirSummaryAsArray(walletTemplateContent: {[indexer: string]: any}){
        let files = [];
        for (let directory in walletTemplateContent) {
            let directoryFiles = walletTemplateContent[directory];
            for (let fileName in directoryFiles)
                files.push({
                    path: directory + "/" + fileName,
                    content: directoryFiles[fileName]
                });
        }
        return files;
    };

    private customizeDSU(dsu: any, files: any[], prefix: string | undefined, callback: Callback){
        const self = this;
        if (typeof prefix === "function") {
            callback = prefix;
            prefix = undefined;
        }
        if (files.length === 0) {
            return callback();
        }
        let file = files.pop();
        let targetPath = file.path;

        if (typeof prefix !== 'undefined') {
            targetPath = `${prefix}/${targetPath}`;
        }

        let fileContent;
        if (Array.isArray(file.content)) {
            let Buffer = require("buffer").Buffer;

            let arrayBuffer = new Uint8Array(file.content).buffer;
            let buffer = new Buffer(arrayBuffer.byteLength);
            let view = new Uint8Array(arrayBuffer);
            for (let i = 0; i < buffer.length; ++i) {
                buffer[i] = view[i];
            }
            fileContent = buffer;
        } else {
            fileContent = file.content;
        }
        dsu.writeFile(targetPath, fileContent, (err: Err) => {
            if (err) {
                return callback(new Error(`Failed to write file in DSU at path ${targetPath}, ${err}`));
            }
            self.customizeDSU(dsu, files, prefix, callback);
        });
    }

    private getListOfAppsForInstallation(callback: Callback){
        const self = this;
        this.fileService.getFolderContentAsJSON(this.config.appsFolderName, function (err, data) {
            if (err)
                return callback(new Error(`Failed to get content for folder ${self.config.appsFolderName}, ${err}`));

            let apps;

            try {
                apps = JSON.parse(data);
            } catch (e) {
                return callback(new Error(`Failed to parse content for folder ${self.config.appsFolderName}, ${err}`));
            }

            callback(undefined, apps);
        });
    }

    private getSSAppsFromInstallationURL(callback: Callback){
        let url = new URL(window.location.href);
        let searchParams = url.searchParams;
        let apps: {[indexer: string]: any} = {};

        searchParams.forEach((paramValue, paramKey) => {
            if (paramKey === "appName") {
                let seedKey = paramValue + "Seed";
                let appSeed = searchParams.get(seedKey);
                if (appSeed)
                    apps[paramValue] = appSeed;
            }
        });

        if (Object.keys(apps))
            return callback(undefined, apps);

        callback();
    }

    private buildApp(appName: string, seed: string, hasTemplate: boolean, callback: Callback) {
        if (typeof hasTemplate === "function") {
            callback = hasTemplate;
            hasTemplate = true;
        }

        const self = this;

        const instantiateNewDossier = (files: any) => {
            let resolver = require("opendsu").loadApi("resolver");
            let keyssi = require("opendsu").loadApi("keyssi");
            resolver.createDSU(keyssi.createTemplateSeedSSI(self.environment.domain, undefined, undefined,undefined, self.environment.vault), (err: Err, appDSU: any) => {
                if (err)
                    return callback(new Error(`Failed to create DSU ${err}`));

                appDSU.mount('/' + self.config.codeFolderName, seed, (err: Err) => {
                    if (err)
                        return callback(new Error(`Failed to mount in /code seedSSI ${seed}, ${err}`));

                    self.customizeDSU(appDSU, files, `/${self.config.appFolderName}`, (err) => {
                        if (err)
                            return callback(new Error(`Failed to customize DSU ${err}`));

                        return appDSU.writeFile("/environment.json", JSON.stringify(self.environment), (err: Err) => {
                            if (err)
                                console.log("Could not write environment file into app", err);
                            appDSU.getKeySSIAsString(callback);
                        });
                    });
                });
            });
        };

        if (hasTemplate) {
            return self.fileService.getFolderContentAsJSON(`apps-patch/${appName}`, (err, data) => {
                let files;

                try {
                    files = JSON.parse(data);
                } catch (e) {
                    return callback(new Error("Failed to get content for folder" + `apps/${appName}` + err));
                }

                files = self.dirSummaryAsArray(files);
                instantiateNewDossier(files);
            })
        }
        instantiateNewDossier([]);
    }

    private performInstallation(walletDSU: any, apps: {[indexer: string]: any}, appsList: string[], callback: Callback){
        if (!appsList.length) {
            return callback();
        }
        let appName: string = appsList.pop() as string;
        const appInfo: any = apps[appName];

        if (appName[0] === '/')
            appName = appName.replace('/', '');

        const self = this;

        const mountApp = (newAppSeed: string) => {
            walletDSU.mount('/apps/' + appName, newAppSeed, (err: Err) => {
                if (err)
                    return callback(new Error("Failed to mount in folder" + `/apps/${appName}: ${err}`));

                self.performInstallation(walletDSU, apps, appsList, callback);
            })
        };

        //by default ssapps have a template
        let hasTemplate = appInfo.hasTemplate;
        let newInstanceIsDemanded = appInfo.newInstance;
        if (newInstanceIsDemanded) {
            return self.buildApp(appName, appInfo.seed, hasTemplate, (err: Err, newAppSeed: string) => {
                if (err)
                    return callback(new Error("Failed to build app " + `${appName}: ${err}`));
                mountApp(newAppSeed);
            });
        }
        mountApp(appInfo.seed);
    }

    /**
     * Installs applications found in the /apps folder
     * @param {any} walletDSU
     * @param {Callback} callback
     * @private
     */
    private installApplications(walletDSU: any, callback: Callback){
        const self = this;
        self.getListOfAppsForInstallation((err: Err, apps: any) => {

            let appsToBeInstalled = apps || {};

            self.getSSAppsFromInstallationURL((err, apps) => {
                let externalAppsList = Object.keys(apps);
                if (externalAppsList.length > 0) {
                    externalAppsList.forEach(appName => {
                        appsToBeInstalled[appName] = {
                            hasTemplate: false,
                            newInstance: false,
                            seed: apps[appName]
                        };
                    });
                    let landingApp = {name: externalAppsList[0]};
                    walletDSU.writeFile(`${self.config.appsFolderName}/.landingApp`, JSON.stringify(landingApp), () => {
                        console.log(`Written landingApp [${landingApp.name}]. `)
                    });
                }
            });

            const appsList = Object.keys(appsToBeInstalled);

            if (appsList.length === 0) {
                return callback();
            }
            console.log('Installing the following applications: ', appsToBeInstalled, appsList);

            self.performInstallation(walletDSU, appsToBeInstalled, appsList, callback);
        })
    }

    /**
     * Mounts the wallet template code
     * @param {any} wallet
     * @param {any} files
     * @param {Callback} callback
     * @private
     */
    private install(wallet: any, files: any, callback: Callback){
        // Copy any files found in the WALLET_TEMPLATE_FOLDER on the local file system
        // into the wallet's app folder
        const self = this;
        files = this.dirSummaryAsArray(files);
        this.customizeDSU(wallet, files, `/${this.config.appFolderName}`, (err: Err) => {
            if (err)
                return callback(new Error(`Failed to customize DSU: ${err}`));

            self.installApplications(wallet, callback);
        });
    }

    create(credentials: string[], callback: Callback){
        if (this.creationStrategy)
            return this.creationStrategy(this.environment.domain, credentials, this.spinner, (err: Err, ...results) => {
                if (err)
                    console.error(`Wallet creation strategy failed:`, err);
                callback(err, ...results);
            });

        const resolver = require("opendsu").loadApi("resolver");
        const keySSISpace = require("opendsu").loadApi("keyssi");
        const {domain, vault} = this.environment;

        const self  = this;

        const build = function(){
            const {walletTemplateFolderName ,ssiFileName} = self.config
            self.fileService.getFile(walletTemplateFolderName + "/" + ssiFileName, (err, dsuType)  => {
                if (err)
                    return callback(err);
                resolver.createDSU(keySSISpace.createTemplateWalletSSI(domain, credentials, vault), {useSSIAsIdentifier:true, dsuTypeSSI: dsuType, walletKeySSI: self.config.walletKeySSI}, (err: Err, walletDSU: any) => {
                    if (err)
                        return callback(err);
                    walletDSU = walletDSU.getWritableDSU();
                    self.getWalletTemplateContent((err, files) => {
                        if (err)
                            return callback(err);
                        // we need to remove dsu type identifier from the file list
                        files['/'][self.config.ssiFileName] = undefined;
                        delete files['/'][self.config.ssiFileName];
                        if(!self.config.walletKeySSI){
                            self.install(walletDSU, files, (err: Err) => {
                                if (err)
                                    return callback(new Error(`Failed to install: ${err}`));

                                return walletDSU.writeFile("/environment.json", JSON.stringify(self.environment), (err: Err) => {
                                    if (err)
                                        return callback(new Error("Could not write Environment file into wallet."));
                                    callback(undefined, walletDSU);
                                });
                            });
                        }else{
                            callback(undefined, walletDSU);
                        }
                    });
                });
            });
        }

        resolver.loadDSU(keySSISpace.createTemplateWalletSSI(domain,  credentials, vault), (err: Err, walletDSU: any) => {
            if(err){
                build();
            } else {
                console.log("Possible security issue. It is ok during development if you use the same credentials. Just do a npm run clean to remove APIHub cache in this case...");
                walletDSU = walletDSU.getWritableDSU();
                callback(err, walletDSU);
            }
        });
    }

    load(credentials: string[], callback: Callback){
        const resolver = require("opendsu").loadApi("resolver");
        const keyssi = require("opendsu").loadApi("keyssi");

        const {domain, vault} = this.environment;

        const walletSSI = keyssi.createTemplateWalletSSI(domain, credentials, vault);

        resolver.loadDSU(walletSSI, (err: Err, constDSU: any) => {
            if (err) {
                console.error(err);
                return callback(new Error("Failed to load wallet"));
            }
            callback(undefined, constDSU.getWritableDSU());
        });
    }

    retrieve(){

    }

    changePassword(){

    }
}