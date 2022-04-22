import ProbeService from '../Services/ProbeService';
import { sendErrorResponse } from '../Utils/Response';
import BadDataException from 'Common/Types/Exception/BadDataException';
import Version from 'Common/Types/Version';

import {
    ExpressRequest,
    ExpressResponse,
    NextFunction,
    OneUptimeRequest,
} from '../Utils/Express';

import { ClusterKey as CLUSTER_KEY } from '../Config';
import ObjectID from 'Common/Types/ObjectID';
import LocalCache from '../Infrastructure/LocalCache';
import { JSONObject } from 'Common/Types/JSON';
import Query from '../Types/DB/Query';
import { Document } from '../Infrastructure/ORM';

interface ProbeCache extends JSONObject {
    _id: ObjectID;
    key: ObjectID;
    name: string;
    version: Version;
}

export default {
    async isAuthorizedProbe(
        req: ExpressRequest,
        res: ExpressResponse,
        next: NextFunction
    ): Promise<void> {
        let probeKey: ObjectID | undefined,
            probeName: string | undefined,
            clusterKey: ObjectID | undefined,
            probeVersion: Version | undefined,
            probeId: ObjectID | undefined;

        if (req.params && req.params['probeKey']) {
            probeKey = new ObjectID(req.params['probeKey'] || '');
        } else if (req.query && req.query['probeKey']) {
            probeKey = new ObjectID((req.query['probeKey'] as string) || '');
        } else if (req.headers && req.headers['probekey']) {
            // Header keys are automatically transformed to lowercase
            probeKey = new ObjectID(req.headers['probekey'] as string);
        } else if (req.body && req.body.probeKey) {
            probeKey = req.body.probeKey;
        }

        if (!probeKey) {
            return sendErrorResponse(
                req,
                res,
                new BadDataException('Probe key not found.')
            );
        }

        if (req.params && req.params['probeName']) {
            probeName = req.params['probeName'];
        } else if (req.query && req.query['probeName']) {
            probeName = req.query['probeName'] as string;
        } else if (req.headers && req.headers['probename']) {
            // Header keys are automatically transformed to lowercase
            probeName = req.headers['probename'] as string;
        } else if (req.body && req.body.probeName) {
            probeName = req.body.probeName;
        }

        if (!probeName) {
            return sendErrorResponse(
                req,
                res,
                new BadDataException('Probe Name not found.')
            );
        }

        if (req.params && req.params['clusterKey']) {
            clusterKey = new ObjectID(req.params['clusterKey'] as string);
        } else if (req.query && req.query['clusterKey']) {
            clusterKey = new ObjectID(req.query['clusterKey'] as string);
        } else if (req.headers && req.headers['clusterkey']) {
            // Header keys are automatically transformed to lowercase
            clusterKey = new ObjectID(req.headers['clusterkey'] as string);
        } else if (req.body && req.body.clusterKey) {
            clusterKey = req.body.clusterKey;
        }

        if (req.params && req.params['probeVersion']) {
            probeVersion = new Version(req.params['probeVersion']);
        } else if (req.query && req.query['probeVersion']) {
            probeVersion = new Version(req.query['probeVersion'] as string);
        } else if (req.headers && req.headers['probeversion']) {
            // Header keys are automatically transformed to lowercase
            probeVersion = new Version(req.headers['probeversion'] as string);
        } else if (req.body && req.body.probeVersion) {
            probeVersion = req.body.probeVersion;
        }

        if (!probeVersion) {
            return sendErrorResponse(
                req,
                res,
                new BadDataException('Probe version not found.')
            );
        }

        if (clusterKey && clusterKey === CLUSTER_KEY) {
            /*
             * If cluster key matches then just query by probe name,
             * Because if the probe key does not match, we can update probe key later
             * Without updating mognodb database manually.
             */

            if (LocalCache.hasValue('probe', probeName)) {
                probeId = new ObjectID(
                    (
                        LocalCache.get('probe', probeName) as ProbeCache
                    )._id.toString()
                );
            } else {
                const probe: Document | null = await ProbeService.findOneBy({
                    query: new Query().equalTo('name', probeName),
                    populate: [],
                    select: ['name', 'key', 'version', '_id'],
                    sort: [],
                });

                if (probe && probe._id) {
                    probeId = probe._id;

                    LocalCache.set('probe', probeName, {
                        _id: probe._id,
                        name: probe.get('name'),
                        key: probe.get('key'),
                        version: probe.get('version'),
                    });
                }
            }
        } else if (LocalCache.hasValue('probe', probeName)) {
            probeId = new ObjectID(
                (
                    LocalCache.get('probe', probeName) as ProbeCache
                )._id.toString()
            );
        } else {
            const probe: Document | null = await ProbeService.findOneBy({
                query: new Query()
                    .equalTo('name', probeName)
                    .equalTo('key', probeKey),
                populate: [],
                select: ['name', 'key', 'version', '_id'],
                sort: [],
            });

            if (probe && probe._id) {
                probeId = probe._id;

                LocalCache.set('probe', probeName, {
                    _id: probe._id,
                    name: probe.get('name'),
                    key: probe.get('key'),
                    version: probe.get('version'),
                });
            }
        }

        if (!probeId && (!clusterKey || clusterKey !== CLUSTER_KEY)) {
            return sendErrorResponse(
                req,
                res,
                new BadDataException('Probe key and probe name do not match.')
            );
        }

        if (!probeId) {
            //Create a new probe.
            const probe: Document = await ProbeService.create({
                data: {
                    key: probeKey
                        ? probeKey.toString()
                        : ObjectID.generate().toString(),
                    name: probeName,
                    version: probeVersion,
                },
            });

            probeId = probe._id;

            LocalCache.set('probe', probeName, {
                _id: probe._id,
                name: probe.get('name'),
                key: probe.get('key'),
                version: probe.get('version'),
            });
        }

        if (
            (LocalCache.get('probe', probeName) as ProbeCache).key !== probeKey
        ) {
            //Update probe key becasue it does not match.

            await ProbeService.updateProbeKeyByName(probeName, probeKey);

            const probe: Document | null = await ProbeService.findOneBy({
                query: new Query()
                    .equalTo('name', probeName)
                    .equalTo('key', probeKey),
                populate: [],
                select: ['name', 'key', 'version', '_id'],
                sort: [],
            });

            if (probe) {
                probeId = probe._id;

                LocalCache.set('probe', probeName, {
                    _id: probe._id,
                    name: probe.get('name'),
                    key: probe.get('key'),
                    version: probe.get('version'),
                });
            }
        }

        const oneuptimeRequest: OneUptimeRequest = req as OneUptimeRequest;

        if (!probeId) {
            return sendErrorResponse(
                req,
                res,
                new BadDataException('Probe ID not found')
            );
        }

        oneuptimeRequest.probe = {
            id: probeId,
        };

        // Run in background.
        ProbeService.updateLastAlive(probeName);

        if (
            probeVersion &&
            (!(LocalCache.get('probe', probeName) as ProbeCache).version ||
                (
                    LocalCache.get('probe', probeName) as ProbeCache
                ).version.toString() !== probeVersion.toString())
        ) {
            ProbeService.updateProbeVersionByName(probeName, probeVersion);
        }

        return next();
    },
};
