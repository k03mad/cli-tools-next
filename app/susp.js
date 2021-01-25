#!/usr/bin/env node

'use strict';

const env = require('../env');
const path = require('path');
const pMap = require('p-map');
const {green} = require('chalk');
const {lists, concurrency} = require('./helpers/consts');
const {next, request, print, hosts} = require('utils-mad');
const {promises: fs} = require('fs');

const pages = 10;

(async () => {
    try {
        const searchArgs = env.args;
        const suspicious = new Set();

        const [searchList, excludeList] = await Promise.all([
            'search.list',
            'exclude.list',
        ].map(async name => {
            let list;

            if (env.pwd?.endsWith('cli-tools-next')) {
                list = await fs.readFile(path.join(__dirname, 'helpers', name), {encoding: 'utf-8'});
            } else {
                ({body: list} = await request.got(`${env.repo}/app/helpers/${name}`));
            }

            return list.split(/\s+/).filter(Boolean);
        }));

        const domainsInLists = await Promise.all(
            Object.values(lists).map(list => next.list({path: list})),
        );

        await pMap(searchArgs.length > 0 ? searchArgs : searchList, async search => {
            let timestamp = '';
            let hasMore = true;

            for (let i = 1; i <= pages; i++) {
                if (hasMore) {
                    const data = await next.query({
                        path: 'logs',
                        searchParams: {search, simple: 1, lng: 'en', before: timestamp},
                    });

                    for (const {lists: logLists, name} of data.logs) {
                        if (
                            logLists.length === 0
                            && !suspicious.has(name)
                            && !excludeList.some(elem => name.includes(elem))
                            && !domainsInLists.flat().includes(name)
                        ) {
                            const {Answer} = await request.doh({
                                domain: name,
                                resolver: `https://dns.nextdns.io/${env.next.config}/${env.next.checker}`,
                            });

                            if (!Answer?.some(elem => elem.data === '0.0.0.0')) {
                                suspicious.add(name);
                            }
                        }
                    }

                    ({timestamp} = data.logs[data.logs.length - 1] || '');
                    ({hasMore} = data);
                }
            }
        }, {concurrency});

        console.log(suspicious.size > 0
            ? hosts.comment(hosts.sort(suspicious)).join('\n')
            : green('Suspicious domains not found'),
        );
    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
