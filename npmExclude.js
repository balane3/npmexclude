'use strict';

// TODO:
// - npm update modifies the version numbers, you overwrite that when restoring the file
// - get module folder from npm?
// - better usage message

var os = require('os');
var fs = require('fs');
var path = require('path');
var mv = require('mv');
var Q = require('q');
var debug = require('debug')('npmexclude:debug');
var info = require('debug')('npmexclude:info');

var npmexclude = (function() {

    /**
     * Object to be returned. Bolt publicly-accessible functions and variables
     * onto this.
     */
    var module = {};

    // Default settings
    var packageJsonPath = path.resolve('./package.json');
    // TODO get from npm config?
    var npmModuleFolder = path.resolve('./node_modules');
    var tmpFolder = path.join(os.tmpdir(), 'npmExclude');
    var excludeModules = [];
    var npmArgs = [ '--loglevel warn' ];
    var npmCommand = 'install';

    /**
     * 
     */
    module.run = function(argv) {
        var json_orig;
        var tmpModuleDirs;

        Q.longStackSupport = true;
        //Q.onerror = true;
        
        // Process arguments first
        try {
            processCliArgs(argv);
            info("Processed the arguments.");
        } catch (err) {
            info("An error was thrown processing the arguments.");
            // Need to return a promise
            var deferred = Q.defer();
            deferred.reject(new Error(err));
            return deferred.promise;
        }
        
        // Do everything else
        var promise = Q.allSettled([
                // Get the directory pathnames then move the dirs
                getModuleDirs(npmModuleFolder, excludeModules)
                .then(function(moduleDirs) {
                    info("Retrieved the module directories.");
                    return moveFolders(moduleDirs, tmpFolder)
                    .then(function(dirs) { 
                        info("The module directories have been moved.");
                        tmpModuleDirs = dirs;
                    });
                }), 
                // Save original package.json to memory then overwrite the file
                Q.nfcall(fs.readFile, packageJsonPath, 'utf8')
                .then(function(json) {
                    json_orig = json;
                    info("The original package.json file has been saved in memory.");
                    return removeModulesFromPackageJson(excludeModules, packageJsonPath);
                })
        ])
        .then(function(promises) {
            info("Preparing to execute the npm command.");
            return Q.fcall(npmExec, process.cwd(), npmCommand, npmArgs)
            .then(function(value) {
                info("The npm command has been executed.");
                return value;
            });
        })
        .fin(function restore() {
            info("Restoring.");
            var promise = Q.allSettled([ 
                // Save the original package.json back to the file
                Q.fcall(function restorePackageJson() {
                    debug("restorePackageJson: entered finally portion of promise");
                    if (json_orig !== undefined) {
                        info("Restoring the original package.json file.");
                        return Q.nfcall(fs.writeFile, packageJsonPath, json_orig)
                        .then(function(value) {
                            info("package.json has been restored.");
                            return value;
                        });
                    }
                    // As long as no error is thrown, return value doesn't matter 
                    return true;
                }),
                // Move the folders back from the tmp directory
                Q.fcall(function restoreFolders() {
                    debug("restoreFolders: entered finally portion of promise");
                    if (tmpModuleDirs !== undefined) {
                        info("Moving the module folders back to the npm module directory.");
                        return moveFolders(tmpModuleDirs, npmModuleFolder)
                        .then(function(value) {
                            info("The module folders have been moved back.");
                            return value;
                        });
                    }
                    // As long as no error is thrown, return value doesn't matter 
                    return true;
                }) 
            ]);
            return promise;
        })
        .then(function (success) {
            info(success);
            info("npmexclude has successfully exectued.");
            return success;
        }, function (err) {
            info("npmexclude has thrown an error with the message: " + err.message);
            return err;
        });
        
        return promise;
    };

    var processCliArgs = function(argv) {
        debug("processCliArgs: entered function");
        var usage = "Usage: [ -v ][--update | --production ] [ --moduleDir=/path/to/node_modules ] [ --tmpDir=/path/to/tmpDir ] module1 module2 ...";
        
        if (argv.length <= 2 || argv.indexOf("-h") !== -1 || argv.indexOf("--help") !== -1) {
            throw new Error(usage);
        }

        // Get the command line arguments
        argv.forEach(function loop(val, index) {
            // Skip node and the name of the script
            if (index <= 1) {
                return;
            }

            // --install
            if (val === '--install' || val === '-i') {
                // This is the default, but including it for completeness
                npmCommand = 'install';
            } else
            // --update
            if (val === '--update' || val === '-u') {
                npmCommand = 'update';
            } else
            // --production
            if (val === '--production') {
                npmArgs.push('--production');
            } else
            // module
            if (val.substring(0, 2) !== '--') {
                excludeModules.push(val);
            } else
            // --moduleDir=/path/to/node_modules
            if (val.substring(0, 12) === '--moduleDir=') {
                npmModuleFolder = val.substring(12);
            } else
            // --tmpDir=/path/to/tmpDir
            if (val.substring(0, 9) === '--tmpDir=') {
                tmpFolder = val.substring(9);
            } else
            // -v
            if (val === '-v') {
                var i = npmArgs.indexOf('--loglevel warn');
                npmArgs.splice(i, 1);
            } else {
                // anything else is invalid
                throw new Error(usage);
            }
        });

        // Error check the combinations of args and their values

        // --production cannot be used with --update
        if (npmCommand === 'command' && npmArgs.indexOf('--production') !== -1) {
            throw new Error(usage);
        }

        debug("processCliArgs: leaving function");
        return true;
    };
    
    var getModuleDirs = function(npmModuleDir, modules) {
        debug("getModuleDirs: entered function");
        
        var foldersPromise = Q.all(modules.map(function(module) {
            // Only add it to the array if it exists
            var dir = path.resolve(npmModuleDir + '/' + module);
            var promise = Q.nfcall(fs.lstat, dir)
            .then(function(stats) {
                if (stats.isDirectory()) {
                    return dir;
                }
            }, function error(err) {
                debug("getModuleDirs: Could not find the " + module + " module directory. Searched for " + dir);
                // Don't throw exception, we'll just skip that module
                return '';
            });
            return promise;
        }));
        
        debug("getModuleDirs: leaving function");
        return foldersPromise;
    };

    var moveFolders = function(folders, dest) {
        debug("moveFolders: entered function");
        // folders should be an array
        if (typeof folders === 'string') {
            folders = [ folders ];
        }
        
        // Resolved promise is an array of destFolders
        var foldersPromise = Q.all(folders.map(function(folder) {
            var deferred = Q.defer();
            
            // Get the name of the folder and it to the destination path
            var basename = path.basename(folder);
            var destFolder = path.resolve(dest + "/" + basename);
            
            if (folder === '' || typeof folder !== 'string') {
                // TODO reject instead?
                deferred.resolve();
                return deferred.promise;
            }
            
            mv(folder, destFolder, {mkdirp: true}, function(err) {
               if (err) {
                   deferred.reject(new Error(err));
               } else {
                   deferred.resolve(destFolder);
               }
            });
            
            return deferred.promise;
        }));
        debug("moveFolders: leaving function");
        return foldersPromise;
    };

    var npmExec = function(cwd, command, args, stdout, stderr) {
        debug("npmExec: entered function");
        // args is an optional argument
        if (args === undefined) {
            args = [];
        } else if (!Array.isArray(args)) {
            throw new Error("args must be an array.");
        }
        // stdout is an optional argument
        if (stdout === undefined) {
            stdout = process.stdout;
        }
        // stderr is an optional argument
        if (stderr === undefined) {
            stderr = process.stderr;
        }

        // assume command is successful
        var success = true;

        command = 'npm ' + command;
        args.forEach(function(arg) {
            command += ' ' + arg;
        });

        debug("npmExec: Executing " + command);
        // Install the other modules
        try {
            var output = require('child_process').execSync(command, {
                'cwd' : cwd,
                encoding : 'utf8',
                stdio : [ 0, stdout, stderr ]
            });
        } catch (err) {
            debug("npmExec: The command " + command + " exited with a non-zero exit code.");
            err.options = "Options removed from output for brevity.";
            err.envPairs = "Envpairs removed from output for brevity.";
            debug("npmExec: " + err);
            success = false;
        }

        debug("npmExec: leaving function");
        return success;
    };

    var removeModulesFromPackageJson = function(modules, filepath) {
        debug("removeModulesFromPackageJson: entered function");
        // Remove the modules from the package file
        var promise = Q.nfcall(fs.readFile, packageJsonPath, 'utf8')
        .then(function removeModules(json) {
            modules.forEach(function(module) {
                // TODO comma is optional
                var re = new RegExp('"' + module + '"' + ': .*",\\s');
                json = json.replace(re, "\n");
            });
            // Save the file
            debug("removeModulesFromPackageJson: returning promise to save file");
            return Q.nfcall(fs.writeFile, filepath, json)
            .then(function() { 
                debug("removeModulesFromPackageJson: finished writing the new package.json"); 
            });
        }, function error(err) {
            debug("removeModulesFromPackageJson: an error was thrown while trying to read the package.json file.");
            return new Error("An error occurred while trying to read the package.json file.");
        });
        
        debug("removeModulesFromPackageJson: leaving function");
        return promise;
    };

    return module;
})();

module.exports = npmexclude;
