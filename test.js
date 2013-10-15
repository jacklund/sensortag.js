var sensortag = require('./lib/sensortag');

if (process.argv.length < 3) {
  console.log("Usage: %s %s address", process.argv[0], process.argv[1]);
  console.log("  where address is the address of the sensortag as shown by, e.g., hcitool");
  process.exit(1);
}

var destination = process.argv[2];

sensortag.connect(destination, function(err, tag) {
  if (err) {
    console.log("Error: %s", err);
    process.exit(1);
  }

  tag.readTemperature(function(err, t1, t2) {
    if (err) {
      console.log(err);
    }

    console.log("Temp: %d, %d", t1, t2);
  });

  tag.readAccelerometer(function(err, x, y, z) {
    if (err) {
      console.log(err);
    }

    console.log("Accel: %d, %d, %d", x, y, z);
  });

  tag.readHumidity(function(err, temp, humidity) {
    if (err) {
      console.log(err);
    }

    console.log("Humidity: %d, %d", temp, humidity);
  });

  tag.readMagnetometer(function(err, x, y, z) {
    if (err) {
      console.log(err);
    }

    console.log("Magnet: %d, %d, %d", x, y, z);
  });

  tag.readBarometer(function(err, pres, temp) {
    if (err) {
      console.log(err);
    }

    console.log("Barometer: %d, %d", pres, temp);
  });

  tag.calibrateGyroscope();
  tag.readGyroscope(true, true, true, function(x, y, z) {
    console.log("Gyroscope: %d, %d, %d", x, y, z);
  });

  /*
  tag.checkPowerOnSelfTest(function(bitmask) {
    if (! bitmask & tag.SelfTestValues.IR_TEMP) console.log("IR temp failed");
    if (! bitmask & tag.SelfTestValues.HUMIDITY) console.log("Humidity failed");
    if (! bitmask & tag.SelfTestValues.MAGNET) console.log("Magnet failed");
    if (! bitmask & tag.SelfTestValues.ACCEL) console.log("Accelerometer failed");
    if (! bitmask & tag.SelfTestValues.PRESSURE) console.log("Barometer failed");
    if (! bitmask & tag.SelfTestValues.GYRO) console.log("Gyroscope failed");
    if (bitmask & tag.SelfTestValues.SUCCESS) console.log("Success!");
  });
  */

});
