var RoonApi = require("node-roon-api"),
    RoonApiStatus    = require("node-roon-api-status"),
    RoonApiSettings  = require("node-roon-api-settings"),
    RoonApiSourceControl = require("node-roon-api-source-control"),
    RoonApiVolumeControl = require("node-roon-api-volume-control"),
    Yamaha = require("node-yamaha-avr");

var roon = new RoonApi({
    extension_id:        'com.statesofpop.roon-yamaha',
    display_name:        "Yamaha Control",
    display_version:     "0.0.4",
    publisher:           'states of pop',
    email:               'hi@statesofpop.de',
    website:             'https://github.com/statesofpop/roon-yamaha'
});

var yamaha = {
    "default_device_name": "Yamaha",
    "default_input": "HDMI1",
    "volume": -50
};

var svc_status = new RoonApiStatus(roon);
var svc_volume = new RoonApiVolumeControl(roon);
var svc_source = new RoonApiSourceControl(roon);
var svc_settings = new RoonApiSettings(roon);

var mysettings = roon.load_config("settings") || {
    receiver_url: "",
    input:        yamaha.default_input,
    device_name:  yamaha.default_device_name
};

function makelayout(settings) {
    var l = {
        values:    settings,
        layout:    [],
        has_error: false
    };

    l.layout.push({
        type:    "string",
        title:   "Device name",
        subtitle: "Changing this might take some time to take effect.",
        setting: "device_name"
    });

    l.layout.push({
        type:    "dropdown",
        title:   "Input",
        values:  [
            // it should be possible to populate this list
            // with the actual inputs
            { title: "HDMI 1", value: "HDMI1" },
            { title: "HDMI 2", value: "HDMI2" },
            { title: "HDMI 3", value: "HDMI3" },
            { title: "HDMI 4", value: "HDMI4" },
            { title: "HDMI 5", value: "HDMI5" },
            { title: "HDMI 6", value: "HDMI6" }
        ],
        setting: "input"
    });

    let v = {
        type:    "string",
        title:   "Receiver IP",
        subtitle: "Your device should be recognized automatically. If not, please configure your receiver to use a fixed IP-address.",
        setting: "receiver_url"
    };

    // FIXME: eh, no this is not how it's done
    if (settings.receiver_url != "" && settings.receiver_url.length < 10) {
        v.error = "Please enter a valid IP-address";
        l.has_error = true; 
    }
    l.layout.push(v);

    return l;
}

var svc_settings = new RoonApiSettings(roon, {
    get_settings: function(cb) {
        cb(makelayout(mysettings));
    },
    save_settings: function(req, isdryrun, settings) {
        let l = makelayout(settings.values);
        req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

        if (!isdryrun && !l.has_error) {
            mysettings = l.values;
            svc_settings.update_settings(l);
            roon.save_config("settings", mysettings);
        }
    }
});



svc_status.set_status("Initialising", false);

function update_status() {
    if (yamaha.hid && yamaha.device_name) {
        svc_status.set_status("Found Yamaha " + yamaha.device_name + " at " + yamaha.ip, false);    
    } else if (yamaha.hid && yamaha.ip) {
        svc_status.set_status("Found Yamaha device at " + yamaha.ip, false);    
    } else if (yamaha.hid) {
        svc_status.set_status("Found Yamaha device. Discovering…", false);    
    } else {
        svc_status.set_status("Could not find Yamaha device.", true)
    }
}

function setup_yamaha() {
    if (yamaha.hid) {
        yamaha.hid = undefined;
    }
    if (yamaha.source_control) { yamaha.source_control.destroy(); delete(yamaha.source_control); }
    if (yamaha.svc_volume) { yamaha.svc_volume.destroy();   delete(yamaha.svc_volume);   }

    yamaha.hid = new Yamaha();
    yamaha.hid.discover().then(function(ip){
        yamaha.ip = ip;
        update_status();
    }).catch(function (error){
        yamaha.hid = undefined;
        svc_status.set_status("Could not find Yamaha device.", true)
    });
    
    try {
        if (mysettings.device_name == yamaha.default_device_name) {
            yamaha.hid.getSystemConfig().then(function(config) {
              mysettings.device_name = config["YAMAHA_AV"]["System"][0]["Config"][0]["Model_Name"][0];
              update_status();
            })
        }
    } catch(e) {
        // getting the device name is not critical, so let's continue
    }

    yamaha.svc_volume = svc_volume.new_device({
        state: {
            display_name: mysettings.device_name,
            volume_type:  "db",
            volume_min:   -87.5,
            volume_max:   -20,
            volume_value: -50,
            volume_step:  0.5,
            is_muted:     0
        },
        set_volume: function (req, mode, value) {
          let newvol = mode == "absolute" ? value : (yamaha.volume + value);
          if      (newvol < this.state.volume_min) newvol = this.state.volume_min;
          else if (newvol > this.state.volume_max) newvol = this.state.volume_max;
          yamaha.hid.setVolume( value * 10 ); // node-yamaha-avr sends full ints
          yamaha.svc_volume.update_state({ volume_value: newvol });
          req.send_complete("Success");
        },
        set_mute: function (req, action) {
            let is_muted = !this.state.is_muted;
            yamaha.hid.setMute( (is_muted)? "on": "off" )
            yamaha.svc_volume.update_state({ is_muted: is_muted });
            req.send_complete("Success");
        }

    });

    yamaha.source_control = svc_source.new_device({
        state: {
            display_name: mysettings.device_name,
            supports_standby: true,
            status: "selected",
        },
        convenience_switch: function (req) {
            yamaha.hid.setInput(mysettings.input);
            req.send_complete("Success");
        },
        standby: function (req) {
            this.state.status = "standby";
            yamaha.hid.setPower("on");
            req.send_complete("Success");
        }
    });
}

roon.init_services({
    provided_services: [ svc_status, svc_settings, svc_volume, svc_source ]
});

setInterval(() => { if (!yamaha.hid) setup_yamaha(); }, 1000);

roon.start_discovery();

