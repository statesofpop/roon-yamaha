var NwBuilder = require('nw-builder');
var gulp = require('gulp');
var gutil = require('gulp-util');

// run app
gulp.task('nw', function () {
 
    var NwBuilder = require('nw-builder');
    var nw = new NwBuilder({
        files: ['./*', 'img/*', 'node_modules/**/**', '!cache/', '!build/'],
        platforms: ['YOUR_PLATFORM'],
        flavor: 'sdk',
        version: 'latest',
        macIcns: './img/app.icns'
    });

    //Log stuff

    nw.on('log',  console.log);

    // Build returns a promise
    nw.build().then(function () {
       console.log('all done!');
    }).catch(function (error) {
        console.error(error);
    });
});

// build
gulp.task('build', function () {
 
    var NwBuilder = require('nw-builder');
    var nw = new NwBuilder({
        files: ['./*', 'img/*', 'node_modules/**/**', '!config.json', '!gulpfile.js', '!cache/', '!build/'],
        platforms: ['osx64', 'linux64', 'win64', 'win32'],
        version: 'latest',
        flavor: 'normal',
        macIcns: './img/app.icns',
        winIco: './img/app.ico',
        zip: true
    });

    //Log stuff

    nw.on('log',  console.log);

    // Build returns a promise
    nw.build().then(function () {
       console.log('all done!');
    }).catch(function (error) {
        console.error(error);
    });
});
