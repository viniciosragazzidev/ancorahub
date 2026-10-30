export function qualificationContextAnalysisSettingKeys(tenantId: string, queueId?: string | null) {
  const tenantKey = `qualification_context_analysis_${tenantId}`;
  return {
    tenant: tenantKey,
    queue: queueId ? `${tenantKey}_${queueId}` : null,
  };
}

/** A tenant-level disable is authoritative; missing settings default to enabled. */
export function isQualificationContextAnalysisEnabled(input: {
  tenantSetting?: string | null;
  queueSetting?: string | null;
  aiQualificationEnabled?: boolean | null;
}) {
  if (input.aiQualificationEnabled === false) return false;
  if (input.tenantSetting === "false") return false;
  if (input.queueSetting === "false") return false;
  return true;
}
