#!/usr/bin/env node

import utils from '@k03mad/utils';
import chalk from 'chalk';

import env from '../env.js';

const {green} = chalk;
const {hosts, next, print} = utils;

const exclude = {
    '+': [
        '-dnsotls-ds.metric.gstatic.com',
        '.googleapis.com',
        '.googlevideo.com',
    ],
    '-': [],
};

(async () => {
    try {
        let [list, sort = 'on', pages = 100] = env.args;

        if (Object.keys(exclude).includes(list)) {
            pages = Number(pages);

            const domainsList = [];

            let lastTime;

            for (let i = 1; i <= pages; i++) {
                let method = 'push';

                if (i === pages) {
                    lastTime = '';
                }

                let {logs} = await next.query({
                    path: 'logs',
                    searchParams: {
                        before: lastTime || '',
                        simple: 1,
                        lng: 'en',
                    },
                });

                if (i === pages) {
                    logs = logs.reverse();
                    method = 'unshift';
                }

                logs.forEach(({deviceName, name, status}) => {
                    if (
                        deviceName !== env.next.checker
                        && !exclude[list].some(elem => name.includes(elem))
                        // eslint-disable-next-line no-mixed-operators
                        && (list === '-' && status === 2 || list === '+' && status !== 2)
                    ) {
                        domainsList[method](name);
                    }
                });

                lastTime = logs[logs.length - 1].timestamp;
            }

            console.log(
                sort === 'on'
                    ? hosts.comment(hosts.sort(new Set(domainsList)))
                    : [...new Set(domainsList)].reverse().join('\n'),
            );
        } else {
            console.log(`Args: ${green('{type (-|+)} {sort (on|off = on)} {pages = 100}')}`);
        }
    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
