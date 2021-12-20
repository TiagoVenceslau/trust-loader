import {Spinner} from "./Spinner";
import {IFRAME_DEFS} from "./constants";
import {LoaderStorage, NavigatorUtils, ServiceWorkerError} from "../services";
import {PopUp} from "./Popup";
import {EventMiddleWare} from "../services/EventMiddleware";
import {ServiceWorkerConstants, StorageKeys} from "../services/constants";
import {Err} from "../types";


export class WalletRunner {
    private crypto: any;
    private seed: string;
    private hash: string;
    private spinner: Spinner;
    private popUp: PopUp;
    private storage: LoaderStorage

    constructor(seed: string, storage: LoaderStorage, spinner: Spinner, popUp: PopUp){
        this.seed = seed;
        this.crypto = require('opendsu').loadApi('crypto');
        this.hash = this.crypto.sha256(this.seed);
        this.spinner = spinner;
        this.popUp = popUp;
        this.storage = storage;
    }

    private getIframeBase(): string {
        let iPath = window.location.pathname;
        return iPath.split("loader/")[0] + "loader/iframe/"
    }

    private createTimerElement(){
        const script = document.createElement('script');
        script.src = './Timer.js';
        return script;
    }

    /**
     * Builds the IFrame container for the Distributed App
     * @param {boolean} useSeedForIFrameSource
     */
    private createContainerIFrame(useSeedForIFrameSource: boolean): HTMLIFrameElement {
        const iframe: HTMLIFrameElement = document.createElement('iframe');
        Object.entries(IFRAME_DEFS.ATTRIBUTES).forEach(([key, value]) => iframe.setAttribute(key, value));
        // @ts-ignore
        Object.entries(IFRAME_DEFS.STYLE).forEach(([key, value]) => iframe.style[key] = value);
        iframe.src = window.location.origin + this.getIframeBase() + (useSeedForIFrameSource ? this.seed : this.hash);
        return iframe;
    }

    private removeElementsFromUI(iframe: HTMLIFrameElement, removeSpinner: boolean, removeIFrame: boolean, removeRest: boolean): void {
        if (removeIFrame && removeSpinner && removeRest){
            document.body.innerHTML = '';
            return;
        }

        if (removeIFrame)
            iframe.remove();

        if (removeSpinner)
            this.spinner.remove();

        if (removeRest)
            try {
                document.querySelectorAll("body > *:not(iframe):not(.loader-parent-container)")
                    .forEach((node) => node.remove());
            } catch (e) {
                // failed to remove certain nodes... should be ok
            }
    }

    private setupLoadEventsListener(navigatorUtils: NavigatorUtils, iframe: HTMLIFrameElement){
        const eventMiddleware = new EventMiddleWare(iframe, this.hash);

        const self = this;

        eventMiddleware.registerQuery(ServiceWorkerConstants.QUERIES.SEED, () => {
            return {seed: self.seed}
        });

        eventMiddleware.onStatus(ServiceWorkerConstants.STATE.COMPLETED, () => {
            // "app-placeholder" is injected by service worker
            // in that case 2 completed events are emitted
            if (iframe.hasAttribute("app-placeholder")) {
                self.removeElementsFromUI(iframe, true, false, false);
                iframe.removeAttribute("app-placeholder");
                document.body.prepend(iframe);
                return;
            }

            self.removeElementsFromUI(iframe, false, true, false);
            iframe.hidden = false;
        });

        eventMiddleware.onStatus(ServiceWorkerConstants.STATE.SIGN_OUT, (data) => {
            navigatorUtils.unregisterAllServiceWorkers((err: Err) => {
                if (data.deleteSeed)
                    self.storage.removeItem(StorageKeys.SEED_CAGE);
                window.location.reload();
            });
        });

        eventMiddleware.onStatus(ServiceWorkerConstants.STATE.ERROR, () => {
            throw new ServiceWorkerError(`Unable to load application`);
        });

        iframe.hidden = true;
    }

    private sendCompletedEvent(iframe: HTMLIFrameElement){
        const iframeDocument = iframe.contentDocument || (iframe.contentWindow ? iframe.contentWindow.document : undefined);
        if (!iframeDocument)
            throw new ServiceWorkerError(`Could not find Iframe document`);

        if (iframeDocument.readyState !== ServiceWorkerConstants.STATE.COMPLETE) {
            console.log('Event "completed" can be emitted only when iframe is loaded!');
            return;
        }

        const iframeIdentity = iframe.getAttribute('identity');
        if (!iframeIdentity) {
            console.log('Event "completed" can not be emitted if no identity was found!');
            return;
        }

        const completedEvent = new CustomEvent(iframeIdentity, { detail: { status: ServiceWorkerConstants.STATE.COMPLETED }});

        // TODO: Romsoft has specific code to wait for cardinal/webcardinal to load before sending this event. match that in a general manner
        document.dispatchEvent(completedEvent);
    }

    private setupSeedRequestListener(navigatorUtils: NavigatorUtils){
        navigatorUtils.addServiceWorkerEventListener(ServiceWorkerConstants.EVENTS.MESSAGE, (e: any) => {
            if (!e.data || e.data.query !== "seed") {
                return;
            }

            const swWorkerIdentity = e.data.identity;
            if (swWorkerIdentity === this.hash) {
                e.source.postMessage({
                    seed: this.seed,
                });
            }
        });
    }

    private setupProgressListener(){
        document.addEventListener(ServiceWorkerConstants.EVENTS.PROGRESS, async (e: any) => {
            const {progress, status} = e.detail;
            if (progress === 100){
                await this.spinner.remove();
                return
            }
            if (this.spinner.isVisible())
                await this.spinner.update(status);
            else
                await this.spinner.show(status);
        })
    }

    async run(navigatorUtils: NavigatorUtils){
        if(navigatorUtils.areServiceWorkersEnabled() && !navigatorUtils.areServiceWorkersSupported())
            return this.popUp.ask(`Your current browser doe's support this application`);

        const iframe = this.createContainerIFrame(!navigatorUtils.areServiceWorkersEnabled());
        this.setupLoadEventsListener(navigatorUtils, iframe);
        const self = this;

        if (navigatorUtils.areServiceWorkersEnabled()){
            let loadingInterval, loadingProgress = 10;
            await this.spinner.show(`Loading Application`);

            iframe.addEventListener(ServiceWorkerConstants.EVENTS.LOAD, () => {
                self.sendCompletedEvent(iframe);
            });

            document.appendChild(iframe);
            const timer = this.createTimerElement();
            document.appendChild(timer);
            navigatorUtils.registerPwaServiceWorker();
            return;
        }

        this.setupSeedRequestListener(navigatorUtils);
        this.setupProgressListener();

        navigatorUtils.unregisterAllServiceWorkers(() => {
            navigatorUtils.registerServiceWorker({
                name: "swLoader.js",
                path: "swLoader.js",
                scope: self.getIframeBase()
            }, (err) => {
                if (err)
                    throw err;
                iframe.addEventListener(ServiceWorkerConstants.EVENTS.LOAD, () => {
                    navigatorUtils.registerPwaServiceWorker();
                    self.sendCompletedEvent(iframe);
                });
                document.body.appendChild(iframe);
            });
        });
    }
}