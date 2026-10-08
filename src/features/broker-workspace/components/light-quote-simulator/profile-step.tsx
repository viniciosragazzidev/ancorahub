"use client";

import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import { REGIONS, type ProfileType, type Region } from "@/features/broker-workspace/quote-simulator/mock-data";
import { getAgeBand } from "@/features/broker-workspace/quote-simulator/pricing";

import { lifeLabel, MAX_LIVES, PROFILE_OPTIONS } from "./constants";
import type { QuoteSimulator } from "./use-quote-simulator";

const card = "flex flex-col gap-5 rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)";

/** Step 1: type of hiring, region, and the ages of everyone who needs coverage. */
export function ProfileStep({ q }: { q: QuoteSimulator }) {
  const { profileType, region, beneficiaries } = q;

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="profile-heading" className={card}>
        <div>
          <h2 id="profile-heading" className="text-lg font-semibold text-(--foreground)">Perfil e região</h2>
          <p className="mt-1 text-sm text-(--text-secondary)">Escolha o tipo de contratação para ajustar os exemplos.</p>
        </div>
        <RadioCards
          aria-label="Perfil da contratação"
          layout="grid"
          options={PROFILE_OPTIONS}
          value={profileType}
          onValueChange={(value) => q.setProfileType(value as ProfileType)}
        />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-(--foreground)">Cidade ou região</p>
          <RadioCards
            aria-label="Cidade ou região"
            layout="list"
            options={REGIONS.map(({ value, label }) => ({ value, label }))}
            value={region}
            onValueChange={(value) => q.setRegion(value as Region)}
          />
        </div>
        {profileType === "pme" ? (
          <Input
            label="CNPJ (opcional, somente exemplo)"
            description="Este campo não é validado nem enviado. A simulação PME considera de 2 a 29 vidas."
            value={q.mockCnpj}
            onChange={(event) => q.setMockCnpj(event.target.value.slice(0, 18))}
            placeholder="00.000.000/0000-00"
            autoComplete="off"
            inputMode="numeric"
          />
        ) : null}
        {profileType === "adhesion" ? (
          <div className="flex flex-col gap-4">
            <Input
              label="Entidade ou administradora"
              value={q.entity}
              onChange={(event) => q.setEntity(event.target.value)}
              placeholder="Ex.: Qualicorp ou Allcare"
              autoComplete="off"
            />
            <Input
              label="Profissão ou categoria"
              description="Entidades e critérios de elegibilidade são exemplos. A operadora e a administradora confirmam a aceitação."
              value={q.profession}
              onChange={(event) => q.setProfession(event.target.value)}
              placeholder="Ex.: profissional da saúde"
              autoComplete="off"
            />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="lives-heading" className={card}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="lives-heading" className="text-lg font-semibold text-(--foreground)">Quem precisa de cobertura?</h2>
            <p className="mt-1 text-sm text-(--text-secondary)">Informe as idades do titular e dos dependentes.</p>
          </div>
          <Badge tone="neutral"><span className="tabular-nums">{lifeLabel(beneficiaries.length)}</span></Badge>
        </div>
        <ul className="flex flex-col gap-4">
          {beneficiaries.map((beneficiary, index) => {
            const parsedAge = beneficiary.age === "" ? null : Number(beneficiary.age);
            const ageBand = parsedAge !== null && Number.isInteger(parsedAge) && parsedAge >= 0 && parsedAge <= 120 ? getAgeBand(parsedAge) : null;
            const name = index === 0 ? "Titular" : "Dependente " + index;
            return (
              <li key={beneficiary.id} className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <Input
                    label={`${name}, idade em anos`}
                    type="number"
                    min={0}
                    max={120}
                    step={1}
                    inputMode="numeric"
                    value={beneficiary.age}
                    onChange={(event) => q.updateAge(beneficiary.id, event.target.value)}
                    description={ageBand ? "Faixa ANS: " + ageBand.label : "Digite uma idade de 0 a 120 anos"}
                    placeholder="Ex.: 35"
                  />
                </div>
                {index > 0 ? (
                  <Button variant="ghost" aria-label={"Remover dependente " + index} onClick={() => q.removeBeneficiary(beneficiary.id)}>
                    Remover
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={q.addBeneficiary} disabled={beneficiaries.length >= MAX_LIVES}>
            Adicionar dependente
          </Button>
          <p className="text-sm text-(--text-secondary)">A faixa etária demonstrativa segue as dez faixas da RN ANS 563/2022.</p>
        </div>
      </section>
    </div>
  );
}
