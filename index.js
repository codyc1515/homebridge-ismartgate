const request = require("request"),
      mdns = require('mdns-js');

var	  API,
	  Accessory,
	  Characteristic,
	  Service;

var cookieJar = request.jar();

module.exports = function(homebridge) {
	API = homebridge;
    Accessory = homebridge.hap.Accessory;
    Characteristic = homebridge.hap.Characteristic;
    Service = homebridge.hap.Service;

    homebridge.registerAccessory("homebridge-ismartgate", "iSmartGate", iSmartGate);
};

function iSmartGate(log, config) {
    this.log = log;
    this.name = config["name"] || "iSmartGate Temperature";
    this.username = config["username"];
    this.password = config["password"];
    this.response = null;

    this.CurrentTemperature = null;
    this.BatteryLevel = null;
}

iSmartGate.prototype = {

    identify: function(callback) {
        this.log.info("identify");
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
            .setCharacteristic(Characteristic.FirmwareRevision, "1.4.0")
            .setCharacteristic(Characteristic.SerialNumber, this.username);
		
		// Start searching for the iSmartGate using mDNS
		var browser = mdns.createBrowser("_hap._tcp");
		browser.on('ready', function() { browser.discover(); });
		browser.on('update', function(data) {
			if(data['txt']) {
				data['txt'].forEach(txt => {
					txt = txt.split("=");
					if(txt[0] == "md" && txt[1] == "iSmartGate") {
						// Set the new hostname obtained from mDNS
						this.hostname = data.addresses[0];
						this.log.info("Found an iSmartGate at", this.hostname);
					
						// Login to the iSmartGate for the first time and refresh
						setTimeout(function() {
							this._login();
						}.bind(this), 2500);
					}
				});
			}
		}.bind(this));
		
		// Set a timer to refresh the data every 10 minutes
		setInterval(function() {
			this._refresh();
		}.bind(this), 600000);

		// Set a timer to refresh the login token every 3 hours
		setInterval(function() {
			this._login();
		}.bind(this), 10800000);
	
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
				this.log.info("Logged into iSmartGate succesfully");

				// Save the login headers
				this.response = response;
				
				// Refresh the data
				this._refresh();
			}
			else {this.log.error("Could not login.", err, response, body);}
		}.bind(this));
	},

    _refresh: function() {
       this.log.debug("Start refreshing temperature & battery");

        request.get({
            url: "http://" + this.hostname + "/isg/temperature.php?door=1",
            header: this.response.headers,
            jar: cookieJar
        }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
                try {body = JSON.parse(body);}
                catch(err) {
					if(body == "Restricted Access") {this.log.error("Login token expired.");}
					else {this.log.error("Could not connect.", "Check http://" + this.hostname + " to make sure the device is still reachable & no captcha is showing.");}
				}

                this.log.debug("Obtained status.", body);

                // Find the CurrentTemperature
                this.CurrentTemperature = body[0] / 1000;

                // Find the BatteryLevel
                switch (body[1]) {
                    case "full":    this.BatteryLevel = 100;    break;
                    case "80":      this.BatteryLevel = 80;     break;
                    case "60":      this.BatteryLevel = 60;     break;
                    case "40":      this.BatteryLevel = 40;     break;
                    case "20":      this.BatteryLevel = 20;     break;
                    case "low":     this.BatteryLevel = 10;     break;

                    default:
                        this.log.warning("Unexpected BatteryLevel detected.", body[1], body);
                        this.BatteryLevel = 0;
                    break;
                }
			
				// Set the Current Temperature
                this.TemperatureSensor.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.CurrentTemperature);
			
                // Set the Battery Level
                this.BatteryService.setCharacteristic(Characteristic.BatteryLevel, this.BatteryLevel);

                // Set the Status Low Battery
                if(this.BatteryLevel <= 10) {this.BatteryService.setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW);}
                else {this.BatteryService.setCharacteristic(Characteristic.StatusLowBattery, Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);}
            }
            else {this.log.error("Could not connect.", err, response, body);}
        }.bind(this));
    },

    _getValue: function(CharacteristicName, callback) {
        this.log.debug("GET", CharacteristicName);
		callback(null);
    },

    _setValue: function(CharacteristicName, value, callback) {
        this.log.debug("SET", CharacteristicName, value);
        callback();
    }

};
