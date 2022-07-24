import MonitorService from './monitorService';
import MonitorStatusService from './monitorStatusService';
import MonitorLogService from './monitorLogService';
import LighthouseLogService from './lighthouseLogService';
import IncidentService from './incidentService';
import IncidentTimelineService from './incidentTimelineService';
import moment from 'moment';
import { some, forEach } from 'p-iteration';
import vm from 'vm';
import AutomatedScriptService from './automatedScriptService';
import { ObjectId } from 'mongodb';

const probeCollection: $TSFixMe = global.db.collection('probes');

import { v1 as uuidv1 } from 'uuid';

import BackendAPI from '../Utils/api';

import { realtimeUrl } from '../Config';
const realtimeBaseUrl = `${realtimeUrl}/realtime`;

export default {
    create: async function (data: $TSFixMe): void {
        let probeKey: $TSFixMe;
        if (data.probeKey) {
            probeKey = data.probeKey;
        } else {
            probeKey = uuidv1();
        }
        const storedProbe: $TSFixMe = this.findOneBy({
            probeName: data.probeName,
        });
        if (storedProbe && storedProbe.probeName) {
            const error: $TSFixMe = new Error('Probe name already exists.');

            error.code = 400;

            throw error;
        } else {
            const probe: $TSFixMe = {};

            probe.probeKey = probeKey;

            probe.probeName = data.probeName;

            probe.version = data.probeVersion;

            const now: $TSFixMe = new Date(moment().format());

            probe.createdAt = now;

            probe.lastAlive = now;

            probe.deleted = false;

            const result: $TSFixMe = await probeCollection.insertOne(probe);
            const savedProbe: $TSFixMe = this.findOneBy({
                _id: ObjectId(result.insertedId),
            });
            return savedProbe;
        }
    },

    findOneBy: async function (query: $TSFixMe): void {
        if (!query) {
            query = {};
        }

        if (!query.deleted) {
            query.$or = [{ deleted: false }, { deleted: { $exists: false } }];
        }

        const probe: $TSFixMe = await probeCollection.findOne(query);
        return probe;
    },

    updateOneBy: async function (query, data): void {
        if (!query) {
            query = {};
        }

        if (!query.deleted) {
            query.$or = [{ deleted: false }, { deleted: { $exists: false } }];
        }

        await probeCollection.updateOne(query, { $set: data });
        const probe: $TSFixMe = this.findOneBy(query);
        return probe;
    },

    saveLighthouseLog: async function (data: $TSFixMe): void {
        const log: $TSFixMe = LighthouseLogService.create(data);
        return log;
    },

    createMonitorDisabledStatus: async function (data: $TSFixMe): void {
        let monitorStatus: $TSFixMe = MonitorStatusService.findBy({
            query: {
                monitorId: data.monitorId,
            },
            limit: 1, // Only get one item, which is the latest item
        });
        monitorStatus = monitorStatus[0];

        const lastStatus: $TSFixMe =
            monitorStatus && monitorStatus.status ? monitorStatus.status : null;

        if (!lastStatus || (lastStatus && lastStatus !== data.status)) {
            data.lastStatus = lastStatus ? lastStatus : null;
            monitorStatus = MonitorStatusService.create({
                ...data,
                deleted: false,
            });
        }
        return monitorStatus;
    },

    saveMonitorLog: async function (data: $TSFixMe): void {
        let monitorStatus: $TSFixMe = MonitorStatusService.findBy({
            query: {
                monitorId: data.monitorId,
                probeId: data.probeId,
            },
            limit: 1, // Only get one item, which is the latest item
        });
        monitorStatus = monitorStatus[0];

        const lastStatus: $TSFixMe =
            monitorStatus && monitorStatus.status ? monitorStatus.status : null;

        let log: $TSFixMe = MonitorLogService.create(data);

        if (!data.stopPingTimeUpdate) {
            MonitorService.updateMonitorPingTime(data.monitorId);
        }

        // Grab all the criteria in a monitor

        const allCriteria: $TSFixMe = [];
        if (data.matchedUpCriterion) {
            data.matchedUpCriterion.forEach((criteria: $TSFixMe) => {
                return allCriteria.push(criteria);
            });
        }
        if (data.matchedDownCriterion) {
            data.matchedDownCriterion.forEach((criteria: $TSFixMe) => {
                return allCriteria.push(criteria);
            });
        }
        if (data.matchedDegradedCriterion) {
            data.matchedDegradedCriterion.forEach((criteria: $TSFixMe) => {
                return allCriteria.push(criteria);
            });
        }

        if (!lastStatus || (lastStatus && lastStatus !== data.status)) {
            /*
             * Check if monitor has a previous status
             * Check if previous status is different from the current status
             * If different, resolve last incident, create a new incident and monitor status
             */
            if (lastStatus) {
                // Check 3 times just to make sure
                if (
                    typeof data.retry === 'boolean' &&
                    data.retryCount >= 0 &&
                    data.retryCount < 3
                ) {
                    return { retry: true, retryCount: data.retryCount };
                }

                this.incidentResolveOrAcknowledge(data, allCriteria);
            }

            const incidentIdsOrRetry: $TSFixMe =
                this.incidentCreateOrUpdate(data);

            if (incidentIdsOrRetry.retry) {
                return incidentIdsOrRetry;
            }

            if (
                Array.isArray(incidentIdsOrRetry) &&
                incidentIdsOrRetry.length
            ) {
                data.incidentId = incidentIdsOrRetry[0];
            }

            MonitorStatusService.create({ ...data, deleted: false });

            if (incidentIdsOrRetry && incidentIdsOrRetry.length) {
                log = MonitorLogService.updateOneBy(
                    { _id: ObjectId(log._id) },
                    { incidentIds: incidentIdsOrRetry }
                );
            }
        } else {
            // Should make sure all unresolved incidents for the monitor is resolved
            if (data.status === 'online') {
                this.incidentResolveOrAcknowledge(data, allCriteria);
            }

            const incidents: $TSFixMe = IncidentService.findBy({
                query: {
                    'monitors.monitorId': ObjectId(data.monitorId),
                    incidentType: data.status,
                    resolved: false,
                },
            });

            const incidentIds: $TSFixMe = incidents.map(
                (incident: $TSFixMe) => {
                    return incident._id;
                }
            );

            if (incidentIds && incidentIds.length) {
                log = MonitorLogService.updateOneBy(
                    { _id: ObjectId(log._id) },
                    { incidentIds }
                );
            }
        }
        return log;
    },

    getMonitorLog: async function (data: $TSFixMe): void {
        const date: $TSFixMe = new Date(moment().format());
        const log: $TSFixMe = MonitorLogService.findOneBy({
            monitorId: data.monitorId,
            probeId: data.probeId,
            createdAt: { $lt: data.date || date },
        });
        return log;
    },

    incidentCreateOrUpdate: async function (data: $TSFixMe): void {
        const [monitor, incidents]: $TSFixMe = await Promise.all([
            MonitorService.findOneBy({
                query: { _id: ObjectId(data.monitorId) },
            }),
            IncidentService.findBy({
                query: {
                    'monitors.monitorId': ObjectId(data.monitorId),
                    incidentType: data.status,
                    resolved: false,
                    manuallyCreated: false,
                },
            }),
        ]);
        const { matchedCriterion }: $TSFixMe = data;
        let incidentIds: $TSFixMe = [];
        let scripts: $TSFixMe = [];

        if (
            matchedCriterion &&
            matchedCriterion.scripts &&
            matchedCriterion.scripts.length > 0
        ) {
            scripts = matchedCriterion.scripts.map((script: $TSFixMe) => {
                return {
                    automatedScript: script.scriptId,
                };
            });
        }

        if (
            data.status === 'online' &&
            monitor &&
            matchedCriterion &&
            matchedCriterion.createAlert
        ) {
            if (incidents && incidents.length) {
                const internalIncidents: $TSFixMe = [];
                for (let incident of incidents) {
                    if (monitor.type !== 'incomingHttpRequest') {
                        const initialProbes: $TSFixMe = incident.probes.map(
                            (probe: $TSFixMe) => {
                                return {
                                    probeId: probe.probeId._id || probe.probeId,
                                    updatedAt: probe.updatedAt,
                                    status: probe.status,
                                    reportedStatus: probe.reportedStatus,
                                };
                            }
                        );
                        incident = IncidentService.updateOneBy(
                            {
                                _id: ObjectId(incident._id),
                            },
                            {
                                probes: [
                                    ...initialProbes,
                                    {
                                        probeId: data.probeId,
                                        updatedAt: new Date(moment().format()),
                                        status: true,
                                        reportedStatus: data.status,
                                    },
                                ],
                            }
                        );
                    }

                    IncidentTimelineService.create({
                        incidentId: incident._id,
                        probeId: data.probeId,
                        status: data.status,
                    });

                    incident && internalIncidents.push(incident);
                }

                incidentIds = internalIncidents;
            } else {
                if (
                    typeof data.retry === 'boolean' &&
                    data.retryCount >= 0 &&
                    data.retryCount < 3
                ) {
                    return { retry: true, retryCount: data.retryCount };
                }

                const response: $TSFixMe = await BackendAPI.post(
                    'api/incident/data-ingestor/create-incident',
                    {
                        projectId: monitor.projectId,
                        monitors: [data.monitorId],
                        createdById: null,
                        incidentType: 'online',
                        probeId: data.probeId,
                        reason: data.reason,
                        response: data.response,
                        ...(matchedCriterion && {
                            matchedCriterion,
                        }),
                    }
                );
                const incident: $TSFixMe = response;

                AutomatedScriptService.runResource({
                    triggeredId: incident._id,
                    triggeredBy: 'incident',
                    resources: scripts,
                });

                if (incident) {
                    incidentIds = [incident];
                }
            }
        } else if (
            data.status === 'degraded' &&
            monitor &&
            matchedCriterion &&
            matchedCriterion.createAlert
        ) {
            if (incidents && incidents.length) {
                const internalIncidents: $TSFixMe = [];
                for (let incident of incidents) {
                    if (monitor.type !== 'incomingHttpRequest') {
                        const initialProbes: $TSFixMe = incident.probes.map(
                            (probe: $TSFixMe) => {
                                return {
                                    probeId: probe.probeId._id || probe.probeId,
                                    updatedAt: probe.updatedAt,
                                    status: probe.status,
                                    reportedStatus: probe.reportedStatus,
                                };
                            }
                        );
                        incident = IncidentService.updateOneBy(
                            {
                                _id: ObjectId(incident._id),
                            },
                            {
                                probes: [
                                    ...initialProbes,
                                    {
                                        probeId: data.probeId,
                                        updatedAt: new Date(moment().format()),
                                        status: true,
                                        reportedStatus: data.status,
                                    },
                                ],
                            }
                        );
                    }

                    IncidentTimelineService.create({
                        incidentId: incident._id.toString(),
                        probeId: data.probeId,
                        status: data.status,
                    });

                    incident && internalIncidents.push(incident);
                }
                incidentIds = internalIncidents;
            } else {
                if (
                    typeof data.retry === 'boolean' &&
                    data.retryCount >= 0 &&
                    data.retryCount < 3
                ) {
                    return { retry: true, retryCount: data.retryCount };
                }

                const response: $TSFixMe = await BackendAPI.post(
                    'api/incident/data-ingestor/create-incident',
                    {
                        projectId: monitor.projectId,
                        monitors: [data.monitorId],
                        createdById: null,
                        incidentType: 'degraded',
                        probeId: data.probeId,
                        reason: data.reason,
                        response: data.response,
                        ...(matchedCriterion && {
                            matchedCriterion,
                        }),
                    }
                );
                const incident: $TSFixMe = response;

                AutomatedScriptService.runResource({
                    triggeredId: incident._id,
                    triggeredBy: 'incident',
                    resources: scripts,
                });

                if (incident) {
                    incidentIds = [incident];
                }
            }
        } else if (
            data.status === 'offline' &&
            monitor &&
            matchedCriterion &&
            matchedCriterion.createAlert
        ) {
            if (incidents && incidents.length) {
                const internalIncidents: $TSFixMe = [];
                for (let incident of incidents) {
                    if (monitor.type !== 'incomingHttpRequest') {
                        const initialProbes: $TSFixMe = incident.probes.map(
                            (probe: $TSFixMe) => {
                                return {
                                    probeId: probe.probeId._id || probe.probeId,
                                    updatedAt: probe.updatedAt,
                                    status: probe.status,
                                    reportedStatus: probe.reportedStatus,
                                };
                            }
                        );
                        incident = IncidentService.updateOneBy(
                            {
                                _id: ObjectId(incident._id),
                            },
                            {
                                probes: [
                                    ...initialProbes,
                                    {
                                        probeId: data.probeId,
                                        updatedAt: new Date(moment().format()),
                                        status: true,
                                        reportedStatus: data.status,
                                    },
                                ],
                            }
                        );
                    }

                    IncidentTimelineService.create({
                        incidentId: incident._id.toString(),
                        probeId: data.probeId,
                        status: data.status,
                    });

                    incident && internalIncidents.push(incident);
                }
                incidentIds = internalIncidents;
            } else {
                if (
                    typeof data.retry === 'boolean' &&
                    data.retryCount >= 0 &&
                    data.retryCount < 3
                ) {
                    return { retry: true, retryCount: data.retryCount };
                }

                const response: $TSFixMe = await BackendAPI.post(
                    'api/incident/data-ingestor/create-incident',
                    {
                        projectId: monitor.projectId,
                        monitors: [data.monitorId],
                        createdById: null,
                        incidentType: 'offline',
                        probeId: data.probeId,
                        reason: data.reason,
                        response: data.response,
                        ...(matchedCriterion && {
                            matchedCriterion,
                        }),
                    }
                );
                const incident: $TSFixMe = response;

                AutomatedScriptService.runResource({
                    triggeredId: incident._id,
                    triggeredBy: 'incident',
                    resources: scripts,
                });

                if (incident) {
                    incidentIds = [incident];
                }
            }
        }

        incidentIds = incidentIds.map((i: $TSFixMe) => {
            return i._id;
        });
        return incidentIds;
    },

    incidentResolveOrAcknowledge: async function (data, allCriteria): void {
        const [incidents, monitor]: $TSFixMe = await Promise.all([
            IncidentService.findBy({
                query: {
                    'monitors.monitorId': ObjectId(data.monitorId),
                    resolved: false,
                    manuallyCreated: false,
                },
            }),
            MonitorService.findOneBy({
                query: { _id: ObjectId(data.monitorId) },
            }),
        ]);

        /*
         * Should grab all the criterion for the monitor and put them into one array
         * Check the id of each criteria against the id of criteria attached to an incident
         * Ack / resolve according to the criteria
         */

        let autoAcknowledge: $TSFixMe, autoResolve: $TSFixMe;
        if (incidents && incidents.length > 0) {
            incidents.forEach((incident: $TSFixMe) => {
                let criteriaId: $TSFixMe = null;
                if (
                    incident &&
                    incident.criterionCause &&
                    incident.criterionCause._id
                ) {
                    criteriaId = String(incident.criterionCause._id);
                }

                allCriteria.forEach((criteria: $TSFixMe) => {
                    if (
                        String(criteria?._id) === criteriaId ||
                        criteria?.name === incident?.criterionCause?.name
                    ) {
                        autoAcknowledge = criteria?.autoAcknowledge;
                        autoResolve = criteria?.autoResolve;
                    }
                });
            });
        }

        const incidentsV1: $TSFixMe = [];
        const incidentsV2: $TSFixMe = [];

        if (incidents && incidents.length) {
            /*
             * Is this check needed at all??
             * If (lastStatus && lastStatus !== data.status) {
             */

            incidents.forEach((incident: $TSFixMe) => {
                if (
                    incident.probes &&
                    incident.probes.length > 0 &&
                    monitor.type !== 'incomingHttpRequest'
                ) {
                    incident.probes.some((probe: $TSFixMe) => {
                        if (
                            probe.probeId &&
                            String(probe.probeId._id || probe.probeId) ===
                                String(data.probeId)
                        ) {
                            incidentsV1.push(incident);
                            return true;
                        }
                        return false;
                    });
                } else {
                    incidentsV1.push(incident);
                    return true;
                }
            });
            // }
        }

        for (const incident of incidentsV1) {
            if (
                incident.probes &&
                incident.probes.length > 0 &&
                monitor.type !== 'incomingHttpRequest'
            ) {
                const initialProbes: $TSFixMe = incident.probes.map(
                    (probe: $TSFixMe) => {
                        return {
                            probeId: probe.probeId._id || probe.probeId,
                            updatedAt: probe.updatedAt,
                            status: probe.status,
                            reportedStatus: probe.reportedStatus,
                        };
                    }
                );
                const [newIncident]: $TSFixMe = await Promise.all([
                    IncidentService.updateOneBy(
                        {
                            _id: ObjectId(incident._id),
                        },
                        {
                            probes: [
                                ...initialProbes,
                                {
                                    probeId: data.probeId,
                                    updatedAt: new Date(moment().format()),
                                    status: false,
                                    reportedStatus: data.status,
                                },
                            ],
                        }
                    ),
                    IncidentTimelineService.create({
                        incidentId: incident._id.toString(),
                        probeId: data.probeId,
                        status: data.status,
                    }),
                ]);

                incidentsV2.push(newIncident);
            } else {
                incidentsV2.push(incident);
            }
        }

        await forEach(incidentsV2, async (incident: $TSFixMe) => {
            const trueArray: $TSFixMe = [];
            const falseArray: $TSFixMe = [];

            incident.probes.forEach((probe: $TSFixMe) => {
                if (probe.status) {
                    trueArray.push(probe);
                } else {
                    falseArray.push(probe);
                }
            });

            if (
                trueArray.length === falseArray.length ||
                monitor.type === 'incomingHttpRequest'
            ) {
                if (autoAcknowledge) {
                    if (!incident.acknowledged) {
                        await BackendAPI.post(
                            'api/incident/data-ingestor/acknowledge-incident',
                            {
                                incidentId: incident._id.toString(),
                                name: 'oneuptime',
                                probeId: data.probeId,
                            }
                        );
                    }
                }

                if (autoResolve) {
                    await BackendAPI.post(
                        'api/incident/data-ingestor/resolve-incident',
                        {
                            incidentId: incident._id.toString(),
                            name: 'oneuptime',
                            probeId: data.probeId,
                        }
                    );
                }
            }
        });

        return {};
    },

    updateProbeStatus: async function (probeId: $TSFixMe): void {
        const now: $TSFixMe = new Date(moment().format());
        await probeCollection.updateOne(
            {
                _id: ObjectId(probeId),
                $or: [{ deleted: false }, { deleted: { $exists: false } }],
            },
            { $set: { lastAlive: now } }
        );
        const probe: $TSFixMe = this.findOneBy({
            _id: ObjectId(probeId),
        });

        // Realtime update for probe
        BackendAPI.post(
            `${realtimeBaseUrl}/update-probe`,
            { data: probe },
            true
        );
        return probe;
    },

    scriptConditions: (resp: $TSFixMe, con: $TSFixMe) => {
        const body: $TSFixMe = resp ?? null;

        const successReasons: $TSFixMe = [];

        const failedReasons: $TSFixMe = [];

        let eventOccurred: $TSFixMe = false;
        let matchedCriterion: $TSFixMe;
        if (con && con.length) {
            eventOccurred = con.some((condition: $TSFixMe) => {
                let stat: $TSFixMe = true;
                if (
                    condition &&
                    condition.criteria &&
                    condition.criteria.condition &&
                    condition.criteria.condition === 'and'
                ) {
                    stat = checkScriptAnd(
                        condition.criteria,
                        body,

                        successReasons,

                        failedReasons
                    );
                } else if (
                    condition &&
                    condition.criteria &&
                    condition.criteria.condition &&
                    condition.criteria.condition === 'or'
                ) {
                    stat = checkScriptOr(
                        condition.criteria,
                        body,

                        successReasons,

                        failedReasons
                    );
                }
                if (stat) {
                    matchedCriterion = condition;
                    return true;
                }

                return false;
            });
        }

        return {
            stat: eventOccurred,

            successReasons,

            failedReasons,
            matchedCriterion,
        };
    },

    conditions: (
        monitorType: $TSFixMe,
        con: $TSFixMe,
        payload: $TSFixMe,
        resp: $TSFixMe,
        response: $TSFixMe
    ) => {
        const status: $TSFixMe = resp
            ? resp.status
                ? resp.status
                : resp.statusCode
                ? resp.statusCode
                : null
            : null;
        const body: $TSFixMe = resp && resp.body ? resp.body : null;
        const queryParams: $TSFixMe =
            resp && resp.queryParams ? resp.queryParams : null;
        const headers: $TSFixMe = resp && resp.headers ? resp.headers : null;
        const sslCertificate: $TSFixMe =
            resp && resp.sslCertificate ? resp.sslCertificate : null;

        const successReasons: $TSFixMe = [];

        const failedReasons: $TSFixMe = [];

        let eventOccurred: $TSFixMe = false;
        let matchedCriterion: $TSFixMe;

        if (con && con.length) {
            for (const condition of con) {
                let stat: $TSFixMe = true;
                if (
                    condition &&
                    condition.criteria &&
                    condition.criteria.condition &&
                    condition.criteria.condition === 'and'
                ) {
                    stat = checkAnd(
                        payload,
                        condition.criteria,
                        status,
                        body,
                        sslCertificate,
                        response,

                        successReasons,

                        failedReasons,
                        monitorType,
                        queryParams,
                        headers
                    );
                } else if (
                    condition &&
                    condition.criteria &&
                    condition.criteria.condition &&
                    condition.criteria.condition === 'or'
                ) {
                    stat = checkOr(
                        payload,
                        condition.criteria,
                        status,
                        body,
                        sslCertificate,
                        response,

                        successReasons,

                        failedReasons,
                        monitorType,
                        queryParams,
                        headers
                    );
                }

                eventOccurred = stat;

                if (stat) {
                    matchedCriterion = condition;
                    return {
                        stat: eventOccurred,

                        successReasons,

                        failedReasons,
                        matchedCriterion: condition,
                    };
                }
            }
        }
        return {
            stat: eventOccurred,

            successReasons,

            failedReasons,
            matchedCriterion,
        };
    },

    incomingCondition: (payload: $TSFixMe, conditions: $TSFixMe) => {
        let eventOccurred: $TSFixMe = false;
        let matchedCriterion: $TSFixMe;
        if (conditions && conditions.length) {
            eventOccurred = some(conditions, (condition: $TSFixMe) => {
                let response: $TSFixMe = false;
                let respAnd: $TSFixMe = false,
                    respOr: $TSFixMe = false,
                    countAnd: $TSFixMe = 0,
                    countOr: $TSFixMe = 0;

                if (
                    condition &&
                    condition.criteria &&
                    condition.criteria.condition &&
                    condition.criteria.condition === 'and'
                ) {
                    respAnd = incomingCheckAnd(payload, condition.criteria);
                    countAnd++;
                }
                if (
                    condition &&
                    condition.criteria &&
                    condition.criteria.condition &&
                    condition.criteria.condition === 'or'
                ) {
                    respOr = incomingCheckOr(payload, condition.criteria);
                    countOr++;
                }
                if (countAnd > 0 && countOr > 0) {
                    if (respAnd && respOr) {
                        response = true;
                    }
                } else if (countAnd > 0 && countOr <= 0) {
                    if (respAnd) {
                        response = true;
                    }
                } else if (countOr > 0 && countAnd <= 0) {
                    if (respOr) {
                        response = true;
                    }
                }
                if (response) {
                    matchedCriterion = condition;
                    return true;
                }

                return false;
            });
        }
        return { eventOccurred, matchedCriterion };
    },

    probeHttpRequest: async function (monitor, probeId): void {
        let status: $TSFixMe, reason: $TSFixMe;
        let matchedCriterion: $TSFixMe;
        const lastPingTime: $TSFixMe = monitor.lastPingTime;
        const payload: $TSFixMe = moment().diff(
            moment(lastPingTime),
            'minutes'
        );

        const {
            eventOccurred: validUp,

            matchedCriterion: matchedUpCriterion,
        } =
            monitor && monitor.criteria && monitor.criteria.up
                ? this.incomingCondition(payload, monitor.criteria.up)
                : false;

        const {
            eventOccurred: validDegraded,

            matchedCriterion: matchedDegradedCriterion,
        } =
            monitor && monitor.criteria && monitor.criteria.degraded
                ? this.incomingCondition(payload, monitor.criteria.degraded)
                : false;

        const {
            eventOccurred: validDown,

            matchedCriterion: matchedDownCriterion,
        } =
            monitor && monitor.criteria && monitor.criteria.down
                ? this.incomingCondition(payload, [
                      ...monitor.criteria.down.filter((criterion: $TSFixMe) => {
                          return criterion.default !== true;
                      }),
                  ])
                : false;
        let timeHours: $TSFixMe = 0;
        let timeMinutes: $TSFixMe = payload;
        let tempReason = `${payload} min`;
        if (timeMinutes > 60) {
            timeHours = Math.floor(timeMinutes / 60);
            timeMinutes = Math.floor(timeMinutes % 60);
            tempReason = `${timeHours} hrs ${timeMinutes} min`;
        }

        if (validDown) {
            status = 'offline';
            reason = [`${criteriaStrings.incomingTime} ${tempReason}`];
            matchedCriterion = matchedDownCriterion;
        } else if (validDegraded) {
            status = 'degraded';
            reason = [`${criteriaStrings.incomingTime} ${tempReason}`];
            matchedCriterion = matchedDegradedCriterion;
        } else if (validUp) {
            status = 'online';
            reason = [`${criteriaStrings.incomingTime} ${tempReason}`];
            matchedCriterion = matchedUpCriterion;
        } else {
            status = 'offline';
            reason = [`${criteriaStrings.incomingTime} ${tempReason}`];
            if (monitor.criteria.down) {
                matchedCriterion = monitor.criteria.down.find(
                    (criterion: $TSFixMe) => {
                        return criterion.default === true;
                    }
                );
            }
        }
        const logData: $TSFixMe = {};

        logData.responseTime = 0;

        logData.responseStatus = null;

        logData.status = status;

        logData.probeId = probeId;

        logData.monitorId =
            monitor && monitor.id
                ? monitor.id
                : monitor._id
                ? monitor._id
                : null;

        logData.sslCertificate = null;

        logData.lighthouseScanStatus = null;

        logData.performance = null;

        logData.accessibility = null;

        logData.bestPractices = null;

        logData.seo = null;

        logData.pwa = null;

        logData.lighthouseData = null;

        logData.retryCount = 3;

        logData.reason = reason;

        logData.response = null;

        logData.stopPingTimeUpdate = true;

        logData.matchedCriterion = matchedCriterion;

        // Update monitor to save the last matched criterion
        const [, log]: $TSFixMe = await Promise.all([
            MonitorService.updateCriterion(
                ObjectId(monitor._id),
                matchedCriterion
            ),

            this.saveMonitorLog(logData),
        ]);

        return log;
    },
};

import _ from 'lodash';

const incomingCheckAnd: Function = (
    payload: $TSFixMe,
    condition: $TSFixMe
): void => {
    let validity: $TSFixMe = false;
    let val: $TSFixMe = 0;
    let incomingVal: $TSFixMe = 0;
    if (condition && condition.criteria && condition.criteria.length > 0) {
        for (let i: $TSFixMe = 0; i < condition.criteria.length; i++) {
            if (
                condition.criteria[i].criteria &&
                condition.criteria[i].criteria.length > 0
            ) {
                if (
                    condition.criteria[i].condition &&
                    condition.criteria[i].condition === 'and'
                ) {
                    // Incoming check and
                    const tempAnd: $TSFixMe = incomingCheckAnd(
                        payload,
                        condition.criteria[i]
                    );
                    if (tempAnd) {
                        val++;
                        incomingVal++;
                    }
                } else if (
                    condition.criteria[i].condition &&
                    condition.criteria[i].condition === 'or'
                ) {
                    // Incoming check or
                    const tempOr: $TSFixMe = incomingCheckOr(
                        payload,
                        condition.criteria[i]
                    );
                    if (tempOr) {
                        val++;
                        incomingVal++;
                    }
                }
            } else if (
                condition.criteria[i] &&
                condition.criteria[i].responseType &&
                condition.criteria[i].responseType === 'incomingTime'
            ) {
                if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'greaterThan'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload > condition.criteria[i].field1
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'lessThan'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload < condition.criteria[i].field1
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'inBetween'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        condition.criteria[i].field2 &&
                        payload > condition.criteria[i].field1 &&
                        payload < condition.criteria[i].field2
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'equalTo'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload === condition.criteria[i].field1
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'notEqualTo'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload !== condition.criteria[i].field1
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'gtEqualTo'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload >= condition.criteria[i].field1
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'ltEqualTo'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload <= condition.criteria[i].field1
                    ) {
                        val++;
                    }
                }
                incomingVal++;
            }
        }
    }

    if (val > 0 && incomingVal > 0 && val === incomingVal) {
        validity = true;
    }

    return validity;
};

const incomingCheckOr: Function = (
    payload: $TSFixMe,
    condition: $TSFixMe
): void => {
    let validity: $TSFixMe = false;
    let val: $TSFixMe = 0;
    let incomingVal: $TSFixMe = 0;
    if (condition && condition.criteria && condition.criteria.length > 0) {
        for (let i: $TSFixMe = 0; i < condition.criteria.length; i++) {
            if (
                condition.criteria[i].criteria &&
                condition.criteria[i].criteria.length > 0
            ) {
                if (
                    condition.criteria[i].condition &&
                    condition.criteria[i].condition === 'or'
                ) {
                    // Incoming check or
                    const tempor: $TSFixMe = incomingCheckAnd(
                        payload,
                        condition.criteria[i]
                    );
                    if (tempor) {
                        val++;
                        incomingVal++;
                    }
                } else if (
                    condition.criteria[i].condition &&
                    condition.criteria[i].condition === 'and'
                ) {
                    const tempAnd: $TSFixMe = incomingCheckAnd(
                        payload,
                        condition.criteria[i]
                    );
                    if (tempAnd) {
                        val++;
                        incomingVal++;
                    }
                }
            } else if (
                condition.criteria[i] &&
                condition.criteria[i].responseType &&
                condition.criteria[i].responseType === 'incomingTime'
            ) {
                if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'greaterThan'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload > condition.criteria[i].field1
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'lessThan'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload < condition.criteria[i].field1
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'inBetween'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        condition.criteria[i].field2 &&
                        payload > condition.criteria[i].field1 &&
                        payload < condition.criteria[i].field2
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'equalTo'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload === condition.criteria[i].field1
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'notEqualTo'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload !== condition.criteria[i].field1
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'gtEqualTo'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload >= condition.criteria[i].field1
                    ) {
                        val++;
                    }
                } else if (
                    condition.criteria[i] &&
                    condition.criteria[i].filter &&
                    condition.criteria[i].filter === 'ltEqualTo'
                ) {
                    if (
                        condition.criteria[i] &&
                        condition.criteria[i].field1 &&
                        payload &&
                        payload <= condition.criteria[i].field1
                    ) {
                        val++;
                    }
                }
                incomingVal++;
            }
        }
    }

    if (val > 0 && incomingVal > 0) {
        validity = true;
    }

    return validity;
};

const checkAnd: Function = (
    payload: $TSFixMe,

    con: $TSFixMe,

    statusCode: $TSFixMe,

    body: $TSFixMe,

    ssl: $TSFixMe,

    response: $TSFixMe,

    successReasons: $TSFixMe,

    failedReasons: $TSFixMe,

    type: $TSFixMe,

    queryParams: $TSFixMe,

    headers: $TSFixMe
): void => {
    let validity: $TSFixMe = true;
    if (con && con.criteria && con.criteria.length > 0) {
        for (let i: $TSFixMe = 0; i < con.criteria.length; i++) {
            if (
                con.criteria[i].criteria &&
                con.criteria[i].criteria.length > 0
            ) {
                if (
                    con.criteria[i].condition &&
                    con.criteria[i].condition === 'and'
                ) {
                    // Check and again

                    const temp: $TSFixMe = checkAnd(
                        payload,
                        con.criteria[i],
                        statusCode,
                        body,
                        ssl,
                        response,
                        successReasons,
                        failedReasons,
                        type,
                        queryParams,
                        headers
                    );

                    if (!temp) {
                        validity = temp;
                    }
                } else if (
                    con.criteria[i].condition &&
                    con.criteria[i].condition === 'or'
                ) {
                    // Check or again

                    const temp1: $TSFixMe = checkOr(
                        payload,
                        con.criteria[i],
                        statusCode,
                        body,
                        ssl,
                        response,
                        successReasons,
                        failedReasons,
                        type,
                        queryParams,
                        headers
                    );
                    if (!temp1) {
                        validity = temp1;
                    }
                }
            } else {
                let tempReason = `${payload} min`;
                if (
                    con.criteria[i] &&
                    con.criteria[i].responseType &&
                    con.criteria[i].responseType === 'incomingTime'
                ) {
                    let timeHours: $TSFixMe = 0;
                    let timeMinutes: $TSFixMe = payload;
                    if (timeMinutes > 60) {
                        timeHours = Math.floor(timeMinutes / 60);
                        timeMinutes = Math.floor(timeMinutes % 60);
                        tempReason = `${timeHours} hrs ${timeMinutes} min`;
                    }
                }
                if (
                    con.criteria[i] &&
                    con.criteria[i].responseType &&
                    con.criteria[i].responseType === 'responseTime'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload > Number(con.criteria[i].field1)
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload < Number(con.criteria[i].field1)
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                con.criteria[i].field2 &&
                                payload > Number(con.criteria[i].field1) &&
                                payload < Number(con.criteria[i].field2)
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload === Number(con.criteria[i].field1)
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload !== Number(con.criteria[i].field1)
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload >= Number(con.criteria[i].field1)
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload <= Number(con.criteria[i].field1)
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType &&
                    con.criteria[i].responseType === 'incomingTime'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload > con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload < con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                con.criteria[i].field2 &&
                                payload > con.criteria[i].field1 &&
                                payload < con.criteria[i].field2
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload === con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload !== con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload >= con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload <= con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'doesRespond'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'isUp'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].filter &&
                                !(
                                    (statusCode === 408 ||
                                        statusCode === '408') &&
                                    body &&
                                    body.code &&
                                    body.code === 'ENOTFOUND'
                                )
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Offline`
                            );
                        } else {
                            successReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Online`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'isDown'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].filter &&
                                (statusCode === 408 || statusCode === '408') &&
                                body &&
                                body.code &&
                                body.code === 'ENOTFOUND'
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Online`
                            );
                        } else {
                            successReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Offline`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'ssl'
                ) {
                    const expiresIn: $TSFixMe = moment(
                        new Date(
                            ssl && ssl.expires ? ssl.expires : Date.now()
                        ).getTime()
                    ).diff(Date.now(), 'days');
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'isValid'
                    ) {
                        if (!(ssl && !ssl.selfSigned)) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.sslCertificate} was not valid`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.sslCertificate} was valid`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notFound'
                    ) {
                        if (ssl) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.sslCertificate} was present`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.sslCertificate} was not present`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'selfSigned'
                    ) {
                        if (!(ssl && ssl.selfSigned)) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.sslCertificate} was not Self-Signed`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.sslCertificate} was Self-Signed`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'expiresIn30'
                    ) {
                        if (!(ssl && !ssl.selfSigned && expiresIn < 30)) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.sslCertificate} expires in ${expiresIn} days`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.sslCertificate} expires in ${expiresIn} days`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'expiresIn10'
                    ) {
                        if (!(ssl && !ssl.selfSigned && expiresIn < 10)) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.sslCertificate} expires in ${expiresIn} days`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.sslCertificate} expires in ${expiresIn} days`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'statusCode'
                ) {
                    statusCode = Number(statusCode);
                    const criteriaStatusCode1: $TSFixMe =
                        con.criteria[i].field1 &&
                        Number(con.criteria[i].field1);
                    const criteriaStatusCode2: $TSFixMe =
                        con.criteria[i].field2 &&
                        Number(con.criteria[i].field2);
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                criteriaStatusCode1 &&
                                statusCode &&
                                statusCode > criteriaStatusCode1
                            )
                        ) {
                            validity = false;
                            if (statusCode === 408 || statusCode === '408') {
                                failedReasons.push('Request Timed out');
                            } else {
                                failedReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            successReasons.push('Request Timed out');
                        } else {
                            successReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                criteriaStatusCode1 &&
                                statusCode &&
                                statusCode < criteriaStatusCode1
                            )
                        ) {
                            validity = false;
                            if (statusCode === 408 || statusCode === '408') {
                                failedReasons.push('Request Timed out');
                            } else {
                                failedReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            successReasons.push('Request Timed out');
                        } else {
                            successReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                criteriaStatusCode1 &&
                                statusCode &&
                                criteriaStatusCode2 &&
                                statusCode > criteriaStatusCode1 &&
                                statusCode < criteriaStatusCode2
                            )
                        ) {
                            validity = false;
                            if (statusCode === 408 || statusCode === '408') {
                                failedReasons.push('Request Timed out');
                            } else {
                                failedReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            successReasons.push('Request Timed out');
                        } else {
                            successReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                criteriaStatusCode1 &&
                                statusCode &&
                                statusCode === criteriaStatusCode1
                            )
                        ) {
                            validity = false;
                            if (statusCode === 408 || statusCode === '408') {
                                failedReasons.push('Request Timed out');
                            } else {
                                failedReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            successReasons.push('Request Timed out');
                        } else {
                            successReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                criteriaStatusCode1 &&
                                statusCode &&
                                statusCode !== criteriaStatusCode1
                            )
                        ) {
                            validity = false;
                            if (statusCode === 408 || statusCode === '408') {
                                failedReasons.push('Request Timed out');
                            } else {
                                failedReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            successReasons.push('Request Timed out');
                        } else {
                            successReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                criteriaStatusCode1 &&
                                statusCode &&
                                statusCode >= criteriaStatusCode1
                            )
                        ) {
                            validity = false;
                            if (statusCode === 408 || statusCode === '408') {
                                failedReasons.push('Request Timed out');
                            } else {
                                failedReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            successReasons.push('Request Timed out');
                        } else {
                            successReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                criteriaStatusCode1 &&
                                statusCode &&
                                statusCode <= criteriaStatusCode1
                            )
                        ) {
                            validity = false;
                            if (statusCode === 408 || statusCode === '408') {
                                failedReasons.push('Request Timed out');
                            } else {
                                failedReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            successReasons.push('Request Timed out');
                        } else {
                            successReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'cpuLoad'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.cpuLoad &&
                                payload.cpuLoad > con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.cpuLoad !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            successReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.cpuLoad &&
                                payload.cpuLoad < con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.cpuLoad !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            successReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.cpuLoad &&
                                con.criteria[i].field2 &&
                                payload.cpuLoad > con.criteria[i].field1 &&
                                payload.cpuLoad < con.criteria[i].field2
                            )
                        ) {
                            validity = false;
                            if (payload && payload.cpuLoad !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            successReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.cpuLoad &&
                                payload.cpuLoad === con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.cpuLoad !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            successReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.cpuLoad &&
                                payload.cpuLoad !== con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.cpuLoad !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            successReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.cpuLoad &&
                                payload.cpuLoad >= con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.cpuLoad !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            successReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.cpuLoad &&
                                payload.cpuLoad <= con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.cpuLoad !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            successReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'memoryUsage'
                ) {
                    const memoryUsedBytes: $TSFixMe = payload
                        ? parseInt(payload.memoryUsed || 0)
                        : 0;
                    const memoryUsed: $TSFixMe =
                        memoryUsedBytes / Math.pow(1e3, 3);
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                memoryUsedBytes &&
                                memoryUsed &&
                                memoryUsed > con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.memoryUsed !== null) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            successReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                memoryUsedBytes &&
                                memoryUsed &&
                                memoryUsed < con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.memoryUsed !== null) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            successReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                memoryUsedBytes &&
                                memoryUsed &&
                                con.criteria[i].field2 &&
                                memoryUsed > con.criteria[i].field1 &&
                                memoryUsed < con.criteria[i].field2
                            )
                        ) {
                            validity = false;
                            if (payload && payload.memoryUsed !== null) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            successReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                memoryUsedBytes &&
                                memoryUsed &&
                                memoryUsed === con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.memoryUsed !== null) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            successReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                memoryUsedBytes &&
                                memoryUsed &&
                                memoryUsed !== con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.memoryUsed !== null) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            successReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                memoryUsedBytes &&
                                memoryUsed &&
                                memoryUsed >= con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.memoryUsed !== null) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            successReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                memoryUsedBytes &&
                                memoryUsed &&
                                memoryUsed <= con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.memoryUsed !== null) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            successReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'storageUsage'
                ) {
                    const size: $TSFixMe = payload
                        ? parseInt(payload.totalStorage || 0)
                        : 0;
                    const used: $TSFixMe = payload
                        ? parseInt(payload.storageUsed || 0)
                        : 0;
                    const freeBytes: $TSFixMe = size - used;
                    const free: $TSFixMe = freeBytes / Math.pow(1e3, 3);
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                freeBytes &&
                                free > con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            successReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                freeBytes &&
                                free < con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            successReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                con.criteria[i].field2 &&
                                freeBytes &&
                                free > con.criteria[i].field1 &&
                                free < con.criteria[i].field2
                            )
                        ) {
                            validity = false;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            successReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                freeBytes &&
                                free === con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            successReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                freeBytes &&
                                free !== con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            successReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                freeBytes &&
                                free >= con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            successReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                freeBytes &&
                                free <= con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                failedReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            successReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'temperature'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.mainTemp &&
                                payload.mainTemp > con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.mainTemp !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            successReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.mainTemp &&
                                payload.mainTemp < con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.mainTemp !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            successReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.mainTemp &&
                                con.criteria[i].field2 &&
                                payload.mainTemp > con.criteria[i].field1 &&
                                payload.mainTemp < con.criteria[i].field2
                            )
                        ) {
                            validity = false;
                            if (payload && payload.mainTemp !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            successReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.mainTemp &&
                                payload.mainTemp === con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.mainTemp !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            successReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.mainTemp &&
                                payload.mainTemp !== con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.mainTemp !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            successReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.mainTemp &&
                                payload.mainTemp >= con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.mainTemp !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            successReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                payload &&
                                payload.mainTemp &&
                                payload.mainTemp <= con.criteria[i].field1
                            )
                        ) {
                            validity = false;
                            if (payload && payload.mainTemp !== null) {
                                failedReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            successReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'responseBody'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'contains'
                    ) {
                        if (body && typeof body === 'string') {
                            if (
                                !(
                                    con.criteria[i] &&
                                    con.criteria[i].field1 &&
                                    body &&
                                    body.includes([con.criteria[i].field1])
                                )
                            ) {
                                validity = false;
                                failedReasons.push(
                                    `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                                );
                            } else {
                                successReasons.push(
                                    `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                                );
                            }
                        } else if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                body &&
                                body[con.criteria[i].field1]
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'doesNotContain'
                    ) {
                        if (body && typeof body === 'string') {
                            if (
                                !(
                                    con.criteria[i] &&
                                    con.criteria[i].field1 &&
                                    body &&
                                    !body.includes([con.criteria[i].field1])
                                )
                            ) {
                                validity = false;
                                failedReasons.push(
                                    `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                                );
                            } else {
                                successReasons.push(
                                    `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                                );
                            }
                        } else if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                body &&
                                !body[con.criteria[i].field1]
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'jsExpression'
                    ) {
                        const ctx: $TSFixMe = Object.create(null); // Fix against prototype vulnerability
                        ctx.request = { body };
                        const output: $TSFixMe = vm.runInNewContext(
                            con.criteria[i].field1,
                            ctx
                        );
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                body &&
                                output
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseBody} did not have Javascript expression \`${con.criteria[i].field1}\``
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseBody} did have Javascript expression \`${con.criteria[i].field1}\``
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'empty'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].filter &&
                                body &&
                                _.isEmpty(body)
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseBody} was not empty`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseBody} was empty`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEmpty'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].filter &&
                                body &&
                                !_.isEmpty(body)
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseBody} was empty`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseBody} was not empty`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'evaluateResponse'
                    ) {
                        const responseDisplay: $TSFixMe = con.criteria[i].field1
                            ? con.criteria[i].field1.includes(
                                  'response.body'
                              ) &&
                              con.criteria[i].field1.includes(
                                  'response.headers'
                              )
                                ? {
                                      headers: response.headers,
                                      body: response.body,
                                  }
                                : con.criteria[i].field1.includes(
                                      'response.headers'
                                  )
                                ? response.headers
                                : con.criteria[i].field1.includes(
                                      'response.body'
                                  )
                                ? response.body
                                : response
                            : response;

                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                response &&
                                Function(
                                    '"use strict";const  response: string = ' +
                                        JSON.stringify(response) +
                                        ';return (' +
                                        con.criteria[i].field1 +
                                        ');'
                                )()
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.response} \`${JSON.stringify(
                                    responseDisplay
                                )}\` did evaluate \`${con.criteria[i].field1}\``
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.response} \`${JSON.stringify(
                                    responseDisplay
                                )}\` did evaluate \`${con.criteria[i].field1}\``
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'queryString'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'contains'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                queryParams &&
                                queryParams.includes(
                                    con.criteria[i].field1.toLowerCase()
                                )
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'headers'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'contains'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                headers &&
                                headers.includes(
                                    con.criteria[i].field1.toLowerCase()
                                )
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'podStatus'
                ) {
                    const healthyPods: $TSFixMe = [
                        'running',
                        'pending',
                        'succeeded',
                    ];
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !payload.podData.allPods ||
                            payload.podData.allPods.length === 0
                        ) {
                            validity = false;
                            failedReasons.push('Pod is not available');
                        } else {
                            // eslint-disable-next-line no-loop-func
                            payload.podData.allPods.forEach((pod: $TSFixMe) => {
                                if (
                                    con.criteria[i] &&
                                    con.criteria[i].field1 &&
                                    pod.podStatus &&
                                    pod.podStatus.toLowerCase() ===
                                        con.criteria[i].field1.toLowerCase()
                                ) {
                                    successReasons.push(
                                        `${pod.podName} pod status is ${pod.podStatus}`
                                    );
                                } else {
                                    validity = false;
                                    if (
                                        !healthyPods.includes(
                                            pod.podStatus.toLowerCase()
                                        )
                                    ) {
                                        failedReasons.push(
                                            `${pod.podName} pod status is ${pod.podStatus}`
                                        );
                                    }
                                }
                            });
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !payload.podData.allPods ||
                            payload.podData.allPods.length === 0
                        ) {
                            validity = false;
                            failedReasons.push('Pod is not available');
                        } else {
                            // eslint-disable-next-line no-loop-func
                            payload.podData.allPods.forEach((pod: $TSFixMe) => {
                                if (
                                    con.criteria[i] &&
                                    con.criteria[i].field1 &&
                                    pod.podStatus &&
                                    pod.podStatus.toLowerCase() !==
                                        con.criteria[i].field1.toLowerCase()
                                ) {
                                    successReasons.push(
                                        `${pod.podName} pod status is ${pod.podStatus}`
                                    );
                                } else {
                                    validity = false;
                                    if (
                                        !healthyPods.includes(
                                            pod.podStatus.toLowerCase()
                                        )
                                    ) {
                                        failedReasons.push(
                                            `${pod.podName} pod status is ${pod.podStatus}`
                                        );
                                    }
                                }
                            });
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'jobStatus'
                ) {
                    const healthyJobs: $TSFixMe = ['running', 'succeeded'];
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !payload.jobData.allJobs ||
                            payload.jobData.allJobs.length === 0
                        ) {
                            validity = false;
                            failedReasons.push('Job is not available');
                        } else {
                            // eslint-disable-next-line no-loop-func
                            payload.jobData.allJobs.forEach((job: $TSFixMe) => {
                                if (
                                    con.criteria[i] &&
                                    con.criteria[i].field1 &&
                                    job.jobStatus &&
                                    job.jobStatus.toLowerCase() ===
                                        con.criteria[i].field1.toLowerCase()
                                ) {
                                    successReasons.push(
                                        `${job.jobName} job status is ${job.jobStatus}`
                                    );
                                } else {
                                    validity = false;
                                    if (
                                        !healthyJobs.includes(
                                            job.jobStatus.toLowerCase()
                                        )
                                    ) {
                                        failedReasons.push(
                                            `${job.jobName} job status is ${job.jobStatus}`
                                        );
                                    }
                                }
                            });
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !payload.jobData.allJobs ||
                            payload.jobData.allJobs.length === 0
                        ) {
                            validity = false;
                            failedReasons.push('Job is not available');
                        } else {
                            // eslint-disable-next-line no-loop-func
                            payload.jobData.allJobs.forEach((job: $TSFixMe) => {
                                if (
                                    con.criteria[i] &&
                                    con.criteria[i].field1 &&
                                    job.jobStatus &&
                                    job.jobStatus.toLowerCase() !==
                                        con.criteria[i].field1.toLowerCase()
                                ) {
                                    successReasons.push(
                                        `${job.jobName} job status is ${job.jobStatus}`
                                    );
                                } else {
                                    validity = false;
                                    if (
                                        !healthyJobs.includes(
                                            job.jobStatus.toLowerCase()
                                        )
                                    ) {
                                        failedReasons.push(
                                            `${job.jobName} job status is ${job.jobStatus}`
                                        );
                                    }
                                }
                            });
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'desiredDeployment'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !payload.deploymentData.allDeployments ||
                            payload.deploymentData.allDeployments.length === 0
                        ) {
                            validity = false;
                            failedReasons.push('Deployment is not available');
                        } else {
                            payload.deploymentData.allDeployments.forEach(
                                // eslint-disable-next-line no-loop-func
                                (deployment: $TSFixMe) => {
                                    if (
                                        deployment.desiredDeployment ===
                                        deployment.readyDeployment
                                    ) {
                                        successReasons.push(
                                            `${deployment.deploymentName} deployment state is (${deployment.readyDeployment}/${deployment.desiredDeployment})`
                                        );
                                    } else {
                                        validity = false;
                                        failedReasons.push(
                                            `${deployment.deploymentName} deployment state is (${deployment.readyDeployment}/${deployment.desiredDeployment})`
                                        );
                                    }
                                }
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !payload.deploymentData.allDeployments ||
                            payload.deploymentData.allDeployments.length === 0
                        ) {
                            validity = false;
                            failedReasons.push('Deployment is not available');
                        } else {
                            payload.deploymentData.allDeployments.forEach(
                                // eslint-disable-next-line no-loop-func
                                (deployment: $TSFixMe) => {
                                    if (
                                        deployment.desiredDeployment !==
                                        deployment.readyDeployment
                                    ) {
                                        successReasons.push(
                                            `${deployment.deploymentName} deployment state is (${deployment.readyDeployment}/${deployment.desiredDeployment})`
                                        );
                                    } else {
                                        validity = false;
                                        failedReasons.push(
                                            `${deployment.deploymentName} deployment state is (${deployment.readyDeployment}/${deployment.desiredDeployment})`
                                        );
                                    }
                                }
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'desiredStatefulset'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !payload.statefulsetData.allStatefulset ||
                            payload.statefulsetData.allStatefulset.length === 0
                        ) {
                            validity = false;
                            failedReasons.push('Statefulset is not available');
                        } else {
                            payload.statefulsetData.allStatefulset.forEach(
                                // eslint-disable-next-line no-loop-func
                                (statefulset: $TSFixMe) => {
                                    if (
                                        statefulset.desiredStatefulsets ===
                                        statefulset.readyStatefulsets
                                    ) {
                                        successReasons.push(
                                            `${statefulset.statefulsetName} statefulset state is ${statefulset.readyStatefulsets}/${statefulset.desiredStatefulsets}`
                                        );
                                    } else {
                                        validity = false;
                                        failedReasons.push(
                                            `${statefulset.statefulsetName} statefulset state is ${statefulset.readyStatefulsets}/${statefulset.desiredStatefulsets}`
                                        );
                                    }
                                }
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !payload.statefulsetData.allStatefulset ||
                            payload.statefulsetData.allStatefulset.length === 0
                        ) {
                            validity = false;
                            failedReasons.push('Statefulset is not available');
                        } else {
                            payload.statefulsetData.allStatefulset.forEach(
                                // eslint-disable-next-line no-loop-func
                                (statefulset: $TSFixMe) => {
                                    if (
                                        statefulset.desiredStatefulsets !==
                                        statefulset.readyStatefulsets
                                    ) {
                                        successReasons.push(
                                            `${statefulset.statefulsetName} statefulset state is ${statefulset.readyStatefulsets}/${statefulset.desiredStatefulsets}`
                                        );
                                    } else {
                                        validity = false;
                                        failedReasons.push(
                                            `${statefulset.statefulsetName} statefulset state is ${statefulset.readyStatefulsets}/${statefulset.desiredStatefulsets}`
                                        );
                                    }
                                }
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'respondsToPing'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'isUp'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].filter &&
                                !(statusCode === 408 || statusCode === '408')
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Offline`
                            );
                        } else {
                            successReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Online`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'isDown'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].filter &&
                                (statusCode === 408 || statusCode === '408')
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Online`
                            );
                        } else {
                            successReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Offline`
                            );
                        }
                    }
                }
            }
        }
    }
    return validity;
};

const checkOr: Function = (
    payload: $TSFixMe,

    con: $TSFixMe,

    statusCode: $TSFixMe,

    body: $TSFixMe,

    ssl: $TSFixMe,

    response: $TSFixMe,

    successReasons: $TSFixMe,

    failedReasons: $TSFixMe,

    type: $TSFixMe,

    queryParams: $TSFixMe,

    headers: $TSFixMe
): void => {
    let validity: $TSFixMe = false;
    if (con && con.criteria && con.criteria.length > 0) {
        for (let i: $TSFixMe = 0; i < con.criteria.length; i++) {
            if (
                con.criteria[i].criteria &&
                con.criteria[i].criteria.length > 0
            ) {
                if (
                    con.criteria[i].condition &&
                    con.criteria[i].condition === 'or'
                ) {
                    // Check or again

                    const temp1: $TSFixMe = checkOr(
                        payload,
                        con.criteria[i],
                        statusCode,
                        body,
                        ssl,
                        response,
                        successReasons,
                        failedReasons,
                        type,
                        queryParams,
                        headers
                    );
                    if (temp1) {
                        validity = temp1;
                    }
                } else if (
                    con.criteria[i].condition &&
                    con.criteria[i].condition === 'and'
                ) {
                    const temp: $TSFixMe = checkAnd(
                        payload,
                        con.criteria[i],
                        statusCode,
                        body,
                        ssl,
                        response,
                        successReasons,
                        failedReasons,
                        type,
                        queryParams,
                        headers
                    );
                    if (temp) {
                        validity = temp;
                    }
                }
            } else {
                let tempReason = `${payload} min`;
                if (
                    con.criteria[i] &&
                    con.criteria[i].responseType &&
                    con.criteria[i].responseType === 'incomingTime'
                ) {
                    let timeHours: $TSFixMe = 0;
                    let timeMinutes: $TSFixMe = payload;
                    if (timeMinutes > 60) {
                        timeHours = Math.floor(timeMinutes / 60);
                        timeMinutes = Math.floor(timeMinutes % 60);
                        tempReason = `${timeHours} hrs ${timeMinutes} min`;
                    }
                }
                if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'responseTime'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload > Number(con.criteria[i].field1)
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload < Number(con.criteria[i].field1)
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            con.criteria[i].field2 &&
                            payload > Number(con.criteria[i].field1) &&
                            payload < Number(con.criteria[i].field2)
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload === Number(con.criteria[i].field1)
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload !== Number(con.criteria[i].field1)
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload >= Number(con.criteria[i].field1)
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload <= Number(con.criteria[i].field1)
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.responseTime} ${payload} ms`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'incomingTime'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload > con.criteria[i].field1
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload < con.criteria[i].field1
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            con.criteria[i].field2 &&
                            payload > con.criteria[i].field1 &&
                            payload < con.criteria[i].field2
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload === con.criteria[i].field1
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload !== con.criteria[i].field1
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload >= con.criteria[i].field1
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload <= con.criteria[i].field1
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.incomingTime} ${tempReason}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'doesRespond'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'isUp'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].filter &&
                            !(
                                (statusCode === 408 || statusCode === '408') &&
                                body &&
                                body.code &&
                                body.code === 'ENOTFOUND'
                            )
                        ) {
                            validity = true;
                            successReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Online`
                            );
                        } else {
                            failedReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Offline`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'isDown'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].filter &&
                            (statusCode === 408 || statusCode === '408') &&
                            body &&
                            body.code &&
                            body.code === 'ENOTFOUND'
                        ) {
                            validity = true;
                            successReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Offline`
                            );
                        } else {
                            failedReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Online`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'ssl'
                ) {
                    const expiresIn: $TSFixMe = moment(
                        new Date(
                            ssl && ssl.expires ? ssl.expires : Date.now()
                        ).getTime()
                    ).diff(Date.now(), 'days');
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'isValid'
                    ) {
                        if (ssl && !ssl.selfSigned) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.sslCertificate} was valid`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.sslCertificate} was not valid`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notFound'
                    ) {
                        if (!ssl) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.sslCertificate} was not present`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.sslCertificate} was present`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'selfSigned'
                    ) {
                        if (ssl && ssl.selfSigned) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.sslCertificate} was Self-Signed`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.sslCertificate} was not Self-Signed`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'expiresIn30'
                    ) {
                        if (ssl && !ssl.selfSigned && expiresIn < 30) {
                            validity = true;
                            if (expiresIn) {
                                successReasons.push(
                                    `${criteriaStrings.sslCertificate} expires in ${expiresIn} days`
                                );
                            }
                        } else if (expiresIn) {
                            failedReasons.push(
                                `${criteriaStrings.sslCertificate} expires in ${expiresIn} days`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'expiresIn10'
                    ) {
                        if (ssl && !ssl.selfSigned && expiresIn < 10) {
                            validity = true;
                            if (expiresIn) {
                                successReasons.push(
                                    `${criteriaStrings.sslCertificate} expires in ${expiresIn} days`
                                );
                            }
                        } else if (expiresIn) {
                            failedReasons.push(
                                `${criteriaStrings.sslCertificate} expires in ${expiresIn} days`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'statusCode'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            statusCode &&
                            statusCode > con.criteria[i].field1
                        ) {
                            validity = true;
                            if (statusCode === 408 || statusCode === '408') {
                                successReasons.push('Request Timed out');
                            } else {
                                successReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            failedReasons.push('Request Timed out');
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            statusCode &&
                            statusCode < con.criteria[i].field1
                        ) {
                            validity = true;
                            if (statusCode === 408 || statusCode === '408') {
                                successReasons.push('Request Timed out');
                            } else {
                                successReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            failedReasons.push('Request Timed out');
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            statusCode &&
                            con.criteria[i].field2 &&
                            statusCode > con.criteria[i].field1 &&
                            statusCode < con.criteria[i].field2
                        ) {
                            validity = true;
                            if (statusCode === 408 || statusCode === '408') {
                                successReasons.push('Request Timed out');
                            } else {
                                successReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            failedReasons.push('Request Timed out');
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            statusCode &&
                            statusCode === con.criteria[i].field1
                        ) {
                            validity = true;
                            if (statusCode === 408 || statusCode === '408') {
                                successReasons.push('Request Timed out');
                            } else {
                                successReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            failedReasons.push('Request Timed out');
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            statusCode &&
                            statusCode !== con.criteria[i].field1
                        ) {
                            validity = true;
                            if (statusCode === 408 || statusCode === '408') {
                                successReasons.push('Request Timed out');
                            } else {
                                successReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            failedReasons.push('Request Timed out');
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            statusCode &&
                            statusCode >= con.criteria[i].field1
                        ) {
                            validity = true;
                            if (statusCode === 408 || statusCode === '408') {
                                successReasons.push('Request Timed out');
                            } else {
                                successReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            failedReasons.push('Request Timed out');
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            statusCode &&
                            statusCode <= con.criteria[i].field1
                        ) {
                            validity = true;
                            if (statusCode === 408 || statusCode === '408') {
                                successReasons.push('Request Timed out');
                            } else {
                                successReasons.push(
                                    `${criteriaStrings.statusCode} ${statusCode}`
                                );
                            }
                        } else if (statusCode === 408 || statusCode === '408') {
                            failedReasons.push('Request Timed out');
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.statusCode} ${statusCode}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'cpuLoad'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.cpuLoad &&
                            payload.cpuLoad > con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.cpuLoad !== null) {
                                successReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            failedReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.cpuLoad &&
                            payload.cpuLoad < con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.cpuLoad !== null) {
                                successReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            failedReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.cpuLoad &&
                            con.criteria[i].field2 &&
                            payload.cpuLoad > con.criteria[i].field1 &&
                            payload.cpuLoad < con.criteria[i].field2
                        ) {
                            validity = true;
                            if (payload && payload.cpuLoad !== null) {
                                successReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            failedReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.cpuLoad &&
                            payload.cpuLoad === con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.cpuLoad !== null) {
                                successReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            failedReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.cpuLoad &&
                            payload.cpuLoad !== con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.cpuLoad !== null) {
                                successReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            failedReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.cpuLoad &&
                            payload.cpuLoad >= con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.cpuLoad !== null) {
                                successReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            failedReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.cpuLoad &&
                            payload.cpuLoad <= con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.cpuLoad !== null) {
                                successReasons.push(
                                    `${criteriaStrings.cpuLoad} ${formatDecimal(
                                        payload.cpuLoad,
                                        2
                                    )} %`
                                );
                            }
                        } else if (payload && payload.cpuLoad !== null) {
                            failedReasons.push(
                                `${criteriaStrings.cpuLoad} ${formatDecimal(
                                    payload.cpuLoad,
                                    2
                                )} %`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'memoryUsage'
                ) {
                    const memoryUsedBytes: $TSFixMe = payload
                        ? parseInt(payload.memoryUsed || 0)
                        : 0;
                    const memoryUsed: $TSFixMe =
                        memoryUsedBytes / Math.pow(1e3, 3);
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            memoryUsed &&
                            memoryUsed > con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.memoryUsed !== null) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            failedReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            memoryUsed &&
                            memoryUsed < con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.memoryUsed !== null) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            failedReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            memoryUsed &&
                            con.criteria[i].field2 &&
                            memoryUsed > con.criteria[i].field1 &&
                            memoryUsed < con.criteria[i].field2
                        ) {
                            validity = true;
                            if (payload && payload.memoryUsed !== null) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            failedReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            memoryUsed &&
                            memoryUsed === con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.memoryUsed !== null) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            failedReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            memoryUsed &&
                            memoryUsed !== con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.memoryUsed !== null) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            failedReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            memoryUsed &&
                            memoryUsed >= con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.memoryUsed !== null) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            failedReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            memoryUsed &&
                            memoryUsed <= con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.memoryUsed !== null) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.memoryUsed
                                    } ${formatBytes(memoryUsedBytes)}`
                                );
                            }
                        } else if (payload && payload.memoryUsed !== null) {
                            failedReasons.push(
                                `${criteriaStrings.memoryUsed} ${formatBytes(
                                    memoryUsedBytes
                                )}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'storageUsage'
                ) {
                    const size: $TSFixMe = payload
                        ? parseInt(payload.totalStorage || 0)
                        : 0;
                    const used: $TSFixMe = payload
                        ? parseInt(payload.storageUsed || 0)
                        : 0;
                    const freeBytes: $TSFixMe = size - used;
                    const free: $TSFixMe = freeBytes / Math.pow(1e3, 3);
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            free > con.criteria[i].field1
                        ) {
                            validity = true;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            failedReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            free < con.criteria[i].field1
                        ) {
                            validity = true;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            failedReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            con.criteria[i].field2 &&
                            free > con.criteria[i].field1 &&
                            free < con.criteria[i].field2
                        ) {
                            validity = true;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            failedReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            free === con.criteria[i].field1
                        ) {
                            validity = true;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            failedReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            free !== con.criteria[i].field1
                        ) {
                            validity = true;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            failedReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            free >= con.criteria[i].field1
                        ) {
                            validity = true;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            failedReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            free <= con.criteria[i].field1
                        ) {
                            validity = true;
                            if (
                                payload &&
                                payload.totalStorage !== null &&
                                payload.storageUsed !== null
                            ) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.freeStorage
                                    } ${formatBytes(freeBytes)}`
                                );
                            }
                        } else if (
                            payload &&
                            payload.totalStorage !== null &&
                            payload.storageUsed !== null
                        ) {
                            failedReasons.push(
                                `${criteriaStrings.freeStorage} ${formatBytes(
                                    freeBytes
                                )}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'temperature'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'greaterThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.mainTemp &&
                            payload.mainTemp > con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.mainTemp !== null) {
                                successReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            failedReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'lessThan'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.mainTemp &&
                            payload.mainTemp < con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.mainTemp !== null) {
                                successReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            failedReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'inBetween'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.mainTemp &&
                            con.criteria[i].field2 &&
                            payload.mainTemp > con.criteria[i].field1 &&
                            payload.mainTemp < con.criteria[i].field2
                        ) {
                            validity = true;
                            if (payload && payload.mainTemp !== null) {
                                successReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            failedReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.mainTemp &&
                            payload.mainTemp === con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.mainTemp !== null) {
                                successReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            failedReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.mainTemp &&
                            payload.mainTemp !== con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.mainTemp !== null) {
                                successReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            failedReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'gtEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.mainTemp &&
                            payload.mainTemp >= con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.mainTemp !== null) {
                                successReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            failedReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'ltEqualTo'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            payload &&
                            payload.mainTemp &&
                            payload.mainTemp <= con.criteria[i].field1
                        ) {
                            validity = true;
                            if (payload && payload.mainTemp !== null) {
                                successReasons.push(
                                    `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                                );
                            }
                        } else if (payload && payload.mainTemp !== null) {
                            failedReasons.push(
                                `${criteriaStrings.temperature} ${payload.mainTemp} °C`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'responseBody'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'contains'
                    ) {
                        if (body && typeof body === 'string') {
                            if (
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                body &&
                                body.includes([con.criteria[i].field1])
                            ) {
                                validity = true;
                                if (con.criteria[i].field1) {
                                    successReasons.push(
                                        `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                                    );
                                }
                            } else if (con.criteria[i].field1) {
                                failedReasons.push(
                                    `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                                );
                            }
                        } else if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            body &&
                            body[con.criteria[i].field1]
                        ) {
                            validity = true;
                            if (con.criteria[i].field1) {
                                successReasons.push(
                                    `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                                );
                            }
                        } else if (con.criteria[i].field1) {
                            failedReasons.push(
                                `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'doesNotContain'
                    ) {
                        if (body && typeof body === 'string') {
                            if (
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                body &&
                                !body.includes([con.criteria[i].field1])
                            ) {
                                validity = true;
                                if (con.criteria[i].field1) {
                                    successReasons.push(
                                        `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                                    );
                                }
                            } else if (con.criteria[i].field1) {
                                failedReasons.push(
                                    `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                                );
                            }
                        } else if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            body &&
                            !body[con.criteria[i].field1]
                        ) {
                            validity = true;
                            if (con.criteria[i].field1) {
                                successReasons.push(
                                    `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                                );
                            }
                        } else if (con.criteria[i].field1) {
                            failedReasons.push(
                                `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'jsExpression'
                    ) {
                        const ctx: $TSFixMe = Object.create(null); // Fix against prototype vulnerability
                        ctx.request = { body };
                        const output: $TSFixMe = vm.runInNewContext(
                            con.criteria[i].field1,
                            ctx
                        );
                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            body &&
                            output
                        ) {
                            validity = true;
                            if (con.criteria[i].field1) {
                                successReasons.push(
                                    `${criteriaStrings.responseBody} contains Javascript expression ${con.criteria[i].field1}`
                                );
                            }
                        } else if (con.criteria[i].field1) {
                            failedReasons.push(
                                `${criteriaStrings.responseBody} does not contain Javascript expression ${con.criteria[i].field1}`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'empty'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].filter &&
                            body &&
                            _.isEmpty(body)
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.responseBody} was empty`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.responseBody} was not empty`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEmpty'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].filter &&
                            body &&
                            !_.isEmpty(body)
                        ) {
                            validity = true;
                            successReasons.push(
                                `${criteriaStrings.responseBody} was not empty`
                            );
                        } else {
                            failedReasons.push(
                                `${criteriaStrings.responseBody} was empty`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'evaluateResponse'
                    ) {
                        const responseDisplay: $TSFixMe = con.criteria[i].field1
                            ? con.criteria[i].field1.includes(
                                  'response.body'
                              ) &&
                              con.criteria[i].field1.includes(
                                  'response.headers'
                              )
                                ? {
                                      headers: response.headers,
                                      body: response.body,
                                  }
                                : con.criteria[i].field1.includes(
                                      'response.headers'
                                  )
                                ? response.headers
                                : con.criteria[i].field1.includes(
                                      'response.body'
                                  )
                                ? response.body
                                : response
                            : response;

                        if (
                            con.criteria[i] &&
                            con.criteria[i].field1 &&
                            response &&
                            Function(
                                '"use strict";const  response: string = ' +
                                    JSON.stringify(response) +
                                    ';return (' +
                                    con.criteria[i].field1 +
                                    ');'
                            )()
                        ) {
                            validity = true;
                            if (con.criteria[i].field1) {
                                successReasons.push(
                                    `${
                                        criteriaStrings.response
                                    } \`${JSON.stringify(
                                        responseDisplay
                                    )}\` evaluate \`${con.criteria[i].field1}\``
                                );
                            }
                        } else if (con.criteria[i].field1) {
                            failedReasons.push(
                                `${criteriaStrings.response} \`${JSON.stringify(
                                    responseDisplay
                                )}\` did not evaluate \`${
                                    con.criteria[i].field1
                                }\``
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'queryString'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'contains'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                queryParams &&
                                queryParams.includes(
                                    con.criteria[i].field1.toLowerCase()
                                )
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'headers'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'contains'
                    ) {
                        if (
                            !(
                                con.criteria[i] &&
                                con.criteria[i].field1 &&
                                headers &&
                                headers.includes(
                                    con.criteria[i].field1.toLowerCase()
                                )
                            )
                        ) {
                            validity = false;
                            failedReasons.push(
                                `${criteriaStrings.responseBody} did not contain ${con.criteria[i].field1}`
                            );
                        } else {
                            successReasons.push(
                                `${criteriaStrings.responseBody} contains ${con.criteria[i].field1}`
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'podStatus'
                ) {
                    const healthyPods: $TSFixMe = [
                        'running',
                        'pending',
                        'succeeded',
                    ];
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !payload.podData.allPods ||
                            payload.podData.allPods.length === 0
                        ) {
                            failedReasons.push('Pod is not available');
                        } else {
                            // eslint-disable-next-line no-loop-func
                            payload.podData.allPods.forEach((pod: $TSFixMe) => {
                                if (
                                    con.criteria[i] &&
                                    con.criteria[i].field1 &&
                                    pod.podStatus &&
                                    pod.podStatus.toLowerCase() ===
                                        con.criteria[i].field1.toLowerCase()
                                ) {
                                    validity = true;
                                    successReasons.push(
                                        `${pod.podName} pod status is ${pod.podStatus}`
                                    );
                                } else if (
                                    !healthyPods.includes(
                                        pod.podStatus.toLowerCase()
                                    )
                                ) {
                                    failedReasons.push(
                                        `${pod.podName} pod status is ${pod.podStatus}`
                                    );
                                }
                            });
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !payload.podData.allPods ||
                            payload.podData.allPods.length === 0
                        ) {
                            failedReasons.push('Pod is not available');
                        } else {
                            // eslint-disable-next-line no-loop-func
                            payload.podData.allPods.forEach((pod: $TSFixMe) => {
                                if (
                                    con.criteria[i] &&
                                    con.criteria[i].field1 &&
                                    pod.podStatus &&
                                    pod.podStatus.toLowerCase() !==
                                        con.criteria[i].field1.toLowerCase()
                                ) {
                                    validity = true;
                                    successReasons.push(
                                        `${pod.podName} pod status is ${pod.podStatus}`
                                    );
                                } else if (
                                    !healthyPods.includes(
                                        pod.podStatus.toLowerCase()
                                    )
                                ) {
                                    failedReasons.push(
                                        `${pod.podName} pod status is ${pod.podStatus}`
                                    );
                                }
                            });
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'jobStatus'
                ) {
                    const healthyJobs: $TSFixMe = ['running', 'succeeded'];
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !payload.jobData.allJobs ||
                            payload.jobData.allJobs.length === 0
                        ) {
                            failedReasons.push('Job is not available');
                        } else {
                            // eslint-disable-next-line no-loop-func
                            payload.jobData.allJobs.forEach((job: $TSFixMe) => {
                                if (
                                    con.criteria[i] &&
                                    con.criteria[i].field1 &&
                                    job.jobStatus &&
                                    job.jobStatus.toLowerCase() ===
                                        con.criteria[i].field1.toLowerCase()
                                ) {
                                    validity = true;
                                    successReasons.push(
                                        `${job.jobName} job status is ${job.jobStatus}`
                                    );
                                } else if (
                                    !healthyJobs.includes(
                                        job.jobStatus.toLowerCase()
                                    )
                                ) {
                                    failedReasons.push(
                                        `${job.jobName} job status is ${job.jobStatus}`
                                    );
                                }
                            });
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !payload.jobData.allJobs ||
                            payload.jobData.allJobs.length === 0
                        ) {
                            failedReasons.push('Job is not available');
                        } else {
                            // eslint-disable-next-line no-loop-func
                            payload.jobData.allJobs.forEach((job: $TSFixMe) => {
                                if (
                                    con.criteria[i] &&
                                    con.criteria[i].field1 &&
                                    job.jobStatus &&
                                    job.jobStatus.toLowerCase() !==
                                        con.criteria[i].field1.toLowerCase()
                                ) {
                                    validity = true;
                                    successReasons.push(
                                        `${job.jobName} job status is ${job.jobStatus}`
                                    );
                                } else if (
                                    !healthyJobs.includes(
                                        job.jobStatus.toLowerCase()
                                    )
                                ) {
                                    failedReasons.push(
                                        `${job.jobName} job status is ${job.jobStatus}`
                                    );
                                }
                            });
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'desiredDeployment'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !payload.deploymentData.allDeployments ||
                            payload.deploymentData.allDeployments.length === 0
                        ) {
                            failedReasons.push('Deployment is not available');
                        } else {
                            payload.deploymentData.allDeployments.forEach(
                                // eslint-disable-next-line no-loop-func
                                (deployment: $TSFixMe) => {
                                    if (
                                        deployment.desiredDeployment ===
                                        deployment.readyDeployment
                                    ) {
                                        validity = true;
                                        successReasons.push(
                                            `${deployment.deploymentName} deployment state is ${deployment.readyDeployment}/${deployment.desiredDeployment}`
                                        );
                                    } else {
                                        failedReasons.push(
                                            `${deployment.deploymentName} deployment state is ${deployment.readyDeployment}/${deployment.desiredDeployment}`
                                        );
                                    }
                                }
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !payload.deploymentData.allDeployments ||
                            payload.deploymentData.allDeployments.length === 0
                        ) {
                            failedReasons.push('Deployment is not available');
                        } else {
                            payload.deploymentData.allDeployments.forEach(
                                // eslint-disable-next-line no-loop-func
                                (deployment: $TSFixMe) => {
                                    if (
                                        deployment.desiredDeployment !==
                                        deployment.readyDeployment
                                    ) {
                                        validity = true;
                                        successReasons.push(
                                            `${deployment.deploymentName} deployment state is ${deployment.readyDeployment}/${deployment.desiredDeployment}`
                                        );
                                    } else {
                                        failedReasons.push(
                                            `${deployment.deploymentName} deployment state is ${deployment.readyDeployment}/${deployment.desiredDeployment}`
                                        );
                                    }
                                }
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'desiredStatefulsets'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'equalTo'
                    ) {
                        if (
                            !payload.statefulsetData.allStatefulset ||
                            payload.statefulsetData.allStatefulset.length === 0
                        ) {
                            failedReasons.push('Statefulset is not available');
                        } else {
                            payload.statefulsetData.allStatefulset.forEach(
                                // eslint-disable-next-line no-loop-func
                                (statefulset: $TSFixMe) => {
                                    if (
                                        statefulset.desiredStatefulsets ===
                                        statefulset.readyStatefulsets
                                    ) {
                                        validity = true;
                                        successReasons.push(
                                            `${statefulset.statefulsetName} statefulset state is ${statefulset.readyStatefulsets}/${statefulset.desiredStatefulsets}`
                                        );
                                    } else {
                                        failedReasons.push(
                                            `${statefulset.statefulsetName} statefulset state is ${statefulset.readyStatefulsets}/${statefulset.desiredStatefulsets}`
                                        );
                                    }
                                }
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'notEqualTo'
                    ) {
                        if (
                            !payload.statefulsetData.allStatefulset ||
                            payload.statefulsetData.allStatefulset.length === 0
                        ) {
                            failedReasons.push('Statefulset is not available');
                        } else {
                            payload.statefulsetData.allStatefulset.forEach(
                                // eslint-disable-next-line no-loop-func
                                (statefulset: $TSFixMe) => {
                                    if (
                                        statefulset.desiredStatefulsets !==
                                        statefulset.readyStatefulsets
                                    ) {
                                        validity = true;
                                        successReasons.push(
                                            `${statefulset.statefulsetName} statefulset state is ${statefulset.readyStatefulsets}/${statefulset.desiredStatefulsets}`
                                        );
                                    } else {
                                        failedReasons.push(
                                            `${statefulset.statefulsetName} statefulset state is ${statefulset.readyStatefulsets}/${statefulset.desiredStatefulsets}`
                                        );
                                    }
                                }
                            );
                        }
                    }
                } else if (
                    con.criteria[i] &&
                    con.criteria[i].responseType === 'respondsToPing'
                ) {
                    if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'isUp'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].filter &&
                            !(statusCode === 408 || statusCode === '408')
                        ) {
                            validity = true;
                            successReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Online`
                            );
                        } else {
                            failedReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Offline`
                            );
                        }
                    } else if (
                        con.criteria[i] &&
                        con.criteria[i].filter &&
                        con.criteria[i].filter === 'isDown'
                    ) {
                        if (
                            con.criteria[i] &&
                            con.criteria[i].filter &&
                            (statusCode === 408 || statusCode === '408')
                        ) {
                            validity = true;
                            successReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Offline`
                            );
                        } else {
                            failedReasons.push(
                                `${
                                    criteriaStrings[type] || 'Monitor was'
                                } Online`
                            );
                        }
                    }
                }
            }
        }
    }
    return validity;
};

/**
 * Verifies if a specific script condition satisfies
 * @param {'and' | 'or'} conditionLogic
 * @returns {{ valid : boolean, reason : string} | undefined} whether the condition is satisfied
 */

const checkScriptCondition: Function = (
    condition: $TSFixMe,
    body: $TSFixMe
): void => {
    if (!condition || !condition.responseType) {
        return;
    }
    /**
     * @type { {valid : boolean, reason : string}}
     */
    const validity: $TSFixMe = {};

    if (!condition.filter || !body || !condition.responseType) {
        return;
    }

    if (condition.responseType === 'scriptExecution') {
        /*
         * We need a catch-all for server-defined
         * Script timeout errors or terminated scripts
         */
        if (body.statusText === 'timeout') {
            validity.valid = false;

            validity.reason = body.error;
            return validity;
        }

        if (condition.filter === 'throwsError') {
            if (body.statusText === 'failed' && body.error) {
                validity.valid = true;

                validity.reason = `Script threw error ${body.error}`;
            } else {
                validity.valid = false;

                validity.reason = `Script did not throw error`;
            }
        } else if (condition.filter === 'doesNotThrowError') {
            if (body.statusText === 'failed' && body.error) {
                validity.valid = false;

                validity.reason = `Script threw error ${body.error}`;
            } else {
                validity.valid = true;

                validity.reason = `Script did not throw error`;
            }
        } else if (condition.filter === 'emptyCallback') {
            if (body.statusText === 'nonEmptyCallback' && body.error) {
                validity.valid = false;

                validity.reason = `Script callback invoked with arguments ${JSON.stringify(
                    body.error
                )}`;
            } else {
                validity.valid = true;

                validity.reason = `Script callback has no arguments`;
            }
        } else if (condition.filter === 'nonEmptyCallback') {
            if (body.statusText === 'nonEmptyCallback' && body.error) {
                validity.valid = true;

                validity.reason = `Script callback invoked with arguments ${JSON.stringify(
                    body.error
                )}`;
            } else {
                validity.valid = false;

                validity.reason = `Script callback has no arguments`;
            }
        }
    } else if (condition.responseType === 'executionTime') {
        if (condition.filter === 'executesIn') {
            if (body.executionTime <= condition.filter1) {
                validity.valid = true;

                validity.reason = `Script executed in ${body.executionTime}ms within ${condition.filter1}ms limit`;
            } else {
                validity.valid = false;

                validity.reason = `Script executed above ${condition.filter1}ms limit`;
            }
        } else if (condition.filter === 'doesNotExecuteIn') {
            if (body.executionTime >= condition.filter1) {
                validity.valid = true;

                validity.reason = `Script executed in ${body.executionTime}ms above ${condition.filter1}ms minimum`;
            } else {
                validity.valid = false;

                validity.reason = `Script executed below ${condition.filter1}ms minimum`;
            }
        }
    } else {
        // If for some strange reason
        return;
    }

    return validity;
};

const checkScriptAnd: Function = (
    con: $TSFixMe,
    body: $TSFixMe,
    successReasons: $TSFixMe,
    failedReasons: $TSFixMe
): void => {
    let valid: $TSFixMe = true;
    if (con && con.criteria && con.criteria.length > 0) {
        for (let i: $TSFixMe = 0; i < con.criteria.length; i++) {
            if (
                con.criteria[i].criteria &&
                con.criteria[i].criteria.length > 0
            ) {
                if (
                    con.criteria[i].condition &&
                    con.criteria[i].condition === 'and'
                ) {
                    // Check script and
                    const subConditionValid: $TSFixMe = checkScriptAnd(
                        con.criteria[i],
                        body,
                        successReasons,
                        failedReasons
                    );
                    if (!subConditionValid) {
                        valid = false;
                    }
                } else if (
                    con.criteria[i].condition &&
                    con.criteria[i].condition === 'or'
                ) {
                    // Check script or
                    const subConditionValid: $TSFixMe = checkScriptOr(
                        con.criteria[i],
                        body,
                        successReasons,
                        failedReasons
                    );
                    if (!subConditionValid) {
                        valid = false;
                    }
                }
            } else {
                const validity: $TSFixMe = checkScriptCondition(
                    con.criteria[i],
                    body
                );
                if (validity) {
                    if (validity.valid) {
                        successReasons.push(validity.reason);
                    } else {
                        valid = false;

                        failedReasons.push(validity.reason);
                    }
                }
            }
        }
    }

    return valid;
};

const checkScriptOr: Function = (
    con: $TSFixMe,
    body: $TSFixMe,
    successReasons: $TSFixMe,
    failedReasons: $TSFixMe
): void => {
    let valid: $TSFixMe = false;
    if (con && con.criteria && con.criteria.length > 0) {
        for (let i: $TSFixMe = 0; i < con.criteria.length; i++) {
            if (
                con.criteria[i].criteria &&
                con.criteria[i].criteria.length > 0
            ) {
                if (
                    con.criteria[i].condition &&
                    con.criteria[i].condition === 'or'
                ) {
                    // Check script or
                    const subConditionValid: $TSFixMe = checkScriptOr(
                        con.criteria[i],
                        body,
                        successReasons,
                        failedReasons
                    );
                    if (subConditionValid) {
                        valid = true;
                    }
                } else if (
                    con.criteria[i].condition &&
                    con.criteria[i].condition === 'and'
                ) {
                    // Check script and
                    const subConditionValid: $TSFixMe = checkScriptAnd(
                        con.criteria[i],
                        body,
                        successReasons,
                        failedReasons
                    );
                    if (subConditionValid) {
                        valid = true;
                    }
                }
            } else {
                const validity: $TSFixMe = checkScriptCondition(
                    con.criteria[i],
                    body
                );
                if (validity) {
                    if (validity.valid) {
                        valid = true;

                        successReasons.push(validity.reason);
                    } else {
                        failedReasons.push(validity.reason);
                    }
                }
            }
        }
    }

    return valid;
};

const criteriaStrings: $TSFixMe = {
    responseTime: 'Response Time is',
    sslCertificate: 'SSL Certificate',
    statusCode: 'Status Code is',
    cpuLoad: 'CPU Load is',
    memoryUsed: 'Memory Used is',
    freeStorage: 'Free Storage is',
    temperature: 'Temperature is',
    responseBody: 'Response Body',
    response: 'Response',
    incomingTime: 'Incoming request time interval is',
    'server-monitor': 'Server is',
    url: 'Website is',
    api: 'API is',
    incomingHttpRequest: 'Incoming request is',
    ip: 'IP is',
};

const formatDecimal: Function = (
    value: $TSFixMe,
    decimalPlaces: $TSFixMe,
    roundType: $TSFixMe
): void => {
    let formattedNumber: $TSFixMe;
    switch (roundType) {
        case 'up':
            formattedNumber = Math.ceil(
                parseFloat(value + 'e' + decimalPlaces)
            );
            break;
        case 'down':
            formattedNumber = Math.floor(
                parseFloat(value + 'e' + decimalPlaces)
            );
            break;
        default:
            formattedNumber = Math.round(
                parseFloat(value + 'e' + decimalPlaces)
            );
    }
    return Number(formattedNumber + 'e-' + decimalPlaces).toFixed(
        decimalPlaces
    );
};

const formatBytes: Function = (
    a: $TSFixMe,
    b: $TSFixMe,
    c: $TSFixMe,
    d: $TSFixMe,
    e: $TSFixMe
): void => {
    let value: $TSFixMe = a;
    let decimalPlaces: $TSFixMe;
    let roundType: $TSFixMe;
    if (typeof a === 'object') {
        value = a.value;
        decimalPlaces = a.decimalPlaces;
        roundType = a.roundType;
    }
    return (
        formatDecimal(
            ((b = Math),
            (c = b.log),
            (d = 1e3),
            (e = (c(value) / c(d)) | 0),
            value / b.pow(d, e)),
            decimalPlaces >= 0 ? decimalPlaces : 2,
            roundType
        ) +
        ' ' +
        (e ? 'kMGTPEZY'[--e] + 'B' : 'Bytes')
    );
};
