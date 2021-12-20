export interface PopUp {
    ask(message: string): Promise<boolean>;
}

export class DefaultPopUp implements PopUp {
    ask(message: string){
        return Promise.resolve(confirm(message));
    }
}