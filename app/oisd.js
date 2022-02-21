#!/usr/bin/env node

import {hosts, next, print} from '@k03mad/util';
import chalk from 'chalk';
import puppeteer from 'puppeteer';

import env from '../env.js';

const {blue} = chalk;

(async () => {
    try {
        const [pages = 50] = env.args;
        const list = new Set();

        let lastTime;

        for (let i = 1; i <= Number(pages); i++) {
            const {logs} = await next.query({
                path: 'logs',
                searchParams: {
                    before: lastTime || '',
                    simple: 1,
                    lng: 'en',
                },
            });

            logs.forEach(elem => {
                if (elem.status === 2 && !elem.lists.includes('oisd')) {
                    list.add(elem.name);
                }
            });

            lastTime = logs[logs.length - 1].timestamp;
        }

        const oisdQuery = hosts
            .sort(list)
            .map(elem => `https://oisd.nl/excludes.php?w=${elem}`);

        for (const elem of oisdQuery) {
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.goto(elem);

            const body = await page.$('body');
            const text = await body.evaluate(node => node.textContent);

            const formatted = text
                .replace(/.+not included in the oisd blocklist\?/, '')
                .replace(/getreport.+/, '')
                .replace(/-{9}.+/, '')
                .replace(/(\s+)?Found in: /g, '\n')
                .trim();

            if (!formatted.includes('No info on this domain')) {
                console.log(`\n${blue(elem)}`);
                console.log(formatted);
            }

            await browser.close();
        }

    } catch (err) {
        print.ex(err, {full: true, exit: true});
    }
})();
