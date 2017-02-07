var RoonApi = require("node-roon-api"),
    RoonApiStatus    = require("node-roon-api-status"),
    RoonApiSettings  = require("node-roon-api-settings"),
    RoonApiSourceControl = require("node-roon-api-source-control"),
    RoonApiVolumeControl = require("node-roon-api-volume-control"),
    Yamaha = require("node-yamaha-avr");

var roon = new RoonApi({
    extension_id:        'com.statesofpop.roon-yamaha',
    display_name:        "Yamaha Control",
    display_version:     "0.0.7",
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

var volTimeout = null;

var mysettings = roon.load_config("settings") || {
    receiver_url: "",
    input:        yamaha.default_input,
    device_name:  yamaha.default_device_name,
    input_list:   [
        { title: "HDMI 1", value: "HDMI1" },
        { title: "HDMI 2", value: "HDMI2" },
        { title: "HDMI 3", value: "HDMI3" },
        { title: "HDMI 4", value: "HDMI4" },
        { title: "HDMI 5", value: "HDMI5" },
        { title: "HDMI 6", value: "HDMI6" }
    ]
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
        values:   mysettings.input_list,
        setting: "input"
    });

    let v = {
        type:    "string",
        title:   "Receiver IP",
        subtitle: "Your device should be recognized automatically. If not, please configure your receiver to use a fixed IP-address.",
        setting: "receiver_url"
    };

    if (settings.receiver_url != "" && settings.receiver_url.match(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/) === null) {
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

function check_status() {
    if (yamaha.hid) {
        yamaha.hid.getStatus()
        .then( (result) => {
            // exit if a change through roon is in progress
            if (volTimeout) return;
            // this seems to only get called on success
            let vol_status = result["YAMAHA_AV"]["Main_Zone"][0]["Basic_Status"][0]["Volume"][0];
            // should get current state first, to see if update is necessary
            yamaha.svc_volume.update_state({
                volume_value: vol_status["Lvl"][0]["Val"] / 10,
                is_muted: (vol_status["Mute"] == "On")
            });
            update_status()
        })
        .catch( (error) => {
            // this seems not to get called when device is offline
            yamaha.hid == "";
            svc_status.set_status("Could not find Yamaha device.", true);
        });
    }
}

function setup_yamaha() {
    if (yamaha.hid) {
        yamaha.hid = undefined;
    }
    if (yamaha.source_control) {
        yamaha.source_control.destroy();
        delete(yamaha.source_control);
    }
    if (yamaha.svc_volume) {
        yamaha.svc_volume.destroy();
        delete(yamaha.svc_volume);
    }

    yamaha.hid = new Yamaha(mysettings.receiver_url);
    // should check whether the device is behind the given url
    // only then start to discover.
    yamaha.hid.discover()
    .then( (ip) => {
        yamaha.ip = ip;
        update_status();
    })
    .catch( (error) => {
        yamaha.hid = undefined;
        svc_status.set_status("Could not find Yamaha device.", true)
    });
    
    try {
        yamaha.hid.getSystemConfig().then(function(config) {
            if (mysettings.device_name == yamaha.default_device_name) {
                mysettings.device_name = config["YAMAHA_AV"]["System"][0]["Config"][0]["Model_Name"][0];
            }
            let inputs = config["YAMAHA_AV"]["System"][0]["Config"][0]["Name"][0]["Input"][0];
            mysettings.input_list = [];
            for (let key in inputs) {
                mysettings.input_list.push({
                    "title": inputs[key][0].trim(),
                    "value": key.replace("_", "")
                })
            }
            update_status();
        })
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
            yamaha.svc_volume.update_state({ volume_value: newvol });
            clearTimeout(volTimeout);
            volTimeout = setTimeout(() => {
                // node-yamaha-avr sends full ints
                yamaha.hid.setVolume( value * 10 );
                clearTimeout(volTimeout);
                volTimeout = null;
            }, 500)
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
            let state = this.state.status;
            this.state.status = (state == "selected")? "standby": "selected";
            yamaha.hid.setPower((state == "selected")? "off": "on");
            req.send_complete("Success");
        }
    });
}

roon.init_services({
    provided_services: [ svc_status, svc_settings, svc_volume, svc_source ]
});

setInterval(() => { if (!yamaha.hid) setup_yamaha(); }, 1000);
setInterval(() => { if (yamaha.hid) check_status(); }, 5000);

roon.start_discovery();

