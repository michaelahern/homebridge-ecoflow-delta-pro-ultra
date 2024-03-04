import { AccessoryConfig, AccessoryPlugin, API, HAP, Logging, Service } from "homebridge";

import { EcoflowApi } from "./api";
import { EcoFlowCustomCharacteristics } from "./homebridge";
import { AppParaHeartbeatReport } from "./proto/AppParaHeartbeatReport";
import { AppShowHeartbeatReport } from "./proto/AppShowHeartbeatReport";
import { BackendRecordHeartbeatReport } from "./proto/BackendRecordHeartbeatReport";
import { BpInfoReport } from "./proto/BpInfoReport";
import { HeaderMessage } from "./proto/HeaderMessage";

export class EcoFlowPlugin implements AccessoryPlugin {
    private readonly hap: HAP;
    private readonly log: Logging;

    private readonly config: EcoFlowPluginConfig
    private readonly customCharacteristics: EcoFlowCustomCharacteristics;
    private mqttInitComplete: boolean;

    private readonly informationService: Service;
    private readonly batteryService: Service;
    private readonly outletAcL11: Service;
    private readonly outletAcL12: Service;
    private readonly outletAcL21: Service;
    private readonly outletAcL22: Service;
    private readonly outletAcTt: Service;
    private readonly outletAcL14: Service;
    private readonly outletAc5P8: Service;

    constructor(log: Logging, config: EcoFlowPluginConfig, api: API) {
        this.hap = api.hap;
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

        this.config = config;
        this.customCharacteristics = new EcoFlowCustomCharacteristics(api);
        this.mqttInitComplete = false;

        // Accessory Information Service
        this.informationService = new this.hap.Service.AccessoryInformation()
            .setCharacteristic(this.hap.Characteristic.Manufacturer, "EcoFlow")
            .setCharacteristic(this.hap.Characteristic.Model, "DELTA Pro Ultra")
            .setCharacteristic(this.hap.Characteristic.SerialNumber, config.serialNumber ?? "Unknown");

        // Battery Service
        this.batteryService = new this.hap.Service.Battery("Battery");

        // Outlet Services
        // AC 20A Backup UPS 1/2 | AC 20A Online UPS 1/2 | AC 120V 30A | AC 120V/240V 30A | Power Input/Output Port

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

        // Power Input/Output Port
        this.outletAc5P8 = new this.hap.Service.Outlet("Power Input/Output Port", "outletAc5P8");
        this.outletAc5P8.addCharacteristic(this.customCharacteristics.Amps());
        this.outletAc5P8.addCharacteristic(this.customCharacteristics.Volts());
        this.outletAc5P8.addCharacteristic(this.customCharacteristics.Watts());
        this.outletAc5P8.getCharacteristic(this.hap.Characteristic.On).updateValue(true);
        this.outletAc5P8.getCharacteristic(this.hap.Characteristic.On).onSet(() => { 
            throw new this.hap.HapStatusError(this.hap.HAPStatus.READ_ONLY_CHARACTERISTIC);
        });

        if (config.email && config.password && config.serialNumber) {
            const email = config.email;
            const password = config.password;
            const serialNumber = config.serialNumber;

            setTimeout(async () => {
                await this.mqttInit(email, password, serialNumber);
            }, 1000);

            setInterval(async () => {
                if (!this.mqttInitComplete) {
                    await this.mqttInit(email, password, serialNumber);
                }
            }, 5 * 60 * 1000);
        }
    }

    public getServices(): Service[] {
        const services = [this.informationService, this.batteryService];

        if (!this.config.hideOutletAcL11) {
            services.push(this.outletAcL11);
        }

        if (!this.config.hideOutletAcL12) {
            services.push(this.outletAcL12);
        }

        if (!this.config.hideOutletAcL21) {
            services.push(this.outletAcL21);
        }

        if (!this.config.hideOutletAcL22) {
            services.push(this.outletAcL22);
        }

        if (!this.config.hideOutletAcTt) {
            services.push(this.outletAcTt);
        }

        if (!this.config.hideOutletAcL14) {
            services.push(this.outletAcL14);
        }

        if (!this.config.hideOutletAc5P8) {
            services.push(this.outletAc5P8);
        }

        return services;
    }

    private async mqttInit(email: string, password: string, serialNumber: string) {
        try {
            const ecoflowApi = new EcoflowApi();
            const ecoflowMqtt = await ecoflowApi.connectMqttAsync(email, password);
            await ecoflowMqtt.subscribeAsync(`/app/device/property/${serialNumber}`);
            ecoflowMqtt.on("message", (topic, message) => this.onMqttMessage(topic, message));

            this.mqttInitComplete = true;
            this.log.info("Connected to the EcoFlow MQTT Service...");
        }
        catch (err) {
            if (err instanceof Error) {
                this.log.error(err.message);
            }
        }
    }

    private onMqttMessage(topic: string, message: Buffer) {
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

                        if (this.config.debug) {
                            this.log.debug(`AppShowHeartbeatReport (${serialNumber}) ${JSON.stringify(appShowHeartbeatReport)}`);
                        }

                        if (appShowHeartbeatReport.soc) {
                            this.batteryService.getCharacteristic(this.hap.Characteristic.BatteryLevel).updateValue(appShowHeartbeatReport.soc);
                            this.batteryService.getCharacteristic(this.hap.Characteristic.StatusLowBattery).updateValue(
                                appShowHeartbeatReport.soc > 10
                                    ? this.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL
                                    : this.hap.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
                            );
                        }

                        if (appShowHeartbeatReport.showFlag != undefined) {
                            this.outletAcL11.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL12.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL21.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL22.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcTt.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                            this.outletAcL14.getCharacteristic(this.hap.Characteristic.On).updateValue((appShowHeartbeatReport.showFlag & 4) == 4);
                        }
                        
                        if (appShowHeartbeatReport.outAcL11Pwr != undefined) {
                            this.outletAcL11.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL11Pwr != 0);
                            this.outletAcL11.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcL11Pwr);
                        }

                        if (appShowHeartbeatReport.outAcL12Pwr != undefined) {
                            this.outletAcL12.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL12Pwr != 0);
                            this.outletAcL12.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcL12Pwr);
                        }

                        if (appShowHeartbeatReport.outAcL21Pwr != undefined) {
                            this.outletAcL21.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL21Pwr != 0);
                            this.outletAcL21.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcL21Pwr);
                        }

                        if (appShowHeartbeatReport.outAcL22Pwr != undefined) {
                            this.outletAcL22.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL22Pwr != 0);
                            this.outletAcL22.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcL22Pwr);
                        }

                        if (appShowHeartbeatReport.outAcTtPwr != undefined) {
                            this.outletAcTt.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcTtPwr != 0);
                            this.outletAcTt.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcTtPwr);
                        }

                        if (appShowHeartbeatReport.outAcL14Pwr != undefined) {
                            this.outletAcL14.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAcL14Pwr != 0);
                            this.outletAcL14.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAcL14Pwr);
                        }

                        if (appShowHeartbeatReport.outAc5P8Pwr != undefined) {
                            this.outletAc5P8.getCharacteristic(this.hap.Characteristic.OutletInUse).updateValue(appShowHeartbeatReport.outAc5P8Pwr != 0);
                            this.outletAc5P8.getCharacteristic(EcoFlowCustomCharacteristics.WATTS_NAME)?.updateValue(appShowHeartbeatReport.outAc5P8Pwr);
                        }

                        break;
                    }

                    // BackendRecordHeartbeatReport
                    case 2: {
                        const backendRecordHeartbeatReport = BackendRecordHeartbeatReport.fromBinary(headerMessage.msg.pdata);

                        if (this.config.debug) {
                            this.log.debug(`BackendRecordHeartbeatReport (${serialNumber}) ${JSON.stringify(backendRecordHeartbeatReport)}`);
                        }

                        if (backendRecordHeartbeatReport.bmsInputWatts != undefined) {
                            this.batteryService.getCharacteristic(this.hap.Characteristic.ChargingState).updateValue(
                                backendRecordHeartbeatReport.bmsInputWatts == 0
                                    ? this.hap.Characteristic.ChargingState.NOT_CHARGING
                                    : this.hap.Characteristic.ChargingState.CHARGING);
                        }

                        if (backendRecordHeartbeatReport.outAcL11Amp != undefined) {
                            this.outletAcL11.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL11Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL11Vol != undefined) {
                            this.outletAcL11.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL11Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcL12Amp != undefined) {
                            this.outletAcL12.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL12Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL12Vol != undefined) {
                            this.outletAcL12.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL12Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcL21Amp != undefined) {
                            this.outletAcL21.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL21Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL21Vol != undefined) {
                            this.outletAcL21.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL21Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcL22Amp != undefined) {
                            this.outletAcL22.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL22Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL22Vol != undefined) {
                            this.outletAcL22.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL22Vol);
                        }

                        if (backendRecordHeartbeatReport.outAcTtAmp != undefined) {
                            this.outletAcTt.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcTtAmp);
                        }

                        if (backendRecordHeartbeatReport.outAcTtVol != undefined) {
                            this.outletAcTt.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcTtVol);
                        }

                        if (backendRecordHeartbeatReport.outAcL14Amp != undefined) {
                            this.outletAcL14.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL14Amp);
                        }

                        if (backendRecordHeartbeatReport.outAcL14Vol != undefined) {
                            this.outletAcL14.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAcL14Vol);
                        }

                        if (backendRecordHeartbeatReport.outAc5P8Amp != undefined) {
                            this.outletAc5P8.getCharacteristic(EcoFlowCustomCharacteristics.AMPS_NAME)?.updateValue(backendRecordHeartbeatReport.outAc5P8Amp);
                        }

                        if (backendRecordHeartbeatReport.outAc5P8Vol != undefined) {
                            this.outletAc5P8.getCharacteristic(EcoFlowCustomCharacteristics.VOLTS_NAME)?.updateValue(backendRecordHeartbeatReport.outAc5P8Vol);
                        }

                        break;
                    }

                    // AppParaHeartbeatReport
                    case 3: {
                        const appParaHeartbeatReport = AppParaHeartbeatReport.fromBinary(headerMessage.msg.pdata);

                        if (this.config.debug) {
                            this.log.debug(`AppParaHeartbeatReport (${serialNumber}) ${JSON.stringify(appParaHeartbeatReport)}`);
                        }

                        break;
                    }

                    // BpInfoReport
                    case 4: {
                        const bpInfoReport = BpInfoReport.fromBinary(headerMessage.msg.pdata);
                        
                        if (this.config.debug) {
                            this.log.debug(`BpInfoReport (${serialNumber}) ${JSON.stringify(bpInfoReport)}`);
                        }

                        break;
                    }
                }
            }
        }
    }
}

interface EcoFlowPluginConfig extends AccessoryConfig {
    email?: string;
    password?: string;
    serialNumber?: string;
    hideOutletAcL11?: boolean;
    hideOutletAcL12?: boolean;
    hideOutletAcL21?: boolean;
    hideOutletAcL22?: boolean;
    hideOutletAcTt?: boolean;
    hideOutletAcL14?: boolean;
    hideOutletAc5P8?: boolean;
    debug?: boolean;
}
