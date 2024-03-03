import { AccessoryConfig, AccessoryPlugin, API, Logging, Service } from "homebridge";

import { EcoflowApi } from "./api";

import { AppParaHeartbeatReport } from "./proto/AppParaHeartbeatReport";
import { AppShowHeartbeatReport } from "./proto/AppShowHeartbeatReport";
import { BackendRecordHeartbeatReport } from "./proto/BackendRecordHeartbeatReport";
import { BpInfoReport } from "./proto/BpInfoReport";
import { HeaderMessage } from "./proto/HeaderMessage";

export class EcoflowPlugin implements AccessoryPlugin {
    private readonly log: Logging;

    private readonly informationService: Service;
    private readonly batteryService: Service;

    constructor(log: Logging, config: EcoflowPluginConfig, api: API) {
        this.log = log;

        if (!config.email) {
          this.log.error("Missing required config value: email");
        }
    
        if (!config.password) {
          this.log.error("Missing required config value: password");
        }
    
        if (!config.serialNumber) {
          this.log.error("Missing required config value: serialNumber");
        }
    
        if (!config.debug) {
          config.debug = false;
        }
    
        // HomeKit Accessory Information Service
        this.informationService = new api.hap.Service.AccessoryInformation()
          .setCharacteristic(api.hap.Characteristic.Manufacturer, "EcoFlow")
          .setCharacteristic(api.hap.Characteristic.Model, "DELTA Pro Ultra")
          .setCharacteristic(api.hap.Characteristic.SerialNumber, config.serialNumber ?? "Unknown");
    
        // HomeKit Battery Service
        this.batteryService = new api.hap.Service.Battery("Battery");

        if (config.email && config.password && config.serialNumber) {
          const email = config.email;
          const password = config.password;
          const serialNumber = config.serialNumber;

          setTimeout(async () => {
            await this.mqttInit(email, password, serialNumber, api);
          }, 1000);
      }
    }

    async mqttInit(email: string, password: string, serialNumber: string, api: API) {
      const ecoflowApi = new EcoflowApi();

      // try
      const ecoflowMqtt = await ecoflowApi.connectMqttAsync(email, password);
      this.log.info("Connected to Ecoflow MQTT...");
  
      await ecoflowMqtt.subscribeAsync(`/app/device/property/${serialNumber}`);
      this.log.info(`Subscribed to Ecoflow MQTT Topic '/app/device/property/${serialNumber}'...`);
  
      ecoflowMqtt.on("message", (topic, message) => this.mqttMessage(topic, message, api));
    }

    mqttMessage(topic: string, message: Buffer, api: API) {
      const serialNumber = topic.substring(21);
      const headerMessage = HeaderMessage.fromBinary(message);

      if (headerMessage.msg && headerMessage.msg.pdata) {
          if (headerMessage.msg.seq && headerMessage.msg.encType == 1) {
              const seq = headerMessage.msg.seq;
              headerMessage.msg.pdata.forEach((value, index, array) => {
                  array[index] = value ^ seq;
              });
          }

          if (headerMessage.msg.src == 2 && headerMessage.msg.cmdFunc == 2) {
              // try
              switch (headerMessage.msg.cmdId) {
                  case 1:
                      this.log.debug(`AppShowHeartbeatReport (${serialNumber})`);
                      const appShowHeartbeatReport = AppShowHeartbeatReport.fromBinary(headerMessage.msg.pdata);
                      this.log.debug(JSON.stringify(appShowHeartbeatReport));
                      break;
                  case 2:
                      this.log.debug(`BackendRecordHeartbeatReport (${serialNumber})`);
                      const backendRecordHeartbeatReport = BackendRecordHeartbeatReport.fromBinary(headerMessage.msg.pdata);
                      this.log.debug(JSON.stringify(backendRecordHeartbeatReport));
                      break;
                  case 3:
                      this.log.debug(`AppParaHeartbeatReport (${serialNumber})`);
                      const appParaHeartbeatReport = AppParaHeartbeatReport.fromBinary(headerMessage.msg.pdata);
                      this.log.debug(JSON.stringify(appParaHeartbeatReport));
                      break;
                  case 4:
                      this.log.debug(`BpInfoReport (${serialNumber})`);
                      const bpInfoReport = BpInfoReport.fromBinary(headerMessage.msg.pdata);
                      this.log.debug(JSON.stringify(bpInfoReport));

                      const bpSocSum = bpInfoReport.bpInfo.map(val => val.bpSoc ?? 0).reduce((accumulator, currentValue) => accumulator + currentValue);
                      const bpSocAvg = bpSocSum / bpInfoReport.bpInfo.length;
                      this.log.info(`${bpSocAvg}`);

                      const bpChgStaSum = bpInfoReport.bpInfo.map(val => val.bpChgSta ?? 0).reduce((acc, curr) => acc + curr);

                      this.batteryService.getCharacteristic(api.hap.Characteristic.BatteryLevel).updateValue(bpSocAvg);
                      this.batteryService.getCharacteristic(api.hap.Characteristic.ChargingState).updateValue(bpChgStaSum == 0 ? 0 : 1);
                      this.batteryService.getCharacteristic(api.hap.Characteristic.StatusLowBattery).updateValue(
                        bpSocAvg > 10
                          ? api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
                          : api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
                      );

                      break;
              }
          }
      }
    }

    getServices(): Service[] {
        const services = [this.informationService, this.batteryService];
    
        return services;
      }
}

interface EcoflowPluginConfig extends AccessoryConfig {
    email?: string;
    password?: string;
    serialNumber?: string;
    debug?: boolean;
  }
