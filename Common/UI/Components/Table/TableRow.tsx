import ActionButtonSchema from "../ActionButton/ActionButtonSchema";
import Button, { ButtonSize, ButtonStyleType } from "../Button/Button";
import CheckboxElement from "../Checkbox/Checkbox";
import ColorInput from "../ColorViewer/ColorViewer";
import Icon, { ThickProp } from "../Icon/Icon";
import ConfirmModal from "../Modal/ConfirmModal";
import FieldType from "../Types/FieldType";
import Column from "./Types/Column";
import Columns from "./Types/Columns";
import Color from "Common/Types/Color";
import OneUptimeDate from "Common/Types/Date";
import GenericObject from "Common/Types/GenericObject";
import IconProp from "Common/Types/Icon/IconProp";
import get from "lodash/get";
import React, { ReactElement, useState } from "react";
import { Draggable, DraggableProvided } from "react-beautiful-dnd";

export interface ComponentProps<T extends GenericObject> {
  item: T;
  columns: Columns<T>;
  actionButtons?: Array<ActionButtonSchema<T>> | undefined;
  enableDragAndDrop?: boolean | undefined;
  dragAndDropScope?: string | undefined;
  dragDropIdField?: keyof T | undefined;
  dragDropIndexField?: keyof T | undefined;

  // bulk actions
  isBulkActionsEnabled?: undefined | boolean;
  onItemSelected?: undefined | ((item: T) => void);
  onItemDeselected?: undefined | ((item: T) => void);
  isItemSelected?: boolean | undefined;
}

type TableRowFunction = <T extends GenericObject>(
  props: ComponentProps<T>,
) => ReactElement;

const TableRow: TableRowFunction = <T extends GenericObject>(
  props: ComponentProps<T>,
): ReactElement => {
  const [isButtonLoading, setIsButtonLoading] = useState<Array<boolean>>(
    props.actionButtons?.map(() => {
      return false;
    }) || [],
  );

  const [tooltipModalText, setTooltipModalText] = useState<string>("");

  const [error, setError] = useState<string>("");

  type GetRowFunction = (provided?: DraggableProvided) => ReactElement;

  const getRow: GetRowFunction = (
    provided?: DraggableProvided,
  ): ReactElement => {
    return (
      <>
        <tr {...provided?.draggableProps} ref={provided?.innerRef}>
          {props.enableDragAndDrop && (
            <td
              className="ml-5 py-4 w-10 align-top"
              {...provided?.dragHandleProps}
            >
              <Icon
                icon={IconProp.ArrowUpDown}
                className="ml-6 h-5 w-5 text-gray-500 hover:text-indigo-800 m-auto cursor-ns-resize"
              />
            </td>
          )}
          {props.isBulkActionsEnabled && (
            <td
              className="w-10 py-3.5  align-top"
              {...provided?.dragHandleProps}
            >
              <div className="ml-5">
                <CheckboxElement
                  value={props.isItemSelected}
                  onChange={(value: boolean) => {
                    if (value) {
                      if (props.onItemSelected) {
                        props.onItemSelected(props.item);
                      }
                    } else if (props.onItemDeselected) {
                      props.onItemDeselected(props.item);
                    }
                  }}
                />
              </div>
            </td>
          )}
          {props.columns &&
            props.columns.map((column: Column<T>, i: number) => {
              let className: string =
                "whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-500 sm:pl-6 align-top";
              if (i === props.columns.length - 1) {
                className =
                  "whitespace-nowrap py-4 pl-4 pr-6 text-sm font-medium text-gray-500 sm:pl-6 align-top";
              }
              return (
                <td
                  key={i}
                  className={className}
                  style={{
                    textAlign:
                      column.type === FieldType.Actions ? "right" : "left",
                  }}
                  onClick={() => {
                    if (column.tooltipText) {
                      setTooltipModalText(column.tooltipText(props.item));
                    }
                  }}
                >
                  {column.key && !column.getElement ? (
                    column.type === FieldType.Date ? (
                      props.item[column.key] ? (
                        OneUptimeDate.getDateAsLocalFormattedString(
                          props.item[column.key] as string,
                          true,
                        )
                      ) : (
                        column.noValueMessage || ""
                      )
                    ) : column.type === FieldType.DateTime ? (
                      props.item[column.key] ? (
                        OneUptimeDate.getDateAsLocalFormattedString(
                          props.item[column.key] as string,
                          false,
                        )
                      ) : (
                        column.noValueMessage || ""
                      )
                    ) : column.type === FieldType.USDCents ? (
                      props.item[column.key] ? (
                        ((props.item[column.key] as number) || 0) / 100 + " USD"
                      ) : (
                        column.noValueMessage || "0 USD"
                      )
                    ) : column.type === FieldType.Percent ? (
                      props.item[column.key] ? (
                        props.item[column.key] + "%"
                      ) : (
                        column.noValueMessage || "0%"
                      )
                    ) : column.type === FieldType.Color ? (
                      props.item[column.key] ? (
                        <ColorInput value={props.item[column.key] as Color} />
                      ) : (
                        column.noValueMessage || "0%"
                      )
                    ) : column.type === FieldType.Boolean ? (
                      props.item[column.key] ? (
                        <Icon
                          icon={IconProp.Check}
                          className={"h-5 w-5 text-gray-500"}
                          thick={ThickProp.Thick}
                        />
                      ) : (
                        <Icon
                          icon={IconProp.False}
                          className={"h-5 w-5 text-gray-500"}
                          thick={ThickProp.Thick}
                        />
                      )
                    ) : (
                      get(props.item, column.key, "")?.toString() ||
                      column.noValueMessage ||
                      ""
                    )
                  ) : (
                    <></>
                  )}

                  {column.key && column.getElement ? (
                    column.getElement(props.item)
                  ) : (
                    <></>
                  )}
                  {column.type === FieldType.Actions && (
                    <div className="flex justify-end">
                      {error && (
                        <div className="text-align-left">
                          <ConfirmModal
                            title={`Error`}
                            description={error}
                            submitButtonText={"Close"}
                            onSubmit={() => {
                              return setError("");
                            }}
                          />
                        </div>
                      )}
                      {props.actionButtons?.map(
                        (button: ActionButtonSchema<T>, i: number) => {
                          if (
                            button.isVisible &&
                            !button.isVisible(props.item)
                          ) {
                            return <div key={i}></div>;
                          }

                          return (
                            <div key={i}>
                              <Button
                                buttonSize={ButtonSize.Small}
                                title={button.title}
                                icon={button.icon}
                                buttonStyle={button.buttonStyleType}
                                isLoading={isButtonLoading[i]}
                                onClick={() => {
                                  if (button.onClick) {
                                    isButtonLoading[i] = true;
                                    setIsButtonLoading(isButtonLoading);

                                    button.onClick(
                                      props.item,
                                      () => {
                                        // on action complete
                                        isButtonLoading[i] = false;
                                        setIsButtonLoading(isButtonLoading);
                                      },
                                      (err: Error) => {
                                        isButtonLoading[i] = false;
                                        setIsButtonLoading(isButtonLoading);
                                        setError((err as Error).message);
                                      },
                                    );
                                  }
                                }}
                              />
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </td>
              );
            })}
        </tr>
        {tooltipModalText && (
          <ConfirmModal
            title={`Help`}
            description={`${tooltipModalText}`}
            submitButtonText={"Close"}
            onSubmit={() => {
              setTooltipModalText("");
            }}
            submitButtonType={ButtonStyleType.NORMAL}
          />
        )}
      </>
    );
  };

  if (
    props.enableDragAndDrop &&
    props.dragDropIdField &&
    props.dragDropIndexField
  ) {
    return (
      <Draggable
        draggableId={(props.item[props.dragDropIdField] as string) || ""}
        index={(props.item[props.dragDropIndexField] as number) || 0}
        key={(props.item[props.dragDropIndexField] as number) || 0}
      >
        {(provided: DraggableProvided) => {
          return getRow(provided);
        }}
      </Draggable>
    );
  }

  return getRow();
};

export default TableRow;
