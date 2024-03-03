
import { API, Characteristic, Formats, Perms } from 'homebridge';

export class EcoFlowCustomCharacteristics {
    public static readonly AMPS_NAME = "Amps";
    public static readonly AMPS_UUID = "E863F126-079E-48FF-8F27-9C2605A29F52";

    public static readonly VOLTS_NAME = "Volts";
    public static readonly VOLTS_UUID = "E863F10A-079E-48FF-8F27-9C2605A29F52";

    public static readonly WATTS_NAME = "Watts";
    public static readonly WATTS_UUID = "E863F10D-079E-48FF-8F27-9C2605A29F52";

    private readonly api: API;

    constructor(api: API) {
        this.api = api;
    }

    public Amps(): Characteristic {
        return new this.api.hap.Characteristic(
            EcoFlowCustomCharacteristics.AMPS_NAME,
            EcoFlowCustomCharacteristics.AMPS_UUID,
            {
                format: Formats.FLOAT,
                perms: [Perms.NOTIFY, Perms.PAIRED_READ],
                unit: "A"
            }
        );
    }

    public Volts(): Characteristic {
        return new this.api.hap.Characteristic(
            EcoFlowCustomCharacteristics.VOLTS_NAME,
            EcoFlowCustomCharacteristics.VOLTS_UUID,
            {
                format: Formats.FLOAT,
                perms: [Perms.NOTIFY, Perms.PAIRED_READ],
                unit: "V"
            }
        );
    }

    public Watts(): Characteristic {
        return new this.api.hap.Characteristic(
            EcoFlowCustomCharacteristics.WATTS_NAME,
            EcoFlowCustomCharacteristics.WATTS_UUID,
            {
                format: Formats.FLOAT,
                perms: [Perms.NOTIFY, Perms.PAIRED_READ],
                unit: "W"
            }
        );
    }
}
