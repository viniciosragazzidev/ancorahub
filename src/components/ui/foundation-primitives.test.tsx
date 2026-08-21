// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { Button } from "./button"
import { Card, CardContent, CardTitle } from "./card"
import { Field, FieldDescription, FieldError, FieldLabel } from "./field"
import { Input } from "./input"
import { Textarea } from "./textarea"

afterEach(cleanup)

describe("foundation primitives", () => {
  it("keeps the primary action accessible and pill-shaped", () => {
    render(<Button>Salvar alterações</Button>)

    const button = screen.getByRole("button", { name: "Salvar alterações" })
    expect(button).toHaveClass("rounded-full")
    expect(button).toHaveClass("bg-primary")
  })

  it("keeps content grouped in the shared flat card surface", () => {
    render(
      <Card>
        <CardContent>
          <CardTitle>Resumo operacional</CardTitle>
        </CardContent>
      </Card>,
    )

    expect(screen.getByText("Resumo operacional").closest("div[data-slot='card']")).toHaveClass(
      "rounded-[var(--radius-card)]",
    )
  })

  it("connects native controls to the shared accessible field composition", () => {
    render(
      <Field>
        <FieldLabel htmlFor="nome">Nome</FieldLabel>
        <Input id="nome" />
        <FieldDescription>Como o contato será identificado.</FieldDescription>
        <FieldError>Informe o nome.</FieldError>
        <Textarea aria-label="Observações" />
      </Field>,
    )

    expect(screen.getByLabelText("Nome")).toHaveClass("rounded-[var(--radius-control)]")
    expect(screen.getByLabelText("Observações")).toHaveClass("rounded-[var(--radius-control)]")
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome.")
  })
})
