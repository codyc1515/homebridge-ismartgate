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
    this.doors = config["doors"];
    this.response = null;
    this.debug = config["debug"] || false;

    this.currentDoor = 1;
    this.CurrentTemperatures = [];
    this.AverageTemperature = null;
    this.BatteryLevel = 100;

    // Log us in & start running the capture process
    try {this._login(true);}
    catch(err) {this.log("An unknown error occured", err);}
}

iSmartGate.prototype = {

    identify: function(callback) {
        this.log("identify");
        callback();
    },

    _login: function(firstLoad) {
        request.post({
            url: "http://" + this.hostname + "/index.php",
            form: {
                "login": this.username,
                "pass": this.password,
                "sesion-abierta": 1,
                "send-login": "Sign in"
            },
            jar: cookieJar
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                this.log("Logged into iSmartGate");

                // Save the login headers
                this.response = response;

                // Get the data initially
                this._refresh();

                // Refresh periodically (every minute)
                if(firstLoad) {setInterval(function() {this._refresh();}.bind(this), 60000);}
            }
            else {this.log("Could not login.", err, response, body);}
        }.bind(this));
    },

    _refresh: function() {
        if(this.debug) {this.log("Start refreshing temperature & battery for door " + this.currentDoor);}

        request.get({

            url: "http://" + this.hostname + "/isg/temperature.php?door=" + this.currentDoor,
            header: this.response.headers,
            jar: cookieJar
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                var index = this.currentDoor - 1;

                try {body = JSON.parse(body);}
                catch(err) {
                    if(body == "Restricted Access") {
                        this.log("Login token expired, refreshing...");
                        this._login();
                    }
                    else {this.log("Could not connect.", "Check http://" + this.hostname + " to make sure the device is still reachable & no captcha is showing.");}
                }

                if(this.debug) {this.log("Succesfully obtained temperature. for door " + this.currentDoor, body);}

                // Find & set the Average Temperature
                this.CurrentTemperatures[index] = parseInt(body[0], 10);
                var totalTempX1K = this.CurrentTemperatures.reduce((a, b) => a + b)
                this.AverageTemperature = (totalTempX1K / this.CurrentTemperatures.length) / 1000

                this.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.AverageTemperature);

                // Find the BatteryLevel
                var batteryLevel = null;
                switch (body[1]) {
                    case "full":    batteryLevel = 100;    break;
                    case "80":      batteryLevel = 80;     break;
                    case "60":      batteryLevel = 60;     break;
                    case "40":      batteryLevel = 40;     break;
                    case "20":      batteryLevel = 20;     break;
                    case "low":     batteryLevel = 10;     break;

                    default:
                        this.log("Unexpected BatteryLevel detected on door " + this.currentDoor, body[1], body);
                        batteryLevel = 0;
                    break;
                }
                if (this.debug) {this.log("BatteryLevel on door " + this.currentDoor + ": ", body[1], body);}
                if (batteryLevel < this.BatteryLevel) {
                    this.BatteryLevel = batteryLevel
                }

                // Set the Status Low Battery
                if(this.BatteryLevel <= 10) {
                    this.log("Battery level on door " + this.currentDoor + " is low.")
                    this.BatteryService.setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);
                }
                else {
                    this.BatteryService.setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
                }

                // Set the Battery Level
                this.BatteryService.setCharacteristic(Characteristic.BatteryLevel, this.BatteryLevel);

                if (this.currentDoor == this.doors) {
                    this.currentDoor = 1;
                } else {
                    this.currentDoor += 1;
                }

            }
            else {this.log("Could not connect.", err, response, body);}
        }.bind(this));
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
            .setCharacteristic(Characteristic.FirmwareRevision, "1.2.0")
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

            case "CurrentTemperature":  callback(null, this.AverageTemperature);    break;
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
