# Update
This plug-in is no longer supported. I am using Home Assistant now which has a native iSmartGate integration.

# homebridge-ismartgate
[Homebridge](https://github.com/nfarina/homebridge) plug-in for iSmartGate HomeKit devices to expose their Temperature & Battery services, which would otherwise be hidden.

## Things to know
* Supports only a single garage door / gate
* Only exposes the Temperature & Battery services, as the device already has HomeKit support for the Garage Door service. If you need a Garage Door service as well, take a look at the plug-in [homebridge-gogogate2](https://www.npmjs.com/package/homebridge-gogogate2).
* Only the iSmartGate Gate Lite is supported. While no other devices have been tested, I see no reason that they should not work.

### Legal
* Licensed under [MIT](LICENSE)
* This is not an official plug-in and is not affiliated with iSmartGate in any way
