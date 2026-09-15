import { normalizePhone } from "@/shared/utils/phone";

/**
 * Identificador estável do assinante para reconciliação de histórico WAHA.
 * O DDD pode divergir entre o cadastro do lead e o chat real; os nove últimos
 * dígitos são o número móvel e não carregam essa divergência.
 */
export function phoneSubscriberSuffix(value?: string | null): string {
  const digits = normalizePhone(value);
  return digits.length >= 9 ? digits.slice(-9) : "";
}

export function samePhoneSubscriber(left?: string | null, right?: string | null): boolean {
  const leftSuffix = phoneSubscriberSuffix(left);
  const rightSuffix = phoneSubscriberSuffix(right);
  return Boolean(leftSuffix && rightSuffix && leftSuffix === rightSuffix);
}
