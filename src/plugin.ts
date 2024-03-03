import { AccessoryConfig, AccessoryPlugin, API, Characteristic, CharacteristicValue, Formats, Logging, Perms, Service } from "homebridge";

import { EcoflowApi } from "./api";

import { AppParaHeartbeatReport } from "./proto/AppParaHeartbeatReport";
import { AppShowHeartbeatReport } from "./proto/AppShowHeartbeatReport";
import { BackendRecordHeartbeatReport } from "./proto/BackendRecordHeartbeatReport";
import { BpInfoReport } from "./proto/BpInfoReport";
import { HeaderMessage } from "./proto/HeaderMessage";

export class EcoflowPlugin implements AccessoryPlugin {
    private readonly api: API;
    private readonly log: Logging;

    private readonly informationService: Service;
    private readonly batteryService: Service;
    private readonly outletAcL11: Service;
    private readonly outletAcL12: Service;
    private readonly outletAcL21: Service;
    private readonly outletAcL22: Service;

    constructor(log: Logging, config: EcoflowPluginConfig, api: API) {
        this.api = api;    
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

        // Accessory Information Service
        this.informationService = new api.hap.Service.AccessoryInformation()
            .setCharacteristic(api.hap.Characteristic.Manufacturer, "EcoFlow")
            .setCharacteristic(api.hap.Characteristic.Model, "DELTA Pro Ultra")
            .setCharacteristic(api.hap.Characteristic.SerialNumber, config.serialNumber ?? "Unknown");

        // Battery Service
        this.batteryService = new api.hap.Service.Battery("Battery");

        // Outlet Services
        // AC 120V 20A Backup 1/2 | AC 120V 20A Online UPS | AC 120V 30A | AC 120V/240V 30A

        // AC 120V 20A Backup UPS 1
        this.outletAcL11 = new api.hap.Service.Outlet("AC Backup UPS 1", "outletAcL11Pwr");
        this.outletAcL11.addCharacteristic(this.newWattCharacteristic());
        this.outletAcL11.addCharacteristic(this.newAmpCharacteristic());
        this.outletAcL11.addCharacteristic(this.newVoltCharacteristic());
        this.outletAcL11.getCharacteristic(api.hap.Characteristic.On).onSet(() => { 
            throw new api.hap.HapStatusError(api.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        });
        
        // AC 120V 20A Backup UPS 2
        this.outletAcL12 = new api.hap.Service.Outlet("AC Backup UPS 2", "outletAcL12Pwr");
        this.outletAcL12.addCharacteristic(this.newWattCharacteristic());
        this.outletAcL12.addCharacteristic(this.newAmpCharacteristic());
        this.outletAcL12.addCharacteristic(this.newVoltCharacteristic());
        this.outletAcL12.getCharacteristic(api.hap.Characteristic.On).onSet(() => { 
            throw new api.hap.HapStatusError(api.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        });

        // AC 120V 20A Online UPS 1
        this.outletAcL21 = new api.hap.Service.Outlet("AC Online UPS 1", "outletAcL21Pwr");
        this.outletAcL21.addCharacteristic(this.newWattCharacteristic());
        this.outletAcL21.addCharacteristic(this.newAmpCharacteristic());
        this.outletAcL21.addCharacteristic(this.newVoltCharacteristic());
        this.outletAcL21.getCharacteristic(api.hap.Characteristic.On).onSet(() => { 
            throw new api.hap.HapStatusError(api.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        });
        
        // AC 120V 20A Online UPS 2
        this.outletAcL22 = new api.hap.Service.Outlet("AC Online UPS 2", "outletAcL22Pwr");
        this.outletAcL22.addCharacteristic(this.newWattCharacteristic());
        this.outletAcL22.addCharacteristic(this.newAmpCharacteristic());
        this.outletAcL22.addCharacteristic(this.newVoltCharacteristic());
        this.outletAcL22.getCharacteristic(api.hap.Characteristic.On).onSet(() => { 
            throw new api.hap.HapStatusError(api.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        });

        if (config.email && config.password && config.serialNumber) {
            const email = config.email;
            const password = config.password;
            const serialNumber = config.serialNumber;

            setTimeout(async () => {
                await this.mqttInit(email, password, serialNumber);
            }, 1000);
        }
    }

    async mqttInit(email: string, password: string, serialNumber: string) {
        const ecoflowApi = new EcoflowApi();

        // try
        const ecoflowMqtt = await ecoflowApi.connectMqttAsync(email, password);
        this.log.info("Connected to Ecoflow MQTT...");
    
        await ecoflowMqtt.subscribeAsync(`/app/device/property/${serialNumber}`);
        this.log.info(`Subscribed to Ecoflow MQTT Topic '/app/device/property/${serialNumber}'...`);
    
        ecoflowMqtt.on("message", (topic, message) => this.mqttMessage(topic, message));
    }

    mqttMessage(topic: string, message: Buffer) {
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
                        const appShowHeartbeatReport = AppShowHeartbeatReport.fromBinary(headerMessage.msg.pdata);
                        this.log.debug(`AppShowHeartbeatReport (${serialNumber}) ${JSON.stringify(appShowHeartbeatReport)}`);

                        if (appShowHeartbeatReport.soc) {
                            this.log.debug(`soc: ${appShowHeartbeatReport.soc}`)
                            this.batteryService.getCharacteristic(this.api.hap.Characteristic.BatteryLevel).updateValue(appShowHeartbeatReport.soc);
                            this.batteryService.getCharacteristic(this.api.hap.Characteristic.StatusLowBattery).updateValue(
                                appShowHeartbeatReport.soc > 10
                                    ? this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
                                    : this.api.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
                            );
                        }

                        // showFlag 2 == DC
                        // showFlag 4 == AC

                        if (appShowHeartbeatReport.showFlag != undefined) {
                            this.log.debug(`showFlag: ${appShowHeartbeatReport.showFlag}`);
                            this.log.debug(`showFlag & 4: ${appShowHeartbeatReport.showFlag & 4}`);

                            this.outletAcL11.getCharacteristic(this.api.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL12.getCharacteristic(this.api.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL21.getCharacteristic(this.api.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL22.getCharacteristic(this.api.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                        }

                        if (appShowHeartbeatReport.outAcL11Pwr != undefined) {
                            this.log.debug(`outAcL11Pwr: ${appShowHeartbeatReport.outAcL11Pwr}`);
                            this.outletAcL11.getCharacteristic(this.api.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL11Pwr != 0);
                            this.outletAcL11.getCharacteristic("Watts")?.updateValue(appShowHeartbeatReport.outAcL11Pwr);
                        }

                        if (appShowHeartbeatReport.outAcL12Pwr != undefined) {
                            this.log.debug(`outAcL12Pwr: ${appShowHeartbeatReport.outAcL12Pwr}`);
                            this.outletAcL12.getCharacteristic(this.api.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL12Pwr != 0);
                            this.outletAcL12.getCharacteristic("Watts")?.updateValue(appShowHeartbeatReport.outAcL12Pwr);
                        }

                        if (appShowHeartbeatReport.outAcL21Pwr != undefined) {
                            this.log.debug(`outAcL21Pwr: ${appShowHeartbeatReport.outAcL11Pwr}`);
                            this.outletAcL21.getCharacteristic(this.api.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL21Pwr != 0);
                            this.outletAcL21.getCharacteristic("Watts")?.updateValue(appShowHeartbeatReport.outAcL21Pwr);
                        }

                        if (appShowHeartbeatReport.outAcL22Pwr != undefined) {
                            this.log.debug(`outAcL22Pwr: ${appShowHeartbeatReport.outAcL12Pwr}`);
                            this.outletAcL22.getCharacteristic(this.api.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL22Pwr != 0);
                            this.outletAcL22.getCharacteristic("Watts")?.updateValue(appShowHeartbeatReport.outAcL22Pwr);
                        }

                        break;
                    case 2:
                        const backendRecordHeartbeatReport = BackendRecordHeartbeatReport.fromBinary(headerMessage.msg.pdata);
                        this.log.debug(`BackendRecordHeartbeatReport (${serialNumber}) ${JSON.stringify(backendRecordHeartbeatReport)}`);

                        if (backendRecordHeartbeatReport.bmsInputWatts != undefined) {
                            this.log.debug(`bmsInputWatts: ${backendRecordHeartbeatReport.bmsInputWatts}`)
                            this.batteryService.getCharacteristic(this.api.hap.Characteristic.ChargingState).updateValue(
                                backendRecordHeartbeatReport.bmsInputWatts == 0
                                    ? this.api.hap.Characteristic.ChargingState.NOT_CHARGING
                                    : this.api.hap.Characteristic.ChargingState.CHARGING);
                        }

                        if (backendRecordHeartbeatReport.outAcL11Amp != undefined) {
                            this.log.debug(`outAcL11Amp: ${backendRecordHeartbeatReport.outAcL11Amp}`);
                            this.outletAcL11.getCharacteristic("Amps")?.updateValue(backendRecordHeartbeatReport.outAcL11Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL11Vol != undefined) {
                            this.log.debug(`outAcL11Vol: ${backendRecordHeartbeatReport.outAcL11Vol}`);
                            this.outletAcL11.getCharacteristic("Volts")?.updateValue(backendRecordHeartbeatReport.outAcL11Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcL12Amp != undefined) {
                            this.log.debug(`outAcL12Amp: ${backendRecordHeartbeatReport.outAcL12Amp}`);
                            this.outletAcL12.getCharacteristic("Amps")?.updateValue(backendRecordHeartbeatReport.outAcL12Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL12Vol != undefined) {
                            this.log.debug(`outAcL12Vol: ${backendRecordHeartbeatReport.outAcL12Vol}`);
                            this.outletAcL12.getCharacteristic("Volts")?.updateValue(backendRecordHeartbeatReport.outAcL12Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcL21Amp != undefined) {
                            this.log.debug(`outAcL21Amp: ${backendRecordHeartbeatReport.outAcL21Amp}`);
                            this.outletAcL21.getCharacteristic("Amps")?.updateValue(backendRecordHeartbeatReport.outAcL21Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL21Vol != undefined) {
                            this.log.debug(`outAcL21Vol: ${backendRecordHeartbeatReport.outAcL21Vol}`);
                            this.outletAcL21.getCharacteristic("Volts")?.updateValue(backendRecordHeartbeatReport.outAcL21Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcL22Amp != undefined) {
                            this.log.debug(`outAcL22Amp: ${backendRecordHeartbeatReport.outAcL22Amp}`);
                            this.outletAcL22.getCharacteristic("Amps")?.updateValue(backendRecordHeartbeatReport.outAcL22Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL22Vol != undefined) {
                            this.log.debug(`outAcL22Vol: ${backendRecordHeartbeatReport.outAcL22Vol}`);
                            this.outletAcL22.getCharacteristic("Volts")?.updateValue(backendRecordHeartbeatReport.outAcL22Vol);
                        }

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
                        break;
                }
            }
        }
    }

    getServices(): Service[] {
        const services = [this.informationService, this.batteryService, this.outletAcL11, this.outletAcL12, this.outletAcL21, this.outletAcL22];
        return services;
    }


    newWattCharacteristic(): Characteristic {
        return new this.api.hap.Characteristic("Watts", "E863F10D-079E-48FF-8F27-9C2605A29F52", {
            format: Formats.FLOAT,
            perms: [Perms.NOTIFY, Perms.PAIRED_READ],
            unit: "W"
        });
    }

    newAmpCharacteristic(): Characteristic {
        return new this.api.hap.Characteristic("Amps", "E863F126-079E-48FF-8F27-9C2605A29F52", {
            format: Formats.FLOAT,
            perms: [Perms.NOTIFY, Perms.PAIRED_READ],
            unit: "A"
        });
    }

    newVoltCharacteristic(): Characteristic {
        return new this.api.hap.Characteristic("Volts", "E863F10A-079E-48FF-8F27-9C2605A29F52", {
            format: Formats.FLOAT,
            perms: [Perms.NOTIFY, Perms.PAIRED_READ],
            unit: "V"
        });
    }
}

interface EcoflowPluginConfig extends AccessoryConfig {
    email?: string;
    password?: string;
    serialNumber?: string;
    debug?: boolean;
}
