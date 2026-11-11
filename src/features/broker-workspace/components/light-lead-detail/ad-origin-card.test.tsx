// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AdOriginCard } from "./ad-origin-card";

afterEach(cleanup);

const longBody = "Plano de saúde individual com rede no Rio, coparticipação baixa e carência reduzida para quem vem de outro plano. Consultas, exames e internação. Fale com um corretor agora.";

describe("cartão De onde veio", () => {
  it("mostra o plano anunciado, o tipo de entrada e o que o cliente viu", () => {
    render(<AdOriginCard ad={{ entry: "form", offer: "Amil custo-benefício, a partir de R$ 89", title: "Plano a partir de R$ 89", body: "Só no Rio", mediaType: "image", imageUrl: "https://cdn.example/a.jpg" }} />);
    const card = screen.getByRole("region", { name: "De onde veio" });
    expect(card).toHaveTextContent("Formulário do anúncio");
    expect(card).toHaveTextContent("Plano anunciado");
    expect(card).toHaveTextContent("Amil custo-benefício, a partir de R$ 89");
    expect(card).toHaveTextContent("O que o cliente viu");
    expect(screen.getByRole("img", { name: "Anúncio: Plano a partir de R$ 89" })).toHaveAttribute("src", "https://cdn.example/a.jpg");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sem anúncio não mostra nada", () => {
    const { container } = render(<AdOriginCard ad={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("texto longo abre e fecha", () => {
    render(<AdOriginCard ad={{ entry: "whatsapp", offer: null, title: "Plano", body: longBody, mediaType: null, imageUrl: null }} />);
    expect(screen.getByRole("region", { name: "De onde veio" })).toHaveTextContent("WhatsApp do anúncio");
    const toggle = screen.getByRole("button", { name: "Ver texto completo" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Ver menos" })).toHaveAttribute("aria-expanded", "true");
  });

  it("imagem que não carrega (URL da Meta vencida) some sem deixar buraco", () => {
    render(<AdOriginCard ad={{ entry: "form", offer: null, title: "Plano", body: null, mediaType: "video", imageUrl: "https://cdn.example/old.jpg" }} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "De onde veio" })).toHaveTextContent("Plano");
  });

  it("só o plano anunciado, sem criativo, ainda aparece", () => {
    render(<AdOriginCard ad={{ entry: "form", offer: "Bradesco PME", title: null, body: null, mediaType: null, imageUrl: null }} />);
    const card = screen.getByRole("region", { name: "De onde veio" });
    expect(card).toHaveTextContent("Bradesco PME");
    expect(card).not.toHaveTextContent("O que o cliente viu");
  });
});
