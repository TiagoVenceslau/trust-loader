import {Workbox} from "workbox-window";
import {Callback, EnvironmentDefinition, Err} from "../types";
import {PopUp, Spinner} from "../ui";
import {LoaderConstants, ServiceWorkerConstants} from "./constants";

export type SWRegistrationOptions = {
    scope: any,
    path: string,
    name: string
}

export type SWControllerData = {
    swName: string,
    registration: ServiceWorkerRegistration,
    callback: Callback
}

export class ServiceWorkerError extends Error {
    type: string = "ServiceWorkerError";

    constructor(message: string | Error){
        super(typeof message === 'string' ? message: message.message)
    }
}

let navigatorUtils: NavigatorUtils;

export function getNavigatorUtils(){
    return navigatorUtils;
}

export class NavigatorUtils {
    private controllersChangeHandlers: SWControllerData[] = [];

    private webManifest?: {} = undefined;
    private readonly environment: EnvironmentDefinition;
    private readonly spinner: Spinner;
    private readonly popUp: PopUp;

    constructor(environment: EnvironmentDefinition, spinner: Spinner, popUp: PopUp) {
        this.environment = environment;
        this.spinner = spinner;
        this.popUp = popUp;
        navigatorUtils = this;
    }

    getRegistrations(callback: Callback){
        if (this.areServiceWorkersSupported())
            return navigator.serviceWorker.getRegistrations().then(registrations => {
                callback(undefined, registrations);
            }).catch(e => {
                callback(new ServiceWorkerError("Service Workers are not supported or are restricted by browser settings"));
            });

        if (this.areServiceWorkersEnabled())
            return callback(new ServiceWorkerError("Service Workers are not supported for this browser"));
        callback(undefined, [])
    }

    areServiceWorkersSupported(): boolean {
        return "serviceWorker" in navigator;
    }

    areServiceWorkersEnabled(): boolean {
        return this.environment.sw;
    }

    canUseServiceWorkers(): boolean {
        return this.areServiceWorkersEnabled() && this.areServiceWorkersSupported();
    }

    onServiceWorkerReady(name: string, registration: ServiceWorkerRegistration, callback: Callback) {
        const {installing} = registration;
        if (installing) {
            installing.onerror = function (err) {
                console.error(err)
            }

            installing.addEventListener("statechange", (res) => {
                if (installing.state === "activated") {
                    callback(undefined, registration);
                }
                console.log("Sw state", installing.state);
            });
        } else {
            this.controllersChangeHandlers.push({
                swName: name,
                registration: registration,
                callback: callback
            });
        }
    }

    registerServiceWorker(options: SWRegistrationOptions, callback: Callback) {
        const {scope} = options;
        const self = this;
        if (this.areServiceWorkersSupported()) {
            console.log("SW Register:", options.path, JSON.stringify(scope));

            navigator.serviceWorker
                .register(options.path, scope)
                .then((registration: ServiceWorkerRegistration) => {
                    if (registration.active) {
                        return callback(undefined, registration);
                    }
                    // @ts-ignore
                    registration.onerror = function (err: Err) {
                        console.error(`Service Worker Registration Failed`, err)
                    }
                    self.onServiceWorkerReady(options.name, registration, callback);
                }, (err) => {
                    console.error(err)
                })
                .catch((err) => {
                    console.error(err);
                    return callback(new Error("Service worker registration failed."));
                });
        }
    }

    unregisterServiceWorker(sw: ServiceWorkerRegistration, callback: Callback) {
        // @ts-ignore
        sw.unregister({immediate: true}).then((success: boolean) => {
            if (!success){
                console.log("Could not unregister sw ", sw);
                return callback(new Error("Could not unregister sw"));
            }
            callback();
        }).catch(callback);
    }

    getWebManifest(callback: Callback){
        if (this.webManifest)
            return callback(undefined, this.webManifest);
        const self = this;
        fetch(LoaderConstants.MANIFEST_FILE)
            .then((response) => response.json())
            .then((manifest) => {
                self.webManifest = manifest;
                callback(undefined, manifest);
            })
            .catch((err) => {
                console.error(`Cannot load manifest file at ${LoaderConstants.MANIFEST_FILE}`, err);
                callback();
            });
    }

    clearServiceWorkerInScope(scope: string, callback: Callback): void {
        if (this.areServiceWorkersSupported())
            navigator.serviceWorker.getRegistration(scope)
                .then((sw: ServiceWorkerRegistration | undefined) => {
                    if (!sw)
                        return callback(new Error(`No Service worker found for scope ${scope}`));
                    if (scope === sw.scope){
                        console.log(`Refreshing ServiceWorker for scope ${scope}`);
                        return this.unregisterServiceWorker(sw, callback)
                    } else {
                        callback();
                    }
                }).catch(callback);
    }

    sendMessage(message: any){
        // This wraps the message posting/response in a promise, which will
        // resolve if the response doesn't contain an error, and reject with
        // the error if it does. If you'd prefer, it's possible to call
        // controller.postMessage() and set up the onmessage handler
        // independently of a promise, but this is a convenient wrapper.
        return new Promise(function (resolve, reject) {
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = function (event) {
                if (event.data.error) {
                    reject(event.data.error);
                } else {
                    resolve(event.data);
                }
            };

            // This sends the message data as well as transferring
            // messageChannel.port2 to the service worker.
            // The service worker can then use the transferred port to reply
            // via postMessage(), which will in turn trigger the onmessage
            // handler on messageChannel.port1.
            // See
            // https://html.spec.whatwg.org/multipage/workers.html#dom-worker-postmessage

            if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
            } else {
                navigator.serviceWorker.oncontrollerchange = function () {
                    if (navigator.serviceWorker.controller)
                        navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
                };
            }
        });
    }

    private sendSeedToSW(seed: string, callback: Callback){
        this.sendMessage({ seed: seed })
        .then((data) => callback(undefined, data))
        .catch(callback);
    }

    loadDistributedApp(seed: string, swConfig: SWRegistrationOptions, callback: Callback){
        const self = this;
        this.clearServiceWorkerInScope(swConfig.scope, (err, res) => {
            if (err)
                return callback(err);
            self.registerServiceWorker(swConfig, (err?: Err, sw?: ServiceWorkerRegistration) => {
                if (err)
                    return callback(err);
                self.sendSeedToSW(seed, (err) => {
                    callback(err ? new Error(`Failed initialization... ${err}`) : undefined);
                });
            });
        });
    }

    addServiceWorkerEventListener(eventType: string, listener: EventListener, options?: AddEventListenerOptions){
        if (this.canUseServiceWorkers())
            navigator.serviceWorker.addEventListener(eventType, listener, options);
    }

    private canRegisterPWA(){
        return this.environment.pwa;
    }

    private async showNewContentAvailable(){
        if (await this.popUp.ask(`New Content Is available. Click ok to install!`))
            window.location.reload();
    }

    registerPwaServiceWorker(): void {
        if (!this.canRegisterPWA())
            return console.log(`This application does not support Progressive Web Applications`);
        const self = this;
        this.getWebManifest((err, manifest) => {
            if (err || !manifest)
                return console.log(err || new Error(`Missing Manifest file. Skipping PWA installation`))

            const {scope} = manifest;
            const wb = new Workbox('./swPa.js', {scope: scope});

            wb.register().then((registration: ServiceWorkerRegistration | undefined) => {
                if (!registration)
                    throw new Error(`Could not register Service Worker`);
                registration.addEventListener(ServiceWorkerConstants.EVENTS.UPDATE, () => {
                    console.log(ServiceWorkerConstants.EVENTS.UPDATE,  {
                        installing: registration.installing,
                        active: registration.active,
                    });

                    const activeWorker = registration.active;
                    if (activeWorker) {
                        activeWorker.addEventListener(ServiceWorkerConstants.EVENTS.STATE_CHANGE, () => {
                            console.log("active statechange", activeWorker.state);
                            if (activeWorker.state === ServiceWorkerConstants.STATE.INSTALLED && navigator.serviceWorker.controller) {
                                self.showNewContentAvailable();
                            }
                        });
                    }
                })
            }).catch(err => {
                console.error(`Problem registering service worker`, err);
            });

            setInterval(async () => {
                try {
                    await wb.update();
                } catch (e) {
                    console.warn(`Errors from service worker:`, e);
                }
            }, 60 * 1000);
        })
    }

    unregisterAllServiceWorkers(callback: Callback){
        const self = this;
        this.getRegistrations((err, registrations) => {
            if (err)
                return callback(err);

            if (!registrations.length)
                return callback();

            const unRegistrations = registrations.map((reg: ServiceWorkerRegistration) => {
                return new Promise((resolve) => {
                    return self.unregisterServiceWorker(reg, resolve)
                });
            });

            return Promise.all(unRegistrations)
                .then(result => callback(undefined, result))
                .catch(callback);
        });
    }
}