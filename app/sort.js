#!/usr/bin/env node

import {hosts, next, print, progress, promise} from '@k03mad/util';
import chalk from 'chalk';
import hexyjs from 'hexyjs';
import _ from 'lodash';

import consts from './helpers/consts.js';

const {lists, timeout} = consts;
const {blue, cyan, dim, green, red} = chalk;

const query = ({domain, list, method}) => next.query({
    method,
    path: `${list}/hex:${hexyjs.strToHex(domain)}`,
});

(async () => {
    const results = await Promise.allSettled(Object.values(lists || {}).map(async list => {
        const currentDomains = await next.list({path: list});

        if (currentDomains.length > 0) {
            console.log([
                '',
                `${dim(cyan('before'))} ${green(list)}: ${currentDomains.length} domains\n`,
                dim(currentDomains.join('\n')),
                '',
            ].join('\n'));

            const barDelete = progress.start('DELETE', currentDomains.length);

            const domainsDeleted = [];

            await Promise.all(currentDomains.map(async domain => {
                await query({method: 'DELETE', list, domain});

                domainsDeleted.push(domain);
                progress.update(barDelete, domainsDeleted.length, domain);
            }));

            const sortedReversed = hosts.sort(new Set(currentDomains)).reverse();

            const barPut = progress.start('PUT   ', sortedReversed.length);

            for (const [i, domain] of sortedReversed.entries()) {
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

                progress.update(barPut, i + 1, domain);
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
                    `After: ${afterDomains.length}`,
                    `Diff: ${blue(_.xor(currentDomains, afterDomains).join(', '))}`,
                ].join('\n'));
            }
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
