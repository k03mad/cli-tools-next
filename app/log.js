#!/usr/bin/env node

'use strict';

const env = require('../env');
const {green} = require('chalk');
const {print, next, hosts} = require('utils-mad');

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
        let [domains, sort = 'on', pages = 100] = env.args;

        if (domains !== '-' && domains !== '+') {
            console.log(`Args: ${green('{type (-|+)} {sort (on|off = on)} {pages = 100}')}`);
        } else {
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

                logs.forEach(({status, name, deviceName}) => {
                    if (
                        deviceName !== env.next.checker
                        && !exclude[domains].some(elem => name.includes(elem))
                        // eslint-disable-next-line no-mixed-operators
                        && (domains === '-' && status === 2 || domains === '+' && status !== 2)
                    ) {
                        domainsList[method](name);
                    }
                });

                lastTime = logs[logs.length - 1].timestamp;
            }

            console.log(
                sort === 'on'
                    ? hosts.comment(hosts.sort(new Set(domainsList))).join('\n')
                    : [...new Set(domainsList)].reverse().join('\n'),
            );
        }
    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
