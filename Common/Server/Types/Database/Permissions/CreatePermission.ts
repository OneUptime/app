import DatabaseRequestType from "../../BaseDatabase/DatabaseRequestType";
import ColumnPermissions from "./ColumnPermission";
import TablePermission from "./TablePermission";
import BaseModel from "Common/Models/DatabaseModels/DatabaseBaseModel/DatabaseBaseModel";
import DatabaseCommonInteractionProps from "Common/Types/BaseDatabase/DatabaseCommonInteractionProps";

export default class CreatePermission {
  public static checkCreatePermissions<TBaseModel extends BaseModel>(
    modelType: { new (): TBaseModel },
    data: TBaseModel,
    props: DatabaseCommonInteractionProps,
  ): void {
    // If system is making this query then let the query run!
    if (props.isRoot || props.isMasterAdmin) {
      return;
    }

    // check block permissions, if any. Block permission get precedence over allow permissions.
    this.checkCreateBlockPermissions(modelType, props);

    TablePermission.checkTableLevelPermissions(
      modelType,
      props,
      DatabaseRequestType.Create,
    );

    ColumnPermissions.checkDataColumnPermissions(
      modelType,
      data,
      props,
      DatabaseRequestType.Create,
    );
  }

  public static checkCreateBlockPermissions<TBaseModel extends BaseModel>(
    modelType: { new (): TBaseModel },
    props: DatabaseCommonInteractionProps,
  ): void {
    // If system is making this query then let the query run!
    if (props.isRoot || props.isMasterAdmin) {
      return;
    }

    TablePermission.checkTableLevelBlockPermissions(
      modelType,
      props,
      DatabaseRequestType.Create,
    );
  }
}
