/**
 * @module loader
 */

/**
 *
 */

import {getNavigatorUtils, ServiceWorkerConstants} from "../../bundles/trust-loader.js";
import env from "../../environment.js"
const paths = window.location.pathname.split("/iframe/");
const myIdentity = paths[1];
const swName = "swBoot.js";
let loadingInterval;

const NavigatorUtils = getNavigatorUtils();
console.log(`NavigatorUtils: ${NavigatorUtils}`);

function startLoadingProgressInterval(initialLoadingProgress) {
    sendLoadingProgress(initialLoadingProgress, `Loading ${initialLoadingProgress}%`);
    let loadingProgress = initialLoadingProgress;
    loadingInterval = setInterval(() => {
        let increment = 10;
        if (loadingProgress >= 90) {
            increment = 1;
        }

        loadingProgress += increment;

        if (loadingProgress >= 100) {
            clearInterval(loadingInterval);
            return;
        }
        sendLoadingProgress(loadingProgress, `Loading ${loadingProgress}%`);
    }, 1000);
}

window.frameElement.setAttribute("app-placeholder","true");
startLoadingProgressInterval(10);

if(NavigatorUtils.canUseServiceWorkers()) {
    window.document.addEventListener(myIdentity, (e) => {
        const data = e.detail || {};

        if (data.seed) {
            const seed = data.seed;
            const swConfig = {
                name: swName,
                path: `../${swName}`,
                scope: myIdentity
            };

            NavigatorUtils.loadDistributedApp(seed, swConfig, (err) => {
                if (err) {
                    clearInterval(loadingInterval);
                    console.error(err);
                    return sendMessage({
                        status: ServiceWorkerConstants.STATE.ERROR
                    });
                }
                sendMessage({
                    status: ServiceWorkerConstants.STATE.COMPLETED
                });
            })

        }
    });
    
    sendMessage({
        query: ServiceWorkerConstants.QUERIES.SEED
    });
} else {
    console.log(`Skipping registering ${swName} due to service workers being disabled`);
}

function sendMessage(message) {
    const event = new CustomEvent(myIdentity, {
        detail: message
    });
    window.parent.document.dispatchEvent(event);
}

function sendLoadingProgress(progress, status) {
    if (env.showLoadingProgress === false)
        return;

    let currentWindow = window;
    let parentWindow = currentWindow.parent;

    while (currentWindow !== parentWindow) {
        currentWindow = parentWindow;
        parentWindow = currentWindow.parent;
    }

    parentWindow.document.dispatchEvent(new CustomEvent(ServiceWorkerConstants.LOADING, {
        detail: {
            progress,
            status
        }
    }));
}
