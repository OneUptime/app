import DashboardNavigation from "../../Utils/Navigation";
import PageComponentProps from "../PageComponentProps";
import HTTPResponse from "Common/Types/API/HTTPResponse";
import URL from "Common/Types/API/URL";
import { Green, Yellow } from "Common/Types/BrandColors";
import IconProp from "Common/Types/Icon/IconProp";
import { JSONObject } from "Common/Types/JSON";
import Text from "Common/Types/Text";
import Button, { ButtonStyleType } from "Common/UI/Components/Button/Button";
import ComponentLoader from "Common/UI/Components/ComponentLoader/ComponentLoader";
import { DropdownOption } from "Common/UI/Components/Dropdown/Dropdown";
import ConfirmModal from "Common/UI/Components/Modal/ConfirmModal";
import ModelTable from "Common/UI/Components/ModelTable/ModelTable";
import Pill from "Common/UI/Components/Pill/Pill";
import FieldType from "Common/UI/Components/Types/FieldType";
import { APP_API_URL } from "Common/UI/Config";
import BaseAPI from "Common/UI/Utils/API/API";
import DropdownUtil from "Common/UI/Utils/Dropdown";
import ModelAPI from "Common/UI/Utils/ModelAPI/ModelAPI";
import Navigation from "Common/UI/Utils/Navigation";
import BillingInvoice, {
  InvoiceStatus,
} from "Common/Models/DatabaseModels/BillingInvoice";
import React, {
  Fragment,
  FunctionComponent,
  ReactElement,
  useState,
} from "react";
import ProjectUtil from "Common/UI/Utils/Project";
import Project from "Common/Models/DatabaseModels/Project";
import SubscriptionStatus from "Common/Types/Billing/SubscriptionStatus";

export interface ComponentProps extends PageComponentProps {}

const Settings: FunctionComponent<ComponentProps> = (
  _props: ComponentProps,
): ReactElement => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  type PayInvoiceFunction = (
    customerId: string,
    invoiceId: string,
  ) => Promise<void>;

  const payInvoice: PayInvoiceFunction = async (
    customerId: string,
    invoiceId: string,
  ): Promise<void> => {
    try {
      setIsLoading(true);

      const result: HTTPResponse<JSONObject> = await BaseAPI.post<JSONObject>(
        URL.fromString(APP_API_URL.toString()).addRoute(
          `/billing-invoices/pay`,
        ),
        {
          data: {
            paymentProviderInvoiceId: invoiceId,
            paymentProviderCustomerId: customerId,
          },
        },
        ModelAPI.getCommonHeaders(),
      );

      if (result.isFailure()) {
        throw result;
      }

      Navigation.reload();
    } catch (err) {
      setError(BaseAPI.getFriendlyMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <Fragment>
      {isLoading ? <ComponentLoader /> : <></>}

      {!isLoading ? (
        <ModelTable<BillingInvoice>
          modelType={BillingInvoice}
          id="invoices-table"
          isDeleteable={false}
          name="Settings > Billing > Invoices"
          isEditable={false}
          isCreateable={false}
          isViewable={false}
          cardProps={{
            title: "Invoices",
            description: "Here is a list of invoices for this project.",
          }}
          noItemsMessage={"No invoices so far."}
          query={{
            projectId: DashboardNavigation.getProjectId()!,
          }}
          showRefreshButton={true}
          selectMoreFields={{
            currencyCode: true,
            paymentProviderCustomerId: true,
            paymentProviderInvoiceId: true,
          }}
          onFetchSuccess={async () => {
            if (ProjectUtil.isSubscriptionInactive()) {
              // fetch project and check subscription again.
              const project: Project | null = await ModelAPI.getItem({
                modelType: Project,
                id: DashboardNavigation.getProjectId()!,
                select: {
                  paymentProviderMeteredSubscriptionStatus: true,
                  paymentProviderSubscriptionStatus: true,
                },
              });

              if (project) {
                const isSubscriptionInactive: boolean =
                  ProjectUtil.setIsSubscriptionInactive({
                    paymentProviderMeteredSubscriptionStatus:
                      project.paymentProviderMeteredSubscriptionStatus ||
                      SubscriptionStatus.Active,
                    paymentProviderSubscriptionStatus:
                      project.paymentProviderSubscriptionStatus ||
                      SubscriptionStatus.Active,
                  });

                if (!isSubscriptionInactive) {
                  // if subscription is active then reload the page.
                  Navigation.reload();
                }
              }
            }
          }}
          filters={[
            {
              field: {
                invoiceNumber: true,
              },
              title: "Invoice ID",
              type: FieldType.Text,
            },
            {
              field: {
                amount: true,
              },
              title: "Amount",
              type: FieldType.Text,
            },
            {
              field: {
                status: true,
              },
              title: "Invoice Status",
              type: FieldType.Dropdown,
              filterDropdownOptions: DropdownUtil.getDropdownOptionsFromEnum(
                InvoiceStatus,
              ).map((option: DropdownOption) => {
                return {
                  value: option.value,
                  label: Text.uppercaseFirstLetter(
                    (option.value as string) || "Undefined",
                  ),
                };
              }),
            },
          ]}
          columns={[
            {
              field: {
                invoiceNumber: true,
              },
              title: "Invoice Number",
              type: FieldType.Text,
            },
            {
              field: {
                invoiceDate: true,
              },
              title: "Invoice Date",
              type: FieldType.Date,
            },
            {
              field: {
                amount: true,
              },
              title: "Amount",
              type: FieldType.Text,

              getElement: (item: BillingInvoice) => {
                return (
                  <span>{`${(item["amount"] as number) / 100} ${item[
                    "currencyCode"
                  ]
                    ?.toString()
                    .toUpperCase()}`}</span>
                );
              },
            },
            {
              field: {
                status: true,
              },
              title: "Invoice Status",
              type: FieldType.Text,

              getElement: (item: BillingInvoice) => {
                if (item["status"] === InvoiceStatus.Paid) {
                  return (
                    <Pill
                      text={Text.uppercaseFirstLetter(item["status"] as string)}
                      color={Green}
                    />
                  );
                }
                return (
                  <Pill
                    text={Text.uppercaseFirstLetter(item["status"] as string)}
                    color={Yellow}
                  />
                );
              },
            },
            {
              field: {
                downloadableLink: true,
              },
              title: "Actions",
              type: FieldType.Text,

              getElement: (item: BillingInvoice) => {
                return (
                  <div>
                    {item["downloadableLink"] ? (
                      <Button
                        icon={IconProp.Download}
                        onClick={() => {
                          Navigation.navigate(item["downloadableLink"] as URL);
                        }}
                        title="Download"
                      />
                    ) : (
                      <></>
                    )}

                    {item["status"] !== InvoiceStatus.Paid &&
                    item["status"] !== InvoiceStatus.Draft &&
                    item["status"] !== InvoiceStatus.Void &&
                    item["status"] !== InvoiceStatus.Deleted ? (
                      <Button
                        icon={IconProp.Billing}
                        onClick={async () => {
                          await payInvoice(
                            item["paymentProviderCustomerId"] as string,
                            item["paymentProviderInvoiceId"] as string,
                          );
                        }}
                        title="Pay Invoice"
                      />
                    ) : (
                      <></>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      ) : (
        <></>
      )}

      {error ? (
        <ConfirmModal
          title={`Something is not quite right...`}
          description={`${error}`}
          submitButtonText={"Close"}
          onSubmit={() => {
            setError("");
          }}
          submitButtonType={ButtonStyleType.NORMAL}
        />
      ) : (
        <></>
      )}
    </Fragment>
  );
};

export default Settings;
