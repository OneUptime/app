import ProjectMiddleware from "../../../Server/Middleware/ProjectAuthorization";
import ApiKeyService from "../../../Server/Services/ApiKeyService";
import GlobalConfigService from "../../../Server/Services/GlobalConfigService";
import QueryHelper from "../../../Server/Types/Database/QueryHelper";
import {
  ExpressRequest,
  ExpressResponse,
  NextFunction,
} from "../../../Server/Utils/Express";
import "../TestingUtils/Init";
import OneUptimeDate from "Common/Types/Date";
import BadDataException from "Common/Types/Exception/BadDataException";
import ObjectID from "Common/Types/ObjectID";
import { UserTenantAccessPermission } from "Common/Types/Permission";
import ApiKey from "Common/Models/DatabaseModels/ApiKey";
import { describe, expect, afterEach, jest } from "@jest/globals";
import getJestMockFunction from "Common/Tests/MockType";
import { getJestSpyOn } from "Common/Tests/Spy";
import { TestDatabaseMock } from "../TestingUtils/__mocks__/TestDatabase.mock";
import APIKeyAccessPermission from "../../../Server/Utils/APIKey/AccessPermission";

jest.mock("../../../Server/Services/ApiKeyService");
jest.mock("../../../Server/Services/AccessTokenService");

type ObjectIdOrNull = ObjectID | null;

describe("ProjectMiddleware", () => {
  const mockedObjectId: ObjectID = ObjectID.generate();

  describe("getProjectId", () => {
    describe("should return value when tenantid is passed in the request's", () => {
      const reqFields: string[] = ["params", "query", "headers"];
      test.each(reqFields)("%s", (field: string) => {
        const req: Partial<ExpressRequest> = {
          [field]: { tenantid: mockedObjectId.toString() },
        };

        const result: ObjectIdOrNull = ProjectMiddleware.getProjectId(
          req as ExpressRequest,
        );

        expect(result).toEqual(mockedObjectId);
      });
    });

    test("should return value when projectid is passed in the request's header", () => {
      const req: Partial<ExpressRequest> = {
        headers: { projectid: mockedObjectId.toString() },
      };

      const result: ObjectIdOrNull = ProjectMiddleware.getProjectId(
        req as ExpressRequest,
      );

      expect(result).toEqual(mockedObjectId);
    });

    test("should return value when projectId is passed in the request's body", () => {
      const req: Partial<ExpressRequest> = {
        body: { projectId: mockedObjectId.toString() },
      };

      const result: ObjectIdOrNull = ProjectMiddleware.getProjectId(
        req as ExpressRequest,
      );

      expect(result).toEqual(mockedObjectId);
    });

    test("should return null when projectId is not passed in the request", () => {
      const result: ObjectIdOrNull = ProjectMiddleware.getProjectId(
        {} as ExpressRequest,
      );

      expect(result).toBeNull();
    });
  });

  describe("getApiKey", () => {
    test("should return apiKey when apikey is passed in the request's header", () => {
      const req: Partial<ExpressRequest> = {
        headers: { apikey: mockedObjectId.toString() },
      };

      const result: ObjectIdOrNull = ProjectMiddleware.getApiKey(
        req as ExpressRequest,
      );

      expect(result).toEqual(mockedObjectId);
    });

    test("should return null when apikey is not passed in the request's header", () => {
      const result: ObjectIdOrNull = ProjectMiddleware.getApiKey(
        {} as ExpressRequest,
      );

      expect(result).toBeNull();
    });
  });

  describe("hasApiKey", () => {
    const req: ExpressRequest = { headers: {} } as ExpressRequest;

    test("should return true when getApiKey returns a non-null value", () => {
      req.headers["apikey"] = mockedObjectId.toString();

      const result: boolean = ProjectMiddleware.hasApiKey(req);

      expect(result).toStrictEqual(true);
    });

    test("should return false when getApiKey returns null", () => {
      req.headers["apikey"] = undefined;

      const result: boolean = ProjectMiddleware.hasApiKey(req);

      expect(result).toStrictEqual(false);
    });
  });

  describe("hasProjectID", () => {
    const req: ExpressRequest = { headers: {} } as ExpressRequest;
    test("should return true when getProjectId returns a non-null value", () => {
      req.headers["tenantid"] = mockedObjectId.toString();

      const result: boolean = ProjectMiddleware.hasProjectID(req);

      expect(result).toStrictEqual(true);
    });

    test("should return false when getProjectId returns null", () => {
      req.headers["tenantid"] = undefined;

      const result: boolean = ProjectMiddleware.hasProjectID(req);

      expect(result).toStrictEqual(false);
    });
  });

  describe("isValidProjectIdAndApiKeyMiddleware", () => {
    const req: ExpressRequest = {} as ExpressRequest;
    const res: ExpressResponse = {} as ExpressResponse;
    let next: NextFunction = getJestMockFunction();

    const mockedApiModel: ApiKey = {
      id: mockedObjectId,
    } as ApiKey;

    beforeEach(
      async () => {
        jest.clearAllMocks();
        next = getJestMockFunction();
        await TestDatabaseMock.connectDbMock();

        if (req.headers === undefined) {
          req.headers = {};
        }

        req.headers["tenantid"] = mockedObjectId.toString();
        req.headers["apikey"] = mockedObjectId.toString();
      },
      10 * 1000, // 10 second timeout because setting up the DB is slow
    );

    afterEach(async () => {
      await TestDatabaseMock.disconnectDbMock();
    });

    test("should throw BadDataException when getProjectId returns null", async () => {
      const spyFindOneBy: jest.SpyInstance = getJestSpyOn(
        GlobalConfigService,
        "findOneBy",
      ).mockResolvedValue(null);

      req.headers["tenantid"] = undefined;
      req.headers["apikey"] = mockedObjectId.toString();

      await ProjectMiddleware.isValidProjectIdAndApiKeyMiddleware(
        req,
        res,
        next,
      );

      expect(spyFindOneBy).toHaveBeenCalledWith({
        query: {
          _id: ObjectID.getZeroObjectID().toString(),
          isMasterApiKeyEnabled: true,
          masterApiKey: mockedObjectId,
        },
        props: {
          isRoot: true,
        },
        select: {
          _id: true,
        },
      });

      expect(next).toHaveBeenCalledWith(
        new BadDataException("ProjectID not found in the request header."),
      );
    });

    test("should throw BadDataException when getApiKey returns null", async () => {
      req.headers["apikey"] = undefined;

      await ProjectMiddleware.isValidProjectIdAndApiKeyMiddleware(
        req,
        res,
        next,
      );

      expect(next).toHaveBeenCalledWith(
        new BadDataException("ApiKey not found in the request"),
      );
    });

    test("should call Response.sendErrorResponse when apiKeyModel is null", async () => {
      const spyFindOneBy: jest.SpyInstance = getJestSpyOn(
        ApiKeyService,
        "findOneBy",
      ).mockResolvedValue(null);

      jest
        .spyOn(QueryHelper, "greaterThan")
        .mockImplementation(jest.fn() as any);

      await ProjectMiddleware.isValidProjectIdAndApiKeyMiddleware(
        req,
        res,
        next,
      );

      expect(spyFindOneBy).toHaveBeenCalledWith({
        query: {
          projectId: mockedObjectId,
          apiKey: mockedObjectId,
          expiresAt: QueryHelper.greaterThan(OneUptimeDate.getCurrentDate()),
        },
        select: {
          _id: true,
        },
        props: { isRoot: true },
      });

      expect(next).toHaveBeenCalledWith(
        new BadDataException("Invalid Project ID or API Key"),
      );
    });

    test("should call Response.sendErrorResponse when apiKeyModel is not null but getApiTenantAccessPermission returned null", async () => {
      jest.spyOn(ApiKeyService, "findOneBy").mockResolvedValue(mockedApiModel);
      const spyGetApiTenantAccessPermission: jest.SpyInstance = getJestSpyOn(
        APIKeyAccessPermission,
        "getApiTenantAccessPermission",
      ).mockImplementationOnce(getJestMockFunction().mockResolvedValue(null));

      await ProjectMiddleware.isValidProjectIdAndApiKeyMiddleware(
        req,
        res,
        next,
      );

      expect(spyGetApiTenantAccessPermission).toHaveBeenCalled();
      // check first param of next
      expect(next).toHaveBeenCalledWith(
        new BadDataException("Invalid Project ID or API Key"),
      );
    });

    test("should call function 'next' when apiKeyModel is not null and getApiTenantAccessPermission returned userTenantAccessPermission", async () => {
      const mockedUserTenantAccessPermission: UserTenantAccessPermission =
        {} as UserTenantAccessPermission;
      jest.spyOn(ApiKeyService, "findOneBy").mockResolvedValue(mockedApiModel);
      const spyGetApiTenantAccessPermission: jest.SpyInstance = getJestSpyOn(
        APIKeyAccessPermission,
        "getApiTenantAccessPermission",
      ).mockResolvedValue(mockedUserTenantAccessPermission);

      await ProjectMiddleware.isValidProjectIdAndApiKeyMiddleware(
        req,
        res,
        next,
      );

      expect(spyGetApiTenantAccessPermission).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
});
