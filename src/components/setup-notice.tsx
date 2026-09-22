import { Database } from "lucide-react";

export function SetupNotice() {
  return (
    <aside className="setup-notice">
      <Database aria-hidden="true" size={20} />
      <div>
        <strong>Modo de demonstração</strong>
        <p>Conecte o Supabase para salvar seus dados de verdade.</p>
      </div>
    </aside>
  );
}
