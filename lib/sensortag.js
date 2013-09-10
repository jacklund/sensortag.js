var btle = require('btle.js');

function SensorTag(conn) {
  this.connection = conn;
}

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

SensorTag.prototype.readTemperature = function(callback) {
  this.connection.addNotificationListener(0x25, function(err, buffer) {
    if (err) {
      callback(err, null);
    }

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

SensorTag.prototype.readAccelerometer = function(callback) {
  this.connection.addNotificationListener(0x2D, function(err, buffer) {
    if (err) {
      callback(err, null);
    }

    var x = buffer.readInt8(0) / 64.0;
    var y = buffer.readInt8(1) / 64.0;
    var z = - buffer.readInt8(2) / 64.0;

    callback(err, x, y, z);
  });

  this.connection.writeCommand(0x31, new Buffer([1])); // Turn on accelerometer
  buffer = new Buffer([1, 0]);
  this.connection.writeCommand(0x2E, buffer);
}

SensorTag.prototype.readHumidity = function(callback) {
  this.connection.addNotificationListener(0x38, function(err, buffer) {
    if (err) {
      callback(err, null);
    }

    var temp = -46.85 + 175.72/65536 * buffer.readInt16LE(0);
    var humidity = -6.0 + 125.0/65536 * (buffer.readUInt16LE(2) & ~0x0003)

    callback(err, temp, humidity);
  });

  this.connection.writeCommand(0x3C, new Buffer([1])); // Turn on humidity sensor
  buffer = new Buffer([1, 0]);
  this.connection.writeCommand(0x39, buffer);
}

SensorTag.prototype.readMagnetometer = function(callback) {
  this.connection.addNotificationListener(0x40, function(err, buffer) {
    if (err) {
      callback(err, null);
    }

    var x = - buffer.readInt16LE(0) / (65536/2000);
    var y = - buffer.readInt16LE(2) / (65536/2000);
    var z = buffer.readInt16LE(4) / (65536/2000);

    callback(err, x, y, z);
  });

  this.connection.writeCommand(0x44, new Buffer([1])); // Turn on humidity sensor
  buffer = new Buffer([1, 0]);
  this.connection.writeCommand(0x41, buffer);
}

SensorTag.prototype.readBarometer = function(callback) {
  this.connection.writeCommand(0x4F, new Buffer([2])); // Grab calibration values
  var self = this;
  this.connection.readHandle(0x52, function(err, buffer) {
    var c1 = buffer.readInt16BE(0);
    var c2 = buffer.readInt16BE(2);
    var c3 = buffer.readInt16BE(4);
    var c4 = buffer.readInt16BE(6);
    var c5 = buffer.readInt16BE(8);
    var c6 = buffer.readInt16BE(10);
    var c7 = buffer.readInt16BE(12);
    var c8 = buffer.readInt16BE(14);

    self.connection.addNotificationListener(0x4B, function(err, buffer) {
      if (err) {
        callback(err, null);
      }

      m_raw_temp = buffer.readUInt16LE(0);

      val = ((c1 * m_raw_temp) * 100);
      temp = (val >> 24);
      val = (c2 * 100);
      temp += (val >> 10);
      temp = temp / 100;

      var Pr = buffer.readUInt16LE(2);
      Tr = m_raw_temp;

      // Sensitivity
      s = c3;
      val = c4 * Tr;
      s += (val >> 17);
      val = c5 * Tr * Tr;
      s += (val >> 34);

      // Offset
      o = c6 << 14;
      val = c7 * Tr;
      o += (val >> 3);
      val = c8 * Tr * Tr;
      o += (val >> 19);

      // Pressure (Pa)
      pres = ((s * Pr) + o) >> 14;
      pres = pres / 100;

      callback(err, temp, pres);
    });

    self.connection.writeCommand(0x4F, new Buffer([1])); // Turn on pressure sensor
    buffer = new Buffer([1, 0]);
    self.connection.writeCommand(0x4C, buffer);
  });
}
