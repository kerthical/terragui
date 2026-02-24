#import "@preview/cetz:0.4.2" as cetz

#set page(paper: "a4", margin: (top: 25mm, bottom: 25mm, left: 20mm, right: 20mm))
#set text(font: "Noto Serif CJK JP", lang: "ja", size: 9pt)
#set par(justify: true, first-line-indent: (amount: 1em, all: true), leading: 0.8em, spacing: 0.8em)
#set heading(numbering: "1.1")
#show heading: set text(size: 10pt, weight: "bold")
#show heading: set block(above: 0.8em, below: 0.8em)

#page(
  header: box(width: 100%, height: 100%)[
    #box(width: 100%, height: 100%)[
      #align(center + bottom)[
        #text(size: 11pt)[情報処理学会第88回全国大会]
      ]
    ]
    #box(width: 100%, height: 4pt)[
      #line(length: 100%)
    ]
  ],
  margin: (top: 17.5mm, bottom: 25mm, left: 20mm, right: 20mm),
)[
  #align(left)[
    #text(size: 12pt)[
      XXX-XX
    ]
  ]
  #v(1em)
  #align(center)[
    #text(size: 16pt)[
      HCLと意味的に階層化されたUIの相互変換による\
      クラウド構成の視覚的編集
    ]
    #v(-0.5em)
    #text(size: 10.5pt)[
      平田 麟太朗†#h(3em)井口 信和†‡
    ]
    #v(-0.2em)
    #text(size: 10.5pt)[
      † 近畿大学 情報学部情報学科 #h(2em) ‡ 情報学研究所
    ]
  ]
  #v(5.3em)

  #columns(2)[
    = 序論
    Infrastructure as Code の普及により，クラウドインフラの構築や管理はコードによって宣言的に行われるようになった．特にHashiCorp社が開発するTerraform @terraform は事実上の標準ツールとして広く利用されている．しかし，独自の記述言語であるHCL @hcl はテキストベースであるため，システムが大規模化するにつれてリソース間の依存関係が複雑化し，開発者のメンタルモデルとコードの実態にかい離が生じやすい．また，大規模な設定ファイルから全体像を把握することは熟練者であっても困難であり，初学者にとっては学習コストが高い @QUEVAL2025107761．

    この課題に対し，インフラ構成を可視化するツールは多数存在するが，その多くは閲覧専用であるか，編集機能を備えていても商用プロプライエタリな製品に限られている．さらに，既存ツールの重大な欠点として，HCLコードとグラフ表現の変換過程における情報の欠落が挙げられる．一般的に，Terraformの構成情報はJSON形式の中間表現を経由して解析されるため，開発者が記述したコメントや空白といった，可読性や意図を伝えるためのメタ情報が失われてしまう．これは，コードを唯一の信頼源とするIaCの原則において，ツール導入の大きな障壁となる．

    本研究では，Webブラウザ上で動作するノードベースUIにより，クラウド構成を視覚的に編集可能なOSS「TerraGUI」を提案する．提案システムは，HCLの具象構文木を扱うことで，コードの体裁やコメントを保持したままグラフとの双方向同期を行うロスレス相互変換を実現した．また，リソースの意味的なまとまりを自動的にグルーピングする階層化機能により，認知負荷を低減する．

    = 関連研究
    Terraformの可視化ツールとして，Terraform Visual @tfvisual や Inframap @inframap などが存在する．これらは主にTerraformのStateファイルやJSON出力を入力とする．この手法は解析が容易である反面，静的な可視化にとどまり，GUI上での編集結果をコードに書き戻す機能を持たない．

    一方，Brainboard @brainboard のような商用サービスはGUIでの編集をサポートしている．しかし，これらのツールはインポート時にコードを独自の内部表現に変換し，保存時に再生成するアプローチを採ることが多い．この過程で，元のHCLファイルに含まれていたコメントや独自のフォーマットが失われる場合がある．既存のコードベースを持つプロジェクトに導入した場合，一部の変更だけでファイル全体のフォーマットが変更され，バージョン管理システム上で大量の差分が発生する．これは，コードレビューにおいて論理的な変更点の判別を困難にし，チーム開発を阻害する．

    = 研究内容
    本研究では，以下の2点を満たすOSS環境の構築を行った．

    1. *ロスレスな双方向同期:* HCLコードをパースする際，抽象構文木 (AST) ではなく，コメントや空白情報を含む具象構文木 (CST) として扱う．GUIでの変更は差分としてのみコードに適用され，元の記述を破壊しない．これによりIaCの原則を崩さずにGUIの利便性を享受できる．

    2. *意味的な階層化:* リソースのフラットな羅列ではなく，VPCやサブネットといった包含関係や，IAMロールとポリシーのような論理的なグループをUI上で階層化して表示し，編集時の視認性を高める．

    == システム構成
    TerraGUIは，Next.js及びReact Flowを用いたWebアプリケーションとして実装されている．ユーザーはブラウザ上でノードとして表現されるリソースと，エッジとして表現される依存関係を操作し，バックグラウンドで動作するサーバーがリアルタイムにHCLコードを更新する．この全体構成とデータフローを@fig:architecture に示す．

    #figure(
      cetz.canvas({
        import cetz.draw: *

        let node-fill = rgb("#f0f0f0")
        let box-stroke = 1.5pt
        let font-size-main = 10pt
        let font-size-sub = 8pt
        let arrow-scale = 0.6

        rect((x: -3.6, y: -2.0), (x: 3.6, y: 0), name: "browser", stroke: box-stroke)
        content((x: -3.3, y: -0.25), [*Web Browser (UI)*], size: font-size-main, anchor: "north-west")

        rect((x: -2.1, y: -1.8), (x: 2.1, y: -0.8), name: "react-flow", stroke: box-stroke, radius: 0.3, fill: white)
        content("react-flow", align(center)[React Flow Graph], size: font-size-sub)

        rect((x: -3.6, y: -4.7), (x: 3.6, y: -2.6), name: "server", stroke: box-stroke)
        content((x: -3.3, y: -2.8), [*Server*], size: font-size-main, anchor: "north-west")

        rect((x: -3.3, y: -4.35), (x: -0.6, y: -3.35), name: "graph-engine", stroke: 1pt, radius: 0.2, fill: node-fill)
        content("graph-engine", align(center)[Graph Engine], size: font-size-sub)

        rect((x: 0.6, y: -4.35), (x: 3.3, y: -3.35), name: "hcl-engine", stroke: 1pt, radius: 0.2, fill: node-fill)
        content("hcl-engine", align(center)[HCL Engine], size: font-size-sub)

        line(
          (x: -0.6, y: -3.85),
          (x: 0.6, y: -3.85),
          mark: (start: ">", end: ">", fill: black, scale: arrow-scale),
          stroke: 1.5pt,
        )
        content((x: 0, y: -3.78), [*CST*], size: font-size-sub, anchor: "south")

        rect((x: -2.4, y: -6.3), (x: 2.4, y: -5.3), name: "fs", stroke: box-stroke, radius: 0.3)
        content("fs", align(center)[File System\(.tf Files\)], size: font-size-sub)

        line(
          (x: 0, y: -2.0),
          (x: 0, y: -2.6),
          mark: (start: ">", end: ">", fill: black, scale: arrow-scale),
          stroke: 1.5pt,
        )
        content((x: 0.2, y: -2.3), [JSON / API], size: font-size-sub, anchor: "mid-west")

        line(
          (x: 0, y: -4.7),
          (x: 0, y: -5.3),
          mark: (start: ">", end: ">", fill: black, scale: arrow-scale),
          stroke: 1.5pt,
        )
        content((x: 0.2, y: -5), align(left)[Read/Write], size: font-size-sub, anchor: "mid-west")
      }),
      caption: [TerraGUIのシステム概要とデータフロー],
    ) <fig:architecture>

    == HCLとグラフのロスレス相互変換
    本システムは，新規性の中核となる以下2つのエンジンにより，HCLテキストとグラフデータ構造の相互変換を実現している．従来のツールがTerraformのStateファイルやJSON出力を正としていたのに対し，TerraGUIはソースコードである `.tf` ファイル自体を解析対象とする．編集前後におけるコメント保持の挙動を@fig:lossless に示す．

    + *HCL Engine:* HCLと具象構文木（CST）をロスレスに相互変換するモジュールである．HCLパーサを用いてファイルを解析し，リソースブロック，属性，式を抽出する．この際，各トークンの位置情報とともにコメント（`#` や `//`）や空行もデータ構造内に保持する．これにより，真の意味で情報のロスレス性を保証する．

    + *Graph Engine:* CSTとReact Flowグラフの相互変換を担う．CSTからグラフへの変換では，ELK.jsを用いた自動レイアウトを行い，各ノードのデータプロパティとしてCSTを埋め込む．グラフからCSTへの変換（保存）時は，この埋め込まれたCSTに対して編集差分を適用し，HCLを再構成する．これにより，レイアウト情報を持たないHCLに対しても，記述者の意図（コメントや空白）を保持したままの編集を可能にしている．

    #figure(
      cetz.canvas({
        import cetz.draw: *

        let arrow-scale = 0.6

        content((x: -4, y: 0), [*Before Editing*], size: 12pt, anchor: "west")

        rect((x: -4, y: -2.4), (x: 4, y: -0.3), name: "before", stroke: 1.5pt)
        content(
          (x: -3.7, y: -0.55),
          box(width: auto)[
            #set text(size: 9.5pt, font: "Noto Mono")
            #raw("resource \"aws\" \"web\" {", lang: "hcl") \ #h(1em)#raw("// Important (Keep)", lang: "hcl") \ #h(
              1em,
            )#raw(
              "ami = \"old-123\"",
              lang: "hcl",
            ) \ #raw("}", lang: "hcl")
          ],
          anchor: "north-west",
        )

        line((x: 0, y: -2.4), (x: 0, y: -3.0), mark: (end: ">", fill: black, scale: arrow-scale), stroke: 2pt)
        content((x: 0.2, y: -2.7), [Update *ami* to *new-456*], anchor: "west", size: 9pt)

        content((x: -4, y: -2.7), [*After Editing*], size: 12pt, anchor: "west")

        rect((x: -4, y: -5.1), (x: 4, y: -3.0), name: "after", stroke: 1.5pt)
        content(
          (x: -3.7, y: -3.25),
          box(width: auto)[
            #set text(size: 9.5pt, font: "Noto Mono")
            #raw("resource \"aws\" \"web\" {", lang: "hcl") \ #h(1em)#raw("// Important (Keep)", lang: "hcl") \ #h(
              1em,
            )#raw(
              "ami = \"new-456\"",
              lang: "hcl",
            ) \ #raw("}", lang: "hcl")
          ],
          anchor: "north-west",
        )
      }),
      caption: [編集前後におけるコメント保持の挙動],
    ) <fig:lossless>

    == 意味的な階層化
    IaCコードでは全てのリソースが並列に記述されることが多いが，TerraGUIではリソースタイプや `vpc_id` などの属性を解析し，視覚的な包含関係を構築する．
    例えば，AWSプロバイダにおいて `aws_subnet` リソースが `vpc_id` 属性を持つ場合，UI上ではそのサブネットノードをVPCノードの内部に配置する．また，セキュリティグループやIAMといった論理的な設定群は仮想グループノードとしてまとめることで，グラフの複雑性を抑制している．

    == 編集の適用
    TerraGUIは単なるエディタにとどまらず，編集結果を実際のクラウド環境へ適用する機能も備えている．編集完了後，ユーザーが適用操作を行うと，システムは以下の手順を実行する．
    + *HCL生成:* Graph Engine及びHCL Engineが最新のグラフ状態からHCLコードを生成する．
    + *実行計画の作成:* データベースに暗号化して保存されたプロバイダの認証情報（AWS Access Key等）を利用し，バックグラウンドで `terraform plan` コマンドを実行する．出力された実行計画はUI上に表示され，ユーザーは変更内容が意図通りかを確認できる．
    + *インフラの更新:* ユーザーの承認後，`terraform apply` コマンドが実行され，実環境への変更が適用される．

    このプロセスにより，GUI上の編集，コードへの反映，そして実環境への適用という一連のフローが完結し，常にHCLコードを正とした整合性のあるインフラ管理が実現される．

    == リソースアイコンの自動生成
    数千種類に及ぶクラウドリソースの可視化において，手動でのアイコン紐付けは困難である．本システムでは，AWS，Azure，GCPの公式アイコンセットを自動収集し，Terraformのリソース名とファイル名のトークン類似度に基づいて動的にマッピングする機構を実装した．これにより，プロバイダの更新に追従した持続的なアイコン管理を実現している．

    == 実装と機能的評価
    現在，GitHub上の `kerthical/terragui` でOSSとして公開しており，Dockerコンテナを用いて容易にローカル環境で起動可能である．
    本システムの品質保証として，HCL EngineやGraph Engineのロスレス性を検証する単体テストから，実際のブラウザ操作を模倣したシナリオテストまでを実施し，機能の正当性を確認した．特にインポート機能においては，複雑な構成を持つ既存のHCLファイルを読み込み，内部データ構造を経て再度ファイル出力した際に，コメントや空白を含むテキストが完全に復元されることを重点的に検証している．これらのテストを通じ，TerraGUIが既存のIaC資産を破壊することなく，安全に視覚的な編集を提供できることを確認した．

    = 結論
    本稿では，HCLのロスレス編集と意味的階層化を実現するOSS「TerraGUI」を提案した．提案手法により，既存のIaC資産のコメント等の価値を損なうことなく，直感的なGUI編集が可能となった．今後は共同編集機能の追加や，AIを用いた構成提案機能の統合を進める予定である．

    #bibliography("works.bib", style: "./cite.csl")
  ]
]
