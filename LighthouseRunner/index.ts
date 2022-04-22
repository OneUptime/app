import { ExpressRequest, ExpressResponse } from 'CommonServer/utils/Express';

import app from 'CommonServer/utils/StartServer';

import http from 'http';
http.createServer(app);

import cors from 'cors';
import Main from './workers/main';

import cron from 'node-cron';
import config from './utils/config';

const cronMinuteStartTime: $TSFixMe = Math.floor(Math.random() * 50);

app.use(cors());
app.set('port', process.env.PORT || 3015);

app.get(
    ['/lighthouse/status', '/status'],
    (req: ExpressRequest, res: ExpressResponse) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(
            JSON.stringify({
                status: 200,
                message: 'Service Status - OK',
                serviceType: 'oneuptime-lighthouse',
            })
        );
    }
);

//App Version

app.get(
    ['/lighthouse/version', '/version'],
    (req: ExpressRequest, res: ExpressResponse) => {
        res.setHeader('Content-Type', 'application/json');
        res.send({ lighthouseVersion: process.env.npm_package_version });
    }
);

// This cron runs every 30 minutes.
cron.schedule('*/30 * * * *', () => {
    setTimeout(() => {
        Main.runJob();
    }, cronMinuteStartTime * 1000);
});

http.listen(app.get('port'), (): void => {
    // eslint-disable-next-line
    logger.info(
        `Lighthouse Started on port ${app.get('port')}. OneUptime API URL: ${
            config.serverUrl
        }`
    );
});

export default app;
