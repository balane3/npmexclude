#!/usr/bin/env node
'use strict';

var npmExclude = require('./npmExclude');

var promise = npmExclude.run(process.argv);
promise.done(function(success) {
    console.log("The npm command was executed successfully.");
}, function(err) {
    console.log(err.message);
});
