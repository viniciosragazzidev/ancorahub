import React from "react";
import Link from "next/link";
import { ArrowLeft, Building, Save, Sparkles, CheckCircle2 } from "lucide-react";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getCompanyProfile, updateCompanyProfile } from "@/features/tenant-intelligence/service";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function CompanyProfilePage() {
  const context = await getRequiredTenantContext();
  const profile = await getCompanyProfile(context.tenantId);

  async function handleSave(formData: FormData) {
    "use server";
    const ctx = await getRequiredTenantContext();
    const tradeName = formData.get("tradeName") as string;
    const companyName = formData.get("companyName") as string;
    const cnpj = formData.get("cnpj") as string;
    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const website = formData.get("website") as string;
    const description = formData.get("description") as string;
    const addressStreet = formData.get("addressStreet") as string;
    const addressCity = formData.get("addressCity") as string;
    const addressState = formData.get("addressState") as string;

    await updateCompanyProfile(ctx.tenantId, {
      tradeName,
      companyName,
      cnpj,
      phone,
      email,
      website,
      description,
      addressStreet,
      addressCity,
      addressState,
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/inteligencia">
            <Button variant="outline" size="icon" className="rounded-lg">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Building className="size-5 text-primary" />
              Perfil Estruturado da Corretora
            </h1>
            <p className="text-xs text-muted-foreground">
              Fonte primária da verdade sobre a corretora no CRM e no RAG da IA
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
          <CheckCircle2 className="size-3.5" /> Fonte Oficial (CRM)
        </Badge>
      </div>

      <form action={handleSave} className="space-y-6">
        {/* Identidade da Empresa */}
        <Card className="rounded-xl border border-border/80 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold">Identidade da Corretora</CardTitle>
            <CardDescription className="text-xs">Dados cadastrais e institucionais oficiais</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Nome Fantasia</label>
                <Input name="tradeName" defaultValue={profile.tradeName || ""} placeholder="Ex: Âncora Saúde" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Razão Social</label>
                <Input name="companyName" defaultValue={profile.companyName || ""} placeholder="Ex: Âncora Corretora de Seguros LTDA" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">CNPJ</label>
                <Input name="cnpj" defaultValue={profile.cnpj || ""} placeholder="00.000.000/0001-00" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Website Oficial</label>
                <Input name="website" defaultValue={profile.website || ""} placeholder="https://ancorasaude.com.br" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Descrição Institucional</label>
              <Textarea
                name="description"
                rows={3}
                defaultValue={profile.description || ""}
                placeholder="Resumo institucional da corretora, anos no mercado e especialidades..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Contato e Endereço */}
        <Card className="rounded-xl border border-border/80 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold">Atendimento & Localização</CardTitle>
            <CardDescription className="text-xs">Canais oficiais de contato e sede principal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Telefone Principal</label>
                <Input name="phone" defaultValue={profile.phone || ""} placeholder="(71) 3333-0000" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">E-mail de Contato</label>
                <Input name="email" defaultValue={profile.email || ""} placeholder="contato@ancorasaude.com.br" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Logradouro / Rua</label>
                <Input name="addressStreet" defaultValue={profile.addressStreet || ""} placeholder="Av. Tancredo Neves" />
              </div>
              <div className="space-y-1.5 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">Cidade</label>
                  <Input name="addressCity" defaultValue={profile.addressCity || ""} placeholder="Salvador" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Estado</label>
                  <Input name="addressState" defaultValue={profile.addressState || ""} placeholder="BA" />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end pt-4 border-t">
            <Button type="submit" className="gap-2">
              <Save className="size-4" />
              Salvar Perfil da Corretora
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
