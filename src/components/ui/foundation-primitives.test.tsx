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

  it("supports a semantic green confirmation with disabled and pending states", () => {
    const { rerender } = render(<Button variant="success" type="submit">Confirmar reatribuição</Button>)

    const button = screen.getByRole("button", { name: "Confirmar reatribuição" })
    // Lite/Arc skin: solid semantic fill, pill.
    expect(button).toHaveClass("text-success-foreground", "bg-success", "rounded-full")
    expect(button).toHaveAttribute("type", "submit")
    expect(button).toBeEnabled()

    rerender(<Button variant="success" type="submit" disabled>Reatribuindo...</Button>)
    expect(screen.getByRole("button", { name: "Reatribuindo..." })).toBeDisabled()
    // Lite: disabled at .52, keyboard focus as an outline (no ring).
    expect(button).toHaveClass("disabled:opacity-[.52]", "focus-visible:outline-2")
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

    expect(screen.getByLabelText("Nome")).toHaveClass("rounded-full")
    // Multi-line field: 24px radius (a pill would distort a tall box).
    expect(screen.getByLabelText("Observações")).toHaveClass("rounded-3xl")
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome.")
  })
})
