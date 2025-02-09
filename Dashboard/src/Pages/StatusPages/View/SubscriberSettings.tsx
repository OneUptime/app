import ProjectCallSMSConfigElement from "../../../Components/ProjectCallSMSConfig/ProjectCallSMSConfig";
import ProjectSMTPConfig from "../../../Components/ProjectSMTPConfig/ProjectSMTPConfig";
import PageComponentProps from "../../PageComponentProps";
import ObjectID from "Common/Types/ObjectID";
import PlaceholderText from "Common/UI/Components/Detail/PlaceholderText";
import FormFieldSchemaType from "Common/UI/Components/Forms/Types/FormFieldSchemaType";
import CardModelDetail from "Common/UI/Components/ModelDetail/CardModelDetail";
import FieldType from "Common/UI/Components/Types/FieldType";
import Navigation from "Common/UI/Utils/Navigation";
import TimezoneUtil from "Common/UI/Utils/Timezone";
import ProjectCallSMSConfig from "Common/Models/DatabaseModels/ProjectCallSMSConfig";
import ProjectSmtpConfig from "Common/Models/DatabaseModels/ProjectSmtpConfig";
import StatusPage from "Common/Models/DatabaseModels/StatusPage";
import React, { Fragment, FunctionComponent, ReactElement } from "react";
import TimezonesElement from "../../../Components/Timezone/TimezonesElement";

const StatusPageDelete: FunctionComponent<
  PageComponentProps
> = (): ReactElement => {
  const modelId: ObjectID = Navigation.getLastParamAsObjectID(1);

  return (
    <Fragment>
      <CardModelDetail<StatusPage>
        name="Status Page > Branding > Subscriber"
        cardProps={{
          title: "Subscriber Settings",
          description: "Subscriber settings for this status page.",
        }}
        isEditable={true}
        formFields={[
          {
            field: {
              enableEmailSubscribers: true,
            },
            title: "Enable Email Subscribers",
            fieldType: FormFieldSchemaType.Toggle,
            required: false,
            placeholder: "Can email subscribers subscribe to this status page?",
          },
          {
            field: {
              enableSmsSubscribers: true,
            },
            title: "Enable SMS Subscribers",
            fieldType: FormFieldSchemaType.Toggle,
            required: false,
            placeholder: "Can SMS subscribers subscribe to this status page?",
          },
        ]}
        modelDetailProps={{
          showDetailsInNumberOfColumns: 1,
          modelType: StatusPage,
          id: "model-detail-status-page",
          fields: [
            {
              field: {
                enableEmailSubscribers: true,
              },
              fieldType: FieldType.Boolean,
              title: "Enable Email Subscribers",
            },
            {
              field: {
                enableSmsSubscribers: true,
              },
              fieldType: FieldType.Boolean,
              title: "Enable SMS Subscribers",
            },
          ],
          modelId: modelId,
        }}
      />

      <CardModelDetail<StatusPage>
        name="Status Page > Branding > Subscriber > Advanced"
        cardProps={{
          title: "Advanced Subscriber Settings",
          description: "Advanced subscriber settings for this status page.",
        }}
        isEditable={true}
        formFields={[
          {
            field: {
              allowSubscribersToChooseResources: true,
            },
            title: "Allow Subscribers to Choose Resources",
            fieldType: FormFieldSchemaType.Toggle,
            required: false,
            placeholder:
              "Can subscribers choose which resources they want to subscribe to?",
          },
          {
            field: {
              allowSubscribersToChooseEventTypes: true,
            },
            title: "Allow Subscribers to Choose Event Types",
            fieldType: FormFieldSchemaType.Toggle,
            required: false,
            placeholder:
              "Can subscribers choose which event types they want to subscribe to (like Incidents, Announcements or Scheduled Events)?",
          },
          {
            field: {
              subscriberTimezones: true,
            },
            title: "Subscriber Timezones",
            fieldType: FormFieldSchemaType.MultiSelectDropdown,
            dropdownOptions: TimezoneUtil.getTimezoneDropdownOptions(),
            required: false,
            placeholder: "Select Timezones",
            description:
              "Select timezones for subscribers. Subscribers will see time in these timezones when they receive notifications.",
          },
          {
            field: {
              subscriberEmailNotificationFooterText: true,
            },
            title: "Subscriber Email Notification Footer Text",
            fieldType: FormFieldSchemaType.LongText,
            required: false,
            placeholder:
              "This is an automated email sent to you because you are subscribed to Status Page.",
            description:
              "This text will be added at the end of the email notification sent to subscribers. You can use this to add any additional information or links.",
          },
        ]}
        modelDetailProps={{
          showDetailsInNumberOfColumns: 1,
          modelType: StatusPage,
          id: "model-detail-status-page",
          fields: [
            {
              field: {
                allowSubscribersToChooseResources: true,
              },
              fieldType: FieldType.Boolean,
              title: "Allow Subscribers to Choose Resources",
              description:
                "Can subscribers choose which resources they want to subscribe to?",
            },
            {
              field: {
                allowSubscribersToChooseEventTypes: true,
              },
              fieldType: FieldType.Boolean,
              title: "Allow Subscribers to Choose Event Types",
              description:
                "Can subscribers choose which event types they want to subscribe to (like Incidents, Announcements or Scheduled Events)?",
            },
            {
              field: {
                subscriberTimezones: true,
              },
              fieldType: FieldType.Element,
              title: "Subscriber Timezones",
              description:
                "Subscribers will see time in these timezones when they receive notifications.",
              getElement: (item: StatusPage): ReactElement => {
                if (
                  item["subscriberTimezones"] &&
                  item["subscriberTimezones"].length > 0
                ) {
                  return (
                    <TimezonesElement timezones={item["subscriberTimezones"]} />
                  );
                }
                return (
                  <PlaceholderText text="No subscriber timezones selected so far. Subscribers will receive notifications with times shown in GMT, EST, PST, IST, ACT timezones by default." />
                );
              },
            },
            {
              field: {
                subscriberEmailNotificationFooterText: true,
              },
              fieldType: FieldType.LongText,
              title: "Subscriber Email Notification Footer Text",
              description:
                "This text will be added at the end of the email notification sent to subscribers. You can use this to add any additional information or links.",
            },
          ],
          modelId: modelId,
        }}
      />

      <CardModelDetail<StatusPage>
        name="Status Page > Email > Subscriber"
        cardProps={{
          title: "Custom SMTP",
          description:
            "Custom SMTP settings for this status page. This will be used to send emails to subscribers.",
        }}
        editButtonText={"Edit SMTP"}
        isEditable={true}
        formFields={[
          {
            field: {
              smtpConfig: true,
            },
            title: "Custom SMTP Config",
            description:
              "Select SMTP Config to use for this status page to send email to subscribers. You can add SMTP Config in Project Settings >  Notification Settings > Custom SMTP.",
            fieldType: FormFieldSchemaType.Dropdown,
            dropdownModal: {
              type: ProjectSmtpConfig,
              labelField: "name",
              valueField: "_id",
            },
            required: false,
            placeholder: "SMTP Config",
          },
        ]}
        modelDetailProps={{
          showDetailsInNumberOfColumns: 1,
          modelType: StatusPage,
          id: "model-detail-status-page",
          fields: [
            {
              field: {
                smtpConfig: {
                  name: true,
                },
              },
              title: "Custom SMTP Config",
              fieldType: FieldType.Element,
              getElement: (item: StatusPage): ReactElement => {
                if (item["smtpConfig"]) {
                  return <ProjectSMTPConfig smtpConfig={item["smtpConfig"]} />;
                }
                return (
                  <PlaceholderText
                    text="No Custom SMTP Config selected so far
                                    for this status page."
                  />
                );
              },
            },
          ],
          modelId: modelId,
        }}
      />

      <CardModelDetail<StatusPage>
        name="Status Page > Call and SMS > Subscriber"
        cardProps={{
          title: "Twilio Config",
          description:
            "Twilio Config settings for this status page. This will be used to send SMS to subscribers.",
        }}
        editButtonText={"Edit Twilio Config"}
        isEditable={true}
        formFields={[
          {
            field: {
              callSmsConfig: true,
            },
            title: "Twilio Config",
            description:
              "Select Twilio Config to use for this status page to send SMS to subscribers. You can add Twilio Config in Project Settings > Notification Settings > Twilio Config.",
            fieldType: FormFieldSchemaType.Dropdown,
            dropdownModal: {
              type: ProjectCallSMSConfig,
              labelField: "name",
              valueField: "_id",
            },
            required: false,
            placeholder: "Twilio Config",
          },
        ]}
        modelDetailProps={{
          showDetailsInNumberOfColumns: 1,
          modelType: StatusPage,
          id: "model-detail-call-config",
          fields: [
            {
              field: {
                callSmsConfig: {
                  name: true,
                },
              },
              title: "Twilio Config",
              fieldType: FieldType.Element,
              getElement: (item: StatusPage): ReactElement => {
                if (item["callSmsConfig"]) {
                  return (
                    <ProjectCallSMSConfigElement
                      callSmsConfig={item["callSmsConfig"]}
                    />
                  );
                }
                return (
                  <PlaceholderText text="No Twilio Config selected so far." />
                );
              },
            },
          ],
          modelId: modelId,
        }}
      />
    </Fragment>
  );
};

export default StatusPageDelete;
