import { API } from "homebridge";

import { EcoflowPlugin } from "./plugin";

export = (api: API) => {
  api.registerAccessory("EcoFlowDeltaProUltra", EcoflowPlugin);
};
