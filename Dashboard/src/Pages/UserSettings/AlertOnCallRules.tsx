import NotificationMethodView from "../../Components/NotificationMethods/NotificationMethod";
import NotifyAfterDropdownOptions from "../../Components/NotificationRule/NotifyAfterMinutesDropdownOptions";
import DashboardNavigation from "../../Utils/Navigation";
import PageComponentProps from "../PageComponentProps";
import BaseModel from "Common/Models/DatabaseModels/DatabaseBaseModel/DatabaseBaseModel";
import SortOrder from "Common/Types/BaseDatabase/SortOrder";
import { LIMIT_PER_PROJECT } from "Common/Types/Database/LimitMax";
import { PromiseVoidFunction } from "Common/Types/FunctionTypes";
import { JSONObject } from "Common/Types/JSON";
import NotificationRuleType from "Common/Types/NotificationRule/NotificationRuleType";
import { DropdownOption } from "Common/UI/Components/Dropdown/Dropdown";
import ErrorMessage from "Common/UI/Components/ErrorMessage/ErrorMessage";
import FormFieldSchemaType from "Common/UI/Components/Forms/Types/FormFieldSchemaType";
import PageLoader from "Common/UI/Components/Loader/PageLoader";
import ModelTable from "Common/UI/Components/ModelTable/ModelTable";
import FieldType from "Common/UI/Components/Types/FieldType";
import API from "Common/UI/Utils/API/API";
import ModelAPI, { ListResult } from "Common/UI/Utils/ModelAPI/ModelAPI";
import User from "Common/UI/Utils/User";
import AlertSeverity from "Common/Models/DatabaseModels/AlertSeverity";
import UserCall from "Common/Models/DatabaseModels/UserCall";
import UserEmail from "Common/Models/DatabaseModels/UserEmail";
import UserNotificationRule from "Common/Models/DatabaseModels/UserNotificationRule";
import UserSMS from "Common/Models/DatabaseModels/UserSMS";
import React, {
  Fragment,
  FunctionComponent,
  ReactElement,
  useEffect,
  useState,
} from "react";

const Settings: FunctionComponent<PageComponentProps> = (): ReactElement => {
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [alertSeverities, setAlertSeverities] = useState<Array<AlertSeverity>>(
    [],
  );
  const [userEmails, setUserEmails] = useState<Array<UserEmail>>([]);
  const [userSMSs, setUserSMSs] = useState<Array<UserSMS>>([]);
  const [userCalls, setUserCalls] = useState<Array<UserCall>>([]);
  const [
    notificationMethodsDropdownOptions,
    setNotificationMethodsDropdownOptions,
  ] = useState<Array<DropdownOption>>([]);

  type GetTableFunctionProps = {
    alertSeverity?: AlertSeverity;
    ruleType: NotificationRuleType;
    title: string;
    description: string;
  };

  type GetTableFunction = (props: GetTableFunctionProps) => ReactElement;

  const getModelTable: GetTableFunction = (
    options: GetTableFunctionProps,
  ): ReactElement => {
    return (
      <ModelTable<UserNotificationRule>
        modelType={UserNotificationRule}
        query={{
          projectId: DashboardNavigation.getProjectId()!,
          userId: User.getUserId()!,
          ruleType: options.ruleType,
          alertSeverityId: options.alertSeverity?.id || undefined,
        }}
        onBeforeCreate={(
          model: UserNotificationRule,
          miscDataProps: JSONObject,
        ): Promise<UserNotificationRule> => {
          model.projectId = DashboardNavigation.getProjectId()!;
          model.userId = User.getUserId();
          model.ruleType = options.ruleType;
          if (options.alertSeverity?.id) {
            model.alertSeverityId = options.alertSeverity?.id;
          }

          if (miscDataProps["notificationMethod"]) {
            const userEmail: UserEmail | undefined = userEmails.find(
              (userEmail: UserEmail) => {
                return (
                  userEmail.id!.toString() ===
                  miscDataProps["notificationMethod"]?.toString()
                );
              },
            );

            if (userEmail) {
              model.userEmailId = userEmail.id!;
            }

            const userSMS: UserSMS | undefined = userSMSs.find(
              (userSMS: UserSMS) => {
                return (
                  userSMS.id!.toString() ===
                  miscDataProps["notificationMethod"]?.toString()
                );
              },
            );

            if (userSMS) {
              model.userSmsId = userSMS.id!;
            }

            const userCall: UserCall | undefined = userCalls.find(
              (userCall: UserCall) => {
                return (
                  userCall.id!.toString() ===
                  miscDataProps["notificationMethod"]?.toString()
                );
              },
            );

            if (userCall) {
              model.userCallId = userCall.id!;
            }
          }

          return Promise.resolve(model);
        }}
        sortOrder={SortOrder.Ascending}
        sortBy="notifyAfterMinutes"
        createVerb={"Add"}
        id="notification-rules"
        name={`User Settings > Notification Rules > ${
          options.alertSeverity?.name || options.ruleType
        }`}
        isDeleteable={true}
        isEditable={false}
        isCreateable={true}
        cardProps={{
          title: options.title,
          description: options.description,
        }}
        noItemsMessage={
          "No notification rules found for this user. Please add one to receive notifications."
        }
        formFields={[
          {
            overrideField: {
              notificationMethod: true,
            },
            showEvenIfPermissionDoesNotExist: true,
            overrideFieldKey: "notificationMethod",
            title: "Notification Method",
            description: "How do you want to be notified?",
            fieldType: FormFieldSchemaType.Dropdown,
            required: true,
            placeholder: "Notification Method",
            dropdownOptions: notificationMethodsDropdownOptions,
          },
          {
            field: {
              notifyAfterMinutes: true,
            },
            title: "Notify me after",
            fieldType: FormFieldSchemaType.Dropdown,
            required: true,
            placeholder: "Immediately",
            dropdownOptions: NotifyAfterDropdownOptions,
          },
        ]}
        showRefreshButton={true}
        selectMoreFields={{
          userEmail: {
            email: true,
          },
          userSms: {
            phone: true,
          },
        }}
        filters={[]}
        columns={[
          {
            field: {
              userCall: {
                phone: true,
              },
            },
            title: "Notification Method",
            type: FieldType.Text,
            getElement: (item: UserNotificationRule): ReactElement => {
              return (
                <NotificationMethodView
                  item={item}
                  modelType={UserNotificationRule}
                />
              );
            },
          },
          {
            field: {
              notifyAfterMinutes: true,
            },
            title: "Notify After",
            type: FieldType.Text,
            getElement: (item: UserNotificationRule): ReactElement => {
              return (
                <div>
                  {item["notifyAfterMinutes"] === 0 && <p>Immediately</p>}
                  {(item["notifyAfterMinutes"] as number) > 0 && (
                    <p>{item["notifyAfterMinutes"] as number} minutes</p>
                  )}
                </div>
              );
            },
          },
        ]}
      />
    );
  };

  const init: PromiseVoidFunction = async (): Promise<void> => {
    // Ping an API here.
    setError("");
    setIsLoading(true);

    try {
      const alertSeverities: ListResult<AlertSeverity> = await ModelAPI.getList(
        {
          modelType: AlertSeverity,
          query: {
            projectId: DashboardNavigation.getProjectId()!,
          },
          limit: LIMIT_PER_PROJECT,
          skip: 0,
          select: {
            name: true,
          },
          sort: {},
        },
      );

      const userEmails: ListResult<UserEmail> = await ModelAPI.getList({
        modelType: UserEmail,
        query: {
          projectId: DashboardNavigation.getProjectId()!,
          userId: User.getUserId(),
          isVerified: true,
        },
        limit: LIMIT_PER_PROJECT,
        skip: 0,
        select: {
          email: true,
        },
        sort: {},
      });

      setUserEmails(userEmails.data);

      const userSMSes: ListResult<UserSMS> = await ModelAPI.getList({
        modelType: UserSMS,
        query: {
          projectId: DashboardNavigation.getProjectId()!,
          userId: User.getUserId(),
          isVerified: true,
        },
        limit: LIMIT_PER_PROJECT,
        skip: 0,
        select: {
          phone: true,
        },
        sort: {},
      });

      setUserSMSs(userSMSes.data);

      const userCalls: ListResult<UserCall> = await ModelAPI.getList({
        modelType: UserCall,
        query: {
          projectId: DashboardNavigation.getProjectId()!,
          userId: User.getUserId(),
          isVerified: true,
        },
        limit: LIMIT_PER_PROJECT,
        skip: 0,
        select: {
          phone: true,
        },
        sort: {},
      });

      setUserCalls(userCalls.data);

      setAlertSeverities(alertSeverities.data);

      const dropdownOptions: Array<DropdownOption> = [
        ...userCalls.data,
        ...userEmails.data,
        ...userSMSes.data,
      ].map((model: BaseModel) => {
        const isUserCall: boolean = model instanceof UserCall;
        const isUserSms: boolean = model instanceof UserSMS;

        const option: DropdownOption = {
          label: model.getColumnValue("phone")
            ? (model.getColumnValue("phone")?.toString() as string)
            : (model.getColumnValue("email")?.toString() as string),
          value: model.id!.toString(),
        };

        if (isUserCall) {
          option.label = "Call: " + option.label;
        } else if (isUserSms) {
          option.label = "SMS: " + option.label;
        } else {
          option.label = "Email: " + option.label;
        }

        return option;
      });

      setNotificationMethodsDropdownOptions(dropdownOptions);
    } catch (err) {
      setError(API.getFriendlyMessage(err));
    }

    setIsLoading(false);
  };

  useEffect(() => {
    init().catch((err: Error) => {
      setError(err.toString());
    });
  }, []);

  if (isLoading) {
    return <PageLoader isVisible={true} />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <Fragment>
      <div>
        {alertSeverities.map((alertSeverity: AlertSeverity, i: number) => {
          return (
            <div key={i}>
              {getModelTable({
                alertSeverity: alertSeverity,
                ruleType: NotificationRuleType.ON_CALL_EXECUTED,
                title:
                  alertSeverity.name +
                  " Severity Alert: " +
                  " When I am on call and " +
                  alertSeverity.name +
                  " severity alert" +
                  " is assigned to me...",
                description:
                  "Here are the rules when you are on call and " +
                  alertSeverity.name +
                  " Severity alert" +
                  " is assigned to you.",
              })}
            </div>
          );
        })}
      </div>

      {/* <div>
                {getModelTable({
                    alertSeverity: undefined,
                    ruleType: NotificationRuleType.WHEN_USER_GOES_ON_CALL,
                    title: 'When I go on call...',
                    description:
                        'Here are the rules to notify you when you go on call.',
                })}
            </div>

            <div>
                {getModelTable({
                    alertSeverity: undefined,
                    ruleType: NotificationRuleType.WHEN_USER_GOES_OFF_CALL,
                    title: 'When I go off call...',
                    description:
                        'Here are the rules to notify you when you go off call.',
                })}
            </div> */}
    </Fragment>
  );
};

export default Settings;
