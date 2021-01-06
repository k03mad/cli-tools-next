#!/usr/bin/env node

'use strict';

const env = require('../env');
const hexyjs = require('hexyjs');
const pMap = require('p-map');
const {cyan, dim, yellow} = require('chalk');
const {next, request, promise, print} = require('utils-mad');

const concurrency = 4;
const pause = 5000;

const lists = ['allowlist', 'denylist'];

const prepareAnswer = (domain, answer) => answer
    ? `— ${domain} ${dim(answer
        .filter(elem => elem.data.match(/(\d{1,3}\.){3}\d{1,3}/))
        .map(elem => elem.data)
        .sort()
        .pop())}`
    : `!! ${domain} ${dim('no answer')}`;

const logRecords = (arr, name) => {
    if (arr.length > 0) {
        console.log(`\n${cyan(`${name}:`)}\n${arr.join('\n')}`);
    }
};

(async () => {
    try {
        for (const list of lists) {
            console.log(`\n${yellow(`__${list.toUpperCase()}__`)}`);

            const domains = await next.list({path: list});

            if (domains.length > 0) {
                // disable personal filters
                await pMap(domains, domain => next.query({
                    method: 'PATCH',
                    path: `${list}/hex:${hexyjs.strToHex(domain)}`,
                    json: {active: false},
                }), {concurrency});

                await promise.delay(pause);

                // get dns records
                const cloudflare = [];
                const nextdns = [];
                const common = [];

                const answers = await pMap(domains, async domain => {
                    const res = await Promise.all([
                        request.doh({domain}),
                        request.doh({domain, resolver: `https://dns.nextdns.io/${env.next.config}/Mad-Checker`}),
                    ]);
                    return {domain, cloudflare: res[0].Answer, nextdns: res[1].Answer};
                }, {concurrency});

                answers.forEach(answer => {
                    const preparedDef = prepareAnswer(answer.domain, answer.cloudflare);
                    const preparedNext = prepareAnswer(answer.domain, answer.nextdns);

                    if (preparedDef === preparedNext) {
                        common.push(preparedDef);
                    } else {
                        cloudflare.push(preparedDef);
                        nextdns.push(preparedNext);
                    }
                });

                logRecords(cloudflare, 'cloudflare');
                logRecords(nextdns, 'nextdns');
                logRecords(common, 'common');

                await promise.delay(pause);

                // get last requests logs
                const {logs} = await next.query({
                    path: 'logs',
                    searchParams: {simple: 1, lng: 'en'},
                });

                // save allow/block reasons
                const foundInLists = [];

                domains.forEach(domain => {
                    const lastDomainLog = logs.find(elem => elem.name === domain);

                    if (lastDomainLog?.lists.length > 0) {
                        foundInLists.push(`— ${domain} ${dim(lastDomainLog.lists.join(', '))}`);
                    }
                });

                logRecords(foundInLists, 'reasons');

                // reenable filters
                await pMap(domains, domain => next.query({
                    method: 'PATCH',
                    path: `${list}/hex:${hexyjs.strToHex(domain)}`,
                    json: {active: true},
                }), {concurrency});
            }
        }
    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
