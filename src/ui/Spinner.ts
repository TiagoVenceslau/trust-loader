export interface Spinner {
    isVisible(): boolean;
    show(message: string, options?: {}): Promise<void>;
    update(message: string): Promise<void>;
    remove(): Promise<void>;
}

export class LogSpinner implements Spinner {
    private visibility: boolean = false;

    isVisible(){
        return this.visibility;
    }

    remove(): Promise<void> {
        this.visibility = false;
        return Promise.resolve(undefined);
    }

    show(message: string, options?: {}): Promise<void> {
        this.visibility = true;
        console.log(`{SPINNER]: ${message}`)
        return Promise.resolve(undefined);
    }

    update(message: string): Promise<void> {
        console.log(`{SPINNER]: ${message}`)
        return Promise.resolve(undefined);
    }

}