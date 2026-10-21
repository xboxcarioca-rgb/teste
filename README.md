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
2. Crie uma chave pessoal da Pollinations em <https://enter.pollinations.ai/keys>.
3. Cole a chave na janela do app e escolha **Salvar e continuar**.
4. Escreva o prompt e use **Gerar imagens**.

A chave é mantida somente em `sessionStorage` do navegador, não é adicionada ao código ou ao repositório. As imagens são solicitadas diretamente ao endpoint oficial `https://gen.pollinations.ai`.

- Sem referência, o app usa o endpoint de imagem e solicita uma imagem com transparência quando a opção estiver ligada.
- Com referência, o app envia o arquivo local ao endpoint de edição para que a IA use a imagem como guia.
- O botão de download salva o arquivo retornado pela IA.

> O site não limita artificialmente a quantidade de gerações. A disponibilidade, os modelos aceitos, a transparência e eventuais custos/saldo são definidos pela conta e pelo provedor de IA conectado.
