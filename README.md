# Lúmina — gerador de imagens por IA

Interface estática para criar imagens reais a partir de texto, com suporte a imagem de referência, proporção, estilo e exportação.

## Executar

Não há dependências para instalar:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Depois, abra `http://localhost:4173`.

## Conectar a IA real

1. No canto superior direito, selecione **Conectar IA**.
2. Crie uma chave de navegador `pk_` da Pollinations em <https://enter.pollinations.ai/keys>, com a categoria **image** habilitada.
3. Cole a chave na janela do app e escolha **Salvar e continuar**.
4. Escreva o prompt e use **Gerar imagens**.

A chave é mantida somente em `sessionStorage` do navegador, não é adicionada ao código ou ao repositório. As imagens são solicitadas diretamente ao endpoint oficial `https://gen.pollinations.ai`, com o cabeçalho `Authorization` — a chave não é anexada à URL.

- Sem referência, o app começa no modelo `black-forest-labs/flux.1-schnell`, uma opção de maior compatibilidade para gerar imagens reais.
- Com referência, o app envia o arquivo local ao endpoint de edição para que a IA use a imagem como guia.
- Fundo transparente usa um modelo GPT Image compatível, que pode pedir permissões/créditos diferentes. Caso dê erro, desligue essa opção para confirmar primeiro a geração padrão.
- O botão de download salva o arquivo retornado pela IA.

> O site não limita artificialmente a quantidade de gerações. A disponibilidade, os modelos aceitos, a transparência e eventuais custos/saldo são definidos pela conta e pelo provedor de IA conectado.
