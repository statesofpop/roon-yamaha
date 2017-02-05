# roon-yamaha
a roon extension to control yamaha's network-enabled av receivers

### why?

on fixed-volume connections (like hdmi) this extension let's
you access the receiver's volume and mute controls.

### how to use

i recommend checking roon's docs on how and where to run extensions
first. should work with node.js >= 7.5.0.

### known issues

* source-control (standby on/off) not actually functional yet
* little error handling
* manual ip-address not validated
* two instances seem to be created

### improvements / to do

* populate input list from receiver config instead of static list
* reflect volume and other status changes on receiver in roon
