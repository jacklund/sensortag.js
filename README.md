sensortag.js
============

Node.js module for talking to the TI Sensortag. Requires the use of [btle.js](https://github.com/jacklund/btle.js).

## Requirements
You'll need a Linux system with some sort of Bluetooth LE capability. I'm using a Raspberry Pi with a USB Bluetooth LE dongle. You'll also need to have the [Bluez](http://www.bluez.org/) package and development files installed. My Raspberry Pi seemed to have everything already available, but you'll need to make sure your system does too. [This post](http://mike.saunby.net/2013/04/raspberry-pi-and-ti-cc2541-sensortag.html) was very helpful in getting me started up.

# Usage
To connect to a sensortag, you'll need to know it's destination address, which you can get by running the following command:

    $ sudo hcitool lescan

Once you have that, you can pass that into the `connect` method. See my `test.js` file for examples.