import DatabaseService from "../../../../Services/DatabaseService";
import OnTriggerBaseModel from "./OnTriggerBaseModel";
import BaseModel from "Common/Models/DatabaseModels/DatabaseBaseModel/DatabaseBaseModel";

export default class OnCreateBaseModel<
  TBaseModel extends BaseModel,
> extends OnTriggerBaseModel<TBaseModel> {
  public constructor(modelService: DatabaseService<TBaseModel>) {
    super(modelService, "on-create");
  }
}
