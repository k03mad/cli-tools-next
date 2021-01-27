#!/usr/bin/env node

'use strict';

const hexyjs = require('hexyjs');
const pMap = require('p-map');
const {green, dim, cyan, red, blue} = require('chalk');
const {lists, concurrency, timeout} = require('./helpers/consts');
const {next, hosts, promise, print, array} = require('utils-mad');

const query = ({method, list, domain}) => next.query({
    method,
    path: `${list}/hex:${hexyjs.strToHex(domain)}`,
});

(async () => {
    const results = await Promise.allSettled(Object.values(lists || {}).map(async list => {
        const currentDomains = await next.list({path: list});

        console.log([
            '',
            `${dim(cyan('before'))} ${green(list)}: ${currentDomains.length} domains\n`,
            dim(currentDomains.join('\n')),
        ].join('\n'));

        await pMap(currentDomains, domain => query({
            method: 'DELETE', list, domain,
        }), {concurrency});

        const sortedReversed = hosts.sort(new Set(currentDomains)).reverse();

        for (const domain of sortedReversed) {
            await promise.delay(timeout.put);

            try {
                await query({method: 'PUT', list, domain});
            } catch {
                await promise.delay(timeout.pause);

                try {
                    await query({method: 'PUT', list, domain});
                } catch (err) {
                    print.ex(err, {before: `Cannot add "${domain}" to "${list}"`});
                }
            }
        }

        await promise.delay(timeout.pause);
        const afterDomains = await next.list({path: list});

        console.log([
            '',
            `${dim(cyan('after'))} ${green(list)}: ${afterDomains.length} domains\n`,
            dim(afterDomains.join('\n')),
        ].join('\n'));

        if (currentDomains.length !== afterDomains.length) {
            throw new Error([
                red(`${list.toUpperCase()}: different domains count after sort`),
                `Before: ${currentDomains.length}`,
                `After: ${afterDomains.length})`,
                `Diff: ${blue(array.diff(currentDomains, afterDomains).join(', '))}`,
            ].join('\n'));
        }
    }));

    const rejected = results
        .filter(elem => elem.status === 'rejected')
        .map(elem => elem.reason)
        .join('\n');

    if (rejected) {
        print.ex(rejected, {full: true, exit: true});
    }
})();
