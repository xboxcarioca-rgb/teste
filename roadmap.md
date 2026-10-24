# Roadmap

- [x] Mostrar somente Download nas artes em halftone e Usar + Download nas demais
- [x] Identificar automaticamente o formato A2/A3/A4 na biblioteca

- [x] Tornar a listagem do Drive resiliente, cacheada e revalidável
- [x] Reduzir o peso das prévias e atualizar arquivos alterados
- [x] Sincronizar a pasta automaticamente sem apagar o conteúdo visível
- [x] Organizar arquivos automaticamente por categorias
- [x] Validar navegação, atualização, busca, previews e telas responsivas

- [x] Integrar o projeto Gestão DTF enviado ao menu Ferramentas
- [x] Reorganizar e refinar as categorias da biblioteca
- [x] Validar a Gestão DTF e as ferramentas existentes
- [x] Usar automaticamente o mesmo acesso da plataforma na Gestão DTF
- [x] Iniciar a Gestão DTF zerada e separar os dados por cliente
- [x] Destacar em amarelo os novos controles e botões de retorno
- [x] Permitir enviar uma arte da Biblioteca diretamente para o Halftone
- [x] Validar o fluxo Biblioteca → Halftone e a persistência isolada da Gestão DTF
- [x] Atualizar a landing page com todas as novas ferramentas da plataforma

- [x] Ajustar a ferramenta Halftone para telas de navegador Android e iPhone.

- [x] Substituir controles de zoom no celular por gesto de pinça no Halftone
- [x] Tornar Halftone, Biblioteca, Mockups, Montagem e Gestão responsivos em celular/tablet/desktop
- [x] Corrigir safe areas, alvos de toque e qualquer rolagem horizontal
- [x] Validar visualmente em Android, iPhone, tablet e desktop

- [x] Adicionar Catálogo em Lote às Ferramentas
- [x] Processar 20–100 PNGs com fila, mockups, códigos e persistência por conta
- [x] Exportar PDF/ZIP e publicar catálogo online compartilhável
- [x] Validar lote, falhas isoladas e telas mobile/desktop
- [x] Simplificar o Catálogo em Lote para download somente em PDF
- [x] Acelerar geração, envio e exportação do catálogo
- [x] Permitir nome manual independente para a marca d'água
- [x] Ajustar a proporção final com ampliação e redução dentro do enquadramento
- [x] Preparar o PDF do Catálogo em Lote para download imediato ao clicar
- [x] Adicionar A2 e ajuste manual pelos quatro cantos ao enquadramento final
- [x] Garantir exportação final A2/A3/A4 pelo tamanho físico em mm, orientação e validação a 300 DPI
- [x] Impedir remoção global pela cor da camiseta e reforçar a segmentação contextual em tecidos coloridos
- [x] Restringir camisas coloridas a PNG, preservar preto e manter intactos os presets preto/branco
- [x] Criar Halftone Universal para PNG em camisas brancas e coloridas, sem remoção e com Alpha original preservado
- [x] Corrigir duplicação visual e restaurar os vazados da retícula na imagem final colorida
- [x] Garantir que o PNG final use exatamente A2/A3/A4 e a orientação escolhida
- [x] Validar transparência, dimensões e 300 DPI no download final
- [x] Ajustar o upload para preencher e recortar exatamente o formato A2/A3/A4 escolhido
- [x] Detectar limites reais da arte no PNG e enquadrar automaticamente em A2/A3/A4 sem cortar conteúdo, mantendo recorte manual opcional
- [x] Fazer −/+ ajustar a arte principal em A2/A3/A4 e salvar o enquadramento exato no PNG final
- [ ] Permitir arrastar manualmente a arte no A2/A3/A4 e conservar a posição escolhida no PNG final *(pende do fonte da ferramenta — não alterar o bundle minificado)*
- [x] Corrigir a criação do Catálogo em Lote e os erros de geração por arquivo *(bucket catalog-assets na migração 0003 + config congelada na fila + fallback de createImageBitmap + uploads com allSettled)*
- [x] Acelerar o PDF e iniciar seu download automaticamente ao terminar do lote *(montagem em blocos sem travar a UI + download automático ao concluir a fila)*
- [x] Corrigir o enquadramento A2/A3/A4 para preservar textos completos no PNG final
- [x] Impedir que a limpeza final apague textos e elementos separados da arte
