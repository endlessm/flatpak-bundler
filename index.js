'use strict';

var _ = require('lodash');
var path = require('path');
var util = require('util');

var promise = require('bluebird');
var fs = promise.promisifyAll(require('fs-extra'));
var exec = promise.promisify(require('child_process').exec);
var tmpdir = promise.promisify(require('tmp').dir);

function addCommandLineOption (args, name, value) {
    if (!value)
        return;
    args.push(util.format('--%s=%s', name, value));
}

function getOptionsWithDefaults (options) {
    return _.defaults({}, options, {
        branch: 'master',
        sdk: 'org.freedesktop.Sdk',
        runtime: 'org.freedesktop.Platform',
        finishArgs: [],
    });
}

function ensureDirectories (options) {
    var dirs = [];
    if (!options.buildDir) {
        dirs.push(tmpdir().then(function (dir) {
            options.buildDir = dir;
        }));
    } else {
        dirs.push(fs.removeAsync(options.buildDir));
    }
    if (!options.repoDir)
        dirs.push(tmpdir().then(function (dir) {
            options.repoDir = dir;
        }));
    return promise.all(dirs).then(function () {
        return options;
    });
}

function flatpakBuildInit (options) {
    var args = ['flatpak build-init'];
    addCommandLineOption(args, 'arch', options.arch);
    args.push(options.buildDir);
    args.push(options.id);
    args.push(options.sdk);
    args.push(options.runtime);
    args.push(options.runtimeVersion);
    return exec(args.join(' ')).then(function () {
        return options;
    });
}

function copyInFiles (options) {
    var copies = _.map(options.files, function (item) {
        var source = item[0];
        var dest = path.join(options.buildDir, 'files', item[1]);
        var destDir = dest.substring(0, dest.lastIndexOf(path.sep));
        return fs.mkdirsAsync(destDir).then(function() {
            return fs.copyAsync(source, dest);
        });
    });
    return promise.all(copies).then(function () {
        return options;
    });
}

function flatpakBuildFinish (options) {
    var args = ['flatpak build-finish'];
    addCommandLineOption(args, 'command', options.command);
    args.concat(options.finishArgs);
    args.push(options.buildDir);
    return exec(args.join(' ')).then(function () {
        return options;
    });
}

function flatpakBuildExport (options) {
    var args = ['flatpak build-export'];
    addCommandLineOption(args, 'arch', options.arch);
    addCommandLineOption(args, 'gpg-sign', options.gpgSign);
    addCommandLineOption(args, 'gpg-homedir', options.gpgHomedir);
    addCommandLineOption(args, 'subject', options.subject);
    addCommandLineOption(args, 'body', options.body);
    args.push(options.repoDir);
    args.push(options.buildDir);
    args.push(options.branch);
    return exec(args.join(' ')).then(function () {
        return options;
    });
}

function flatpakBuildBundle (options) {
    if (!options.bundlePath)
        return options;

    var args = ['flatpak build-bundle'];
    addCommandLineOption(args, 'arch', options.arch);
    addCommandLineOption(args, 'gpg-sign', options.gpgSign);
    addCommandLineOption(args, 'gpg-homedir', options.gpgHomedir);
    args.push(options.repoDir);
    args.push(options.bundlePath);
    args.push(options.id);
    args.push(options.branch);
    return exec(args.join(' ')).then(function () {
        return options;
    });
}

exports.bundle = function (options, callback) {
    if (!options.id) {
        callback(new Error('You need to specify an application id.'));
        return;
    }
    if (!options.files) {
        callback(new Error('You need to specify some application files.'));
        return;
    }

    options = getOptionsWithDefaults(options);

    ensureDirectories(options)
        .then(flatpakBuildInit)
        .then(copyInFiles)
        .then(flatpakBuildFinish)
        .then(flatpakBuildExport)
        .then(flatpakBuildBundle)
        .then(function (options) {
            callback(null, options);
        }, function (error) {
            callback(error);
        });
};
