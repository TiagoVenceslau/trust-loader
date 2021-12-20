export enum LoaderConstants {
    CONFIG_FILE = "./loader-config.json",
    MANIFEST_FILE = "./manifest.webmanifest",
    USER_DETAILS_FILE = 'user-details.json'
}

export const ServiceWorkerConstants = {
    QUERIES: {
        SEED: "seed"
    },
    EVENTS: {
        UPDATE: "updatefound",
        STATE_CHANGE: "statechange",
        LOAD: "load",
        MESSAGE: "message",
        PROGRESS: "ssapp:loading:progress"
    },
    STATE: {
        INSTALLED: "installed",
        COMPLETED: "completed",
        SIGN_OUT: "sign-out",
        ERROR: "error",
        COMPLETE: "complete"
    }
}

/**
 * @enum StorageKeys
 *
 * @category Constants
 */
export enum StorageKeys {
    /**
     * Credentials suffix
     */
    CREDENTIALS = "-credentials",
    /**
     * pincode suffix
     */
    PINCODE = "-pincode",

    SEED_CAGE = "seedCage"
}
