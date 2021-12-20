/**
 * Registers event handlers on the provided IFrame to enable it to respond to request and status updates
 *
 * @class EventMiddleWare
 */
export class EventMiddleWare{
    private readonly identity: string;
    private readonly iframe: HTMLIFrameElement;

    private readonly queriesHandlers: {[indexer: string]: Function} = {};
    private readonly statusesHandlers: {[indexer: string]: Function} = {};

    constructor(iframe: HTMLIFrameElement, identity: string) {
        this.identity = identity;
        this.iframe = iframe;

        window.document.addEventListener(this.identity, this.handleEvent.bind(this));
    }

    handleEvent(event: any){
        const data = event.detail || {};

        if (typeof data.query === "string") {
            if (!this.queriesHandlers[data.query]) {
                console.error(`Error: Query [${data.query} could not be resolved. Did you added registered a handler for it?]`);
                return;
            }

            let handlerResponse = this.queriesHandlers[data.query](data);

            if (!(handlerResponse instanceof Promise))
                handlerResponse = Promise.resolve(handlerResponse);

            return handlerResponse.then((responseData: any) => {
                const w = this.iframe.contentWindow;
                if (!w)
                    throw new Error(`Could not finds IFrame's content window to bind identity ${responseData}`)
                w.document.dispatchEvent(new CustomEvent(this.identity, {
                    detail: responseData
                }));
            })
        }

        if (typeof data.status === "string") {
            if (!this.statusesHandlers[data.status]) {
                console.error(`Error: Status [${data.status} could not be resolved. Did you added registered a handler for it?]`);
                return;
            }

            return this.statusesHandlers[data.status](data);
        }
    }

    registerQuery(query: string, handler: (event: any) => void) {
        if(typeof handler !== "function")
            throw new Error("[EventMiddleware.reqisterQuery] Handler is not a function");
        this.queriesHandlers[query] = handler;
    };

    unregisterQuery(query: string) {
        if(this.queriesHandlers[query])
            delete this.queriesHandlers[query];
    };

    onStatus(status: string, handler: (event: any) => void){
        if(typeof handler !=="function")
            throw new Error("[EventMiddleware.onStatus] Handler is not a function");
        this.statusesHandlers[status] = handler;
    };

    offStatus(status: string){
        if(this.statusesHandlers[status])
            delete this.statusesHandlers[status];
    };
} 