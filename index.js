const request = require("request");

var Service,
    Characteristic;

var cookieJar = request.jar();

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;

    homebridge.registerAccessory("homebridge-ismartgate", "iSmartGate", iSmartGate);
};

function iSmartGate(log, config) {
    this.log = log;
    this.name = config["name"] || "iSmartGate Temperature";
    this.hostname = config["hostname"];
    this.username = config["username"];
    this.password = config["password"];
    this.debug = config["debug"] || false;

    this.CurrentTemperature = null;
    this.BatteryLevel = null;

    // Log us in & start running the capture process
    try {
        request.post({
            url: "http://" + config["hostname"] + "/index.php",
            form: {
                "login": config['username'],
                "pass": config['password'],
                "send-login": "Sign in"
            },
            jar: cookieJar
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                this.log("Logged into iSmartGate");

                setInterval(function() {
                    request.get({
                        url: "http://" + config["hostname"] + "/isg/temperature.php?door=1",
                        header: response.headers,
                        jar: cookieJar
                    }, function(err, response, body) {
                        if (!err && response.statusCode == 200) {
                            try {
                                body = JSON.parse(body);
                            }
                            catch {this.log("Could not process iSmartGate temperature. Check http://" + config["hostname"] + " and make sure the device is still reachable and no captcha is showing.");}

                            if(this.debug) {this.log("Obtained temperature", body);}

                            // Set the CurrentTemperature
                            this.CurrentTemperature = body[0] / 1000;
                            this.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.CurrentTemperature);

                            // Set the BatteryLevel
                            switch (body[1]) {
                                case "full":    this.BatteryLevel = 100;    break;
                                case 80:        this.BatteryLevel = 80;    break;
                                case 60:        this.BatteryLevel = 60;    break;
                                case 40:        this.BatteryLevel = 40;    break;
                                case 20:        this.BatteryLevel = 20;    break;
                                case "low":     this.BatteryLevel = 10;    break;

                                default:
                                    this.log("Unknown BatteryLevel detected", body[1], body);

                                    this.BatteryLevel = 0;
                                break;
                            }

                            if(this.BatteryLevel <= 10) {this.BatteryService.setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);}
                            else {this.BatteryService.setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);}

                            this.BatteryService.setCharacteristic(Characteristic.BatteryLevel, this.BatteryLevel);
                        }
                        else {this.log("Failed to get iSmartGate temperature", err, response, body);}
                    }.bind(this));
                }.bind(this), 5000);
            }
            else {this.log("Failed to login to iSmartGate", err, response, body);}
        }.bind(this));
    }
    catch(e) {this.log("An unknown error occured", e, );}
}

iSmartGate.prototype = {

    identify: function(callback) {
        this.log("identify");
        callback();
    },

    getServices: function() {
        this.TemperatureSensor = new Service.TemperatureSensor(this.name);
        this.TemperatureSensor
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this._getValue.bind(this, "CurrentTemperature"));

        this.BatteryService = new Service.BatteryService(this.name);
        this.BatteryService
            .getCharacteristic(Characteristic.BatteryLevel)
            .on('get', this._getValue.bind(this, "BatteryLevel"));

        this.TemperatureSensor.addLinkedService(this.BatteryService);

        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, "iSmartGate")
            .setCharacteristic(Characteristic.Model, "Temperature")
            .setCharacteristic(Characteristic.FirmwareRevision, "1.0.0")
            .setCharacteristic(Characteristic.SerialNumber, this.hostname);

        return [
            this.TemperatureSensor,
            this.BatteryService,
            this.informationService
        ];
    },

    _getValue: function(CharacteristicName, callback) {
        if(this.debug) {this.log("GET", CharacteristicName);}

        switch (CharacteristicName) {

            case "CurrentTemperature":  callback(null, this.CurrentTemperature);    break;
            case "BatteryLevel":        callback(null, this.BatteryLevel);          break;

            default:
                this.log("Unknown CharacteristicName called", CharacteristicName);
                callback();
            break;
        }
    },

    _setValue: function(CharacteristicName, stationId, value, callback) {
        if(this.debug) {this.log("SET", CharacteristicName, "Value", value, "Station", stationId);}

        this.log("Unknown CharacteristicName called", CharacteristicName);
        callback();
    }

};
