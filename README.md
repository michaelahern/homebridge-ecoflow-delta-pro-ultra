# Homebridge EcoFlow DELTA Pro Ultra

A [Homebridge](https://homebridge.io) plugin for [EcoFlow DELTA Pro Ultra](https://www.ecoflow.com/us/delta-pro-ultra) devices.

> This plugin has been demised due to changes EcoFlow has made to their Private API that prevents usage outside of their apps. Please see [@pietrolubini/homebridge-ecoflow](https://github.com/PietroLubini/homebridge-ecoflow) for a Homebridge plugin that is implemented using the more recent and publicly available [EcoFlow IoT Developer Platform](https://developer.ecoflow.com/).

## Requirements

- [Homebridge](https://homebridge.io/)
- One or more supported [EcoFlow DELTA Pro Ultra](https://www.ecoflow.com/us/delta-pro-ultra) devices

## Configuration

Example accessory config in the Homebridge config.json:

```json
"accessories": [
  {
    "accessory": "EcoFlow DELTA Pro Ultra",
    "name": "Home Power Backup",
    "email": "you@gmail.com",
    "password": "password",
    "serialNumber": "Y711ABCDEF123456",
    "hideOutletAcL11": false,
    "hideOutletAcL12": false,
    "hideOutletAcL21": false,
    "hideOutletAcL22": false,
    "hideOutletAcTt": false,
    "hideOutletAcL14": false,
    "hideOutletAc5P8": false,
    "debug": false
  }
]
```

### Configuration Details

Field               | Description
--------------------|------------
**accessory**       | (required) Must be "EcoFlow DELTA Pro Ultra"
**name**            | (required) Name for the device in HomeKit
**email**           | (required) EcoFlow Account Email
**password**        | (required) EcoFlow Account Password
**serialNumber**    | (required) EcoFlow DELTA Pro Ultra Serial Number
**hideOutletAcL11** | (optional) Hide Outlet AC 20A (Backup UPS 1)
**hideOutletAcL12** | (optional) Hide Outlet AC 20A (Backup UPS 2)
**hideOutletAcL21** | (optional) Hide Outlet AC 20A (Online UPS 1)
**hideOutletAcL22** | (optional) Hide Outlet AC 20A (Online UPS 2)
**hideOutletAcTt**  | (optional) Hide Outlet AC 30A 120V
**hideOutletAcL14** | (optional) Hide Outlet AC 30A 120V/240V
**hideOutletAc5P8** | (optional) Hide Power Input/Output Port
**debug**           | (optional) Enable debug logging, disabled by default

## Notes

 * This plugin is still experimental!
 * Only Battery and AC Outlet services are supported for read-only operations at the moment (i.e. there's no ability to turn AC Outlets on/off).
 * AC Outlet real-time electrical data (e.g. Voltage, Amps, Watts) are not visible in the Apple Home app, but are visible within some third-party HomeKit apps, including [Eve](https://www.evehome.com/en-us/eve-app) and [Home+](https://hochgatterer.me/home+/).
 