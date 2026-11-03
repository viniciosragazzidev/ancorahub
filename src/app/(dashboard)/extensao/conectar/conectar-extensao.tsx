"use client";

import { useEffect, useState } from "react";

import page from "@/components/lite/page/lite-page.module.css";
import { descreverAparelho } from "@/features/browser-extension/aparelho";
import { enviarParaExtensao } from "@/features/browser-extension/enviar-extensao";
import styles from "@/components/lite/page/lite-sections.module.css";
import { gerarCodigoConexaoAction } from "@/features/browser-extension/conexao-actions";
import type { ConexaoParams } from "@/features/browser-extension/conexao-schemas";

export function ConectarExtensao({ nome, unidade, params }: { nome: string; unidade: string; params: ConexaoParams | null }) {
  const [estado, setEstado] = useState<"parado" | "gerando" | "conectada" | "sem-extensao" | "recusada">("parado");
  // O user agent só existe no navegador: a descrição entra depois da primeira renderização.
  const [aparelho, setAparelho] = useState("este navegador");
  useEffect(() => setAparelho(descreverAparelho(navigator.userAgent)), []);

  if (!params) {
    return (
      <div className={styles.notice} role="alert">
        <p className={styles.note}>Este link não é válido. Abra a conexão pelo ícone da extensão no navegador.</p>
      </div>
    );
  }

  const dados: ConexaoParams = params;

  async function conectar() {
    setEstado("gerando");
    try {
      const { code } = await gerarCodigoConexaoAction(dados);
      // nome e unidade são só para a extensão mostrar a conta conectada; o servidor já validou quem está conectando.
      const resposta = await enviarParaExtensao(dados.ext, { type: "CONECTAR_EXTENSAO", code, nome, unidade });
      if (resposta === null) return setEstado("sem-extensao");
      setEstado(resposta.ok ? "conectada" : "recusada");
    } catch {
      setEstado("recusada");
    }
  }

  return (
    <div className={styles.formBody}>
      <p className={styles.note}>Conectando como <strong>{nome}</strong> · {unidade}</p>
      <p className={styles.note}>Aparelho: {aparelho}</p>
      {estado === "conectada" ? (
        <div className={styles.notice} role="status">
          <p className={styles.note}>Extensão conectada. Pode fechar esta aba.</p>
        </div>
      ) : (
        <button type="button" className={page.primaryButton} disabled={estado === "gerando"} onClick={conectar}>
          {estado === "gerando" ? "Conectando…" : "Conectar"}
        </button>
      )}
      {estado === "sem-extensao" ? (
        <p className={styles.note} role="alert">Não encontramos a extensão neste navegador. Confira se ela está instalada e tente de novo.</p>
      ) : null}
      {estado === "recusada" ? (
        <p className={styles.note} role="alert">Não foi possível conectar agora. Tente de novo em instantes.</p>
      ) : null}
    </div>
  );
}
