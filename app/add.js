#!/usr/bin/env node

'use strict';

const hexyjs = require('hexyjs');
const {args} = require('../env');
const {green, yellow} = require('chalk');
const {lists} = require('./helpers/consts');
const {next, print} = require('utils-mad');

(async () => {
    try {
        const [list, addDomain] = args;

        if (Object.keys(lists).includes(list) && addDomain) {
            const listType = lists[list];

            await next.query({
                method: 'PUT',
                path: `${listType}/hex:${hexyjs.strToHex(addDomain.trim())}`,
            });

            console.log(`${green(addDomain)} added to ${yellow(listType)}`);
        } else {
            console.log(`Args: ${green('{type (-|+)} {domain}')}`);
        }

    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
