#!/usr/bin/env node

import utils from '@k03mad/utils';
import chalk from 'chalk';
import hexyjs from 'hexyjs';

import env from '../env.js';
import consts from './helpers/consts.js';

const {lists} = consts;
const {next, print, request} = utils;
const {green, magenta, yellow} = chalk;

(async () => {
    try {
        const [list, addDomain] = env.args;

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
