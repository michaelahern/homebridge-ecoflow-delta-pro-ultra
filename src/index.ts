import { API } from "homebridge";

import { EcoFlowPlugin } from "./plugin.js";

export default (api: API) => {
    api.registerAccessory("EcoFlow DELTA Pro Ultra", EcoFlowPlugin);
};
