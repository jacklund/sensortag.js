var sensortag = require('./lib/sensortag');

if (process.argv.length < 3) {
  console.log("Usage: %s %s address", process.argv[0], process.argv[1]);
  console.log("  where address is the address of the sensortag as shown by, e.g., hcitool");
  process.exit(1);
}

var destination = process.argv[2];

sensortag.connect(destination, function(err, conn) {
  if (err) {
    console.log("Error: %s", err);
    process.exit(1);
  }

  conn.readTemperature(function(err, t1, t2) {
    if (err) {
      console.log(err);
    }

    console.log("Temp: %d, %d", t1, t2);
  });

  conn.readAccelerometer(function(err, x, y, z) {
    if (err) {
      console.log(err);
    }

    console.log("Accel: %d, %d, %d", x, y, z);
  });

  conn.readHumidity(function(err, temp, humidity) {
    if (err) {
      console.log(err);
    }

    console.log("Humidity: %d, %d", temp, humidity);
  });

  conn.readMagnetometer(function(err, x, y, z) {
    if (err) {
      console.log(err);
    }

    console.log("Magnet: %d, %d, %d", x, y, z);
  });

  conn.readBarometer(function(err, temp, pres) {
    if (err) {
      console.log(err);
    }

    console.log("Barometer: %d, %d", temp, pres);
  });
});
