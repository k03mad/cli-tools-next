#!/usr/bin/env node

'use strict';

const env = require('../env');
const pMap = require('p-map');
const {next, request, print, hosts} = require('utils-mad');
const {promises: fs} = require('fs');

const concurrency = 5;
const pages = 10;

(async () => {
    try {
        const suspicious = new Set();

        const [searchList, excludeList] = await Promise.all([
            './app/susp/search.list',
            './app/susp/exclude.list',
        ].map(async path => {
            const list = await fs.readFile(path, {encoding: 'utf-8'});
            return list.split(/\s+/).filter(Boolean);
        }));

        const domainsInLists = await Promise.all([
            next.list({path: 'denylist'}),
            next.list({path: 'allowlist'}),
        ]);

        await pMap(searchList, async search => {
            let timestamp = '';
            let hasMore = true;

            for (let i = 1; i <= pages; i++) {
                if (hasMore) {
                    const data = await next.query({
                        path: 'logs',
                        searchParams: {search, simple: 1, lng: 'en', before: timestamp},
                    });

                    for (const {lists, name} of data.logs) {
                        if (
                            lists.length === 0
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
