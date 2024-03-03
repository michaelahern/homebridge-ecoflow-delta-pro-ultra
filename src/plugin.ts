import { AccessoryConfig, AccessoryPlugin, API, HAP, Logging, Service } from "homebridge";

import { EcoflowApi } from "./api";
import { EcoFlowCustomCharacteristics } from "./homebridge";
import { AppShowHeartbeatReport } from "./proto/AppShowHeartbeatReport";
import { BackendRecordHeartbeatReport } from "./proto/BackendRecordHeartbeatReport";
import { HeaderMessage } from "./proto/HeaderMessage";

export class EcoflowPlugin implements AccessoryPlugin {
    private readonly api: API;
    private readonly hap: HAP;
    private readonly log: Logging;
    private readonly customCharacteristics: EcoFlowCustomCharacteristics;

    private readonly informationService: Service;
    private readonly batteryService: Service;
    private readonly outletAcL11: Service;
    private readonly outletAcL12: Service;
    private readonly outletAcL21: Service;
    private readonly outletAcL22: Service;
    private readonly outletAcTt: Service;
    private readonly outletAcL14: Service;

    constructor(log: Logging, config: EcoflowPluginConfig, api: API) {
        this.api = api;
        this.hap = api.hap;
        this.log = log;
        this.customCharacteristics = new EcoFlowCustomCharacteristics(api);

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
        this.informationService = new this.hap.Service.AccessoryInformation()
            .setCharacteristic(this.hap.Characteristic.Manufacturer, "EcoFlow")
            .setCharacteristic(this.hap.Characteristic.Model, "DELTA Pro Ultra")
            .setCharacteristic(this.hap.Characteristic.SerialNumber, config.serialNumber ?? "Unknown");

        // Battery Service
        this.batteryService = new this.hap.Service.Battery("Battery");

        // Outlet Services
        // AC 20A Backup UPS 1/2 | AC 20A Online UPS 1/2 | AC 120V 30A | AC 120V/240V 30A | Power In/Out

        // AC 20A Backup UPS 1
        this.outletAcL11 = new this.hap.Service.Outlet("AC 20A (Backup UPS 1)", "outletAcL11");
        this.outletAcL11.addCharacteristic(this.customCharacteristics.Amps());
        this.outletAcL11.addCharacteristic(this.customCharacteristics.Volts());
        this.outletAcL11.addCharacteristic(this.customCharacteristics.Watts());
        this.outletAcL11.getCharacteristic(this.hap.Characteristic.On).onSet(() => { 
            throw new this.hap.HapStatusError(this.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        });
        
        // AC 20A Backup UPS 2
        this.outletAcL12 = new this.hap.Service.Outlet("AC 20A (Backup UPS 2)", "outletAcL12");
        this.outletAcL12.addCharacteristic(this.customCharacteristics.Amps());
        this.outletAcL12.addCharacteristic(this.customCharacteristics.Volts());
        this.outletAcL12.addCharacteristic(this.customCharacteristics.Watts());
        this.outletAcL12.getCharacteristic(this.hap.Characteristic.On).onSet(() => { 
            throw new this.hap.HapStatusError(this.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        });

        // AC 20A Online UPS 1
        this.outletAcL21 = new this.hap.Service.Outlet("AC 20A (Online UPS 1)", "outletAcL21");
        this.outletAcL21.addCharacteristic(this.customCharacteristics.Amps());
        this.outletAcL21.addCharacteristic(this.customCharacteristics.Volts());
        this.outletAcL21.addCharacteristic(this.customCharacteristics.Watts());
        this.outletAcL21.getCharacteristic(this.hap.Characteristic.On).onSet(() => { 
            throw new this.hap.HapStatusError(this.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        });
        
        // AC 20A Online UPS 2
        this.outletAcL22 = new this.hap.Service.Outlet("AC 20A (Online UPS 2)", "outletAcL22");
        this.outletAcL22.addCharacteristic(this.customCharacteristics.Amps());
        this.outletAcL22.addCharacteristic(this.customCharacteristics.Volts());
        this.outletAcL22.addCharacteristic(this.customCharacteristics.Watts());
        this.outletAcL22.getCharacteristic(this.hap.Characteristic.On).onSet(() => { 
            throw new this.hap.HapStatusError(this.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        });

        // AC 30A 120V
        this.outletAcTt = new this.hap.Service.Outlet("AC 30A 120V", "outletAcTt");
        this.outletAcTt.addCharacteristic(this.customCharacteristics.Amps());
        this.outletAcTt.addCharacteristic(this.customCharacteristics.Volts());
        this.outletAcTt.addCharacteristic(this.customCharacteristics.Watts());
        this.outletAcTt.getCharacteristic(this.hap.Characteristic.On).onSet(() => { 
            throw new this.hap.HapStatusError(this.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        });

        // AC 30A 120V/240V
        this.outletAcL14 = new this.hap.Service.Outlet("AC 30A 240V", "outletAcL14");
        this.outletAcL14.addCharacteristic(this.customCharacteristics.Amps());
        this.outletAcL14.addCharacteristic(this.customCharacteristics.Volts());
        this.outletAcL14.addCharacteristic(this.customCharacteristics.Watts());
        this.outletAcL14.getCharacteristic(this.hap.Characteristic.On).onSet(() => { 
            throw new this.hap.HapStatusError(this.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
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

        // todo: retry
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
                switch (headerMessage.msg.cmdId) {
                    // AppShowHeartbeatReport
                    case 1: {
                        const appShowHeartbeatReport = AppShowHeartbeatReport.fromBinary(headerMessage.msg.pdata);
                        this.log.debug(`AppShowHeartbeatReport (${serialNumber}) ${JSON.stringify(appShowHeartbeatReport)}`);

                        if (appShowHeartbeatReport.soc) {
                            this.log.debug(`soc: ${appShowHeartbeatReport.soc}`)
                            this.batteryService.getCharacteristic(this.hap.Characteristic.BatteryLevel).updateValue(appShowHeartbeatReport.soc);
                            this.batteryService.getCharacteristic(this.hap.Characteristic.StatusLowBattery).updateValue(
                                appShowHeartbeatReport.soc > 10
                                    ? this.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
                                    : this.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
                            );
                        }

                        // showFlag: 2 == DC, 4 == AC
                        if (appShowHeartbeatReport.showFlag != undefined) {
                            this.log.debug(`showFlag: ${appShowHeartbeatReport.showFlag}`);
                            this.outletAcL11.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL12.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL21.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL22.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcTt.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL14.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                        }

                        if (appShowHeartbeatReport.outAcL11Pwr != undefined) {
                            this.log.debug(`outAcL11Pwr: ${appShowHeartbeatReport.outAcL11Pwr}`);
                            this.outletAcL11.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL11Pwr != 0);
                            this.outletAcL11.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcL11Pwr);
                        }

                        if (appShowHeartbeatReport.outAcL12Pwr != undefined) {
                            this.log.debug(`outAcL12Pwr: ${appShowHeartbeatReport.outAcL12Pwr}`);
                            this.outletAcL12.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL12Pwr != 0);
                            this.outletAcL12.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcL12Pwr);
                        }

                        if (appShowHeartbeatReport.outAcL21Pwr != undefined) {
                            this.log.debug(`outAcL21Pwr: ${appShowHeartbeatReport.outAcL11Pwr}`);
                            this.outletAcL21.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL21Pwr != 0);
                            this.outletAcL21.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcL21Pwr);
                        }

                        if (appShowHeartbeatReport.outAcL22Pwr != undefined) {
                            this.log.debug(`outAcL22Pwr: ${appShowHeartbeatReport.outAcL12Pwr}`);
                            this.outletAcL22.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL22Pwr != 0);
                            this.outletAcL22.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcL22Pwr);
                        }

                        if (appShowHeartbeatReport.outAcTtPwr != undefined) {
                            this.log.debug(`outAcTtPwr: ${appShowHeartbeatReport.outAcTtPwr}`);
                            this.outletAcTt.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcTtPwr != 0);
                            this.outletAcTt.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcTtPwr);
                        }

                        if (appShowHeartbeatReport.outAcL14Pwr != undefined) {
                            this.log.debug(`outAcTtPwr: ${appShowHeartbeatReport.outAcTtPwr}`);
                            this.outletAcL14.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL14Pwr != 0);
                            this.outletAcL14.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcL14Pwr);
                        }

                        break;
                    }

                    // BackendRecordHeartbeatReport
                    case 2: {
                        const backendRecordHeartbeatReport = BackendRecordHeartbeatReport.fromBinary(headerMessage.msg.pdata);
                        this.log.debug(`BackendRecordHeartbeatReport (${serialNumber}) ${JSON.stringify(backendRecordHeartbeatReport)}`);

                        if (backendRecordHeartbeatReport.bmsInputWatts != undefined) {
                            this.log.debug(`bmsInputWatts: ${backendRecordHeartbeatReport.bmsInputWatts}`)
                            this.batteryService.getCharacteristic(this.hap.Characteristic.ChargingState).updateValue(
                                backendRecordHeartbeatReport.bmsInputWatts == 0
                                    ? this.hap.Characteristic.ChargingState.NOT_CHARGING
                                    : this.hap.Characteristic.ChargingState.CHARGING);
                        }

                        if (backendRecordHeartbeatReport.outAcL11Amp != undefined) {
                            this.log.debug(`outAcL11Amp: ${backendRecordHeartbeatReport.outAcL11Amp}`);
                            this.outletAcL11.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL11Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL11Vol != undefined) {
                            this.log.debug(`outAcL11Vol: ${backendRecordHeartbeatReport.outAcL11Vol}`);
                            this.outletAcL11.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL11Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcL12Amp != undefined) {
                            this.log.debug(`outAcL12Amp: ${backendRecordHeartbeatReport.outAcL12Amp}`);
                            this.outletAcL12.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL12Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL12Vol != undefined) {
                            this.log.debug(`outAcL12Vol: ${backendRecordHeartbeatReport.outAcL12Vol}`);
                            this.outletAcL12.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL12Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcL21Amp != undefined) {
                            this.log.debug(`outAcL21Amp: ${backendRecordHeartbeatReport.outAcL21Amp}`);
                            this.outletAcL21.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL21Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL21Vol != undefined) {
                            this.log.debug(`outAcL21Vol: ${backendRecordHeartbeatReport.outAcL21Vol}`);
                            this.outletAcL21.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL21Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcL22Amp != undefined) {
                            this.log.debug(`outAcL22Amp: ${backendRecordHeartbeatReport.outAcL22Amp}`);
                            this.outletAcL22.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL22Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL22Vol != undefined) {
                            this.log.debug(`outAcL22Vol: ${backendRecordHeartbeatReport.outAcL22Vol}`);
                            this.outletAcL22.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL22Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcTtAmp != undefined) {
                            this.log.debug(`outAcTtAmp: ${backendRecordHeartbeatReport.outAcTtAmp}`);
                            this.outletAcTt.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcTtAmp);
                        }

                        if (backendRecordHeartbeatReport.outAcTtVol != undefined) {
                            this.log.debug(`outAcTtVol: ${backendRecordHeartbeatReport.outAcTtVol}`);
                            this.outletAcTt.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcTtVol);
                        }

                        if (backendRecordHeartbeatReport.outAcL14Amp != undefined) {
                            this.log.debug(`outAcL14Amp: ${backendRecordHeartbeatReport.outAcL14Amp}`);
                            this.outletAcL14.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL14Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL14Vol != undefined) {
                            this.log.debug(`outAcL14Vol: ${backendRecordHeartbeatReport.outAcL14Vol}`);
                            this.outletAcL14.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL14Vol);
                        }

                        break;
                    }
                    // AppParaHeartbeatReport
                    case 3: {
                        break;
                    }
                    // BpInfoReport
                    case 4: {
                        break;
                    }
                }
            }
        }
    }

    getServices(): Service[] {
        return [this.informationService, this.batteryService, this.outletAcL11, this.outletAcL12, this.outletAcL21, this.outletAcL22, this.outletAcTt, this.outletAcL14];
    }
}

interface EcoflowPluginConfig extends AccessoryConfig {
    email?: string;
    password?: string;
    serialNumber?: string;
    debug?: boolean;
}
