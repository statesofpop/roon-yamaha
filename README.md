# roon-yamaha
a roon extension to control yamaha's network-enabled av receivers

### why?

on fixed-volume connections (like hdmi) this extension lets
you access the receiver's volume and mute controls.

### how to use

i recommend checking roon's docs on how and where to run extensions
first. should work with node.js >= 7.5.0.

### known issues

* dragging volume slider leads to 'random' volume changes on the device
* manual ip-address not used
* two instances seem to be created
* too little error handling
* source-control (standby on)

### improvements / to do

* reflect volume and other status changes on receiver in roon


### thanks / credits

https://github.com/ttu/node-yamaha-avr

https://github.com/RoonLabs/node-roon-api
