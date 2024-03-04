import { API } from "homebridge";

import { EcoflowPlugin } from "./plugin";

export = (api: API) => {
    api.registerAccessory("EcoFlow DELTA Pro Ultra", EcoflowPlugin);
};
