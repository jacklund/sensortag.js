var btle = require('btle.js');
var events = require('events');
var util = require('util');

// Main object, returned as part of connect call
function SensorTag(conn) {
  this.connection = conn;
  this.calibration = [];
  events.EventEmitter.call(this);
}
util.inherits(SensorTag, events.EventEmitter);

// Connect to the sensortag
exports.connect = function(destination, callback) {
  btle.connect(destination, function(err, conn) {
    if (err) {
      if (callback) callback(err, null);
    }

    var tag = new SensorTag(conn);
    if (callback) callback(err, tag);

    return tag;
  });
}

// Read from the IR temperature
SensorTag.prototype.readTemperature = function(callback) {
  this.connection.addNotificationListener(0x25, function(err, buffer) {
    if (err) {
      callback(err, null);
    }

    // Calculations from http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#IR_Temperature_Sensor
    var ambient = buffer.readUInt16LE(2) / 128.0;
    var Vobj2 = buffer.readInt16LE(0) * 0.00000015625;
    var Tdie = ambient + 273.15;
    var S0 = 5.593E-14;	// Calibration factor
    var a1 = 1.75E-3;
    var a2 = -1.678E-5;
    var b0 = -2.94E-5;
    var b1 = -5.7E-7;
    var b2 = 4.63E-9;
    var c2 = 13.4;
    var Tref = 298.15;
    var S = S0*(1+a1*(Tdie - Tref)+a2*Math.pow((Tdie - Tref),2));
    var Vos = b0 + b1*(Tdie - Tref) + b2*Math.pow((Tdie - Tref),2);
    var fObj = (Vobj2 - Vos) + c2*Math.pow((Vobj2 - Vos),2);
    var tObj = Math.pow(Math.pow(Tdie,4) + (fObj/S),.25);

    var target = tObj - 273.15;

    callback(err, target, ambient);
  });

  // Write a 1 to handle 0x29 to turn on the thermometer
  buffer = new Buffer([1]);
  this.connection.writeCommand(0x29, buffer);

  // Write 0100 to handle 0x26 to turn on continuous readings from thermometer
  buffer = new Buffer([1, 0]);
  this.connection.writeCommand(0x26, buffer);
}

// Read from the Accelerometer
SensorTag.prototype.readAccelerometer = function(callback) {
  this.connection.addNotificationListener(0x2D, function(err, buffer) {
    if (err) {
      callback(err, null);
    }

    // Calculations from http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#Accelerometer_2
    var x = buffer.readInt8(0) / 64.0;
    var y = buffer.readInt8(1) / 64.0;
    var z = - buffer.readInt8(2) / 64.0;

    callback(err, x, y, z);
  });

  this.connection.writeCommand(0x31, new Buffer([1])); // Turn on accelerometer
  buffer = new Buffer([1, 0]);
  this.connection.writeCommand(0x2E, buffer);
}

// Read from the Humidity sensor
SensorTag.prototype.readHumidity = function(callback) {
  this.connection.addNotificationListener(0x38, function(err, buffer) {
    if (err) {
      callback(err, null);
    }

    // From http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#Humidity_Sensor_2
    var temp = -46.85 + 175.72/65536 * buffer.readInt16LE(0);
    var humidity = -6.0 + 125.0/65536 * (buffer.readUInt16LE(2) & ~0x0003)

    callback(err, temp, humidity);
  });

  this.connection.writeCommand(0x3C, new Buffer([1])); // Turn on humidity sensor
  buffer = new Buffer([1, 0]);
  this.connection.writeCommand(0x39, buffer);
}

// Read from the Magnetometer
SensorTag.prototype.readMagnetometer = function(callback) {
  this.connection.addNotificationListener(0x40, function(err, buffer) {
    if (err) {
      callback(err, null);
    }

    // From http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#Magnetometer
    var x = - buffer.readInt16LE(0) / (65536/2000);
    var y = - buffer.readInt16LE(2) / (65536/2000);
    var z = buffer.readInt16LE(4) / (65536/2000);

    callback(err, x, y, z);
  });

  this.connection.writeCommand(0x44, new Buffer([1])); // Turn on humidity sensor
  buffer = new Buffer([1, 0]);
  this.connection.writeCommand(0x41, buffer);
}

SensorTag.prototype.calibrateBarometer = function() {
  // Tell it to write the calibration factors
  this.connection.writeCommand(0x4F, new Buffer([2]));

  var self = this;
  this.connection.readHandle(0x52, function(err, buffer) {
    // Calibration factors
    self.calibration[0] = buffer.readUInt16LE(0);
    self.calibration[1] = buffer.readUInt16LE(2);
    self.calibration[2] = buffer.readUInt16LE(4);
    self.calibration[3] = buffer.readUInt16LE(6);
    self.calibration[4] = buffer.readInt16LE(8);
    self.calibration[5] = buffer.readInt16LE(10);
    self.calibration[6] = buffer.readInt16LE(12);
    self.calibration[7] = buffer.readInt16LE(14);
  });
}

// Read from the Barometer
SensorTag.prototype.readBarometer = function(callback) {
  this.calibrateBarometer();
  var self = this;

  // From http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#Barometric_Pressure_Sensor_2
  self.connection.addNotificationListener(0x4B, function(err, buffer) {
    if (err) {
      callback(err, null);
    }

    var rawTemp = buffer.readInt16LE(0);
    var rawPres = buffer.readUInt16LE(2);
        
    var temp = (100 * (self.calibration[0] * rawTemp / Math.pow(2,8) +
        self.calibration[1] * Math.pow(2,6))) / Math.pow(2,16) / 100;
    var S = self.calibration[2] + self.calibration[3] * rawTemp / Math.pow(2,17) +
        ((self.calibration[4] * rawTemp / Math.pow(2,15)) * rawTemp) / Math.pow(2,19);
    var O = self.calibration[5] * Math.pow(2,14) + self.calibration[6] * rawTemp / Math.pow(2,3) +
        ((self.calibration[7] * rawTemp / Math.pow(2,15)) * rawTemp) / Math.pow(2,4);
    var pres = (S * rawPres + O) / Math.pow(2,14) / 100;

    callback(err, pres, temp);
  });

  self.connection.writeCommand(0x4F, new Buffer([1])); // Turn on pressure sensor
  buffer = new Buffer([1, 0]);
  self.connection.writeCommand(0x4C, buffer);
}
