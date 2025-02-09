import BadDataException from "Common/Types/Exception/BadDataException";
import ObjectID from "Common/Types/ObjectID";
import LocalCache from "Common/Server/Infrastructure/LocalCache";

export default class ProbeUtil {
  public static getProbeId(): ObjectID {
    const id: string | undefined =
      LocalCache.getString("PROBE", "PROBE_ID") || process.env["PROBE_ID"];

    if (!id) {
      throw new BadDataException("Probe ID not found");
    }

    return new ObjectID(id);
  }
}
