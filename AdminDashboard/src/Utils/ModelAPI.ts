import Dictionary from "Common/Types/Dictionary";
import ModelAPI from "Common/UI/Utils/ModelAPI/ModelAPI";

export default class AdminModelAPI extends ModelAPI {
  public static override getCommonHeaders(): Dictionary<string> {
    return {};
  }
}
