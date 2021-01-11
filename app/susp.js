#!/usr/bin/env node

'use strict';

const env = require('../env');
const pMap = require('p-map');
const {next, request, print, hosts} = require('utils-mad');

const concurrency = 4;
const pages = 5;

const searchList = [
    'ad.', '.ad', '-ad', 'ad-',
    'ads', 'adim', 'adv', 'adx',
    'affil', 'analy',
    'banner', 'beacon',
    'counter',
    'log', 'logs',
    'marketing', 'metric',
    'pixel',
    'sentry', 'stats', 'statis',
    'telem',
    'track',
];

const exclude = new RegExp([
    'adaway.org', 'adtidy.org',
    'blog(\\.|ger\\.)',
    'catalog[.-]', '\\.cdn.ampproject.org',
    'loads?[.-]', 'login\\.',
    'dnsotls-ds.metric.gstatic.com',
    `${env.next.config}.dns.nextdns.io`,
].join('|'));

(async () => {
    try {
        const suspicious = new Set();
        const lastTime = {};

        await pMap(searchList, async search => {
            for (let i = 1; i <= pages; i++) {

                if (lastTime[search] !== null) {
                    const {logs} = await next.query({
                        before: lastTime[search] || '',
                        path: 'logs',
                        searchParams: {search, simple: 1, lng: 'en'},
                    });

                    for (const {lists, name} of logs) {
                        if (
                            lists.length === 0
                            && !suspicious.has(name)
                            && !exclude.test(name)
                        ) {
                            const {Answer} = await request.doh({domain: name, resolver: `https://dns.nextdns.io/${env.next.config}/${env.next.checker}`});

                            if (Answer && !Answer?.some(elem => elem.data === '0.0.0.0')) {
                                suspicious.add(name);
                            }
                        }
                    }

                    lastTime[search] = logs[logs.length - 1]?.timestamp || null;
                }

            }
        }, {concurrency});

        console.log(hosts.comment(hosts.sort(suspicious)).join('\n'));
    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
