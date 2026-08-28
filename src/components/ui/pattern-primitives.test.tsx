// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { FilterToolbar } from "./filter-toolbar"
import { FormSection } from "./form-section"
import { PageHeader } from "./page-header"

afterEach(cleanup)

describe("pattern primitives", () => {
  it("gives a page one semantic title and keeps actions contextual", () => {
    render(
      <PageHeader
        eyebrow="Leads"
        title="Fila operacional"
        description="Priorize os atendimentos que exigem ação."
        actions={<button type="button">Novo lead</button>}
      />,
    )

    expect(screen.getByRole("heading", { level: 1, name: "Fila operacional" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Novo lead" })).toBeInTheDocument()
  })

  it("groups filters, result context and actions without owning their behavior", () => {
    render(
      <FilterToolbar
        filters={<input aria-label="Buscar leads" />}
        results="12 leads"
        actions={<button type="button">Limpar filtros</button>}
      />,
    )

    expect(screen.getByRole("textbox", { name: "Buscar leads" })).toBeInTheDocument()
    expect(screen.getByText("12 leads")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Limpar filtros" })).toBeInTheDocument()
  })

  it("groups a form by subject without adding validation or domain logic", () => {
    render(
      <FormSection title="Informações básicas" description="Dados usados para identificar o registro.">
        <input aria-label="Nome" />
      </FormSection>,
    )

    expect(screen.getByRole("heading", { level: 2, name: "Informações básicas" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Nome" })).toBeInTheDocument()
  })
})
