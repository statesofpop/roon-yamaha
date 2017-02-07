var gui = require('nw.gui');

// Create a tray icon
var tray;
if (navigator.userAgent.indexOf("Mac OS") > -1) {
    // use a vector later on
    tray = new nw.Tray({ icon: 'img/tray.png', iconsAreTemplates: true });
} else {
    tray = new nw.Tray({ icon: 'img/tray.png' });
}

// Give it a menu
var menu = new nw.Menu();

// For now, only quit is needed
menu.append(new nw.MenuItem({ 
    type: 'normal',
    label: 'Quit Roon Yamaha Control',
    click: function() {
        gui.App.closeAllWindows();
        gui.App.quit();
    }
}));
tray.menu = menu;
