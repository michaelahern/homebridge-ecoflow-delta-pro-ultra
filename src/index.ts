import { API } from "homebridge";

import { EcoFlowPlugin } from "./plugin";

export = (api: API) => {
    api.registerAccessory("EcoFlow DELTA Pro Ultra", EcoFlowPlugin);
};
