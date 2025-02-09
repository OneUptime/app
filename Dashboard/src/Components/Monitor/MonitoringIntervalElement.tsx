import MonitoringInterval from "../../Utils/MonitorIntervalDropdownOptions";
import { DropdownOption } from "Common/UI/Components/Dropdown/Dropdown";
import React, { FunctionComponent, ReactElement } from "react";

export interface ComponentProps {
  monitoringInterval: string;
}

const MonitoringIntervalElement: FunctionComponent<ComponentProps> = (
  props: ComponentProps,
): ReactElement => {
  if (props.monitoringInterval) {
    return (
      <div>
        {
          MonitoringInterval.find((item: DropdownOption) => {
            return item.value === props.monitoringInterval;
          })?.label
        }
      </div>
    );
  }

  return <div>No interval defined</div>;
};

export default MonitoringIntervalElement;
