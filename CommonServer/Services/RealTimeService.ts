import API from 'Common/Utils/API';
import { RealtimeHostname, HttpProtocol, ClusterKey } from '../Config';
import { JSONObjectOrArray } from 'Common/Types/JSON';
import Hostname from 'Common/Types/API/Hostname';
import Route from 'Common/Types/API/Route';
import Headers from 'Common/Types/API/Headers';
import ObjectID from 'Common/Types/ObjectID';
import HTTPResponse from 'Common/Types/API/Response';

export default class Service {
    private api: API;
    private headers: Headers;

    public constructor() {
        this.api = new API(HttpProtocol, new Hostname(RealtimeHostname));
        this.headers = {
            CLUSTER_KEY: ClusterKey.toString(),
        };
    }

    public async send(
        projectId: ObjectID,
        eventType: string,
        data: JSONObjectOrArray
    ): Promise<HTTPResponse> {
        return await this.api.post(
            new Route(`/send-created-incident`),
            {
                projectId,
                eventType,
                data,
            },
            this.headers
        );
    }
}
