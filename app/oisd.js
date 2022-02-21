#!/usr/bin/env node

import {next, print} from '@k03mad/util';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import _ from 'lodash';
import puppeteer from 'puppeteer';

import env from '../env.js';

const {blue, gray, green, red} = chalk;

const DEFAULT_PAGES = 50;

const getBar = name => {
    const options = {
        format: `${blue(name)} ${green('[{bar}]')} {value}/{total} ${gray('{extra}')}`,
        hideCursor: true,
        stopOnComplete: true,
        autopadding: true,
        barCompleteChar: '#',
        barIncompleteChar: '.',
    };

    return new cliProgress.SingleBar(options);
};

(async () => {
    try {
        let [pages = DEFAULT_PAGES] = env.args;
        pages = Number(pages);

        const nextBar = getBar('nextdns');
        nextBar.start(pages, 0, {extra: ''});

        const blocked = [];

        let lastTime;

        for (let i = 1; i <= pages; i++) {
            const {logs} = await next.query({
                path: 'logs',
                searchParams: {
                    blockedQueriesOnly: 1,
                    before: lastTime || '',
                    simple: 1,
                    lng: 'en',
                },
            });

            logs.forEach(elem => {
                if (
                    !elem.lists.includes('oisd')
                    && !blocked.map(row => row.name).includes(elem.name)
                ) {
                    blocked.push(elem);
                }
            });

            lastTime = logs[logs.length - 1].timestamp;
            nextBar.update(i, {extra: lastTime});
        }

        if (blocked.length > 0) {
            const oisdBar = getBar('oisd   ');
            oisdBar.start(blocked.length, 0, {extra: ''});

            const output = [];

            const browser = await puppeteer.launch();
            const page = await browser.newPage();

            for (const [i, elem] of _.sortBy(blocked, 'name').entries()) {
                const url = `https://oisd.nl/excludes.php?w=${elem.name}`;

                await page.goto(url);

                const body = await page.$('body');
                const text = await body.evaluate(node => node.textContent);

                const formatted = text
                    .replace(/.+not included in the oisd blocklist\?/, '')
                    .replace(/getreport.+/, '')
                    .replace(/-{9}.+/, '')
                    .replace(/(\s+)?Found in: /g, '\n> wl: ')
                    .replace(/(\s+)?CNAME for: /g, '\n> cname: ')
                    .replace(/(\s+)?Parent of: /g, '\n> parent: ')
                    .trim();

                if (
                    !formatted.includes('No info on this domain')
                    && !formatted.includes('IS being blocked by oisd')
                ) {
                    output.push([
                        blue(url),

                        red(`[${elem.lists.map(name => {
                            const [first] = name.split(' ');
                            return first;
                        }).join(', ')}]`),

                        formatted,
                    ]);
                }

                oisdBar.update(i + 1, {extra: elem.name});
            }

            console.log(`\n${output.map(elem => elem.join('\n')).join('\n\n')}`);
            await browser.close();
        }
    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
