'use strict';

const pkg = require('./package.json');
const updateNotifier = require('update-notifier');
const {argv} = require('yargs');

updateNotifier({pkg}).notify();

const args = argv._;

module.exports = {
    args: args.length > 0 ? args : [],

    next: {
        config: process.env.NEXT_DNS_CONFIG,
        checker: 'Mad-Checker',
    },

    pwd: process.env.PWD,
    repo: 'https://raw.githubusercontent.com/k03mad/cli-tools-next/master',
};
