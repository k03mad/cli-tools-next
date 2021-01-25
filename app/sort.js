#!/usr/bin/env node

'use strict';

const hexyjs = require('hexyjs');
const pMap = require('p-map');
const {args} = require('../env');
const {green, red, dim} = require('chalk');
const {lists, concurrency} = require('./helpers/consts');
const {next, hosts, promise, print} = require('utils-mad');

(async () => {
    try {
        const [list] = args;

        if (Object.keys(lists).includes(list)) {
            const listType = lists[list];
            const currentDomains = await next.list({path: listType});

            await pMap(currentDomains, domain => next.query({
                method: 'DELETE',
                path: `${listType}/hex:${hexyjs.strToHex(domain)}`,
            }), {concurrency});

            console.log([
                `${green('Before sort:')} ${currentDomains.length} domains in ${listType}\n`,
                dim(currentDomains.join('\n')),
                '',
            ].join('\n'));

            const sortedReversed = hosts.sort(new Set(currentDomains)).reverse();

            for (const domain of sortedReversed) {
                await promise.delay();
                await next.query({
                    method: 'PUT',
                    path: `${listType}/hex:${hexyjs.strToHex(domain)}`,
                });
            }

            const afterDomains = await next.list({path: listType});

            console.log([
                `${green('After sort:')} ${afterDomains.length} domains in ${listType}\n`,
                dim(afterDomains.join('\n')),
                currentDomains.length === afterDomains.length
                    ? '' : red('\n\nSOMETHING GOES WRONG\nDomains length doesn\'t eql after sort'),
            ].join('\n').trim());
        } else {
            console.log(`Args: ${green('{type (-|+)}')}`);
        }

    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
