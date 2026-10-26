import { describe, expect, it } from "vitest";

import { AVATAR_FILE_NAME, avatarPublicPath, avatarStorageKey, isAvatarDataUrl, parseAvatarDataUrl } from "./avatar-file";

const png = `data:image/png;base64,${Buffer.from("fake-png-bytes").toString("base64")}`;

describe("foto de perfil fora da linha do usuário", () => {
  it("lê a data URL, dá a extensão e um hash estável do conteúdo", () => {
    const first = parseAvatarDataUrl(png);
    expect(first).toMatchObject({ extension: "png", contentType: "image/png" });
    expect(first?.hash).toMatch(/^[a-f0-9]{16}$/);
    expect(parseAvatarDataUrl(png)?.hash).toBe(first?.hash);
    expect(parseAvatarDataUrl(png.replace("png;", "jpeg;"))?.extension).toBe("jpg");
  });

  it("recusa o que não é imagem em base64", () => {
    expect(parseAvatarDataUrl("data:text/html;base64,PGgxPg==")).toBeNull();
    expect(parseAvatarDataUrl("https://exemplo.com/foto.png")).toBeNull();
    expect(parseAvatarDataUrl("data:image/png;base64,")).toBeNull();
  });

  it("guarda em user.image só um endereço curto, que a rota aceita", () => {
    const parsed = parseAvatarDataUrl(png)!;
    const file = `${parsed.hash}.${parsed.extension}`;
    const path = avatarPublicPath("user-1", file);
    expect(path).toBe(`/api/users/user-1/avatar/${file}`);
    expect(path.length).toBeLessThan(80);
    expect(AVATAR_FILE_NAME.test(file)).toBe(true);
    expect(AVATAR_FILE_NAME.test("../segredo.png")).toBe(false);
    expect(avatarStorageKey("user-1", file)).toBe(`avatars/users/user-1/${file}`);
    expect(isAvatarDataUrl(path)).toBe(false);
    expect(isAvatarDataUrl(png)).toBe(true);
  });
});
