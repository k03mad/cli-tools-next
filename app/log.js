#!/usr/bin/env node

'use strict';

const env = require('../env');
const {green} = require('chalk');
const {print, next, hosts} = require('utils-mad');

(async () => {
    try {
        let [domains, sort = 'on', pages = 100] = env.args;

        if (domains !== '-' && domains !== '+') {
            console.log(`Args: ${green('{type (-|+)} {sort (on|off = on)} {pages = 100}')}`);
        } else {
            const logDomains = domainsSet => console.log(
                sort === 'on'
                    ? hosts.comment(hosts.sort(new Set(domainsSet))).join('\n')
                    : [...new Set(domainsSet)].reverse().join('\n'),
            );

            pages = Number(pages);

            const allowed = [];
            const blocked = [];

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
                    if (deviceName !== env.next.checker) {
                        status === 2
                            ? blocked[method](name)
                            : allowed[method](name);
                    }
                });

                lastTime = logs[logs.length - 1].timestamp;
            }

            logDomains(domains === '+' ? allowed : blocked);
        }
    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
