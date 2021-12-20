import {Callback} from "../types";

export class FileService {

	constructUrlBase(prefix?: string){
		let url;
		let location = window.location;
		const paths = location.pathname.split("/");
		while(paths.length>0){
			if(paths[0]===""){
				paths.shift();
			}else{
				break;
			}
		}
		let applicationName = paths[0];
		prefix = prefix || "";
		url = `${location.protocol}//${location.host}/${prefix}${applicationName}`;
		return url;
	}

	createRequest(url: string, method: string, callback: Callback){
		let xhr = new XMLHttpRequest();
		xhr.open(method, url);
		xhr.onload = function() {
			if (xhr.status != 200) {
				callback(new Error(`Error ${xhr.status}: ${xhr.statusText}`));
			} else {
				callback(undefined, xhr.response);
			}
		};
		xhr.onerror = function() {
			callback(new Error("Request failed"));
		};
		return xhr;
	}

	getFile(url: string, callback: Callback){
		url = this.constructUrlBase() + "/" +url;
		this.createRequest(url, "GET", callback).send();
	};

	getFolderContentAsJSON(url: string, callback: Callback){
		url = this.constructUrlBase("directory-summary/")+"/"+url;
		this.createRequest(url, "GET", callback).send();
	}
}