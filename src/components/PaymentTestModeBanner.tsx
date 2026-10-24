const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-center text-sm text-destructive-foreground">
        A cobrança real ainda não está ativa. Conclua a ativação dos pagamentos antes de receber clientes.
      </div>
    );
  }

  if (clientToken.startsWith('pk_test_')) {
    return (
      <div className="w-full border-b border-brand/30 bg-brand-muted px-4 py-2 text-center text-sm text-foreground">
        Modo de teste: nenhuma cobrança feita nesta página é real.
      </div>
    );
  }

  return null;
}