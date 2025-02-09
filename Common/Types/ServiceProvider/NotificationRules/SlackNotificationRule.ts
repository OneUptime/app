import FilterCondition from "../../Filter/FilterCondition";
import ObjectID from "../../ObjectID";
import BaseNotificationRule from "./BaseNotificationRule";
import NotificationRuleCondition from "./NotificationRuleCondition";

export default interface SlackNotificationRule extends BaseNotificationRule {
  _type: "SlackNotificationRule";
  filterCondition: FilterCondition; // and OR or. Default is AND
  filters: Array<NotificationRuleCondition>; // if this array is empty then it will be considered as all filters are matched.

  // if filters match then do:
  shouldCreateSlackChannel: boolean;
  inviteTeamsToNewSlackChannel: Array<ObjectID>;
  inviteUsersToNewSlackChannel: Array<ObjectID>;
  shouldAutomaticallyInviteOnCallUsersToNewSlackChannel: boolean;

  shouldPostToExistingSlackChannel: boolean;
  existingSlackChannelName: string; // seperate by comma
}
