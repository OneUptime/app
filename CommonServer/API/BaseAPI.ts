import BaseModel from 'Common/Models/BaseModel';
import DatabaseService from '../Services/DatabaseService';
import Express, {
    ExpressRequest,
    ExpressResponse,
    ExpressRouter,
    NextFunction,
    OneUptimeRequest,
} from '../Utils/Express';
import UserMiddleware from '../Middleware/UserAuthorization';
import PositiveNumber from 'Common/Types/PositiveNumber';
import BadRequestException from 'Common/Types/Exception/BadRequestException';
import Response from '../Utils/Response';
import ObjectID from 'Common/Types/ObjectID';
import { JSONFunctions, JSONObject } from 'Common/Types/JSON';
import CreateBy from '../Types/Database/CreateBy';
import DatabaseCommonInteractionProps from 'Common/Types/Database/DatabaseCommonInteractionProps';
import Query from '../Types/Database/Query';
import Select from '../Types/Database/Select';

export default class BaseAPI<
    TBaseModel extends BaseModel,
    TBaseService extends DatabaseService<BaseModel>
> {
    private entityType: { new (): TBaseModel };

    public router: ExpressRouter;
    private service: TBaseService;

    public constructor(type: { new (): TBaseModel }, service: TBaseService) {
        this.entityType = type;
        const router: ExpressRouter = Express.getRouter();

        // Create
        router.post(
            `/${new this.entityType().getCrudApiPath()?.toString()}`,
            UserMiddleware.getUserMiddleware,
            async (
                req: ExpressRequest,
                res: ExpressResponse,
                next: NextFunction
            ) => {
                try {
                    await this.createItem(req, res);
                } catch (err) {
                    next(err);
                }
            }
        );

        // List
        router.post(
            `/${new this.entityType().getCrudApiPath()?.toString()}/get`,
            UserMiddleware.getUserMiddleware,
            async (
                req: ExpressRequest,
                res: ExpressResponse,
                next: NextFunction
            ) => {
                try {
                    await this.getList(req, res);
                } catch (err) {
                    next(err);
                }
            }
        );

        // Get Item
        router.get(
            `/${new this.entityType().getCrudApiPath()?.toString()}/:id`,
            UserMiddleware.getUserMiddleware,
            async (
                req: ExpressRequest,
                res: ExpressResponse,
                next: NextFunction
            ) => {
                try {
                    await this.getItem(req, res);
                } catch (err) {
                    next(err);
                }
            }
        );

        // Update
        router.put(
            `/${new this.entityType().getCrudApiPath()?.toString()}/:id`,
            UserMiddleware.getUserMiddleware,
            async (
                req: ExpressRequest,
                res: ExpressResponse,
                next: NextFunction
            ) => {
                try {
                    await this.updateItem(req, res);
                } catch (err) {
                    next(err);
                }
            }
        );

        // Delete
        router.delete(
            `/${new this.entityType().getCrudApiPath()?.toString()}/:id`,
            UserMiddleware.getUserMiddleware,
            async (
                req: ExpressRequest,
                res: ExpressResponse,
                next: NextFunction
            ) => {
                try {
                    await this.deleteItem(req, res);
                } catch (err) {
                    next(err);
                }
            }
        );

        this.router = router;
        this.service = service;
    }

    public getDatabaseCommonInteractionProps(
        req: ExpressRequest
    ): DatabaseCommonInteractionProps {
        const props: DatabaseCommonInteractionProps = {
            projectId: undefined,
            userGlobalAccessPermission: undefined,
            userProjectAccessPermission: undefined,
            userId: undefined,
            userType: undefined,
        };

        if (
            (req as OneUptimeRequest).userAuthorization &&
            (req as OneUptimeRequest).userAuthorization?.userId
        ) {
            props.userId = (req as OneUptimeRequest).userAuthorization.userId;
        }

        if ((req as OneUptimeRequest).userGlobalAccessPermission) {
            props.userGlobalAccessPermission = (
                req as OneUptimeRequest
            ).userGlobalAccessPermission;
        }

        if ((req as OneUptimeRequest).userProjectAccessPermission) {
            props.userProjectAccessPermission = (
                req as OneUptimeRequest
            ).userProjectAccessPermission;
        }

        if ((req as OneUptimeRequest).projectId) {
            props.projectId = (req as OneUptimeRequest).projectId || undefined;
        }

        return props;
    }

    public async getList(
        req: ExpressRequest,
        res: ExpressResponse
    ): Promise<void> {
        const skip: PositiveNumber = req.query['skip']
            ? new PositiveNumber(req.query['skip'] as string)
            : new PositiveNumber(0);

        const limit: PositiveNumber = req.query['limit']
            ? new PositiveNumber(req.query['limit'] as string)
            : new PositiveNumber(10);

        if (limit.toNumber() > 50) {
            throw new BadRequestException('Limit should be less than 50');
        }

        let query: Query<BaseModel> = {};
        let select: Select<BaseModel> = {};

        if (req.body && req.body['data']) {
            query = JSONFunctions.deserialize(
                req.body['data']['query']
            ) as Query<BaseModel>;
            select = JSONFunctions.deserialize(
                req.body['data']['select']
            ) as Select<BaseModel>;
        }

        const list: Array<BaseModel> = await this.service.findBy({
            query,
            select,
            skip: skip,
            limit: limit,
            props: this.getDatabaseCommonInteractionProps(req),
        });

        const count: PositiveNumber = await this.service.countBy({
            query: {},
            props: this.getDatabaseCommonInteractionProps(req),
        });

        return Response.sendListResponse(req, res, list, count);
    }

    public async getItem(
        req: ExpressRequest,
        res: ExpressResponse
    ): Promise<void> {
        const objectId: ObjectID = new ObjectID(req.params['id'] as string);

        const item: BaseModel | null = await this.service.findOneById({
            id: objectId,
            props: this.getDatabaseCommonInteractionProps(req),
        });

        return Response.sendItemResponse(req, res, item?.toJSON() || {});
    }

    public async deleteItem(
        req: ExpressRequest,
        res: ExpressResponse
    ): Promise<void> {
        const objectId: ObjectID = new ObjectID(req.params['id'] as string);

        await this.service.deleteBy({
            query: {
                _id: objectId.toString(),
            },
            props: this.getDatabaseCommonInteractionProps(req),
        });

        return Response.sendEmptyResponse(req, res);
    }

    public async updateItem(
        req: ExpressRequest,
        res: ExpressResponse
    ): Promise<void> {
        const objectId: ObjectID = new ObjectID(req.params['id'] as string);
        const objectIdString: string = objectId.toString();
        const body: JSONObject = req.body;

        const item: TBaseModel = BaseModel.fromJSON<TBaseModel>(
            body['data'],
            this.entityType
        ) as TBaseModel;

        // @ts-ignore
        await this.service.updateBy({
            query: {
                _id: objectIdString,
            },
            data: item,
            props: this.getDatabaseCommonInteractionProps(req),
        });

        return Response.sendEmptyResponse(req, res);
    }

    public async createItem(
        req: ExpressRequest,
        res: ExpressResponse
    ): Promise<void> {
        const body: JSONObject = req.body;

        const item: TBaseModel = BaseModel.fromJSON<TBaseModel>(
            body['data'],
            this.entityType
        ) as TBaseModel;

        const createBy: CreateBy<TBaseModel> = {
            data: item,
            props: this.getDatabaseCommonInteractionProps(req),
        };

        const savedItem: BaseModel = await this.service.create(createBy);

        return Response.sendItemResponse(req, res, savedItem);
    }

    public getRouter(): ExpressRouter {
        return this.router;
    }

    public getEntityName(): string {
        return this.entityType.name;
    }
}
