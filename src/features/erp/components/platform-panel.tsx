import { getErpPlatformState } from "../access";
import { ErpPlatformControl } from "./governance-forms";

export async function ErpPlatformPanel() {
  const platform = await getErpPlatformState();
  return <ErpPlatformControl enabled={platform.enabled} modules={platform.modules} />;
}
