#import "@preview/touying:0.6.1": *
#import "@preview/cetz:0.4.2" as cetz
#import "@preview/fletcher:0.5.8" as fletcher

#let title-slide() = touying-slide-wrapper(self => {
  let body = {
    let info = self.info

    place(top + left, pad(x: 3em, y: 2em, {
      set text(size: 1em)
      set par(spacing: 0.65em, leading: 0.6em)
      if info.event != none {
        info.event
      }
    }))

    place(horizon + left, pad(x: 3em, y: 0em, {
      set text(size: 1.3em, weight: "bold")
      set par(spacing: 0em)
      box({
        info.title
      })
      v(20pt)
      align(center, {
        box(width: 105%, {
          align(left, {
            line(length: 100%, stroke: 2pt + self.colors.primary)
            v(4pt)
            line(length: 60%, stroke: 10pt + self.colors.primary)
          })
        })
      })
    }))

    place(bottom + left, pad(x: 3em, y: 3em, {
      figure({
        image("logo.png", width: 20%)
      })
    }))

    place(bottom + right, pad(x: 3em, y: 3em, {
      set text(size: 1em)
      set par(spacing: 0.65em, leading: 0.6em)
      info.author
    }))
  }
  let footer(self) = {
    set text(size: 0.7em)
    place(bottom + right, pad(x: 3em, y: 2em, {
      context utils.slide-counter.display()
    }))
  }
  self = utils.merge-dicts(
    self,
    config-page(
      footer: footer,
      header-ascent: 0pt,
      footer-descent: 0pt,
      margin: 0pt,
    ),
  )
  touying-slide(self: self, body)
})

#let outline-slide(items, index) = touying-slide-wrapper(self => {
  let header(self) = {
    place(top + left, pad(x: 3em, y: 2em, {
      set text(size: 1.15em, weight: "bold")
      set par(spacing: 0pt)
      box({
        [
          == 目次
        ]
      })
      v(20pt)
      align(center, {
        box(width: 105%, {
          align(left, {
            line(length: 100%, stroke: 2pt + self.colors.primary)
            v(4pt)
            line(length: 60%, stroke: 10pt + self.colors.primary)
          })
        })
      })
    }))
  }
  let footer(self) = {
    set text(size: 0.7em)
    place(bottom + right, pad(x: 3em, y: 2em, {
      context utils.slide-counter.display()
    }))
  }
  self = utils.merge-dicts(
    self,
    config-page(
      header: header,
      footer: footer,
      header-ascent: 0pt,
      footer-descent: 0pt,
      margin: (top: 5.5em, left: 3em, right: 3em, bottom: 2em),
    ),
  )
  let body = {
    for (i, item) in items.enumerate() {
      let color = if i == index { rgb("#c62828") } else { black }
      let (title, subitems) = item
      list.item(text(fill: color, weight: "bold", title))
      if subitems != none {
        set text(size: 0.85em)
        pad(left: 1.2em, subitems)
      }
    }
  }
  touying-slide(self: self, body)
})

#let slide(..args) = touying-slide-wrapper(self => {
  let header(self) = {
    place(top + left, pad(x: 3em, y: 2em, {
      set text(size: 1.15em, weight: "bold")
      set par(spacing: 0pt)
      box(context {
        let current-heading = utils.current-heading(level: 2)
        current-heading
      })
      v(20pt)
      align(center, {
        box(width: 105%, {
          align(left, {
            line(length: 100%, stroke: 2pt + self.colors.primary)
            v(4pt)
            line(length: 60%, stroke: 10pt + self.colors.primary)
          })
        })
      })
    }))
  }
  let footer(self) = {
    set text(size: 0.7em)
    place(bottom + right, pad(x: 3em, y: 2em, {
      context utils.slide-counter.display()
    }))
  }
  self = utils.merge-dicts(
    self,
    config-page(
      header: header,
      footer: footer,
      header-ascent: 0pt,
      footer-descent: 0pt,
      margin: (top: 5.5em, left: 3em, right: 3em, bottom: 2em),
    ),
  )
  touying-slide(self: self, ..args)
})

#let kindai-theme(
  ..args,
  body,
) = {
  set text(size: 24pt)
  set par(justify: true)
  set list(marker: square(size: 0.6em, fill: rgb("#00517c")))

  show: touying-slides.with(
    config-page(
      margin: 0pt,
      header-ascent: 0pt,
      footer-descent: 0pt,
    ),
    config-common(
      slide-fn: slide,
    ),
    config-colors(
      primary: rgb("#00517c"),
    ),
    config-store(
      title: none,
      author: none,
      event: none,
    ),
    ..args,
  )

  body
}

#set text(font: "Noto Sans CJK JP")
#show: kindai-theme.with(
  config-info(
    title: [HCLと意味的に階層化されたUIの相互変換\ によるクラウド構成の視覚的編集],
    author: [ネットワーク研究室\ 22-1-211-0187\ 平田 麟太朗],
    event: [令和7年度卒業研究発表会\ 2026年2月2日（月）\ 9:42 \~ 9:54 \@ E館2階E-209],
  ),
)

#let outline-items = (
  (
    [はじめに],
    [
      - 背景と課題
      - 既存ツール
      - 開発したツールの概要
    ],
  ),
  (
    [研究内容],
    [
      - 実装方法
      - 動作検証・デモ
    ],
  ),
  ([まとめ], none),
)

#title-slide()

#outline-slide(outline-items, none)

#outline-slide(outline-items, 0)

== はじめに：背景と課題
#grid(
  columns: (1.5fr, 1fr),
  gutter: 0.6em,
  [
    === 背景
    - クラウド利用の拡大
    - IaCの一般化
    - Terraform+HCLが事実上の標準
    === 課題
    - 大規模なHCLで全体像が見えない
    - 依存関係が複雑になりやすい
    - 学習コストが高い
  ],
  [
    #set text(size: 12pt)
    #raw(
      "provider \"aws\" {\n  region = \"ap-northeast-1\"\n}\n\nresource \"aws_vpc\" \"main\" {\n  cidr_block = \"10.0.0.0/16\"\n}\n\nresource \"aws_subnet\" \"public\" {\n  vpc_id            = aws_vpc.main.id\n  cidr_block        = \"10.0.1.0/24\"\n  availability_zone = \"ap-northeast-1a\"\n}\n\nresource \"aws_instance\" \"web\" {\n  ami           = \"ami-12345678\"\n  instance_type = \"t3.micro\"\n  subnet_id     = aws_subnet.public.id\n}\n",
      lang: "hcl",
      block: true,
    )
  ],
)

== はじめに：既存ツール
=== 既存ツール
- Terraform CLIのgraphコマンド
- Inframap
- Brainboard

=== 既存ツールの機能
- HCLをグラフで可視化
- グラフの編集をHCLに反映

#pagebreak()

=== 既存ツールの限界
- 大規模なHCLで複雑になりやすい
- クローズドソースで有償
- グラフ編集時にコメントが消える / 勝手にフォーマットされる

#align(center)[
  #set text(size: 12pt)
  #table(
    columns: (1.4fr, 0.7fr, 1.6fr, 0.7fr, 0.9fr, 1.1fr, 0.6fr),
    inset: 7pt,
    align: center,
    stroke: 0.5pt,
    [*ツール*], [*可視化*], [*大規模なHCLの見やすさ*], [*編集*], [*ロスレス*], [*無償*], [*OSS*],
    [Terraform CLI], [○], [×], [×], [編集未対応], [○], [○],
    [InfraMap], [○], [×], [×], [編集未対応], [○], [○],
    [Brainboard], [○], [○], [○], [×], [△（一部無償）], [×],
  )
]

== 開発したツールの概要
=== TerraGUI
- 大規模なHCLを階層化して表示
- オープンソースで無償
- グラフ編集時にコメントを保持しHCL差分が最小
#align(center)[
  #set text(size: 12pt)
  #table(
    columns: (1.4fr, 0.7fr, 1.6fr, 0.7fr, 0.9fr, 1.1fr, 0.6fr),
    inset: 8pt,
    align: center,
    stroke: 0.5pt,
    [*ツール*], [*可視化*], [*大規模なHCLの見やすさ*], [*編集*], [*ロスレス*], [*無償*], [*OSS*],
    [Terraform CLI], [○], [×], [×], [編集未対応], [○], [○],
    [InfraMap], [○], [×], [×], [編集未対応], [○], [○],
    [Brainboard], [○], [○], [○], [×], [△（一部無償）], [×],
    [#text(fill: red, weight: "bold")[TerraGUI]],
    [#text(fill: red, weight: "bold")[○]],
    [#text(fill: red, weight: "bold")[○]],
    [#text(fill: red, weight: "bold")[○]],
    [#text(fill: red, weight: "bold")[○]],
    [#text(fill: red, weight: "bold")[○]],
    [#text(fill: red, weight: "bold")[○]],
  )
]

#outline-slide(outline-items, 1)

== 研究内容：実装（システム構成）
#align(center)[
  #set text(size: 14pt)
  #table(
    columns: (1fr, 1.6fr),
    inset: 8pt,
    align: left,
    stroke: 0.5pt,
    [*言語*], [TypeScript],
    [*ライブラリ*], [React],
    [*フレームワーク*], [Next.js],
    [*データベース*], [SQLite],
    [*ORM*], [Drizzle ORM],
    [*インフラ*], [Docker（ローカル動作前提）],
    [*環境構築*], [Dev Container],
    [*CI/CD*], [GitHub Actions],
    [*テスト*], [Vitest],
  )
]

== 研究内容：実装（HCL Engine）
- HCL文字列とCSTのロスレス相互変換
- *CST（"具象"構文木）:*
  - 空白/インデントを保持
  - 元の文字列に復元可能
- *AST（"抽象"構文木）:*
  - 空白/インデントを排除\ コードの意味だけを保持
  - 元の文字列への復元不可

== 研究内容：実装（Graph Engine）
#grid(
  columns: (1.6fr, 1fr),
  gutter: 0.6em,
  [
    - CSTとグラフ構造の相互変換
    - 参照などから依存関係を抽出
    - グラフを自動レイアウト
    - AZ, VPC, Subnet等でグループ化
    - 包含関係に従い階層的に整理
  ],
  [
    #align(center + horizon)[
      #set text(size: 12pt)
      #scale(x: 100%, y: 100%)[
        #cetz.canvas({
          import cetz.draw: *

          let panel-fill = rgb("#f2f2f2")
          let panel-stroke = rgb("#c7c7c7")
          let hcl-col = rgb("#6d6d6d")
          let vpc-col = rgb("#5fa3d3")
          let subnet-col = rgb("#7fbf7f")
          let instance-col = rgb("#f0b35e")

          rect((-4, 5.5), (4, 1.2), fill: panel-fill, stroke: panel-stroke + 1pt, radius: 0.12)
          rect((-4, -0.1), (4, -5.5), fill: panel-fill, stroke: panel-stroke + 1pt, radius: 0.12)

          content((0, 5), align(center)[#text(weight: "bold")[HCLのフラット記述]], anchor: "center")
          content((0, -0.5), align(center)[#text(weight: "bold")[意味的階層化された構造]], anchor: "center")

          rect((-3.5, 4.5), (3.5, 3.9), fill: hcl-col.lighten(55%), stroke: hcl-col + 1pt, radius: 0.12)
          rect((-3.5, 3.7), (3.5, 3.1), fill: hcl-col.lighten(55%), stroke: hcl-col + 1pt, radius: 0.12)
          rect((-3.5, 2.9), (3.5, 2.3), fill: hcl-col.lighten(55%), stroke: hcl-col + 1pt, radius: 0.12)
          rect((-3.5, 2.1), (3.5, 1.5), fill: hcl-col.lighten(55%), stroke: hcl-col + 1pt, radius: 0.12)

          content((0, 4.2), align(center)[VPC], anchor: "center")
          content((0, 3.4), align(center)[Subnet A], anchor: "center")
          content((0, 2.6), align(center)[Subnet B], anchor: "center")
          content((0, 1.8), align(center)[Instance], anchor: "center")

          rect((-3.5, -0.9), (3.5, -5.2), fill: vpc-col.lighten(60%), stroke: vpc-col + 1pt, radius: 0.14)
          content((0, -1.2), align(center)[#text(weight: "bold")[VPC]], anchor: "center")

          rect((-2.9, -1.7), (2.9, -3.6), fill: subnet-col.lighten(55%), stroke: subnet-col + 1pt, radius: 0.12)
          rect((-2.9, -3.8), (2.9, -4.9), fill: subnet-col.lighten(55%), stroke: subnet-col + 1pt, radius: 0.12)
          content((0, -2.1), align(center)[Subnet A], anchor: "center")
          content((0, -4.35), align(center)[Subnet B], anchor: "center")

          rect((-1.7, -2.5), (1.7, -3.4), fill: instance-col.lighten(55%), stroke: instance-col + 1pt, radius: 0.12)
          content((0, -3.0), align(center)[Instance], anchor: "center")

          line((0, 1.2), (0, -0.1), stroke: rgb("#5a5a5a") + 0.9pt, mark: (end: "stealth"))
          content((1.4, 0.55), align(center)[解析・階層化], anchor: "center")
        })
      ]
    ]
  ],
)

== 研究内容：実装（Terraform IDE）

#grid(
  columns: (1fr, 1fr),
  gutter: 0.6em,
  [
    === プロパティエディタ
    - リソースの設定フォーム
    - 設定からフォーム自動生成
    - 変更は最小の差分で反映
  ],

  [
    === アイコン自動生成
    - アイコンとリソースの紐付け
    - パスとリソース名を類似度マッチ
  ],
)

=== CLI連携
- `terraform`, `terracognita`を統合
- 変更適用、インポートをローカルで
- 認証情報インメモリで一時的に保持

== 研究内容：動作検証・デモ
#page[]

#outline-slide(outline-items, 2)

== まとめ

=== 貢献
- CSTによるロスレス編集
- 意味的に階層化されたグラフ
- ローカルで完結するIDE

=== 展望
- LLMによる構成理解や編集の支援
- 新規リソースの追加やエッジ操作
