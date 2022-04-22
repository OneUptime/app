import Express, {
    ExpressRequest,
    ExpressResponse,
    ExpressRouter,
} from 'CommonServer/utils/Express';
import loginHistoryService from '../services/loginHistoryService';

const router: ExpressRouter = Express.getRouter();

import { isAuthorized } from '../middlewares/authorization';
const getUser: $TSFixMe = require('../middlewares/user').getUser;
import {
    sendErrorResponse,
    sendItemResponse,
} from 'CommonServer/Utils/response';
import Exception from 'Common/Types/Exception/Exception';

router.get(
    '/:userId',
    getUser,
    isAuthorized,
    async (req: ExpressRequest, res: ExpressResponse) => {
        try {
            const userId: $TSFixMe = req.params['userId'];
            let { skip, limit }: $TSFixMe = req.query;
            if (!skip) {
                skip = 0;
            }
            if (!limit) {
                limit = 10;
            }
            const select: string = 'userId createdAt ipLocation device status';
            const historyLogs: $TSFixMe = await loginHistoryService.findBy({
                query: { userId },
                skip,
                limit,
                select,
            });

            return sendItemResponse(req, res, historyLogs);
        } catch (error) {
            return sendErrorResponse(req, res, error as Exception);
        }
    }
);

export default router;
