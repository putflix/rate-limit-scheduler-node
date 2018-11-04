import dotenv from 'dotenv-safe';
import request from 'request-promise-native';
import { Response } from 'request';
import {Signale} from 'signale';
import { URL } from 'url';

import delay from './util/delay';
import { Job, ScheduleResponse } from './util/types';

dotenv.config();

const logger = new Signale({
    scope: 'queue manager',
});

const queue: Job[] = [];

const pushToQueue = (jobs: Job[]) => {
    const queuedItems = queue.map(j => j.id);
    queue.push(...jobs.filter(i => !queuedItems.includes(i.id)));
}

const main = async (url: string, limit: number = 10) => {

    while(true) {
        try {
            logger.await(`Fetching new jobs...`);
            const scheduleUrl = new URL(url);
            scheduleUrl.searchParams.set('limit', String(limit));
            const jobs: ScheduleResponse = await request(scheduleUrl.toString(), {json: true});

            if(jobs.items.length === 0) {
                logger.await(`No new jobs. Waiting 30 seconds before trying it again...`);
                await delay(30000);
            } else {
                logger.success(`Fetched ${jobs.items.length} new jobs.`);
                pushToQueue(jobs.items);
            }

            while(queue.length > 0) {
                const job = queue.shift();
                const jobLogger = logger.scope(job.id);

                jobLogger.start(`Working on job ${job.id}...`);
                const resp: Response = await request(job.endpoint, {
                    method: 'POST',
                    body: job.payload,
                    json: true,
                    resolveWithFullResponse: true
                });

                if(resp.statusCode === 429) {
                    const wait = parseInt(resp.headers["retry-after"]);
                    jobLogger.warn(`Job hit a rate limit. Re-queueing job and waiting ${wait} seconds...`);
                    pushToQueue([job]);
                    await delay(wait * 1000);
                } else {
                    await request(url, {method: 'POST', json: true, body: {id: job.id, status: resp.statusCode}});

                    if(resp.statusCode > 300) {
                        jobLogger.error(`Job errored with code ${resp.statusCode} (${resp.body}).`);
                    } else {
                        jobLogger.success(`Job finished with code ${resp.statusCode}.`);
                    }
                }
            }
        } catch(e) {
            console.error(e.message);
        }
    }
}

main(process.env.URL, parseInt(process.env.LIMIT));