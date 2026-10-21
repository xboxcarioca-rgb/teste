# Lúmina — gerador de imagens por IA

Interface estática para criar imagens reais a partir de texto, com suporte a imagem de referência, proporção, estilo e exportação.

## Executar

Não há dependências para instalar:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Depois, abra `http://localhost:4173`.

## Conectar a IA real (Pollinations)

O Lúmina usa o fluxo oficial de autorização **BYOP** da Pollinations: uma `App Key` pública (`pk_...`) identifica o site e, depois da sua aprovação, a Pollinations devolve um token temporário de geração (`sk_...`) para a sessão atual.

1. No site, clique em **Conectar IA**.
2. Copie a **URL de retorno** que aparece na janela.
3. Em <https://enter.pollinations.ai/keys>, crie uma **App Key** (`pk_...`) e cadastre exatamente essa URL em **Redirect URI**. Habilite a categoria `image`.
4. Cole a App Key no Lúmina e clique em **Conectar conta**.
5. Faça login/autorize a conta na Pollinations. Você voltará ao Lúmina já conectado.
6. Escreva o prompt e use **Gerar imagens**.

A chave temporária de geração é mantida somente em `sessionStorage`; ela não é colocada no repositório nem permanece na URL depois do retorno da autorização. A geração padrão usa `black-forest-labs/flux.1-schnell` pela maior compatibilidade.

- Com referência, o app envia o arquivo local ao endpoint de edição para que a IA use a imagem como guia.
- Fundo transparente usa um modelo GPT Image compatível, que pode pedir permissões/créditos diferentes. Gere primeiro com essa opção desligada para verificar sua autorização.
- O botão de download abre o arquivo retornado pela IA para salvar.

> O site não limita artificialmente a quantidade de gerações. A disponibilidade, os modelos aceitos, a transparência e eventuais custos/saldo são definidos pela conta e pelo provedor de IA conectado.
