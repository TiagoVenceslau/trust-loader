/**
 * @module loader
 */

import env from "./environment.js";
import {Loader} from './bundles/trust-loader.js';
import * as config from "./loader-config.json";

// Handle Base Element - should not run if inside iframe
if (!window.frameElement){
    let base_el = document.createElement('base');
    base_el['href'] = env.basePath;
    document.querySelector('head').prepend(base_el);
}

const loader = new Loader(config, env);