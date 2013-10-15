var btle = require('btle.js');
var events = require('events');
var util = require('util');

// Main object, returned as part of connect call
function SensorTag(device) {
  this.device = device;
  this.baromCalib = [];
  this.gyroCalib = [0, 0, 0];
  this.SelfTestValues = {
    IR_TEMP  : 0x01,
    HUMIDITY : 0x02,
    MAGNET   : 0x04,
    ACCEL    : 0x08,
    PRESSURE : 0x10,
    GYRO     : 0x20,
    SUCCESS  : 0x3F
  }
  events.EventEmitter.call(this);

  var self = this;
  device.on('error', function(err, device) {
    self.emit('error', err, self);
  });
}
util.inherits(SensorTag, events.EventEmitter);

// Connect to the sensortag
exports.connect = function(destination, callback) {
  btle.connect(destination, function(err, device) {
    if (err) {
      if (callback) callback(err, null);
    }

    var tag = new SensorTag(device);
    if (callback) callback(err, tag);

    return tag;
  });
}

// Read from the IR temperature
SensorTag.prototype.readTemperature = function(callback) {
  this.device.addNotificationListener(0x25, function(err, value) {
    if (err) {
      callback(err, null);
    }

    // Calculations from http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#IR_Temperature_Sensor
    var ambient = value.readUInt16LE(2) / 128.0;
    var Vobj2 = value.readInt16LE(0) * 0.00000015625;
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
  var buffer = new Buffer([1]);
  this.device.writeCommand(0x29, buffer);

  // Write 0100 to handle 0x26 to turn on continuous readings from thermometer
  buffer = new Buffer([1, 0]);
  this.device.writeCommand(0x26, buffer);
}

// Read from the Accelerometer
SensorTag.prototype.readAccelerometer = function(callback) {
  this.device.addNotificationListener(0x2D, function(err, value) {
    if (err) {
      callback(err, null);
    }

    // Calculations from http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#Accelerometer_2
    var x = value.readInt8(0) / 64.0;
    var y = value.readInt8(1) / 64.0;
    var z = - value.readInt8(2) / 64.0;

    callback(err, x, y, z);
  });

  this.device.writeCommand(0x31, new Buffer([1])); // Turn on accelerometer
  var buffer = new Buffer([1, 0]);
  this.device.writeCommand(0x2E, buffer);
}

// Read from the Humidity sensor
SensorTag.prototype.readHumidity = function(callback) {
  this.device.addNotificationListener(0x38, function(err, value) {
    if (err) {
      callback(err, null);
    }

    // From http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#Humidity_Sensor_2
    var temp = -46.85 + 175.72/65536 * value.readInt16LE(0);
    var humidity = -6.0 + 125.0/65536 * (value.readUInt16LE(2) & ~0x0003)

    callback(err, temp, humidity);
  });

  this.device.writeCommand(0x3C, new Buffer([1])); // Turn on humidity sensor
  var buffer = new Buffer([1, 0]);
  this.device.writeCommand(0x39, buffer);
}

// Read from the Magnetometer
SensorTag.prototype.readMagnetometer = function(callback) {
  this.device.addNotificationListener(0x40, function(err, value) {
    if (err) {
      callback(err, null);
    }

    // From http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#Magnetometer
    var x = - value.readInt16LE(0) / (65536/2000);
    var y = - value.readInt16LE(2) / (65536/2000);
    var z = value.readInt16LE(4) / (65536/2000);

    callback(err, x, y, z);
  });

  this.device.writeCommand(0x44, new Buffer([1])); // Turn on humidity sensor
  var buffer = new Buffer([1, 0]);
  this.device.writeCommand(0x41, buffer);
}

SensorTag.prototype.calibrateBarometer = function(callback) {
  // Tell it to write the baromCalib factors
  this.device.writeCommand(0x4F, new Buffer([2]));

  var self = this;
  this.device.readHandle(0x52, function(err, value) {
    if (err) return callback(err, null);

    // Calibration factors
    self.baromCalib[0] = value.readUInt16LE(0);
    self.baromCalib[1] = value.readUInt16LE(2);
    self.baromCalib[2] = value.readUInt16LE(4);
    self.baromCalib[3] = value.readUInt16LE(6);
    self.baromCalib[4] = value.readInt16LE(8);
    self.baromCalib[5] = value.readInt16LE(10);
    self.baromCalib[6] = value.readInt16LE(12);
    self.baromCalib[7] = value.readInt16LE(14);
    return callback(null, self);
  });
}

// Read from the Barometer
SensorTag.prototype.readBarometer = function(callback) {
  this.calibrateBarometer(function(err, self) {
    // From http://processors.wiki.ti.com/index.php/SensorTag_User_Guide#Barometric_Pressure_Sensor_2
    self.device.addNotificationListener(0x4B, function(err, value) {
      if (err) {
        callback(err, null);
      }

      var rawTemp = value.readInt16LE(0);
      var rawPres = value.readUInt16LE(2);
          
      var temp = (100 * (self.baromCalib[0] * rawTemp / Math.pow(2,8) +
          self.baromCalib[1] * Math.pow(2,6))) / Math.pow(2,16) / 100;
      var S = self.baromCalib[2] + self.baromCalib[3] * rawTemp / Math.pow(2,17) +
          ((self.baromCalib[4] * rawTemp / Math.pow(2,15)) * rawTemp) / Math.pow(2,19);
      var O = self.baromCalib[5] * Math.pow(2,14) + self.baromCalib[6] * rawTemp / Math.pow(2,3) +
          ((self.baromCalib[7] * rawTemp / Math.pow(2,15)) * rawTemp) / Math.pow(2,4);
      var pres = (S * rawPres + O) / Math.pow(2,14) / 100;

      callback(err, pres, temp);
    });

    self.device.writeCommand(0x4F, new Buffer([1])); // Turn on pressure sensor
    var buffer = new Buffer([1, 0]);
    self.device.writeCommand(0x4C, buffer);
  });
}

calcGyro = function(val) {
  return val / (65536 / 500);
}

SensorTag.prototype.calibrateGyroscope = function() {
  var self = this;
  this.device.writeCommand(0x5B, new Buffer([7]));
  setTimeout(function() {
    self.device.readHandle(0x57, function(err, value) {
      var rawY = value.readInt16LE(0);
      var rawX = value.readInt16LE(2);
      var rawZ = value.readInt16LE(4);

      self.gyroCalib = [-calcGyro(rawX), -calcGyro(rawY), calcGyro(rawZ)];
    });
  }, 500); // Configure gyroscope
}

SensorTag.prototype.readGyroscope = function(x, y, z, callback) {
  var self = this;
  this.device.addNotificationListener(0x57, function(err, value) {
    var rawY = value.readInt16LE(0);
    var rawX = value.readInt16LE(2);
    var rawZ = value.readInt16LE(4);

    var x = -calcGyro(rawX);
    var y = -calcGyro(rawY);
    var z = calcGyro(rawZ);

    callback(-calcGyro(rawX) - self.gyroCalib[0], -calcGyro(rawY) - self.gyroCalib[1], calcGyro(rawZ) - self.gyroCalib[2]);
  });

  var enable = 0;
  if (y) enable |= 1;
  if (x) enable |= 2;
  if (z) enable |= 4;
  this.device.writeCommand(0x5B, new Buffer([enable])); // Configure gyroscope
  var buffer = new Buffer([1, 0]);
  this.device.writeCommand(0x58, buffer); // Enable notification
}

SensorTag.prototype.checkPowerOnSelfTest = function(callback) {
  this.device.readHandle(0x64, function(err, value) {
    console.log("%s, %s", util.inspect(err), util.inspect(value));
    var bitmask = value.readUInt16LE(0);
    callback(bitmask);
  });
}
