import { DropdownOption } from "Common/UI/Components/Dropdown/Dropdown";

const MonitoringInterval: Array<DropdownOption> = [
  {
    value: "* * * * *",
    label: "Every Minute",
  },
  {
    value: "*/2 * * * *",
    label: "Every 2 Minutes",
  },
  {
    value: "*/5 * * * *",
    label: "Every 5 Minutes",
  },
  {
    value: "*/10 * * * *",
    label: "Every 10 Minutes",
  },
  {
    value: "*/15 * * * *",
    label: "Every 15 Minutes",
  },
  {
    value: "*/30 * * * *",
    label: "Every 30 Minutes",
  },
  {
    value: "0 * * * *",
    label: "Every Hour",
  },
  {
    value: "0 0 * * *",
    label: "Every Day",
  },
  {
    value: "0 0 * * 0",
    label: "Every Week",
  },
];

export default MonitoringInterval;
