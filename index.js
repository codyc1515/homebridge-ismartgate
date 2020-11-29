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
    this.response = null;
    this.debug = config["debug"] || false;

    this.CurrentTemperature = null;
    this.BatteryLevel = null;

	// Set a timer to refresh the data every 10 minutes
	setInterval(function() {
		this._refresh();
	}.bind(this), 600000);

	// Set a timer to refresh the login token every 3 hours
	setInterval(function() {
		this._login();
	}.bind(this), 10800000);
}

iSmartGate.prototype = {

    identify: function(callback) {
        this.log("identify");
        callback();
    },

	getServices: function() {

		// Temperature Sensor service
		this.TemperatureSensor = new Service.TemperatureSensor(this.name);

		// Battery service
        this.BatteryService = new Service.BatteryService(this.name);

		// Accessory Information service
        this.AccessoryInformation = new Service.AccessoryInformation();
        this.AccessoryInformation
            .setCharacteristic(Characteristic.Name, this.name)
            .setCharacteristic(Characteristic.Manufacturer, "iSmartGate")
            .setCharacteristic(Characteristic.Model, "Temperature")
            .setCharacteristic(Characteristic.FirmwareRevision, "1.2.0")
            .setCharacteristic(Characteristic.SerialNumber, this.hostname);

		// Login for the first time and refresh
		setTimeout(function() {
			this._login();
		}.bind(this), 2500);

		// Return the Accessory
        return [
			this.AccessoryInformation,
            this.TemperatureSensor,
            this.BatteryService
        ];

    },

	_login: function() {
		request.post({
			url: "http://" + this.hostname + "/index.php",
			form: {
				"login": this.username,
				"pass": this.password,
				"send-login": "Sign in"
			},
			jar: cookieJar
		}, function(err, response, body) {
			if (!err && response.statusCode == 200) {
				if(this.debug) {this.log("Logged into iSmartGate");}

				// Save the login headers
				this.response = response;

				// Refresh the data
				this._refresh();
			}
			else {this.log("Could not login.", err, response, body);}
		}.bind(this));
	},

    _refresh: function() {
        if(this.debug) {this.log("Start refreshing temperature & battery");}

        request.get({
            url: "http://" + this.hostname + "/isg/temperature.php?door=1",
            header: this.response.headers,
            jar: cookieJar
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                try {body = JSON.parse(body);}
                catch(err) {
					if(body == "Restricted Access") {this.log("Login token expired.");}
					else {this.log("Could not connect.", "Check http://" + this.hostname + " to make sure the device is still reachable & no captcha is showing.");}
				}

                if(this.debug) {this.log("Successfully obtained temperature.", body);}

                // Find & set the CurrentTemperature
                this.CurrentTemperature = body[0] / 1000;
                this.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.CurrentTemperature);

                // Find the BatteryLevel
                switch (body[1]) {
                    case "full":    this.BatteryLevel = 100;    break;
                    case "80":      this.BatteryLevel = 80;     break;
                    case "60":      this.BatteryLevel = 60;     break;
                    case "40":      this.BatteryLevel = 40;     break;
                    case "20":      this.BatteryLevel = 20;     break;
                    case "low":     this.BatteryLevel = 10;     break;

                    default:
                        this.log("Unexpected BatteryLevel detected.", body[1], body);
                        this.BatteryLevel = 0;
                    break;
                }

                // Set the Status Low Battery
                if(this.BatteryLevel <= 10) {this.BatteryService.setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);}
                else {this.BatteryService.setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);}

                // Set the Battery Level
                this.BatteryService.setCharacteristic(Characteristic.BatteryLevel, this.BatteryLevel);
            }
            else {this.log("Could not connect.", err, response, body);}
        }.bind(this));
    },

    _getValue: function(CharacteristicName, callback) {
        if(this.debug) {this.log("GET", CharacteristicName);}
		callback(null);
    },

    _setValue: function(CharacteristicName, value, callback) {
        if(this.debug) {this.log("SET", CharacteristicName, value);}
        callback();
    }

};
