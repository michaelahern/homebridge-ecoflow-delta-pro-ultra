import axios from "axios";
import mqtt from "mqtt";
import { v4 as uuidv4 } from "uuid";

export class EcoflowApi {
    public async connectMqttAsync(email: string, password: string) {
        const loginResponse = await this.loginAsync(email, password);

        if (loginResponse.data) {
            const mqttResponse = await this.mqttTokenExchangeAsync(loginResponse.data?.token);
            
            if (mqttResponse.data) {
                return await mqtt.connectAsync(`${mqttResponse.data?.protocol}://${mqttResponse.data.url}:${mqttResponse.data.port}`, {
                    username: `${mqttResponse.data.certificateAccount}`,
                    password: `${mqttResponse.data.certificatePassword}`,
                    clientId: `ANDROID_${uuidv4().toUpperCase()}_${loginResponse.data.user.userId}`,
                    protocolVersion: 5
                });
            }
            else {
                throw new Error("EcoFlow MQTT Token Exchange Error: Missing Field 'data'");
            }
        }
        else {
            throw new Error("EcoFlow Login Error: Missing Field 'data'");
        }
    }

    public async loginAsync(email: string, password: string) {
        const data = {
            email: email,
            password: Buffer.from(password).toString("base64"),
            scene: "IOT_APP",
            userType: "ECOFLOW"
        };

        const config = {
            headers: {
                "Content-Type": "application/json",
                "Lang": "en-US"
            }
        }
        
        const response = await axios.post<EcoflowApiLoginResponse>("https://api.ecoflow.com/auth/login", data, config);

        if (response.data.code != 0) {
            throw new Error(`EcoFlow Login Error ${response.data.code}: ${response.data.message}`);
        }

        return response.data;
    }

    public async mqttTokenExchangeAsync(token: string) {
        const config = {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Lang": "en-US"
            }
        }

        const response = await axios.get<EcoflowApiMqttTokenExchangeResponse>("https://api.ecoflow.com/iot-auth/app/certification", config);

        if (response.data.code != 0) {
            throw new Error(`EcoFlow MQTT Token Exchange Error ${response.data.code}: ${response.data.message}`);
        }

        return response.data;
    }
}

export interface EcoflowApiLoginResponse {
    code: number;
    message: string;
    data?: {
        user: {
            userId: string,
            email: string,
            name: string,
        },
        token: string
    }
}

export interface EcoflowApiMqttTokenExchangeResponse {
    code: number;
    message: string;
    data?: {
        url: string,
        port: string,
        protocol: string,
        certificateAccount: string,
        certificatePassword: string
    }
}
