# homebridge-ismartgate
[Homebridge](https://github.com/nfarina/homebridge) plug-in for iSmartGate HomeKit devices to expose their Temperature & Battery services, which would otherwise be hidden.

## Things to know
* Displays a single temperature value which is the average across the configured doors. Battery level is that of the sensor with the lowest level.
* Only exposes the Temperature & Battery services, as the device already has HomeKit support for the Garage Door service. If you need a Garage Door service as well, take a look at the plug-in [homebridge-gogogate2](https://www.npmjs.com/package/homebridge-gogogate2).
* Only the iSmartGate Gate Pro and Lite are supported. While no other devices have been tested, I see no reason that they should not work.

### Legal
* Licensed under [MIT](LICENSE)
* This is not an official plug-in and is not affiliated with iSmartGate in any way
