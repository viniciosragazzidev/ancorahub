import { describe, expect, it } from "vitest";

import { brazilNinthDigitVariant, contactNumberShape, phoneSubscriberSuffix, samePhoneSubscriber } from "./phone-matching";

describe("WAHA phone reconciliation", () => {
  it("matches the same subscriber when only the DDD differs", () => {
    expect(samePhoneSubscriber("+55 (22) 99876-5432", "+55 (21) 99876-5432")).toBe(true);
    expect(phoneSubscriberSuffix("+55 (22) 99876-5432")).toBe("998765432");
  });

  it("does not match numbers with different subscriber suffixes", () => {
    expect(samePhoneSubscriber("+55 (22) 99876-5432", "+55 (21) 99876-5433")).toBe(false);
    expect(samePhoneSubscriber("998765432", "8765432")).toBe(false);
  });
});

describe("Brazilian 9th digit", () => {
  it("matches a WhatsApp JID without the 9 to the lead registered with it, and vice versa", () => {
    expect(samePhoneSubscriber("+5521999428504", "552199428504")).toBe(true);
    expect(samePhoneSubscriber("552199428504", "(21) 99942-8504")).toBe(true);
  });

  it("requires the same DDD across the 9th-digit difference", () => {
    expect(samePhoneSubscriber("+5521999428504", "551199428504")).toBe(false);
  });

  it("does not treat landlines or different numbers as the same subscriber", () => {
    expect(samePhoneSubscriber("552133428504", "5521933428504")).toBe(false);
    expect(samePhoneSubscriber("+5521999428504", "552199428505")).toBe(false);
  });

  it("builds the SQL variant both ways", () => {
    expect(brazilNinthDigitVariant("552199428504")).toBe("21999428504");
    expect(brazilNinthDigitVariant("+5521999428504")).toBe("2199428504");
    expect(brazilNinthDigitVariant("552133428504")).toBeNull();
    expect(brazilNinthDigitVariant("14155552671")).toBeNull();
  });

  it("classifies the contact number without exposing it", () => {
    expect(contactNumberShape("5521999428504")).toBe("br_celular");
    expect(contactNumberShape("552199428504")).toBe("br_sem_nono_digito");
    expect(contactNumberShape("552133428504")).toBe("br_fixo");
    expect(contactNumberShape("123456789012345")).toBe("id_longo");
  });
});
