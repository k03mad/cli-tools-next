#!/usr/bin/env node

'use strict';

const hexyjs = require('hexyjs');
const {args} = require('../env');
const {green, yellow, magenta} = require('chalk');
const {lists} = require('./helpers/consts');
const {next, print, request} = require('utils-mad');

(async () => {
    try {
        const [list, addDomain] = args;

        if (Object.keys(lists).includes(list) && addDomain) {
            const domain = addDomain.trim();
            console.log(`${green(domain)}\n`);

            const listType = lists[list];

            await next.query({
                method: 'PUT',
                path: `${listType}/hex:${hexyjs.strToHex(domain)}`,
            });

            if (list === '-') {
                await request.got('https://quidsup.net/notrack/report.php', {
                    method: 'POST',
                    searchParams: {view: 'submit'},
                    form: {type: 'single', site: domain},
                });

                console.log(`— reported to ${magenta('quidsup')}`);
            }

            console.log(`— added to ${yellow(listType)}`);
        } else {
            console.log(`Args: ${green('{type (-|+)} {domain}')}`);
        }

    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
