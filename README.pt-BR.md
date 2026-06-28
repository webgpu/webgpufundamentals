# Fundamentos de WebGPU

Esta é [uma série de lições e tutoriais sobre WebGPU](http://webgpufundamentals.org/webgpu/lessons/pt-br/).

Este projeto ainda está em andamento. Contribuições são bem-vindas, especialmente localizações.

- [English](README.md)
- [简体中文](README.zh-CN.md)
- [한국어](README.ko.md)
- [Español](README.es.md)

## Como contribuir

Correções de bugs são sempre bem-vindas.

Se você quiser escrever um novo artigo, tente avançar sempre um passo por vez.
Não faça 2 ou mais coisas em um único passo. Explique qualquer novo conceito
matemático nos termos mais simples possíveis. Idealmente, use diagramas quando
for possível. Também costuma ser melhor perguntar antes, para garantir que
ninguém já esteja trabalhando em um artigo parecido.

### Traduzindo

Cada tradução fica em uma pasta dentro de `webgpu/lessons/<codigo-do-pais>`.

Os arquivos obrigatórios são:

    langinfo.hanson
    index.md
    toc.html

#### `langinfo.hanson`

Define várias opções específicas do idioma.
[Hanson](https://github.com/timjansen/hanson) é um formato parecido com JSON,
mas permite comentários.

Os campos atuais são:

```hanson
{
  // O idioma (aparece no menu de seleção de idioma)
  language: 'Português (Brasil)',

  // Frase exibida abaixo dos exemplos
  defaultExampleCaption: "clique aqui para abrir em uma janela separada",

  // Título exibido em cada página
  title: 'Fundamentos de WebGPU',

  // Descrição básica exibida em cada página
  description: 'Aprenda WebGPU',

  // Link para a raiz do idioma.
  link: 'http://webgpufundamentals.org/webgpu/lessons/pt-br',

  // HTML exibido depois do artigo e antes dos comentários
  commentSectionHeader: '<div>Dúvidas? <a href="http://stackoverflow.com/questions/tagged/webgpu">Pergunte no StackOverflow</a>.</div>\n        <div>Problema/Bug? <a href="http://github.com/webgpu/webgpufundamentals/issues">Crie uma issue no GitHub</a>.</div>',

  // Markdown exibido para artigos ainda não traduzidos
  missing: "Desculpe, este artigo ainda não foi traduzido. [Traduções são bem-vindas](https://github.com/webgpu/webgpufundamentals)! 😄\n\n[Por enquanto, aqui está o artigo original em inglês]({{{origLink}}}).",

  // A frase "Índice"
  toc: "Índice",

  // Tradução das categorias
  categoryMapping: {
    'basics': 'Conceitos básicos',
    'passing-data': 'Passando dados para shaders',
    'editor': 'Editor',
    'misc': 'Diversos',
    'textures': 'Texturas',
    'techniques': 'Técnicas',
    '3d': '3D',
    '2d': '2D',
    'reference': 'Referência',
    '3d-math': 'Matemática 3D',
    'lighting': 'Iluminação',
    'compute-shaders': 'Shaders de computação',
    'post-processing': 'Pós-processamento',
  },
}
```

#### `index.md`

Este é o modelo da página principal de cada idioma.

#### `toc.html`

Este é o modelo do índice do idioma. Ele é incluído tanto no índice quanto em
cada artigo. As únicas partes que não são geradas automaticamente são os links
finais, que você pode traduzir se quiser.

O sistema de build criará um placeholder para cada artigo em inglês que ainda
não tenha um artigo correspondente nesse idioma. Ele será preenchido com a
mensagem `missing` definida acima.

#### `lang.css`

Este arquivo é incluído se, e somente se, existir. A preferência do projeto é
evitar usá-lo. Em particular, a ideia é não abrir discussões sobre fontes; ele
existe basicamente como uma forma de escolher fontes por idioma. Defina apenas
as variáveis absolutamente necessárias. Exemplo:

```css
/* lessons/ko/lang.css */

/* Comente apenas os overrides absolutamente necessários! */
:root {
  --article-font-family: "melhor fonte para texto de artigo em coreano";
  --headline-font-family: "melhor fonte para títulos em coreano";
  /* um bloco de código */
  /* --code-block-font-family: "Lucida Console", Monaco, monospace; */
  /* uma palavra em uma frase */
  /* --code-font-family: monospace; */
}
```

Observe que 2 configurações não são alteradas. Parece improvável que código
precise de uma fonte diferente por idioma.

PS: Já que estamos falando disso, fontes de código com ligaduras são ótimas,
mas parecem uma má ideia para um site de tutoriais, porque as ligaduras escondem
os caracteres reais necessários. Por isso, não peça nem use uma fonte de código
com ligaduras aqui.

#### Observações de tradução

O processo de build criará um HTML placeholder para cada artigo que tenha um
arquivo `.md` em inglês em `webgpu/lessons`, mas não tenha um `.md`
correspondente no idioma. Isso facilita incluir links em um artigo que apontem
para outro artigo ainda não traduzido. Assim, você não precisa voltar e corrigir
artigos já traduzidos. Basta traduzir um artigo por vez e deixar os links como
estão. Eles apontarão para placeholders até alguém traduzir os artigos ausentes.

Os artigos têm front matter no topo:

```text
Title: Título localizado do artigo
Description: Descrição localizada do artigo (usada em RSS e tags de redes sociais)
TOC: Texto localizado para o índice
```

**NÃO ALTERE LINKS**: por exemplo, um link para um recurso local pode ser:

    [texto](link)

ou

    <img src="algumlink">

Você pode adicionar query parameters, mas não adicione `"../"` para tentar
tornar o link relativo ao arquivo `.md`. Os links devem permanecer como se o
artigo existisse no mesmo local do original em inglês.

### Como fazer o build

O site é gerado na pasta `out`.

Passos:

    git clone https://github.com/webgpu/webgpufundamentals.git
    npm ci
    npm run build
    npm run serve

Depois abra o navegador em `http://localhost:8080`.

### Build contínuo

Você pode executar `npm run start` para fazer build contínuo.
Somente os arquivos `.md` de artigos que existirem no momento em que você
executar o comando, e os arquivos normalmente copiados, são monitorados.
O índice, os modelos e as páginas iniciais não são monitorados.

### Desenvolvimento

Se você estiver atualizando dependências com `npm link`, pode usar
`npm run build-ci` e/ou `npm run watch-no-check` para ignorar a checagem de
dependências.

## Gerando a referência de funções WGSL

A [referência de funções WGSL](https://webgpufundamentals.org/webgpu/lessons/webgpu-wgsl-function-reference.html)
atualmente é gerada automaticamente para inglês por meio de uma varredura
improvisada do HTML da especificação. "Improvisada" significa que é provável
que quebre, mas por enquanto funciona na maior parte dos casos, ou pelo menos
parece produzir algo útil.

Para varrer a especificação mais recente novamente, execute
`npm run generate-wgsl-function-reference` e confira se funcionou (faça o build
e veja a página). Em especial, confira se angle brackets como `vec4<f32>`
existem onde deveriam e se seções `<pre>`, como em `textureGather`, estão
formatadas corretamente.

Para outros idiomas, provavelmente será necessário copiar o arquivo em inglês e
traduzir.
