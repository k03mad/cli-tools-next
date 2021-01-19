#!/usr/bin/env node

'use strict';

const env = require('../env');
const path = require('path');
const pMap = require('p-map');
const {lists} = require('./helpers/consts');
const {next, request, print, hosts} = require('utils-mad');
const {promises: fs} = require('fs');

const concurrency = 5;
const pages = 10;

(async () => {
    try {
        const suspicious = new Set();

        const [searchList, excludeList] = await Promise.all([
            'search.list',
            'exclude.list',
        ].map(async name => {
            const list = await fs.readFile(path.join(__dirname, 'susp', name), {encoding: 'utf-8'});
            return list.split(/\s+/).filter(Boolean);
        }));

        const domainsInLists = await Promise.all(
            Object.values(lists).map(list => next.list({path: list})),
        );

        await pMap(searchList, async search => {
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

                            if (Answer && !Answer.some(elem => elem.data === '0.0.0.0')) {
                                suspicious.add(name);
                            }
                        }
                    }

                    ({timestamp} = data.logs[data.logs.length - 1] || '');
                    ({hasMore} = data);
                }
            }
        }, {concurrency});

        console.log(hosts.comment(hosts.sort(suspicious)).join('\n'));
    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
