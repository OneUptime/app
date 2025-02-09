import { LIMIT_PER_PROJECT } from "Common/Types/Database/LimitMax";
import ObjectID from "Common/Types/ObjectID";
import { DropdownOption } from "Common/UI/Components/Dropdown/Dropdown";
import ModelAPI, { ListResult } from "Common/UI/Utils/ModelAPI/ModelAPI";
import TeamMember from "Common/Models/DatabaseModels/TeamMember";

export default class ProjectUser {
  public static async fetchProjectUsersAsDropdownOptions(
    projectId: ObjectID,
  ): Promise<Array<DropdownOption>> {
    const teamMembers: ListResult<TeamMember> = await ModelAPI.getList({
      modelType: TeamMember,
      query: { projectId },
      limit: LIMIT_PER_PROJECT,
      skip: 0,
      select: {
        _id: true,
        user: {
          _id: true,
          name: true,
          email: true,
        },
      },
      sort: {},
      requestOptions: {},
    });

    return teamMembers.data.map((teamMember: TeamMember) => {
      return {
        value: teamMember.user?._id as string,
        label:
          teamMember.user?.name?.toString() ||
          teamMember.user?.email?.toString() ||
          "",
      };
    });
  }
}
